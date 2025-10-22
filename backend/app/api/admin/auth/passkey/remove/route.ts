/**
 * DELETE /api/admin/auth/passkey/remove
 * Удалить Passkey по ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/admin-middleware';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const RemoveSchema = z.object({
  passkeyId: z.string().min(1, 'ID Passkey обязателен'),
});

async function deleteHandler(request: NextRequest, context: any) {
  try {
    const admin = context.admin;
    const body = await request.json();
    const { passkeyId } = RemoveSchema.parse(body);

    // Проверяем, что Passkey принадлежит этому администратору
    const passkey = await prisma.adminWebAuthnCredential.findFirst({
      where: {
        id: passkeyId,
        adminId: admin.id,
      },
    });

    if (!passkey) {
      return NextResponse.json(
        { error: 'Passkey не найден' },
        { status: 404 }
      );
    }

    // Проверяем, что это не последний Passkey, если у админа нет пароля
    const passkeyCount = await prisma.adminWebAuthnCredential.count({
      where: { adminId: admin.id },
    });

    const adminWithPassword = await prisma.adminUser.findUnique({
      where: { id: admin.id },
      select: { passwordHash: true },
    });

    if (passkeyCount === 1 && !adminWithPassword?.passwordHash) {
      return NextResponse.json(
        {
          error: 'Нельзя удалить последний Passkey, если не установлен пароль. Сначала установите пароль для резервного доступа.',
        },
        { status: 400 }
      );
    }

    // Удаляем Passkey
    await prisma.adminWebAuthnCredential.delete({
      where: { id: passkeyId },
    });

    // Логируем событие безопасности
    await prisma.adminSecurityIncident.create({
      data: {
        type: 'passkey_removed',
        severity: 'INFO',
        message: `Администратор ${admin.email} удалил Passkey`,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        metadata: {
          passkeyId,
          credentialId: passkey.credentialId.substring(0, 20) + '...',
        },
      },
    });

    console.log(`[Admin Passkey] Removed for ${admin.email}, ID: ${passkeyId}`);

    return NextResponse.json({
      success: true,
      message: 'Passkey успешно удален',
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Некорректные данные', details: error.errors },
        { status: 400 }
      );
    }

    console.error('[Admin Passkey Remove] Error:', error);
    return NextResponse.json(
      { error: 'Ошибка при удалении Passkey' },
      { status: 500 }
    );
  }
}

export const DELETE = withAdminAuth(deleteHandler);
