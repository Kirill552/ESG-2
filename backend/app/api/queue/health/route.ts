/**
 * Health Check API endpoint для системы очередей
 * Задача 7.2: Создать API endpoint для health checks
 * Требования: 3.1, 3.2
 */

import { NextRequest, NextResponse } from 'next/server';
import { healthMonitor } from '@/lib/health-monitor';
import { metricsCollector } from '@/lib/metrics';

export const runtime = 'nodejs';

/**
 * GET /api/queue/health - Проверка здоровья системы очередей
 * Требование 3.1: Endpoint возвращающий статус и количество задач
 * Требование 3.2: Показ количества ожидающих, обрабатываемых и завершенных задач
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log('🏥 Health check запрос получен');

    const { searchParams } = new URL(request.url);
    const component = searchParams.get('component'); // specific component check
    const quick = searchParams.get('quick') === 'true'; // quick check flag

    // Быстрая проверка если запрошена
    if (quick) {
      console.log('⚡ Выполняется быстрая проверка здоровья...');
      
      const quickResult = await healthMonitor.quickHealthCheck();
      const responseTime = Date.now() - startTime;
      
      return NextResponse.json({
        status: quickResult.healthy ? 'healthy' : 'unhealthy',
        message: quickResult.message,
        timestamp: new Date().toISOString(),
        responseTime: `${responseTime}ms`,
        type: 'quick'
      }, { 
        status: quickResult.healthy ? 200 : 503,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    }

    // Проверка конкретного компонента
    if (component) {
      console.log(`🔍 Проверка компонента: ${component}`);
      
      let componentHealth;
      let httpStatus = 200;

      switch (component) {
        case 'queue-storage':
        case 'storage':
          componentHealth = await healthMonitor.checkQueueStorageHealth();
          break;
        case 'queue':
          componentHealth = await healthMonitor.checkQueueHealth();
          break;
        case 'database':
        case 'db':
          componentHealth = await healthMonitor.checkDatabaseHealth();
          break;
        default:
          return NextResponse.json({
            error: 'Invalid component',
            message: `Component '${component}' not found`,
            availableComponents: ['queue-storage', 'queue', 'database'],
            timestamp: new Date().toISOString()
          }, { status: 400 });
      }

      // Определяем HTTP статус на основе здоровья компонента
      if (componentHealth.status === 'unhealthy') {
        httpStatus = 503; // Service Unavailable
      } else if (componentHealth.status === 'critical') {
        httpStatus = 500; // Internal Server Error
      } else if (componentHealth.status === 'warning') {
        httpStatus = 200; // OK but with warnings
      }

      const responseTime = Date.now() - startTime;

      return NextResponse.json({
        component,
        ...componentHealth,
        responseTime: `${responseTime}ms`,
        type: 'component'
      }, { 
        status: httpStatus,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    }

  // Полная проверка здоровья системы (по умолчанию)
    console.log('🏥 Выполняется полная проверка здоровья системы...');
    
    const overallHealth = await healthMonitor.getOverallHealth();
    const responseTime = Date.now() - startTime;

    // Определяем HTTP статус на основе общего здоровья
    let httpStatus = 200;
    if (overallHealth.status === 'unhealthy') {
      httpStatus = 503; // Service Unavailable
    } else if (overallHealth.status === 'critical') {
      httpStatus = 500; // Internal Server Error
    } else if (overallHealth.status === 'warning') {
      httpStatus = 200; // OK but with warnings
    }

    // Формируем детальный ответ
  const recentBatches = await metricsCollector.getRecentBatches(24, 5);
  const response = {
      ...overallHealth,
      responseTime: `${responseTime}ms`,
      type: 'full',
      // Добавляем краткую сводку для мониторинга (требование 3.2)
      queueSummary: {
        totalJobs: overallHealth.components.queue.stats.total,
        waiting: overallHealth.components.queue.stats.waiting,
        active: overallHealth.components.queue.stats.active,
        completed: overallHealth.components.queue.stats.completed,
        failed: overallHealth.components.queue.stats.failed,
        successRate: overallHealth.components.queue.stats.total > 0 
          ? ((overallHealth.components.queue.stats.completed / overallHealth.components.queue.stats.total) * 100).toFixed(1) + '%'
          : '0%'
      },
      // Информация о производительности
      performance: {
        responseTime: `${responseTime}ms`,
        queueStorageResponseTime: overallHealth.components.queueStorage.connectionTime ? 
          `${overallHealth.components.queueStorage.connectionTime}ms` : 'N/A',
        databaseResponseTime: overallHealth.components.database.details?.responseTime ? 
          `${overallHealth.components.database.details.responseTime}ms` : 'N/A'
      },
      // Краткая статистика по последним батчам (агрегированная)
      batches: {
        count: recentBatches.length,
        last: recentBatches.slice(0, 1).map(b => ({
          batchId: b.batchId,
          createdAt: b.createdAt,
          total: b.total,
          processed: b.processed,
          failed: b.failed,
          averageMs: b.averageMs,
          medianMs: b.medianMs
        }))[0] || null,
        summary: recentBatches.length ? {
          totalDocs: recentBatches.reduce((s, b) => s + b.total, 0),
          processedDocs: recentBatches.reduce((s, b) => s + b.processed, 0),
          failedDocs: recentBatches.reduce((s, b) => s + b.failed, 0),
          averageMsAvg: Math.round(recentBatches.reduce((s, b) => s + b.averageMs, 0) / recentBatches.length),
          medianMsAvg: Math.round(recentBatches.reduce((s, b) => s + b.medianMs, 0) / recentBatches.length)
        } : { totalDocs: 0, processedDocs: 0, failedDocs: 0, averageMsAvg: 0, medianMsAvg: 0 }
      },
      // Рекомендации по устранению проблем
      recommendations: generateRecommendations(overallHealth)
    };

    console.log(`✅ Health check завершен: ${overallHealth.status} (${responseTime}ms)`);

    return NextResponse.json(response, { 
      status: httpStatus,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Health-Status': overallHealth.status,
        'X-Response-Time': `${responseTime}ms`
      }
    });

  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    console.error('❌ Health check API error:', error);

    return NextResponse.json({
      status: 'unhealthy',
      message: 'Health check failed',
      error: error.message,
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      type: 'error',
      details: {
        errorType: 'HEALTH_CHECK_ERROR',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    }, { 
      status: 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  }
}

/**
 * HEAD /api/queue/health - Быстрая проверка доступности (только статус)
 */
export async function HEAD(request: NextRequest) {
  try {
    const quickResult = await healthMonitor.quickHealthCheck();
    
    return new NextResponse(null, {
      status: quickResult.healthy ? 200 : 503,
      headers: {
        'X-Health-Status': quickResult.healthy ? 'healthy' : 'unhealthy',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    return new NextResponse(null, {
      status: 503,
      headers: {
        'X-Health-Status': 'unhealthy',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  }
}

/**
 * Генерация рекомендаций по устранению проблем
 */
function generateRecommendations(health: any): string[] {
  const recommendations: string[] = [];

  // Проверяем проблемы с хранилищем очередей
  if (health.components.queueStorage.status === 'unhealthy') {
    recommendations.push('Проверьте подключение к PostgreSQL');
    recommendations.push('Убедитесь, что PostgreSQL сервер запущен и доступен');
  } else if (health.components.queueStorage.status === 'critical') {
    recommendations.push('Увеличьте лимит подключений PostgreSQL');
    recommendations.push('Оптимизируйте запросы к базе данных');
  } else if (health.components.queueStorage.status === 'warning') {
    recommendations.push('Мониторьте производительность PostgreSQL');
  }

  // Проверяем проблемы с очередью
  if (health.components.queue.status === 'unhealthy') {
    recommendations.push('Проверьте работу системы очередей');
    recommendations.push('Перезапустите worker процессы');
  } else if (health.components.queue.status === 'critical') {
    const stats = health.components.queue.stats;
    if (stats.waiting + stats.active > 500) {
      recommendations.push('Увеличьте количество worker процессов');
      recommendations.push('Оптимизируйте обработку задач');
    }
    if (stats.total > 0 && (stats.failed / stats.total) > 0.1) {
      recommendations.push('Исследуйте причины ошибок в задачах');
      recommendations.push('Проверьте логи worker процессов');
    }
  } else if (health.components.queue.status === 'warning') {
    recommendations.push('Мониторьте нагрузку на очередь');
  }

  // Проверяем проблемы с базой данных
  if (health.components.database.status === 'unhealthy') {
    recommendations.push('Проверьте подключение к основной базе данных');
  } else if (health.components.database.status === 'critical') {
    recommendations.push('Оптимизируйте запросы к базе данных');
    recommendations.push('Проверьте индексы и производительность БД');
  }

  // Общие рекомендации
  if (health.summary.criticalIssues > 0) {
    recommendations.push('Немедленно устраните критические проблемы');
  }
  
  if (health.summary.warnings > 0 && health.summary.criticalIssues === 0) {
    recommendations.push('Запланируйте устранение предупреждений');
  }

  if (recommendations.length === 0) {
    recommendations.push('Система работает нормально, продолжайте мониторинг');
  }

  return recommendations;
}