import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getUserMode } from '@/lib/user-mode-utils';

/**
 * GET /api/settings/notifications
 * Получение настроек уведомлений пользователя
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

    // В DEMO режиме возвращаем дефолтные настройки (не сохраняем в БД)
    if (userMode === 'DEMO') {
      return NextResponse.json({
        emailEnabled: true,
        pushEnabled: false,
        reportsEnabled: true,
        deadlinesEnabled: true,
        documentsEnabled: false,
        deadlineDays: [30, 7, 1],
        quietHoursStart: null,
        quietHoursEnd: null,
        timezone: 'Europe/Moscow'
      });
    }

    // PAID режим: получаем настройки из БД или создаем дефолтные
    let preferences = await prisma.notificationPreferences.findUnique({
      where: { userId }
    });

    // Если настроек нет, создаем дефолтные
    if (!preferences) {
      preferences = await prisma.notificationPreferences.create({
        data: {
          userId,
          emailEnabled: true,
          pushEnabled: false,
          reportsEnabled: true,
          deadlinesEnabled: true,
          documentsEnabled: false,
          deadlineDays: [30, 7, 1],
          timezone: 'Europe/Moscow'
        }
      });
    }

    return NextResponse.json({
      emailEnabled: preferences.emailEnabled,
      pushEnabled: preferences.pushEnabled,
      reportsEnabled: preferences.reportsEnabled,
      deadlinesEnabled: preferences.deadlinesEnabled,
      documentsEnabled: preferences.documentsEnabled,
      deadlineDays: preferences.deadlineDays,
      quietHoursStart: preferences.quietHoursStart,
      quietHoursEnd: preferences.quietHoursEnd,
      timezone: preferences.timezone
    });

  } catch (error) {
    console.error('Ошибка при получении настроек уведомлений:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings/notifications
 * Обновление настроек уведомлений пользователя
 */
export async function PUT(request: NextRequest) {
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

    // В DEMO режиме просто возвращаем обновленные данные без сохранения
    const body = await request.json();

    // Валидация входных данных
    const {
      emailEnabled,
      pushEnabled,
      reportsEnabled,
      deadlinesEnabled,
      documentsEnabled,
      deadlineDays,
      quietHoursStart,
      quietHoursEnd,
      timezone
    } = body;

    // Валидация типов
    if (typeof emailEnabled !== 'boolean' || typeof pushEnabled !== 'boolean') {
      return NextResponse.json(
        { error: 'Неверный формат данных для каналов доставки' },
        { status: 400 }
      );
    }

    if (typeof reportsEnabled !== 'boolean' ||
        typeof deadlinesEnabled !== 'boolean' ||
        typeof documentsEnabled !== 'boolean') {
      return NextResponse.json(
        { error: 'Неверный формат данных для типов уведомлений' },
        { status: 400 }
      );
    }

    // Валидация deadlineDays
    if (deadlineDays && (!Array.isArray(deadlineDays) || !deadlineDays.every((d: any) => typeof d === 'number' && d > 0))) {
      return NextResponse.json(
        { error: 'Неверный формат данных для дней дедлайнов' },
        { status: 400 }
      );
    }

    // Валидация тихих часов
    if (quietHoursStart !== null && quietHoursStart !== undefined && (quietHoursStart < 0 || quietHoursStart > 23)) {
      return NextResponse.json(
        { error: 'Начало тихих часов должно быть от 0 до 23' },
        { status: 400 }
      );
    }

    if (quietHoursEnd !== null && quietHoursEnd !== undefined && (quietHoursEnd < 0 || quietHoursEnd > 23)) {
      return NextResponse.json(
        { error: 'Конец тихих часов должен быть от 0 до 23' },
        { status: 400 }
      );
    }

    if (userMode === 'DEMO') {
      // В DEMO режиме просто возвращаем данные
      return NextResponse.json({
        success: true,
        message: 'Настройки сохранены (демо-режим)',
        preferences: {
          emailEnabled,
          pushEnabled,
          reportsEnabled,
          deadlinesEnabled,
          documentsEnabled,
          deadlineDays: deadlineDays || [30, 7, 1],
          quietHoursStart: quietHoursStart || null,
          quietHoursEnd: quietHoursEnd || null,
          timezone: timezone || 'Europe/Moscow'
        }
      });
    }

    // PAID режим: сохраняем в БД
    const preferences = await prisma.notificationPreferences.upsert({
      where: { userId },
      create: {
        userId,
        emailEnabled,
        pushEnabled,
        reportsEnabled,
        deadlinesEnabled,
        documentsEnabled,
        deadlineDays: deadlineDays || [30, 7, 1],
        quietHoursStart: quietHoursStart || null,
        quietHoursEnd: quietHoursEnd || null,
        timezone: timezone || 'Europe/Moscow'
      },
      update: {
        emailEnabled,
        pushEnabled,
        reportsEnabled,
        deadlinesEnabled,
        documentsEnabled,
        deadlineDays: deadlineDays || [30, 7, 1],
        quietHoursStart: quietHoursStart || null,
        quietHoursEnd: quietHoursEnd || null,
        timezone: timezone || 'Europe/Moscow'
      }
    });

    // Аудит изменений (опционально, можно добавить позже)
    console.log(`[AUDIT] Пользователь ${userId} обновил настройки уведомлений:`, {
      emailEnabled,
      pushEnabled,
      reportsEnabled,
      deadlinesEnabled,
      documentsEnabled
    });

    return NextResponse.json({
      success: true,
      message: 'Настройки успешно сохранены',
      preferences: {
        emailEnabled: preferences.emailEnabled,
        pushEnabled: preferences.pushEnabled,
        reportsEnabled: preferences.reportsEnabled,
        deadlinesEnabled: preferences.deadlinesEnabled,
        documentsEnabled: preferences.documentsEnabled,
        deadlineDays: preferences.deadlineDays,
        quietHoursStart: preferences.quietHoursStart,
        quietHoursEnd: preferences.quietHoursEnd,
        timezone: preferences.timezone
      }
    });

  } catch (error) {
    console.error('Ошибка при обновлении настроек уведомлений:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}