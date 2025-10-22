/**
 * GET /api/admin/users
 * Список всех пользователей с фильтрацией и пагинацией
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/admin-middleware';
import { prisma } from '@/lib/prisma';
import type { UserMode } from '@prisma/client';

async function handler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Параметры фильтрации
    const search = searchParams.get('search') || '';
    const mode = searchParams.get('mode') as UserMode | null;
    const isBlocked = searchParams.get('isBlocked');
    const organizationId = searchParams.get('organizationId') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '25');

    // Построение фильтров
    const where: any = {};

    if (isBlocked !== null && isBlocked !== '') {
      where.isBlocked = isBlocked === 'true';
    }

    if (mode) {
      where.mode = mode;
    }

    if (organizationId) {
      where.OR = [
        { organizationId },
        {
          organizationMemberships: {
            some: { organizationId },
          },
        },
      ];
    }

    if (search) {
      where.AND = [
        {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    // Получаем данные с пагинацией
    const [users, totalCount] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              inn: true,
              isBlocked: true,
            },
          },
          organizationMemberships: {
            include: {
              organization: {
                select: {
                  id: true,
                  name: true,
                  inn: true,
                },
              },
            },
          },
          _count: {
            select: {
              documents: true,
              reports: true,
              sessions: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    // Статистика по пользователям
    const [totalUsers, activeUsers, blockedUsers, usersByMode] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isBlocked: false } }),
      prisma.user.count({ where: { isBlocked: true } }),
      Promise.all([
        prisma.user.count({ where: { mode: 'DEMO' } }),
        prisma.user.count({ where: { mode: 'TRIAL' } }),
        prisma.user.count({ where: { mode: 'PAID' } }),
        prisma.user.count({ where: { mode: 'EXPIRED' } }),
      ]),
    ]);

    return NextResponse.json({
      users,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        hasNext: page < Math.ceil(totalCount / pageSize),
        hasPrev: page > 1,
      },
      stats: {
        total: totalUsers,
        active: activeUsers,
        blocked: blockedUsers,
        byMode: {
          demo: usersByMode[0],
          trial: usersByMode[1],
          paid: usersByMode[2],
          expired: usersByMode[3],
        },
      },
    });
  } catch (error) {
    console.error('[Admin Users] Error:', error);
    return NextResponse.json(
      { error: 'Ошибка при загрузке списка пользователей' },
      { status: 500 }
    );
  }
}

export const GET = withAdminAuth(handler);
