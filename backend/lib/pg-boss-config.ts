/**
 * Конфигурация pg-boss для управления очередями OCR
 */

import PgBoss from 'pg-boss';

export const QUEUE_NAMES = {
  OCR: 'ocr-processing',
  REPORT_GENERATION: 'report-generation',
  EMAIL: 'email-sending',
  CLEANUP: 'file-cleanup',
} as const;

export interface OcrJobData {
  documentId: string;
  userId: string;
  fileKey: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  category?: string;
  userMode?: 'DEMO' | 'TRIAL' | 'PAID' | 'EXPIRED';
}

export interface OcrJobResult {
  success: boolean;
  text?: string;
  confidence?: number;
  provider?: string;
  extractedData?: any;
  error?: string;
  processingTime?: number;
}

export interface ReportJobData {
  reportId: string;
  userId: string;
  reportType: string;
  data: any;
}

export interface EmailJobData {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Создает и настраивает экземпляр pg-boss
 */
export async function createPgBoss(): Promise<PgBoss> {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL не установлена в переменных окружения');
  }

  const boss = new PgBoss({
    connectionString,
    // Настройки для production
    max: 10, // максимум подключений в пуле
    retryLimit: 3, // количество попыток при ошибке
    retryDelay: 60, // задержка между попытками в секундах
    expireInHours: 1, // время жизни задачи (макс 24 часа, ставим 1)
    retentionDays: 7, // хранить завершенные задачи 7 дней
    deleteAfterDays: 30, // окончательное удаление через 30 дней

    // Настройки мониторинга
    monitorStateIntervalSeconds: 60,
    maintenanceIntervalSeconds: 300, // 5 минут

    // SSL для подключения через туннель
    ssl: connectionString.includes('sslmode=require') ? {
      rejectUnauthorized: false
    } : false
  });

  await boss.start();
  console.log('✅ pg-boss подключен и запущен');

  return boss;
}

/**
 * Добавляет задачу OCR в очередь
 */
export async function enqueueOcrJob(boss: PgBoss, data: OcrJobData): Promise<string> {
  const jobId = await boss.send(QUEUE_NAMES.OCR, data, {
    retryLimit: 3,
    retryDelay: 30, // 30 секунд между попытками
    expireInMinutes: 30, // задача истекает через 30 минут
  });

  console.log(`📤 OCR задача добавлена в очередь: ${jobId}`, {
    documentId: data.documentId,
    fileName: data.fileName,
  });

  return jobId as string;
}

/**
 * Добавляет задачу генерации отчёта в очередь
 */
export async function enqueueReportJob(boss: PgBoss, data: ReportJobData): Promise<string> {
  const jobId = await boss.send(QUEUE_NAMES.REPORT_GENERATION, data, {
    retryLimit: 2,
    retryDelay: 60,
    expireInMinutes: 60,
  });

  console.log(`📤 Задача генерации отчёта добавлена: ${jobId}`, {
    reportId: data.reportId,
  });

  return jobId as string;
}

/**
 * Добавляет задачу отправки email в очередь
 */
export async function enqueueEmailJob(boss: PgBoss, data: EmailJobData): Promise<string> {
  const jobId = await boss.send(QUEUE_NAMES.EMAIL, data, {
    retryLimit: 5,
    retryDelay: 120, // 2 минуты между попытками
    expireInHours: 6,
  });

  console.log(`📤 Email задача добавлена: ${jobId}`, { to: data.to });

  return jobId as string;
}

/**
 * Получает статус очередей
 */
export async function getQueueStats(boss: PgBoss) {
  const queues = Object.values(QUEUE_NAMES);
  const stats: Record<string, any> = {};

  for (const queueName of queues) {
    try {
      // pg-boss v10 API
      const queueSize = await boss.getQueueSize(queueName);
      stats[queueName] = {
        size: queueSize,
        active: queueSize, // В v10 нет отдельного метода для active
      };
    } catch (error) {
      stats[queueName] = { error: 'Не удалось получить статистику' };
    }
  }

  return stats;
}
