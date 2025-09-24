import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { authOptions } from '@/lib/auth-options';
import { issueNextAuthDatabaseSession } from '@/lib/nextauth-session';
import { userOrganizationManager } from '@/lib/user-organization-manager';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  console.log('[DEBUG] Password signin API called');
  try {
    const { email, password, captchaToken } = await request.json();
    console.log('[DEBUG] Email:', email);
    console.log('[DEBUG] Password length:', password?.length);

    if (!email || !password) {
      console.log('[DEBUG] Missing email or password');
      return NextResponse.json(
        { error: 'Email и пароль обязательны' },
        { status: 400 }
      );
    }

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

    // Поиск пользователя по email
    console.log('[DEBUG] Searching for user with email:', email.toLowerCase().trim());
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: {
        id: true,
        email: true,
        name: true,
        hashedPassword: true, // получаем хэшированный пароль
        accounts: true,
      },
    });

    console.log('[DEBUG] User found:', !!user);
    console.log('[DEBUG] User has password:', !!user?.hashedPassword);

    if (!user) {
      console.log('[DEBUG] User not found');
      return NextResponse.json(
        { error: 'Неверный email или пароль' },
        { status: 401 }
      );
    }

    // Проверяем, есть ли у пользователя пароль
    if (!user.hashedPassword) {
      console.log('[DEBUG] User has no password set');
      return NextResponse.json(
        { error: 'Для этого аккаунта пароль не установлен. Используйте вход через VK ID, ссылку или код.' },
        { status: 401 }
      );
    }

    // Проверяем пароль
    console.log('[DEBUG] Comparing password...');
    const isPasswordValid = await bcrypt.compare(password, user.hashedPassword);
    console.log('[DEBUG] Password valid:', isPasswordValid);
    
    if (!isPasswordValid) {
      console.log('[DEBUG] Invalid password');
      return NextResponse.json(
        { error: 'Неверный email или пароль' },
        { status: 401 }
      );
    }

    // Проверяем и восстанавливаем связи пользователя с организацией
    try {
      await userOrganizationManager.ensureUserOrganization(user.id);
      console.log(`✅ Связи пользователя ${user.email} проверены при входе`);
    } catch (error) {
      console.error(`❌ Ошибка проверки связей для ${user.email}:`, error);
      // Не блокируем вход из-за ошибки организации
    }

  // Создаем NextAuth-совместимую сессию и устанавливаем куки единообразно
  const response = NextResponse.json({ 
      success: true, 
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      }
    });

  await issueNextAuthDatabaseSession(response, user.id, 30);

    return response;

  } catch (error) {
    console.error('Password signin error:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}
