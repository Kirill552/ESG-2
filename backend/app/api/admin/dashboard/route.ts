/**
 * GET /api/admin/dashboard
 * Получение статистики для дашборда администратора
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/admin-middleware';
import { prisma } from '@/lib/prisma';

async function handler(request: NextRequest, { admin }: { admin: any }) {
  try {
    const now = new Date();
    const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Параллельный сбор всех статистик
    const [
      // Компании
      totalOrganizations,
      activeOrganizations,
      blockedOrganizations,
      demoOrganizations,

      // Пользователи по режимам
      totalUsers,
      demoUsers,
      trialUsers,
      paidUsers,
      expiredUsers,

      // Активные сессии
      activeSessions,

      // Документы за месяц
      documentsThisMonth,
      documentsLastMonth,

      // Отчеты за месяц
      reportsThisMonth,
      reportsLastMonth,

      // Заявки на рассмотрении
      pendingTrialRequests,
      processingTrialRequests,

      // Регистрации за неделю (для графика)
      registrationsThisWeek,
      registrationsLastWeek,

      // Критические ошибки за последние 24 часа
      criticalIncidents,
    ] = await Promise.all([
      // Компании
      prisma.organization.count(),
      prisma.organization.count({ where: { isBlocked: false } }),
      prisma.organization.count({ where: { isBlocked: true } }),
      prisma.user.count({ where: { mode: 'DEMO', organization: { isNot: null } } }),

      // Пользователи
      prisma.user.count(),
      prisma.user.count({ where: { mode: 'DEMO' } }),
      prisma.user.count({ where: { mode: 'TRIAL' } }),
      prisma.user.count({ where: { mode: 'PAID' } }),
      prisma.user.count({ where: { mode: 'EXPIRED' } }),

      // Сессии
      prisma.session.count({
        where: {
          expires: { gt: now },
        },
      }),

      // Документы
      prisma.document.count({
        where: {
          createdAt: { gte: monthAgo },
        },
      }),
      prisma.document.count({
        where: {
          createdAt: {
            gte: new Date(monthAgo.getFullYear(), monthAgo.getMonth() - 1, monthAgo.getDate()),
            lt: monthAgo,
          },
        },
      }),

      // Отчеты
      prisma.report.count({
        where: {
          createdAt: { gte: monthAgo },
        },
      }),
      prisma.report.count({
        where: {
          createdAt: {
            gte: new Date(monthAgo.getFullYear(), monthAgo.getMonth() - 1, monthAgo.getDate()),
            lt: monthAgo,
          },
        },
      }),

      // Заявки
      prisma.trialRequest.count({
        where: { status: 'PENDING' },
      }),
      prisma.trialRequest.count({
        where: { status: 'PROCESSING' },
      }),

      // Регистрации
      prisma.user.count({
        where: {
          createdAt: { gte: weekAgo },
        },
      }),
      prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(weekAgo.getTime() - 7 * 24 * 60 * 60 * 1000),
            lt: weekAgo,
          },
        },
      }),

      // Критические инциденты
      prisma.adminSecurityIncident.count({
        where: {
          severity: 'ERROR',
          createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    // Расчет процентных изменений
    const documentsChange =
      documentsLastMonth > 0
        ? ((documentsThisMonth - documentsLastMonth) / documentsLastMonth) * 100
        : 100;

    const reportsChange =
      reportsLastMonth > 0 ? ((reportsThisMonth - reportsLastMonth) / reportsLastMonth) * 100 : 100;

    const registrationsChange =
      registrationsLastWeek > 0
        ? ((registrationsThisWeek - registrationsLastWeek) / registrationsLastWeek) * 100
        : 100;

    // Получаем последние заявки для алертов
    const recentTrialRequests = await prisma.trialRequest.findMany({
      where: {
        status: 'PENDING',
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 5,
      select: {
        id: true,
        userEmail: true,
        companyName: true,
        createdAt: true,
      },
    });

    // Получаем пользователей с истекающими trial
    const expiringTrials = await prisma.user.findMany({
      where: {
        mode: 'TRIAL',
        planExpiry: {
          lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 дней
          gte: now,
        },
      },
      select: {
        id: true,
        email: true,
        planExpiry: true,
      },
      orderBy: {
        planExpiry: 'asc',
      },
      take: 10,
    });

    // Формируем ответ
    const dashboardData = {
      statistics: {
        organizations: {
          total: totalOrganizations,
          active: activeOrganizations,
          blocked: blockedOrganizations,
          demo: demoOrganizations,
        },
        users: {
          total: totalUsers,
          byMode: {
            demo: demoUsers,
            trial: trialUsers,
            paid: paidUsers,
            expired: expiredUsers,
          },
        },
        activeSessions,
        documentsThisMonth: {
          count: documentsThisMonth,
          change: documentsChange,
        },
        reportsThisMonth: {
          count: reportsThisMonth,
          change: reportsChange,
        },
        trialRequests: {
          pending: pendingTrialRequests,
          processing: processingTrialRequests,
          total: pendingTrialRequests + processingTrialRequests,
        },
      },
      trends: {
        registrations: {
          thisWeek: registrationsThisWeek,
          lastWeek: registrationsLastWeek,
          change: registrationsChange,
        },
      },
      alerts: {
        criticalIncidents: {
          count: criticalIncidents,
          severity: criticalIncidents > 0 ? 'error' : 'info',
        },
        newTrialRequests: {
          count: pendingTrialRequests,
          recent: recentTrialRequests,
        },
        expiringTrials: {
          count: expiringTrials.length,
          users: expiringTrials,
        },
      },
    };

    return NextResponse.json(dashboardData);
  } catch (error) {
    console.error('[Admin Dashboard] Error:', error);
    return NextResponse.json(
      { error: 'Ошибка при загрузке данных дашборда' },
      { status: 500 }
    );
  }
}

export const GET = withAdminAuth(handler);
