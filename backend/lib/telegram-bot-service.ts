/**
 * Сервис для отправки Telegram уведомлений администратору
 * Использует Telegram Bot API для отправки сообщений
 */

import { prisma } from './prisma';

interface TelegramMessage {
  text: string;
  parse_mode?: 'Markdown' | 'HTML';
  disable_web_page_preview?: boolean;
}

interface TelegramNotificationOptions {
  type: 'trial_request' | 'user_error' | 'document_error' | 'system_alert' | 'security_incident';
  title: string;
  message: string;
  metadata?: Record<string, any>;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}

/**
 * Telegram Bot Service для уведомлений администратора
 */
class TelegramBotService {
  private readonly baseUrl = 'https://api.telegram.org';

  /**
   * Получить настройки Telegram бота из профиля администратора
   */
  private async getAdminTelegramSettings() {
    try {
      // Получаем первого суперадмина с настроенным Telegram
      const admin = await prisma.admin.findFirst({
        where: {
          role: 'SUPER_ADMIN',
          telegramBotToken: { not: null },
          telegramChatId: { not: null },
        },
        select: {
          telegramBotToken: true,
          telegramChatId: true,
          notifyTrialRequests: true,
          notifyUserErrors: true,
          notifyDocumentErrors: true,
          notifySystemAlerts: true,
        },
      });

      return admin;
    } catch (error) {
      console.error('❌ [Telegram] Ошибка получения настроек админа:', error);
      return null;
    }
  }

  /**
   * Проверить, нужно ли отправлять уведомление данного типа
   */
  private shouldSendNotification(
    adminSettings: any,
    type: TelegramNotificationOptions['type']
  ): boolean {
    if (!adminSettings) return false;

    switch (type) {
      case 'trial_request':
        return adminSettings.notifyTrialRequests ?? true;
      case 'user_error':
        return adminSettings.notifyUserErrors ?? true;
      case 'document_error':
        return adminSettings.notifyDocumentErrors ?? true;
      case 'system_alert':
      case 'security_incident':
        return adminSettings.notifySystemAlerts ?? true;
      default:
        return false;
    }
  }

  /**
   * Форматировать сообщение для Telegram (Markdown)
   */
  private formatMessage(options: TelegramNotificationOptions): string {
    const { title, message, metadata, priority } = options;

    // Эмодзи для приоритета
    const priorityEmoji = {
      low: 'ℹ️',
      medium: '⚠️',
      high: '🔥',
      urgent: '🚨',
    }[priority || 'medium'];

    let formatted = `${priorityEmoji} *${title}*\n\n${message}\n`;

    // Добавляем метаданные если есть
    if (metadata && Object.keys(metadata).length > 0) {
      formatted += '\n📋 *Детали:*\n';

      for (const [key, value] of Object.entries(metadata)) {
        if (value !== undefined && value !== null) {
          // Форматируем ключ (camelCase -> Readable)
          const readableKey = key
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, (str) => str.toUpperCase());

          formatted += `• ${readableKey}: ${value}\n`;
        }
      }
    }

    formatted += `\n🕐 ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`;

    return formatted;
  }

  /**
   * Отправить сообщение в Telegram
   */
  private async sendTelegramMessage(
    botToken: string,
    chatId: string,
    message: TelegramMessage
  ): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/bot${botToken}/sendMessage`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message.text,
          parse_mode: message.parse_mode || 'Markdown',
          disable_web_page_preview: message.disable_web_page_preview ?? true,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        console.error('❌ [Telegram] Ошибка отправки:', result);
        return false;
      }

      console.log('✅ [Telegram] Сообщение отправлено успешно');
      return true;
    } catch (error) {
      console.error('❌ [Telegram] Ошибка при отправке сообщения:', error);
      return false;
    }
  }

  /**
   * Отправить уведомление администратору
   */
  async sendAdminNotification(options: TelegramNotificationOptions): Promise<boolean> {
    try {
      // Получаем настройки админа
      const adminSettings = await this.getAdminTelegramSettings();

      if (!adminSettings) {
        console.log('⏭️  [Telegram] Настройки Telegram не найдены, пропускаем отправку');
        return false;
      }

      // Проверяем, нужно ли отправлять уведомление
      if (!this.shouldSendNotification(adminSettings, options.type)) {
        console.log(`⏭️  [Telegram] Уведомления типа "${options.type}" отключены в настройках`);
        return false;
      }

      // Форматируем сообщение
      const formattedMessage = this.formatMessage(options);

      // Отправляем в Telegram
      const success = await this.sendTelegramMessage(
        adminSettings.telegramBotToken!,
        adminSettings.telegramChatId!,
        {
          text: formattedMessage,
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
        }
      );

      return success;
    } catch (error) {
      console.error('❌ [Telegram] Ошибка отправки уведомления:', error);
      return false;
    }
  }

  /**
   * Тестовая отправка сообщения (для проверки настроек)
   */
  async sendTestMessage(botToken: string, chatId: string): Promise<boolean> {
    try {
      const testMessage = `✅ *Тест уведомлений ESG-Лайт*\n\nВаш Telegram бот успешно настроен!\n\nВы будете получать уведомления о:\n• Новых заявках на доступ\n• Ошибках пользователей\n• Проблемах с документами\n• Системных событиях\n\n🕐 ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`;

      const success = await this.sendTelegramMessage(botToken, chatId, {
        text: testMessage,
        parse_mode: 'Markdown',
      });

      return success;
    } catch (error) {
      console.error('❌ [Telegram] Ошибка тестовой отправки:', error);
      return false;
    }
  }

  /**
   * Проверить валидность bot token
   */
  async validateBotToken(botToken: string): Promise<{ valid: boolean; botInfo?: any }> {
    try {
      const url = `${this.baseUrl}/bot${botToken}/getMe`;

      const response = await fetch(url);
      const result = await response.json();

      if (!response.ok || !result.ok) {
        return { valid: false };
      }

      return {
        valid: true,
        botInfo: result.result,
      };
    } catch (error) {
      console.error('❌ [Telegram] Ошибка валидации токена:', error);
      return { valid: false };
    }
  }
}

// Singleton экземпляр
export const telegramBotService = new TelegramBotService();

// Экспорт типов
export type { TelegramNotificationOptions };
