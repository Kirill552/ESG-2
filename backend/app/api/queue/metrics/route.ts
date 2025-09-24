import { NextRequest, NextResponse } from 'next/server'
import { metricsCollector } from '../../../../lib/metrics'

/**
 * API endpoint для получения метрик производительности очередей
 * GET /api/queue/metrics
 * 
 * Query параметры:
 * - period: период в часах (по умолчанию 24)
 * - type: тип метрики (processing_time, throughput, error, custom)
 * - limit: лимит записей (по умолчанию 100)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Получаем параметры запроса
    const period = parseInt(searchParams.get('period') || '24')
    const metricType = searchParams.get('type')
    const limit = parseInt(searchParams.get('limit') || '100')

    // Валидация параметров
    if (period < 1 || period > 168) { // максимум неделя
      return NextResponse.json(
        { error: 'Период должен быть от 1 до 168 часов' },
        { status: 400 }
      )
    }

    if (limit < 1 || limit > 1000) {
      return NextResponse.json(
        { error: 'Лимит должен быть от 1 до 1000' },
        { status: 400 }
      )
    }

    // Если запрашивается конкретный тип метрики
    if (metricType) {
      const validTypes = ['processing_time', 'throughput', 'error', 'custom']
      if (!validTypes.includes(metricType)) {
        return NextResponse.json(
          { error: `Неверный тип метрики. Доступные: ${validTypes.join(', ')}` },
          { status: 400 }
        )
      }

      const metrics = await metricsCollector.getMetricsByType(metricType, period, limit)

      return NextResponse.json({
        success: true,
        data: {
          type: metricType,
          period: `${period}h`,
          count: metrics.length,
          metrics: metrics.map(metric => ({
            id: metric.id,
            value: metric.metric_value,
            metadata: metric.metadata,
            timestamp: metric.timestamp,
            expiresAt: metric.expires_at
          }))
        },
        timestamp: new Date().toISOString()
      })
    }

    // Получаем общие метрики производительности
    const performanceMetrics = await metricsCollector.getPerformanceMetrics(period)

    // Дополнительная статистика по типам метрик
    const [processingTimeMetrics, throughputMetrics, errorMetrics] = await Promise.all([
      metricsCollector.getMetricsByType('processing_time', period, 10),
      metricsCollector.getMetricsByType('throughput', period, 10),
      metricsCollector.getMetricsByType('error', period, 10)
    ])

    // Получаем недавние батчи с усреднениями
    const recentBatches = await metricsCollector.getRecentBatches(period, 5)

    return NextResponse.json({
      success: true,
      data: {
        period: `${period}h`,
        summary: {
          averageProcessingTime: Math.round(performanceMetrics.averageProcessingTime),
          throughputPerMinute: Number(performanceMetrics.throughputPerMinute.toFixed(2)),
          errorRate: Number(performanceMetrics.errorRate.toFixed(2)),
          failedJobsCount: performanceMetrics.failedJobsCount,
          activeWorkersCount: performanceMetrics.activeWorkersCount
        },
        queues: {
          waiting: performanceMetrics.queueSizes.waiting,
          active: performanceMetrics.queueSizes.active,
          completed: performanceMetrics.queueSizes.completed,
          failed: performanceMetrics.queueSizes.failed
        },
        recentBatches: recentBatches.map(b => ({
          batchId: b.batchId,
          createdAt: b.createdAt,
          total: b.total,
          processed: b.processed,
          failed: b.failed,
          averageMs: b.averageMs,
          medianMs: b.medianMs,
        })),
        recentMetrics: {
          processingTime: {
            count: processingTimeMetrics.length,
            latest: processingTimeMetrics.slice(0, 5).map(m => ({
              value: Math.round(m.metric_value),
              timestamp: m.timestamp
            }))
          },
          throughput: {
            count: throughputMetrics.length,
            latest: throughputMetrics.slice(0, 5).map(m => ({
              value: Number(m.metric_value.toFixed(2)),
              timestamp: m.timestamp
            }))
          },
          errors: {
            count: errorMetrics.length,
            latest: errorMetrics.slice(0, 5).map(m => ({
              type: m.metadata?.errorType || 'UNKNOWN',
              message: m.metadata?.errorMessage || 'No message',
              timestamp: m.timestamp
            }))
          }
        },
        periodInfo: {
          start: performanceMetrics.periodStart,
          end: performanceMetrics.periodEnd,
          duration: `${period} hours`
        }
      },
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('❌ Ошибка получения метрик:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Внутренняя ошибка сервера при получении метрик',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/queue/metrics/cleanup
 * Ручная очистка устаревших метрик
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (action === 'cleanup') {
      await metricsCollector.cleanupExpiredMetrics()

      return NextResponse.json({
        success: true,
        message: 'Устаревшие метрики очищены',
        timestamp: new Date().toISOString()
      })
    }

    return NextResponse.json(
      { error: 'Неизвестное действие. Доступные: cleanup' },
      { status: 400 }
    )

  } catch (error: any) {
    console.error('❌ Ошибка выполнения действия с метриками:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Внутренняя ошибка сервера',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    )
  }
}