/**
 * Middleware для защиты /admin/* routes
 * Проверка JWT токена, сессии, rate limiting
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateAdminSession } from './admin-session-utils';
import { prisma } from './prisma';
import type { AdminRole } from '@prisma/client';

// Rate limiting для админки (5 попыток за 15 минут)
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 минут
const RATE_LIMIT_MAX_ATTEMPTS = 5;

// Хранилище попыток (в продакшене использовать Redis)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Проверка rate limit для IP адреса
 */
function checkRateLimit(ip: string): { allowed: boolean; resetAt?: Date } {
  const now = Date.now();
  const record = rateLimitStore.get(ip);

  if (!record || record.resetAt < now) {
    // Новое окно
    rateLimitStore.set(ip, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW,
    });
    return { allowed: true };
  }

  if (record.count >= RATE_LIMIT_MAX_ATTEMPTS) {
    // Превышен лимит
    return {
      allowed: false,
      resetAt: new Date(record.resetAt),
    };
  }

  // Увеличиваем счётчик
  record.count++;
  return { allowed: true };
}

/**
 * Сбросить rate limit для IP (после успешного входа)
 */
function resetRateLimit(ip: string): void {
  rateLimitStore.delete(ip);
}

/**
 * Получить IP адрес из request
 */
function getClientIP(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

/**
 * Middleware для проверки аутентификации администратора
 */
export async function requireAdminAuth(request: NextRequest): Promise<{
  authenticated: boolean;
  response?: NextResponse;
  admin?: any;
}> {
  const ip = getClientIP(request);

  // Проверяем rate limit
  const rateLimit = checkRateLimit(ip);
  if (!rateLimit.allowed) {
    // Логируем инцидент
    await prisma.adminSecurityIncident.create({
      data: {
        type: 'rate_limit',
        severity: 'WARN',
        message: `Rate limit exceeded for IP ${ip}`,
        ipAddress: ip,
        userAgent: request.headers.get('user-agent') || 'unknown',
        metadata: { resetAt: rateLimit.resetAt },
      },
    });

    return {
      authenticated: false,
      response: NextResponse.json(
        {
          error: 'Слишком много попыток. Попробуйте позже.',
          resetAt: rateLimit.resetAt,
        },
        { status: 429 }
      ),
    };
  }

  // Получаем токен из cookie
  const token = request.cookies.get('admin-token')?.value;

  if (!token) {
    return {
      authenticated: false,
      response: NextResponse.json(
        { error: 'Требуется аутентификация' },
        { status: 401 }
      ),
    };
  }

  // Валидируем сессию
  const { valid, payload, admin } = await validateAdminSession(token);

  if (!valid) {
    // Логируем неудачную попытку
    await prisma.adminSecurityIncident.create({
      data: {
        type: 'anomaly',
        severity: 'WARN',
        message: 'Invalid admin session token',
        ipAddress: ip,
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    return {
      authenticated: false,
      response: NextResponse.json(
        { error: 'Невалидная сессия. Пожалуйста, войдите снова.' },
        { status: 401 }
      ),
    };
  }

  // Сбрасываем rate limit после успешной аутентификации
  resetRateLimit(ip);

  return {
    authenticated: true,
    admin,
  };
}

/**
 * Middleware для проверки роли администратора
 */
export function requireAdminRole(
  admin: any,
  allowedRoles: AdminRole[]
): { authorized: boolean; response?: NextResponse } {
  if (!admin || !allowedRoles.includes(admin.role)) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Недостаточно прав для выполнения этого действия' },
        { status: 403 }
      ),
    };
  }

  return { authorized: true };
}

/**
 * Middleware для проверки конкретного разрешения (AdminPermission)
 */
export async function requireAdminPermission(
  adminId: string,
  resource: string,
  action: string
): Promise<{ authorized: boolean; response?: NextResponse }> {
  // Получаем разрешения администратора
  const permissions = await prisma.adminPermission.findMany({
    where: {
      adminId,
      resource,
      action,
    },
  });

  if (permissions.length === 0) {
    // Проверяем, может быть у админа есть глобальное разрешение
    const globalPermission = await prisma.adminPermission.findFirst({
      where: {
        adminId,
        resource: '*',
        action: '*',
      },
    });

    if (!globalPermission) {
      return {
        authorized: false,
        response: NextResponse.json(
          { error: `Нет разрешения: ${resource}.${action}` },
          { status: 403 }
        ),
      };
    }
  }

  return { authorized: true };
}

/**
 * Утилита для логирования действий администратора
 */
export async function logAdminAction(
  adminId: string,
  action: string,
  resource: string,
  details: any,
  request: NextRequest
): Promise<void> {
  const ip = getClientIP(request);

  await prisma.adminSecurityIncident.create({
    data: {
      adminId,
      type: 'admin_action',
      severity: 'INFO',
      message: `Admin action: ${action} on ${resource}`,
      ipAddress: ip,
      userAgent: request.headers.get('user-agent') || 'unknown',
      metadata: {
        action,
        resource,
        details,
      },
    },
  });
}

/**
 * Wrapper для API routes администратора
 */
export function withAdminAuth(
  handler: (request: NextRequest, context: any) => Promise<NextResponse>,
  options?: {
    requiredRoles?: AdminRole[];
    requiredPermission?: { resource: string; action: string };
  }
) {
  return async (request: NextRequest, context: any) => {
    // Проверяем аутентификацию
    const authResult = await requireAdminAuth(request);

    if (!authResult.authenticated) {
      return authResult.response!;
    }

    // Проверяем роль если требуется
    if (options?.requiredRoles) {
      const roleCheck = requireAdminRole(authResult.admin, options.requiredRoles);
      if (!roleCheck.authorized) {
        return roleCheck.response!;
      }
    }

    // Проверяем разрешение если требуется
    if (options?.requiredPermission) {
      const permissionCheck = await requireAdminPermission(
        authResult.admin.id,
        options.requiredPermission.resource,
        options.requiredPermission.action
      );
      if (!permissionCheck.authorized) {
        return permissionCheck.response!;
      }
    }

    // Вызываем handler с admin в context
    return handler(request, { ...context, admin: authResult.admin });
  };
}
