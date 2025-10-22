/**
 * GET /api/admin/settings - получить все настройки
 * POST /api/admin/settings - создать/обновить настройку
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/admin-middleware';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// GET - получение всех настроек
async function getHandler(request: NextRequest, { admin }: { admin: any }) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || '';

    const where: any = {};
    if (category) {
      where.category = category;
    }

    const settings = await prisma.systemSettings.findMany({
      where,
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });

    // Группируем по категориям
    const grouped = settings.reduce((acc: any, setting) => {
      const cat = setting.category || 'general';
      if (!acc[cat]) {
        acc[cat] = [];
      }
      acc[cat].push(setting);
      return acc;
    }, {});

    return NextResponse.json({
      settings,
      grouped,
      categories: Object.keys(grouped),
    });
  } catch (error) {
    console.error('[Admin Settings Get] Error:', error);
    return NextResponse.json(
      { error: 'Ошибка при загрузке настроек' },
      { status: 500 }
    );
  }
}

// POST - создание/обновление настройки
const SettingSchema = z.object({
  key: z.string().min(1),
  value: z.any(),
  description: z.string().optional(),
  category: z.string().optional(),
});

async function postHandler(request: NextRequest, { admin }: { admin: any }) {
  try {
    const body = await request.json();
    const { key, value, description, category } = SettingSchema.parse(body);

    // Проверяем существующую настройку
    const existing = await prisma.systemSettings.findUnique({
      where: { key },
    });

    const setting = await prisma.systemSettings.upsert({
      where: { key },
      create: {
        key,
        value,
        description,
        category: category || 'general',
      },
      update: {
        value,
        description,
        category,
      },
    });

    // Логируем изменение
    await prisma.adminSecurityIncident.create({
      data: {
        adminId: admin.id,
        type: 'settings_modified',
        severity: 'INFO',
        message: `${admin.email} ${existing ? 'обновил' : 'создал'} настройку ${key}`,
        metadata: {
          key,
          oldValue: existing?.value,
          newValue: value,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: existing ? 'Настройка обновлена' : 'Настройка создана',
      setting,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Некорректные данные', details: error.errors },
        { status: 400 }
      );
    }

    console.error('[Admin Settings Post] Error:', error);
    return NextResponse.json(
      { error: 'Ошибка при сохранении настройки' },
      { status: 500 }
    );
  }
}

export const GET = withAdminAuth(getHandler);
export const POST = withAdminAuth(postHandler);
