/**
 * Email Service с Retry логикой
 * Задача 7.8: Интеграция NotificationService с RuSender
 *
 * Реализует retry с exponential backoff и обработку специфичных ошибок RuSender
 */

import { sendEmailViaRuSender, type RuSenderSendResult } from './rusender';
import { Logger } from './logger';

const logger = new Logger('email-service-retry');

export interface EmailSendOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  fromEmail?: string;
  fromName?: string;
}

export interface RetryOptions {
  maxRetries?: number; // Максимальное количество попыток (по умолчанию 3)
  initialDelay?: number; // Начальная задержка в мс (по умолчанию 1000)
  maxDelay?: number; // Максимальная задержка в мс (по умолчанию 30000)
  backoffFactor?: number; // Множитель для exponential backoff (по умолчанию 2)
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  attempts: number;
  retryable: boolean;
}

/**
 * Проверить, можно ли повторить отправку для данной ошибки
 */
function isRetryableError(error: string | unknown): boolean {
  if (typeof error !== 'string') {
    return true; // Network ошибки retry-able
  }

  const errorLower = error.toLowerCase();

  // НЕ retry-able ошибки (постоянные)
  const permanentErrors = [
    'неверный api ключ',
    'api ключ не активирован',
    'домен не верифицирован',
    'пользователь не найден',
    'домен не найден',
    'email получателя не существует',
    'получатель отписался',
    'получатель пожаловался',
    'неверный формат запроса',
    'ошибка валидации'
  ];

  for (const permanent of permanentErrors) {
    if (errorLower.includes(permanent)) {
      return false;
    }
  }

  // Retry-able ошибки (временные)
  const temporaryErrors = [
    'недостаточно средств',
    'сервис временно недоступен',
    'network error',
    'timeout',
    'econnreset',
    'enotfound',
    'http 5'
  ];

  for (const temporary of temporaryErrors) {
    if (errorLower.includes(temporary)) {
      return true;
    }
  }

  // По умолчанию считаем ошибку retry-able
  return true;
}

/**
 * Рассчитать задержку с exponential backoff и jitter
 */
function calculateDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  backoffFactor: number
): number {
  // Exponential backoff: delay * (factor ^ attempt)
  const exponentialDelay = initialDelay * Math.pow(backoffFactor, attempt);

  // Добавляем jitter (случайное отклонение ±20%) для предотвращения thundering herd
  const jitter = exponentialDelay * 0.2 * (Math.random() * 2 - 1);
  const delayWithJitter = exponentialDelay + jitter;

  // Ограничиваем максимальной задержкой
  return Math.min(delayWithJitter, maxDelay);
}

/**
 * Задержка выполнения
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Отправить email с retry логикой
 */
export async function sendEmailWithRetry(
  options: EmailSendOptions,
  retryOptions: RetryOptions = {}
): Promise<EmailSendResult> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffFactor = 2
  } = retryOptions;

  let lastError: string | unknown = 'Unknown error';
  let attempts = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    attempts++;

    try {
      logger.info(`Попытка ${attempt + 1}/${maxRetries + 1} отправки email`, {
        to: options.to,
        subject: options.subject
      });

      const result: RuSenderSendResult = await sendEmailViaRuSender(options);

      if (result.status === 'ok') {
        logger.info('Email успешно отправлен', {
          to: options.to,
          messageId: result.message_id,
          attempts
        });

        return {
          success: true,
          messageId: result.message_id,
          attempts,
          retryable: false
        };
      }

      if (result.status === 'skipped') {
        logger.warn('Отправка email пропущена', {
          reason: result.error,
          to: options.to
        });

        return {
          success: false,
          error: String(result.error),
          attempts,
          retryable: false
        };
      }

      // result.status === 'error'
      lastError = result.error;
      const errorString = String(lastError);

      logger.error(`Ошибка отправки email (попытка ${attempt + 1})`,
        lastError instanceof Error ? lastError : new Error(errorString),
        { to: options.to, attempt: attempt + 1 }
      );

      // Проверяем, можно ли повторить отправку
      const retryable = isRetryableError(lastError);

      if (!retryable) {
        logger.warn('Ошибка не является временной, retry отменен', {
          error: errorString,
          to: options.to
        });

        return {
          success: false,
          error: errorString,
          attempts,
          retryable: false
        };
      }

      // Если это не последняя попытка, ждём перед повтором
      if (attempt < maxRetries) {
        const delay = calculateDelay(attempt, initialDelay, maxDelay, backoffFactor);
        logger.info(`Ожидание ${Math.round(delay)}мс перед следующей попыткой`, {
          attempt: attempt + 1,
          maxRetries
        });
        await sleep(delay);
      }

    } catch (error) {
      lastError = error;

      logger.error(`Неожиданная ошибка при отправке email (попытка ${attempt + 1})`,
        error instanceof Error ? error : new Error(String(error)),
        { to: options.to, attempt: attempt + 1 }
      );

      // Неожиданные ошибки всегда retry-able
      if (attempt < maxRetries) {
        const delay = calculateDelay(attempt, initialDelay, maxDelay, backoffFactor);
        await sleep(delay);
      }
    }
  }

  // Все попытки исчерпаны
  const errorString = String(lastError);
  logger.error('Все попытки отправки email исчерпаны',
    lastError instanceof Error ? lastError : new Error(errorString),
    { to: options.to, attempts }
  );

  return {
    success: false,
    error: errorString,
    attempts,
    retryable: isRetryableError(lastError)
  };
}

/**
 * Обновленная функция sendEmail для обратной совместимости
 */
export async function sendEmail(options: EmailSendOptions): Promise<{ status: 'ok' | 'error'; error?: string }> {
  const result = await sendEmailWithRetry(options);

  if (result.success) {
    return { status: 'ok' };
  }

  return {
    status: 'error',
    error: result.error
  };
}

/**
 * Экспорт типов и функций
 */
export { isRetryableError, calculateDelay };