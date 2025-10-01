/**
 * Валидатор данных организации для генерации отчетов 296-ФЗ
 * Проверяет полноту обязательных реквизитов перед созданием отчета
 */

import { Logger } from "./logger";

const logger = new Logger("organization-validator");

export interface OrganizationData {
  inn?: string | null;
  kpp?: string | null;
  ogrn?: string | null;
  fullName?: string | null;
  shortName?: string | null;
  legalAddress?: string | null;
  okved?: string | null;
  oktmo?: string | null;
  okpo?: string | null;
  directorName?: string | null;
  directorPosition?: string | null;
}

export interface ValidationResult {
  isValid: boolean;
  missingFields: string[];
  warnings: string[];
}

/**
 * Обязательные поля для отчета 296-ФЗ
 */
const REQUIRED_FIELDS_296FZ = [
  { field: 'inn', label: 'ИНН' },
  { field: 'ogrn', label: 'ОГРН' },
  { field: 'kpp', label: 'КПП' },
  { field: 'fullName', label: 'Полное наименование организации' },
  { field: 'legalAddress', label: 'Юридический адрес' },
  { field: 'okved', label: 'ОКВЭД (вид деятельности)' },
  { field: 'directorName', label: 'ФИО руководителя' },
  { field: 'directorPosition', label: 'Должность руководителя' },
];

/**
 * Рекомендуемые поля (не обязательные, но желательные)
 */
const RECOMMENDED_FIELDS = [
  { field: 'oktmo', label: 'ОКТМО (территория)' },
  { field: 'okpo', label: 'ОКПО (статистический код)' },
  { field: 'shortName', label: 'Сокращенное наименование' },
];

/**
 * Валидация полноты данных организации для отчета 296-ФЗ
 */
export function validateOrganizationData(data: OrganizationData): ValidationResult {
  const missingFields: string[] = [];
  const warnings: string[] = [];

  logger.info("Validating organization data for 296-ФЗ report", {
    hasInn: !!data.inn,
    hasOgrn: !!data.ogrn,
    hasFullName: !!data.fullName,
  });

  // Проверяем обязательные поля
  for (const { field, label } of REQUIRED_FIELDS_296FZ) {
    const value = data[field as keyof OrganizationData];

    if (!value || (typeof value === 'string' && value.trim() === '')) {
      missingFields.push(label);
      logger.warn(`Missing required field: ${field} (${label})`);
    }
  }

  // Проверяем рекомендуемые поля
  for (const { field, label } of RECOMMENDED_FIELDS) {
    const value = data[field as keyof OrganizationData];

    if (!value || (typeof value === 'string' && value.trim() === '')) {
      warnings.push(`Рекомендуется заполнить: ${label}`);
    }
  }

  const isValid = missingFields.length === 0;

  if (isValid) {
    logger.info("✅ Organization data is valid for 296-ФЗ report");
  } else {
    logger.warn("❌ Organization data is incomplete", {
      missingFieldsCount: missingFields.length,
      missingFields,
    });
  }

  return {
    isValid,
    missingFields,
    warnings,
  };
}

/**
 * Валидация ИНН (10 или 12 цифр с корректной контрольной суммой)
 */
export function validateInn(inn: string): boolean {
  if (!inn) return false;

  const cleanInn = inn.replace(/[\s-]/g, '');

  // ИНН должен быть 10 или 12 цифр
  if (!/^\d{10}$/.test(cleanInn) && !/^\d{12}$/.test(cleanInn)) {
    return false;
  }

  // Проверка контрольной суммы для 10-значного ИНН
  if (cleanInn.length === 10) {
    const coefficients = [2, 4, 10, 3, 5, 9, 4, 6, 8];
    const checksum = coefficients.reduce((sum, coef, i) => sum + coef * parseInt(cleanInn[i], 10), 0) % 11 % 10;
    return checksum === parseInt(cleanInn[9], 10);
  }

  // Проверка контрольной суммы для 12-значного ИНН
  if (cleanInn.length === 12) {
    const coefficients1 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
    const coefficients2 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8];

    const checksum1 = coefficients1.reduce((sum, coef, i) => sum + coef * parseInt(cleanInn[i], 10), 0) % 11 % 10;
    const checksum2 = coefficients2.reduce((sum, coef, i) => sum + coef * parseInt(cleanInn[i], 10), 0) % 11 % 10;

    return checksum1 === parseInt(cleanInn[10], 10) && checksum2 === parseInt(cleanInn[11], 10);
  }

  return false;
}

/**
 * Валидация ОГРН (13 или 15 цифр с корректной контрольной суммой)
 */
export function validateOgrn(ogrn: string): boolean {
  if (!ogrn) return false;

  const cleanOgrn = ogrn.replace(/[\s-]/g, '');

  // ОГРН должен быть 13 цифр (юр. лица) или 15 цифр (ИП)
  if (!/^\d{13}$/.test(cleanOgrn) && !/^\d{15}$/.test(cleanOgrn)) {
    return false;
  }

  // Проверка контрольной суммы
  const length = cleanOgrn.length;
  const digits = cleanOgrn.slice(0, length - 1);
  const controlDigit = parseInt(cleanOgrn[length - 1], 10);

  const remainder = Number(digits) % (length === 13 ? 11 : 13);
  const expectedDigit = remainder === 10 ? 0 : remainder;

  return expectedDigit === controlDigit;
}

/**
 * Форматирование списка недостающих полей для вывода пользователю
 */
export function formatMissingFieldsMessage(missingFields: string[]): string {
  if (missingFields.length === 0) {
    return "";
  }

  if (missingFields.length === 1) {
    return `Для генерации отчета 296-ФЗ необходимо заполнить: ${missingFields[0]}.`;
  }

  const fields = missingFields.slice(0, -1).join(', ');
  const lastField = missingFields[missingFields.length - 1];

  return `Для генерации отчета 296-ФЗ необходимо заполнить следующие поля: ${fields} и ${lastField}.`;
}

/**
 * Проверка статуса компании (должна быть действующей)
 */
export function isCompanyActive(companyStatus?: string | null): boolean {
  if (!companyStatus) return true; // Если статус не указан, считаем активной

  const status = companyStatus.toUpperCase();

  // Статусы активных компаний
  const activeStatuses = ['ACTIVE', 'ДЕЙСТВУЕТ', 'ДЕЙСТВУЮЩАЯ'];

  return activeStatuses.includes(status);
}

/**
 * Генерация предупреждений о качестве данных
 */
export function generateDataQualityWarnings(data: OrganizationData): string[] {
  const warnings: string[] = [];

  // Проверка ИНН
  if (data.inn && !validateInn(data.inn)) {
    warnings.push('⚠️ ИНН имеет некорректный формат или контрольную сумму');
  }

  // Проверка ОГРН
  if (data.ogrn && !validateOgrn(data.ogrn)) {
    warnings.push('⚠️ ОГРН имеет некорректный формат или контрольную сумму');
  }

  // Проверка длины адреса
  if (data.legalAddress && data.legalAddress.length < 20) {
    warnings.push('⚠️ Юридический адрес слишком короткий - возможно указан не полностью');
  }

  // Проверка ФИО директора
  if (data.directorName && data.directorName.split(' ').length < 2) {
    warnings.push('⚠️ ФИО руководителя должно содержать Фамилию и Имя (минимум 2 слова)');
  }

  return warnings;
}
