/**
 * Скрипт для ручного переключения режима пользователя
 * Использование: npx tsx scripts/upgrade-user-mode.ts whirpy@yandex.ru PAID
 */

import { PrismaClient, UserMode } from '@prisma/client';

const prisma = new PrismaClient();

async function upgradeUserMode(email: string, newMode: UserMode) {
  try {
    console.log(`🔄 Переключение пользователя ${email} в режим ${newMode}...`);

    // Находим пользователя
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        mode: true,
      }
    });

    if (!user) {
      console.error(`❌ Пользователь ${email} не найден`);
      process.exit(1);
    }

    console.log(`📋 Текущий режим: ${user.mode}`);

    if (user.mode === newMode) {
      console.log(`✅ Пользователь уже в режиме ${newMode}`);
      return;
    }

    // Обновляем режим пользователя
    const updatedUser = await prisma.user.update({
      where: { email },
      data: { mode: newMode },
      select: {
        id: true,
        email: true,
        name: true,
        mode: true,
      }
    });

    console.log(`✅ Пользователь успешно переключен в режим ${newMode}`);
    console.log(`👤 Данные пользователя:`, {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      mode: updatedUser.mode,
    });

    // Логируем действие
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'USER_MODE_CHANGED',
        resourceType: 'USER',
        resourceId: user.id,
        ipAddress: 'localhost',
        userAgent: 'upgrade-script',
        details: {
          oldMode: user.mode,
          newMode: newMode,
        },
        metadata: {
          script: 'upgrade-user-mode.ts',
          executedAt: new Date().toISOString(),
        }
      }
    });

    console.log(`📝 Действие записано в аудит-лог`);

  } catch (error) {
    console.error(`❌ Ошибка при переключении режима:`, error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Парсим аргументы командной строки
const email = process.argv[2];
const mode = process.argv[3] as UserMode;

if (!email || !mode) {
  console.error(`
❌ Использование: npx tsx scripts/upgrade-user-mode.ts <email> <mode>

Доступные режимы:
- DEMO    - демо-режим с моковыми данными
- TRIAL   - пробный режим (ограниченный доступ)
- PAID    - полный доступ
- EXPIRED - истекший доступ

Примеры:
npx tsx scripts/upgrade-user-mode.ts whirpy@yandex.ru PAID
npx tsx scripts/upgrade-user-mode.ts user@example.com TRIAL
npx tsx scripts/upgrade-user-mode.ts demo@test.com DEMO
  `);
  process.exit(1);
}

if (!['DEMO', 'TRIAL', 'PAID', 'EXPIRED'].includes(mode)) {
  console.error(`❌ Неверный режим: ${mode}`);
  console.error(`Доступные режимы: DEMO, TRIAL, PAID, EXPIRED`);
  process.exit(1);
}

upgradeUserMode(email, mode);