/**
 * API для получения результатов OCR обработки
 * Поддерживает фильтрацию по пользователю, статусу и временному периоду
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { Logger } from "@/lib/logger";
import { getCurrentUserMode } from "@/lib/user-mode-utils";

const logger = new Logger("ocr-results-api");

export async function GET(req: NextRequest) {
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

    // Получаем параметры запроса
    const { searchParams } = new URL(req.url);
    const documentId = searchParams.get("documentId");
    const status = searchParams.get("status");
    const provider = searchParams.get("provider");
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "25");

    // Проверяем режим пользователя
    const userMode = await getCurrentUserMode();

    if (userMode === 'DEMO') {
      // В демо-режиме возвращаем моковые данные OCR результатов
      const demoResults = generateDemoOcrResults(documentId);

      // Применяем фильтры
      let filteredResults = demoResults;

      if (status && status !== "all") {
        filteredResults = filteredResults.filter(result => result.status === status);
      }

      if (provider && provider !== "all") {
        filteredResults = filteredResults.filter(result => result.provider === provider);
      }

      if (fromDate) {
        const from = new Date(fromDate);
        filteredResults = filteredResults.filter(result => new Date(result.processedAt) >= from);
      }

      if (toDate) {
        const to = new Date(toDate);
        filteredResults = filteredResults.filter(result => new Date(result.processedAt) <= to);
      }

      // Пагинация
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedResults = filteredResults.slice(startIndex, endIndex);

      logger.info("Demo OCR results retrieved", {
        userMode,
        total: filteredResults.length,
        page,
        pageSize,
        filters: { documentId, status, provider, fromDate, toDate }
      });

      return NextResponse.json({
        ok: true,
        results: paginatedResults,
        pagination: {
          page,
          pageSize,
          total: filteredResults.length,
          pages: Math.ceil(filteredResults.length / pageSize),
          hasNext: page < Math.ceil(filteredResults.length / pageSize),
          hasPrev: page > 1
        },
        filters: {
          statuses: ["PROCESSED", "FAILED", "PROCESSING"],
          providers: ["tesseract", "yandex_vision", "gigachat"],
          dateRange: {
            min: "2025-09-01",
            max: new Date().toISOString().split('T')[0]
          }
        }
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

    // Строим WHERE условие для фильтрации
    const whereConditions: any = {
      userId: user.id,
      ocrProcessed: true,
      ocrData: {
        not: null
      }
    };

    if (documentId) {
      whereConditions.id = documentId;
    }

    if (status && status !== "all") {
      whereConditions.status = status.toUpperCase();
    }

    if (fromDate) {
      whereConditions.processingCompletedAt = {
        ...whereConditions.processingCompletedAt,
        gte: new Date(fromDate)
      };
    }

    if (toDate) {
      whereConditions.processingCompletedAt = {
        ...whereConditions.processingCompletedAt,
        lte: new Date(toDate)
      };
    }

    // Получаем общее количество результатов
    const totalCount = await prisma.document.count({
      where: whereConditions
    });

    // Получаем результаты OCR с пагинацией
    const documents = await prisma.document.findMany({
      where: whereConditions,
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
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        processingCompletedAt: 'desc'
      },
      skip: (page - 1) * pageSize,
      take: pageSize
    });

    // Преобразуем в удобный формат
    const results = documents.map(doc => ({
      documentId: doc.id,
      fileName: doc.fileName,
      originalName: doc.originalName,
      fileSize: doc.fileSize,
      fileType: doc.fileType,
      status: doc.status,
      provider: (doc.ocrData as any)?.provider || 'unknown',
      confidence: doc.ocrConfidence || 0,
      textLength: (doc.ocrData as any)?.textLength || 0,
      textPreview: (doc.ocrData as any)?.textPreview || '',
      processingTime: (doc.ocrData as any)?.processingTime,
      processedAt: doc.processingCompletedAt?.toISOString() || doc.updatedAt.toISOString(),
      metadata: {
        formatInfo: (doc.ocrData as any)?.formatInfo,
        structuredData: (doc.ocrData as any)?.structuredData,
        healthCheckResults: (doc.ocrData as any)?.healthCheckResults
      }
    }));

    logger.info("OCR results retrieved", {
      userId: user.id,
      userMode,
      total: totalCount,
      page,
      pageSize,
      filters: { documentId, status, provider, fromDate, toDate }
    });

    return NextResponse.json({
      ok: true,
      results,
      pagination: {
        page,
        pageSize,
        total: totalCount,
        pages: Math.ceil(totalCount / pageSize),
        hasNext: page < Math.ceil(totalCount / pageSize),
        hasPrev: page > 1
      },
      filters: {
        statuses: ["PROCESSED", "FAILED", "PROCESSING"],
        providers: await getUsedProviders(user.id),
        dateRange: await getDateRange(user.id)
      }
    });

  } catch (error) {
    logger.error(
      "Failed to get OCR results",
      error instanceof Error ? error : undefined,
      {
        email: session?.user?.email,
      }
    );

    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось получить результаты OCR.",
      },
      { status: 500 }
    );
  }
}

/**
 * Генерирует демо-данные OCR результатов
 */
function generateDemoOcrResults(documentId?: string | null): any[] {
  const demoResults = [
    {
      documentId: "demo-doc-1",
      fileName: "Производство_данные_39.xlsx",
      originalName: "Производство_данные_39.xlsx",
      fileSize: 28.3 * 1024 * 1024,
      fileType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      status: "PROCESSED",
      provider: "tesseract",
      confidence: 0.94,
      textLength: 5420,
      textPreview: "Отчет по производственным данным за сентябрь 2025. Электроэнергия: 2540 кВт·ч, Газ: 1200 м³, Транспорт: 850 км...",
      processingTime: 12500,
      processedAt: "2025-09-20T10:15:00Z",
      metadata: {
        formatInfo: { format: "excel", confidence: 0.99 },
        structuredData: {
          electricity_data: [{ consumption_kwh: 2540, confidence: 0.94 }],
          gas_data: [{ consumption_m3: 1200, confidence: 0.91 }],
          transport_data: [{ distance_km: 850, confidence: 0.88 }]
        }
      }
    },
    {
      documentId: "demo-doc-2",
      fileName: "Поставщики_данные_1.csv",
      originalName: "Поставщики_данные_1.csv",
      fileSize: 37.4 * 1024 * 1024,
      fileType: "text/csv",
      status: "PROCESSED",
      provider: "yandex_vision",
      confidence: 0.97,
      textLength: 8320,
      textPreview: "Список поставщиков энергоресурсов. ООО Энергия: поставка электричества 1800 кВт·ч, ГазПром: природный газ 950 м³...",
      processingTime: 8400,
      processedAt: "2025-09-19T14:30:00Z",
      metadata: {
        formatInfo: { format: "csv", confidence: 0.98 },
        structuredData: {
          electricity_data: [{ consumption_kwh: 1800, supplier: "ООО Энергия", confidence: 0.97 }],
          gas_data: [{ consumption_m3: 950, supplier: "ГазПром", confidence: 0.95 }]
        }
      }
    },
    {
      documentId: "demo-doc-3",
      fileName: "Отходы_данные_3.docx",
      originalName: "Отходы_данные_3.docx",
      fileSize: 38.2 * 1024 * 1024,
      fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      status: "FAILED",
      provider: "gigachat",
      confidence: 0.45,
      textLength: 0,
      textPreview: "",
      processingTime: 45000,
      processedAt: "2025-09-18T09:45:00Z",
      metadata: {
        formatInfo: { format: "docx", confidence: 0.85 },
        error: "OCR_FAILED: Документ содержит поврежденную структуру"
      }
    }
  ];

  if (documentId) {
    return demoResults.filter(result => result.documentId === documentId);
  }

  return demoResults;
}

/**
 * Получает список использованных провайдеров OCR
 */
async function getUsedProviders(userId: string): Promise<string[]> {
  try {
    const results = await prisma.document.findMany({
      where: {
        userId,
        ocrProcessed: true,
        ocrData: { not: null }
      },
      select: {
        ocrData: true
      }
    });

    const providers = new Set<string>();
    results.forEach(doc => {
      const provider = (doc.ocrData as any)?.provider;
      if (provider) {
        providers.add(provider);
      }
    });

    return Array.from(providers);
  } catch (error) {
    return ["tesseract", "yandex_vision", "gigachat"];
  }
}

/**
 * Получает диапазон дат обработки
 */
async function getDateRange(userId: string): Promise<{ min: string; max: string }> {
  try {
    const result = await prisma.document.aggregate({
      where: {
        userId,
        ocrProcessed: true,
        processingCompletedAt: { not: null }
      },
      _min: {
        processingCompletedAt: true
      },
      _max: {
        processingCompletedAt: true
      }
    });

    return {
      min: result._min.processingCompletedAt?.toISOString().split('T')[0] || "2025-09-01",
      max: result._max.processingCompletedAt?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0]
    };
  } catch (error) {
    return {
      min: "2025-09-01",
      max: new Date().toISOString().split('T')[0]
    };
  }
}