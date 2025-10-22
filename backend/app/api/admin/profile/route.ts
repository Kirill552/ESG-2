/**
 * GET /api/admin/profile - получить профиль текущего администратора
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/admin-middleware';
import { prisma } from '@/lib/prisma';

async function getHandler(request: NextRequest, context: { admin: any }) {
  try {
    const adminId = context.admin.id;

    // Получаем полную информацию об администраторе
    const admin = await prisma.adminUser.findUnique({
      where: { id: adminId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        telegramBotToken: true,
        telegramEnabled: true,
        notifyTrialRequests: true,
        notifyUserErrors: true,
        notifySystemErrors: true,
        notifyPayments: true,
        notifySecurityIssues: true,
        _count: {
          select: {
            webAuthnCredentials: true,
            recoveryCodes: true,
            sessions: true,
          },
        },
      },
    });

    if (!admin) {
      return NextResponse.json({ error: 'Администратор не найден' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      admin,
    });
  } catch (error) {
    console.error('[Admin Profile] Error:', error);
    return NextResponse.json({ error: 'Ошибка при загрузке профиля' }, { status: 500 });
  }
}

export const GET = withAdminAuth(getHandler);
