/**
 * Queue Manager для системы очередей на основе pg-boss
 * Интеграция с системой тарифов (без кредитов)
 * Задача 2.2: Обновить Queue Manager под новую монетизацию
 */

const PgBoss = require('pg-boss');
// Для ts-node: явно укажем расширение .ts при require из CJS-области
const PgBossCfg = require('./pg-boss-config.ts');
const createPgBoss = PgBossCfg.createPgBoss;
const QUEUE_NAMES = PgBossCfg.QUEUE_NAMES;
const JOB_PRIORITIES = PgBossCfg.JOB_PRIORITIES;
 type OcrJobData = any;
 type OcrJobResult = any;
 // Используем CJS require с явными .ts расширениями для совместимости с ts-node
 const { metricsCollector } = require('./metrics.ts');
 const { queueLogger } = require('./structured-logger.ts');
 const { surgePricingService } = require('./surge-pricing.ts');

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  total: number;
}

export interface DetailedQueueStats extends QueueStats {
  byStatus: Record<string, number>;
}

export interface ActiveJob {
  id: string;
  data: OcrJobData;
  createdAt: Date;
  startedAt?: Date;
  priority: number;
}

export interface FailedJob {
  id: string;
  data: OcrJobData;
  error: string;
  failedAt: Date;
  retryCount: number;
}

export interface PerformanceMetrics {
  averageProcessingTime: number;
  throughputPerHour: number;
  errorRate: number;
  queueHealth: 'healthy' | 'warning' | 'critical';
}

export interface JobStatus {
  id: string;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  progress?: number;
  result?: OcrJobResult;
  error?: string;
  createdAt: Date;
  processedAt?: Date;
  priority: number;
}

export interface AddJobOptions {
  priority?: 'normal' | 'high' | 'urgent';
  retryLimit?: number;
  expireInHours?: number;
}

// Заглушки удалены - используем отдельные сервисы

/**
 * Основной класс Queue Manager
 */
export class QueueManager {
  private boss: any | null = null;
  private schema: string = process.env.QUEUE_TABLE_PREFIX || 'pgboss';

  constructor() {}

  /**
   * Гарантируем готовность соединения с очередью
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.boss) {
      await this.initialize();
    }
  }

  /**
   * Инициализация pg-boss
   */
  async initialize(): Promise<void> {
    if (this.boss) {
      console.log('⚠️ Queue Manager уже инициализирован');
      return;
    }

    try {
      this.boss = await createPgBoss();
      
      // Создание очередей в тестах не требуется: pg-boss моки часто без createQueue
      if (typeof this.boss.createQueue === 'function') {
        try { await this.boss.createQueue(QUEUE_NAMES.OCR, { retryLimit: 3, retryDelay: 2000, expireInHours: 1 }); } catch {}
        try { await this.boss.createQueue(QUEUE_NAMES.PDF_GENERATION, { retryLimit: 2, retryDelay: 5000, expireInHours: 2 }); } catch {}
        try { await this.boss.createQueue(QUEUE_NAMES.CLEANUP, { retryLimit: 1, retryDelay: 10000, expireInHours: 23 }); } catch {}
        try { await this.boss.createQueue(QUEUE_NAMES.SESSION_CLEANUP, { retryLimit: 1, retryDelay: 30000, expireInHours: 1 }); } catch {}
      }
      
      console.log('✅ Queue Manager инициализирован успешно');
      console.log('✅ Очереди созданы:', Object.values(QUEUE_NAMES));
    } catch (error) {
      console.error('❌ Ошибка инициализации Queue Manager:', error);
      throw error;
    }
  }

  /**
   * Пауза всех задач OCR очереди (глобально)
   */
  async pauseAllOcr(): Promise<void> {
    if (!this.boss) throw new Error('Queue Manager не инициализирован');
    if (typeof this.boss.pause === 'function') {
      await this.boss.pause(QUEUE_NAMES.OCR);
    } else {
      throw new Error('pause unsupported by boss');
    }
  }

  /**
   * Возобновление OCR очереди (глобально)
   */
  async resumeAllOcr(): Promise<void> {
    if (!this.boss) throw new Error('Queue Manager не инициализирован');
    if (typeof this.boss.resume === 'function') {
      await this.boss.resume(QUEUE_NAMES.OCR);
    } else {
      throw new Error('resume unsupported by boss');
    }
  }

  /**
   * Проверка, поставлена ли OCR очередь на паузу (если поддерживается бэкендом)
   */
  async isOcrPaused(): Promise<boolean> {
    if (!this.boss) throw new Error('Queue Manager не инициализирован');
    // pg-boss напрямую не отдает paused, но многие обертки сохраняют состояние;
    // попытаемся спросить у boss, иначе возвращаем false по умолчанию
    try {
      if (typeof (this.boss as any).isPaused === 'function') {
        return await (this.boss as any).isPaused(QUEUE_NAMES.OCR);
      }
    } catch {}
    return false;
  }

  /**
   * Пауза задач по организации (пока заглушка: требуется тегирование задач)
   */
  async pauseOrganization(_organizationId: string): Promise<void> {
    // TODO: реализовать через отдельную очередь/тег/метку при отправке задач
    return this.pauseAllOcr();
  }

  /**
   * Возобновление задач по организации (пока заглушка)
   */
  async resumeOrganization(_organizationId: string): Promise<void> {
    return this.resumeAllOcr();
  }

  /**
   * Остановка pg-boss
   */
  async stop(): Promise<void> {
    if (this.boss) {
      await this.boss.stop();
      this.boss = null;
      console.log('🛑 Queue Manager остановлен');
    }
  }

  /**
   * Добавление задачи OCR в очередь (новая монетизация: без кредитов)
   */
  async addOcrJob(data: OcrJobData, options: AddJobOptions = {}): Promise<string | null> {
    if (!this.boss) {
      throw new Error('Queue Manager не инициализирован');
    }

    const organizationId = data.organizationId || data.userId;

    await queueLogger.debug('Starting OCR job addition', {
      documentId: data.documentId,
      organizationId,
      options
    });

    // Определяем приоритет
    let priority: number = JOB_PRIORITIES.NORMAL;
    
    if (options.priority === 'urgent') {
      priority = JOB_PRIORITIES.URGENT;
    } else if (options.priority === 'high') {
      priority = JOB_PRIORITIES.HIGH;
    }

    const envRetryLimit = parseInt(process.env.OCR_RETRY_LIMIT || '3');
    const envRetryDelay = parseInt(process.env.OCR_RETRY_DELAY_MS || '2000');
    const envRetryBackoff = (process.env.OCR_RETRY_BACKOFF || 'true').toLowerCase() !== 'false';
    const jobOptions = {
      priority,
      retryLimit: options.retryLimit || envRetryLimit,
      retryDelay: envRetryDelay,
      retryBackoff: envRetryBackoff,
      expireInHours: options.expireInHours || 1,
      // предотвращаем дубли: один активный job per document
      singletonKey: data?.documentId ? `ocr:${data.documentId}` : undefined,
      singletonSeconds: 60 // в течение минуты дубликаты не создаются
    } as any;

    const enrichedJobData = { ...data };

    await queueLogger.info('Adding OCR job to queue', {
      documentId: data.documentId,
      priority,
      jobOptions
    }, { organizationId });

    try {
  const jobId = await this.boss.send(QUEUE_NAMES.OCR, enrichedJobData, jobOptions);
      
      await queueLogger.info('OCR job created', {
        jobId,
        documentId: data.documentId,
        jobIdType: typeof jobId,
        jobIdLength: jobId ? String(jobId).length : 0
      }, { organizationId });
      
      if (!jobId || typeof jobId !== 'string' || jobId.trim() === '') {
        throw new Error(`Invalid job ID returned: ${JSON.stringify(jobId)}`);
      }
      
      await queueLogger.jobStarted(jobId, 'OCR', {
        documentId: data.documentId,
        priority,
        organizationId
      });
      
      return jobId;
      
    } catch (error) {
      await queueLogger.error('Failed to add OCR job to queue', error instanceof Error ? error : new Error(String(error)), {
        documentId: data.documentId,
        options: jobOptions
      }, { organizationId });
      
      throw error;
    }
  }

  /**
   * Запуск задачи очистки сессий
   */
  async scheduleSessionCleanup(): Promise<string | null> {
    if (!this.boss) {
      throw new Error('Queue Manager не инициализирован');
    }

    try {
      const jobId = await this.boss.send(QUEUE_NAMES.SESSION_CLEANUP, {
        timestamp: new Date().toISOString()
      }, {
        priority: JOB_PRIORITIES.LOW,
        retryLimit: 1,
        expireInHours: 1
      });

      console.log('🧹 Session cleanup job scheduled:', jobId);
      return jobId;
    } catch (error) {
      console.error('❌ Failed to schedule session cleanup job:', error);
      throw error;
    }
  }

  /**
   * Получение статуса задачи
   */
  async getJobStatus(jobId: string): Promise<JobStatus | null> {
  await this.ensureInitialized();

    try {
      const job = await this.boss.getJobById(QUEUE_NAMES.OCR, jobId);
      
      if (!job) {
        return null;
      }

      // Исправляем типы и названия полей согласно pg-boss API
      return {
        id: job.id,
        status: this.mapJobState(job.state),
        progress: (job.data as any)?.progress,
        result: job.output as OcrJobResult | undefined,
        error: (job.output as any)?.error,
        createdAt: job.createdOn,
        processedAt: job.completedOn || (job as any).failedOn,
        priority: job.priority || JOB_PRIORITIES.NORMAL
      };
    } catch (error) {
      console.error(`❌ Ошибка получения статуса задачи ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Получение статистики очередей
   */
  async getQueueStats(): Promise<QueueStats> {
  await this.ensureInitialized();

    try {
      // Упрощенная версия - получаем общий размер очереди
      const totalSize = await this.boss.getQueueSize(QUEUE_NAMES.OCR);
      
      // Заглушка для детальной статистики (в будущем можно улучшить)
      const stats = {
        waiting: totalSize,
        active: 0,
        completed: 0,
        failed: 0,
        total: totalSize
      };

      console.log('📊 Статистика очередей:', stats);
      return stats;
    } catch (error) {
      console.error('❌ Ошибка получения статистики очередей:', error);
      throw error;
    }
  }

  /**
   * Очистка завершенных задач в PostgreSQL
   */
  async cleanCompletedJobs(olderThanHours: number = 24): Promise<number> {
    if (!this.boss) {
      throw new Error('Queue Manager не инициализирован');
    }

    try {
      console.log(`🧹 Запуск очистки задач старше ${olderThanHours} часов`);
      
      // Получаем доступ к базе данных через pg-boss
      const db = (this.boss as any).db;
      
      if (!db) {
        console.log('⚠️ Нет доступа к БД, используем автоочистку pg-boss');
        return 0;
      }

      // Очищаем завершенные задачи старше указанного времени
      const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
      
      const result = await db.query(`
        DELETE FROM ${this.schema}.job 
        WHERE name = $1 
        AND state IN ('completed', 'failed') 
        AND completedon < $2
      `, [QUEUE_NAMES.OCR, cutoffTime]);
      
      const cleanedCount = result.rowCount || 0;
      console.log(`✅ Очищено ${cleanedCount} завершенных задач`);
      
      return cleanedCount;
    } catch (error) {
      console.error('❌ Ошибка очистки завершенных задач:', error);
      // Fallback: pg-boss делает автоочистку
      return 0;
    }
  }

  /**
   * Получение детальной статистики по статусам задач
   */
  async getDetailedQueueStats(): Promise<QueueStats & { byStatus: Record<string, number> }> {
    if (!this.boss) {
      throw new Error('Queue Manager не инициализирован');
    }

    try {
      const db = (this.boss as any).db;
      
      if (!db) {
        // Fallback к простой статистике
        const basicStats = await this.getQueueStats();
        return {
          ...basicStats,
          byStatus: { created: basicStats.waiting }
        };
      }

      // Получаем детальную статистику из БД
      const result = await db.query(`
        SELECT 
          state,
          COUNT(*) as count
        FROM ${this.schema}.job 
        WHERE name = $1 
        GROUP BY state
      `, [QUEUE_NAMES.OCR]);

      const byStatus: Record<string, number> = {};
      let waiting = 0, active = 0, completed = 0, failed = 0;

      result.rows.forEach((row: any) => {
        const count = parseInt(row.count);
        byStatus[row.state] = count;

        switch (row.state) {
          case 'created':
          case 'retry':
            waiting += count;
            break;
          case 'active':
            active += count;
            break;
          case 'completed':
            completed += count;
            break;
          case 'failed':
          case 'cancelled':
            failed += count;
            break;
        }
      });

      const stats = {
        waiting,
        active,
        completed,
        failed,
        total: waiting + active + completed + failed,
        byStatus
      };

      console.log('📊 Детальная статистика очередей:', stats);
      return stats;
    } catch (error) {
      console.error('❌ Ошибка получения детальной статистики:', error);
      // Fallback к простой статистике
      const basicStats = await this.getQueueStats();
      return {
        ...basicStats,
        byStatus: { unknown: basicStats.total }
      };
    }
  }

  /**
   * Получение списка активных задач
   */
  async getActiveJobs(limit: number = 10): Promise<Array<{
    id: string;
    data: OcrJobData;
    createdAt: Date;
    startedAt?: Date;
    priority: number;
  }>> {
    if (!this.boss) {
      throw new Error('Queue Manager не инициализирован');
    }

    try {
      const db = (this.boss as any).db;
      
      if (!db) {
        console.log('⚠️ Нет доступа к БД для получения активных задач');
        return [];
      }

      const result = await db.query(`
        SELECT 
          id,
          data,
          createdon,
          startedon,
          priority
        FROM ${this.schema}.job 
        WHERE name = $1 
        AND state = 'active'
        ORDER BY startedon DESC
        LIMIT $2
      `, [QUEUE_NAMES.OCR, limit]);

      return result.rows.map((row: any) => ({
        id: row.id,
        data: row.data,
        createdAt: row.createdon,
        startedAt: row.startedon,
        priority: row.priority || JOB_PRIORITIES.NORMAL
      }));
    } catch (error) {
      console.error('❌ Ошибка получения активных задач:', error);
      return [];
    }
  }

  /**
   * Получение списка неудачных задач для анализа
   */
  async getFailedJobs(limit: number = 10): Promise<Array<{
    id: string;
    data: OcrJobData;
    error: string;
    failedAt: Date;
    retryCount: number;
  }>> {
    if (!this.boss) {
      throw new Error('Queue Manager не инициализирован');
    }

    try {
      const db = (this.boss as any).db;
      
      if (!db) {
        console.log('⚠️ Нет доступа к БД для получения неудачных задач');
        return [];
      }

      const result = await db.query(`
        SELECT 
          id,
          data,
          output,
          completedon as failed_at,
          retrycount
        FROM ${this.schema}.job 
        WHERE name = $1 
        AND state = 'failed'
        ORDER BY completedon DESC
        LIMIT $2
      `, [QUEUE_NAMES.OCR, limit]);

      return result.rows.map((row: any) => ({
        id: row.id,
        data: row.data,
        error: row.output?.error || 'Unknown error',
        failedAt: row.failed_at,
        retryCount: row.retrycount || 0
      }));
    } catch (error) {
      console.error('❌ Ошибка получения неудачных задач:', error);
      return [];
    }
  }

  /**
   * Повторная обработка неудачной задачи
   */
  async retryFailedJob(jobId: string): Promise<string | null> {
    if (!this.boss) {
      throw new Error('Queue Manager не инициализирован');
    }

    try {
      // Получаем данные неудачной задачи
      const job = await this.boss.getJobById(QUEUE_NAMES.OCR, jobId);
      
      if (!job || job.state !== 'failed') {
        console.log(`⚠️ Задача ${jobId} не найдена или не в статусе failed`);
        return null;
      }

      // Создаем новую задачу с теми же данными
      const newJobId = await this.addOcrJob(job.data as OcrJobData, {
        priority: 'high' // Повторные задачи получают высокий приоритет
      });

      console.log(`🔄 Задача ${jobId} перезапущена как ${newJobId}`);
      return newJobId;
    } catch (error) {
      console.error(`❌ Ошибка повторной обработки задачи ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Отмена задачи (если она еще не начала выполняться)
   */
  async cancelJob(jobId: string): Promise<boolean> {
    if (!this.boss) {
      throw new Error('Queue Manager не инициализирован');
    }

    try {
      const result = await this.boss.cancel(jobId);
      
      if (result) {
        console.log(`❌ Задача ${jobId} отменена`);
      } else {
        console.log(`⚠️ Не удалось отменить задачу ${jobId} (возможно, уже выполняется)`);
      }
      
      return result;
    } catch (error) {
      console.error(`❌ Ошибка отмены задачи ${jobId}:`, error);
      return false;
    }
  }

  /**
   * Поиск задач по documentId в очереди OCR
   */
  async findJobsByDocumentId(documentId: string): Promise<Array<{ id: string }>> {
    if (!this.boss) throw new Error('Queue Manager не инициализирован');
    try {
      const db = (this.boss as any).db;
      if (!db) return [];
      const result = await db.query(
        `SELECT id FROM ${this.schema}.job WHERE name = $1 AND (data->>'documentId') = $2 AND state IN ('created','retry','active')`,
        [QUEUE_NAMES.OCR, documentId]
      );
      return result.rows.map((r: any) => ({ id: r.id }));
    } catch (e) {
      console.error('❌ Ошибка findJobsByDocumentId:', e);
      return [];
    }
  }

  /**
   * Отмена всех задач по documentId
   */
  async cancelJobsByDocumentId(documentId: string): Promise<number> {
    if (!this.boss) throw new Error('Queue Manager не инициализирован');
    try {
      const jobs = await this.findJobsByDocumentId(documentId);
      let cancelled = 0;
      for (const j of jobs) {
        const ok = await this.cancelJob(j.id);
        if (ok) cancelled++;
      }
      return cancelled;
    } catch (e) {
      console.error('❌ Ошибка cancelJobsByDocumentId:', e);
      return 0;
    }
  }

  /**
   * Получение метрик производительности очереди
   */
  async getPerformanceMetrics(): Promise<{
    averageProcessingTime: number;
    throughputPerHour: number;
    errorRate: number;
    queueHealth: 'healthy' | 'warning' | 'critical';
  }> {
    if (!this.boss) {
      throw new Error('Queue Manager не инициализирован');
    }

    try {
      // Используем новый MetricsCollector для получения метрик
      const metrics = await metricsCollector.getPerformanceMetrics(24);
      
      // Преобразуем в формат, ожидаемый API
      const throughputPerHour = metrics.throughputPerMinute * 60;
      
      // Определяем здоровье очереди
      let queueHealth: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (metrics.errorRate > 10) queueHealth = 'warning';
      if (metrics.errorRate > 30) queueHealth = 'critical';

      const result = {
        averageProcessingTime: metrics.averageProcessingTime,
        throughputPerHour,
        errorRate: metrics.errorRate,
        queueHealth
      };

      console.log('📈 Метрики производительности:', result);
      return result;
    } catch (error) {
      console.error('❌ Ошибка получения метрик производительности:', error);
      return {
        averageProcessingTime: 0,
        throughputPerHour: 0,
        errorRate: 0,
        queueHealth: 'warning' as const
      };
    }
  }

  /**
  * Обработка успешного завершения задачи
   */
  async onJobCompleted(jobId: string, result: OcrJobResult, processingTimeMs?: number): Promise<void> {
    console.log(`✅ Задача ${jobId} завершена успешно`);
    
    // Записываем метрику времени обработки
    if (processingTimeMs) {
      await metricsCollector.recordProcessingTime(jobId, processingTimeMs);
    }
  }

  /**
   * Обработка ошибки задачи (для записи метрик)
   */
  async onJobFailed(jobId: string, error: string, errorType: string = 'PROCESSING_ERROR'): Promise<void> {
    console.log(`❌ Задача ${jobId} завершилась с ошибкой: ${error}`);
    
    // Записываем метрику ошибки
    await metricsCollector.recordError(jobId, errorType, error);
  }

  /**
   * Получение информации о surge-pricing
   */
  async getSurgePricingInfo(): Promise<{ isSurge: boolean; multiplier: number }> {
    // Кредитная модель отключена — используем сервис surge-pricing напрямую
    const isSurge = surgePricingService.isSurgePeriod(new Date());
    const multiplier = surgePricingService.getSurgeMultiplier(new Date());
    return { isSurge, multiplier };
  }

  /**
   * Маппинг состояний pg-boss в наши статусы
   */
  private mapJobState(state: string): 'waiting' | 'active' | 'completed' | 'failed' {
    switch (state) {
      case 'created':
      case 'retry':
        return 'waiting';
      case 'active':
        return 'active';
      case 'completed':
        return 'completed';
      case 'failed':
      case 'cancelled':
        return 'failed';
      default:
        return 'waiting';
    }
  }

  // Удалены блокировки/списания кредитов — новая модель монетизации не использует кредиты
}

// Singleton instance
let queueManagerInstance: QueueManager | null = null;
let queueManagerInitializing: Promise<void> | null = null;

/**
 * Получение singleton экземпляра Queue Manager
 */
export async function getQueueManager(): Promise<QueueManager> {
  // Создаём инстанс и запускаем инициализацию лениво
  if (!queueManagerInstance) {
    queueManagerInstance = new QueueManager();
    queueManagerInitializing = queueManagerInstance.initialize()
      .catch((e: any) => {
        // При падении инициализации сбрасываем инстанс
        queueManagerInstance = null;
        throw e;
      })
      .finally(() => {
        queueManagerInitializing = null;
      });
    await queueManagerInitializing;
    return queueManagerInstance as QueueManager;
  }

  // Если кто-то уже создал инстанс, но инициализация ещё идёт — дождёмся
  if ((queueManagerInstance as any).boss == null) {
    if (queueManagerInitializing) {
      await queueManagerInitializing;
    } else {
      // Страховка: если boss пуст, а промиса нет — доинициализируем
      queueManagerInitializing = queueManagerInstance.initialize()
        .finally(() => {
          queueManagerInitializing = null;
        });
      await queueManagerInitializing;
    }
  }

  return queueManagerInstance;
}

/**
 * Остановка Queue Manager (для graceful shutdown)
 */
export async function stopQueueManager(): Promise<void> {
  if (queueManagerInstance) {
    await queueManagerInstance.stop();
    queueManagerInstance = null;
  }
}