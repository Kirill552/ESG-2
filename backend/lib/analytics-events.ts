/**
 * Система событий для аналитики
 * Трекинг действий пользователей и системных событий для аналитики
 */

import { prisma } from '@/lib/prisma';

export enum AnalyticsEventType {
  // Документы
  DOCUMENT_UPLOADED = 'document_uploaded',
  DOCUMENT_PROCESSED = 'document_processed',
  DOCUMENT_FAILED = 'document_failed',
  DOCUMENT_DELETED = 'document_deleted',

  // Отчеты
  REPORT_CREATED = 'report_created',
  REPORT_GENERATED = 'report_generated',
  REPORT_DOWNLOADED = 'report_downloaded',
  REPORT_DELETED = 'report_deleted',

  // Выбросы
  EMISSIONS_CALCULATED = 'emissions_calculated',
  EMISSIONS_UPDATED = 'emissions_updated',

  // Пользователь
  USER_LOGIN = 'user_login',
  USER_LOGOUT = 'user_logout',
  USER_MODE_CHANGED = 'user_mode_changed',

  // Система
  SYSTEM_ERROR = 'system_error',
  SYSTEM_WARNING = 'system_warning',

  // Компліанс
  COMPLIANCE_CHECK = 'compliance_check',
  DEADLINE_WARNING = 'deadline_warning'
}

interface AnalyticsEventData {
  eventType: AnalyticsEventType;
  organizationId: string;
  userId?: string;
  eventData: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * Основная функция для записи событий аналитики
 */
export async function trackAnalyticsEvent({
  eventType,
  organizationId,
  userId,
  eventData,
  metadata = {}
}: AnalyticsEventData): Promise<void> {
  try {
    await prisma.analyticsEvent.create({
      data: {
        organizationId,
        eventType,
        eventData,
        userId,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
          userAgent: metadata.userAgent,
          ipAddress: metadata.ipAddress
        }
      }
    });
  } catch (error) {
    // Логируем ошибку, но не прерываем основной процесс
    console.error('Ошибка записи события аналитики:', error);
  }
}

/**
 * События документов
 */
export const DocumentEvents = {
  uploaded: async (organizationId: string, userId: string, documentData: any) => {
    await trackAnalyticsEvent({
      eventType: AnalyticsEventType.DOCUMENT_UPLOADED,
      organizationId,
      userId,
      eventData: {
        documentId: documentData.id,
        filename: documentData.filename,
        fileSize: documentData.fileSize,
        mimeType: documentData.mimeType
      }
    });
  },

  processed: async (organizationId: string, userId: string, documentData: any) => {
    await trackAnalyticsEvent({
      eventType: AnalyticsEventType.DOCUMENT_PROCESSED,
      organizationId,
      userId,
      eventData: {
        documentId: documentData.id,
        filename: documentData.filename,
        processingTime: documentData.processingTime,
        extractedData: documentData.extractedData
      }
    });
  },

  failed: async (organizationId: string, userId: string, documentData: any, error: string) => {
    await trackAnalyticsEvent({
      eventType: AnalyticsEventType.DOCUMENT_FAILED,
      organizationId,
      userId,
      eventData: {
        documentId: documentData.id,
        filename: documentData.filename,
        error,
        errorType: 'processing_failed'
      }
    });
  }
};

/**
 * События отчетов
 */
export const ReportEvents = {
  created: async (organizationId: string, userId: string, reportData: any) => {
    await trackAnalyticsEvent({
      eventType: AnalyticsEventType.REPORT_CREATED,
      organizationId,
      userId,
      eventData: {
        reportId: reportData.id,
        reportName: reportData.name,
        period: reportData.period,
        type: reportData.type
      }
    });
  },

  generated: async (organizationId: string, userId: string, reportData: any) => {
    await trackAnalyticsEvent({
      eventType: AnalyticsEventType.REPORT_GENERATED,
      organizationId,
      userId,
      eventData: {
        reportId: reportData.id,
        reportName: reportData.name,
        totalEmissions: reportData.totalEmissions,
        generationTime: reportData.generationTime,
        documentCount: reportData.documentCount
      }
    });
  },

  downloaded: async (organizationId: string, userId: string, reportData: any) => {
    await trackAnalyticsEvent({
      eventType: AnalyticsEventType.REPORT_DOWNLOADED,
      organizationId,
      userId,
      eventData: {
        reportId: reportData.id,
        reportName: reportData.name,
        format: reportData.format || 'pdf'
      }
    });
  }
};

/**
 * События выбросов
 */
export const EmissionEvents = {
  calculated: async (organizationId: string, userId: string, emissionData: any) => {
    await trackAnalyticsEvent({
      eventType: AnalyticsEventType.EMISSIONS_CALCULATED,
      organizationId,
      userId,
      eventData: {
        totalEmissions: emissionData.total,
        scope1: emissionData.scope1,
        scope2: emissionData.scope2,
        scope3: emissionData.scope3,
        calculationMethod: emissionData.method,
        documentIds: emissionData.documentIds
      }
    });
  }
};

/**
 * События пользователя
 */
export const UserEvents = {
  login: async (organizationId: string, userId: string, loginData: any) => {
    await trackAnalyticsEvent({
      eventType: AnalyticsEventType.USER_LOGIN,
      organizationId,
      userId,
      eventData: {
        loginMethod: loginData.method, // vk-id, magic-link, passkey
        deviceType: loginData.deviceType
      },
      metadata: {
        userAgent: loginData.userAgent,
        ipAddress: loginData.ipAddress
      }
    });
  },

  modeChanged: async (organizationId: string, userId: string, modeData: any) => {
    await trackAnalyticsEvent({
      eventType: AnalyticsEventType.USER_MODE_CHANGED,
      organizationId,
      userId,
      eventData: {
        previousMode: modeData.previousMode,
        newMode: modeData.newMode,
        reason: modeData.reason
      }
    });
  }
};

/**
 * Получение статистики событий для аналитики
 */
export async function getEventStatistics(
  organizationId: string,
  period: string = new Date().getFullYear().toString()
): Promise<any> {

  const startDate = new Date(`${period}-01-01`);
  const endDate = new Date(`${period}-12-31T23:59:59`);

  // Общее количество событий по типам
  const eventsByType = await prisma.analyticsEvent.groupBy({
    by: ['eventType'],
    where: {
      organizationId,
      timestamp: {
        gte: startDate,
        lte: endDate
      }
    },
    _count: {
      id: true
    }
  });

  // События по месяцам
  const eventsByMonth = await prisma.$queryRaw`
    SELECT
      DATE_TRUNC('month', timestamp) as month,
      event_type,
      COUNT(*) as count
    FROM analytics_events
    WHERE organization_id = ${organizationId}
      AND timestamp >= ${startDate}
      AND timestamp <= ${endDate}
    GROUP BY DATE_TRUNC('month', timestamp), event_type
    ORDER BY month
  `;

  // Самые активные пользователи
  const topUsers = await prisma.analyticsEvent.groupBy({
    by: ['userId'],
    where: {
      organizationId,
      timestamp: {
        gte: startDate,
        lte: endDate
      },
      userId: {
        not: null
      }
    },
    _count: {
      id: true
    },
    orderBy: {
      _count: {
        id: 'desc'
      }
    },
    take: 10
  });

  return {
    eventsByType: eventsByType.map(e => ({
      eventType: e.eventType,
      count: e._count.id
    })),
    eventsByMonth,
    topUsers: topUsers.map(u => ({
      userId: u.userId,
      eventCount: u._count.id
    })),
    totalEvents: eventsByType.reduce((sum, e) => sum + e._count.id, 0)
  };
}

/**
 * Получение последних событий для дашборда
 */
export async function getRecentEvents(
  organizationId: string,
  limit: number = 10
): Promise<any[]> {

  const events = await prisma.analyticsEvent.findMany({
    where: { organizationId },
    orderBy: { timestamp: 'desc' },
    take: limit,
    select: {
      id: true,
      eventType: true,
      eventData: true,
      timestamp: true,
      userId: true
    }
  });

  return events.map(event => ({
    id: event.id,
    type: event.eventType,
    description: formatEventDescription(event.eventType, event.eventData),
    timestamp: event.timestamp,
    userId: event.userId
  }));
}

/**
 * Форматирование описания события для отображения
 */
function formatEventDescription(eventType: string, eventData: any): string {
  switch (eventType) {
    case AnalyticsEventType.DOCUMENT_UPLOADED:
      return `Загружен документ: ${eventData.filename}`;

    case AnalyticsEventType.DOCUMENT_PROCESSED:
      return `Обработан документ: ${eventData.filename}`;

    case AnalyticsEventType.REPORT_CREATED:
      return `Создан отчет: ${eventData.reportName}`;

    case AnalyticsEventType.REPORT_GENERATED:
      return `Сгенерирован отчет: ${eventData.reportName}`;

    case AnalyticsEventType.EMISSIONS_CALCULATED:
      return `Рассчитаны выбросы: ${eventData.totalEmissions} т CO₂`;

    case AnalyticsEventType.USER_LOGIN:
      return `Вход пользователя через ${eventData.loginMethod}`;

    default:
      return `Событие: ${eventType}`;
  }
}

/**
 * Очистка старых событий (для поддержания производительности)
 */
export async function cleanupOldEvents(daysToKeep: number = 365): Promise<void> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  try {
    const result = await prisma.analyticsEvent.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate
        }
      }
    });

    console.log(`🧹 Удалено ${result.count} старых событий аналитики`);
  } catch (error) {
    console.error('Ошибка очистки событий аналитики:', error);
  }
}