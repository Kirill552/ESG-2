/**
 * PUT /api/admin/profile/telegram - обновить настройки Telegram бота
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/admin-middleware';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const TelegramSettingsSchema = z.object({
  telegramBotToken: z.string().nullable(),
  telegramEnabled: z.boolean(),
  notifyTrialRequests: z.boolean(),
  notifyUserErrors: z.boolean(),
  notifySystemErrors: z.boolean(),
  notifyPayments: z.boolean(),
  notifySecurityIssues: z.boolean(),
});

async function putHandler(request: NextRequest, context: { admin: any }) {
  try {
    const adminId = context.admin.id;
    const body = await request.json();

    const settings = TelegramSettingsSchema.parse(body);

    // Обновляем настройки администратора
    const admin = await prisma.adminUser.update({
      where: { id: adminId },
      data: {
        telegramBotToken: settings.telegramBotToken,
        telegramEnabled: settings.telegramEnabled,
        notifyTrialRequests: settings.notifyTrialRequests,
        notifyUserErrors: settings.notifyUserErrors,
        notifySystemErrors: settings.notifySystemErrors,
        notifyPayments: settings.notifyPayments,
        notifySecurityIssues: settings.notifySecurityIssues,
      },
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

    // Логируем изменение настроек
    await prisma.adminSecurityIncident.create({
      data: {
        adminId,
        type: 'telegram_settings_updated',
        severity: 'INFO',
        message: `Администратор ${context.admin.email} обновил настройки Telegram уведомлений`,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        metadata: {
          telegramEnabled: settings.telegramEnabled,
          notificationTypes: {
            trialRequests: settings.notifyTrialRequests,
            userErrors: settings.notifyUserErrors,
            systemErrors: settings.notifySystemErrors,
            payments: settings.notifyPayments,
            securityIssues: settings.notifySecurityIssues,
          },
        },
      },
    });

    console.log(`[Admin Telegram Settings] Updated for ${context.admin.email}`, {
      telegramEnabled: settings.telegramEnabled,
    });

    return NextResponse.json({
      success: true,
      message: 'Настройки Telegram успешно обновлены',
      admin,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Некорректные данные', details: error.errors },
        { status: 400 }
      );
    }

    console.error('[Admin Telegram Settings] Error:', error);
    return NextResponse.json(
      { error: 'Ошибка при обновлении настроек' },
      { status: 500 }
    );
  }
}

export const PUT = withAdminAuth(putHandler);
