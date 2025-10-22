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

// pg-boss v11 совместимый интерфейс
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

// Singleton для pg-boss
let bossInstance: PgBoss | null = null;

/**
 * Получает экземпляр pg-boss (singleton)
 */
export async function getBoss(): Promise<PgBoss> {
  if (bossInstance) {
    console.log('♻️  Используем существующий экземпляр pg-boss');
    return bossInstance;
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL не установлена в переменных окружения');
  }

  console.log('🔧 Создаем новый экземпляр pg-boss...');
  console.log('📡 DATABASE_URL:', connectionString.replace(/:[^:@]+@/, ':****@')); // Скрываем пароль

  bossInstance = new PgBoss({
    connectionString,

    // pg-boss v11: явно указываем схему
    schema: 'pgboss',

    // Настройки пула подключений
    max: 10, // максимум подключений в пуле

    // Настройки задач (v11 использует секунды вместо часов)
    retryLimit: 3,
    retryDelay: 60,
    expireInSeconds: 3600, // 1 час (в v11 используем секунды!)
    retentionDays: 7,
    deleteAfterDays: 30,

    // Мониторинг и обслуживание
    monitorStateIntervalSeconds: 60,
    maintenanceIntervalSeconds: 300,

    // Архивирование
    archiveCompletedAfterSeconds: 3600,

    // SSL настройки
    ssl: connectionString.includes('sslmode=require') ? {
      rejectUnauthorized: false
    } : false
  });

  console.log('🚀 Запускаем pg-boss и создаем схему...');

  try {
    await bossInstance.start();
    console.log('✅ pg-boss подключен и запущен');

    // Проверяем, что можем создать задачу (тест работоспособности v11)
    console.log('🧪 Проверяем работоспособность очереди (pg-boss v11)...');

    // v11 требует явного создания очереди перед отправкой задач
    await bossInstance.createQueue('test-queue');

    const testJobId = await bossInstance.send('test-queue', { test: 'data' }, {
      retryLimit: 0,
      expireInSeconds: 60 // v11 использует секунды!
    });

    if (testJobId) {
      console.log(`✅ Тестовая задача создана успешно: ${testJobId}`);
      // Сразу удаляем тестовую задачу
      await bossInstance.cancel(testJobId).catch(() => {});
    } else {
      console.error('⚠️ КРИТИЧЕСКАЯ ОШИБКА: boss.send() вернул null!');
      console.error('⚠️ Возможные причины:');
      console.error('   1. Нет прав на создание схемы pgboss');
      console.error('   2. Схема pgboss уже существует с неправильной версией');
      console.error('   3. Проблемы с подключением к БД');
    }
  } catch (startError) {
    console.error('❌ Ошибка запуска pg-boss:', startError);
    throw startError;
  }

  return bossInstance;
}

/**
 * Создает и настраивает экземпляр pg-boss (deprecated, используй getBoss)
 * @deprecated Используй getBoss() вместо этого
 */
export async function createPgBoss(): Promise<PgBoss> {
  return getBoss();
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
