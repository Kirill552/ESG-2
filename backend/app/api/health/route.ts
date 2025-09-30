/**
 * Общий health-check API для всей системы ESG-Лайт
 * Проверяет основные компоненты системы
 */

import { NextRequest, NextResponse } from "next/server";
import { Logger } from "@/lib/logger";
import prisma from "@/lib/prisma";

const logger = new Logger("health-check-api");

export async function GET(req: NextRequest) {
  const startTime = Date.now();

  try {
    const checks: any[] = [];
    let overallStatus = "healthy";

    // 1. Проверка базы данных
    try {
      const dbStart = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      checks.push({
        name: "database",
        status: "passed",
        responseTime: Date.now() - dbStart,
        message: "PostgreSQL доступна"
      });
    } catch (error) {
      checks.push({
        name: "database",
        status: "failed",
        responseTime: Date.now() - startTime,
        message: "База данных недоступна",
        error: error instanceof Error ? error.message : String(error)
      });
      overallStatus = "unhealthy";
    }

    // 2. Проверка основных таблиц
    try {
      const tablesStart = Date.now();
      const [usersCount, documentsCount] = await Promise.all([
        prisma.user.count(),
        prisma.document.count()
      ]);

      checks.push({
        name: "database_tables",
        status: "passed",
        responseTime: Date.now() - tablesStart,
        message: `Пользователи: ${usersCount}, документы: ${documentsCount}`,
        metrics: { usersCount, documentsCount }
      });
    } catch (error) {
      checks.push({
        name: "database_tables",
        status: "failed",
        responseTime: Date.now() - startTime,
        message: "Ошибка доступа к таблицам",
        error: error instanceof Error ? error.message : String(error)
      });
      overallStatus = "degraded";
    }

    // 3. Проверка переменных окружения
    try {
      const envStart = Date.now();
      const requiredEnvVars = [
        'DATABASE_URL',
        'NEXTAUTH_SECRET',
        'NEXTAUTH_URL'
      ];

      const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

      if (missingVars.length === 0) {
        checks.push({
          name: "environment",
          status: "passed",
          responseTime: Date.now() - envStart,
          message: "Все необходимые переменные окружения настроены"
        });
      } else {
        checks.push({
          name: "environment",
          status: "failed",
          responseTime: Date.now() - envStart,
          message: `Отсутствуют переменные: ${missingVars.join(', ')}`,
          details: { missingVars }
        });
        overallStatus = "unhealthy";
      }
    } catch (error) {
      checks.push({
        name: "environment",
        status: "failed",
        responseTime: Date.now() - startTime,
        message: "Ошибка проверки переменных окружения",
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // 4. Проверка системных ресурсов
    try {
      const resourcesStart = Date.now();
      const memoryUsage = process.memoryUsage();
      const uptime = process.uptime();

      // Конвертируем в МБ
      const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
      const rssMB = Math.round(memoryUsage.rss / 1024 / 1024);

      let resourceStatus = "passed";
      let resourceMessage = `Память: ${heapUsedMB}/${heapTotalMB} МБ, Uptime: ${Math.round(uptime / 60)} мин`;

      // Предупреждение при высоком использовании памяти
      if (heapUsedMB > 500) {
        resourceStatus = "warning";
        resourceMessage += " (высокое использование памяти)";
        if (overallStatus === "healthy") overallStatus = "degraded";
      }

      checks.push({
        name: "system_resources",
        status: resourceStatus,
        responseTime: Date.now() - resourcesStart,
        message: resourceMessage,
        metrics: {
          heapUsedMB,
          heapTotalMB,
          rssMB,
          uptimeMinutes: Math.round(uptime / 60),
          nodeVersion: process.version
        }
      });
    } catch (error) {
      checks.push({
        name: "system_resources",
        status: "failed",
        responseTime: Date.now() - startTime,
        message: "Ошибка получения системных метрик",
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // 5. Проверка активности системы
    try {
      const activityStart = Date.now();

      // Проверяем активность за последние 24 часа
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const [recentDocuments, recentUsers] = await Promise.all([
        prisma.document.count({
          where: {
            createdAt: { gte: dayAgo }
          }
        }),
        prisma.user.count({
          where: {
            updatedAt: { gte: dayAgo }
          }
        })
      ]);

      checks.push({
        name: "system_activity",
        status: "passed",
        responseTime: Date.now() - activityStart,
        message: `Активность за 24ч: ${recentDocuments} документов, ${recentUsers} пользователей`,
        metrics: {
          recentDocuments,
          recentUsers,
          periodHours: 24
        }
      });
    } catch (error) {
      checks.push({
        name: "system_activity",
        status: "failed",
        responseTime: Date.now() - activityStart,
        message: "Ошибка получения метрик активности",
        error: error instanceof Error ? error.message : String(error)
      });
    }

    const totalResponseTime = Date.now() - startTime;

    const result = {
      status: overallStatus,
      service: "ESG-Лайт",
      version: process.env.APP_VERSION || "1.0.0",
      environment: process.env.NODE_ENV || "development",
      timestamp: new Date().toISOString(),
      responseTime: totalResponseTime,
      checks,
      summary: {
        total: checks.length,
        passed: checks.filter(c => c.status === "passed").length,
        warnings: checks.filter(c => c.status === "warning").length,
        failed: checks.filter(c => c.status === "failed").length
      },
      endpoints: {
        ocrHealth: "/api/health/ocr",
        documentation: "/api-docs",
        status: "/api/status"
      }
    };

    logger.info("System health check completed", {
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
      "System health check failed",
      error instanceof Error ? error : undefined
    );

    return NextResponse.json(
      {
        status: "unhealthy",
        service: "ESG-Лайт",
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime,
        error: "Критическая ошибка при проверке состояния системы",
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 503 }
    );
  }
}

/**
 * Упрощенный health check для быстрой проверки (например, для load balancer)
 */
export async function HEAD(req: NextRequest) {
  try {
    // Быстрая проверка базы данных
    await prisma.$queryRaw`SELECT 1`;

    return new NextResponse(null, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache',
        'X-Health-Status': 'healthy'
      }
    });
  } catch (error) {
    return new NextResponse(null, {
      status: 503,
      headers: {
        'Cache-Control': 'no-cache',
        'X-Health-Status': 'unhealthy'
      }
    });
  }
}