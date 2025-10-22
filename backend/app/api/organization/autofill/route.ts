/**
 * API endpoint для автозаполнения реквизитов организации
 * POST /api/organization/autofill
 *
 * Приоритет источников:
 * 1. Dadata MCP API (БЕСПЛАТНО!)
 * 2. Checko API (fallback, если Dadata не работает)
 *
 * Body: { inn: string }
 * Response: Заполненные данные организации из ЕГРЮЛ/ЕГРИП
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { dadataMcpClient } from '@/lib/dadata-mcp-client';
import { checkoService } from '@/lib/checko-service';
import { Logger } from '@/lib/logger';

const logger = new Logger('autofill-api');

export async function POST(req: NextRequest) {
  try {
    // Проверка авторизации
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Необходима авторизация' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Парсинг тела запроса
    const body = await req.json();
    const { inn } = body;

    if (!inn || typeof inn !== 'string') {
      return NextResponse.json(
        { error: 'ИНН обязателен для заполнения' },
        { status: 400 }
      );
    }

    logger.info('Запрос автозаполнения организации', {
      userId,
      inn,
    });

    // Приоритет: Dadata MCP → Checko API (fallback)
    let companyData;
    let dataSource = 'unknown';

    try {
      // Попытка получить данные из Dadata MCP (бесплатно)
      companyData = await dadataMcpClient.getCompanyByInn(inn);
      dataSource = 'Dadata MCP';
      logger.info('✅ Данные получены из Dadata MCP', {
        userId,
        inn,
        companyName: companyData.shortName,
      });
    } catch (dadataError) {
      // Fallback на Checko API
      logger.warn('⚠️ Dadata MCP не работает, переключаемся на Checko API', {
        userId,
        inn,
        error: dadataError instanceof Error ? dadataError.message : String(dadataError),
      });

      try {
        companyData = await checkoService.getCompanyByInn(inn);
        dataSource = 'Checko API';
        logger.info('✅ Данные получены из Checko API (fallback)', {
          userId,
          inn,
          companyName: companyData?.shortName,
        });
      } catch (checkoError) {
        logger.error('❌ Оба сервиса недоступны', {
          userId,
          inn,
          dadataError: dadataError instanceof Error ? dadataError.message : String(dadataError),
          checkoError: checkoError instanceof Error ? checkoError.message : String(checkoError),
        });

        return NextResponse.json(
          { error: 'Не удалось получить данные организации. Попробуйте позже.' },
          { status: 503 }
        );
      }
    }

    if (!companyData) {
      return NextResponse.json(
        { error: 'Организация не найдена в ЕГРЮЛ/ЕГРИП' },
        { status: 404 }
      );
    }

    // Проверка: организация должна быть активной
    if (companyData.status && companyData.status !== 'Действует') {
      logger.warn('Попытка добавить неактивную организацию', {
        userId,
        inn,
        status: companyData.status,
      });

      return NextResponse.json(
        {
          error: `Организация имеет статус: ${companyData.status}`,
          status: companyData.status,
        },
        { status: 400 }
      );
    }

    // Поиск существующей организации пользователя
    let organization = await prisma.organization.findUnique({
      where: { userId },
      include: { profile: true },
    });

    // Если у пользователя еще нет организации, создаем
    if (!organization) {
      organization = await prisma.organization.create({
        data: {
          userId,
          name: companyData.shortName || companyData.fullName || '',
          inn: companyData.inn,
          address: companyData.address,
          email: session.user.email || undefined,
          phone: companyData.phone,
        },
        include: { profile: true },
      });

      logger.info(`Создана организация через ${dataSource}`, {
        userId,
        organizationId: organization.id,
        inn: companyData.inn,
      });
    }

    // Обновление или создание профиля организации
    const profileData = {
      fullName: companyData.fullName || null,
      shortName: companyData.shortName || null,
      inn: companyData.inn,
      kpp: companyData.kpp || null,
      ogrn: companyData.ogrn || null,
      okpo: companyData.okpo || null, // ✅ Добавлено для 296-ФЗ
      oktmo: companyData.oktmo || null, // ✅ Добавлено для 296-ФЗ
      okato: companyData.okato || null, // ✅ Добавлено для 296-ФЗ
      okved: companyData.okvedCode || null,
      legalAddress: companyData.address || null,
      phone: companyData.phone || null,
      emailForBilling: companyData.email || null,
      // Данные руководителя
      directorName: companyData.director || null,
      directorPosition: companyData.directorPosition || null,
      // Статус
      companyStatus: companyData.status === 'Действует' ? 'ACTIVE' : 'UNKNOWN',
      status: 'VERIFIED' as const,
    };

    let profile;
    if (organization.profile) {
      // Обновление существующего профиля
      profile = await prisma.organizationProfile.update({
        where: { id: organization.profile.id },
        data: profileData,
      });

      logger.info(`Обновлен профиль организации из ${dataSource}`, {
        userId,
        organizationId: organization.id,
        profileId: profile.id,
      });
    } else {
      // Создание нового профиля
      profile = await prisma.organizationProfile.create({
        data: {
          ...profileData,
          organizationId: organization.id,
        },
      });

      logger.info(`Создан профиль организации из ${dataSource}`, {
        userId,
        organizationId: organization.id,
        profileId: profile.id,
      });
    }

    // Возврат результата
    return NextResponse.json({
      success: true,
      dataSource, // Указываем источник данных (Dadata MCP или Checko API)
      data: {
        name: companyData.shortName || companyData.fullName,
        fullName: companyData.fullName, // Полное наименование для 296-ФЗ
        inn: companyData.inn,
        kpp: companyData.kpp,
        ogrn: companyData.ogrn,
        address: companyData.address,
        okvedCode: companyData.okved,
        okvedName: companyData.okvedName,
        director: companyData.director,
        directorPosition: companyData.directorPosition,
        phone: companyData.phone,
        email: companyData.email,
        website: companyData.website,
        status: companyData.status,
        // Дополнительные поля из Dadata
        okpo: companyData.okpo,
        oktmo: companyData.oktmo,
        okato: companyData.okato,
      },
    });
  } catch (error) {
    logger.error('Ошибка при автозаполнении организации', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    if (error instanceof Error) {
      if (error.message.includes('Checko')) {
        return NextResponse.json(
          { error: 'Ошибка при обращении к сервису проверки ИНН' },
          { status: 503 }
        );
      }
      if (error.message.includes('ИНН')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}
