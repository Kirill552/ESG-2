/**
 * Система уведомлений менеджера о новых заявках на доступ
 */

import { Logger } from "./logger";

const logger = new Logger("manager-notification");

interface TrialRequestNotificationData {
  requestId: string;
  userId: string;
  userEmail: string;
  userName: string;
  companyName: string;
  position: string;
  phone?: string;
  message: string;
  requestType: string;
  createdAt: Date;
}

/**
 * Отправляет уведомление менеджеру о новой заявке
 */
export async function sendManagerNotification(requestData: TrialRequestNotificationData): Promise<boolean> {
  try {
    // В демо-версии просто логируем уведомление
    logger.info("New trial request notification", {
      requestId: requestData.requestId,
      userEmail: requestData.userEmail,
      companyName: requestData.companyName,
      requestType: requestData.requestType
    });

    // TODO: Здесь будет реальная отправка уведомления:
    // 1. Email на менеджера
    // 2. Slack/Telegram уведомление
    // 3. Push-уведомление в admin-панель
    // 4. SMS уведомление (критические заявки)

    // Имитация успешной отправки
    await new Promise(resolve => setTimeout(resolve, 100));

    return true;

  } catch (error) {
    logger.error(
      "Failed to send manager notification",
      error instanceof Error ? error : undefined,
      {
        requestId: requestData.requestId,
        userEmail: requestData.userEmail
      }
    );

    return false;
  }
}

/**
 * Отправляет email уведомление менеджеру
 */
export async function sendEmailNotification(requestData: TrialRequestNotificationData): Promise<boolean> {
  try {
    // TODO: Интеграция с Email провайдером (например, SendGrid, Mailgun)

    const emailContent = {
      to: process.env.MANAGER_EMAIL || "manager@esg-lite.ru",
      subject: `🔔 Новая заявка на доступ: ${requestData.companyName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1dc962;">Новая заявка на доступ к ESG-Лайт</h2>

          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Информация о заявке</h3>
            <p><strong>ID заявки:</strong> ${requestData.requestId}</p>
            <p><strong>Дата:</strong> ${requestData.createdAt.toLocaleString('ru-RU')}</p>
            <p><strong>Тип:</strong> ${requestData.requestType}</p>
          </div>

          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Данные пользователя</h3>
            <p><strong>Имя:</strong> ${requestData.userName}</p>
            <p><strong>Email:</strong> ${requestData.userEmail}</p>
            <p><strong>Компания:</strong> ${requestData.companyName}</p>
            <p><strong>Должность:</strong> ${requestData.position}</p>
            ${requestData.phone ? `<p><strong>Телефон:</strong> ${requestData.phone}</p>` : ''}
          </div>

          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Сообщение</h3>
            <p>${requestData.message}</p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXTAUTH_URL}/admin/trial-requests/${requestData.requestId}"
               style="background: #1dc962; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Обработать заявку
            </a>
          </div>

          <p style="color: #666; font-size: 12px; text-align: center;">
            Это автоматическое уведомление от системы ESG-Лайт
          </p>
        </div>
      `
    };

    logger.info("Email notification prepared", {
      requestId: requestData.requestId,
      to: emailContent.to
    });

    // В продакшне здесь будет реальная отправка email
    return true;

  } catch (error) {
    logger.error(
      "Failed to send email notification",
      error instanceof Error ? error : undefined,
      {
        requestId: requestData.requestId
      }
    );

    return false;
  }
}

/**
 * Отправляет Slack уведомление менеджеру
 */
export async function sendSlackNotification(requestData: TrialRequestNotificationData): Promise<boolean> {
  try {
    // TODO: Интеграция со Slack Webhook

    const slackMessage = {
      text: `🔔 Новая заявка на доступ к ESG-Лайт`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "🔔 Новая заявка на доступ"
          }
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Компания:*\n${requestData.companyName}`
            },
            {
              type: "mrkdwn",
              text: `*Пользователь:*\n${requestData.userName} (${requestData.userEmail})`
            },
            {
              type: "mrkdwn",
              text: `*Тип заявки:*\n${requestData.requestType}`
            },
            {
              type: "mrkdwn",
              text: `*Дата:*\n${requestData.createdAt.toLocaleString('ru-RU')}`
            }
          ]
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Сообщение:*\n${requestData.message}`
          }
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "Обработать заявку"
              },
              url: `${process.env.NEXTAUTH_URL}/admin/trial-requests/${requestData.requestId}`,
              style: "primary"
            }
          ]
        }
      ]
    };

    logger.info("Slack notification prepared", {
      requestId: requestData.requestId,
      webhook: process.env.SLACK_WEBHOOK_URL ? "configured" : "not_configured"
    });

    // В продакшне здесь будет отправка в Slack
    return true;

  } catch (error) {
    logger.error(
      "Failed to send Slack notification",
      error instanceof Error ? error : undefined,
      {
        requestId: requestData.requestId
      }
    );

    return false;
  }
}

/**
 * Основная функция отправки всех уведомлений
 */
export async function notifyManagerAboutTrialRequest(requestData: TrialRequestNotificationData): Promise<void> {
  logger.info("Sending manager notifications for new trial request", {
    requestId: requestData.requestId,
    userEmail: requestData.userEmail,
    companyName: requestData.companyName
  });

  // Отправляем все виды уведомлений параллельно
  const notifications = await Promise.allSettled([
    sendEmailNotification(requestData),
    sendSlackNotification(requestData),
    sendManagerNotification(requestData)
  ]);

  // Логируем результаты
  notifications.forEach((result, index) => {
    const notificationType = ['email', 'slack', 'general'][index];

    if (result.status === 'fulfilled' && result.value) {
      logger.info(`${notificationType} notification sent successfully`, {
        requestId: requestData.requestId
      });
    } else {
      logger.warn(`${notificationType} notification failed`, {
        requestId: requestData.requestId,
        error: result.status === 'rejected' ? result.reason : 'unknown'
      });
    }
  });
}