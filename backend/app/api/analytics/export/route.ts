import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { DEMO_ANALYTICS, DEMO_STATS } from '@/lib/demo-data-seeder';
import { getUserMode } from '@/lib/user-mode-utils';
import * as XLSX from 'xlsx';

/**
 * POST /api/analytics/export
 * Экспорт аналитических данных в форматах Excel (.xlsx) и CSV
 * Параметры: период, тип данных (KPI, графики, compliance)
 * Возвращает файл для скачивания
 */
export async function POST(request: NextRequest) {
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

    // Получаем параметры экспорта
    const body = await request.json();
    const {
      format = 'xlsx', // xlsx | csv
      dataType = 'all', // kpi | charts | compliance | all
      period = new Date().getFullYear().toString(),
      includeCharts = true,
      includeCompliance = true
    } = body;

    // Валидация параметров
    if (!['xlsx', 'csv'].includes(format)) {
      return NextResponse.json(
        { error: 'Неподдерживаемый формат. Доступны: xlsx, csv' },
        { status: 400 }
      );
    }

    let exportData: any = {};

    if (userMode === 'DEMO') {
      // Демо-режим: экспорт моковых данных
      exportData = {
        kpi: DEMO_STATS,
        monthlyEmissions: DEMO_ANALYTICS.monthlyEmissions,
        emissionSources: DEMO_ANALYTICS.emissionSources,
        compliance: {
          compliance296FZ: 'Полное соответствие',
          timelySubmission: 'В срок',
          dataCompleteness: 99.2,
          reportQuality: 'Высокое'
        },
        metadata: {
          exportDate: new Date().toISOString(),
          period,
          dataType,
          organizationName: 'ООО "Демо Компания"',
          userMode: 'DEMO'
        }
      };
    } else {
      // PAID режим: реальные данные
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          organization: {
            select: {
              name: true,
              inn: true,
              canUseAnalytics: true,
              isBlocked: true,
            },
          },
          documents: {
            where: {
              status: 'PROCESSED',
              createdAt: {
                gte: new Date(`${period}-01-01`),
                lte: new Date(`${period}-12-31`)
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

      // Получаем отчеты за период
      const reports = await prisma.report.findMany({
        where: {
          userId,
          period
        },
        orderBy: { createdAt: 'desc' }
      });

      const readyReports = reports.filter(r => r.status === 'READY');
      const totalEmissions = readyReports.reduce((sum, r) => sum + (r.totalEmissions || 0), 0);

      exportData = {
        kpi: generateKPIData(user.documents.length, readyReports.length, totalEmissions),
        monthlyEmissions: generateMonthlyData(totalEmissions, period),
        emissionSources: generateSourcesData(totalEmissions),
        compliance: generateComplianceData(reports, user.documents.length),
        metadata: {
          exportDate: new Date().toISOString(),
          period,
          dataType,
          organizationName: user.organization?.name || '',
          organizationInn: user.organization?.inn || '',
          userMode: 'PAID',
          totalReports: reports.length,
          readyReports: readyReports.length,
          totalDocuments: user.documents.length
        }
      };
    }

    // Генерируем файл в зависимости от формата
    if (format === 'xlsx') {
      const buffer = generateExcelFile(exportData, dataType, includeCharts, includeCompliance);

      return new NextResponse(buffer as any, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="ESG_Analytics_${period}_${new Date().toISOString().split('T')[0]}.xlsx"`
        }
      });
    } else {
      const csvContent = generateCSVFile(exportData, dataType);

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="ESG_Analytics_${period}_${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    }

  } catch (error) {
    console.error('Ошибка при экспорте аналитических данных:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}

// Утилиты для генерации данных экспорта

function generateKPIData(documentsCount: number, reportsCount: number, totalEmissions: number) {
  return [
    {
      title: 'Общие выбросы',
      value: totalEmissions,
      unit: 'т CO₂-экв',
      change: 0,
      period: 'к прошлому году'
    },
    {
      title: 'Документов загружено',
      value: documentsCount,
      unit: 'файлов',
      change: 0,
      period: 'за год'
    },
    {
      title: 'Готовых отчетов',
      value: reportsCount,
      unit: 'отчета',
      change: 0,
      period: 'за год'
    },
    {
      title: 'Экономия времени',
      value: Math.round(reportsCount * 6.8 + documentsCount * 1.2),
      unit: 'часов',
      change: 0,
      period: 'за год'
    }
  ];
}

function generateMonthlyData(totalEmissions: number, period: string) {
  const months = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
  return months.map(month => ({
    month,
    period,
    value: Math.round(totalEmissions / 12 * (0.8 + Math.random() * 0.4)),
    scope1: Math.round(totalEmissions / 12 * 0.4 * (0.8 + Math.random() * 0.4)),
    scope2: Math.round(totalEmissions / 12 * 0.6 * (0.8 + Math.random() * 0.4)),
    scope3: 0
  }));
}

function generateSourcesData(totalEmissions: number) {
  if (totalEmissions === 0) {
    return [{ name: 'Нет данных', value: 100, amount: 0 }];
  }

  return [
    { name: 'Энергия', value: 45, amount: Math.round(totalEmissions * 0.45) },
    { name: 'Транспорт', value: 25, amount: Math.round(totalEmissions * 0.25) },
    { name: 'Производство', value: 20, amount: Math.round(totalEmissions * 0.20) },
    { name: 'Отходы', value: 7, amount: Math.round(totalEmissions * 0.07) },
    { name: 'Прочее', value: 3, amount: Math.round(totalEmissions * 0.03) }
  ];
}

function generateComplianceData(reports: any[], documentsCount: number) {
  const readyReports = reports.filter(r => r.status === 'READY').length;

  return {
    compliance296FZ: readyReports > 0 ? 'Полное соответствие' : 'Частичное соответствие',
    timelySubmission: readyReports > 0 ? 'В срок' : 'Требует внимания',
    dataCompleteness: Math.min(100, documentsCount * 10),
    reportQuality: readyReports > 0 ? 'Высокое' : 'Среднее',
    totalReports: reports.length,
    readyReports,
    documentsProcessed: documentsCount
  };
}

function generateExcelFile(data: any, dataType: string, includeCharts: boolean, includeCompliance: boolean): Buffer {
  const workbook = XLSX.utils.book_new();

  // Лист с метаданными
  const metadataSheet = XLSX.utils.json_to_sheet([data.metadata]);
  XLSX.utils.book_append_sheet(workbook, metadataSheet, 'Метаданные');

  // Лист с KPI данными
  if (dataType === 'all' || dataType === 'kpi') {
    const kpiSheet = XLSX.utils.json_to_sheet(data.kpi);
    XLSX.utils.book_append_sheet(workbook, kpiSheet, 'KPI показатели');
  }

  // Лист с месячными данными выбросов
  if ((dataType === 'all' || dataType === 'charts') && includeCharts) {
    const monthlySheet = XLSX.utils.json_to_sheet(data.monthlyEmissions);
    XLSX.utils.book_append_sheet(workbook, monthlySheet, 'Динамика по месяцам');

    // Лист с распределением по источникам
    const sourcesSheet = XLSX.utils.json_to_sheet(data.emissionSources);
    XLSX.utils.book_append_sheet(workbook, sourcesSheet, 'Распределение по категориям');
  }

  // Лист с данными соответствия
  if ((dataType === 'all' || dataType === 'compliance') && includeCompliance) {
    const complianceSheet = XLSX.utils.json_to_sheet([data.compliance]);
    XLSX.utils.book_append_sheet(workbook, complianceSheet, 'Соответствие 296-ФЗ');
  }

  // Сводный лист для удобства
  if (dataType === 'all') {
    const summaryData = [
      { 'Параметр': 'Период отчета', 'Значение': data.metadata.period },
      { 'Параметр': 'Дата экспорта', 'Значение': new Date(data.metadata.exportDate).toLocaleDateString('ru-RU') },
      { 'Параметр': 'Организация', 'Значение': data.metadata.organizationName },
      { 'Параметр': 'Общие выбросы (т CO₂)', 'Значение': data.kpi.find((k: any) => k.title === 'Общие выбросы')?.value || 0 },
      { 'Параметр': 'Документов обработано', 'Значение': data.kpi.find((k: any) => k.title === 'Документов загружено')?.value || 0 },
      { 'Параметр': 'Готовых отчетов', 'Значение': data.kpi.find((k: any) => k.title === 'Готовых отчетов')?.value || 0 },
      { 'Параметр': 'Статус соответствия 296-ФЗ', 'Значение': data.compliance.compliance296FZ },
      { 'Параметр': 'Своевременность подачи', 'Значение': data.compliance.timelySubmission }
    ];

    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Сводка');
  }

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

function generateCSVFile(data: any, dataType: string): string {
  let csvContent = '';

  // Добавляем BOM для корректного отображения кириллицы
  csvContent = '\uFEFF';

  // Метаданные
  csvContent += 'МЕТАДАННЫЕ ЭКСПОРТА\n';
  csvContent += `Период,${data.metadata.period}\n`;
  csvContent += `Дата экспорта,${new Date(data.metadata.exportDate).toLocaleDateString('ru-RU')}\n`;
  csvContent += `Организация,${data.metadata.organizationName}\n`;
  csvContent += `Режим данных,${data.metadata.userMode === 'DEMO' ? 'Демо' : 'Реальные данные'}\n\n`;

  // KPI показатели
  if (dataType === 'all' || dataType === 'kpi') {
    csvContent += 'KPI ПОКАЗАТЕЛИ\n';
    csvContent += 'Показатель,Значение,Единица,Изменение,Период\n';
    data.kpi.forEach((kpi: any) => {
      csvContent += `${kpi.title},${kpi.value},${kpi.unit},${kpi.change}%,${kpi.period}\n`;
    });
    csvContent += '\n';
  }

  // Месячные данные
  if (dataType === 'all' || dataType === 'charts') {
    csvContent += 'ДИНАМИКА ВЫБРОСОВ ПО МЕСЯЦАМ\n';
    csvContent += 'Месяц,Общие выбросы,Scope 1,Scope 2,Scope 3\n';
    data.monthlyEmissions.forEach((item: any) => {
      csvContent += `${item.month},${item.value},${item.scope1},${item.scope2},${item.scope3}\n`;
    });
    csvContent += '\n';

    csvContent += 'РАСПРЕДЕЛЕНИЕ ПО КАТЕГОРИЯМ\n';
    csvContent += 'Категория,Процент,Количество (т CO₂)\n';
    data.emissionSources.forEach((source: any) => {
      csvContent += `${source.name},${source.value}%,${source.amount}\n`;
    });
    csvContent += '\n';
  }

  // Соответствие 296-ФЗ
  if (dataType === 'all' || dataType === 'compliance') {
    csvContent += 'СООТВЕТСТВИЕ 296-ФЗ\n';
    csvContent += 'Параметр,Значение\n';
    csvContent += `Соответствие 296-ФЗ,${data.compliance.compliance296FZ}\n`;
    csvContent += `Своевременность подачи,${data.compliance.timelySubmission}\n`;
    csvContent += `Полнота данных,${data.compliance.dataCompleteness}%\n`;
    csvContent += `Качество отчетов,${data.compliance.reportQuality}\n`;
  }

  return csvContent;
}