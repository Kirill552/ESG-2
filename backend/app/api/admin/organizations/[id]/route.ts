/**
 * GET /api/admin/organizations/[id] — детальная информация о компании
 * PATCH /api/admin/organizations/[id] — обновление настроек компании (блокировка, заметки)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/admin-middleware';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// GET — получение детальной информации о компании
async function getHandler(
  request: NextRequest,
  { params, admin }: { params: { id: string }; admin: any }
) {
  try {
    const organizationId = params.id;

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        users: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                firstName: true,
                lastName: true,
                mode: true,
                createdAt: true,
                lastLoginAt: true,
                _count: {
                  select: {
                    documents: true,
                    reports: true,
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            users: true,
            auditLogs: true,
          },
        },
      },
    });

    if (!organization) {
      return NextResponse.json({ error: 'Компания не найдена' }, { status: 404 });
    }

    return NextResponse.json({ organization });
  } catch (error) {
    console.error('[Admin Organization Get] Error:', error);
    return NextResponse.json(
      { error: 'Ошибка при загрузке данных компании' },
      { status: 500 }
    );
  }
}

// PATCH — обновление настроек компании
const UpdateSchema = z.object({
  action: z.enum(['block', 'unblock', 'update_notes']),
  // Для блокировки
  blockReason: z.string().optional(),
  // Для заметок
  adminNotes: z.string().optional(),
});

async function patchHandler(
  request: NextRequest,
  { params, admin }: { params: { id: string }; admin: any }
) {
  try {
    const organizationId = params.id;
    const body = await request.json();
    const { action, blockReason, adminNotes } = UpdateSchema.parse(body);

    // Получаем компанию
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        users: true,
      },
    });

    if (!organization) {
      return NextResponse.json({ error: 'Компания не найдена' }, { status: 404 });
    }

    let updateData: any = {};
    let logMessage: string = '';
    let severity: 'INFO' | 'WARNING' | 'ERROR' = 'INFO';

    switch (action) {
      case 'block':
        updateData.isBlocked = true;
        logMessage = `${admin.email} заблокировал компанию ${organization.name} (ИНН: ${organization.inn}). Причина: ${blockReason || 'не указана'}`;
        severity = 'WARNING';
        break;

      case 'unblock':
        updateData.isBlocked = false;
        logMessage = `${admin.email} разблокировал компанию ${organization.name} (ИНН: ${organization.inn})`;
        severity = 'INFO';
        break;

      case 'update_notes':
        updateData.adminNotes = adminNotes;
        logMessage = `${admin.email} обновил заметки для компании ${organization.name}`;
        severity = 'INFO';
        break;

      default:
        return NextResponse.json({ error: 'Неверное действие' }, { status: 400 });
    }

    // Обновляем компанию
    const updatedOrganization = await prisma.organization.update({
      where: { id: organizationId },
      data: updateData,
      include: {
        users: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                mode: true,
              },
            },
          },
        },
      },
    });

    // Логируем действие
    await prisma.adminSecurityIncident.create({
      data: {
        adminId: admin.id,
        type: 'organization_modified',
        severity,
        message: logMessage,
        metadata: {
          organizationId,
          action,
          blockReason,
          adminNotes,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message:
        action === 'block'
          ? 'Компания заблокирована'
          : action === 'unblock'
            ? 'Компания разблокирована'
            : 'Заметки обновлены',
      organization: updatedOrganization,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Некорректные данные', details: error.errors },
        { status: 400 }
      );
    }

    console.error('[Admin Organization Update] Error:', error);
    return NextResponse.json(
      { error: 'Ошибка при обновлении компании' },
      { status: 500 }
    );
  }
}

export const GET = withAdminAuth(getHandler);
export const PATCH = withAdminAuth(patchHandler);
