import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';

/**
 * GET /api/auth/password - Проверка наличия пароля у пользователя
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await (prisma as any).user.findUnique({
      where: { id: session.user.id },
      select: { hashedPassword: true }
    });

    return NextResponse.json({
      hasPassword: !!user?.hashedPassword
    });

  } catch (error) {
    console.error('❌ Error checking password:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/password - Установка или изменение пароля
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { newPassword } = body;

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Пароль должен содержать минимум 6 символов' },
        { status: 400 }
      );
    }

    // Получаем текущего пользователя
    const user = await (prisma as any).user.findUnique({
      where: { id: session.user.id },
      select: { hashedPassword: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Хешируем новый пароль
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Обновляем пароль в базе данных
    await (prisma as any).user.update({
      where: { id: session.user.id },
      data: { hashedPassword }
    });

    return NextResponse.json({
      message: user.hashedPassword ? 'Пароль успешно изменен' : 'Пароль успешно установлен'
    });

  } catch (error) {
    console.error('❌ Error updating password:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}