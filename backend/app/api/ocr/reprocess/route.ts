/**
 * API для повторной обработки документа через OCR
 * Поддерживает выбор конкретного провайдера OCR
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { Logger } from "@/lib/logger";
import { getCurrentUserMode } from "@/lib/user-mode-utils";
import { HybridOCRService } from "@/lib/hybrid-ocr-service";

const logger = new Logger("ocr-reprocess-api");

export async function POST(req: NextRequest) {
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

    const body = await req.json();
    const { documentId, provider, options } = body;

    if (!documentId) {
      return NextResponse.json(
        {
          ok: false,
          message: "Не указан ID документа.",
        },
        { status: 400 }
      );
    }

    // Проверяем режим пользователя
    const userMode = await getCurrentUserMode();

    if (userMode === 'DEMO') {
      // В демо-режиме имитируем повторную обработку
      logger.info("Demo OCR reprocessing started", {
        userMode,
        documentId,
        provider
      });

      // Имитируем задержку обработки
      await new Promise(resolve => setTimeout(resolve, 1500));

      return NextResponse.json({
        ok: true,
        message: "Повторная обработка запущена в демо-режиме.",
        jobId: `demo-job-${documentId}-${Date.now()}`,
        estimatedTime: 30000, // 30 секунд
        provider: provider || "tesseract"
      });
    }

    // Для реальных пользователей
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

    // Проверяем существование документа
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        userId: user.id
      },
      select: {
        id: true,
        fileName: true,
        fileKey: true,
        fileSize: true,
        status: true
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

    // Проверяем, не обрабатывается ли документ уже
    if (document.status === 'PROCESSING') {
      return NextResponse.json(
        {
          ok: false,
          message: "Документ уже обрабатывается.",
        },
        { status: 409 }
      );
    }

    // Обновляем статус документа
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'PROCESSING',
        processingStartedAt: new Date(),
        processingProgress: 0,
        processingStage: 'starting',
        processingMessage: 'Подготовка к повторной обработке',
        ocrProcessed: false,
        ocrData: null,
        ocrConfidence: null
      }
    });

    // Создаем задачу в очереди (если используется)
    let jobId = `reprocess-${documentId}-${Date.now()}`;

    try {
      // Здесь можно добавить задачу в очередь pg-boss
      // const boss = await createPgBoss();
      // jobId = await boss.send('ocr-reprocess', {
      //   documentId,
      //   userId: user.id,
      //   fileKey: document.fileKey,
      //   fileName: document.fileName,
      //   provider,
      //   options
      // });

      // Для демонстрации используем прямую обработку
      const hybridOcrService = new HybridOCRService();

      // Запускаем обработку в фоновом режиме
      processDocumentAsync(hybridOcrService, document, userMode, provider, options)
        .catch(error => {
          logger.error("Background OCR processing failed", error, { documentId });
        });

    } catch (error) {
      // Откатываем статус документа при ошибке
      await prisma.document.update({
        where: { id: documentId },
        data: {
          status: 'UPLOADED',
          processingStartedAt: null,
          processingProgress: null,
          processingStage: null,
          processingMessage: null
        }
      });

      throw error;
    }

    logger.info("OCR reprocessing started", {
      userId: user.id,
      userMode,
      documentId,
      provider,
      jobId
    });

    return NextResponse.json({
      ok: true,
      message: "Повторная обработка запущена.",
      jobId,
      estimatedTime: estimateProcessingTime(document.fileSize),
      provider: provider || "auto"
    });

  } catch (error) {
    logger.error(
      "Failed to start OCR reprocessing",
      error instanceof Error ? error : undefined,
      {
        email: session?.user?.email,
      }
    );

    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось запустить повторную обработку.",
      },
      { status: 500 }
    );
  }
}

/**
 * Асинхронная обработка документа
 */
async function processDocumentAsync(
  hybridOcrService: HybridOCRService,
  document: any,
  userMode: string,
  provider?: string,
  options?: any
) {
  try {
    // Получаем файл из S3
    const { getFileBuffer } = await import('@/lib/s3');
    const { buffer } = await getFileBuffer(document.fileKey);

    // Обрабатываем через OCR
    const result = await hybridOcrService.processFile(
      buffer,
      document.fileName,
      userMode as any,
      provider ? { preferredProvider: provider, ...options } : options
    );

    const ocrText = result.extractedText || 'Нет данных';

    // Сохраняем результаты
    await prisma.document.update({
      where: { id: document.id },
      data: {
        status: 'PROCESSED',
        ocrProcessed: true,
        ocrData: {
          fullText: ocrText,
          textPreview: ocrText.substring(0, 200),
          textLength: ocrText.length,
          processedAt: new Date().toISOString(),
          provider: result.provider || 'unknown',
          confidence: result.confidence,
          processingTime: result.processingTime,
          formatInfo: result.formatInfo,
          structuredData: result.structuredData,
          metadata: result.metadata,
          healthCheckResults: result.healthCheckResults
        },
        ocrConfidence: result.confidence || 0,
        processingCompletedAt: new Date(),
        processingProgress: 100,
        processingStage: 'completed',
        processingMessage: 'Повторная обработка завершена успешно'
      }
    });

    logger.info("Background OCR processing completed", {
      documentId: document.id,
      provider: result.provider,
      textLength: ocrText.length
    });

  } catch (error) {
    // Сохраняем ошибку
    await prisma.document.update({
      where: { id: document.id },
      data: {
        status: 'FAILED',
        ocrData: {
          error: error instanceof Error ? error.message : String(error),
          processedAt: new Date().toISOString()
        },
        processingCompletedAt: new Date(),
        processingProgress: 100,
        processingStage: 'failed',
        processingMessage: 'Ошибка повторной обработки: ' + (error instanceof Error ? error.message : String(error))
      }
    });

    logger.error("Background OCR processing failed", error instanceof Error ? error : new Error(String(error)), {
      documentId: document.id
    });
  }
}

/**
 * Оценивает время обработки на основе размера файла
 */
function estimateProcessingTime(fileSize: number): number {
  // Базовые оценки в миллисекундах
  const baseTimes = {
    small: 15000,   // < 1 МБ - 15 секунд
    medium: 45000,  // 1-10 МБ - 45 секунд
    large: 120000,  // 10-50 МБ - 2 минуты
    xlarge: 300000  // > 50 МБ - 5 минут
  };

  const sizeMB = fileSize / (1024 * 1024);

  if (sizeMB < 1) return baseTimes.small;
  if (sizeMB < 10) return baseTimes.medium;
  if (sizeMB < 50) return baseTimes.large;
  return baseTimes.xlarge;
}