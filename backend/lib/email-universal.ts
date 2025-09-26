/**
 * Универсальный email-сервис
 * Провайдер: только RuSender (+ Console в DEV)
 */

import { sendEmailViaRuSender } from './rusender';

export type EmailSendResult = {
  status: 'ok' | 'error' | 'skipped';
  provider?: string;
  email?: string;
  message_id?: string;
  error?: unknown;
};

export type EmailOptions = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  fromEmail?: string;
  fromName?: string;
};

/**
 * Отправляет email через доступный провайдер с fallback логикой
 */
export async function sendTransactionalEmail(options: EmailOptions): Promise<EmailSendResult> {
  const isDev = process.env.NODE_ENV === 'development';
  
  // 1. RuSender (единственный провайдер)
  if (process.env.RUSENDER_API_KEY) {
    const result = await sendEmailViaRuSender(options);
    if (result.status === 'ok') {
      return { ...result, provider: 'RuSender' } as EmailSendResult;
    }
    // Возвращаем ошибку RuSender как есть
    return { ...result, provider: 'RuSender' } as EmailSendResult;
  }

  // 2. Development fallback: Console logging
  if (isDev) {
    return {
      status: 'ok',
      provider: 'Console (DEV)',
      email: options.to,
      message_id: `dev-${Date.now()}`
    };
  }

  // 3. Провайдер недоступен/не настроен
  return {
    status: 'error',
    error: 'RuSender provider failed or not configured'
  };
}