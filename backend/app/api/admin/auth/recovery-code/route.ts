/**
 * POST /api/admin/auth/recovery-code
 * Вход через backup код восстановления
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateAdminRecoveryCode, getAdminRemainingRecoveryCodes } from '@/lib/admin-recovery-codes';
import { createAdminSession } from '@/lib/admin-session-utils';
import { z } from 'zod';

const RecoveryCodeSchema = z.object({
  email: z.string().email('Некорректный email'),
  code: z.string().min(8, 'Код должен содержать минимум 8 символов'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code } = RecoveryCodeSchema.parse(body);

    // Находим администратора
    const admin = await prisma.adminUser.findUnique({
      where: { email },
    });

    if (!admin || !admin.isActive) {
      // Не раскрываем, существует ли email
      await prisma.adminSecurityIncident.create({
        data: {
          type: 'recovery_code_failure',
          severity: 'WARN',
          message: `Попытка входа по recovery коду для несуществующего/неактивного админа: ${email}`,
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
        },
      });

      return NextResponse.json(
        { error: 'Неверный email или код восстановления' },
        { status: 401 }
      );
    }

    // Валидируем recovery код
    const isValid = await validateAdminRecoveryCode(admin.id, code);

    if (!isValid) {
      // Логируем неудачную попытку
      await prisma.adminSecurityIncident.create({
        data: {
          adminId: admin.id,
          type: 'recovery_code_failure',
          severity: 'WARN',
          message: `Неверный recovery код для ${email}`,
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
        },
      });

      return NextResponse.json(
        { error: 'Неверный код восстановления' },
        { status: 401 }
      );
    }

    // Создаём сессию
    const { token, session } = await createAdminSession(admin.id, admin.email, admin.role);

    // Проверяем количество оставшихся кодов
    const remainingCodes = await getAdminRemainingRecoveryCodes(admin.id);

    // Логируем успешный вход
    await prisma.adminSecurityIncident.create({
      data: {
        adminId: admin.id,
        type: 'recovery_code_used',
        severity: remainingCodes < 3 ? 'WARN' : 'INFO',
        message: `Вход через recovery код для ${email}. Осталось кодов: ${remainingCodes}`,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        metadata: { remainingCodes },
      },
    });

    console.log(`[Admin Recovery Code Login] Success for ${email}. Remaining codes: ${remainingCodes}`);

    // Устанавливаем cookie
    const response = NextResponse.json({
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
      },
      sessionExpiresAt: session.expiresAt,
      warning: remainingCodes < 3
        ? `У вас осталось только ${remainingCodes} кодов восстановления. Рекомендуем сгенерировать новые.`
        : undefined,
      remainingCodes,
    });

    response.cookies.set('admin-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 60, // 30 минут
      path: '/',
    });

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Некорректные данные', details: error.errors },
        { status: 400 }
      );
    }

    console.error('[Admin Recovery Code Login] Error:', error);
    return NextResponse.json(
      { error: 'Ошибка при входе через recovery код' },
      { status: 500 }
    );
  }
}
