/**
 * Утилита для парсинга организационно-правовой формы (ОПФ) из названия организации
 * Для системы ESG-Лайт (отчеты 296-ФЗ)
 */

import logger from './logger';

/**
 * Справочник организационно-правовых форм по ОКОПФ
 * Источник: Приказ Росстандарта от 12.12.2014 N 2019-ст
 */
export const LEGAL_FORMS = {
  // Юридические лица (коммерческие)
  'ПАО': { code: '12247', full: 'Публичное акционерное общество', type: 'commercial' },
  'АО': { code: '12267', full: 'Акционерное общество', type: 'commercial' },
  'ОАО': { code: '12247', full: 'Открытое акционерное общество', type: 'commercial' }, // Устаревшее
  'ЗАО': { code: '12267', full: 'Закрытое акционерное общество', type: 'commercial' }, // Устаревшее
  'ООО': { code: '12300', full: 'Общество с ограниченной ответственностью', type: 'commercial' },
  'ОДО': { code: '12400', full: 'Общество с дополнительной ответственностью', type: 'commercial' },
  'НАО': { code: '12165', full: 'Непубличное акционерное общество', type: 'commercial' },

  // Государственные предприятия
  'ГУП': { code: '65260', full: 'Государственное унитарное предприятие', type: 'state' },
  'МУП': { code: '65266', full: 'Муниципальное унитарное предприятие', type: 'municipal' },
  'ФГУП': { code: '65269', full: 'Федеральное государственное унитарное предприятие', type: 'federal' },

  // Индивидуальные предприниматели
  'ИП': { code: '50102', full: 'Индивидуальный предприниматель', type: 'individual' },
  'ИПР': { code: '50102', full: 'Индивидуальный предприниматель', type: 'individual' },
  'ПБОЮЛ': { code: '50102', full: 'Предприниматель без образования юридического лица', type: 'individual' }, // Устаревшее

  // Некоммерческие организации
  'АНО': { code: '71400', full: 'Автономная некоммерческая организация', type: 'nonprofit' },
  'НКО': { code: '71000', full: 'Некоммерческая организация', type: 'nonprofit' },
  'ФНД': { code: '71100', full: 'Фонд', type: 'nonprofit' },
  'НФ': { code: '71200', full: 'Некоммерческое партнерство', type: 'nonprofit' },
  'ЧУ': { code: '71500', full: 'Частное учреждение', type: 'nonprofit' },
  'БУ': { code: '75103', full: 'Бюджетное учреждение', type: 'nonprofit' },
  'ГУ': { code: '75401', full: 'Государственное учреждение', type: 'nonprofit' },
  'МУ': { code: '75404', full: 'Муниципальное учреждение', type: 'nonprofit' },

  // Кооперативы
  'ПК': { code: '10700', full: 'Производственный кооператив', type: 'cooperative' },
  'СПК': { code: '10700', full: 'Сельскохозяйственный производственный кооператив', type: 'cooperative' },
  'ПТ': { code: '11200', full: 'Полное товарищество', type: 'partnership' },
  'КТ': { code: '11300', full: 'Коммандитное товарищество', type: 'partnership' },
} as const;

export type LegalFormCode = keyof typeof LEGAL_FORMS;

export interface ParsedLegalForm {
  /** Краткое название ОПФ (например, "ООО") */
  short: string;
  /** Полное название ОПФ (например, "Общество с ограниченной ответственностью") */
  full: string;
  /** Код по ОКОПФ (например, "12300") */
  code: string;
  /** Тип организации */
  type: 'commercial' | 'state' | 'municipal' | 'federal' | 'individual' | 'nonprofit' | 'cooperative' | 'partnership';
  /** Название организации без ОПФ */
  nameWithoutOpf: string;
}

/**
 * Извлекает ОПФ из названия организации
 *
 * @param organizationName - Полное или краткое название организации
 * @returns Объект с данными ОПФ или null если не найдено
 *
 * @example
 * extractLegalForm('ООО "Рога и Копыта"')
 * // => { short: 'ООО', full: 'Общество с ограниченной ответственностью',
 * //      code: '12300', type: 'commercial', nameWithoutOpf: 'Рога и Копыта' }
 *
 * extractLegalForm('ПАО СБЕРБАНК')
 * // => { short: 'ПАО', full: 'Публичное акционерное общество',
 * //      code: '12247', type: 'commercial', nameWithoutOpf: 'СБЕРБАНК' }
 */
export function extractLegalForm(organizationName: string): ParsedLegalForm | null {
  if (!organizationName || typeof organizationName !== 'string') {
    return null;
  }

  const trimmedName = organizationName.trim();

  // Список ОПФ, отсортированный по длине (от длинных к коротким)
  // Это важно чтобы сначала искать "ФГУП", а потом "ГУП"
  const sortedForms = Object.keys(LEGAL_FORMS).sort((a, b) => b.length - a.length) as LegalFormCode[];

  for (const formShort of sortedForms) {
    // Создаем regex для поиска ОПФ в начале строки
    // Учитываем кавычки, пробелы и точки после ОПФ
    const regex = new RegExp(`^${formShort}[\\s."«]+`, 'i');

    if (regex.test(trimmedName)) {
      const formData = LEGAL_FORMS[formShort];

      // Убираем ОПФ из названия
      let nameWithoutOpf = trimmedName.replace(regex, '').trim();

      // Убираем кавычки вокруг названия
      nameWithoutOpf = nameWithoutOpf.replace(/^["«]|["»]$/g, '');

      logger.info('Извлечена ОПФ из названия организации', {
        original: organizationName,
        opf: formShort,
        nameWithoutOpf,
      });

      return {
        short: formShort,
        full: formData.full,
        code: formData.code,
        type: formData.type,
        nameWithoutOpf,
      };
    }
  }

  // Если ОПФ не найдена в начале, пробуем найти через пробел
  for (const formShort of sortedForms) {
    const regex = new RegExp(`\\b${formShort}\\b`, 'i');

    if (regex.test(trimmedName)) {
      const formData = LEGAL_FORMS[formShort];

      // Убираем ОПФ из названия
      let nameWithoutOpf = trimmedName.replace(regex, '').trim();
      nameWithoutOpf = nameWithoutOpf.replace(/^["«]|["»]$/g, '');
      nameWithoutOpf = nameWithoutOpf.replace(/\s+/g, ' '); // Убираем лишние пробелы

      logger.info('Извлечена ОПФ из середины названия организации', {
        original: organizationName,
        opf: formShort,
        nameWithoutOpf,
      });

      return {
        short: formShort,
        full: formData.full,
        code: formData.code,
        type: formData.type,
        nameWithoutOpf,
      };
    }
  }

  logger.warn('Не удалось извлечь ОПФ из названия организации', {
    organizationName,
  });

  return null;
}

/**
 * Валидация кода ОПФ по ОКОПФ
 *
 * @param code - Код ОПФ (5 цифр)
 * @returns true если код валиден
 */
export function validateLegalFormCode(code: string): boolean {
  if (!code || typeof code !== 'string') {
    return false;
  }

  // Код ОКОПФ состоит из 5 цифр
  return /^\d{5}$/.test(code);
}

/**
 * Получает ОПФ по коду ОКОПФ
 *
 * @param code - Код ОПФ (5 цифр)
 * @returns Объект с данными ОПФ или null
 */
export function getLegalFormByCode(code: string): ParsedLegalForm | null {
  if (!validateLegalFormCode(code)) {
    return null;
  }

  for (const [short, data] of Object.entries(LEGAL_FORMS)) {
    if (data.code === code) {
      return {
        short,
        full: data.full,
        code: data.code,
        type: data.type,
        nameWithoutOpf: '', // Не применимо для поиска по коду
      };
    }
  }

  return null;
}

/**
 * Форматирует название организации с ОПФ
 *
 * @param nameWithoutOpf - Название без ОПФ
 * @param legalFormShort - Краткое название ОПФ
 * @param useQuotes - Добавлять ли кавычки вокруг названия
 * @returns Отформатированное название
 *
 * @example
 * formatOrganizationName('Рога и Копыта', 'ООО', true)
 * // => 'ООО "Рога и Копыта"'
 */
export function formatOrganizationName(
  nameWithoutOpf: string,
  legalFormShort: LegalFormCode,
  useQuotes: boolean = true
): string {
  if (!nameWithoutOpf || !legalFormShort) {
    return nameWithoutOpf || '';
  }

  if (useQuotes) {
    return `${legalFormShort} "${nameWithoutOpf}"`;
  }

  return `${legalFormShort} ${nameWithoutOpf}`;
}
