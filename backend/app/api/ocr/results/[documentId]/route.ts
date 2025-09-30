/**
 * API для получения детальной информации о результате OCR обработки документа
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { Logger } from "@/lib/logger";
import { getCurrentUserMode } from "@/lib/user-mode-utils";

const logger = new Logger("ocr-result-detail-api");

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params;
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
      // В демо-режиме возвращаем моковый результат
      const demoResult = getDemoOcrResult(documentId);

      if (!demoResult) {
        return NextResponse.json(
          {
            ok: false,
            message: "Результат OCR не найден.",
          },
          { status: 404 }
        );
      }

      logger.info("Demo OCR result detail retrieved", {
        userMode,
        documentId
      });

      return NextResponse.json({
        ok: true,
        result: demoResult
      });
    }

    // Для реальных пользователей получаем данные из БД
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

    // Получаем документ с OCR результатами
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        userId: user.id,
        ocrProcessed: true,
        ocrData: { not: null }
      },
      select: {
        id: true,
        fileName: true,
        originalName: true,
        fileSize: true,
        fileType: true,
        status: true,
        ocrProcessed: true,
        ocrData: true,
        ocrConfidence: true,
        processingStartedAt: true,
        processingCompletedAt: true,
        processingProgress: true,
        processingStage: true,
        processingMessage: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!document) {
      return NextResponse.json(
        {
          ok: false,
          message: "Результат OCR не найден.",
        },
        { status: 404 }
      );
    }

    const ocrData = document.ocrData as any;

    const result = {
      documentId: document.id,
      fileName: document.fileName,
      originalName: document.originalName,
      fileSize: document.fileSize,
      fileType: document.fileType,
      status: document.status,
      processing: {
        stage: document.processingStage,
        progress: document.processingProgress,
        message: document.processingMessage,
        startedAt: document.processingStartedAt?.toISOString(),
        completedAt: document.processingCompletedAt?.toISOString(),
        processingTime: ocrData?.processingTime
      },
      ocr: {
        provider: ocrData?.provider || 'unknown',
        confidence: document.ocrConfidence || 0,
        fullText: ocrData?.fullText || '',
        textPreview: ocrData?.textPreview || '',
        textLength: ocrData?.textLength || 0,
        processedAt: ocrData?.processedAt
      },
      formatInfo: ocrData?.formatInfo,
      structuredData: ocrData?.structuredData,
      metadata: ocrData?.metadata,
      healthCheckResults: ocrData?.healthCheckResults,
      timestamps: {
        created: document.createdAt.toISOString(),
        updated: document.updatedAt.toISOString()
      }
    };

    logger.info("OCR result detail retrieved", {
      userId: user.id,
      userMode,
      documentId,
      provider: ocrData?.provider,
      textLength: ocrData?.textLength
    });

    return NextResponse.json({
      ok: true,
      result
    });

  } catch (error) {
    logger.error(
      "Failed to get OCR result detail",
      error instanceof Error ? error : undefined,
      {
        email: session?.user?.email,
        documentId
      }
    );

    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось получить детали результата OCR.",
      },
      { status: 500 }
    );
  }
}

/**
 * Получает демо-результат OCR для указанного документа
 */
function getDemoOcrResult(documentId: string) {
  const demoResults: { [key: string]: any } = {
    "demo-doc-1": {
      documentId: "demo-doc-1",
      fileName: "Производство_данные_39.xlsx",
      originalName: "Производство_данные_39.xlsx",
      fileSize: 28.3 * 1024 * 1024,
      fileType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      status: "PROCESSED",
      processing: {
        stage: "completed",
        progress: 100,
        message: "Обработка завершена успешно",
        startedAt: "2025-09-20T10:12:00Z",
        completedAt: "2025-09-20T10:15:00Z",
        processingTime: 12500
      },
      ocr: {
        provider: "tesseract",
        confidence: 0.94,
        fullText: `Отчет по производственным данным за сентябрь 2025

Потребление энергоресурсов:
- Электроэнергия: 2540 кВт·ч
- Природный газ: 1200 м³
- Тепловая энергия: 85 Гкал

Транспортные расходы:
- Автомобильный транспорт: 850 км
- Грузоперевозки: 120 т·км

Отходы производства:
- Металлолом: 2.3 т
- Пластик: 0.8 т
- Бумага: 1.2 т

Итого углеродный след: 1245.7 кг CO2`,
        textPreview: "Отчет по производственным данным за сентябрь 2025. Электроэнергия: 2540 кВт·ч, Газ: 1200 м³, Транспорт: 850 км...",
        textLength: 342,
        processedAt: "2025-09-20T10:15:00Z"
      },
      formatInfo: {
        format: "excel",
        confidence: 0.99,
        sheets: ["Основные данные", "Детализация", "Сводка"],
        recommendedParser: "ExcelParser"
      },
      structuredData: {
        electricity_data: [
          { consumption_kwh: 2540, region: "Москва", tariff_type: "промышленный", confidence: 0.94 }
        ],
        gas_data: [
          { consumption_m3: 1200, gas_type: "природный газ", confidence: 0.91 }
        ],
        heat_data: [
          { consumption_gcal: 85, confidence: 0.89 }
        ],
        transport_data: [
          { distance_km: 850, transport_type: "автомобиль", confidence: 0.88 },
          { distance_km: 120, transport_type: "грузоперевозки", cargo_weight: 120, confidence: 0.86 }
        ],
        fuel_data: [
          { type: "дизель", amount: 340, unit: "л", confidence: 0.85 }
        ]
      },
      metadata: {
        processingSteps: [
          { step: "format_detection", duration: 150, success: true },
          { step: "excel_parsing", duration: 2300, success: true },
          { step: "text_extraction", duration: 4200, success: true },
          { step: "unit_recognition", duration: 3800, success: true },
          { step: "data_structuring", duration: 2050, success: true }
        ],
        qualityScore: 0.91,
        extractedUnits: ["кВт·ч", "м³", "Гкал", "км", "т·км", "т", "л", "кг"],
        carbonFootprint: 1245.7
      },
      healthCheckResults: {
        overall: "healthy",
        checks: [
          { name: "text_extraction", status: "passed", score: 0.94 },
          { name: "unit_detection", status: "passed", score: 0.89 },
          { name: "data_quality", status: "passed", score: 0.91 },
          { name: "format_consistency", status: "passed", score: 0.96 }
        ]
      },
      timestamps: {
        created: "2025-09-20T10:10:00Z",
        updated: "2025-09-20T10:15:00Z"
      }
    },
    "demo-doc-2": {
      documentId: "demo-doc-2",
      fileName: "Поставщики_данные_1.csv",
      originalName: "Поставщики_данные_1.csv",
      fileSize: 37.4 * 1024 * 1024,
      fileType: "text/csv",
      status: "PROCESSED",
      processing: {
        stage: "completed",
        progress: 100,
        message: "Обработка завершена успешно",
        startedAt: "2025-09-19T14:28:00Z",
        completedAt: "2025-09-19T14:30:00Z",
        processingTime: 8400
      },
      ocr: {
        provider: "yandex_vision",
        confidence: 0.97,
        fullText: `Список поставщиков энергоресурсов за Q3 2025

Поставщик,Вид ресурса,Объем,Единица измерения,Стоимость
ООО Энергия,Электричество,1800,кВт·ч,54000
ГазПром Регион,Природный газ,950,м³,19500
ТеплоСеть,Тепловая энергия,42,Гкал,21000
ЭкоТранс,Топливо,560,л,33600
РосЭнерго,Электричество,2200,кВт·ч,66000

Итого: 194100 рублей`,
        textPreview: "Список поставщиков энергоресурсов. ООО Энергия: поставка электричества 1800 кВт·ч, ГазПром: природный газ 950 м³...",
        textLength: 421,
        processedAt: "2025-09-19T14:30:00Z"
      },
      formatInfo: {
        format: "csv",
        confidence: 0.98,
        delimiter: ",",
        encoding: "utf-8",
        recommendedParser: "CsvTsvParser"
      },
      structuredData: {
        electricity_data: [
          { consumption_kwh: 1800, supplier: "ООО Энергия", tariff_type: "промышленный", confidence: 0.97 },
          { consumption_kwh: 2200, supplier: "РосЭнерго", tariff_type: "промышленный", confidence: 0.96 }
        ],
        gas_data: [
          { consumption_m3: 950, supplier: "ГазПром Регион", gas_type: "природный газ", confidence: 0.95 }
        ],
        heat_data: [
          { consumption_gcal: 42, supplier: "ТеплоСеть", confidence: 0.93 }
        ],
        fuel_data: [
          { type: "дизель", amount: 560, unit: "л", supplier: "ЭкоТранс", confidence: 0.92 }
        ]
      },
      metadata: {
        processingSteps: [
          { step: "format_detection", duration: 80, success: true },
          { step: "csv_parsing", duration: 1200, success: true },
          { step: "text_extraction", duration: 2100, success: true },
          { step: "unit_recognition", duration: 3200, success: true },
          { step: "data_structuring", duration: 1820, success: true }
        ],
        qualityScore: 0.94,
        extractedUnits: ["кВт·ч", "м³", "Гкал", "л"],
        totalCost: 194100,
        suppliers: 5
      },
      healthCheckResults: {
        overall: "healthy",
        checks: [
          { name: "text_extraction", status: "passed", score: 0.97 },
          { name: "unit_detection", status: "passed", score: 0.94 },
          { name: "data_quality", status: "passed", score: 0.96 },
          { name: "format_consistency", status: "passed", score: 0.98 }
        ]
      },
      timestamps: {
        created: "2025-09-19T14:25:00Z",
        updated: "2025-09-19T14:30:00Z"
      }
    }
  };

  return demoResults[documentId] || null;
}