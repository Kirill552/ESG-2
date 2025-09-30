import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { notificationService } from '@/lib/notification-service';
import { getUserMode } from '@/lib/user-mode-utils';

/**
 * POST /api/notifications/mark-all-read
 * Отметить все уведомления пользователя как прочитанные
 */
export async function POST(request: NextRequest) {
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

    // DEMO режим - возвращаем успех без изменений БД
    if (userMode === 'DEMO') {
      console.log(`✅ [DEMO] Все уведомления пользователя ${userId} отмечены как прочитанные`);
      return NextResponse.json({
        ok: true,
        message: 'All notifications marked as read (demo mode)',
        count: 0
      });
    }

    // PAID режим - обновляем все непрочитанные уведомления
    const result = await notificationService.markAllAsRead(userId);

    return NextResponse.json({
      ok: true,
      message: 'All notifications marked as read',
      count: result.count
    });
  } catch (error) {
    console.error('❌ Ошибка массовой отметки уведомлений:', error);
    return NextResponse.json(
      { error: 'Failed to mark all notifications as read' },
      { status: 500 }
    );
  }
}