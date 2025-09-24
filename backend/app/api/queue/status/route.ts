import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getQueueManager } from '../../../../lib/queue';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

  // Берем singleton Queue Manager (без лишних старт/стоп в каждом запросе)
  const queueManager = await getQueueManager();

    // Получаем статистику и состояние паузы очереди из pg-boss
    const [queueStats, isPaused] = await Promise.all([
      queueManager.getQueueStats(),
      queueManager.isOcrPaused().catch(() => false)
    ]);

    // Получаем дополнительную информацию о задачах пользователя (если нужно)
    // TODO: Добавить фильтрацию по пользователю в будущем
    const userTasks = 0; // Пока заглушка
    
    const response = {
      success: true,
      data: {
        ...queueStats,
        userTasks,
        isPaused
      }
    };

  // Не останавливаем singleton, чтобы избежать частых старт/стоп и лишних логов

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Queue status error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get queue status',
        data: {
          total: 0,
          active: 0,
          waiting: 0,
          completed: 0,
          failed: 0,
          userTasks: 0
        }
      },
      { status: 500 }
    );
  }
}
