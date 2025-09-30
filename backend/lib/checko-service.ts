/**
 * Сервис для работы с Checko API
 * Автозаполнение данных организации по ИНН
 */

import { Logger } from "./logger";

const logger = new Logger("checko-service");

interface CheckoCompanyData {
  ОГРН?: string;
  ИНН: string;
  КПП?: string;
  НаимСокр?: string;
  НаимПолн?: string;
  ЮрАдрес?: {
    АдресРФ?: string;
    НасПункт?: string;
  };
  ОКВЭД?: {
    Код: string;
    Наим: string;
  };
  Статус?: {
    Код: string;
    Наим: string;
  };
  Руковод?: Array<{
    ФИО: string;
    НаимДолжн: string;
  }>;
  Контакты?: {
    Тел?: string[];
    Емэйл?: string[];
    ВебСайт?: string;
  };
}

interface CheckoResponse {
  data: CheckoCompanyData;
  meta: {
    status: string;
    today_request_count: number;
    balance: number;
  };
}

export interface CompanyInfo {
  inn: string;
  kpp?: string;
  ogrn?: string;
  shortName?: string;
  fullName?: string;
  address?: string;
  okvedCode?: string;
  okvedName?: string;
  status?: string;
  director?: string;
  directorPosition?: string;
  phone?: string;
  email?: string;
  website?: string;
}

class CheckoService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.checko.ru/v2';

  constructor() {
    this.apiKey = process.env.CHECKO_API_KEY || '';

    if (!this.apiKey) {
      logger.warn("Checko API key not configured. INN lookup will not work.");
    }
  }

  /**
   * Получение информации о компании по ИНН
   */
  async getCompanyByInn(inn: string): Promise<CompanyInfo | null> {
    if (!this.apiKey) {
      logger.warn("Checko API key not configured", { inn });
      return null;
    }

    // Валидация ИНН
    if (!this.isValidInn(inn)) {
      logger.warn("Invalid INN format", { inn });
      throw new Error("Некорректный формат ИНН");
    }

    try {
      logger.info("Fetching company data from Checko", { inn });

      const response = await fetch(`${this.baseUrl}/company`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key: this.apiKey,
          inn: inn
        })
      });

      if (!response.ok) {
        logger.error("Checko API request failed", undefined, {
          inn,
          status: response.status,
          statusText: response.statusText
        });
        throw new Error(`Ошибка API Checko: ${response.status}`);
      }

      const data: CheckoResponse = await response.json();

      if (data.meta.status !== 'ok') {
        logger.warn("Checko API returned error status", {
          inn,
          status: data.meta.status
        });
        throw new Error("Не удалось получить данные о компании");
      }

      logger.info("Company data received from Checko", {
        inn,
        balance: data.meta.balance,
        requestCount: data.meta.today_request_count
      });

      return this.parseCompanyData(data.data);

    } catch (error) {
      logger.error(
        "Failed to fetch company data",
        error instanceof Error ? error : undefined,
        { inn }
      );

      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error("Не удалось получить данные о компании");
      }
    }
  }

  /**
   * Валидация ИНН
   */
  private isValidInn(inn: string): boolean {
    // Убираем пробелы и дефисы
    const cleanInn = inn.replace(/[\s-]/g, '');

    // ИНН должен содержать только цифры
    if (!/^\d+$/.test(cleanInn)) {
      return false;
    }

    // ИНН может быть 10 или 12 цифр
    if (cleanInn.length !== 10 && cleanInn.length !== 12) {
      return false;
    }

    // Дополнительная валидация контрольных сумм
    return this.validateInnChecksum(cleanInn);
  }

  /**
   * Проверка контрольных сумм ИНН
   */
  private validateInnChecksum(inn: string): boolean {
    const digits = inn.split('').map(Number);

    if (inn.length === 10) {
      const weights = [2, 4, 10, 3, 5, 9, 4, 6, 8];
      const sum = weights.reduce((acc, weight, index) => acc + weight * digits[index], 0);
      const checkDigit = (sum % 11) % 10;
      return checkDigit === digits[9];
    }

    if (inn.length === 12) {
      const weights1 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
      const weights2 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8];

      const sum1 = weights1.reduce((acc, weight, index) => acc + weight * digits[index], 0);
      const checkDigit1 = (sum1 % 11) % 10;

      const sum2 = weights2.reduce((acc, weight, index) => acc + weight * digits[index], 0);
      const checkDigit2 = (sum2 % 11) % 10;

      return checkDigit1 === digits[10] && checkDigit2 === digits[11];
    }

    return false;
  }

  /**
   * Парсинг данных компании из ответа Checko
   */
  private parseCompanyData(data: CheckoCompanyData): CompanyInfo {
    const director = data.Руковод?.[0];
    const contacts = data.Контакты;

    return {
      inn: data.ИНН,
      kpp: data.КПП || undefined,
      ogrn: data.ОГРН || undefined,
      shortName: data.НаимСокр || undefined,
      fullName: data.НаимПолн || undefined,
      address: data.ЮрАдрес?.АдресРФ || data.ЮрАдрес?.НасПункт || undefined,
      okvedCode: data.ОКВЭД?.Код || undefined,
      okvedName: data.ОКВЭД?.Наим || undefined,
      status: data.Статус?.Наим || undefined,
      director: director?.ФИО || undefined,
      directorPosition: director?.НаимДолжн || undefined,
      phone: contacts?.Тел?.[0] || undefined,
      email: contacts?.Емэйл?.[0] || undefined,
      website: contacts?.ВебСайт || undefined,
    };
  }

  /**
   * Проверка статуса API (баланс, лимиты)
   */
  async getApiStatus(): Promise<{ balance: number; requestCount: number } | null> {
    if (!this.apiKey) {
      return null;
    }

    try {
      // Используем тестовый ИНН для проверки статуса
      const response = await fetch(`${this.baseUrl}/company`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key: this.apiKey,
          inn: '7735560386' // Тестовый ИНН
        })
      });

      if (response.ok) {
        const data: CheckoResponse = await response.json();
        return {
          balance: data.meta.balance,
          requestCount: data.meta.today_request_count
        };
      }

      return null;
    } catch (error) {
      logger.error("Failed to check Checko API status", error instanceof Error ? error : undefined);
      return null;
    }
  }
}

// Singleton экземпляр
export const checkoService = new CheckoService();

/**
 * Вспомогательная функция для получения информации о компании
 */
export async function getCompanyInfo(inn: string): Promise<CompanyInfo | null> {
  return checkoService.getCompanyByInn(inn);
}

/**
 * Проверка доступности Checko API
 */
export async function isCheckoApiAvailable(): Promise<boolean> {
  const status = await checkoService.getApiStatus();
  return status !== null && status.balance > 0;
}