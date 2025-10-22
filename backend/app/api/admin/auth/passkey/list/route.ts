/**
 * GET /api/admin/auth/passkey/list
 * Получить список всех настроенных Passkey администратора
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/admin-middleware';
import { prisma } from '@/lib/prisma';

async function getHandler(request: NextRequest, context: any) {
  try {
    const admin = context.admin;

    // Получаем все Passkey администратора
    const passkeys = await prisma.adminWebAuthnCredential.findMany({
      where: {
        adminId: admin.id,
      },
      select: {
        id: true,
        credentialId: true,
        transports: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      passkeys: passkeys.map((pk) => ({
        id: pk.id,
        credentialId: pk.credentialId,
        transports: pk.transports,
        createdAt: pk.createdAt.toISOString(),
      })),
    });
  } catch (error: any) {
    console.error('[Admin Passkey List] Error:', error);
    return NextResponse.json(
      { error: 'Ошибка получения списка Passkey' },
      { status: 500 }
    );
  }
}

export const GET = withAdminAuth(getHandler);
