/**
 * API Route для Vercel Cron Jobs - проверка дедлайнов отчётов
 *
 * Настройка в vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/check-deadlines",
 *     "schedule": "0 9 * * *"
 *   }]
 * }
 *
 * Защита через Authorization header или Vercel Cron Secret
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkDeadlines } from '@/scripts/check-deadlines';
import { Logger } from '@/lib/logger';

const logger = new Logger('cron-check-deadlines-api');

export async function GET(request: NextRequest) {
  try {
    // Проверка авторизации для cron job
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;

    // В продакшн требуем секрет для защиты endpoint
    if (process.env.NODE_ENV === 'production') {
      if (!authHeader || !cronSecret) {
        logger.warn('Unauthorized cron job attempt', {
          hasAuth: !!authHeader,
          hasSecret: !!cronSecret
        });
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }

      const token = authHeader.replace('Bearer ', '');
      if (token !== cronSecret) {
        logger.warn('Invalid cron secret provided');
        return NextResponse.json(
          { error: 'Forbidden' },
          { status: 403 }
        );
      }
    }

    logger.info('Starting cron job: check-deadlines');

    // Запускаем проверку дедлайнов
    await checkDeadlines();

    return NextResponse.json({
      success: true,
      message: 'Deadline check completed successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Cron job failed: check-deadlines',
      error instanceof Error ? error : new Error(String(error))
    );

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check deadlines',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// POST метод для ручного запуска (для тестирования)
export async function POST(request: NextRequest) {
  // Требуем авторизацию для ручного запуска
  const authHeader = request.headers.get('authorization');
  const adminSecret = process.env.ADMIN_SECRET;

  if (!authHeader || !adminSecret) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const token = authHeader.replace('Bearer ', '');
  if (token !== adminSecret) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    );
  }

  logger.info('Manual cron job trigger: check-deadlines');

  try {
    await checkDeadlines();

    return NextResponse.json({
      success: true,
      message: 'Deadline check completed successfully (manual trigger)',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Manual cron job failed: check-deadlines',
      error instanceof Error ? error : new Error(String(error))
    );

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check deadlines',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}