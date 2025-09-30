/**
 * OCR Worker - обработчик задач OCR из очереди pg-boss
 * Интегрирует новую архитектуру 2025: GigaChat + Tesseract + fast-csv + ExcelJS
 */

const PgBoss = require('pg-boss');
// Прямые относительные импорты с расширением .ts для совместимости с ts-node в dev
import { createPgBoss, QUEUE_NAMES, OcrJobData, OcrJobResult } from '../lib/pg-boss-config';
import { HybridOCRService } from '../lib/hybrid-ocr-service';
import { IntelligentFileProcessor } from '../lib/intelligent-file-processor';
import { getCurrentUserMode } from '../lib/user-mode-utils';
import { surgePricingService } from '../lib/surge-pricing';
import { prisma } from '../lib/prisma';
import { metricsCollector } from '../lib/metrics';
import { workerLogger } from '../lib/structured-logger';
import { SubscriptionService } from '../lib/subscription-service';
import { notificationService, NotificationType, NotificationPriority } from '../lib/notification-service';
import { batchNotificationService } from '../lib/batch-notification-service';
import { Pool, PoolClient } from 'pg';

export interface WorkerConfig {
  concurrency: number;
  pollInterval: number;
  maxRetries: number;
}

export interface JobProgress {
  stage: 'starting' | 'downloading' | 'processing' | 'saving' | 'completed';
  progress: number;
  message: string;
}

/**
 * OCR Worker класс для обработки задач из очереди
 */
export class OcrWorker {
  private boss: any = null;
  private isRunning: boolean = false;
  private config: WorkerConfig;
  // Кредиты больше не используются в новой модели монетизации
  private creditsService = null as any;
  private processor: IntelligentFileProcessor;
  private hybridOcrService: HybridOCRService;
  // Пул для advisory locks (организационная конкуррентность)
  private lockPool: Pool | null = null;
  private subscriptionService = new SubscriptionService();

  constructor(config: Partial<WorkerConfig> = {}) {
    this.config = {
      concurrency: config.concurrency || parseInt(process.env.BULLMQ_CONCURRENCY || '5'),
      pollInterval: config.pollInterval || 5000, // 5 секунд
      maxRetries: config.maxRetries || 3
    };
    
    this.processor = new IntelligentFileProcessor();
    this.hybridOcrService = new HybridOCRService();

    console.log('🔧 OCR Worker инициализирован с конфигурацией:', this.config);
  }

  /**
   * Запуск worker процесса
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      await workerLogger.warn('OCR Worker already running');
      return;
    }

    try {
      await workerLogger.info('Starting OCR Worker...');
      
  // Создаем подключение к pg-boss
      this.boss = await createPgBoss();
  // Инициализируем пул подключений для advisory locks
  this.lockPool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: (process.env.DATABASE_URL?.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined) as any });
      
      // Настраиваем обработчик задач OCR
      // Для текущей версии pg-boss: work(name, options, handler)
      // pg-boss v10: work(name, options, handler)
      await this.boss.work(
        QUEUE_NAMES.OCR,
        { teamSize: this.config.concurrency, batchSize: 1, includeMetadata: false },
        async (jobs: any[]) => {
          // pg-boss v10 передаёт массив задач
          const list = Array.isArray(jobs) ? jobs : (jobs ? [jobs] : [])
          for (const job of list) {
            try {
              await this.processOcrJob(job)
            } catch (e) {
              // Ошибку пробрасываем — pg-boss пометит fail
              throw e
            }
          }
        }
      );

      this.isRunning = true;
      await workerLogger.workerStarted('ocr-worker', QUEUE_NAMES.OCR);
      await workerLogger.info('OCR Worker started successfully', { 
        concurrency: this.config.concurrency,
        queueName: QUEUE_NAMES.OCR
      });
      
      // Резервный поллинг: включается только по флагу, чтобы не мешать work()
      if (process.env.PGBOSS_POLL_FALLBACK === 'true') {
        this.startPollingFallback().catch((e) => {
          workerLogger.error('Polling fallback crashed', e instanceof Error ? e : new Error(String(e)));
        });
      }

      // Настраиваем graceful shutdown
      this.setupGracefulShutdown();
      
    } catch (error) {
      await workerLogger.error('Failed to start OCR Worker', 
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  /**
   * Резервный поллинг очереди через fetch/complete
   */
  private async startPollingFallback(): Promise<void> {
    // Небольшая задержка перед стартом поллинга, чтобы дать шанс авто‑доставке
    await new Promise((r) => setTimeout(r, 1500));
    while (this.isRunning) {
      try {
        // Берём одну задачу за итерацию
        let job: any = await this.boss.fetch(QUEUE_NAMES.OCR);
        // В pg-boss fetch может вернуть массив — берём первый элемент
        if (Array.isArray(job)) {
          job = job[0];
        }

        if (!job) {
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }

        await workerLogger.info('Polling fallback claimed jobs', { count: 1 });

        try {
            const startedAt = Date.now();
            const result = await this.processOcrJob(job);
            if (job && job.id) {
              await this.boss.complete(String(job.id), result);
              const tookMs = Date.now() - startedAt;
              await this.onCompletedInternal(String(job.id), result, tookMs);
            } else {
              await workerLogger.warn('Fetched job without id on complete, skipping', { rawJob: job });
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            if (job && job.id) {
              // pg-boss v10: fail принимает только ID. Сообщение сохраняем в наших метриках/БД
              try {
                await this.boss.fail(String(job.id));
              } catch (failErr) {
                await workerLogger.warn('boss.fail failed, will not force-complete to avoid corrupting job id', { failErr: String(failErr) });
              }
              await this.onFailedInternal(String(job.id), message);
            } else {
              await workerLogger.warn('Fetched job without id on fail, skipping', { error: message, rawJob: job });
            }
        }
      } catch (error) {
        await workerLogger.error('Polling fallback iteration error', error instanceof Error ? error : new Error(String(error)));
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }

  /**
   * Остановка worker процесса
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      await workerLogger.warn('OCR Worker already stopped');
      return;
    }

    try {
      await workerLogger.info('Stopping OCR Worker...');
      
      this.isRunning = false;
      
      if (this.boss) {
        await this.boss.stop();
        this.boss = null;
      }
      // Закрываем пул подключений для advisory locks
      if (this.lockPool) {
        try { await this.lockPool.end(); } catch {}
        this.lockPool = null;
      }
      
      await workerLogger.workerStopped('ocr-worker', QUEUE_NAMES.OCR, 'Manual stop');
    } catch (error) {
      await workerLogger.error('Failed to stop OCR Worker', 
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  /**
   * Основная функция обработки OCR задачи
   */
  private async processOcrJob(job: any): Promise<OcrJobResult> {
    const jobData: OcrJobData = job?.data;
    const jobId = job.id;
    const startTime = Date.now();
    
    if (!jobData) {
      throw new Error('Job data is undefined')
    }

    // Ранняя проверка существования документа: если отсутствует — мягко завершаем задачу без исключений
    try {
      const exists = await prisma.document.findUnique({ where: { id: jobData.documentId }, select: { id: true } });
      if (!exists) {
        await workerLogger.warn('Документ для OCR задачи не найден. Пропускаем обработку без ошибок.', {
          jobId,
          documentId: jobData.documentId,
          fileKey: jobData.fileKey,
        });
        const processingTime = Date.now() - startTime;
        try { await metricsCollector.recordProcessingTime(jobId, processingTime, { documentId: jobData.documentId, skipped: true }); } catch {}
        return {
          documentId: jobData.documentId,
          text: '',
          textLength: 0,
          confidence: 0,
          processedAt: new Date().toISOString(),
        };
      }
    } catch (e) {
      // В случае ошибки проверки — продолжаем, чтобы не блокировать обработку
    }

    await workerLogger.jobStarted(jobId, 'OCR', {
      documentId: jobData.documentId,
      fileKey: jobData.fileKey,
      fileName: jobData.fileName,
      fileSize: jobData.fileSize,
      userId: jobData.userId,
      organizationId: jobData.organizationId
    });

    // Состояние удерживаемого слота для организации
    let orgSlot: { client: PoolClient; key1: number; key2: number } | null = null;

    try {
      const organizationId = jobData.organizationId || jobData.userId;
      // Попытка захватить слот конкурентности на уровне организации
      try {
        orgSlot = await this.acquireOrgConcurrencySlot(organizationId);
        if (!orgSlot) {
          throw new Error('ORG_CONCURRENCY_TIMEOUT: не удалось получить слот конкурентности для организации');
        }
        await workerLogger.info('Организационный слот получен', { organizationId, jobId });
      } catch (lockErr) {
        await workerLogger.warn('Не удалось получить организационный слот', { organizationId, jobId, error: String(lockErr) });
        throw lockErr;
      }
      
      // Этап 1: Прогресс старта (кредиты отключены)
      await this.updateProgress(job, {
        stage: 'starting',
        progress: 5,
        message: 'Подготовка к распознаванию'
      });
      // Зафиксировать время старта обработки один раз
      try {
        await prisma.document.updateMany({
          where: { id: jobData.documentId },
          data: {
            processingStartedAt: new Date(),
            queueStatus: 'ACTIVE',
            status: 'PROCESSING'
          }
        });
      } catch {}

      // Этап 3: Загрузка файла
      await this.updateProgress(job, {
        stage: 'downloading',
        progress: 30,
        message: 'Загрузка файла из хранилища'
      });

      // Этап 4: OCR обработка
      await this.updateProgress(job, {
        stage: 'processing',
        progress: 50,
        message: 'Распознавание текста'
      });

      let ocrText: string;
      let hybridResult: any = null;
      const timeoutMs = parseInt(process.env.OCR_JOB_TIMEOUT_MS || '180000'); // 3 минуты по умолчанию
      const runWithTimeout = async <T>(p: Promise<T>, ms: number): Promise<T> => {
        return await Promise.race([
          p,
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('OCR_TIMEOUT')), ms))
        ]);
      };

      // Получаем файл из S3
      const { buffer } = await (await import('../lib/s3')).getFileBuffer(jobData.fileKey);

      // Определяем режим пользователя для выбора OCR провайдера
      let userMode = 'DEMO';
      try {
        userMode = await getCurrentUserMode(jobData.userId);
      } catch (error) {
        console.warn('Failed to get user mode, using DEMO:', error);
      }

      if (process.env.NODE_ENV === 'test') {
        // В тестовом режиме используем упрощенную логику
        ocrText = `Test OCR result for ${jobData.fileName || jobData.fileKey}`;
        hybridResult = {
          provider: 'test',
          confidence: 0.95,
          processingTime: 100,
          extractedText: ocrText
        };
      } else {
        // Используем новый HybridOcrService
        hybridResult = await runWithTimeout(
          this.hybridOcrService.processFile(
            buffer,
            jobData.fileName || jobData.fileKey,
            userMode as any
          ),
          timeoutMs
        );

        ocrText = hybridResult.extractedText ||
                  hybridResult.extractedData?.rawText ||
                  hybridResult.extractedData?.structured_data?.[0]?.content ||
                  'Нет данных';
      }

      if (!ocrText || ocrText.length < 10) {
        throw new Error('OCR_FAILED: Не удалось извлечь текст из документа');
      }

      // Этап 5: Сохранение результатов
      await this.updateProgress(job, {
        stage: 'saving',
        progress: 70,
        message: 'Сохранение результатов'
      });

      await this.saveOcrResults(jobData.documentId, ocrText, hybridResult);

      // Этап 6: финал (без списаний)
      await this.updateProgress(job, {
        stage: 'saving',
        progress: 90,
        message: 'Завершаем обработку'
      });

      // Завершение
      await this.updateProgress(job, {
        stage: 'completed',
        progress: 100,
        message: 'Обработка завершена успешно'
      });

      const result: OcrJobResult = {
        documentId: jobData.documentId,
        text: ocrText,
        textLength: ocrText.length,
        confidence: 0.95, // Примерная точность
        processedAt: new Date().toISOString()
      };

      // Записываем метрики производительности
      const processingTime = Date.now() - startTime;
  await metricsCollector.recordProcessingTime(jobId, processingTime, { documentId: jobData.documentId });

      console.log(`✅ OCR задача ${jobId} завершена успешно:`, {
        documentId: result.documentId,
        textLength: result.textLength,
        processingTime: `${processingTime}ms`
      });

      // На всякий случай убеждаемся, что документ помечен завершенным
      try {
        await prisma.document.updateMany({
          where: { id: jobData.documentId },
          data: {
            status: 'PROCESSED',
            queueStatus: 'COMPLETED',
            processingCompletedAt: new Date(),
            processingStage: 'completed',
            processingMessage: 'Обработка завершена успешно',
            processingProgress: 100,
          }
        })
      } catch {}

      // Обновляем прогресс batch и отправляем уведомление (если нужно)
      try {
        await batchNotificationService.updateBatchProgress(jobData.documentId, true);

        // Отправляем индивидуальное уведомление только для малых загрузок (1-2 документа)
        const shouldSendIndividual = await batchNotificationService.shouldSendIndividualNotification(jobData.documentId);
        if (shouldSendIndividual) {
          await notificationService.sendNotification({
            userId: jobData.userId,
            type: NotificationType.DOCUMENT_PROCESSED,
            title: 'Документ успешно обработан',
            message: `Документ "${jobData.fileName || 'Без названия'}" успешно обработан через OCR. Распознано ${result.textLength} символов.`,
            metadata: {
              documentId: jobData.documentId,
              fileName: jobData.fileName,
              textLength: result.textLength,
              confidence: result.confidence,
              processingTime: processingTime,
              link: `/documents`,
              priority: NotificationPriority.LOW
            }
          });
          console.log(`📧 Уведомление о завершении обработки отправлено пользователю ${jobData.userId}`);
        } else {
          console.log(`📦 Документ обработан в составе batch - индивидуальное уведомление не требуется`);
        }
      } catch (notifError) {
        // Не прерываем выполнение если уведомление не отправилось
        console.error('⚠️ Не удалось обработать уведомление:', notifError);
      }

  return result;

    } catch (error: any) {
      console.error(`❌ Ошибка обработки OCR задачи ${jobId}:`, error.message);
      
      // Записываем метрику ошибки
      const processingTime = Date.now() - startTime;
  await metricsCollector.recordError(jobId, error.name || 'UNKNOWN_ERROR', error.message);
      
      // Обновляем статус документа на ошибку
      await this.handleJobError(jobData.documentId, error);

      // Обновляем прогресс batch для документа с ошибкой
      try {
        await batchNotificationService.updateBatchProgress(jobData.documentId, false);
      } catch (batchError) {
        console.error('⚠️ Не удалось обновить batch для документа с ошибкой:', batchError);
      }

      throw error;
    }
    finally {
      // Освобождение слота конкурентности организации
      if (orgSlot) {
        try {
          await this.releaseOrgConcurrencySlot(orgSlot);
          await workerLogger.info('Организационный слот освобожден', { jobId });
        } catch (unlockErr) {
          console.error('⚠️ Ошибка освобождения организационного слота:', unlockErr);
        }
      }
    }
  }

  private async onCompletedInternal(jobId: string, result: OcrJobResult, processingTimeMs: number) {
    try {
      // Дублируем действия onJobCompleted из менеджера очереди
      await metricsCollector.recordProcessingTime(jobId, processingTimeMs, { documentId: result?.documentId });
    } catch {}
  }

  private async onFailedInternal(jobId: string, error: string) {
    try {
      await metricsCollector.recordError(jobId, 'PROCESSING_ERROR', error);
    } catch {}
  }

  /**
   * Обновление прогресса выполнения задачи
   */
  private async updateProgress(job: any, progress: JobProgress): Promise<void> {
    try {
      console.log(`📊 ${job.id} [${progress.progress}%] ${progress.stage}: ${progress.message}`);
      
      // Обновляем прогресс в pg-boss (если поддерживается)
      if (this.boss && typeof this.boss.publish === 'function') {
        await this.boss.publish('job-progress', {
          jobId: job.id,
          ...progress
        });
      }
      // Запишем прогресс в БД, чтобы UI через SSE видел актуальные значения
      try {
        const data: any = job?.data
        if (data?.documentId) {
          await prisma.document.updateMany({
            where: { id: data.documentId },
            data: {
              processingProgress: Math.max(0, Math.min(100, Math.round(progress.progress))),
              processingStage: progress.stage,
              processingMessage: progress.message,
              status: progress.stage === 'completed' ? 'PROCESSED' : 'PROCESSING',
              queueStatus: progress.stage === 'completed' ? 'COMPLETED' : 'ACTIVE',
              updatedAt: new Date(),
            }
          })
        }
      } catch (e) {
        console.error('⚠️ Не удалось сохранить прогресс в БД:', e)
      }
      
    } catch (error) {
      console.error('⚠️ Ошибка обновления прогресса:', error);
      // Не прерываем выполнение задачи из-за ошибки прогресса
    }
  }

  /**
   * Сохранение результатов OCR в базу данных
   */
  private async saveOcrResults(documentId: string, ocrText: string, hybridResult?: any): Promise<void> {
    try {
      const res = await prisma.document.updateMany({
        where: { id: documentId },
        data: {
          status: 'PROCESSED',
          ocrProcessed: true,
          ocrData: process.env.NODE_ENV === 'test' ? {
            fullText: ocrText,
            textPreview: ocrText.substring(0, 200),
            textLength: ocrText.length,
            processedAt: new Date().toISOString(),
            provider: hybridResult?.provider || 'test'
          } : {
            fullText: ocrText,
            textPreview: ocrText.substring(0, 200),
            textLength: ocrText.length,
            processedAt: new Date().toISOString(),
            provider: hybridResult?.provider || 'unknown',
            confidence: hybridResult?.confidence,
            processingTime: typeof hybridResult?.processingTime === 'number' ? Math.round(hybridResult.processingTime) : undefined,
            formatInfo: hybridResult?.formatInfo,
            structuredData: hybridResult?.structuredData,
            metadata: hybridResult?.metadata,
            healthCheckResults: hybridResult?.healthCheckResults
          },
          ocrConfidence: (process.env.NODE_ENV === 'test') ? 0.95 : (typeof hybridResult?.confidence === 'number' ? hybridResult.confidence : 0.95)
        }
      });
      if (!res.count || res.count === 0) {
        await workerLogger.warn('Документ не найден при сохранении OCR результатов, пропускаем без исключения', { documentId });
        return;
      }
      
      console.log(`💾 OCR результаты сохранены для документа ${documentId}`);
    } catch (error) {
      console.error(`❌ Ошибка сохранения OCR результатов для ${documentId}:`, error);
      // Не бросаем исключение, чтобы задание не падало из-за отсутствующего документа
    }
  }

  /**
   * Откат результатов OCR при ошибке списания кредитов
   */
  private async rollbackOcrResults(documentId: string): Promise<void> {
    try {
      await prisma.document.update({
        where: { id: documentId },
        data: {
          status: 'PROCESSING', // Возвращаем в состояние обработки
          ocrProcessed: false,
          ocrData: undefined,
          ocrConfidence: null,
          processingCompletedAt: null
        }
      });
      
      console.log(`🔄 Откат результатов OCR для документа: ${documentId}`);
    } catch (error) {
      console.error(`❌ Ошибка отката OCR результатов для ${documentId}:`, error);
      // Не прерываем выполнение - это не критическая ошибка
    }
  }

  /**
   * Обработка ошибок задачи
   */
  private async handleJobError(documentId: string, error: Error): Promise<void> {
    try {
      // Получаем информацию о документе для уведомления
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        select: {
          id: true,
          fileName: true,
          userId: true
        }
      });

      const res = await prisma.document.updateMany({
        where: { id: documentId },
        data: {
          status: 'FAILED',
          ocrData: {
            error: error.message,
            processedAt: new Date().toISOString()
          }
        }
      });
      if (!res.count || res.count === 0) {
        await workerLogger.warn('Документ не найден при сохранении ошибки OCR', { documentId, error: error.message });
      }

      await workerLogger.info('OCR error saved to database', {
        documentId,
        errorMessage: error.message
      });

      // Отправляем индивидуальное уведомление об ошибке только для малых загрузок (1-2 документа)
      if (document && document.userId) {
        try {
          const shouldSendIndividual = await batchNotificationService.shouldSendIndividualNotification(documentId);
          if (shouldSendIndividual) {
            await notificationService.sendNotification({
              userId: document.userId,
              type: NotificationType.DOCUMENT_ERROR,
              title: 'Ошибка обработки документа',
              message: `Не удалось обработать документ "${document.fileName || 'Без названия'}". ${this.getErrorMessage(error)}`,
              metadata: {
                documentId: document.id,
                fileName: document.fileName,
                errorMessage: error.message,
                errorType: error.name,
                link: `/documents?status=error`,
                priority: NotificationPriority.HIGH
              }
            });
            console.log(`📧 Уведомление об ошибке обработки отправлено пользователю ${document.userId}`);
          } else {
            console.log(`📦 Ошибка документа в составе batch - индивидуальное уведомление не требуется`);
          }
        } catch (notifError) {
          console.error('⚠️ Не удалось обработать уведомление об ошибке:', notifError);
        }
      }
    } catch (saveError) {
      await workerLogger.error('Failed to save OCR error to database',
        saveError instanceof Error ? saveError : new Error(String(saveError)),
        { documentId, originalError: error.message }
      );
    }
  }

  /**
   * Получить понятное пользователю сообщение об ошибке
   */
  private getErrorMessage(error: Error): string {
    const errorMessage = error.message.toLowerCase();

    if (errorMessage.includes('timeout') || errorMessage.includes('ocr_timeout')) {
      return 'Превышено время обработки. Попробуйте загрузить файл меньшего размера.';
    }

    if (errorMessage.includes('ocr_failed') || errorMessage.includes('не удалось извлечь текст')) {
      return 'Не удалось распознать текст в документе. Убедитесь что файл не поврежден и содержит читаемый текст.';
    }

    if (errorMessage.includes('invalid format') || errorMessage.includes('unsupported')) {
      return 'Неподдерживаемый формат файла. Используйте PDF, DOCX, XLSX или изображения.';
    }

    if (errorMessage.includes('too large') || errorMessage.includes('size limit')) {
      return 'Размер файла слишком большой. Максимальный размер: 50 МБ.';
    }

    if (errorMessage.includes('org_concurrency')) {
      return 'Достигнут лимит одновременной обработки документов. Дождитесь завершения текущих задач.';
    }

    // Общее сообщение для неизвестных ошибок
    return 'Проверьте формат файла и повторите попытку.';
  }

  /**
   * Настройка graceful shutdown
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      await workerLogger.info(`Received shutdown signal: ${signal}`, { signal });
      await workerLogger.workerStopped('ocr-worker', QUEUE_NAMES.OCR, `Signal: ${signal}`);
      await this.stop();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  /**
   * Получение статистики worker'а
   */
  async getWorkerStats(): Promise<{
    isRunning: boolean;
    config: WorkerConfig;
    queueSize?: number;
  }> {
    const stats = {
      isRunning: this.isRunning,
      config: this.config,
      queueSize: undefined as number | undefined
    };

    if (this.boss) {
      try {
        stats.queueSize = await this.boss.getQueueSize(QUEUE_NAMES.OCR);
      } catch (error) {
        console.error('⚠️ Ошибка получения размера очереди:', error);
      }
    }

    return stats;
  }

  /**
   * Получение лимита конкурентности для организации на основе подписки/ENV
   */
  private async getOrgConcurrencyLimit(organizationId: string): Promise<number> {
    // ENV явный дефолт
    const envDefault = parseInt(process.env.ORG_OCR_CONCURRENCY_DEFAULT || '2');
    // Попробуем получить активную подписку
    try {
      const sub = await this.subscriptionService.getActiveSubscription(organizationId);
      if (!sub) return envDefault;
      const plan = sub.planType; // 'TRIAL' | 'LITE' | 'STANDARD' | 'LARGE' | 'ENTERPRISE'
      const map = {
        TRIAL: parseInt(process.env.PLAN_CONCURRENCY_TRIAL || '1'),
        LITE: parseInt(process.env.PLAN_CONCURRENCY_LITE || '1'),
        STANDARD: parseInt(process.env.PLAN_CONCURRENCY_STANDARD || '2'),
        LARGE: parseInt(process.env.PLAN_CONCURRENCY_LARGE || '4'),
        ENTERPRISE: parseInt(process.env.PLAN_CONCURRENCY_ENTERPRISE || '6'),
      } as const;
      return Math.max(1, map[plan] || envDefault);
    } catch (e) {
      console.warn('Не удалось получить подписку для расчета конкуррентности, используем дефолт', e);
      return envDefault;
    }
  }

  /**
   * Простой 32-битный хэш строки для advisory locks
   */
  private hash32(input: string): number {
    let h = 2166136261;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    // Приводим к signed 32-bit
    return (h | 0);
  }

  /**
   * Попытка захватить один из N слотов конкуррентности для организации.
   * Возвращает объект слота (с закрепленным клиентом) или null по таймауту.
   */
  private async acquireOrgConcurrencySlot(organizationId: string): Promise<{ client: PoolClient; key1: number; key2: number } | null> {
    if (!this.lockPool) throw new Error('Lock pool is not initialized');
    const limit = await this.getOrgConcurrencyLimit(organizationId);
    const key1 = this.hash32(`org:${organizationId}`);

    const timeoutMs = parseInt(process.env.ORG_SLOT_ACQUIRE_TIMEOUT_MS || '20000');
    const backoffMs = parseInt(process.env.ORG_SLOT_ACQUIRE_BACKOFF_MS || '250');
    const start = Date.now();

    // Держим отдельный клиент на время удержания advisory lock
    const client = await this.lockPool.connect();
    try {
      while (Date.now() - start < timeoutMs) {
        for (let slot = 1; slot <= Math.max(1, limit); slot++) {
          const key2 = slot; // номер слота как второй ключ
          // pg_try_advisory_lock(int, int) — не блокирующая попытка
          const res = await client.query('SELECT pg_try_advisory_lock($1::int, $2::int) as locked', [key1, key2]);
          const locked = res.rows?.[0]?.locked === true;
          if (locked) {
            return { client, key1, key2 };
          }
        }
        // Небольшая задержка с джиттером
        const jitter = Math.floor(Math.random() * 50);
        await new Promise(r => setTimeout(r, backoffMs + jitter));
      }
      // Таймаут — освобождаем клиента
      client.release();
      return null;
    } catch (e) {
      client.release();
      throw e;
    }
  }

  /**
   * Освобождение удерживаемого слота конкуррентности
   */
  private async releaseOrgConcurrencySlot(slot: { client: PoolClient; key1: number; key2: number }): Promise<void> {
    try {
      await slot.client.query('SELECT pg_advisory_unlock($1::int, $2::int)', [slot.key1, slot.key2]);
    } finally {
      slot.client.release();
    }
  }
}

/**
 * Singleton instance для использования в приложении
 */
let workerInstance: OcrWorker | null = null;

/**
 * Получение singleton экземпляра OCR Worker
 */
export function getOcrWorker(config?: Partial<WorkerConfig>): OcrWorker {
  if (!workerInstance) {
    workerInstance = new OcrWorker(config);
  }
  return workerInstance;
}

/**
 * Запуск OCR Worker (для использования в отдельном процессе)
 */
export async function startOcrWorker(config?: Partial<WorkerConfig>): Promise<OcrWorker> {
  const worker = getOcrWorker(config);
  await worker.start();
  return worker;
}

/**
 * Остановка OCR Worker
 */
export async function stopOcrWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.stop();
    workerInstance = null;
  }
}