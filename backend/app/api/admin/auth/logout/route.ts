/**
 * POST /api/admin/auth/logout
 * Выход администратора (инвалидация сессии)
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken, invalidateAdminSession } from '@/lib/admin-session-utils';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    // Получаем токен из cookie
    const token = request.cookies.get('admin-token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Токен не найден' },
        { status: 401 }
      );
    }

    // Верифицируем токен
    const payload = await verifyAdminToken(token);

    if (!payload) {
      return NextResponse.json(
        { error: 'Невалидный токен' },
        { status: 401 }
      );
    }

    // Инвалидируем сессию
    await invalidateAdminSession(payload.jti);

    // Логируем выход
    await prisma.adminSecurityIncident.create({
      data: {
        adminId: payload.adminId,
        type: 'logout',
        severity: 'INFO',
        message: `Выход администратора ${payload.email}`,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    console.log(`[Admin Logout] Success for ${payload.email}`);

    // Удаляем cookie
    const response = NextResponse.json({
      success: true,
      message: 'Выход выполнен успешно',
    });

    response.cookies.delete('admin-token');

    return response;
  } catch (error) {
    console.error('[Admin Logout] Error:', error);
    return NextResponse.json(
      { error: 'Ошибка при выходе' },
      { status: 500 }
    );
  }
}
