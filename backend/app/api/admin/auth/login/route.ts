/**
 * POST /api/admin/auth/login
 * Вход по email + password
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createAdminSession } from '@/lib/admin-session-utils';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

const LoginSchema = z.object({
  email: z.string().email('Некорректный email'),
  password: z.string().min(1, 'Введите пароль'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = LoginSchema.parse(body);

    // Находим администратора
    const admin = await prisma.adminUser.findUnique({
      where: { email },
    });

    if (!admin || !admin.isActive) {
      // Не раскрываем, существует ли email
      await prisma.adminSecurityIncident.create({
        data: {
          type: 'login_failure',
          severity: 'WARN',
          message: `Попытка входа для несуществующего/неактивного админа: ${email}`,
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
        },
      });

      return NextResponse.json(
        { error: 'Неверный email или пароль' },
        { status: 401 }
      );
    }

    // Проверяем пароль
    const isPasswordValid = await bcrypt.compare(password, admin.passwordHash);

    if (!isPasswordValid) {
      // Логируем неудачную попытку
      await prisma.adminSecurityIncident.create({
        data: {
          adminId: admin.id,
          type: 'login_failure',
          severity: 'WARN',
          message: `Неверный пароль для ${email}`,
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
        },
      });

      return NextResponse.json(
        { error: 'Неверный email или пароль' },
        { status: 401 }
      );
    }

    // Создаём сессию
    const { token, session } = await createAdminSession(admin.id, admin.email, admin.role);

    // Логируем успешный вход
    await prisma.adminSecurityIncident.create({
      data: {
        adminId: admin.id,
        type: 'login_success',
        severity: 'INFO',
        message: `Успешный вход через пароль для ${email}`,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    console.log(`[Admin Login] Success for ${email}`);

    // Устанавливаем cookie
    const response = NextResponse.json({
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
      },
      sessionExpiresAt: session.expiresAt,
    });

    response.cookies.set('admin-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 60, // 30 минут
      path: '/',
    });

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Некорректные данные', details: error.errors },
        { status: 400 }
      );
    }

    console.error('[Admin Login] Error:', error);
    return NextResponse.json(
      { error: 'Ошибка при входе' },
      { status: 500 }
    );
  }
}
