/**
 * POST /api/admin/auth/passkey/register-finish
 * Завершение регистрации Passkey для текущего авторизованного администратора
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/admin-middleware';
import { finishAdminPasskeyRegistration } from '@/lib/admin-webauthn-config';
import { generateAdminRecoveryCodes } from '@/lib/admin-recovery-codes';
import { prisma } from '@/lib/prisma';

async function postHandler(
  request: NextRequest,
  context: any
) {
  try {
    const admin = context.admin;
    const body = await request.json();

    // Получаем текущий домен и протокол из запроса
    const host = request.headers.get('host') || 'localhost';
    const protocol = request.headers.get('x-forwarded-proto') ||
                     (host.includes('localhost') ? 'http' : 'https');

    const rpId = host;
    const origin = `${protocol}://${host}`;

    console.log(`[Admin Passkey] Finishing registration for admin: ${admin.email}`);
    console.log(`[Admin Passkey] Using RP ID: ${rpId}, Origin: ${origin}`);

    // Завершаем регистрацию Passkey с правильным rpId и origin
    const result = await finishAdminPasskeyRegistration(
      admin.id,
      admin.email,
      body,
      rpId,
      origin
    );

    if (!result.verified) {
      return NextResponse.json(
        { error: 'Не удалось верифицировать Passkey' },
        { status: 400 }
      );
    }

    // Генерируем backup коды восстановления
    const recoveryCodes = await generateAdminRecoveryCodes(admin.id);

    // Логируем успешную регистрацию
    await prisma.adminSecurityIncident.create({
      data: {
        adminId: admin.id,
        type: 'passkey_registered',
        severity: 'INFO',
        message: `Администратор ${admin.email} успешно зарегистрировал новый Passkey`,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    console.log(`✅ [Admin Passkey] Successfully registered for admin: ${admin.email}`);

    return NextResponse.json({
      success: true,
      message: 'Passkey успешно зарегистрирован',
      recoveryCodes,
      warning: 'ВАЖНО: Сохраните эти коды восстановления в безопасном месте. Они понадобятся для входа, если вы потеряете доступ к Passkey устройству.',
    });
  } catch (error) {
    console.error('[Admin Passkey Register Finish] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';

    return NextResponse.json(
      { error: `Ошибка завершения регистрации Passkey: ${errorMessage}` },
      { status: 500 }
    );
  }
}

export const POST = withAdminAuth(postHandler);
