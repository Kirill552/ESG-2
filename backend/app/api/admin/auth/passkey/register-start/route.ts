/**
 * POST /api/admin/auth/passkey/register-start
 * Начало регистрации Passkey для текущего авторизованного администратора
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/admin-middleware';
import { beginAdminPasskeyRegistration } from '@/lib/admin-webauthn-config';

async function postHandler(
  request: NextRequest,
  context: any
) {
  try {
    const admin = context.admin;

    // Получаем текущий домен и протокол из запроса
    const host = request.headers.get('host') || 'localhost';
    const protocol = request.headers.get('x-forwarded-proto') ||
                     (host.includes('localhost') ? 'http' : 'https');

    const rpId = host;
    const origin = `${protocol}://${host}`;

    console.log(`[Admin Passkey] Starting registration for admin: ${admin.email}`);
    console.log(`[Admin Passkey] Using RP ID: ${rpId}, Origin: ${origin}`);

    // Генерируем options для регистрации Passkey с правильным rpId и origin
    const options = await beginAdminPasskeyRegistration(admin.id, admin.email, rpId, origin);

    return NextResponse.json({
      success: true,
      options,
    });
  } catch (error) {
    console.error('[Admin Passkey Register Start] Error:', error);
    return NextResponse.json(
      { error: 'Не удалось начать регистрацию Passkey' },
      { status: 500 }
    );
  }
}

export const POST = withAdminAuth(postHandler);
