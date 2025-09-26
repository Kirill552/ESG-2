/**
 * RuSender API интеграция для отправки транзакционных писем
 * Документация: https://rusender.ru/developer/api/email/
 */

import crypto from "crypto";

type RuSenderStatus = "ok" | "error" | "skipped";

export type RuSenderSendResult = {
  status: RuSenderStatus;
  email?: string;
  message_id?: string;
  error?: unknown;
};

export async function sendEmailViaRuSender(options: {
  to: string;
  subject: string;
  html: string;
  text?: string;
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
        html: options.html,
        ...(options.text ? { text: options.text } : {})
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

    const rawBody = await response.text();
    let responseData: Record<string, unknown> = {};
    if (rawBody) {
      try {
        responseData = JSON.parse(rawBody);
      } catch (parseError) {
        responseData = { message: rawBody };
      }
    }

    if (response.status === 201) {
      return {
        status: "ok",
        email: options.to,
        message_id: typeof responseData.uuid === "string" ? responseData.uuid : undefined
      };
    } else {
      
      // Обработка различных типов ошибок
      const message = typeof responseData.message === "string" ? responseData.message : undefined;
      let errorMessage = message || `HTTP ${response.status}`;
      
      switch (response.status) {
        case 400:
          errorMessage = `Неверный формат запроса: ${message ?? "ошибка валидации"}`;
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
          if (message?.includes('unsubscribed')) {
            errorMessage = 'Получатель отписался от рассылки';
          } else if (message?.includes('complained')) {
            errorMessage = 'Получатель пожаловался на рассылку';
          } else if (message?.includes("doesn't exist")) {
            errorMessage = 'Email получателя не существует';
          } else if (message?.includes('unavailable')) {
            errorMessage = 'Email получателя недоступен';
          } else {
            errorMessage = `Ошибка валидации: ${message ?? 'уточните данные'}`;
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