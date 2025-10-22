/**
 * Клиент для работы с Dadata MCP API
 * БЕСПЛАТНЫЙ приоритетный источник данных по ИНН/ОГРН
 * Если не работает - fallback на Checko API
 */

import { Logger } from "./logger";

const logger = new Logger("dadata-mcp-client");

interface DadataCompanyData {
  value: string; // ИНН
  unrestricted_value: string; // Полное название
  data: {
    inn: string;
    kpp?: string;
    ogrn?: string;
    okpo?: string;
    okved?: string;
    oktmo?: string;
    okato?: string;
    name: {
      full_with_opf?: string;
      short_with_opf?: string;
    };
    opf?: {
      type?: string; // LEGAL, INDIVIDUAL
      code?: string; // Код по ОКОПФ (5 цифр)
      full?: string; // Полное название ОПФ
      short?: string; // Краткое название ОПФ (ООО, АО, и т.д.)
    };
    address: {
      value?: string;
      unrestricted_value?: string;
    };
    management?: {
      name?: string;
      post?: string;
    };
    state: {
      status: string; // ACTIVE, LIQUIDATING, LIQUIDATED
      actuality_date?: number;
    };
    phones?: Array<{ value: string }>;
    emails?: Array<{ value: string }>;
  };
}

interface DadataResponse {
  suggestions: DadataCompanyData[];
}

export interface CompanyInfo {
  inn: string;
  kpp?: string;
  ogrn?: string;
  okpo?: string;
  okved?: string;
  oktmo?: string;
  okato?: string;
  shortName?: string;
  fullName?: string;
  address?: string;
  status?: string;
  director?: string;
  directorPosition?: string;
  phone?: string;
  email?: string;
  // Организационно-правовая форма (ОПФ)
  opfCode?: string; // Код по ОКОПФ (например, "12300")
  opfFull?: string; // Полное название (например, "Общество с ограниченной ответственностью")
  opfShort?: string; // Краткое название (например, "ООО")
}

class DadataMcpClient {
  private readonly apiKey: string;
  private readonly secretKey: string;
  private readonly baseUrl = 'https://suggestions.dadata.ru/suggestions/api/4_1/rs';

  constructor() {
    this.apiKey = process.env.DADATA_API_KEY || '';
    this.secretKey = process.env.DADATA_SECRET_KEY || '';

    if (!this.apiKey || !this.secretKey) {
      logger.warn("Dadata API keys not configured. Falling back to Checko.");
    }
  }

  /**
   * Получение информации о компании по ИНН
   */
  async getCompanyByInn(inn: string): Promise<CompanyInfo | null> {
    if (!this.apiKey || !this.secretKey) {
      logger.warn("Dadata API keys not configured", { inn });
      throw new Error("Dadata API keys not configured");
    }

    // Валидация ИНН
    if (!this.isValidInn(inn)) {
      logger.warn("Invalid INN format", { inn });
      throw new Error("Некорректный формат ИНН");
    }

    try {
      logger.info("Fetching company data from Dadata MCP", { inn });

      const response = await fetch(`${this.baseUrl}/findById/party`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Token ${this.apiKey}`,
          'X-Secret': this.secretKey,
        },
        body: JSON.stringify({
          query: inn,
          count: 1
        })
      });

      if (!response.ok) {
        logger.error("Dadata API request failed", undefined, {
          inn,
          status: response.status,
          statusText: response.statusText
        });
        throw new Error(`Ошибка API Dadata: ${response.status}`);
      }

      const data: DadataResponse = await response.json();

      if (!data.suggestions || data.suggestions.length === 0) {
        logger.warn("No company found in Dadata", { inn });
        throw new Error("Организация не найдена в базе Dadata");
      }

      const companyData = data.suggestions[0];

      logger.info("✅ Company data received from Dadata MCP", {
        inn,
        name: companyData.data.name.short_with_opf,
        status: companyData.data.state.status
      });

      return this.parseCompanyData(companyData);

    } catch (error) {
      logger.error(
        "Failed to fetch company data from Dadata",
        error instanceof Error ? error : undefined,
        { inn }
      );

      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error("Не удалось получить данные о компании из Dadata");
      }
    }
  }

  /**
   * Валидация ИНН (10 или 12 цифр)
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

    return true;
  }

  /**
   * Парсинг данных компании из ответа Dadata
   */
  private parseCompanyData(data: DadataCompanyData): CompanyInfo {
    const companyData = data.data;

    // Маппинг статуса
    let status = 'Неизвестно';
    switch (companyData.state.status) {
      case 'ACTIVE':
        status = 'Действует';
        break;
      case 'LIQUIDATING':
        status = 'Ликвидируется';
        break;
      case 'LIQUIDATED':
        status = 'Ликвидирована';
        break;
    }

    return {
      inn: companyData.inn,
      kpp: companyData.kpp || undefined,
      ogrn: companyData.ogrn || undefined,
      okpo: companyData.okpo || undefined,
      okved: companyData.okved || undefined,
      oktmo: companyData.oktmo || undefined,
      okato: companyData.okato || undefined,
      shortName: companyData.name.short_with_opf || undefined,
      fullName: companyData.name.full_with_opf || undefined,
      address: companyData.address.unrestricted_value || companyData.address.value || undefined,
      status: status,
      director: companyData.management?.name || undefined,
      directorPosition: companyData.management?.post || undefined,
      phone: companyData.phones?.[0]?.value || undefined,
      email: companyData.emails?.[0]?.value || undefined,
      // Организационно-правовая форма (ОПФ)
      opfCode: companyData.opf?.code || undefined,
      opfFull: companyData.opf?.full || undefined,
      opfShort: companyData.opf?.short || undefined,
    };
  }

  /**
   * Проверка статуса API
   */
  async getApiStatus(): Promise<{ available: boolean } | null> {
    if (!this.apiKey || !this.secretKey) {
      return null;
    }

    try {
      // Используем тестовый ИНН для проверки
      const response = await fetch(`${this.baseUrl}/findById/party`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Token ${this.apiKey}`,
          'X-Secret': this.secretKey,
        },
        body: JSON.stringify({
          query: '7707083893', // ПАО Сбербанк (тестовый ИНН)
          count: 1
        })
      });

      return { available: response.ok };
    } catch (error) {
      logger.error("Failed to check Dadata API status", error instanceof Error ? error : undefined);
      return null;
    }
  }
}

// Singleton экземпляр
export const dadataMcpClient = new DadataMcpClient();

/**
 * Вспомогательная функция для получения информации о компании
 */
export async function getCompanyInfo(inn: string): Promise<CompanyInfo | null> {
  return dadataMcpClient.getCompanyByInn(inn);
}

/**
 * Проверка доступности Dadata API
 */
export async function isDadataApiAvailable(): Promise<boolean> {
  const status = await dadataMcpClient.getApiStatus();
  return status !== null && status.available;
}
