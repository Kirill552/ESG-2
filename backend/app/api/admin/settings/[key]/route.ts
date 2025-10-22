/**
 * DELETE /api/admin/settings/[key] - удалить настройку
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/admin-middleware';
import { prisma } from '@/lib/prisma';

async function deleteHandler(
  request: NextRequest,
  { params, admin }: { params: { key: string }; admin: any }
) {
  try {
    const { key } = params;

    const setting = await prisma.systemSettings.findUnique({
      where: { key },
    });

    if (!setting) {
      return NextResponse.json({ error: 'Настройка не найдена' }, { status: 404 });
    }

    await prisma.systemSettings.delete({
      where: { key },
    });

    // Логируем удаление
    await prisma.adminSecurityIncident.create({
      data: {
        adminId: admin.id,
        type: 'settings_modified',
        severity: 'WARNING',
        message: `${admin.email} удалил настройку ${key}`,
        metadata: {
          key,
          deletedValue: setting.value,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Настройка удалена',
    });
  } catch (error) {
    console.error('[Admin Settings Delete] Error:', error);
    return NextResponse.json(
      { error: 'Ошибка при удалении настройки' },
      { status: 500 }
    );
  }
}

export const DELETE = withAdminAuth(deleteHandler);
