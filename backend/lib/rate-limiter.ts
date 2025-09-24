/**
 * Rate Limiter - система ограничения запросов по организациям
 * Использует PostgreSQL для хранения счетчиков запросов
 * Кредитная модель отключена. Только rate limits по тарифам
 */

import { prisma } from './prisma';
import { surgePricingService } from './surge-pricing';

export interface RateLimitConfig {
  windowSizeMs: number;      // Размер временного окна в миллисекундах
  maxRequests: number;       // Максимальное количество запросов в окне
  cleanupIntervalMs: number; // Интервал очистки старых записей
  subscriptionLimits: {      // Лимиты для разных типов тарифов
    FREE: number;            // Бесплатный план
    LITE?: number;           // Тариф «Лайт» (из монетизации)
    STANDARD?: number;       // Тариф «Стандарт» (из монетизации)
    LARGE?: number;          // Тариф «Крупный» (из монетизации)
    ENTERPRISE?: number;     // Индивидуальный (из монетизации)
    // Старые ключи удалены
  };
}

export interface RateLimitResult {
  allowed: boolean;          // Разрешен ли запрос
  remaining: number;         // Оставшееся количество запросов
  resetTime: Date;          // Время сброса счетчика
  retryAfter?: number;      // Через сколько секунд можно повторить (если отклонен)
  reason?: string;          // Причина отклонения
  subscriptionType?: string; // Тип подписки
  // Убрано: кредиты
}

export interface RateLimitStats {
  organizationId: string;
  currentCount: number;
  maxRequests: number;
  windowStart: Date;
  windowEnd: Date;
  // Убрано: кредиты
  isSurgePeriod: boolean;
  subscriptionType: string;
  // Убрано: баланс кредитов
}

/**
 * Rate Limiter класс для ограничения запросов по организациям
 */
export class RateLimiter {
  private config: RateLimitConfig;
  private cleanupTimer: NodeJS.Timeout | null = null;
  // Кредиты отключены в новой модели монетизации

  constructor(config: Partial<RateLimitConfig> = {}) {
    // Значения по умолчанию теперь берутся из ENV, чтобы соответствовать тарифам из monetization-config
    const defaultLimits = {
      FREE: parseInt(process.env.RATE_LIMIT_FREE || '10'),
      LITE: parseInt(process.env.RATE_LIMIT_LITE || '100'),
      STANDARD: parseInt(process.env.RATE_LIMIT_STANDARD || '200'),
      LARGE: parseInt(process.env.RATE_LIMIT_LARGE || '500'),
      ENTERPRISE: parseInt(process.env.RATE_LIMIT_ENTERPRISE || '1000'),
      
    } as RateLimitConfig['subscriptionLimits'];

    this.config = {
      windowSizeMs: config.windowSizeMs || 60 * 60 * 1000, // 1 час по умолчанию
      maxRequests: config.maxRequests || 100,               // 100 запросов в час
      cleanupIntervalMs: config.cleanupIntervalMs || 5 * 60 * 1000, // Очистка каждые 5 минут
      subscriptionLimits: { ...defaultLimits, ...(config.subscriptionLimits || {}) }
    };

    // Кредитов нет — ничего не инициализируем

    // используем общий singleton creditsService (мокается в тестах)

    console.log('🔧 Rate Limiter инициализирован:', {
      windowSizeMs: this.config.windowSizeMs,
      maxRequests: this.config.maxRequests,
      cleanupIntervalMs: this.config.cleanupIntervalMs,
      subscriptionLimits: this.config.subscriptionLimits
    });

    // Не запускаем таймер в конструкторе - только по запросу
    // this.startCleanupTimer();
  }

  /**
   * Проверка лимита запросов для организации
   */
  async checkLimit(organizationId: string): Promise<RateLimitResult> {
    try {
      console.log(`🔍 Проверка лимита для организации: ${organizationId}`);

      // 1. Блок кредитов удалён: используем только rate limit и тарифные лимиты
      let subscriptionType: string | undefined = 'FREE';

      // 2. Определяем лимиты
      const maxRequests = await this.getEffectiveMaxRequests(organizationId, subscriptionType);

      // 3. Получаем текущее временное окно
      const windowStart = this.getCurrentWindowStart();
      const windowEnd = new Date(windowStart.getTime() + this.config.windowSizeMs);

      // 4. Получаем или создаем запись лимита
      const rateLimitRecord = await this.getOrCreateRateLimit(organizationId, windowStart);
      
      if (rateLimitRecord.requestCount >= maxRequests) {
        console.log(`❌ Превышен лимит для ${organizationId}: ${rateLimitRecord.requestCount}/${maxRequests} (Тариф: ${subscriptionType})`);
        
        const retryAfter = Math.ceil((windowEnd.getTime() - Date.now()) / 1000);
        
        return {
          allowed: false,
          remaining: 0,
          resetTime: windowEnd,
          retryAfter,
          reason: 'RATE_LIMIT_EXCEEDED',
          subscriptionType
        };
      }

      // 5. Запрос разрешен
      const remaining = maxRequests - rateLimitRecord.requestCount;

      console.log(`✅ Лимит OK для ${organizationId}: ${rateLimitRecord.requestCount}/${maxRequests} (осталось: ${remaining}, Тариф: ${subscriptionType})`);

      return { allowed: true, remaining, resetTime: windowEnd, subscriptionType };

    } catch (error) {
      console.error(`❌ Ошибка проверки лимита для ${organizationId}:`, error);
      
      // В случае ошибки разрешаем запрос (fail-open)
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetTime: new Date(Date.now() + this.config.windowSizeMs),
        reason: 'ERROR_FALLBACK'
      };
    }
  }

  /**
   * Совместимость со старыми тестами/кодом: алиас метода checkLimit
   * Некоторые тесты мокают RateLimiter.prototype.check, поэтому оставляем
   * тонкую обертку, делегирующую в актуальный checkLimit.
   */
  async check(organizationId: string): Promise<RateLimitResult> {
    return this.checkLimit(organizationId);
  }

  /**
   * Увеличение счетчика запросов
   */
  async incrementCounter(organizationId: string): Promise<void> {
    try {
      console.log(`📈 Увеличение счетчика для ${organizationId}`);

      const windowStart = this.getCurrentWindowStart();
      
      // Увеличиваем счетчик в базе данных
      await prisma.rateLimit.upsert({
        where: {
          organizationId_windowStart: {
            organizationId,
            windowStart
          }
        },
        update: {
          requestCount: {
            increment: 1
          },
          updatedAt: new Date()
        },
        create: {
          organizationId,
          requestCount: 1,
          windowStart,
          updatedAt: new Date()
        }
      });

      console.log(`✅ Счетчик увеличен для ${organizationId}`);

    } catch (error) {
      console.error(`❌ Ошибка увеличения счетчика для ${organizationId}:`, error);
      // Не прерываем выполнение, только логируем
    }
  }

  /**
   * Получение статистики лимитов для организации
   */
  async getStats(organizationId: string): Promise<RateLimitStats> {
    try {
      const windowStart = this.getCurrentWindowStart();
      const windowEnd = new Date(windowStart.getTime() + this.config.windowSizeMs);

      // Получаем текущую запись лимита
      const rateLimitRecord = await prisma.rateLimit.findUnique({
        where: {
          organizationId_windowStart: {
            organizationId,
            windowStart
          }
        }
      });

      // Кредиты отключены — используем базовый тип и surge от сервиса
      const subscriptionType = 'FREE';
      const maxRequests = await this.getEffectiveMaxRequests(organizationId, subscriptionType);
      
      const currentCount = rateLimitRecord?.requestCount || 0;
      const isSurgePeriod = surgePricingService.isSurgePeriod(new Date());

      return {
        organizationId,
        currentCount,
        maxRequests,
        windowStart,
        windowEnd,
        isSurgePeriod,
        subscriptionType,
        
      };

    } catch (error) {
      console.error(`❌ Ошибка получения статистики для ${organizationId}:`, error);
      
      // Возвращаем базовую статистику
      const windowStart = this.getCurrentWindowStart();
      return {
        organizationId,
        currentCount: 0,
        maxRequests: this.config.maxRequests,
        windowStart,
        windowEnd: new Date(windowStart.getTime() + this.config.windowSizeMs),
        isSurgePeriod: false,
        subscriptionType: 'FREE',
        
      };
    }
  }

  /**
   * Сброс лимитов для организации (для тестирования)
   */
  async resetLimits(organizationId: string): Promise<void> {
    try {
      console.log(`🔄 Сброс лимитов для ${organizationId}`);

      await prisma.rateLimit.deleteMany({
        where: {
          organizationId
        }
      });

      console.log(`✅ Лимиты сброшены для ${organizationId}`);

    } catch (error) {
      console.error(`❌ Ошибка сброса лимитов для ${organizationId}:`, error);
    }
  }

  /**
   * Проверка возможности выполнения операции с учетом кредитов и лимитов
   */
  async canPerformOperation(organizationId: string, operationType: 'ocr' | 'report_generation' | 'api_call' = 'ocr'): Promise<{
    allowed: boolean;
    reason?: string;
    rateLimitResult?: RateLimitResult;
  }> {
    try {
      // 1. Проверяем rate limit
      const rateLimitResult = await this.checkLimit(organizationId);
      
      if (!rateLimitResult.allowed) {
        return {
          allowed: false,
          reason: rateLimitResult.reason,
          rateLimitResult
        };
      }

      // 2. Кредиты убраны — достаточно пройденного rate limit
      return { allowed: true, rateLimitResult };

    } catch (error) {
      console.error(`❌ Ошибка проверки возможности операции для ${organizationId}:`, error);
      return {
        allowed: false,
        reason: 'ERROR_CHECKING_OPERATION'
      };
    }
  }

  /**
   * Получение эффективного максимального количества запросов с учетом типа подписки и surge-pricing
   */
  private async getEffectiveMaxRequests(organizationId: string, subscriptionType?: string): Promise<number> {
    // Базовый лимит: если нет подробной информации о плане, используем this.config.maxRequests (как в старых тестах)
    let baseLimit: number;
    if (!subscriptionType) {
      baseLimit = this.config.maxRequests;
    } else {
      const subType = (subscriptionType || 'FREE').toUpperCase();
      const keysInOrder: Array<keyof RateLimitConfig['subscriptionLimits']> = [
        subType as any,
        (subType + '_ANNUAL') as any,
        'FREE'
      ];
      baseLimit = this.config.subscriptionLimits.FREE;
      for (const key of keysInOrder) {
        const v = (this.config.subscriptionLimits as any)[key];
        if (typeof v === 'number' && !Number.isNaN(v)) {
          baseLimit = v;
          break;
        }
      }
    }

    // Surge: используем только сервис surgePricing (ENV)
    try {
      if (surgePricingService.isSurgePeriod(new Date())) {
        return Math.floor(baseLimit * 0.5);
      }
    } catch {
      // ignore, вернем baseLimit
    }
    return baseLimit;
  }

  /**
   * Получение или создание записи лимита
   */
  private async getOrCreateRateLimit(organizationId: string, windowStart: Date) {
    return await prisma.rateLimit.upsert({
      where: {
        organizationId_windowStart: {
          organizationId,
          windowStart
        }
      },
      update: {},
      create: {
        organizationId,
        requestCount: 0,
        windowStart
      }
    });
  }

  /**
   * Получение начала текущего временного окна
   */
  private getCurrentWindowStart(): Date {
    const now = Date.now();
    const windowStart = Math.floor(now / this.config.windowSizeMs) * this.config.windowSizeMs;
    return new Date(windowStart);
  }

  /**
   * Запуск таймера очистки старых записей
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(async () => {
      await this.cleanupOldRecords();
    }, this.config.cleanupIntervalMs);

    console.log(`🧹 Таймер очистки запущен (интервал: ${this.config.cleanupIntervalMs}ms)`);
  }

  /**
   * Очистка старых записей лимитов
   */
  private async cleanupOldRecords(): Promise<void> {
    try {
      const cutoffTime = new Date(Date.now() - this.config.windowSizeMs * 2); // Удаляем записи старше 2 окон
      
      const result = await prisma.rateLimit.deleteMany({
        where: {
          windowStart: {
            lt: cutoffTime
          }
        }
      });

      if (result.count > 0) {
        console.log(`🧹 Очищено ${result.count} старых записей лимитов`);
      }

    } catch (error) {
      console.error('❌ Ошибка очистки старых записей:', error);
    }
  }

  /**
   * Остановка Rate Limiter и очистка ресурсов
   */
  async stop(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
      console.log('🛑 Таймер очистки остановлен');
    }

    // Финальная очистка
    await this.cleanupOldRecords();
    console.log('✅ Rate Limiter остановлен');
  }
}

/**
 * Singleton instance для использования в приложении
 */
let rateLimiterInstance: RateLimiter | null = null;

/**
 * Получение singleton экземпляра Rate Limiter
 */
export function getRateLimiter(config?: Partial<RateLimitConfig>): RateLimiter {
  if (!rateLimiterInstance) {
    rateLimiterInstance = new RateLimiter(config);
  }
  return rateLimiterInstance;
}

/**
 * Экспорт для удобного использования - ленивая инициализация
 */
export const rateLimiter = {
  get instance() {
    return getRateLimiter();
  }
};