/**
 * Генерация и валидация backup кодов для администраторов
 * Используются как резервный способ входа при утере Passkey устройства
 */

import { hash, compare } from 'bcryptjs';
import { prisma } from './prisma';

const RECOVERY_CODE_LENGTH = 8;
const RECOVERY_CODE_COUNT = 10;

/**
 * Генерировать читаемый recovery код (формат: XXXX-XXXX)
 */
function generateReadableCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Исключены похожие символы (I, O, 0, 1)
  let code = '';

  for (let i = 0; i < RECOVERY_CODE_LENGTH; i++) {
    if (i === 4) {
      code += '-';
    }
    const randomIndex = Math.floor(Math.random() * chars.length);
    code += chars[randomIndex];
  }

  return code;
}

/**
 * Сгенерировать набор recovery кодов для администратора
 */
export async function generateAdminRecoveryCodes(adminId: string): Promise<string[]> {
  // Генерируем коды
  const codes: string[] = [];
  for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
    codes.push(generateReadableCode());
  }

  // Хешируем и сохраняем в БД
  const hashedCodes = await Promise.all(codes.map((code) => hash(code, 10)));

  await prisma.adminRecoveryCode.createMany({
    data: hashedCodes.map((codeHash) => ({
      adminId,
      codeHash,
    })),
  });

  return codes;
}

/**
 * Валидировать recovery код и пометить как использованный
 */
export async function validateAdminRecoveryCode(
  adminId: string,
  code: string
): Promise<boolean> {
  // Нормализуем код (убираем пробелы, переводим в верхний регистр)
  const normalizedCode = code.replace(/[\s-]/g, '').toUpperCase();

  // Получаем все неиспользованные коды администратора
  const recoveryCodes = await prisma.adminRecoveryCode.findMany({
    where: {
      adminId,
      used: false,
    },
  });

  if (recoveryCodes.length === 0) {
    return false;
  }

  // Проверяем код по всем хешам
  for (const recoveryCode of recoveryCodes) {
    const isValid = await compare(normalizedCode, recoveryCode.codeHash);

    if (isValid) {
      // Помечаем код как использованный
      await prisma.adminRecoveryCode.update({
        where: { id: recoveryCode.id },
        data: {
          used: true,
          usedAt: new Date(),
        },
      });

      return true;
    }
  }

  return false;
}

/**
 * Получить количество оставшихся recovery кодов
 */
export async function getAdminRemainingRecoveryCodes(adminId: string): Promise<number> {
  return prisma.adminRecoveryCode.count({
    where: {
      adminId,
      used: false,
    },
  });
}

/**
 * Регенерировать recovery коды (удаляет старые и создаёт новые)
 */
export async function regenerateAdminRecoveryCodes(adminId: string): Promise<string[]> {
  // Удаляем старые коды
  await prisma.adminRecoveryCode.deleteMany({
    where: { adminId },
  });

  // Генерируем новые
  return generateAdminRecoveryCodes(adminId);
}

/**
 * Проверить, есть ли у администратора активные recovery коды
 */
export async function hasAdminRecoveryCodes(adminId: string): Promise<boolean> {
  const count = await getAdminRemainingRecoveryCodes(adminId);
  return count > 0;
}

/**
 * Получить информацию о recovery кодах (без самих кодов)
 */
export async function getAdminRecoveryCodesInfo(adminId: string) {
  const total = await prisma.adminRecoveryCode.count({
    where: { adminId },
  });

  const used = await prisma.adminRecoveryCode.count({
    where: {
      adminId,
      used: true,
    },
  });

  const remaining = total - used;

  return {
    total,
    used,
    remaining,
    hasAny: total > 0,
    needsRegeneration: remaining < 3, // Предупреждение если осталось меньше 3
  };
}
