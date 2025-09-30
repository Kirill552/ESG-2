/**
 * Сервис агрегации аналитических данных
 * Выполняет ночную агрегацию данных по выбросам, расчет трендов и обновление кэша дашборда
 */

import { prisma } from '@/lib/prisma';
import { DEMO_ANALYTICS, DEMO_STATS } from './demo-data-seeder';
import { getUserMode } from './user-mode-utils';

interface AggregationResult {
  organizationId: string;
  period: string;
  totalEmissions: number;
  scope1Emissions: number;
  scope2Emissions: number;
  scope3Emissions: number;
  documentsCount: number;
  reportsCount: number;
  complianceScore: number;
}

/**
 * Основная функция агрегации данных для организации
 */
export async function aggregateOrganizationData(
  organizationId: string,
  period: string = new Date().getFullYear().toString()
): Promise<AggregationResult> {

  try {
    // Получаем отчеты за период
    const reports = await prisma.report.findMany({
      where: {
        organizationId,
        period
      },
      include: {
        organization: {
          include: {
            user: true
          }
        }
      }
    });

    // Получаем документы за период
    const documents = await prisma.document.findMany({
      where: {
        user: {
          organization: {
            id: organizationId
          }
        },
        createdAt: {
          gte: new Date(`${period}-01-01`),
          lte: new Date(`${period}-12-31T23:59:59`)
        }
      }
    });

    const processedDocuments = documents.filter(d => d.status === 'PROCESSED');
    const readyReports = reports.filter(r => r.status === 'READY');

    // Расчет выбросов
    const totalEmissions = readyReports.reduce((sum, r) => sum + (r.totalEmissions || 0), 0);
    const scope1Emissions = Math.round(totalEmissions * 0.4);
    const scope2Emissions = Math.round(totalEmissions * 0.6);
    const scope3Emissions = 0; // Пока не учитываем

    // Расчет компліанса
    const complianceScore = calculateComplianceScore(reports, processedDocuments);

    const result: AggregationResult = {
      organizationId,
      period,
      totalEmissions,
      scope1Emissions,
      scope2Emissions,
      scope3Emissions,
      documentsCount: processedDocuments.length,
      reportsCount: readyReports.length,
      complianceScore
    };

    // Сохраняем агрегированные данные в БД
    await saveReportingSummary(result);

    return result;

  } catch (error) {
    console.error(`Ошибка агрегации данных для организации ${organizationId}:`, error);
    throw error;
  }
}

/**
 * Сохранение агрегированных данных в ReportingSummary
 */
async function saveReportingSummary(data: AggregationResult): Promise<void> {

  // Генерируем данные по источникам выбросов
  const emissionSources = {
    energy: Math.round(data.totalEmissions * 0.45),
    transport: Math.round(data.totalEmissions * 0.25),
    production: Math.round(data.totalEmissions * 0.20),
    waste: Math.round(data.totalEmissions * 0.07),
    other: Math.round(data.totalEmissions * 0.03)
  };

  // Генерируем месячную разбивку
  const monthlyData = generateMonthlyBreakdown(data.totalEmissions, data.period);

  // Расчет трендов (сравнение с предыдущим периодом)
  const trends = await calculateTrends(data.organizationId, data.period);

  await prisma.reportingSummary.upsert({
    where: {
      organizationId_period_periodType: {
        organizationId: data.organizationId,
        period: data.period,
        periodType: 'year'
      }
    },
    create: {
      organizationId: data.organizationId,
      period: data.period,
      periodType: 'year',
      totalEmissions: data.totalEmissions,
      scope1Emissions: data.scope1Emissions,
      scope2Emissions: data.scope2Emissions,
      scope3Emissions: data.scope3Emissions,
      documentsCount: data.documentsCount,
      reportsCount: data.reportsCount,
      processedCount: data.documentsCount,
      complianceScore: data.complianceScore,
      dataQuality: calculateDataQuality(data),
      emissionsSources: emissionSources,
      trends: trends
    },
    update: {
      totalEmissions: data.totalEmissions,
      scope1Emissions: data.scope1Emissions,
      scope2Emissions: data.scope2Emissions,
      scope3Emissions: data.scope3Emissions,
      documentsCount: data.documentsCount,
      reportsCount: data.reportsCount,
      processedCount: data.documentsCount,
      complianceScore: data.complianceScore,
      dataQuality: calculateDataQuality(data),
      emissionsSources: emissionSources,
      trends: trends,
      calculatedAt: new Date(),
      updatedAt: new Date()
    }
  });
}

/**
 * Обновление кэша дашборда
 */
export async function updateDashboardCache(
  organizationId: string,
  cacheExpiration: number = 1 // часы
): Promise<void> {

  try {
    // Получаем агрегированные данные
    const summary = await prisma.reportingSummary.findFirst({
      where: {
        organizationId,
        periodType: 'year'
      },
      orderBy: { calculatedAt: 'desc' }
    });

    if (!summary) {
      console.log(`Нет агрегированных данных для организации ${organizationId}`);
      return;
    }

    // Получаем последние документы
    const recentDocuments = await prisma.document.findMany({
      where: {
        user: {
          organization: {
            id: organizationId
          }
        }
      },
      orderBy: { uploadedAt: 'desc' },
      take: 4,
      select: {
        id: true,
        filename: true,
        uploadedAt: true,
        status: true,
        fileSize: true,
        mimeType: true
      }
    });

    // Получаем последние отчеты
    const recentReports = await prisma.report.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        period: true
      }
    });

    // Генерируем KPI данные
    const kpiData = [
      {
        title: 'Общие выбросы',
        value: summary.totalEmissions,
        unit: 'т CO₂-экв',
        change: summary.trends?.yearOverYear || 0,
        period: 'к прошлому году',
        icon: 'Leaf',
        color: 'green'
      },
      {
        title: 'Документов загружено',
        value: summary.documentsCount,
        unit: 'файлов',
        change: summary.trends?.documentsGrowth || 0,
        period: 'за год',
        icon: 'FileText',
        color: 'blue'
      },
      {
        title: 'Готовых отчетов',
        value: summary.reportsCount,
        unit: 'отчета',
        change: summary.trends?.reportsGrowth || 0,
        period: 'за год',
        icon: 'FileCheck',
        color: 'purple'
      },
      {
        title: 'Соответствие 296-ФЗ',
        value: Math.round(summary.complianceScore),
        unit: '%',
        change: 0,
        period: 'текущий статус',
        icon: 'Shield',
        color: 'orange'
      }
    ];

    // Данные прогресса
    const progressData = {
      dataCollection: {
        label: 'Сбор данных',
        percentage: Math.min(95, summary.documentsCount * 5),
        color: summary.documentsCount > 10 ? 'green' : 'blue'
      },
      documentProcessing: {
        label: 'Обработка документов',
        percentage: Math.min(95, summary.processedCount * 6),
        color: summary.processedCount > 8 ? 'green' : 'blue'
      },
      reportGeneration: {
        label: 'Создание отчетов',
        percentage: Math.min(95, summary.reportsCount * 20),
        color: summary.reportsCount > 2 ? 'green' : 'orange'
      }
    };

    // Сохраняем в кэш
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + cacheExpiration);

    await prisma.dashboardCache.upsert({
      where: { organizationId },
      create: {
        organizationId,
        kpiData,
        recentData: {
          documents: recentDocuments,
          reports: recentReports
        },
        progressData,
        complianceData: {
          score: summary.complianceScore,
          status: summary.complianceScore > 80 ? 'Полное соответствие' : 'Частичное соответствие'
        },
        analyticsData: {
          emissionsSources: summary.emissionsSources,
          trends: summary.trends
        },
        expiresAt
      },
      update: {
        kpiData,
        recentData: {
          documents: recentDocuments,
          reports: recentReports
        },
        progressData,
        complianceData: {
          score: summary.complianceScore,
          status: summary.complianceScore > 80 ? 'Полное соответствие' : 'Частичное соответствие'
        },
        analyticsData: {
          emissionsSources: summary.emissionsSources,
          trends: summary.trends
        },
        cachedAt: new Date(),
        expiresAt,
        updatedAt: new Date()
      }
    });

  } catch (error) {
    console.error(`Ошибка обновления кэша дашборда для организации ${organizationId}:`, error);
    throw error;
  }
}

/**
 * Ночная задача агрегации для всех организаций
 */
export async function runNightlyAggregation(): Promise<void> {
  console.log('🌙 Запуск ночной агрегации данных...');

  try {
    // Получаем все организации
    const organizations = await prisma.organization.findMany({
      where: {
        isBlocked: false
      },
      select: { id: true, name: true }
    });

    const currentYear = new Date().getFullYear().toString();
    let successCount = 0;
    let errorCount = 0;

    for (const org of organizations) {
      try {
        await aggregateOrganizationData(org.id, currentYear);
        await updateDashboardCache(org.id, 24); // кэш на 24 часа
        successCount++;
        console.log(`✅ Агрегация завершена для ${org.name}`);
      } catch (error) {
        errorCount++;
        console.error(`❌ Ошибка агрегации для ${org.name}:`, error);
      }
    }

    console.log(`🎯 Ночная агрегация завершена: успешно ${successCount}, ошибок ${errorCount}`);

  } catch (error) {
    console.error('💥 Критическая ошибка ночной агрегации:', error);
    throw error;
  }
}

// === УТИЛИТЫ ===

function calculateComplianceScore(reports: any[], documents: any[]): number {
  let score = 0;

  // Базовые баллы за отчеты
  const readyReports = reports.filter(r => r.status === 'READY').length;
  if (readyReports > 0) score += 40;

  // Баллы за документы
  score += Math.min(30, documents.length * 3);

  // Баллы за актуальность
  const currentYear = new Date().getFullYear().toString();
  const currentYearReports = reports.filter(r => r.period === currentYear && r.status === 'READY');
  if (currentYearReports.length > 0) score += 30;

  return Math.min(100, score);
}

function calculateDataQuality(data: AggregationResult): number {
  let quality = 50; // базовое качество

  if (data.documentsCount >= 5) quality += 20;
  if (data.reportsCount >= 1) quality += 20;
  if (data.totalEmissions > 0) quality += 10;

  return Math.min(100, quality);
}

function generateMonthlyBreakdown(totalEmissions: number, year: string) {
  const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

  return months.map(month => ({
    period: `${year}-${month}`,
    value: Math.round(totalEmissions / 12 * (0.8 + Math.random() * 0.4)),
    scope1: Math.round(totalEmissions / 12 * 0.4 * (0.8 + Math.random() * 0.4)),
    scope2: Math.round(totalEmissions / 12 * 0.6 * (0.8 + Math.random() * 0.4)),
    scope3: 0
  }));
}

async function calculateTrends(organizationId: string, currentPeriod: string) {
  const previousPeriod = (parseInt(currentPeriod) - 1).toString();

  const previousSummary = await prisma.reportingSummary.findFirst({
    where: {
      organizationId,
      period: previousPeriod,
      periodType: 'year'
    }
  });

  if (!previousSummary) {
    return {
      yearOverYear: 0,
      documentsGrowth: 0,
      reportsGrowth: 0
    };
  }

  // Получаем текущие данные
  const currentSummary = await prisma.reportingSummary.findFirst({
    where: {
      organizationId,
      period: currentPeriod,
      periodType: 'year'
    }
  });

  if (!currentSummary) {
    return {
      yearOverYear: 0,
      documentsGrowth: 0,
      reportsGrowth: 0
    };
  }

  return {
    yearOverYear: calculatePercentageChange(previousSummary.totalEmissions, currentSummary.totalEmissions),
    documentsGrowth: calculatePercentageChange(previousSummary.documentsCount, currentSummary.documentsCount),
    reportsGrowth: calculatePercentageChange(previousSummary.reportsCount, currentSummary.reportsCount)
  };
}

function calculatePercentageChange(previous: number, current: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Number(((current - previous) / previous * 100).toFixed(1));
}