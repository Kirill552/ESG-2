import { prisma } from './prisma';
import { sendEmailWithRetry } from './email-service-with-retry';
import { emailTemplates } from './email-templates';

/**
 * Типы уведомлений в системе
 */
export enum NotificationType {
  // Документы
  DOCUMENT_UPLOADED = 'document_uploaded',
  DOCUMENT_PROCESSED = 'document_processed',
  DOCUMENT_ERROR = 'document_error',
  DOCUMENT_DATA_EDITED = 'document_data_edited',

  // Отчеты
  REPORT_READY = 'report_ready',
  REPORT_ERROR = 'report_error',
  REPORT_SUBMITTED = 'report_submitted',
  REPORT_APPROVED = 'report_approved',

  // Дедлайны
  DEADLINE_30_DAYS = 'deadline_30_days',
  DEADLINE_7_DAYS = 'deadline_7_days',
  DEADLINE_1_DAY = 'deadline_1_day',
  DEADLINE_OVERDUE = 'deadline_overdue',

  // Система
  SYSTEM_ALERT = 'system_alert',
  SYSTEM_ERROR = 'system_error',
  USER_FEEDBACK = 'user_feedback',
  ACCOUNT_UPDATE = 'account_update'
}

/**
 * Приоритеты уведомлений
 */
export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

/**
 * Интерфейс для создания уведомления
 */
interface CreateNotificationInput {
  userId: string;
  type: NotificationType | string;
  title: string;
  message: string;
  metadata?: {
    documentId?: string;
    reportId?: string;
    link?: string;
    priority?: NotificationPriority;
    [key: string]: any;
  };
}

/**
 * Интерфейс настроек отправки
 */
interface SendOptions {
  email?: boolean;
  push?: boolean;
  ignorePreferences?: boolean; // Для критических уведомлений
}

/**
 * Сервис для работы с уведомлениями
 */
class NotificationService {
  /**
   * Создать уведомление в БД
   */
  async createNotification(input: CreateNotificationInput) {
    try {
      const notification = await prisma.notification.create({
        data: {
          userId: input.userId,
          type: input.type,
          title: input.title,
          message: input.message,
          metadata: input.metadata || {},
          read: false
        }
      });

      console.log(`✅ Уведомление создано: ${notification.id} (тип: ${input.type})`);
      return notification;
    } catch (error) {
      console.error('❌ Ошибка создания уведомления:', error);
      throw error;
    }
  }

  /**
   * Отправить уведомление пользователю через выбранные каналы
   */
  async sendNotification(
    input: CreateNotificationInput,
    options: SendOptions = {}
  ) {
    try {
      // 1. Создаем уведомление в БД
      const notification = await this.createNotification(input);

      // 2. Проверяем настройки пользователя
      const shouldSend = options.ignorePreferences
        ? true
        : await this.shouldSendNotification(input.userId, input.type);

      if (!shouldSend) {
        console.log(`⏭️  Уведомление пропущено согласно настройкам пользователя: ${input.type}`);
        return notification;
      }

      // 3. Получаем предпочтения пользователя
      const preferences = await this.getUserPreferences(input.userId);

      // 4. Отправляем Email если включено
      if ((options.email !== false && preferences?.emailEnabled) || options.ignorePreferences) {
        await this.sendEmailNotification(input);
      }

      // 5. Отправляем Push если включено
      if ((options.push !== false && preferences?.pushEnabled) || options.ignorePreferences) {
        await this.sendPushNotification(input);
      }

      return notification;
    } catch (error) {
      console.error('❌ Ошибка отправки уведомления:', error);
      throw error;
    }
  }

  /**
   * Проверить, нужно ли отправлять уведомление пользователю
   */
  async shouldSendNotification(userId: string, type: string): Promise<boolean> {
    try {
      const preferences = await this.getUserPreferences(userId);

      if (!preferences) {
        // Если нет настроек, используем дефолтные (отправляем)
        return true;
      }

      // Проверяем тип уведомления
      if (type.startsWith('document_')) {
        return preferences.documentsEnabled;
      }

      if (type.startsWith('report_')) {
        return preferences.reportsEnabled;
      }

      if (type.startsWith('deadline_')) {
        return preferences.deadlinesEnabled;
      }

      // Системные уведомления отправляем всегда
      return true;
    } catch (error) {
      console.error('❌ Ошибка проверки настроек уведомлений:', error);
      // В случае ошибки отправляем уведомление (безопасный fallback)
      return true;
    }
  }

  /**
   * Получить настройки уведомлений пользователя
   */
  async getUserPreferences(userId: string) {
    try {
      const preferences = await prisma.notificationPreferences.findUnique({
        where: { userId }
      });

      return preferences;
    } catch (error) {
      console.error('❌ Ошибка получения настроек уведомлений:', error);
      return null;
    }
  }

  /**
   * Отправить Email уведомление
   */
  async sendEmailNotification(input: CreateNotificationInput) {
    try {
      // Получаем email пользователя
      const user = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { email: true, name: true }
      });

      if (!user?.email) {
        console.warn('⚠️  Email пользователя не найден, пропускаем отправку');
        return;
      }

      // Проверяем тихие часы
      const inQuietHours = await this.isInQuietHours(input.userId);
      if (inQuietHours) {
        console.log(`🔇 Уведомление отложено (тихие часы): ${input.type}`);
        // TODO: Добавить в очередь для отправки после тихих часов
        return;
      }

      // Генерируем email шаблон через новый email-templates
      const emailTemplate = emailTemplates.createTemplate({
        title: input.title,
        message: input.message,
        type: input.type as any,
        priority: input.metadata?.priority || NotificationPriority.MEDIUM,
        metadata: input.metadata,
        actionUrl: input.metadata?.link,
        actionText: input.metadata?.actionText
      });

      // Отправляем email через RuSender с retry логикой
      const result = await sendEmailWithRetry({
        to: user.email,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
        text: emailTemplate.text
      }, {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 30000,
        backoffFactor: 2
      });

      if (result.success) {
        console.log(`📧 Email уведомление отправлено: ${user.email} (тип: ${input.type}, попыток: ${result.attempts})`);
      } else {
        console.error(`❌ Не удалось отправить email после ${result.attempts} попыток:`, result.error);
        // Для не-retryable ошибок можно добавить логику уведомления админов
        if (!result.retryable) {
          console.error(`⚠️ Постоянная ошибка для ${user.email}: ${result.error}`);
        }
      }
    } catch (error) {
      console.error('❌ Ошибка отправки email уведомления:', error);
      // Не прерываем выполнение, чтобы другие каналы работали
    }
  }

  /**
   * Отправить Push уведомление
   */
  async sendPushNotification(input: CreateNotificationInput) {
    // TODO: Реализовать Web Push в будущем (задача 7.17-7.20)
    console.log(`🔔 Push уведомление (пока логирование): ${input.title}`);
    return;
  }

  /**
   * Проверить, находится ли текущее время в тихих часах пользователя
   */
  async isInQuietHours(userId: string): Promise<boolean> {
    try {
      const preferences = await this.getUserPreferences(userId);

      if (!preferences?.quietHoursStart || !preferences?.quietHoursEnd) {
        return false;
      }

      // Получаем текущее время в часовом поясе пользователя
      const now = new Date();
      const userTimezone = preferences.timezone || 'Europe/Moscow';

      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: userTimezone,
        hour: 'numeric',
        hour12: false
      });

      const currentHour = parseInt(formatter.format(now));

      // Проверяем, находится ли текущий час в тихом диапазоне
      const start = preferences.quietHoursStart;
      const end = preferences.quietHoursEnd;

      // Обработка случая когда диапазон переходит через полночь (например, 22:00 - 08:00)
      if (start > end) {
        return currentHour >= start || currentHour < end;
      } else {
        return currentHour >= start && currentHour < end;
      }
    } catch (error) {
      console.error('❌ Ошибка проверки тихих часов:', error);
      return false;
    }
  }

  /**
   * Сгенерировать HTML шаблон email уведомления
   */
  generateEmailTemplate(
    input: CreateNotificationInput,
    userName: string,
    link: string
  ): string {
    const priority = input.metadata?.priority || NotificationPriority.MEDIUM;
    const priorityColor = this.getPriorityColor(priority);

    return `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${input.title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1dc962 0%, #19b558 100%); padding: 30px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                🌿 ESG-Лайт
              </h1>
            </td>
          </tr>

          <!-- Priority Badge -->
          ${priority !== NotificationPriority.LOW ? `
          <tr>
            <td style="padding: 20px 40px 0;">
              <div style="display: inline-block; background-color: ${priorityColor}; color: #ffffff; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; text-transform: uppercase;">
                ${this.getPriorityLabel(priority)}
              </div>
            </td>
          </tr>
          ` : ''}

          <!-- Content -->
          <tr>
            <td style="padding: 20px 40px;">
              <p style="margin: 0 0 10px; color: #666; font-size: 14px;">
                Здравствуйте, ${userName}!
              </p>
              <h2 style="margin: 0 0 15px; color: #1a1a1a; font-size: 20px; font-weight: 600;">
                ${input.title}
              </h2>
              <p style="margin: 0; color: #444; font-size: 16px; line-height: 1.6;">
                ${input.message}
              </p>
            </td>
          </tr>

          <!-- Action Button -->
          <tr>
            <td style="padding: 20px 40px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://esg-lite.ru'}${link}"
                       style="display: inline-block; background-color: #1dc962; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-size: 16px; font-weight: 600;">
                      Перейти к уведомлению
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 20px 40px; border-top: 1px solid #e9ecef;">
              <p style="margin: 0 0 10px; color: #666; font-size: 13px; line-height: 1.5;">
                Это автоматическое уведомление от платформы <strong>ESG-Лайт</strong>.
              </p>
              <p style="margin: 0; color: #999; font-size: 12px;">
                Вы можете изменить настройки уведомлений в
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://esg-lite.ru'}/settings?tab=notifications"
                   style="color: #1dc962; text-decoration: none;">
                  личном кабинете
                </a>.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  /**
   * Получить цвет приоритета
   */
  getPriorityColor(priority: NotificationPriority): string {
    switch (priority) {
      case NotificationPriority.URGENT:
        return '#dc2626'; // red-600
      case NotificationPriority.HIGH:
        return '#ea580c'; // orange-600
      case NotificationPriority.MEDIUM:
        return '#2563eb'; // blue-600
      case NotificationPriority.LOW:
        return '#64748b'; // slate-500
      default:
        return '#2563eb';
    }
  }

  /**
   * Получить текстовую метку приоритета
   */
  getPriorityLabel(priority: NotificationPriority): string {
    switch (priority) {
      case NotificationPriority.URGENT:
        return 'Срочно';
      case NotificationPriority.HIGH:
        return 'Важно';
      case NotificationPriority.MEDIUM:
        return 'Средний приоритет';
      case NotificationPriority.LOW:
        return 'Низкий приоритет';
      default:
        return '';
    }
  }

  /**
   * Отметить уведомление как прочитанное
   */
  async markAsRead(notificationId: string, userId: string) {
    try {
      const notification = await prisma.notification.updateMany({
        where: {
          id: notificationId,
          userId: userId // Проверка прав доступа
        },
        data: {
          read: true,
          updatedAt: new Date()
        }
      });

      console.log(`✅ Уведомление ${notificationId} отмечено как прочитанное`);
      return notification;
    } catch (error) {
      console.error('❌ Ошибка отметки уведомления как прочитанного:', error);
      throw error;
    }
  }

  /**
   * Отметить все уведомления пользователя как прочитанные
   */
  async markAllAsRead(userId: string) {
    try {
      const result = await prisma.notification.updateMany({
        where: {
          userId: userId,
          read: false
        },
        data: {
          read: true,
          updatedAt: new Date()
        }
      });

      console.log(`✅ Отмечено ${result.count} уведомлений как прочитанные`);
      return result;
    } catch (error) {
      console.error('❌ Ошибка массовой отметки уведомлений:', error);
      throw error;
    }
  }

  /**
   * Удалить уведомление
   */
  async deleteNotification(notificationId: string, userId: string) {
    try {
      const notification = await prisma.notification.deleteMany({
        where: {
          id: notificationId,
          userId: userId // Проверка прав доступа
        }
      });

      console.log(`🗑️  Уведомление ${notificationId} удалено`);
      return notification;
    } catch (error) {
      console.error('❌ Ошибка удаления уведомления:', error);
      throw error;
    }
  }

  /**
   * Получить количество непрочитанных уведомлений
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const count = await prisma.notification.count({
        where: {
          userId: userId,
          read: false
        }
      });

      return count;
    } catch (error) {
      console.error('❌ Ошибка подсчета непрочитанных уведомлений:', error);
      return 0;
    }
  }
}

// Экспортируем singleton instance
export const notificationService = new NotificationService();