/**
 * API для удаления Passkey пользователя
 * DELETE /api/auth/webauthn/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Проверяем авторизацию
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Не авторизован' },
        { status: 401 }
      );
    }

    const { id } = params;
    if (!id) {
      return NextResponse.json(
        { error: 'ID Passkey обязателен' },
        { status: 400 }
      );
    }

    // Проверяем, что Passkey принадлежит текущему пользователю
    const existingAccount = await prisma.account.findFirst({
      where: {
        id: id,
        userId: session.user.id,
        provider: 'webauthn'
      }
    });

    if (!existingAccount) {
      return NextResponse.json(
        { error: 'Passkey не найден или не принадлежит пользователю' },
        { status: 404 }
      );
    }

    // Проверяем, что это не единственный способ авторизации
    const userAccountsCount = await prisma.account.count({
      where: {
        userId: session.user.id,
        OR: [
          { provider: 'webauthn' },
          { provider: 'credentials' },
          { provider: 'vk' }
        ]
      }
    });

    const userHasPassword = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { hashedPassword: true }
    });

    // Если это единственный Passkey и нет других способов входа - запрещаем удаление
    if (userAccountsCount === 1 && !userHasPassword?.hashedPassword) {
      return NextResponse.json(
        { error: 'Нельзя удалить единственный способ авторизации. Сначала установите пароль или добавьте другие методы входа.' },
        { status: 400 }
      );
    }

    // Удаляем Passkey
    await prisma.account.delete({
      where: {
        id: id
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Passkey успешно удален'
    });

  } catch (error) {
    console.error('WebAuthn delete error:', error);
    return NextResponse.json(
      { error: 'Ошибка удаления Passkey' },
      { status: 500 }
    );
  }
}
