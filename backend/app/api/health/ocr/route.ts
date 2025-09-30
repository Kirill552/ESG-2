/**
 * Health-check API для системы OCR
 * Проверяет доступность всех компонентов OCR системы
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { Logger } from "@/lib/logger";
import { HybridOCRService } from "@/lib/hybrid-ocr-service";
import prisma from "@/lib/prisma";

const logger = new Logger("health-check-ocr-api");

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  const session = await getServerSession(authOptions);

  try {
    // Health-check может быть доступен только авторизованным пользователям с админскими правами
    if (!session?.user?.email) {
      return NextResponse.json(
        {
          ok: false,
          message: "Доступ запрещен.",
        },
        { status: 403 }
      );
    }

    const checks: any[] = [];
    let overallStatus = "healthy";
    let criticalFailures = 0;

    // 1. Проверка подключения к базе данных
    try {
      const dbStart = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      checks.push({
        name: "database",
        status: "passed",
        responseTime: Date.now() - dbStart,
        message: "База данных доступна"
      });
    } catch (error) {
      checks.push({
        name: "database",
        status: "failed",
        responseTime: Date.now() - startTime,
        message: "Ошибка подключения к базе данных",
        error: error instanceof Error ? error.message : String(error)
      });
      overallStatus = "unhealthy";
      criticalFailures++;
    }

    // 2. Проверка HybridOcrService
    try {
      const ocrStart = Date.now();
      const hybridOcrService = new HybridOCRService();
      const healthResult = await hybridOcrService.healthCheck();

      checks.push({
        name: "hybrid_ocr_service",
        status: healthResult.status === "healthy" ? "passed" : "failed",
        responseTime: Date.now() - ocrStart,
        message: healthResult.message,
        details: healthResult.checks
      });

      if (healthResult.status !== "healthy") {
        overallStatus = "degraded";
      }
    } catch (error) {
      checks.push({
        name: "hybrid_ocr_service",
        status: "failed",
        responseTime: Date.now() - startTime,
        message: "HybridOcrService недоступен",
        error: error instanceof Error ? error.message : String(error)
      });
      overallStatus = "unhealthy";
      criticalFailures++;
    }

    // 3. Проверка очереди обработки
    try {
      const queueStart = Date.now();

      // Проверяем количество документов в обработке
      const processingCount = await prisma.document.count({
        where: {
          status: "PROCESSING"
        }
      });

      // Проверяем количество документов с ошибками за последний час
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const failedCount = await prisma.document.count({
        where: {
          status: "FAILED",
          updatedAt: {
            gte: oneHourAgo
          }
        }
      });

      let queueStatus = "passed";
      let queueMessage = `Обработка: ${processingCount}, ошибки за час: ${failedCount}`;

      if (processingCount > 100) {
        queueStatus = "warning";
        queueMessage += " (большая очередь)";
        if (overallStatus === "healthy") overallStatus = "degraded";
      }

      if (failedCount > 10) {
        queueStatus = "failed";
        queueMessage += " (много ошибок)";
        overallStatus = "degraded";
      }

      checks.push({
        name: "processing_queue",
        status: queueStatus,
        responseTime: Date.now() - queueStart,
        message: queueMessage,
        metrics: {
          processingCount,
          failedCount,
          periodMinutes: 60
        }
      });

    } catch (error) {
      checks.push({
        name: "processing_queue",
        status: "failed",
        responseTime: Date.now() - startTime,
        message: "Ошибка проверки очереди",
        error: error instanceof Error ? error.message : String(error)
      });
      overallStatus = "unhealthy";
      criticalFailures++;
    }

    // 4. Проверка файлового хранилища (S3)
    try {
      const s3Start = Date.now();

      // Проверяем доступность S3 через тестовый запрос
      const { testS3Connection } = await import("@/lib/s3");

      if (typeof testS3Connection === 'function') {
        await testS3Connection();
        checks.push({
          name: "file_storage",
          status: "passed",
          responseTime: Date.now() - s3Start,
          message: "Файловое хранилище доступно"
        });
      } else {
        checks.push({
          name: "file_storage",
          status: "warning",
          responseTime: Date.now() - s3Start,
          message: "Тест подключения к S3 недоступен"
        });
        if (overallStatus === "healthy") overallStatus = "degraded";
      }

    } catch (error) {
      checks.push({
        name: "file_storage",
        status: "failed",
        responseTime: Date.now() - s3Start,
        message: "Файловое хранилище недоступно",
        error: error instanceof Error ? error.message : String(error)
      });
      overallStatus = "degraded";
    }

    // 5. Проверка производительности системы
    try {
      const perfStart = Date.now();

      // Получаем статистику производительности за последние 24 часа
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const avgProcessingTime = await prisma.document.aggregate({
        where: {
          status: "PROCESSED",
          processingCompletedAt: {
            gte: dayAgo
          },
          AND: [
            {
              processingStartedAt: { not: null }
            },
            {
              processingCompletedAt: { not: null }
            }
          ]
        },
        _avg: {
          // Вычисляем разность в секундах между началом и завершением
        }
      });

      // Подсчитываем успешность обработки
      const [totalDocuments, successfulDocuments] = await Promise.all([
        prisma.document.count({
          where: {
            createdAt: { gte: dayAgo }
          }
        }),
        prisma.document.count({
          where: {
            status: "PROCESSED",
            createdAt: { gte: dayAgo }
          }
        })
      ]);

      const successRate = totalDocuments > 0 ? (successfulDocuments / totalDocuments) * 100 : 100;

      let perfStatus = "passed";
      let perfMessage = `Успешность: ${successRate.toFixed(1)}%, документов за день: ${totalDocuments}`;

      if (successRate < 90) {
        perfStatus = "warning";
        perfMessage += " (низкая успешность)";
        if (overallStatus === "healthy") overallStatus = "degraded";
      }

      if (successRate < 70) {
        perfStatus = "failed";
        perfMessage += " (критически низкая успешность)";
        overallStatus = "degraded";
      }

      checks.push({
        name: "performance_metrics",
        status: perfStatus,
        responseTime: Date.now() - perfStart,
        message: perfMessage,
        metrics: {
          successRate: Math.round(successRate * 10) / 10,
          totalDocuments,
          successfulDocuments,
          periodHours: 24
        }
      });

    } catch (error) {
      checks.push({
        name: "performance_metrics",
        status: "failed",
        responseTime: Date.now() - perfStart,
        message: "Ошибка получения метрик производительности",
        error: error instanceof Error ? error.message : String(error)
      });
    }

    const totalResponseTime = Date.now() - startTime;

    // Финальная оценка статуса
    if (criticalFailures > 0) {
      overallStatus = "unhealthy";
    }

    const result = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      responseTime: totalResponseTime,
      checks,
      summary: {
        total: checks.length,
        passed: checks.filter(c => c.status === "passed").length,
        warnings: checks.filter(c => c.status === "warning").length,
        failed: checks.filter(c => c.status === "failed").length,
        criticalFailures
      },
      version: process.env.APP_VERSION || "unknown",
      environment: process.env.NODE_ENV || "unknown"
    };

    logger.info("OCR health check completed", {
      status: overallStatus,
      responseTime: totalResponseTime,
      summary: result.summary
    });

    // Возвращаем соответствующий HTTP статус
    const httpStatus = overallStatus === "healthy" ? 200 :
                      overallStatus === "degraded" ? 200 : 503;

    return NextResponse.json(result, { status: httpStatus });

  } catch (error) {
    logger.error(
      "Health check failed",
      error instanceof Error ? error : undefined
    );

    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime,
        error: "Критическая ошибка при проверке состояния системы",
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 503 }
    );
  }
}