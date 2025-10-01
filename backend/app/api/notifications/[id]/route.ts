import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { notificationService } from '@/lib/notification-service';
import { getUserMode } from '@/lib/user-mode-utils';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

/**
 * PATCH /api/notifications/[id]
 * Отметить уведомление как прочитанное
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
) {
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
    const { id: notificationId } = await params;

    // DEMO режим - возвращаем успех без изменений БД
    if (userMode === 'DEMO') {
      console.log(`✅ [DEMO] Уведомление ${notificationId} отмечено как прочитанное`);
      return NextResponse.json({
        ok: true,
        message: 'Notification marked as read (demo mode)'
      });
    }

    // PAID режим - обновляем БД
    await notificationService.markAsRead(notificationId, userId);

    return NextResponse.json({
      ok: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('❌ Ошибка отметки уведомления как прочитанного:', error);
    return NextResponse.json(
      { error: 'Failed to mark notification as read' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/notifications/[id]
 * Удалить уведомление
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteContext
) {
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
    const notificationId = params.id;

    // DEMO режим - возвращаем успех без изменений БД
    if (userMode === 'DEMO') {
      console.log(`🗑️  [DEMO] Уведомление ${notificationId} удалено`);
      return NextResponse.json({
        ok: true,
        message: 'Notification deleted (demo mode)'
      });
    }

    // PAID режим - удаляем из БД
    await notificationService.deleteNotification(notificationId, userId);

    return NextResponse.json({
      ok: true,
      message: 'Notification deleted'
    });
  } catch (error) {
    console.error('❌ Ошибка удаления уведомления:', error);
    return NextResponse.json(
      { error: 'Failed to delete notification' },
      { status: 500 }
    );
  }
}