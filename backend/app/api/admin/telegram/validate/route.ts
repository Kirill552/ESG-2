/**
 * POST /api/admin/telegram/validate — валидация Telegram bot token
 * Проверяет, что токен валидный и получает информацию о боте
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/admin-middleware';
import { telegramBotService } from '@/lib/telegram-bot-service';
import { z } from 'zod';

const ValidateSchema = z.object({
  botToken: z.string().min(10, 'Токен слишком короткий'),
});

async function postHandler(
  request: NextRequest,
  context: any
) {
  try {
    const body = await request.json();
    const { botToken } = ValidateSchema.parse(body);

    // Валидируем токен
    const { valid, botInfo } = await telegramBotService.validateBotToken(botToken);

    if (valid && botInfo) {
      return NextResponse.json({
        success: true,
        valid: true,
        botInfo: {
          id: botInfo.id,
          username: botInfo.username,
          firstName: botInfo.first_name,
          canJoinGroups: botInfo.can_join_groups,
          canReadAllGroupMessages: botInfo.can_read_all_group_messages,
          supportsInlineQueries: botInfo.supports_inline_queries,
        },
        message: `Токен валидный. Бот: @${botInfo.username}`,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          valid: false,
          message: 'Токен невалидный или бот недоступен',
        },
        { status: 400 }
      );
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Некорректные данные', details: error.errors },
        { status: 400 }
      );
    }

    console.error('[Admin Telegram Validate] Error:', error);
    return NextResponse.json(
      { error: 'Ошибка при валидации токена' },
      { status: 500 }
    );
  }
}

export const POST = withAdminAuth(postHandler);
