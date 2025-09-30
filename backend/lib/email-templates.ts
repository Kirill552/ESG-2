/**
 * Email Templates для системы уведомлений ESG-Лайт
 * Задача 7.7: Email шаблоны уведомлений
 *
 * Шаблоны для документов, отчётов и дедлайнов с единым стилем
 */

import type { NotificationType, NotificationPriority } from './notification-service';

export interface EmailTemplateData {
  subject: string;
  html: string;
  text: string;
}

export interface NotificationEmailData {
  title: string;
  message: string;
  type: NotificationType;
  priority: NotificationPriority;
  metadata?: Record<string, any>;
  actionUrl?: string;
  actionText?: string;
}

class EmailTemplates {
  private baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://esg-lite.ru';

  /**
   * Создать email шаблон на основе типа уведомления
   */
  createTemplate(data: NotificationEmailData): EmailTemplateData {
    switch (data.type) {
      case 'DOCUMENT_UPLOADED':
        return this.createDocumentUploadedTemplate(data);

      case 'DOCUMENT_PROCESSED':
        return this.createDocumentProcessedTemplate(data);

      case 'DOCUMENT_ERROR':
        return this.createDocumentErrorTemplate(data);

      case 'REPORT_READY':
        return this.createReportReadyTemplate(data);

      case 'REPORT_ERROR':
        return this.createReportErrorTemplate(data);

      case 'DEADLINE_30_DAYS':
      case 'DEADLINE_7_DAYS':
      case 'DEADLINE_1_DAY':
        return this.createDeadlineTemplate(data);

      case 'SYSTEM_ALERT':
        return this.createSystemAlertTemplate(data);

      default:
        return this.createGenericTemplate(data);
    }
  }

  /**
   * Шаблон: Документ успешно загружен
   */
  private createDocumentUploadedTemplate(data: NotificationEmailData): EmailTemplateData {
    const fileName = data.metadata?.fileName || 'Документ';
    const fileSize = data.metadata?.fileSize || 0;
    const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);
    const link = data.metadata?.link || '/documents';

    return {
      subject: `📤 ESG-Лайт: ${fileName} успешно загружен`,
      html: this.wrapHtml({
        icon: '📤',
        title: data.title,
        color: '#2563eb',
        content: `
          <h2>${data.title}</h2>
          <p>${data.message}</p>

          <div class="info-box">
            <strong>📄 Информация о файле:</strong><br>
            • Файл: ${fileName}<br>
            • Размер: ${fileSizeMB} МБ<br>
            • Статус: Загружен, ожидает обработки
          </div>

          <p>Документ поставлен в очередь на обработку. Вы получите уведомление, когда распознавание текста будет завершено.</p>

          <p><strong>Что происходит дальше?</strong></p>
          <ul>
            <li>Система автоматически распознает текст из документа</li>
            <li>Извлечёт данные о выбросах и показателях</li>
            <li>Вы получите уведомление о завершении обработки</li>
          </ul>

          <a href="${this.baseUrl}${link}" class="button">Перейти к документам</a>
        `
      }),
      text: this.wrapText({
        subject: 'Документ успешно загружен',
        content: `${data.title}

${data.message}

Информация о файле:
• Файл: ${fileName}
• Размер: ${fileSizeMB} МБ
• Статус: Загружен, ожидает обработки

Документ поставлен в очередь на обработку. Вы получите уведомление, когда распознавание текста будет завершено.

Что происходит дальше?
- Система автоматически распознает текст из документа
- Извлечёт данные о выбросах и показателях
- Вы получите уведомление о завершении обработки

Перейти к документам: ${this.baseUrl}${link}`
      })
    };
  }

  /**
   * Шаблон: Документ успешно обработан
   */
  private createDocumentProcessedTemplate(data: NotificationEmailData): EmailTemplateData {
    const fileName = data.metadata?.fileName || 'Документ';
    const textLength = data.metadata?.textLength || 0;
    const link = data.metadata?.link || '/documents';

    return {
      subject: `✅ ESG-Лайт: ${fileName} успешно обработан`,
      html: this.wrapHtml({
        icon: '✅',
        title: data.title,
        color: '#059669',
        content: `
          <h2>${data.title}</h2>
          <p>${data.message}</p>

          <div class="info-box">
            <strong>📄 Информация о документе:</strong><br>
            • Файл: ${fileName}<br>
            • Распознано символов: ${textLength.toLocaleString('ru-RU')}<br>
            • Статус: Готов к использованию
          </div>

          <p>Вы можете:</p>
          <ul>
            <li>Просмотреть извлечённый текст в разделе документов</li>
            <li>Использовать данные для создания отчётов</li>
            <li>Скачать результаты обработки</li>
          </ul>

          <a href="${this.baseUrl}${link}" class="button">Перейти к документам</a>
        `
      }),
      text: this.wrapText({
        subject: 'Документ успешно обработан',
        content: `${data.title}

${data.message}

Информация о документе:
• Файл: ${fileName}
• Распознано символов: ${textLength.toLocaleString('ru-RU')}
• Статус: Готов к использованию

Вы можете:
- Просмотреть извлечённый текст в разделе документов
- Использовать данные для создания отчётов
- Скачать результаты обработки

Перейти к документам: ${this.baseUrl}${link}`
      })
    };
  }

  /**
   * Шаблон: Ошибка обработки документа
   */
  private createDocumentErrorTemplate(data: NotificationEmailData): EmailTemplateData {
    const fileName = data.metadata?.fileName || 'Документ';
    const errorMessage = data.metadata?.errorMessage || 'Неизвестная ошибка';
    const link = data.metadata?.link || '/documents?status=error';

    return {
      subject: `❌ ESG-Лайт: Ошибка обработки ${fileName}`,
      html: this.wrapHtml({
        icon: '❌',
        title: data.title,
        color: '#dc2626',
        content: `
          <h2>${data.title}</h2>
          <p>${data.message}</p>

          <div class="error-box">
            <strong>⚠️ Причина ошибки:</strong><br>
            ${errorMessage}
          </div>

          <p><strong>Что делать?</strong></p>
          <ul>
            <li>Проверьте формат файла (поддерживаются PDF, Excel, Word, изображения)</li>
            <li>Убедитесь, что файл не повреждён</li>
            <li>Попробуйте загрузить файл меньшего размера (до 50 МБ)</li>
            <li>Обратитесь в поддержку, если проблема повторяется</li>
          </ul>

          <a href="${this.baseUrl}${link}" class="button button-error">Просмотреть ошибки</a>
        `
      }),
      text: this.wrapText({
        subject: 'Ошибка обработки документа',
        content: `${data.title}

${data.message}

Причина ошибки:
${errorMessage}

Что делать?
- Проверьте формат файла (поддерживаются PDF, Excel, Word, изображения)
- Убедитесь, что файл не повреждён
- Попробуйте загрузить файл меньшего размера (до 50 МБ)
- Обратитесь в поддержку, если проблема повторяется

Просмотреть ошибки: ${this.baseUrl}${link}`
      })
    };
  }

  /**
   * Шаблон: Отчёт готов
   */
  private createReportReadyTemplate(data: NotificationEmailData): EmailTemplateData {
    const reportName = data.metadata?.reportName || 'Отчёт';
    const reportType = data.metadata?.reportType || '296-ФЗ';
    const link = data.metadata?.link || '/reports';

    return {
      subject: `📊 ESG-Лайт: Отчёт "${reportName}" готов к отправке`,
      html: this.wrapHtml({
        icon: '📊',
        title: data.title,
        color: '#2563eb',
        content: `
          <h2>${data.title}</h2>
          <p>${data.message}</p>

          <div class="success-box">
            <strong>✅ Отчёт сформирован успешно</strong><br><br>
            • Название: ${reportName}<br>
            • Тип: ${reportType}<br>
            • Статус: Готов к отправке в регулятор
          </div>

          <p><strong>Следующие шаги:</strong></p>
          <ol>
            <li>Проверьте корректность данных в отчёте</li>
            <li>Скачайте PDF версию для архива</li>
            <li>Отправьте отчёт в регулятор через систему</li>
          </ol>

          <a href="${this.baseUrl}${link}" class="button">Перейти к отчётам</a>
        `
      }),
      text: this.wrapText({
        subject: 'Отчёт готов к отправке',
        content: `${data.title}

${data.message}

Отчёт сформирован успешно:
• Название: ${reportName}
• Тип: ${reportType}
• Статус: Готов к отправке в регулятор

Следующие шаги:
1. Проверьте корректность данных в отчёте
2. Скачайте PDF версию для архива
3. Отправьте отчёт в регулятор через систему

Перейти к отчётам: ${this.baseUrl}${link}`
      })
    };
  }

  /**
   * Шаблон: Ошибка создания отчёта
   */
  private createReportErrorTemplate(data: NotificationEmailData): EmailTemplateData {
    const reportName = data.metadata?.reportName || 'Отчёт';
    const errorMessage = data.metadata?.errorMessage || 'Неизвестная ошибка';
    const link = data.metadata?.link || '/reports';

    return {
      subject: `⚠️ ESG-Лайт: Ошибка создания отчёта "${reportName}"`,
      html: this.wrapHtml({
        icon: '⚠️',
        title: data.title,
        color: '#dc2626',
        content: `
          <h2>${data.title}</h2>
          <p>${data.message}</p>

          <div class="error-box">
            <strong>❌ Причина ошибки:</strong><br>
            ${errorMessage}
          </div>

          <p><strong>Возможные решения:</strong></p>
          <ul>
            <li>Проверьте полноту загруженных документов</li>
            <li>Убедитесь, что все обязательные поля заполнены</li>
            <li>Проверьте качество данных в документах</li>
            <li>Свяжитесь с поддержкой для диагностики</li>
          </ul>

          <a href="${this.baseUrl}${link}" class="button button-error">Перейти к отчётам</a>
        `
      }),
      text: this.wrapText({
        subject: 'Ошибка создания отчёта',
        content: `${data.title}

${data.message}

Причина ошибки:
${errorMessage}

Возможные решения:
- Проверьте полноту загруженных документов
- Убедитесь, что все обязательные поля заполнены
- Проверьте качество данных в документах
- Свяжитесь с поддержкой для диагностики

Перейти к отчётам: ${this.baseUrl}${link}`
      })
    };
  }

  /**
   * Шаблон: Приближение дедлайна
   */
  private createDeadlineTemplate(data: NotificationEmailData): EmailTemplateData {
    const reportName = data.metadata?.reportName || 'Отчёт';
    const deadline = data.metadata?.deadline || 'Скоро';
    const daysLeft = data.metadata?.daysLeft || 0;
    const link = data.metadata?.link || '/reports';

    let urgencyClass = 'warning-box';
    let icon = '⏰';
    let color = '#f59e0b';

    if (daysLeft <= 1) {
      urgencyClass = 'error-box';
      icon = '🚨';
      color = '#dc2626';
    } else if (daysLeft <= 7) {
      urgencyClass = 'warning-box';
      icon = '⚠️';
      color = '#f59e0b';
    }

    return {
      subject: `${icon} ESG-Лайт: До дедлайна "${reportName}" осталось ${daysLeft} ${this.getDaysWord(daysLeft)}`,
      html: this.wrapHtml({
        icon,
        title: data.title,
        color,
        content: `
          <h2>${data.title}</h2>
          <p>${data.message}</p>

          <div class="${urgencyClass}">
            <strong>📅 Информация о дедлайне:</strong><br><br>
            • Отчёт: ${reportName}<br>
            • Срок подачи: ${deadline}<br>
            • Осталось времени: ${daysLeft} ${this.getDaysWord(daysLeft)}
          </div>

          ${daysLeft <= 1 ? `
            <div class="error-box" style="margin-top: 16px;">
              <strong>🚨 Критически важно!</strong><br>
              Это последний день для подачи отчёта. Убедитесь, что все данные проверены и отчёт готов к отправке!
            </div>
          ` : ''}

          <p><strong>Что нужно сделать:</strong></p>
          <ul>
            <li>Проверьте статус отчёта в системе</li>
            <li>Завершите все необходимые документы</li>
            <li>Проверьте корректность данных</li>
            <li>Отправьте отчёт до истечения срока</li>
          </ul>

          <a href="${this.baseUrl}${link}" class="button">Перейти к отчёту</a>
        `
      }),
      text: this.wrapText({
        subject: `До дедлайна осталось ${daysLeft} ${this.getDaysWord(daysLeft)}`,
        content: `${data.title}

${data.message}

Информация о дедлайне:
• Отчёт: ${reportName}
• Срок подачи: ${deadline}
• Осталось времени: ${daysLeft} ${this.getDaysWord(daysLeft)}

${daysLeft <= 1 ? `
КРИТИЧЕСКИ ВАЖНО!
Это последний день для подачи отчёта. Убедитесь, что все данные проверены и отчёт готов к отправке!
` : ''}

Что нужно сделать:
- Проверьте статус отчёта в системе
- Завершите все необходимые документы
- Проверьте корректность данных
- Отправьте отчёт до истечения срока

Перейти к отчёту: ${this.baseUrl}${link}`
      })
    };
  }

  /**
   * Шаблон: Системное уведомление
   */
  private createSystemAlertTemplate(data: NotificationEmailData): EmailTemplateData {
    return {
      subject: `🔔 ESG-Лайт: ${data.title}`,
      html: this.wrapHtml({
        icon: '🔔',
        title: data.title,
        color: '#6366f1',
        content: `
          <h2>${data.title}</h2>
          <p>${data.message}</p>

          ${data.actionUrl ? `
            <a href="${this.baseUrl}${data.actionUrl}" class="button">
              ${data.actionText || 'Подробнее'}
            </a>
          ` : ''}
        `
      }),
      text: this.wrapText({
        subject: data.title,
        content: `${data.title}

${data.message}

${data.actionUrl ? `${data.actionText || 'Подробнее'}: ${this.baseUrl}${data.actionUrl}` : ''}`
      })
    };
  }

  /**
   * Универсальный шаблон
   */
  private createGenericTemplate(data: NotificationEmailData): EmailTemplateData {
    return {
      subject: `ESG-Лайт: ${data.title}`,
      html: this.wrapHtml({
        icon: '🔔',
        title: data.title,
        color: '#3b82f6',
        content: `
          <h2>${data.title}</h2>
          <p>${data.message}</p>

          ${data.actionUrl ? `
            <a href="${this.baseUrl}${data.actionUrl}" class="button">
              ${data.actionText || 'Перейти'}
            </a>
          ` : ''}
        `
      }),
      text: this.wrapText({
        subject: data.title,
        content: `${data.title}

${data.message}

${data.actionUrl ? `${data.actionText || 'Перейти'}: ${this.baseUrl}${data.actionUrl}` : ''}`
      })
    };
  }

  /**
   * Обёртка HTML с единым стилем ESG-Лайт
   */
  private wrapHtml(options: {
    icon: string;
    title: string;
    color: string;
    content: string;
  }): string {
    return `
      <!DOCTYPE html>
      <html lang="ru">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${options.title}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            margin: 0;
            padding: 20px;
            background-color: #f9fafb;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
          }
          .header {
            background: linear-gradient(135deg, ${options.color}, ${this.darkenColor(options.color)});
            color: white;
            padding: 32px 24px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
          }
          .content {
            padding: 32px 24px;
          }
          .content h2 {
            color: #111827;
            font-size: 20px;
            margin-top: 0;
          }
          .content p {
            color: #4b5563;
            margin: 16px 0;
          }
          .content ul, .content ol {
            color: #4b5563;
            padding-left: 24px;
          }
          .content li {
            margin: 8px 0;
          }
          .info-box, .success-box, .warning-box, .error-box {
            border-radius: 8px;
            padding: 16px;
            margin: 20px 0;
          }
          .info-box {
            background: #dbeafe;
            border: 1px solid #3b82f6;
            color: #1e40af;
          }
          .success-box {
            background: #d1fae5;
            border: 1px solid #059669;
            color: #065f46;
          }
          .warning-box {
            background: #fef3c7;
            border: 1px solid #f59e0b;
            color: #92400e;
          }
          .error-box {
            background: #fee2e2;
            border: 1px solid #dc2626;
            color: #991b1b;
          }
          .button {
            display: inline-block;
            background: ${options.color};
            color: white !important;
            padding: 12px 28px;
            text-decoration: none;
            border-radius: 8px;
            margin: 20px 0;
            font-weight: 600;
            transition: opacity 0.2s;
          }
          .button:hover {
            opacity: 0.9;
          }
          .button-error {
            background: #dc2626;
          }
          .footer {
            background: #f3f4f6;
            padding: 24px;
            text-align: center;
            font-size: 14px;
            color: #6b7280;
            border-top: 1px solid #e5e7eb;
          }
          .footer a {
            color: ${options.color};
            text-decoration: none;
          }
          .footer a:hover {
            text-decoration: underline;
          }
          .logo {
            font-size: 28px;
            margin-bottom: 8px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">${options.icon}</div>
            <h1>ESG-Лайт</h1>
          </div>
          <div class="content">
            ${options.content}
          </div>
          <div class="footer">
            <p><strong>ESG-Лайт</strong> | Автоматизация углеродной отчётности</p>
            <p>
              Не хотите получать такие уведомления?
              <a href="${this.baseUrl}/settings/notifications">Измените настройки</a>
            </p>
            <p style="margin-top: 16px; font-size: 12px;">
              © ${new Date().getFullYear()} ESG-Лайт. Все права защищены.<br>
              Это автоматическое сообщение, отвечать на него не нужно.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Обёртка текстовой версии
   */
  private wrapText(options: { subject: string; content: string }): string {
    return `
ESG-ЛАЙТ | Автоматизация углеродной отчётности
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${options.content}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Не хотите получать такие уведомления?
Измените настройки: ${this.baseUrl}/settings/notifications

© ${new Date().getFullYear()} ESG-Лайт. Все права защищены.
Это автоматическое сообщение, отвечать на него не нужно.
    `.trim();
  }

  /**
   * Утемнить цвет для градиента
   */
  private darkenColor(color: string): string {
    const colorMap: Record<string, string> = {
      '#059669': '#047857', // green
      '#dc2626': '#b91c1c', // red
      '#f59e0b': '#d97706', // amber
      '#2563eb': '#1d4ed8', // blue
      '#3b82f6': '#2563eb', // blue
      '#6366f1': '#4f46e5', // indigo
    };
    return colorMap[color] || color;
  }

  /**
   * Получить правильную форму слова "день"
   */
  private getDaysWord(days: number): string {
    if (days === 1) return 'день';
    if (days >= 2 && days <= 4) return 'дня';
    return 'дней';
  }
}

// Экспортируем singleton
export const emailTemplates = new EmailTemplates();
export default emailTemplates;