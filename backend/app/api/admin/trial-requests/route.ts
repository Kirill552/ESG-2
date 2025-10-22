/**
 * GET /api/admin/trial-requests
 * Список заявок на доступ с фильтрацией и пагинацией
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/admin-middleware';
import { prisma } from '@/lib/prisma';
import type { TrialRequestStatus, TrialRequestType } from '@prisma/client';

async function handler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Параметры фильтрации
    const status = searchParams.get('status') as TrialRequestStatus | null;
    const type = searchParams.get('type') as TrialRequestType | null;
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '25');

    // Построение фильтров
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (type) {
      where.requestType = type;
    }

    if (search) {
      where.OR = [
        { userEmail: { contains: search, mode: 'insensitive' } },
        { userName: { contains: search, mode: 'insensitive' } },
        { companyName: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Получаем данные с пагинацией
    const [requests, totalCount] = await Promise.all([
      prisma.trialRequest.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              mode: true,
              planExpiry: true,
            },
          },
        },
      }),
      prisma.trialRequest.count({ where }),
    ]);

    // Счетчики по статусам
    const [pendingCount, processingCount, approvedCount, rejectedCount] = await Promise.all([
      prisma.trialRequest.count({ where: { status: 'PENDING' } }),
      prisma.trialRequest.count({ where: { status: 'PROCESSING' } }),
      prisma.trialRequest.count({ where: { status: 'APPROVED' } }),
      prisma.trialRequest.count({ where: { status: 'REJECTED' } }),
    ]);

    return NextResponse.json({
      requests,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        hasNext: page < Math.ceil(totalCount / pageSize),
        hasPrev: page > 1,
      },
      stats: {
        pending: pendingCount,
        processing: processingCount,
        approved: approvedCount,
        rejected: rejectedCount,
      },
    });
  } catch (error) {
    console.error('[Admin Trial Requests] Error:', error);
    return NextResponse.json(
      { error: 'Ошибка при загрузке заявок' },
      { status: 500 }
    );
  }
}

export const GET = withAdminAuth(handler);
