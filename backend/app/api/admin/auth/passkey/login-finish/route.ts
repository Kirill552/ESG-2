/**
 * POST /api/admin/auth/passkey/login-finish
 * Завершение аутентификации и создание сессии
 */

import { NextRequest, NextResponse } from 'next/server';
import { finishAdminPasskeyAuthentication } from '@/lib/admin-webauthn-config';
import { createAdminSession } from '@/lib/admin-session-utils';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const LoginFinishSchema = z.object({
  email: z.string().email(),
  authResponse: z.any(), // AuthenticationResponseJSON from WebAuthn
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, authResponse } = LoginFinishSchema.parse(body);

    // Получаем текущий домен и протокол из запроса
    const host = request.headers.get('host') || 'localhost';
    const protocol = request.headers.get('x-forwarded-proto') ||
                     (host.includes('localhost') ? 'http' : 'https');

    const rpId = host;
    const origin = `${protocol}://${host}`;

    console.log(`[Admin Passkey Login] Finishing for ${email}, RP ID: ${rpId}, Origin: ${origin}`);

    // Завершаем аутентификацию Passkey с правильным rpId и origin
    const result = await finishAdminPasskeyAuthentication(
      email,
      authResponse,
      rpId,
      origin
    );

    if (!result.verified || !result.admin) {
      // Логируем неудачную попытку
      await prisma.adminSecurityIncident.create({
        data: {
          type: 'mfa_failure',
          severity: 'WARN',
          message: `Неудачная Passkey аутентификация для ${email}`,
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
        },
      });

      return NextResponse.json(
        { error: 'Не удалось верифицировать Passkey' },
        { status: 401 }
      );
    }

    // Создаём сессию
    const { token, session } = await createAdminSession(
      result.admin.id,
      result.admin.email,
      result.admin.role
    );

    // Логируем успешный вход
    await prisma.adminSecurityIncident.create({
      data: {
        adminId: result.admin.id,
        type: 'login_success',
        severity: 'INFO',
        message: `Успешный вход администратора ${email}`,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    console.log(`[Admin Passkey Login] Success for ${email}`);

    // Устанавливаем cookie с токеном
    const response = NextResponse.json({
      success: true,
      admin: {
        id: result.admin.id,
        email: result.admin.email,
        role: result.admin.role,
      },
      sessionExpiresAt: session.expiresAt,
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

    console.error('[Admin Passkey Login Finish] Error:', error);

    // Логируем ошибку
    await prisma.adminSecurityIncident.create({
      data: {
        type: 'login_failed',
        severity: 'ERROR',
        message: `Ошибка при завершении входа: ${error}`,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    return NextResponse.json(
      { error: 'Ошибка при завершении входа' },
      { status: 500 }
    );
  }
}
