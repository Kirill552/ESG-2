/**
 * POST /api/admin/auth/passkey/login-begin
 * Начало аутентификации администратора через Passkey
 */

import { NextRequest, NextResponse } from 'next/server';
import { beginAdminPasskeyAuthentication } from '@/lib/admin-webauthn-config';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const LoginBeginSchema = z.object({
  email: z.string().email('Некорректный email'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = LoginBeginSchema.parse(body);

    // Получаем текущий домен и протокол из запроса
    const host = request.headers.get('host') || 'localhost';
    const protocol = request.headers.get('x-forwarded-proto') ||
                     (host.includes('localhost') ? 'http' : 'https');

    const rpId = host;
    const origin = `${protocol}://${host}`;

    console.log(`[Admin Passkey Login] Begin for ${email}`);
    console.log(`[Admin Passkey Login] RP ID: ${rpId}`);
    console.log(`[Admin Passkey Login] Origin: ${origin}`);

    // Логируем попытку входа
    await prisma.adminSecurityIncident.create({
      data: {
        type: 'login_attempt',
        severity: 'INFO',
        message: `Попытка входа администратора ${email} (RP ID: ${rpId})`,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        metadata: { email, rpId, origin },
      },
    });

    // Генерируем options для аутентификации с правильным rpId
    const options = await beginAdminPasskeyAuthentication(email, rpId, origin);

    console.log(`[Admin Passkey Login] Options generated successfully`);
    console.log(`[Admin Passkey Login] Sending to client:`, JSON.stringify({
      rpId: options.rpId,
      allowCredentials: options.allowCredentials,
      userVerification: options.userVerification,
    }, null, 2));

    return NextResponse.json({
      success: true,
      options,
    });
  } catch (error: any) {
    // Специальная обработка ошибок для безопасности
    // Не раскрываем причину ошибки (существует ли email или нет)
    console.error('[Admin Passkey Login Begin] Error:', error);

    // Логируем неудачную попытку
    await prisma.adminSecurityIncident.create({
      data: {
        type: 'login_failed',
        severity: 'WARN',
        message: `Неудачная попытка входа: ${error.message}`,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        metadata: { error: error.message },
      },
    });

    return NextResponse.json(
      { error: 'Не удалось начать аутентификацию. Проверьте email и наличие зарегистрированных Passkey.' },
      { status: 400 }
    );
  }
}
