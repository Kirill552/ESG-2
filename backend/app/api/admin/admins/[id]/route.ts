/**
 * PATCH /api/admin/admins/[id] - обновление администратора
 * DELETE /api/admin/admins/[id] - удаление администратора
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth, requireAdminRole } from '@/lib/admin-middleware';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// PATCH - обновление администратора
const UpdateAdminSchema = z.object({
  action: z.enum(['change_role', 'deactivate', 'activate']),
  role: z.enum(['SUPER_ADMIN', 'FINANCE_ADMIN', 'SUPPORT_ADMIN', 'SYSTEM_ADMIN']).optional(),
});

async function patchHandler(
  request: NextRequest,
  context: { params: Promise<{ id: string }>; admin: any }
) {
  const params = await context.params;
  try {
    // Только SUPER_ADMIN может управлять администраторами
    requireAdminRole(context.admin, ['SUPER_ADMIN']);

    const { id } = params;
    const body = await request.json();
    const { action, role } = UpdateAdminSchema.parse(body);

    // Проверка: нельзя изменять самого себя
    if (id === context.admin.id) {
      return NextResponse.json(
        { error: 'Нельзя изменять собственную учетную запись' },
        { status: 400 }
      );
    }

    const targetAdmin = await prisma.adminUser.findUnique({
      where: { id },
    });

    if (!targetAdmin) {
      return NextResponse.json(
        { error: 'Администратор не найден' },
        { status: 404 }
      );
    }

    let updateData: any = {};
    let logMessage: string = '';

    switch (action) {
      case 'change_role':
        if (!role) {
          return NextResponse.json({ error: 'Не указана роль' }, { status: 400 });
        }
        updateData.role = role;
        logMessage = `${context.admin.email} изменил роль администратора ${targetAdmin.email} с ${targetAdmin.role} на ${role}`;
        break;

      case 'deactivate':
        updateData.isActive = false;
        logMessage = `${context.admin.email} деактивировал администратора ${targetAdmin.email}`;
        break;

      case 'activate':
        updateData.isActive = true;
        logMessage = `${context.admin.email} активировал администратора ${targetAdmin.email}`;
        break;

      default:
        return NextResponse.json({ error: 'Неверное действие' }, { status: 400 });
    }

    const updatedAdmin = await prisma.adminUser.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });

    // Логируем изменение
    await prisma.adminSecurityIncident.create({
      data: {
        adminId: context.admin.id,
        type: 'admin_modified',
        severity: 'WARNING',
        message: logMessage,
        metadata: {
          targetAdminId: id,
          action,
          oldValues: {
            role: targetAdmin.role,
            isActive: targetAdmin.isActive,
          },
          newValues: updateData,
        },
      },
    });

    // Если деактивировали - инвалидируем все сессии
    if (action === 'deactivate') {
      await prisma.adminSession.deleteMany({
        where: { adminId: id },
      });
    }

    return NextResponse.json({
      success: true,
      message:
        action === 'change_role'
          ? 'Роль изменена'
          : action === 'deactivate'
            ? 'Администратор деактивирован'
            : 'Администратор активирован',
      admin: updatedAdmin,
    });
  } catch (error: any) {
    if (error.message === 'Недостаточно прав') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Некорректные данные', details: error.errors },
        { status: 400 }
      );
    }

    console.error('[Admin Admins Patch] Error:', error);
    return NextResponse.json(
      { error: 'Ошибка при обновлении администратора' },
      { status: 500 }
    );
  }
}

// DELETE - удаление администратора
async function deleteHandler(
  request: NextRequest,
  context: { params: Promise<{ id: string }>; admin: any }
) {
  const params = await context.params;
  try {
    // Только SUPER_ADMIN может удалять администраторов
    requireAdminRole(context.admin, ['SUPER_ADMIN']);

    const { id } = params;

    // Проверка: нельзя удалять самого себя
    if (id === context.admin.id) {
      return NextResponse.json(
        { error: 'Нельзя удалить собственную учетную запись' },
        { status: 400 }
      );
    }

    const targetAdmin = await prisma.adminUser.findUnique({
      where: { id },
    });

    if (!targetAdmin) {
      return NextResponse.json(
        { error: 'Администратор не найден' },
        { status: 404 }
      );
    }

    // Удаляем администратора (каскадно удалятся все связанные записи)
    await prisma.adminUser.delete({
      where: { id },
    });

    // Логируем удаление
    await prisma.adminSecurityIncident.create({
      data: {
        adminId: context.admin.id,
        type: 'admin_deleted',
        severity: 'WARNING',
        message: `${context.admin.email} удалил администратора ${targetAdmin.email} (роль: ${targetAdmin.role})`,
        metadata: {
          deletedAdminId: id,
          deletedAdminEmail: targetAdmin.email,
          deletedAdminRole: targetAdmin.role,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Администратор удален',
    });
  } catch (error: any) {
    if (error.message === 'Недостаточно прав') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    console.error('[Admin Admins Delete] Error:', error);
    return NextResponse.json(
      { error: 'Ошибка при удалении администратора' },
      { status: 500 }
    );
  }
}

export const PATCH = withAdminAuth(patchHandler);
export const DELETE = withAdminAuth(deleteHandler);
