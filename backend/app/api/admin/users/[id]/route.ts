/**
 * GET /api/admin/users/[id] — детальная информация о пользователе
 * PATCH /api/admin/users/[id] — обновление пользователя (блокировка, смена режима)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/admin-middleware';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import type { UserMode } from '@prisma/client';

// GET — получение детальной информации о пользователе
async function getHandler(
  request: NextRequest,
  { params, admin }: { params: { id: string }; admin: any }
) {
  try {
    const userId = params.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        organization: {
          include: {
            profile: true,
          },
        },
        organizationMemberships: {
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                inn: true,
              },
            },
          },
        },
        userProfile: true,
        documents: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            fileName: true,
            fileType: true,
            status: true,
            createdAt: true,
          },
        },
        reports: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            name: true,
            status: true,
            createdAt: true,
          },
        },
        sessions: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            sessionToken: true,
            expires: true,
            createdAt: true,
          },
        },
        trialRequests: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        _count: {
          select: {
            documents: true,
            reports: true,
            sessions: true,
            webAuthnCredentials: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
    }

    // Дополнительная статистика
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [documentsThisMonth, reportsThisMonth, activeSessions] = await Promise.all([
      prisma.document.count({
        where: {
          userId,
          createdAt: { gte: startOfMonth },
        },
      }),
      prisma.report.count({
        where: {
          userId,
          createdAt: { gte: startOfMonth },
        },
      }),
      prisma.session.count({
        where: {
          userId,
          expires: { gt: now },
        },
      }),
    ]);

    return NextResponse.json({
      user,
      stats: {
        documentsThisMonth,
        reportsThisMonth,
        activeSessions,
      },
    });
  } catch (error) {
    console.error('[Admin User Get] Error:', error);
    return NextResponse.json(
      { error: 'Ошибка при загрузке данных пользователя' },
      { status: 500 }
    );
  }
}

// PATCH — обновление пользователя
const UpdateSchema = z.object({
  action: z.enum(['block', 'unblock', 'change_mode', 'update_plan_expiry', 'update_notes']),
  // Для блокировки
  blockReason: z.string().optional(),
  // Для смены режима
  mode: z.enum(['DEMO', 'TRIAL', 'PAID', 'EXPIRED']).optional(),
  // Для обновления срока
  planExpiry: z.string().datetime().nullable().optional(),
  // Для заметок (если нужны в будущем)
  adminNotes: z.string().optional(),
});

async function patchHandler(
  request: NextRequest,
  { params, admin }: { params: { id: string }; admin: any }
) {
  try {
    const userId = params.id;
    const body = await request.json();
    const { action, blockReason, mode, planExpiry, adminNotes } = UpdateSchema.parse(body);

    // Получаем пользователя
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        organization: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
    }

    let updateData: any = {};
    let logMessage: string = '';
    let severity: 'INFO' | 'WARNING' | 'ERROR' = 'INFO';

    switch (action) {
      case 'block':
        updateData.isBlocked = true;
        logMessage = `${admin.email} заблокировал пользователя ${user.email}. Причина: ${blockReason || 'не указана'}`;
        severity = 'WARNING';
        break;

      case 'unblock':
        updateData.isBlocked = false;
        logMessage = `${admin.email} разблокировал пользователя ${user.email}`;
        severity = 'INFO';
        break;

      case 'change_mode':
        if (!mode) {
          return NextResponse.json({ error: 'Не указан режим' }, { status: 400 });
        }
        updateData.mode = mode;
        logMessage = `${admin.email} изменил режим пользователя ${user.email} с ${user.mode} на ${mode}`;
        severity = 'INFO';
        break;

      case 'update_plan_expiry':
        updateData.planExpiry = planExpiry ? new Date(planExpiry) : null;
        logMessage = `${admin.email} обновил срок действия плана для ${user.email}`;
        severity = 'INFO';
        break;

      case 'update_notes':
        // Если в будущем добавим поле adminNotes в User модель
        logMessage = `${admin.email} обновил заметки для пользователя ${user.email}`;
        severity = 'INFO';
        break;

      default:
        return NextResponse.json({ error: 'Неверное действие' }, { status: 400 });
    }

    // Обновляем пользователя
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            inn: true,
          },
        },
      },
    });

    // Логируем действие
    await prisma.adminSecurityIncident.create({
      data: {
        adminId: admin.id,
        type: 'user_modified',
        severity,
        message: logMessage,
        metadata: {
          userId,
          action,
          blockReason,
          mode,
          planExpiry,
          oldValues: {
            isBlocked: user.isBlocked,
            mode: user.mode,
            planExpiry: user.planExpiry,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message:
        action === 'block'
          ? 'Пользователь заблокирован'
          : action === 'unblock'
            ? 'Пользователь разблокирован'
            : action === 'change_mode'
              ? 'Режим изменен'
              : 'Пользователь обновлен',
      user: updatedUser,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Некорректные данные', details: error.errors },
        { status: 400 }
      );
    }

    console.error('[Admin User Update] Error:', error);
    return NextResponse.json(
      { error: 'Ошибка при обновлении пользователя' },
      { status: 500 }
    );
  }
}

export const GET = withAdminAuth(getHandler);
export const PATCH = withAdminAuth(patchHandler);
