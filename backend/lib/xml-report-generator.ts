/**
 * XML Report Generator для отчетов 296-ФЗ
 * Генерация XML в формате для подачи в Росприроднадзор
 */

import { Logger } from '@/lib/logger';

const logger = new Logger('xml-report-generator');

export interface OrganizationInfo {
  inn: string;
  kpp?: string;
  ogrn: string;
  fullName: string;
  shortName?: string;
  legalAddress: string;
  okved?: string;
  oktmo?: string;
  okpo?: string;
  directorName: string;
  directorPosition: string;
}

export interface EmissionSource {
  id: string;
  name: string;
  fuelType: string;
  volume: number;
  unit: string;
  co2Emissions: number;
  ch4Emissions?: number;
  n2oEmissions?: number;
}

export interface ReportData {
  organization: OrganizationInfo;
  period: string;
  sources: EmissionSource[];
  totalCO2: number;
  totalCH4?: number;
  totalN2O?: number;
  totalEmissions: number;
}

/**
 * Генерация XML отчета 296-ФЗ
 */
export async function generateXMLReport(data: ReportData): Promise<string> {
  try {
    logger.info('Generating XML report', {
      period: data.period,
      sourcesCount: data.sources.length,
      totalEmissions: data.totalEmissions,
    });

    const xml = buildXMLDocument(data);

    logger.info('XML report generated successfully', {
      xmlLength: xml.length,
    });

    return xml;
  } catch (error) {
    logger.error('XML report generation failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    throw error;
  }
}

/**
 * Построение XML документа
 */
function buildXMLDocument(data: ReportData): string {
  const currentDate = new Date().toISOString().split('T')[0];

  return `<?xml version="1.0" encoding="UTF-8"?>
<Отчет296ФЗ xmlns="urn:ru:rosprirodnadzor:greenhouse-gas-report:1.0">
  <ВерсияФормата>1.0</ВерсияФормата>
  <ДатаФормирования>${currentDate}</ДатаФормирования>

  <!-- Информация об организации -->
  <Организация>
    <ИНН>${escapeXML(data.organization.inn)}</ИНН>
    ${data.organization.kpp ? `<КПП>${escapeXML(data.organization.kpp)}</КПП>` : ''}
    <ОГРН>${escapeXML(data.organization.ogrn)}</ОГРН>
    <НаименованиеПолное>${escapeXML(data.organization.fullName)}</НаименованиеПолное>
    ${data.organization.shortName ? `<НаименованиеСокращенное>${escapeXML(data.organization.shortName)}</НаименованиеСокращенное>` : ''}
    <АдресЮридический>${escapeXML(data.organization.legalAddress)}</АдресЮридический>
    ${data.organization.okved ? `<ОКВЭД>${escapeXML(data.organization.okved)}</ОКВЭД>` : ''}
    ${data.organization.oktmo ? `<ОКТМО>${escapeXML(data.organization.oktmo)}</ОКТМО>` : ''}
    ${data.organization.okpo ? `<ОКПО>${escapeXML(data.organization.okpo)}</ОКПО>` : ''}

    <!-- Руководитель -->
    <Руководитель>
      <ФИО>${escapeXML(data.organization.directorName)}</ФИО>
      <Должность>${escapeXML(data.organization.directorPosition)}</Должность>
    </Руководитель>
  </Организация>

  <!-- Отчетный период -->
  <ОтчетныйПериод>
    <Год>${escapeXML(data.period)}</Год>
  </ОтчетныйПериод>

  <!-- Выбросы парниковых газов -->
  <ВыбросыПарниковыхГазов>
    <!-- Суммарные выбросы -->
    <ОбщиеВыбросы>
      <CO2 ЕдиницаИзмерения="тонн">${formatNumber(data.totalCO2)}</CO2>
      ${data.totalCH4 !== undefined ? `<CH4 ЕдиницаИзмерения="тонн">${formatNumber(data.totalCH4)}</CH4>` : ''}
      ${data.totalN2O !== undefined ? `<N2O ЕдиницаИзмерения="тонн">${formatNumber(data.totalN2O)}</N2O>` : ''}
      <ОбщийОбъем ЕдиницаИзмерения="тонн CO2-эквивалента">${formatNumber(data.totalEmissions)}</ОбщийОбъем>
    </ОбщиеВыбросы>

    <!-- Источники выбросов -->
    <ИсточникиВыбросов>
${data.sources.map((source) => buildSourceXML(source)).join('\n')}
    </ИсточникиВыбросов>
  </ВыбросыПарниковыхГазов>

  <!-- Подпись -->
  <Подпись>
    <Дата>${currentDate}</Дата>
    <Должность>${escapeXML(data.organization.directorPosition)}</Должность>
    <ФИО>${escapeXML(data.organization.directorName)}</ФИО>
  </Подпись>
</Отчет296ФЗ>`;
}

/**
 * Построение XML для источника выбросов
 */
function buildSourceXML(source: EmissionSource): string {
  return `      <Источник>
        <Идентификатор>${escapeXML(source.id)}</Идентификатор>
        <Наименование>${escapeXML(source.name)}</Наименование>
        <ВидТоплива>${escapeXML(source.fuelType)}</ВидТоплива>
        <ОбъемПотребления ЕдиницаИзмерения="${escapeXML(source.unit)}">${formatNumber(source.volume)}</ОбъемПотребления>
        <Выбросы>
          <CO2 ЕдиницаИзмерения="тонн">${formatNumber(source.co2Emissions)}</CO2>
          ${source.ch4Emissions !== undefined ? `<CH4 ЕдиницаИзмерения="тонн">${formatNumber(source.ch4Emissions)}</CH4>` : ''}
          ${source.n2oEmissions !== undefined ? `<N2O ЕдиницаИзмерения="тонн">${formatNumber(source.n2oEmissions)}</N2O>` : ''}
        </Выбросы>
      </Источник>`;
}

/**
 * Экранирование специальных символов XML
 */
function escapeXML(str: string): string {
  if (!str) return '';

  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Форматирование чисел для XML
 */
function formatNumber(num: number): string {
  // Используем точку как разделитель дробной части (стандарт XML)
  return num.toFixed(3).replace(/\.?0+$/, '');
}

/**
 * Валидация данных перед генерацией отчета
 */
export function validateReportData(data: ReportData): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Проверка организации
  if (!data.organization.inn || !/^\d{10,12}$/.test(data.organization.inn)) {
    errors.push('Некорректный ИНН организации');
  }

  if (!data.organization.ogrn || !/^\d{13,15}$/.test(data.organization.ogrn)) {
    errors.push('Некорректный ОГРН организации');
  }

  if (!data.organization.fullName || data.organization.fullName.length < 5) {
    errors.push('Не указано полное наименование организации');
  }

  if (!data.organization.legalAddress || data.organization.legalAddress.length < 10) {
    errors.push('Не указан юридический адрес организации');
  }

  if (!data.organization.directorName || data.organization.directorName.length < 5) {
    errors.push('Не указано ФИО руководителя');
  }

  if (!data.organization.directorPosition || data.organization.directorPosition.length < 3) {
    errors.push('Не указана должность руководителя');
  }

  // Проверка периода
  if (!data.period || !/^\d{4}$/.test(data.period)) {
    errors.push('Некорректный отчетный период (должен быть год в формате YYYY)');
  }

  // Проверка источников
  if (!data.sources || data.sources.length === 0) {
    errors.push('Не указаны источники выбросов');
  }

  // Проверка выбросов
  if (data.totalEmissions <= 0) {
    errors.push('Общий объем выбросов должен быть больше нуля');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
