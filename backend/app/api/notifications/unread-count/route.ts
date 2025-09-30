import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { notificationService } from '@/lib/notification-service';
import { getUserMode } from '@/lib/user-mode-utils';

// Моковые данные для DEMO режима (из route.ts)
const DEMO_UNREAD_COUNT = 2;

/**
 * GET /api/notifications/unread-count
 * Быстрое получение количества непрочитанных уведомлений (для badge)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;
    const userMode = await getUserMode(userId);

    let unreadCount = 0;

    // DEMO режим - возвращаем моковое значение
    if (userMode === 'DEMO') {
      unreadCount = DEMO_UNREAD_COUNT;
    } else {
      // PAID режим - считаем из БД
      unreadCount = await notificationService.getUnreadCount(userId);
    }

    return NextResponse.json({
      ok: true,
      count: unreadCount
    });
  } catch (error) {
    console.error('❌ Ошибка получения количества непрочитанных:', error);
    return NextResponse.json(
      { error: 'Failed to get unread count' },
      { status: 500 }
    );
  }
}