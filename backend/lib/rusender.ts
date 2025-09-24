/**
 * RuSender API интеграция для отправки транзакционных писем
 * Документация: https://rusender.ru/developer/api/email/
 */

import crypto from "crypto";

export type RuSenderSendResult = {
  status: string;
  email?: string;
  message_id?: string;
  error?: unknown;
};

export async function sendEmailViaRuSender(options: {
  to: string;
  subject: string;
  html: string;
  fromEmail?: string;
  fromName?: string;
}): Promise<RuSenderSendResult> {
  const apiKey = process.env.RUSENDER_API_KEY;
  
  if (!apiKey) {
    return { status: "skipped", error: "RUSENDER_API_KEY not set" };
  }

  try {
    // Генерируем уникальный ключ идемпотентности
    const idempotencyKey = crypto.randomUUID();
    
    const payload = {
      idempotencyKey,
      mail: {
        to: {
          email: options.to,
          name: "" // Можно оставить пустым
        },
        from: {
          email: options.fromEmail || process.env.RUSENDER_FROM_EMAIL || "no-reply@esg-lite.ru",
          name: options.fromName || process.env.RUSENDER_FROM_NAME || "ESG‑Lite"
        },
        subject: options.subject,
        previewTitle: options.subject, // Используем тему как превью
        html: options.html
      }
    };

    const response = await fetch('https://api.beta.rusender.ru/api/v1/external-mails/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey
      },
      body: JSON.stringify(payload)
    });

    const responseData = await response.json();

    if (response.status === 201) {
      return {
        status: "ok",
        email: options.to,
        message_id: responseData.uuid
      };
    } else {
      
      // Обработка различных типов ошибок
      let errorMessage = responseData.message || `HTTP ${response.status}`;
      
      switch (response.status) {
        case 400:
          errorMessage = `Неверный формат запроса: ${responseData.message}`;
          break;
        case 401:
          errorMessage = 'Неверный API ключ';
          break;
        case 402:
          errorMessage = 'Недостаточно средств на балансе';
          break;
        case 403:
          errorMessage = 'API ключ не активирован или домен не верифицирован';
          break;
        case 404:
          errorMessage = 'Пользователь или домен не найден';
          break;
        case 422:
          if (responseData.message?.includes('unsubscribed')) {
            errorMessage = 'Получатель отписался от рассылки';
          } else if (responseData.message?.includes('complained')) {
            errorMessage = 'Получатель пожаловался на рассылку';
          } else if (responseData.message?.includes("doesn't exist")) {
            errorMessage = 'Email получателя не существует';
          } else if (responseData.message?.includes('unavailable')) {
            errorMessage = 'Email получателя недоступен';
          } else {
            errorMessage = `Ошибка валидации: ${responseData.message}`;
          }
          break;
        case 503:
          errorMessage = 'Сервис временно недоступен';
          break;
      }
      
      return {
        status: "error",
        error: errorMessage
      };
    }
    
  } catch (error) {
    return {
      status: "error",
      error: error instanceof Error ? error.message : 'Network error'
    };
  }
}