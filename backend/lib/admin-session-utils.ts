/**
 * Утилиты для работы с сессиями администраторов
 * Управление JWT токенами, создание/валидация сессий
 */

import { SignJWT, jwtVerify } from 'jose';
import { prisma } from './prisma';
import type { AdminRole } from '@prisma/client';

const JWT_SECRET = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET || 'your-super-secret-admin-key-change-in-production'
);

const SESSION_DURATION = 30 * 60 * 1000; // 30 минут

export interface AdminSessionPayload {
  adminId: string;
  email: string;
  role: AdminRole;
  jti: string; // JWT ID для отзыва токенов
}

/**
 * Создать JWT токен для администратора
 */
export async function createAdminToken(
  adminId: string,
  email: string,
  role: AdminRole
): Promise<{ token: string; jti: string; expiresAt: Date }> {
  const jti = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DURATION);

  const token = await new SignJWT({
    adminId,
    email,
    role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(JWT_SECRET);

  return { token, jti, expiresAt };
}

/**
 * Верифицировать JWT токен администратора
 */
export async function verifyAdminToken(token: string): Promise<AdminSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);

    return {
      adminId: payload.adminId as string,
      email: payload.email as string,
      role: payload.role as AdminRole,
      jti: payload.jti as string,
    };
  } catch (error) {
    console.error('Admin token verification failed:', error);
    return null;
  }
}

/**
 * Создать сессию администратора в БД
 */
export async function createAdminSession(
  adminId: string,
  email: string,
  role: AdminRole
): Promise<{ token: string; session: any }> {
  const { token, jti, expiresAt } = await createAdminToken(adminId, email, role);

  const session = await prisma.adminSession.create({
    data: {
      adminId,
      tokenJti: jti,
      expiresAt,
    },
  });

  return { token, session };
}

/**
 * Валидировать существующую сессию
 */
export async function validateAdminSession(token: string): Promise<{
  valid: boolean;
  payload?: AdminSessionPayload;
  admin?: any;
}> {
  // Проверка JWT токена
  const payload = await verifyAdminToken(token);
  if (!payload) {
    return { valid: false };
  }

  // Проверка существования сессии в БД
  const session = await prisma.adminSession.findUnique({
    where: { tokenJti: payload.jti },
    include: {
      admin: {
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
        },
      },
    },
  });

  if (!session) {
    return { valid: false };
  }

  // Проверка истечения сессии
  if (session.expiresAt < new Date()) {
    await prisma.adminSession.delete({ where: { id: session.id } });
    return { valid: false };
  }

  // Проверка что админ активен
  if (!session.admin.isActive) {
    return { valid: false };
  }

  return {
    valid: true,
    payload,
    admin: session.admin,
  };
}

/**
 * Инвалидировать сессию (logout)
 */
export async function invalidateAdminSession(jti: string): Promise<void> {
  await prisma.adminSession.deleteMany({
    where: { tokenJti: jti },
  });
}

/**
 * Инвалидировать все сессии администратора
 */
export async function invalidateAllAdminSessions(adminId: string): Promise<void> {
  await prisma.adminSession.deleteMany({
    where: { adminId },
  });
}

/**
 * Очистить истёкшие сессии (cron job)
 */
export async function cleanupExpiredAdminSessions(): Promise<number> {
  const result = await prisma.adminSession.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });

  return result.count;
}

/**
 * Получить активные сессии администратора
 */
export async function getAdminActiveSessions(adminId: string) {
  return prisma.adminSession.findMany({
    where: {
      adminId,
      expiresAt: {
        gt: new Date(),
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}
