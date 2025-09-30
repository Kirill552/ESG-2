/**
 * Утилиты для работы с режимами пользователей
 */

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { UserMode } from "@prisma/client";
import { getDemoData } from "./demo-data-seeder";

export async function getCurrentUserMode(): Promise<UserMode | null> {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { mode: true }
    });

    return user?.mode || null;
  } catch (error) {
    console.error('Error getting user mode:', error);
    return null;
  }
}

export async function isUserInDemoMode(): Promise<boolean> {
  const mode = await getCurrentUserMode();
  return mode === 'DEMO';
}

export async function getUserDataByMode<T>(
  demoDataType: 'stats' | 'documents' | 'reports' | 'reports_stats' | 'analytics' | 'settings',
  realDataFetcher: () => Promise<T>
): Promise<T | any> {
  const isDemo = await isUserInDemoMode();

  if (isDemo) {
    return getDemoData(demoDataType);
  }

  return await realDataFetcher();
}

/**
 * Хук для получения данных с учетом режима пользователя
 */
export function createModeAwareDataFetcher<T>(
  demoDataType: 'stats' | 'documents' | 'reports' | 'reports_stats' | 'analytics' | 'settings'
) {
  return async (realDataFetcher: () => Promise<T>): Promise<T | any> => {
    return getUserDataByMode(demoDataType, realDataFetcher);
  };
}

/**
 * Проверяет, доступна ли функция для текущего режима пользователя
 */
export async function isFeatureAvailable(feature: 'upload' | 'generate_reports' | 'analytics' | 'export'): Promise<boolean> {
  const mode = await getCurrentUserMode();

  switch (mode) {
    case 'DEMO':
      // В демо-режиме доступны только Passkey и "Получить доступ"
      return false;

    case 'TRIAL':
      // В пробном режиме ограниченный функционал
      return ['upload', 'generate_reports'].includes(feature);

    case 'PAID':
      // В полном режиме все функции доступны
      return true;

    case 'EXPIRED':
      // У истекших пользователей нет доступа
      return false;

    default:
      return false;
  }
}

/**
 * Получает режим пользователя по ID
 */
export async function getUserMode(userId: string): Promise<UserMode> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { mode: true }
    });

    return user?.mode || 'DEMO';
  } catch (error) {
    console.error('Error getting user mode by ID:', error);
    return 'DEMO';
  }
}

/**
 * Возвращает лимиты для текущего режима пользователя
 */
export async function getUserLimits(): Promise<{
  documentsPerMonth: number;
  reportsPerMonth: number;
  analyticsAccess: boolean;
  exportAccess: boolean;
}> {
  const mode = await getCurrentUserMode();

  switch (mode) {
    case 'DEMO':
      return {
        documentsPerMonth: 0,
        reportsPerMonth: 0,
        analyticsAccess: false,
        exportAccess: false
      };

    case 'TRIAL':
      return {
        documentsPerMonth: 10,
        reportsPerMonth: 3,
        analyticsAccess: true,
        exportAccess: false
      };

    case 'PAID':
      return {
        documentsPerMonth: -1, // Без ограничений
        reportsPerMonth: -1,   // Без ограничений
        analyticsAccess: true,
        exportAccess: true
      };

    case 'EXPIRED':
      return {
        documentsPerMonth: 0,
        reportsPerMonth: 0,
        analyticsAccess: false,
        exportAccess: false
      };

    default:
      return {
        documentsPerMonth: 0,
        reportsPerMonth: 0,
        analyticsAccess: false,
        exportAccess: false
      };
  }
}