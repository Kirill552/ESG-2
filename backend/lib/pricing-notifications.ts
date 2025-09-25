/**
 * Описание уведомлений о ценах для MVP ESG-Lite
 *
 * Проект 2025 года предполагает ручное управление тарифами через админку:
 * администратор сам выбирает подходящий пресет или формирует индивидуальное
 * уведомление. Этот модуль содержит типы данных и несколько готовых шаблонов,
 * которые используются EmailService для формирования писем.
 */

/**
 * Типы уведомлений о ценах, которые поддерживает текущий MVP.
 *
 * `manual` оставлен для полностью кастомных рассылок, когда администратор
 * хочет отправить сообщение вне стандартных сценариев.
 */
export type PricingNotificationType =
  | 'surge_start'
  | 'surge_end'
  | 'discount'
  | 'manual';

/**
 * Основной контракт уведомления о ценах.
 *
 * Все поля, кроме `type`, `title` и `message`, опциональны и нужны в первую
 * очередь для отображения в письмах и интерфейсе админки. Даты задаются в
 * формате ISO-8601 (YYYY-MM-DD), чтобы избежать проблем с региональными
 * настройками.
 */
export interface PricingNotification {
  /**
   * Тип уведомления определяет выбор шаблона в EmailService.
   */
  type: PricingNotificationType;

  /**
   * Заголовок уведомления. Отображается в письме и превью рассылки.
   */
  title: string;

  /**
   * Основной текст уведомления. Поддерживает многострочный формат.
   */
  message: string;

  /**
   * Ссылка, на которую стоит отправить пользователя (например, загрузка
   * документов или настройки доступа). Относительный путь от базового урла.
   */
  actionUrl?: string;

  /**
   * Текст кнопки действия. Если не задан, EmailService подставит дефолт.
   */
  actionText?: string;

  /**
   * Дата начала действия уведомления (например, старт сезонного периода).
   */
  effectiveFrom?: string;

  /**
   * Дата окончания действия уведомления.
   */
  effectiveTo?: string;

  /**
   * Описание сегмента аудитории (например, "все клиенты" или "только пилоты").
   * Используется только в админке, не попадает в письмо.
   */
  audienceDescription?: string;

  /**
   * Дополнительные сведения, которые могут пригодиться в админке.
   */
  metadata?: Record<string, string | number | boolean>;
}

/**
 * Входные данные для ручного создания уведомления через админку.
 */
export type ManualPricingNotificationInput =
  & {
    title: string;
    message: string;
    type?: PricingNotificationType;
  }
  & Partial<Omit<PricingNotification, 'type' | 'title' | 'message'>>;

/**
 * Базовые шаблоны уведомлений. Администратор может выбрать один из пресетов
 * и при необходимости отредактировать текст перед отправкой.
 */
export const pricingNotificationPresets: Record<
  'surgeStart' | 'surgeEnd' | 'discountReminder',
  PricingNotification
> = {
  surgeStart: {
    type: 'surge_start',
    title: 'Сезонное повышение тарифов 15–30 июня',
    message:
      'В период пиковых загрузок стоимость обработки документов увеличивается в 2 раза. Планируйте загрузки заранее, чтобы оптимизировать бюджет.',
    actionUrl: '/documents/upload',
    actionText: 'Подготовить документы',
    effectiveFrom: '2025-06-15',
    effectiveTo: '2025-06-30',
    audienceDescription: 'Все клиенты, у которых включена обработка документов',
    metadata: {
      season: 'summer-2025',
      manualDispatch: true
    }
  },
  surgeEnd: {
    type: 'surge_end',
    title: 'Сезонное повышение завершено — тарифы вернулись к базовым',
    message:
      'С 1 июля обработка документов снова доступна по базовым тарифам. Спасибо, что планировали загрузки заранее!',
    actionUrl: '/dashboard',
    actionText: 'Перейти в рабочий кабинет',
    effectiveFrom: '2025-07-01',
    audienceDescription: 'Все активные клиенты',
    metadata: {
      season: 'summer-2025',
      manualDispatch: true
    }
  },
  discountReminder: {
    type: 'discount',
    title: 'Успейте обработать документы до повышения тарифов',
    message:
      'До 14 июня действует базовый тариф. Загрузите накопившиеся документы прямо сейчас, чтобы сэкономить бюджет.',
    actionUrl: '/documents/upload',
    actionText: 'Загрузить документы',
    effectiveTo: '2025-06-14',
    audienceDescription: 'Компании с активной подпиской на обработку документов'
  }
};

/**
 * Утилита для создания полностью кастомных уведомлений через админку.
 *
 * Позволяет администратору быстро сформировать структуру уведомления, не
 * вспоминая точные названия полей. Дальше её можно передать в EmailService.
 */
export function createManualPricingNotification(
  params: ManualPricingNotificationInput
): PricingNotification {
  return {
    type: params.type ?? 'manual',
    title: params.title,
    message: params.message,
    actionUrl: params.actionUrl,
    actionText: params.actionText,
    effectiveFrom: params.effectiveFrom,
    effectiveTo: params.effectiveTo,
    audienceDescription: params.audienceDescription,
    metadata: params.metadata
  };
}
