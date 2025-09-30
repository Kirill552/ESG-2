import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { DEMO_STATS, DEMO_DOCUMENTS, DEMO_REPORTS } from '@/lib/demo-data-seeder';
import { getUserMode } from '@/lib/user-mode-utils';

/**
 * GET /api/dashboard
 * Возвращает данные для главного дашборда:
 * - KPI карточки (общие выбросы, документы, отчеты, экономия времени)
 * - Последние документы (4 элемента)
 * - Отчеты (3 элемента)
 * - Прогресс отчетности 296-ФЗ (3 прогресс-бара)
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
      // Демо-режим: возвращаем моковые данные
      return NextResponse.json({
        kpiCards: DEMO_STATS,
        recentDocuments: DEMO_DOCUMENTS.slice(0, 4).map(doc => ({
          id: doc.id,
          name: doc.name,
          date: doc.date,
          status: doc.status,
          type: doc.type
        })),
        recentReports: DEMO_REPORTS.slice(0, 3).map(report => ({
          id: report.id,
          name: report.name,
          status: report.status,
          createdDate: report.createdDate,
          period: report.period
        })),
        progress296FZ: {
          dataCollection: {
            label: 'Сбор данных',
            percentage: 85,
            color: 'green'
          },
          documentProcessing: {
            label: 'Обработка документов',
            percentage: 72,
            color: 'blue'
          },
          reportGeneration: {
            label: 'Создание отчетов',
            percentage: 45,
            color: 'orange'
          }
        }
      });
    }

    // PAID режим: реальные данные из БД
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        organization: true,
        documents: {
          orderBy: { createdAt: 'desc' },
          take: 4,
          select: {
            id: true,
            fileName: true,
            createdAt: true,
            status: true,
            fileSize: true,
            fileType: true
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

    // Организация опциональна - API работает с данными пользователя или без организации

    // Получаем отчеты пользователя
    const reports = await prisma.report.findMany({
      where: { userId },
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

    // Подсчитываем статистики
    const totalDocuments = await prisma.document.count({
      where: { userId }
    });

    const processedDocuments = await prisma.document.count({
      where: {
        userId,
        status: 'PROCESSED'
      }
    });

    const totalReports = await prisma.report.count({
      where: { userId }
    });

    const readyReports = await prisma.report.count({
      where: {
        userId,
        status: 'READY'
      }
    });

    // Получаем данные по выбросам из последнего готового отчета
    const latestReport = await prisma.report.findFirst({
      where: {
        userId,
        status: 'READY'
      },
      orderBy: { createdAt: 'desc' }
    });

    // Расчет экономии времени (примерная формула)
    const timesSaved = Math.round(totalReports * 6.8 + processedDocuments * 1.2);

    // KPI карточки с реальными данными
    const kpiCards = [
      {
        title: 'Общие выбросы',
        value: latestReport?.totalEmissions || 0,
        unit: 'т CO₂-экв',
        change: 0, // TODO: расчет изменений к предыдущему периоду
        period: 'к прошлому году',
        icon: 'Leaf',
        color: 'green',
        metric: 'co2' as const
      },
      {
        title: 'Документов загружено',
        value: totalDocuments,
        unit: 'файлов',
        change: 0, // TODO: расчет роста
        period: 'за месяц',
        icon: 'FileText',
        color: 'blue'
      },
      {
        title: 'Готовых отчетов',
        value: readyReports,
        unit: 'отчета',
        change: 0, // TODO: расчет роста
        period: 'за квартал',
        icon: 'FileCheck',
        color: 'purple'
      },
      {
        title: 'Экономия времени',
        value: timesSaved,
        unit: 'часов',
        change: 0, // TODO: расчет роста
        period: 'за год',
        icon: 'Zap',
        color: 'orange'
      }
    ];

    // Расчет прогресса 296-ФЗ
    const dataCollectionProgress = Math.min(95, (processedDocuments / Math.max(1, totalDocuments)) * 100);
    const documentProcessingProgress = Math.min(95, (processedDocuments / Math.max(1, totalDocuments)) * 100);
    const reportGenerationProgress = Math.min(95, (readyReports / Math.max(1, totalReports)) * 100);

    return NextResponse.json({
      kpiCards,
      recentDocuments: user.documents.map(doc => ({
        id: doc.id,
        name: doc.fileName,
        date: formatRelativeTime(doc.createdAt),
        status: doc.status.toLowerCase(),
        type: getFileType(doc.fileType),
        size: formatFileSize(doc.fileSize)
      })),
      recentReports: reports.map(report => ({
        id: report.id,
        name: report.name,
        status: report.status.toLowerCase(),
        createdDate: formatDate(report.createdAt),
        period: report.period
      })),
      progress296FZ: {
        dataCollection: {
          label: 'Сбор данных',
          percentage: Math.round(dataCollectionProgress),
          color: dataCollectionProgress > 80 ? 'green' : dataCollectionProgress > 50 ? 'blue' : 'orange'
        },
        documentProcessing: {
          label: 'Обработка документов',
          percentage: Math.round(documentProcessingProgress),
          color: documentProcessingProgress > 80 ? 'green' : documentProcessingProgress > 50 ? 'blue' : 'orange'
        },
        reportGeneration: {
          label: 'Создание отчетов',
          percentage: Math.round(reportGenerationProgress),
          color: reportGenerationProgress > 80 ? 'green' : reportGenerationProgress > 50 ? 'blue' : 'orange'
        }
      }
    });

  } catch (error) {
    console.error('Ошибка при получении данных дашборда:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}

// Утилиты форматирования
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return 'Только что';
  if (diffHours < 24) return `${diffHours} ${getHoursWord(diffHours)} назад`;
  if (diffDays === 1) return '1 день назад';
  if (diffDays < 7) return `${diffDays} ${getDaysWord(diffDays)} назад`;

  return date.toLocaleDateString('ru-RU');
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Б';
  const k = 1024;
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getFileType(fileType: string): string {
  if (fileType.includes('pdf')) return 'pdf';
  if (fileType.includes('excel') || fileType.includes('spreadsheet')) return 'xlsx';
  if (fileType.includes('word') || fileType.includes('document')) return 'docx';
  if (fileType.includes('text/csv')) return 'csv';
  return 'file';
}

function getHoursWord(hours: number): string {
  if (hours === 1 || hours === 21) return 'час';
  if (hours >= 2 && hours <= 4 || hours >= 22 && hours <= 24) return 'часа';
  return 'часов';
}

function getDaysWord(days: number): string {
  if (days === 1) return 'день';
  if (days >= 2 && days <= 4) return 'дня';
  return 'дней';
}