import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getUserMode } from '@/lib/user-mode-utils';

/**
 * GET /api/analytics/compliance
 * Возвращает статус соответствия 296-ФЗ:
 * - Соответствие 296-ФЗ: "Полное" | "Частичное" | "Нет"
 * - Своевременность подачи: "В срок" | "Просрочено"
 * - Полнота данных: процент (99.2%)
 * - Качество отчетов: "Высокое" | "Среднее" | "Низкое"
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || !(session.user as any)?.id) {
      return NextResponse.json(
        { error: 'Требуется авторизация' },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;
    const userMode = await getUserMode(userId);

    if (userMode === 'DEMO') {
      // Демо-режим: идеальные показатели соответствия
      return NextResponse.json({
        compliance296FZ: {
          status: 'Полное',
          level: 'high',
          score: 98.5,
          details: [
            {
              requirement: 'Своевременная подача отчетов',
              status: 'Выполнено',
              score: 100
            },
            {
              requirement: 'Полнота данных по выбросам',
              status: 'Выполнено',
              score: 99.2
            },
            {
              requirement: 'Корректность расчетов',
              status: 'Выполнено',
              score: 98.8
            },
            {
              requirement: 'Документооборот',
              status: 'Выполнено',
              score: 96.5
            }
          ]
        },
        timelySubmission: {
          status: 'В срок',
          level: 'good',
          daysBeforeDeadline: 45,
          details: {
            nextDeadline: '31.03.2025',
            reportsPending: 0,
            reportsReady: 1,
            averageSubmissionTime: '15 дней до дедлайна'
          }
        },
        dataCompleteness: {
          percentage: 99.2,
          level: 'excellent',
          breakdown: {
            scope1: { percentage: 100, status: 'Полные данные' },
            scope2: { percentage: 99.8, status: 'Незначительные пропуски' },
            scope3: { percentage: 96.5, status: 'Опциональные данные' },
            supportingDocuments: { percentage: 100, status: 'Все документы загружены' }
          },
          missingData: [
            'Уточнение коэффициентов для некоторых видов топлива (Scope 3)'
          ]
        },
        reportQuality: {
          status: 'Высокое',
          level: 'high',
          score: 94.2,
          metrics: {
            accuracy: 98.5,
            consistency: 92.8,
            documentation: 95.5,
            methodology: 90.0
          },
          improvements: [
            'Автоматизация проверки данных',
            'Улучшение методологии расчета Scope 3'
          ]
        },
        regulatoryUpdates: [
          {
            date: '2024-12-15',
            title: 'Обновление методических рекомендаций 296-ФЗ',
            status: 'Учтено в системе',
            impact: 'low'
          },
          {
            date: '2024-11-20',
            title: 'Изменения в сроках подачи квартальных отчетов',
            status: 'Отслеживается',
            impact: 'medium'
          }
        ],
        recommendations: [
          {
            priority: 'high',
            title: 'Подготовка к отчету за 2024 год',
            description: 'Начать сбор и систематизацию данных за IV квартал',
            deadline: '2025-02-01'
          },
          {
            priority: 'medium',
            title: 'Внедрение методологии Scope 3',
            description: 'Расширить учет косвенных выбросов третьей категории',
            deadline: '2025-06-01'
          }
        ]
      });
    }

    // PAID режим: реальная оценка соответствия
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        organization: {
          select: {
            canUseAnalytics: true,
            isBlocked: true,
          },
        },
        documents: {
          where: { status: 'PROCESSED' }
        }
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Пользователь не найден' },
        { status: 404 }
      );
    }

    // Проверяем доступ организации к аналитике
    if (user.organization) {
      if (user.organization.isBlocked) {
        return NextResponse.json(
          { error: 'Организация заблокирована. Обратитесь в службу поддержки.' },
          { status: 403 }
        );
      }

      if (!user.organization.canUseAnalytics) {
        return NextResponse.json(
          { error: 'Аналитика недоступна для вашей организации. Обратитесь к администратору.' },
          { status: 403 }
        );
      }
    }

    // Получаем отчеты пользователя
    const reports = await prisma.report.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    const currentYear = new Date().getFullYear();
    const currentYearReports = reports.filter(r => r.period === currentYear.toString());
    const readyReports = currentYearReports.filter(r => r.status === 'READY');

    // Оценка соответствия 296-ФЗ
    const compliance296FZ = calculateComplianceStatus(reports, user.documents, currentYearReports);

    // Оценка своевременности подачи
    const timelySubmission = calculateTimelySubmission(currentYearReports);

    // Полнота данных
    const dataCompleteness = calculateDataCompleteness(user.documents, readyReports);

    // Качество отчетов
    const reportQuality = calculateReportQuality(readyReports);

    return NextResponse.json({
      compliance296FZ,
      timelySubmission,
      dataCompleteness,
      reportQuality,
      regulatoryUpdates: [],
      recommendations: generateRecommendations(compliance296FZ, timelySubmission, dataCompleteness)
    });

  } catch (error) {
    console.error('Ошибка при получении статуса соответствия:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}

// Утилиты для расчета статуса соответствия

function calculateComplianceStatus(allReports: any[], documents: any[], currentYearReports: any[]) {
  const totalReports = allReports.length;
  const readyReports = allReports.filter(r => r.status === 'READY').length;
  const documentsCount = documents.length;

  let score = 0;
  let status = 'Нет';
  let level = 'low';

  // Базовая оценка на основе готовых отчетов
  if (readyReports > 0) {
    score += 40;
    status = 'Частичное';
    level = 'medium';
  }

  // Дополнительные баллы за документы
  if (documentsCount >= 10) score += 20;
  else if (documentsCount >= 5) score += 10;

  // Баллы за текущий год
  if (currentYearReports.length > 0) {
    score += 20;
    if (currentYearReports.some(r => r.status === 'READY')) {
      score += 20;
      status = 'Полное';
      level = 'high';
    }
  }

  const details = [
    {
      requirement: 'Своевременная подача отчетов',
      status: readyReports > 0 ? 'Выполнено' : 'Не выполнено',
      score: readyReports > 0 ? 90 : 0
    },
    {
      requirement: 'Полнота данных по выбросам',
      status: documentsCount >= 5 ? 'Выполнено' : 'Частично',
      score: Math.min(100, documentsCount * 10)
    },
    {
      requirement: 'Корректность расчетов',
      status: readyReports > 0 ? 'Выполнено' : 'Требует проверки',
      score: readyReports > 0 ? 85 : 50
    },
    {
      requirement: 'Документооборот',
      status: documentsCount > 0 ? 'Выполнено' : 'Не выполнено',
      score: documentsCount > 0 ? 80 : 0
    }
  ];

  return {
    status,
    level,
    score: Math.min(100, score),
    details
  };
}

function calculateTimelySubmission(currentYearReports: any[]) {
  const deadline = new Date(`${new Date().getFullYear()}-03-31`);
  const now = new Date();
  const daysToDeadline = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  const readyReports = currentYearReports.filter(r => r.status === 'READY').length;
  const pendingReports = 0; // Нет черновиков, все отчеты создаются как READY

  let status = 'В срок';
  let level = 'good';

  if (daysToDeadline < 0) {
    status = 'Просрочено';
    level = 'critical';
  } else if (daysToDeadline < 30 && readyReports === 0) {
    status = 'Риск просрочки';
    level = 'warning';
  }

  return {
    status,
    level,
    daysBeforeDeadline: Math.max(0, daysToDeadline),
    details: {
      nextDeadline: deadline.toLocaleDateString('ru-RU'),
      reportsPending: pendingReports,
      reportsReady: readyReports,
      averageSubmissionTime: readyReports > 0 ? '30 дней до дедлайна' : 'Нет данных'
    }
  };
}

function calculateDataCompleteness(documents: any[], readyReports: any[]) {
  const documentsCount = documents.length;
  const reportsCount = readyReports.length;

  // Базовая оценка полноты данных
  let basePercentage = Math.min(95, documentsCount * 5); // Максимум 95% от документов
  if (reportsCount > 0) basePercentage = Math.max(basePercentage, 80);

  const level = basePercentage >= 90 ? 'excellent' : basePercentage >= 70 ? 'good' : 'needs_improvement';

  return {
    percentage: Math.round(basePercentage * 10) / 10,
    level,
    breakdown: {
      scope1: {
        percentage: Math.min(100, basePercentage + 5),
        status: documentsCount >= 3 ? 'Полные данные' : 'Требуется больше документов'
      },
      scope2: {
        percentage: Math.min(100, basePercentage),
        status: documentsCount >= 2 ? 'Данные есть' : 'Минимальные данные'
      },
      scope3: {
        percentage: Math.min(100, basePercentage - 10),
        status: 'Опциональные данные'
      },
      supportingDocuments: {
        percentage: documentsCount > 0 ? 100 : 0,
        status: documentsCount > 0 ? 'Документы загружены' : 'Нет документов'
      }
    },
    missingData: documentsCount < 5 ? [
      'Требуется больше исходных документов для полного анализа'
    ] : []
  };
}

function calculateReportQuality(readyReports: any[]) {
  if (readyReports.length === 0) {
    return {
      status: 'Нет данных',
      level: 'low',
      score: 0,
      metrics: {
        accuracy: 0,
        consistency: 0,
        documentation: 0,
        methodology: 0
      },
      improvements: ['Создайте первый отчет для оценки качества']
    };
  }

  // Базовая оценка качества
  const score = 75 + Math.min(20, readyReports.length * 5); // Больше отчетов = выше качество

  return {
    status: score >= 90 ? 'Высокое' : score >= 70 ? 'Среднее' : 'Низкое',
    level: score >= 90 ? 'high' : score >= 70 ? 'medium' : 'low',
    score,
    metrics: {
      accuracy: Math.min(100, score + 5),
      consistency: Math.max(60, score - 10),
      documentation: Math.min(100, score),
      methodology: Math.max(70, score - 5)
    },
    improvements: score < 90 ? [
      'Увеличьте количество исходных данных',
      'Регулярно обновляйте методологию расчетов'
    ] : []
  };
}

function generateRecommendations(compliance: any, timeliness: any, completeness: any) {
  const recommendations = [];

  if (compliance.score < 80) {
    recommendations.push({
      priority: 'high',
      title: 'Улучшение соответствия 296-ФЗ',
      description: 'Завершите подготовку отчетов и загрузите недостающие документы',
      deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    });
  }

  if (timeliness.level !== 'good') {
    recommendations.push({
      priority: 'high',
      title: 'Соблюдение сроков отчетности',
      description: 'Ускорьте подготовку отчетов для соблюдения установленных дедлайнов',
      deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    });
  }

  if (completeness.percentage < 90) {
    recommendations.push({
      priority: 'medium',
      title: 'Повышение полноты данных',
      description: 'Загрузите дополнительные документы для улучшения качества анализа',
      deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    });
  }

  return recommendations;
}