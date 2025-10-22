import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { Logger } from "@/lib/logger";
import { getCurrentUserMode } from "@/lib/user-mode-utils";
import { calculateFuelEmissions } from "@/lib/emission-data-371";

const logger = new Logger("transport-override-api");

/**
 * API для обновления транспортных данных документа с пересчетом выбросов
 * PUT /api/documents/[id]/transport-override
 *
 * Body:
 * {
 *   fuelType: 'diesel' | 'gasoline' | 'gas',
 *   yearOfManufacture?: number,
 *   actualConsumption?: number  // л/100км
 * }
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: documentId } = await params;
  const session = await getServerSession(authOptions);

  try {
    if (!session?.user?.email) {
      return NextResponse.json(
        {
          ok: false,
          message: "Пользователь не авторизован.",
        },
        { status: 401 }
      );
    }

    // Проверяем режим пользователя
    const userMode = await getCurrentUserMode();

    if (userMode === 'DEMO') {
      // В демо-режиме имитируем обновление
      logger.info("Demo transport override simulated", {
        documentId,
        userMode
      });

      return NextResponse.json({
        ok: true,
        message: "Данные обновлены (демо-режим)",
        recalculatedEmissions: 0.36
      });
    }

    // Парсим body
    const body = await req.json();
    const { fuelType, yearOfManufacture, actualConsumption } = body;

    // Валидация
    if (!fuelType || !['diesel', 'gasoline', 'gas'].includes(fuelType)) {
      return NextResponse.json(
        {
          ok: false,
          message: "Неверный тип топлива. Допустимые значения: diesel, gasoline, gas",
        },
        { status: 400 }
      );
    }

    if (yearOfManufacture && (yearOfManufacture < 1990 || yearOfManufacture > new Date().getFullYear() + 1)) {
      return NextResponse.json(
        {
          ok: false,
          message: "Неверный год выпуска",
        },
        { status: 400 }
      );
    }

    if (actualConsumption && (actualConsumption < 0 || actualConsumption > 100)) {
      return NextResponse.json(
        {
          ok: false,
          message: "Неверный расход топлива (должен быть от 0 до 100 л/100км)",
        },
        { status: 400 }
      );
    }

    // Получаем пользователя
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, mode: true }
    });

    if (!user) {
      return NextResponse.json(
        {
          ok: false,
          message: "Пользователь не найден.",
        },
        { status: 404 }
      );
    }

    // Находим документ
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        userId: user.id
      },
      select: {
        id: true,
        category: true,
        ocrData: true,
        fileName: true
      }
    });

    if (!document) {
      return NextResponse.json(
        {
          ok: false,
          message: "Документ не найден.",
        },
        { status: 404 }
      );
    }

    // Проверяем что это транспортный документ
    if (document.category !== 'TRANSPORT') {
      return NextResponse.json(
        {
          ok: false,
          message: "Документ не является транспортным",
        },
        { status: 400 }
      );
    }

    // Получаем текущие OCR данные
    const ocrData = document.ocrData as any || {};

    // Извлекаем данные о транспорте
    const transportData = ocrData.transportData || {};
    const vehicle = transportData.vehicle || {};
    const route = transportData.route || {};
    const distance = route.distance?.distance || 0;

    if (distance <= 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "Невозможно пересчитать выбросы: расстояние не определено",
        },
        { status: 400 }
      );
    }

    // Рассчитываем новый расход топлива
    let fuelConsumption = actualConsumption;

    if (!fuelConsumption) {
      // Используем средние значения из справочника
      const { VEHICLE_CONSUMPTION_ESTIMATES } = await import('@/lib/transport-document-processor');
      const vehicleModel = vehicle.model?.toLowerCase() || '';

      // Простая логика определения расхода
      if (vehicleModel.includes('газель')) {
        fuelConsumption = fuelType === 'diesel' ? 11.5 : 12.5;
      } else if (vehicleModel.includes('камаз') || vehicleModel.includes('мерседес') || vehicleModel.includes('mercedes')) {
        fuelConsumption = fuelType === 'diesel' ? 25 : 28;
      } else {
        // Дефолтные значения
        fuelConsumption = fuelType === 'diesel' ? 20 : 22;
      }
    }

    // Рассчитываем потребление топлива
    const fuelConsumed = (distance / 100) * fuelConsumption;

    // Рассчитываем выбросы
    const emissions = calculateFuelEmissions(fuelType, fuelConsumed);

    // Обновляем ocrData с override данными
    const updatedOcrData = {
      ...ocrData,
      transportData: {
        ...transportData,
        vehicle: {
          ...vehicle,
          fuelType: {
            fuelType,
            confidence: 1.0,
            reasoning: 'Указано пользователем вручную',
            ...(yearOfManufacture && { year: yearOfManufacture })
          }
        },
        userOverride: {
          fuelType,
          yearOfManufacture,
          actualConsumption,
          overriddenAt: new Date().toISOString(),
          overriddenBy: user.id
        },
        emissions: emissions.co2,
        fuelConsumed,
        fuelConsumption
      }
    };

    // Сохраняем в БД
    await prisma.document.update({
      where: { id: document.id },
      data: {
        ocrData: updatedOcrData,
        updatedAt: new Date()
      }
    });

    logger.info("Transport data overridden successfully", {
      documentId,
      userId: user.id,
      fuelType,
      yearOfManufacture,
      actualConsumption,
      recalculatedEmissions: emissions.co2
    });

    return NextResponse.json({
      ok: true,
      message: "Данные успешно обновлены",
      recalculatedEmissions: emissions.co2,
      details: {
        distance,
        fuelConsumption,
        fuelConsumed: Math.round(fuelConsumed * 100) / 100,
        emissions: {
          co2: Math.round(emissions.co2 * 1000) / 1000,
          co2e: Math.round(emissions.co2Equivalent * 1000) / 1000
        }
      }
    });

  } catch (error) {
    logger.error(
      "Failed to override transport data",
      error instanceof Error ? error : undefined,
      {
        documentId: documentId,
        email: session?.user?.email,
      }
    );

    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось обновить данные.",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/documents/[id]/transport-override
 * Получить текущие override данные для транспортного документа
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: documentId } = await params;
  const session = await getServerSession(authOptions);

  try {
    if (!session?.user?.email) {
      return NextResponse.json(
        {
          ok: false,
          message: "Пользователь не авторизован.",
        },
        { status: 401 }
      );
    }

    const userMode = await getCurrentUserMode();

    if (userMode === 'DEMO') {
      return NextResponse.json({
        ok: true,
        data: {
          vehicle: {
            model: 'Газель',
            licensePlate: 'А 123 БВ 77',
            fuelType: 'gasoline'
          },
          route: {
            from: 'Москва',
            to: 'Санкт-Петербург',
            distance: 700
          },
          emissions: 0.12,
          hasOverride: false
        }
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    });

    if (!user) {
      return NextResponse.json(
        {
          ok: false,
          message: "Пользователь не найден.",
        },
        { status: 404 }
      );
    }

    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        userId: user.id
      },
      select: {
        id: true,
        category: true,
        ocrData: true
      }
    });

    if (!document) {
      return NextResponse.json(
        {
          ok: false,
          message: "Документ не найден.",
        },
        { status: 404 }
      );
    }

    if (document.category !== 'TRANSPORT') {
      return NextResponse.json(
        {
          ok: false,
          message: "Документ не является транспортным",
        },
        { status: 400 }
      );
    }

    const ocrData = document.ocrData as any || {};
    const transportData = ocrData.transportData || {};

    return NextResponse.json({
      ok: true,
      data: {
        vehicle: transportData.vehicle || {},
        route: transportData.route || {},
        emissions: transportData.emissions || 0,
        fuelConsumed: transportData.fuelConsumed || 0,
        hasOverride: !!transportData.userOverride,
        userOverride: transportData.userOverride || null
      }
    });

  } catch (error) {
    logger.error(
      "Failed to get transport override data",
      error instanceof Error ? error : undefined,
      {
        documentId,
        email: session?.user?.email,
      }
    );

    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось получить данные.",
      },
      { status: 500 }
    );
  }
}
