/**
 * GET /api/admin/organizations
 * Список всех компаний с фильтрацией и пагинацией
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
    const isBlocked = searchParams.get('isBlocked');
    const mode = searchParams.get('mode') as UserMode | null;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '25');

    // Построение фильтров
    const where: any = {};

    if (isBlocked !== null) {
      where.isBlocked = isBlocked === 'true';
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { inn: { contains: search, mode: 'insensitive' } },
        { kpp: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Получаем данные с пагинацией
    const [organizations, totalCount] = await Promise.all([
      prisma.organization.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          users: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                  mode: true,
                  createdAt: true,
                  lastLoginAt: true,
                },
              },
            },
          },
          _count: {
            select: {
              users: true,
              auditLogs: true,
            },
          },
        },
      }),
      prisma.organization.count({ where }),
    ]);

    // Статистика по компаниям
    const [totalOrgs, activeOrgs, blockedOrgs, demoOrgs, trialOrgs, paidOrgs] = await Promise.all([
      prisma.organization.count(),
      prisma.organization.count({ where: { isBlocked: false } }),
      prisma.organization.count({ where: { isBlocked: true } }),
      prisma.organization.count({
        where: {
          users: {
            some: { user: { mode: 'DEMO' } },
          },
        },
      }),
      prisma.organization.count({
        where: {
          users: {
            some: { user: { mode: 'TRIAL' } },
          },
        },
      }),
      prisma.organization.count({
        where: {
          users: {
            some: { user: { mode: 'PAID' } },
          },
        },
      }),
    ]);

    return NextResponse.json({
      organizations,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        hasNext: page < Math.ceil(totalCount / pageSize),
        hasPrev: page > 1,
      },
      stats: {
        total: totalOrgs,
        active: activeOrgs,
        blocked: blockedOrgs,
        byMode: {
          demo: demoOrgs,
          trial: trialOrgs,
          paid: paidOrgs,
        },
      },
    });
  } catch (error) {
    console.error('[Admin Organizations] Error:', error);
    return NextResponse.json(
      { error: 'Ошибка при загрузке списка компаний' },
      { status: 500 }
    );
  }
}

export const GET = withAdminAuth(handler);
