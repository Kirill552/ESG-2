/**
 * POST /api/admin/auth/passkey/register-begin
 * Начало регистрации Passkey для нового администратора
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { beginAdminPasskeyRegistration } from '@/lib/admin-webauthn-config';
import { z } from 'zod';

const RegisterBeginSchema = z.object({
  email: z.string().email('Некорректный email'),
  adminSecret: z.string().min(1, 'Требуется секретный ключ администратора'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, adminSecret } = RegisterBeginSchema.parse(body);

    // Проверка секретного ключа администратора
    // В продакшене этот ключ должен быть известен только владельцу платформы
    if (adminSecret !== process.env.ADMIN_SECRET) {
      return NextResponse.json(
        { error: 'Неверный секретный ключ администратора' },
        { status: 403 }
      );
    }

    // Проверяем, не существует ли уже администратор с таким email
    const existingAdmin = await prisma.adminUser.findUnique({
      where: { email },
    });

    if (existingAdmin) {
      return NextResponse.json(
        { error: 'Администратор с таким email уже существует' },
        { status: 400 }
      );
    }

    // Создаём нового администратора в БД (пока без Passkey)
    // Пароль не требуется, т.к. используется только Passkey
    const admin = await prisma.adminUser.create({
      data: {
        email,
        passwordHash: '', // Passkey не требует пароля
        role: 'SUPPORT_ADMIN', // По умолчанию минимальная роль
        isActive: true,
      },
    });

    // Получаем текущий домен и протокол из запроса
    const host = request.headers.get('host') || 'localhost';
    const protocol = request.headers.get('x-forwarded-proto') ||
                     (host.includes('localhost') ? 'http' : 'https');

    const rpId = host;
    const origin = `${protocol}://${host}`;

    console.log(`[Admin Passkey Registration] Begin for ${email}, RP ID: ${rpId}, Origin: ${origin}`);

    // Генерируем options для регистрации Passkey с правильным rpId
    const options = await beginAdminPasskeyRegistration(admin.id, email, rpId, origin);

    return NextResponse.json({
      success: true,
      adminId: admin.id,
      options,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Некорректные данные', details: error.errors },
        { status: 400 }
      );
    }

    console.error('[Admin Passkey Registration Begin] Error:', error);
    return NextResponse.json(
      { error: 'Ошибка при начале регистрации' },
      { status: 500 }
    );
  }
}
