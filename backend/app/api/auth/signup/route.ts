import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { issueNextAuthDatabaseSession } from '@/lib/nextauth-session';
import { userOrganizationManager } from '@/lib/user-organization-manager';

const prisma = new PrismaClient();

const signupSchema = z.object({
  email: z.string().email('Неверный формат email'),
  password: z.string().min(6, 'Пароль должен содержать минимум 6 символов'),
  name: z.string().optional(),
  captchaToken: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name, captchaToken } = signupSchema.parse(body);

    // Проверяем CAPTCHA если она была передана
    if (captchaToken) {
      try {
        const captchaRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/captcha/validate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: captchaToken }),
        });

        if (!captchaRes.ok) {
          return NextResponse.json(
            { error: 'Проверка CAPTCHA не пройдена' },
            { status: 400 }
          );
        }
      } catch (error) {
        console.error('CAPTCHA validation error:', error);
        // Продолжаем без блокировки при ошибке CAPTCHA
      }
    }

    // Проверяем, существует ли пользователь
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Пользователь с таким email уже существует' },
        { status: 400 }
      );
    }

    // Хешируем пароль
    const hashedPassword = await bcrypt.hash(password, 12);

    // Создаем пользователя
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        name: name || null,
        emailVerified: null, // Можно добавить верификацию email позже
      },
    });

    // Создаем аккаунт с паролем
    await prisma.account.create({
      data: {
        userId: user.id,
        type: 'credentials',
        provider: 'credentials',
        providerAccountId: user.id,
        password: hashedPassword,
      },
    });

    // Создаем организацию для нового пользователя
    try {
      await userOrganizationManager.createDefaultOrganization(user.id);
      console.log(`✅ Создана организация для нового пользователя: ${user.email}`);
    } catch (error) {
      console.error(`❌ Ошибка создания организации для ${user.email}:`, error);
      // Не блокируем регистрацию из-за ошибки организации
    }

  // Формируем ответ
  const response = NextResponse.json({ 
      success: true, 
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      }
    });

  // Создаем NextAuth-совместимую сессию и устанавливаем корректные куки
  await issueNextAuthDatabaseSession(response, user.id, 30);

    return response;

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}
