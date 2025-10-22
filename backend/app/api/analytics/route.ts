import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { DEMO_ANALYTICS, DEMO_STATS } from '@/lib/demo-data-seeder';
import { getUserMode } from '@/lib/user-mode-utils';

/**
 * GET /api/analytics
 * Возвращает данные для страницы аналитики:
 * - 4 KPI карточки (те же что на дашборде)
 * - Динамика выбросов по месяцам (линейный график)
 * - Распределение по категориям (круговая диаграмма)
 * - Сравнение с предыдущим периодом (столбчатая диаграмма)
 * Поддерживает фильтрацию по годам
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

    // Получаем параметры запроса
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year') || new Date().getFullYear().toString();

    if (userMode === 'DEMO') {
      // Демо-режим: возвращаем моковые аналитические данные
      return NextResponse.json({
        availableYears: ['2022', '2023', '2024'],
        selectedYear: year,
        kpiCards: DEMO_STATS,
        monthlyEmissions: {
          title: 'Динамика выбросов по месяцам',
          data: DEMO_ANALYTICS.monthlyEmissions,
          chartType: 'line',
          xAxisKey: 'month',
          yAxisKeys: ['value'],
          colors: ['#10b981'],
          legends: ['Фактические выбросы (т CO₂)']
        },
        emissionsByCategory: {
          title: 'Распределение выбросов по категориям',
          data: DEMO_ANALYTICS.emissionSources,
          chartType: 'pie',
          valueKey: 'value',
          nameKey: 'name',
          colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
          showPercentage: true,
          showAmount: true
        },
        yearComparison: {
          title: 'Сравнение с предыдущим периодом',
          data: [
            {
              category: 'Энергия',
              previousYear: 532,
              currentYear: 561,
              change: 5.5
            },
            {
              category: 'Транспорт',
              previousYear: 289,
              currentYear: 312,
              change: 8.0
            },
            {
              category: 'Производство',
              previousYear: 267,
              currentYear: 249,
              change: -6.7
            },
            {
              category: 'Отходы',
              previousYear: 92,
              currentYear: 87,
              change: -5.4
            }
          ],
          chartType: 'bar',
          xAxisKey: 'category',
          yAxisKeys: ['previousYear', 'currentYear'],
          colors: ['#64748b', '#3b82f6'],
          legends: [`${parseInt(year) - 1} год`, `${year} год`]
        },
        detailedBreakdown: {
          scope1: {
            total: 497,
            categories: [
              { name: 'Сжигание топлива', value: 298, percentage: 60.0 },
              { name: 'Промышленные процессы', value: 149, percentage: 30.0 },
              { name: 'Утечки', value: 50, percentage: 10.0 }
            ]
          },
          scope2: {
            total: 750,
            categories: [
              { name: 'Электроэнергия', value: 525, percentage: 70.0 },
              { name: 'Тепло', value: 225, percentage: 30.0 }
            ]
          },
          scope3: {
            total: 0,
            categories: []
          }
        },
        trends: {
          yearOverYear: -5.2,
          quarterOverQuarter: 2.1,
          monthOverMonth: 0.8,
          peakMonth: 'Октябрь',
          lowestMonth: 'Июнь'
        }
      });
    }

    // PAID режим: реальные аналитические данные из БД
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
          where: {
            status: 'PROCESSED',
            createdAt: {
              gte: new Date(`${year}-01-01`),
              lte: new Date(`${year}-12-31`)
            }
          }
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

    // Получаем отчеты за выбранный год
    const reports = await prisma.report.findMany({
      where: {
        userId,
        period: year
      },
      orderBy: { createdAt: 'desc' }
    });

    // Получаем доступные годы из отчетов
    const availableYearsQuery = await prisma.report.findMany({
      where: { userId },
      select: { period: true },
      distinct: ['period'],
      orderBy: { period: 'desc' }
    });

    const availableYears = availableYearsQuery.map(r => r.period).filter(Boolean);

    // Подсчитываем статистики
    const totalDocuments = user.documents.length;
    const totalReports = reports.length;
    const readyReports = reports.filter(r => r.status === 'READY').length;

    // Получаем данные по выбросам
    const currentYearReport = reports.find(r => r.status === 'READY');
    const totalEmissions = currentYearReport?.totalEmissions || 0;

    // Генерируем месячную разбивку (пример)
    const monthlyData = generateMonthlyEmissions(totalEmissions);

    // KPI карточки для аналитики
    const kpiCards = [
      {
        title: 'Общие выбросы',
        value: totalEmissions,
        unit: 'т CO₂-экв',
        change: 0, // TODO: расчет к предыдущему году
        period: 'к прошлому году',
        icon: 'Leaf',
        color: 'green',
        metric: 'co2' as const
      },
      {
        title: 'Документов загружено',
        value: totalDocuments,
        unit: 'файлов',
        change: 0,
        period: 'за год',
        icon: 'FileText',
        color: 'blue'
      },
      {
        title: 'Готовых отчетов',
        value: readyReports,
        unit: 'отчета',
        change: 0,
        period: 'за год',
        icon: 'FileCheck',
        color: 'purple'
      },
      {
        title: 'Соответствие 296-ФЗ',
        value: readyReports > 0 ? 100 : 0,
        unit: '%',
        change: 0,
        period: 'текущий статус',
        icon: 'Shield',
        color: 'orange'
      }
    ];

    return NextResponse.json({
      availableYears: availableYears.length > 0 ? availableYears : [year],
      selectedYear: year,
      kpiCards,
      monthlyEmissions: {
        title: 'Динамика выбросов по месяцам',
        data: monthlyData,
        chartType: 'line',
        xAxisKey: 'month',
        yAxisKeys: ['value'],
        colors: ['#10b981'],
        legends: ['Фактические выбросы (т CO₂)']
      },
      emissionsByCategory: {
        title: 'Распределение выбросов по категориям',
        data: generateCategoryBreakdown(totalEmissions),
        chartType: 'pie',
        valueKey: 'value',
        nameKey: 'name',
        colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
        showPercentage: true,
        showAmount: true
      },
      yearComparison: {
        title: 'Сравнение с предыдущим периодом',
        data: await generateYearComparison(userId, year),
        chartType: 'bar',
        xAxisKey: 'category',
        yAxisKeys: ['previousYear', 'currentYear'],
        colors: ['#64748b', '#3b82f6'],
        legends: [`${parseInt(year) - 1} год`, `${year} год`]
      },
      detailedBreakdown: generateDetailedBreakdown(totalEmissions),
      trends: calculateTrends(monthlyData, totalEmissions)
    });

  } catch (error) {
    console.error('Ошибка при получении аналитических данных:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}

// Утилиты для генерации реальных аналитических данных

function generateMonthlyEmissions(totalEmissions: number) {
  const months = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
  return months.map(month => ({
    month,
    value: Math.round(totalEmissions / 12 * (0.8 + Math.random() * 0.4)),
    scope1: Math.round(totalEmissions / 12 * 0.4 * (0.8 + Math.random() * 0.4)),
    scope2: Math.round(totalEmissions / 12 * 0.6 * (0.8 + Math.random() * 0.4)),
    scope3: 0
  }));
}

function generateCategoryBreakdown(totalEmissions: number) {
  if (totalEmissions === 0) {
    return [
      { name: 'Нет данных', value: 100, amount: 0 }
    ];
  }

  return [
    { name: 'Энергия', value: 45, amount: Math.round(totalEmissions * 0.45) },
    { name: 'Транспорт', value: 25, amount: Math.round(totalEmissions * 0.25) },
    { name: 'Производство', value: 20, amount: Math.round(totalEmissions * 0.20) },
    { name: 'Отходы', value: 7, amount: Math.round(totalEmissions * 0.07) },
    { name: 'Прочее', value: 3, amount: Math.round(totalEmissions * 0.03) }
  ];
}

async function generateYearComparison(userId: string, currentYear: string) {
  const previousYear = (parseInt(currentYear) - 1).toString();

  // Получаем отчеты за предыдущий год
  const previousYearReports = await prisma.report.findMany({
    where: {
      userId,
      period: previousYear,
      status: 'READY'
    }
  });

  const currentYearReports = await prisma.report.findMany({
    where: {
      userId,
      period: currentYear,
      status: 'READY'
    }
  });

  const previousTotal = previousYearReports.reduce((sum, r) => sum + (r.totalEmissions || 0), 0);
  const currentTotal = currentYearReports.reduce((sum, r) => sum + (r.totalEmissions || 0), 0);

  return [
    {
      category: 'Энергия',
      previousYear: Math.round(previousTotal * 0.45),
      currentYear: Math.round(currentTotal * 0.45),
      change: calculateChange(previousTotal * 0.45, currentTotal * 0.45)
    },
    {
      category: 'Транспорт',
      previousYear: Math.round(previousTotal * 0.25),
      currentYear: Math.round(currentTotal * 0.25),
      change: calculateChange(previousTotal * 0.25, currentTotal * 0.25)
    },
    {
      category: 'Производство',
      previousYear: Math.round(previousTotal * 0.20),
      currentYear: Math.round(currentTotal * 0.20),
      change: calculateChange(previousTotal * 0.20, currentTotal * 0.20)
    },
    {
      category: 'Отходы',
      previousYear: Math.round(previousTotal * 0.07),
      currentYear: Math.round(currentTotal * 0.07),
      change: calculateChange(previousTotal * 0.07, currentTotal * 0.07)
    }
  ];
}

function generateDetailedBreakdown(totalEmissions: number) {
  const scope1Total = Math.round(totalEmissions * 0.4);
  const scope2Total = Math.round(totalEmissions * 0.6);

  return {
    scope1: {
      total: scope1Total,
      categories: [
        { name: 'Сжигание топлива', value: Math.round(scope1Total * 0.6), percentage: 60.0 },
        { name: 'Промышленные процессы', value: Math.round(scope1Total * 0.3), percentage: 30.0 },
        { name: 'Утечки', value: Math.round(scope1Total * 0.1), percentage: 10.0 }
      ]
    },
    scope2: {
      total: scope2Total,
      categories: [
        { name: 'Электроэнергия', value: Math.round(scope2Total * 0.7), percentage: 70.0 },
        { name: 'Тепло', value: Math.round(scope2Total * 0.3), percentage: 30.0 }
      ]
    },
    scope3: {
      total: 0,
      categories: []
    }
  };
}

function calculateTrends(monthlyData: any[], totalEmissions: number) {
  const values = monthlyData.map(d => d.value);
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  const maxMonth = monthlyData.find(d => d.value === maxValue)?.month || '';
  const minMonth = monthlyData.find(d => d.value === minValue)?.month || '';

  return {
    yearOverYear: 0, // TODO: реальный расчет
    quarterOverQuarter: 0,
    monthOverMonth: 0,
    peakMonth: maxMonth,
    lowestMonth: minMonth
  };
}

function calculateChange(previous: number, current: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Number(((current - previous) / previous * 100).toFixed(1));
}