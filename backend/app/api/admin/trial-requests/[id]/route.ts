/**
 * GET /api/admin/trial-requests/[id] — получение детальной информации о заявке
 * PUT /api/admin/trial-requests/[id] — обновление статуса заявки, добавление комментариев
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/admin-middleware';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { notificationService, NotificationType, NotificationPriority } from '@/lib/notification-service';
import { telegramBotService } from '@/lib/telegram-bot-service';

// GET — получение детальной информации о заявке
async function getHandler(
  request: NextRequest,
  context: any
) {
  try {
    const params = await context.params;
    const requestId = params.id;

    const trialRequest = await prisma.trialRequest.findUnique({
      where: { id: requestId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            mode: true,
            createdAt: true,
            organization: {
              select: {
                id: true,
                name: true,
                inn: true,
                isBlocked: true,
              },
            },
          },
        },
      },
    });

    if (!trialRequest) {
      return NextResponse.json({ error: 'Заявка не найдена' }, { status: 404 });
    }

    return NextResponse.json({ trialRequest });
  } catch (error) {
    console.error('[Admin Trial Request Get] Error:', error);
    return NextResponse.json(
      { error: 'Ошибка при загрузке заявки' },
      { status: 500 }
    );
  }
}

// PUT — обновление статуса заявки
const UpdateSchema = z.object({
  action: z.enum(['approve', 'reject', 'update_notes']),
  // Для одобрения/отклонения
  adminNotes: z.string().optional(),
  // Для одобрения - настройки доступа
  grantAccess: z
    .object({
      canUploadDocuments: z.boolean().optional(),
      canUseOCR: z.boolean().optional(),
      canGenerate296FZ: z.boolean().optional(),
      canGenerateCBAM: z.boolean().optional(),
      canExportData: z.boolean().optional(),
      canUseAnalytics: z.boolean().optional(),
      documentsPerMonth: z.number().int().min(0).optional(),
      reportsPerMonth: z.number().int().min(0).optional(),
      ocrPagesPerMonth: z.number().int().min(0).optional(),
    })
    .optional(),
});

async function putHandler(
  request: NextRequest,
  context: any
) {
  try {
    const params = await context.params;
    const requestId = params.id;
    const admin = context.admin;

    const body = await request.json();
    const { action, adminNotes, grantAccess } = UpdateSchema.parse(body);

    // Получаем заявку
    const trialRequest = await prisma.trialRequest.findUnique({
      where: { id: requestId },
      include: {
        user: {
          include: {
            organization: true,
          },
        },
      },
    });

    if (!trialRequest) {
      return NextResponse.json({ error: 'Заявка не найдена' }, { status: 404 });
    }

    if (action === 'update_notes') {
      // Просто обновляем заметки
      const updated = await prisma.trialRequest.update({
        where: { id: requestId },
        data: {
          adminNotes,
          updatedAt: new Date(),
        },
      });

      // Логируем действие
      await prisma.adminSecurityIncident.create({
        data: {
          adminId: admin.id,
          type: 'trial_request_notes_updated',
          severity: 'INFO',
          message: `Администратор ${admin.email} обновил заметки к заявке ${trialRequest.userEmail}`,
          metadata: {
            requestId,
            userEmail: trialRequest.userEmail,
            companyName: trialRequest.companyName,
          },
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Заметки успешно обновлены',
        trialRequest: updated,
      });
    }

    if (action === 'approve') {
      // Одобряем заявку
      const updated = await prisma.trialRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          adminNotes,
          processedAt: new Date(),
          processedBy: admin.email,
          updatedAt: new Date(),
        },
      });

      // Обновляем режим пользователя с DEMO на TRIAL или PAID
      await prisma.user.update({
        where: { id: trialRequest.userId },
        data: {
          mode: 'TRIAL',
          planExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 дней trial
        },
      });

      // Если есть организация, обновляем доступы
      if (trialRequest.user.organization && grantAccess) {
        await prisma.organization.update({
          where: { id: trialRequest.user.organization.id },
          data: {
            canUploadDocuments: grantAccess.canUploadDocuments ?? true,
            canUseOCR: grantAccess.canUseOCR ?? true,
            canGenerate296FZ: grantAccess.canGenerate296FZ ?? true,
            canGenerateCBAM: grantAccess.canGenerateCBAM ?? false,
            canExportData: grantAccess.canExportData ?? true,
            canUseAnalytics: grantAccess.canUseAnalytics ?? true,
            documentsPerMonth: grantAccess.documentsPerMonth ?? 0,
            reportsPerMonth: grantAccess.reportsPerMonth ?? 0,
            ocrPagesPerMonth: grantAccess.ocrPagesPerMonth ?? 0,
          },
        });
      }

      // Логируем одобрение
      await prisma.adminSecurityIncident.create({
        data: {
          adminId: admin.id,
          type: 'trial_request_approved',
          severity: 'INFO',
          message: `Администратор ${admin.email} одобрил заявку ${trialRequest.userEmail}`,
          metadata: {
            requestId,
            userEmail: trialRequest.userEmail,
            companyName: trialRequest.companyName,
            grantedAccess: grantAccess,
          },
        },
      });

      // Отправляем Email пользователю о одобрении
      try {
        await notificationService.sendNotification(
          {
            userId: trialRequest.userId,
            type: NotificationType.TRIAL_REQUEST_APPROVED,
            title: '✅ Ваша заявка на доступ одобрена!',
            message: `Поздравляем! Ваша заявка на доступ к платформе ESG-Лайт одобрена. Теперь вы можете загружать документы, генерировать отчёты и использовать все функции платформы.`,
            metadata: {
              companyName: trialRequest.companyName,
              trialDuration: '30 дней',
              grantedAccess: grantAccess,
              link: '/dashboard',
              actionText: 'Перейти в панель управления',
              priority: NotificationPriority.HIGH,
            },
          },
          {
            email: true,
            ignorePreferences: true, // Критическое уведомление
          }
        );
        console.log(`✅ [Trial Request Approved] Email sent to ${trialRequest.userEmail}`);
      } catch (emailError) {
        console.error(`❌ [Trial Request Approved] Email failed for ${trialRequest.userEmail}:`, emailError);
        // Не блокируем основной процесс если email не отправился
      }

      // Отправляем Telegram уведомление администратору
      try {
        await telegramBotService.sendAdminNotification({
          type: 'trial_request',
          title: '✅ Заявка одобрена',
          message: `Администратор ${admin.email} одобрил заявку на доступ`,
          metadata: {
            Компания: trialRequest.companyName,
            Email: trialRequest.userEmail,
            ИНН: trialRequest.companyInn,
            'Обработал': admin.email,
          },
          priority: 'medium',
        });
      } catch (telegramError) {
        console.error('❌ [Telegram] Не удалось отправить уведомление:', telegramError);
        // Не блокируем основной процесс
      }

      return NextResponse.json({
        success: true,
        message: 'Заявка успешно одобрена, пользователь получил доступ',
        trialRequest: updated,
      });
    }

    if (action === 'reject') {
      // Отклоняем заявку
      const updated = await prisma.trialRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED',
          adminNotes,
          processedAt: new Date(),
          processedBy: admin.email,
          updatedAt: new Date(),
        },
      });

      // Логируем отклонение
      await prisma.adminSecurityIncident.create({
        data: {
          adminId: admin.id,
          type: 'trial_request_rejected',
          severity: 'INFO',
          message: `Администратор ${admin.email} отклонил заявку ${trialRequest.userEmail}`,
          metadata: {
            requestId,
            userEmail: trialRequest.userEmail,
            companyName: trialRequest.companyName,
            reason: adminNotes,
          },
        },
      });

      // Отправляем Email пользователю об отклонении
      try {
        await notificationService.sendNotification(
          {
            userId: trialRequest.userId,
            type: NotificationType.TRIAL_REQUEST_REJECTED,
            title: '❌ Ваша заявка на доступ отклонена',
            message: `К сожалению, ваша заявка на доступ к платформе ESG-Лайт была отклонена.`,
            metadata: {
              companyName: trialRequest.companyName,
              rejectionReason: adminNotes || 'Не указана',
              adminNotes: adminNotes,
              link: '/pricing',
              actionText: 'Подать новую заявку',
              priority: NotificationPriority.HIGH,
            },
          },
          {
            email: true,
            ignorePreferences: true, // Критическое уведомление
          }
        );
        console.log(`✅ [Trial Request Rejected] Email sent to ${trialRequest.userEmail}`);
      } catch (emailError) {
        console.error(`❌ [Trial Request Rejected] Email failed for ${trialRequest.userEmail}:`, emailError);
        // Не блокируем основной процесс если email не отправился
      }

      // Отправляем Telegram уведомление администратору
      try {
        await telegramBotService.sendAdminNotification({
          type: 'trial_request',
          title: '❌ Заявка отклонена',
          message: `Администратор ${admin.email} отклонил заявку на доступ`,
          metadata: {
            Компания: trialRequest.companyName,
            Email: trialRequest.userEmail,
            ИНН: trialRequest.companyInn,
            Причина: adminNotes || 'Не указана',
            'Обработал': admin.email,
          },
          priority: 'low',
        });
      } catch (telegramError) {
        console.error('❌ [Telegram] Не удалось отправить уведомление:', telegramError);
        // Не блокируем основной процесс
      }

      return NextResponse.json({
        success: true,
        message: 'Заявка отклонена',
        trialRequest: updated,
      });
    }

    return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Некорректные данные', details: error.errors },
        { status: 400 }
      );
    }

    console.error('[Admin Trial Request Update] Error:', error);
    return NextResponse.json(
      { error: 'Ошибка при обновлении заявки' },
      { status: 500 }
    );
  }
}

export const GET = withAdminAuth(getHandler);
export const PUT = withAdminAuth(putHandler);
