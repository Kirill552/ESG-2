/**
 * Система контроля доступа для пользователей
 * Проверяет флаги доступа, лимиты и сроки действия
 */

import { prisma } from '@/lib/prisma';
import type { UserMode } from '@prisma/client';

export interface AccessCheck {
  allowed: boolean;
  reason?: string;
  limit?: number;
  current?: number;
}

/**
 * Проверка доступа к функции
 */
export async function checkFeatureAccess(
  userId: string,
  feature: 'upload' | 'ocr' | '296fz' | 'cbam' | 'export' | 'analytics'
): Promise<AccessCheck> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        organization: true,
      },
    });

    if (!user) {
      return { allowed: false, reason: 'Пользователь не найден' };
    }

    // Проверка блокировки пользователя
    if (user.isBlocked) {
      return { allowed: false, reason: 'Ваш аккаунт заблокирован' };
    }

    // Проверка режима DEMO
    if (user.mode === 'DEMO') {
      return { allowed: false, reason: 'Демо-режим. Функция недоступна. Оформите заявку на доступ.' };
    }

    // Проверка срока действия
    if (user.planExpiry && new Date(user.planExpiry) < new Date()) {
      return { allowed: false, reason: 'Срок действия вашего плана истек. Обратитесь к администратору.' };
    }

    const org = user.organization;

    // Если нет организации, разрешаем (для legacy пользователей)
    if (!org) {
      return { allowed: true };
    }

    // Проверка блокировки организации
    if (org.isBlocked) {
      return { allowed: false, reason: 'Ваша организация заблокирована. Обратитесь к администратору.' };
    }

    // Проверка срока доступа организации
    if (org.accessExpiresAt && new Date(org.accessExpiresAt) < new Date()) {
      return { allowed: false, reason: 'Срок доступа вашей организации истек. Обратитесь к администратору.' };
    }

    // Проверка флагов доступа к функциям
    const featureFlags: Record<typeof feature, boolean> = {
      upload: org.canUploadDocuments,
      ocr: org.canUseOCR,
      '296fz': org.canGenerate296FZ,
      cbam: org.canGenerateCBAM,
      export: org.canExportData,
      analytics: org.canUseAnalytics,
    };

    if (!featureFlags[feature]) {
      const featureNames: Record<typeof feature, string> = {
        upload: 'загрузка документов',
        ocr: 'OCR обработка',
        '296fz': 'генерация отчетов 296-ФЗ',
        cbam: 'генерация CBAM отчетов',
        export: 'экспорт данных',
        analytics: 'аналитика',
      };
      return { allowed: false, reason: `Функция "${featureNames[feature]}" недоступна для вашей организации.` };
    }

    return { allowed: true };
  } catch (error) {
    console.error('[Access Control] Error checking feature access:', error);
    return { allowed: false, reason: 'Ошибка проверки доступа' };
  }
}

/**
 * Проверка лимита использования
 */
export async function checkUsageLimit(
  userId: string,
  limitType: 'documents' | 'reports' | 'ocrPages' | 'storage' | 'users'
): Promise<AccessCheck> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        organization: true,
      },
    });

    if (!user || !user.organization) {
      return { allowed: true }; // Нет ограничений для пользователей без организации
    }

    const org = user.organization;

    // Получаем лимит из организации
    const limits: Record<typeof limitType, number> = {
      documents: org.documentsPerMonth,
      reports: org.reportsPerMonth,
      ocrPages: org.ocrPagesPerMonth,
      storage: org.storageQuotaMB,
      users: org.usersPerOrg,
    };

    const limit = limits[limitType];

    // 0 означает без ограничений
    if (limit === 0) {
      return { allowed: true };
    }

    // Получаем текущее использование за текущий месяц
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    let currentUsage = 0;

    switch (limitType) {
      case 'documents':
        currentUsage = await prisma.document.count({
          where: {
            userId,
            createdAt: { gte: startOfMonth },
          },
        });
        break;

      case 'reports':
        currentUsage = await prisma.report.count({
          where: {
            userId,
            createdAt: { gte: startOfMonth },
          },
        });
        break;

      case 'ocrPages':
        // TODO: подсчет страниц из метаданных документов
        currentUsage = 0;
        break;

      case 'storage':
        // TODO: подсчет размера файлов из S3
        currentUsage = 0;
        break;

      case 'users':
        currentUsage = await prisma.organizationUser.count({
          where: {
            organizationId: org.id,
          },
        });
        break;
    }

    if (currentUsage >= limit) {
      const limitNames: Record<typeof limitType, string> = {
        documents: 'документов в месяц',
        reports: 'отчетов в месяц',
        ocrPages: 'страниц OCR в месяц',
        storage: 'места на диске (МБ)',
        users: 'пользователей в организации',
      };

      return {
        allowed: false,
        reason: `Превышен лимит ${limitNames[limitType]}: ${currentUsage}/${limit}`,
        limit,
        current: currentUsage,
      };
    }

    return { allowed: true, limit, current: currentUsage };
  } catch (error) {
    console.error('[Access Control] Error checking usage limit:', error);
    return { allowed: false, reason: 'Ошибка проверки лимита' };
  }
}

/**
 * Получить информацию о всех доступах пользователя
 */
export async function getUserAccessInfo(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        organization: true,
      },
    });

    if (!user) {
      throw new Error('Пользователь не найден');
    }

    const org = user.organization;

    // Базовая информация
    const info = {
      userId: user.id,
      email: user.email,
      mode: user.mode,
      isBlocked: user.isBlocked,
      planExpiry: user.planExpiry,
      organization: org
        ? {
            id: org.id,
            name: org.name,
            isBlocked: org.isBlocked,
            accessExpiresAt: org.accessExpiresAt,
            features: {
              canUploadDocuments: org.canUploadDocuments,
              canUseOCR: org.canUseOCR,
              canGenerate296FZ: org.canGenerate296FZ,
              canGenerateCBAM: org.canGenerateCBAM,
              canExportData: org.canExportData,
              canUseAnalytics: org.canUseAnalytics,
            },
            limits: {
              documentsPerMonth: org.documentsPerMonth,
              reportsPerMonth: org.reportsPerMonth,
              ocrPagesPerMonth: org.ocrPagesPerMonth,
              storageQuotaMB: org.storageQuotaMB,
              usersPerOrg: org.usersPerOrg,
            },
          }
        : null,
    };

    // Получаем текущее использование
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const usage = {
      documentsThisMonth: await prisma.document.count({
        where: { userId, createdAt: { gte: startOfMonth } },
      }),
      reportsThisMonth: await prisma.report.count({
        where: { userId, createdAt: { gte: startOfMonth } },
      }),
    };

    return { ...info, usage };
  } catch (error) {
    console.error('[Access Control] Error getting user access info:', error);
    throw error;
  }
}
