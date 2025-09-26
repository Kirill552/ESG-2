/**
 * Email Service для уведомлений о ценах
 * Задача 5.3: Создать систему уведомлений о ценах
 * 
 * Отправляет email уведомления о сезонном повышении цен и изменениях тарифов
 */

import type { PricingNotification } from './pricing-notifications';

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface EmailRecipient {
  email: string;
  name?: string;
  userId: string;
}

class EmailService {
  /**
   * Создать email шаблон для уведомления о сезонном повышении цен
   */
  createSurgePricingTemplate(notification: PricingNotification): EmailTemplate {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://esg-lite.com';
    
    switch (notification.type) {
      case 'surge_start':
        return {
          subject: '📈 ESG-Lite: Началось сезонное повышение цен на обработку документов',
          html: this.createSurgeStartEmailHtml(notification, baseUrl),
          text: this.createSurgeStartEmailText(notification, baseUrl)
        };
        
      case 'surge_end':
        return {
          subject: '📉 ESG-Lite: Завершилось сезонное повышение цен - тарифы вернулись к базовым',
          html: this.createSurgeEndEmailHtml(notification, baseUrl),
          text: this.createSurgeEndEmailText(notification, baseUrl)
        };
        
      case 'discount':
        return {
          subject: '💰 ESG-Lite: Успейте обработать документы до повышения цен!',
          html: this.createDiscountEmailHtml(notification, baseUrl),
          text: this.createDiscountEmailText(notification, baseUrl)
        };
        
      default:
        return {
          subject: '🔔 ESG-Lite: Уведомление о ценах',
          html: this.createGenericEmailHtml(notification, baseUrl),
          text: this.createGenericEmailText(notification, baseUrl)
        };
    }
  }

  /**
   * HTML шаблон для начала сезонного повышения цен
   */
  private createSurgeStartEmailHtml(notification: PricingNotification, baseUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${notification.title}</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 20px;
            background-color: #f9fafb;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            overflow: hidden;
          }
          .header {
            background: linear-gradient(135deg, #f59e0b, #d97706);
            color: white;
            padding: 24px;
            text-align: center;
          }
          .content {
            padding: 24px;
          }
          .alert {
            background: #fef3c7;
            border: 1px solid #f59e0b;
            border-radius: 6px;
            padding: 16px;
            margin: 16px 0;
          }
          .button {
            display: inline-block;
            background: #059669;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            margin: 16px 0;
          }
          .footer {
            background: #f3f4f6;
            padding: 16px 24px;
            text-align: center;
            font-size: 14px;
            color: #6b7280;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📈 Сезонное повышение цен активно</h1>
          </div>
          <div class="content">
            <h2>${notification.title}</h2>
            <p>${notification.message}</p>
            
            <div class="alert">
              <strong>⚠️ Важная информация:</strong> С 15 по 30 июня каждого года действуют повышенные тарифы на обработку углеродной отчетности. 
              Стоимость увеличена в 2 раза по следующим причинам:
              <br><br>
              • <strong>Пиковая нагрузка:</strong> В июне большинство компаний подготавливают годовые экологические отчеты<br>
              • <strong>Регуляторные требования:</strong> Сроки подачи отчетности по климатическому регулированию<br>
              • <strong>Высокий спрос:</strong> Повышенная загрузка серверов и специалистов требует дополнительных ресурсов<br>
              • <strong>Качество обработки:</strong> В пиковый период мы привлекаем дополнительных экспертов для поддержания качества
            </div>
            
            <p>Как оптимизировать расходы в период повышенных цен:</p>
            <ul>
              <li><strong>Планирование:</strong> Загружайте документы заранее в мае или откладывайте на июль</li>
              <li><strong>Пакетная обработка:</strong> Обрабатывайте несколько документов одновременно для экономии</li>
              <li><strong>Планируйте загрузки:</strong> Избегайте пиковых дат 15–30 июня</li>
              <li><strong>Приоритизация:</strong> Обрабатывайте в первую очередь самые важные документы</li>
            </ul>
            
            ${notification.actionUrl ? `
              <a href="${baseUrl}${notification.actionUrl}" class="button">
                ${notification.actionText || 'Узнать подробности'}
              </a>
            ` : ''}
          </div>
          <div class="footer">
            <p>ESG-Lite | Автоматизация углеродной отчетности</p>
            <p>Если вы не хотите получать такие уведомления, <a href="${baseUrl}/settings">измените настройки</a></p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Текстовая версия для начала сезонного повышения цен
   */
  private createSurgeStartEmailText(notification: PricingNotification, baseUrl: string): string {
    return `
ESG-Lite: Сезонное повышение цен активно

${notification.title}

${notification.message}

ВАЖНАЯ ИНФОРМАЦИЯ: С 15 по 30 июня каждого года действуют повышенные тарифы на обработку углеродной отчетности. 
Стоимость увеличена в 2 раза по следующим причинам:

• Пиковая нагрузка: В июне большинство компаний подготавливают годовые экологические отчеты
• Регуляторные требования: Сроки подачи отчетности по климатическому регулированию  
• Высокий спрос: Повышенная загрузка серверов и специалистов требует дополнительных ресурсов
• Качество обработки: В пиковый период мы привлекаем дополнительных экспертов для поддержания качества

Как оптимизировать расходы в период повышенных цен:
- Планирование: Загружайте документы заранее в мае или откладывайте на июль
- Пакетная обработка: Обрабатывайте несколько документов одновременно для экономии
      - Планируйте загрузки: Избегайте пиковых дат 15–30 июня  
- Приоритизация: Обрабатывайте в первую очередь самые важные документы

${notification.actionUrl ? `${notification.actionText || 'Узнать подробности'}: ${baseUrl}${notification.actionUrl}` : ''}

---
ESG-Lite | Автоматизация углеродной отчетности
Настройки: ${baseUrl}/settings
    `.trim();
  }

  /**
   * HTML шаблон для скидки
   */
  private createDiscountEmailHtml(notification: PricingNotification, baseUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${notification.title}</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 20px;
            background-color: #f9fafb;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            overflow: hidden;
          }
          .header {
            background: linear-gradient(135deg, #059669, #047857);
            color: white;
            padding: 24px;
            text-align: center;
          }
          .content {
            padding: 24px;
          }
          .success {
            background: #d1fae5;
            border: 1px solid #059669;
            border-radius: 6px;
            padding: 16px;
            margin: 16px 0;
          }
          .button {
            display: inline-block;
            background: #059669;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            margin: 16px 0;
          }
          .footer {
            background: #f3f4f6;
            padding: 16px 24px;
            text-align: center;
            font-size: 14px;
            color: #6b7280;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💰 Последние дни обычных тарифов!</h1>
          </div>
          <div class="content">
            <h2>${notification.title}</h2>
            <p>${notification.message}</p>
            
          <div class="header">
            <h1>💰 Успейте до повышения цен!</h1>
          </div>
          <div class="content">
            <h2>${notification.title}</h2>
            <p>${notification.message}</p>
            
            <div class="success">
              <strong>💡 Важная рекомендация:</strong> Обработайте все накопившиеся документы прямо сейчас по базовым тарифам. 
              <br><br>
              С 15 июня начинается период сезонного повышения цен (в 2 раза выше обычных), который продлится до 30 июня. 
              Это связано с пиковой нагрузкой на систему в период подготовки годовой экологической отчетности компаниями.
            </div>
            
            <p>Что стоит сделать прямо сейчас, пока действуют базовые тарифы:</p>
            <ul>
              <li><strong>Загрузить документы:</strong> Обработайте все накопившиеся счета, накладные и отчеты</li>
              <li><strong>Подготовить отчетность:</strong> Сгенерируйте все необходимые отчеты за текущий период</li>
              <li><strong>Планирование:</strong> Распределите загрузки до и после пиковых дат</li>
              <li><strong>Планирование:</strong> Составьте план обработки документов на июнь заранее</li>
            </ul>
            
            ${notification.actionUrl ? `
              <a href="${baseUrl}${notification.actionUrl}" class="button">
                ${notification.actionText || 'Загрузить документ'}
              </a>
            ` : ''}
          </div>
          <div class="footer">
            <p>ESG-Lite | Автоматизация углеродной отчетности</p>
            <p>Если вы не хотите получать такие уведомления, <a href="${baseUrl}/settings">измените настройки</a></p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Текстовая версия для скидки
   */
  private createDiscountEmailText(notification: PricingNotification, baseUrl: string): string {
    return `
ESG-Lite: Успейте до повышения цен!

${notification.title}

${notification.message}

ВАЖНАЯ РЕКОМЕНДАЦИЯ: Обработайте все накопившиеся документы прямо сейчас по базовым тарифам. 

С 15 июня начинается период сезонного повышения цен (в 2 раза выше обычных), который продлится до 30 июня. 
Это связано с пиковой нагрузкой на систему в период подготовки годовой экологической отчетности компаниями.

Что стоит сделать прямо сейчас, пока действуют базовые тарифы:
- Загрузить документы: Обработайте все накопившиеся счета, накладные и отчеты
- Подготовить отчетность: Сгенерируйте все необходимые отчеты за текущий период
- Планирование: Распределите загрузки до и после пиковых дат
- Планирование: Составьте план обработки документов на июнь заранее

${notification.actionUrl ? `${notification.actionText || 'Загрузить документ'}: ${baseUrl}${notification.actionUrl}` : ''}

---
ESG-Lite | Автоматизация углеродной отчетности
Настройки: ${baseUrl}/settings
    `.trim();
  }

  /**
   * Базовые шаблоны для других типов уведомлений
   */
  private createSurgeEndEmailHtml(notification: PricingNotification, baseUrl: string): string {
    return this.createGenericEmailHtml(notification, baseUrl, '#059669', '📉 Сезонное повышение цен завершено');
  }

  private createSurgeEndEmailText(notification: PricingNotification, baseUrl: string): string {
    return this.createGenericEmailText(notification, baseUrl, 'ESG-Lite: Сезонное повышение цен завершено - тарифы вернулись к базовым');
  }

  private createGenericEmailHtml(notification: PricingNotification, baseUrl: string, color = '#3b82f6', headerTitle?: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${notification.title}</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 20px;
            background-color: #f9fafb;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            overflow: hidden;
          }
          .header {
            background: ${color};
            color: white;
            padding: 24px;
            text-align: center;
          }
          .content {
            padding: 24px;
          }
          .button {
            display: inline-block;
            background: ${color};
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            margin: 16px 0;
          }
          .footer {
            background: #f3f4f6;
            padding: 16px 24px;
            text-align: center;
            font-size: 14px;
            color: #6b7280;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${headerTitle || notification.title}</h1>
          </div>
          <div class="content">
            <h2>${notification.title}</h2>
            <p>${notification.message}</p>
            
            ${notification.actionUrl ? `
              <a href="${baseUrl}${notification.actionUrl}" class="button">
                ${notification.actionText || 'Подробнее'}
              </a>
            ` : ''}
          </div>
          <div class="footer">
            <p>ESG-Lite | Автоматизация углеродной отчетности</p>
            <p>Если вы не хотите получать такие уведомления, <a href="${baseUrl}/settings">измените настройки</a></p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private createGenericEmailText(notification: PricingNotification, baseUrl: string, subject?: string): string {
    return `
${subject || 'ESG-Lite: Уведомление о ценах'}

${notification.title}

${notification.message}

${notification.actionUrl ? `${notification.actionText || 'Подробнее'}: ${baseUrl}${notification.actionUrl}` : ''}

---
ESG-Lite | Автоматизация углеродной отчетности
Настройки: ${baseUrl}/settings
    `.trim();
  }

  /**
   * Отправить email через RuSender (или логировать в DEV)
   */
  async sendEmail(recipient: EmailRecipient, template: EmailTemplate): Promise<boolean> {
    try {
      const { sendTransactionalEmail } = await import('./email-universal');
      const ok = await sendTransactionalEmail({
        to: recipient.email,
        subject: template.subject || 'ESG‑Lite',
        html: template.html || template.text || '',
        text: template.text
      });
      if (ok.status === 'ok') return true;
      if (process.env.NODE_ENV === 'development') {
        console.log('📧 [DEV LOG] Email:', { to: recipient.email, subject: template.subject });
        return true;
      }
      console.error('❌ Email send failed via RuSender:', ok.error);
      return false;
    } catch (e) {
      console.error('❌ Email send error:', (e as any)?.message);
      return false;
    }
  }

  /**
   * Отправить уведомление о сезонном повышении цен конкретному пользователю
   */
  async sendPricingNotification(
    recipient: EmailRecipient,
    notification: PricingNotification
  ): Promise<boolean> {
    try {
      const template = this.createSurgePricingTemplate(notification);
      return await this.sendEmail(recipient, template);
    } catch (error) {
      console.error('❌ Ошибка отправки email уведомления:', error);
      return false;
    }
  }
}

// Экспортируем singleton
export const emailService = new EmailService();
export default emailService;
