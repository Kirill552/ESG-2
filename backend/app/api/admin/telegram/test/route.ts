/**
 * POST /api/admin/telegram/test — тестовая отправка Telegram уведомления
 * Используется для проверки настроек Telegram бота в профиле администратора
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/admin-middleware';
import { telegramBotService } from '@/lib/telegram-bot-service';

async function postHandler(
  request: NextRequest,
  context: any
) {
  try {
    const admin = context.admin;

    // Отправляем тестовое уведомление
    const success = await telegramBotService.sendAdminNotification({
      type: 'system_alert',
      title: '🧪 Тестовое уведомление',
      message: `Администратор ${admin.email} проверяет работу Telegram бота`,
      metadata: {
        'Тип теста': 'Ручная отправка из админ-панели',
        'Администратор': admin.email,
        'Статус': 'Успешно',
      },
      priority: 'medium',
    });

    if (success) {
      return NextResponse.json({
        success: true,
        message: 'Тестовое сообщение успешно отправлено в Telegram',
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          message: 'Не удалось отправить сообщение. Проверьте настройки Telegram бота в профиле.',
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[Admin Telegram Test] Error:', error);
    return NextResponse.json(
      { error: 'Ошибка при отправке тестового сообщения' },
      { status: 500 }
    );
  }
}

export const POST = withAdminAuth(postHandler);
