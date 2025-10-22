/**
 * GET /api/admin/admins - список всех администраторов
 * POST /api/admin/admins - создать нового администратора
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth, requireAdminRole } from '@/lib/admin-middleware';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

// GET - получение списка администраторов
async function getHandler(request: NextRequest, { admin }: { admin: any }) {
  try {
    // Только SUPER_ADMIN может просматривать список администраторов
    requireAdminRole(admin, ['SUPER_ADMIN']);

    const admins = await prisma.adminUser.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        sessions: {
          select: {
            id: true,
            expiresAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: {
          select: {
            sessions: true,
            webAuthnCredentials: true,
            recoveryCodes: true,
          },
        },
      },
    });

    // Статистика по ролям
    const roleStats = await prisma.adminUser.groupBy({
      by: ['role'],
      _count: true,
    });

    return NextResponse.json({
      admins,
      stats: {
        total: admins.length,
        active: admins.filter((a) => a.isActive).length,
        byRole: roleStats,
      },
    });
  } catch (error: any) {
    if (error.message === 'Недостаточно прав') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    console.error('[Admin Admins Get] Error:', error);
    return NextResponse.json(
      { error: 'Ошибка при загрузке списка администраторов' },
      { status: 500 }
    );
  }
}

// POST - создание нового администратора
const CreateAdminSchema = z.object({
  email: z.string().email(),
  role: z.enum(['SUPER_ADMIN', 'FINANCE_ADMIN', 'SUPPORT_ADMIN', 'SYSTEM_ADMIN']),
  password: z.string().min(12), // Временный пароль для первого входа
});

async function postHandler(request: NextRequest, { admin }: { admin: any }) {
  try {
    // Только SUPER_ADMIN может создавать администраторов
    requireAdminRole(admin, ['SUPER_ADMIN']);

    const body = await request.json();
    const { email, role, password } = CreateAdminSchema.parse(body);

    // Проверяем, не существует ли уже админ с таким email
    const existing = await prisma.adminUser.findUnique({
      where: { email },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Администратор с таким email уже существует' },
        { status: 400 }
      );
    }

    // Хешируем пароль
    const passwordHash = await bcrypt.hash(password, 10);

    // Создаем администратора
    const newAdmin = await prisma.adminUser.create({
      data: {
        email,
        role,
        passwordHash,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Логируем создание
    await prisma.adminSecurityIncident.create({
      data: {
        adminId: admin.id,
        type: 'admin_created',
        severity: 'INFO',
        message: `${admin.email} создал нового администратора ${email} с ролью ${role}`,
        metadata: {
          newAdminId: newAdmin.id,
          newAdminEmail: email,
          role,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Администратор создан',
      admin: newAdmin,
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

    console.error('[Admin Admins Post] Error:', error);
    return NextResponse.json(
      { error: 'Ошибка при создании администратора' },
      { status: 500 }
    );
  }
}

export const GET = withAdminAuth(getHandler);
export const POST = withAdminAuth(postHandler);
