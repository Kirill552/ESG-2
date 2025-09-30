import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getUserMode } from '@/lib/user-mode-utils';
import { DEMO_NOTIFICATIONS } from '@/lib/demo-data-seeder';

/**
 * GET /api/notifications
 * Получение списка уведомлений с фильтрацией и пагинацией
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

    // Параметры запроса
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const read = searchParams.get('read'); // 'true', 'false', или null (все)
    const type = searchParams.get('type'); // фильтр по типу уведомления
    const startDate = searchParams.get('startDate'); // фильтр по дате
    const endDate = searchParams.get('endDate');

    // DEMO режим - возвращаем моковые данные
    if (userMode === 'DEMO') {
      let filteredNotifications = [...DEMO_NOTIFICATIONS];

      // Фильтр по прочитанности
      if (read === 'true') {
        filteredNotifications = filteredNotifications.filter(n => n.read);
      } else if (read === 'false') {
        filteredNotifications = filteredNotifications.filter(n => !n.read);
      }

      // Фильтр по типу
      if (type) {
        filteredNotifications = filteredNotifications.filter(n => n.type === type);
      }

      // Пагинация
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedNotifications = filteredNotifications.slice(startIndex, endIndex);

      // Количество непрочитанных
      const unreadCount = DEMO_NOTIFICATIONS.filter(n => !n.read).length;

      return NextResponse.json({
        ok: true,
        notifications: paginatedNotifications,
        pagination: {
          page,
          pageSize,
          total: filteredNotifications.length,
          totalPages: Math.ceil(filteredNotifications.length / pageSize),
          hasNext: endIndex < filteredNotifications.length,
          hasPrev: page > 1
        },
        unreadCount
      });
    }

    // PAID режим - работа с БД
    // Строим условия фильтрации
    const where: any = {
      userId
    };

    if (read === 'true') {
      where.read = true;
    } else if (read === 'false') {
      where.read = false;
    }

    if (type) {
      where.type = type;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    // Получаем уведомления из БД
    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: {
          createdAt: 'desc'
        },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: {
          userId,
          read: false
        }
      })
    ]);

    return NextResponse.json({
      ok: true,
      notifications,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        hasNext: page * pageSize < total,
        hasPrev: page > 1
      },
      unreadCount
    });
  } catch (error) {
    console.error('❌ Ошибка получения уведомлений:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/notifications?action=unread-count
 * Быстрое получение количества непрочитанных (для badge)
 */
export async function HEAD(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return new NextResponse(null, { status: 401 });
    }

    const userId = (session.user as any).id;
    const userMode = await getUserMode(userId);

    let unreadCount = 0;

    if (userMode === 'DEMO') {
      unreadCount = DEMO_NOTIFICATIONS.filter(n => !n.read).length;
    } else {
      unreadCount = await prisma.notification.count({
        where: {
          userId,
          read: false
        }
      });
    }

    return new NextResponse(null, {
      status: 200,
      headers: {
        'X-Unread-Count': unreadCount.toString()
      }
    });
  } catch (error) {
    console.error('❌ Ошибка получения количества непрочитанных:', error);
    return new NextResponse(null, { status: 500 });
  }
}