/**
 * Template Engine для замены токенов [[snake_case]] в HTML шаблонах
 * Поддерживает 296-FZ и CBAM отчеты
 */

export interface TemplateData {
  [key: string]: string | number | boolean | undefined;
}

export interface DisplayStyleData {
  l3_display_style?: 'table-row' | 'none';
  no_goods_display_style?: 'block' | 'none';
}

/**
 * Основная функция замены токенов [[snake_case]]
 */
export function replaceTokens(template: string, data: TemplateData & DisplayStyleData): string {
  let result = template;

  // 1. Заменяем обычные токены [[token_name]]
  const tokenRegex = /\[\[([a-z_0-9]+)\]\]/g;

  result = result.replace(tokenRegex, (match, tokenName) => {
    const value = data[tokenName];
    return value !== undefined ? String(value) : '';
  });

  // 2. Специальная обработка стилей отображения для CBAM
  if (data.l3_display_style) {
    result = result.replace(
      '<tr id="line3-row" style="display: none;">',
      `<tr id="line3-row" style="display: ${data.l3_display_style};">`
    );
  }

  if (data.no_goods_display_style) {
    result = result.replace(
      '<div class="no-goods" id="no-cbam-goods" style="display: none;">',
      `<div class="no-goods" id="no-cbam-goods" style="display: ${data.no_goods_display_style};">`
    );
  }

  return result;
}

/**
 * Проверка незамененных токенов
 */
export function findUnreplacedTokens(processedTemplate: string): string[] {
  const unreplacedTokens = processedTemplate.match(/\[\[[a-z_0-9]+\]\]/g);
  return unreplacedTokens || [];
}

/**
 * Валидация обязательных токенов для 296-FZ отчета
 */
export function validate296FZTokens(data: TemplateData): string[] {
  const requiredTokens = [
    'org_name', 'org_inn', 'org_address', 'report_year',
    'signer_name', 'signer_position', 'sign_date'
  ];
  // Дополнительная структурная проверка токенов, требуемых нормами 296‑ФЗ
  const structuralTokens = [
    'executor_fio', 'executor_phone',
    'co2_mass', 'co2e_co2', 'co2_percent',
    'ch4_mass', 'co2e_ch4', 'ch4_percent',
    'n2o_mass', 'co2e_n2o', 'n2o_percent',
    'total_co2e'
  ];

  const errors: string[] = [];

  requiredTokens.forEach(token => {
    const value = String(data[token] || '').trim();
    if (!value || value === 'Не указано') {
      errors.push(`Отсутствует обязательный токен: ${token} (значение: "${value}")`);
    }
  });
  structuralTokens.forEach(token => {
    const value = String(data[token] ?? '').trim();
    if (!value || value === 'Не указано') {
      errors.push(`Отсутствует структурный токен 296-ФЗ: ${token}`);
    }
  });

  return errors;
}

/**
 * Проверка, что HTML шаблон содержит обязательные токены
 */
export function validateTemplateContainsTokens(template: string, required: string[]): string[] {
  const missing: string[] = [];
  for (const token of required) {
    const pattern = new RegExp(`\\[\\[${token}\\]\\]`);
    if (!pattern.test(template)) {
      missing.push(token);
    }
  }
  return missing;
}

/**
 * Валидация обязательных токенов для CBAM отчета
 */
export function validateCBAMTokens(data: TemplateData): string[] {
  const requiredTokens = [
    'eori', 'cbam_id', 'org_name', 'org_address', 'org_country',
    'org_email', 'report_year_q', 'signer_name', 'signer_pos', 'sign_date'
  ];

  const errors: string[] = [];

  requiredTokens.forEach(token => {
    if (!data[token] || String(data[token]).trim() === '') {
      errors.push(`Отсутствует обязательный токен: ${token}`);
    }
  });

  // Дополнительная валидация EORI
  const eori = String(data.eori || '');
  const eoriPattern = /^[A-Z]{2}[A-Z0-9]{1,15}$/;
  if (eori && !eoriPattern.test(eori)) {
    errors.push(`Некорректный формат EORI номера: ${eori}`);
  }

  // Валидация ISO кода страны
  const country = String(data.org_country || '');
  const isoPattern = /^[A-Z]{2}$/;
  if (country && !isoPattern.test(country)) {
    errors.push(`Некорректный ISO код страны: ${country}`);
  }

  return errors;
}

/**
 * Расчет итогов для CBAM отчета
 */
export function calculateCBAMTotals(goodsLines: Array<{
  qty: string | number;
  dir: string | number;
  el_mwh: string | number;
  el_ef: string | number;
}>): {
  totalQuantity: string;
  totalDirect: string;
  totalIndirect: string;
  totalAll: string;
} {
  let totalQuantity = 0;
  let totalDirect = 0;
  let totalIndirect = 0;

  goodsLines.forEach(line => {
    const qty = parseFloat(String(line.qty)) || 0;
    const dir = parseFloat(String(line.dir)) || 0;
    const elMwh = parseFloat(String(line.el_mwh)) || 0;
    const elEf = parseFloat(String(line.el_ef)) || 0;

    if (qty > 0) {
      totalQuantity += qty;
      totalDirect += qty * dir;
      totalIndirect += qty * elMwh * elEf;
    }
  });

  return {
    totalQuantity: totalQuantity.toFixed(1),
    totalDirect: totalDirect.toFixed(1),
    totalIndirect: totalIndirect.toFixed(1),
    totalAll: (totalDirect + totalIndirect).toFixed(1)
  };
}

/**
 * Контроль отображения строк в CBAM таблице
 */
export function controlCBAMDisplay(data: TemplateData): DisplayStyleData {
  // Контролируем отображение Line 3
  const l3_display_style = data.l3_cn && String(data.l3_cn).length > 0 ? 'table-row' : 'none';

  // Контролируем отображение блока "no goods"
  const hasGoods = (data.l1_cn && String(data.l1_cn).length > 0) ||
                   (data.l2_cn && String(data.l2_cn).length > 0) ||
                   (data.l3_cn && String(data.l3_cn).length > 0);
  const no_goods_display_style = hasGoods ? 'none' : 'block';

  return {
    l3_display_style,
    no_goods_display_style
  };
}

/**
 * Основная функция обработки шаблона
 */
export function processTemplate(
  template: string,
  data: TemplateData,
  reportType: '296-FZ' | 'CBAM' | 'CF'
): {
  processedHtml: string;
  errors: string[];
  unreplacedTokens: string[];
} {
  // Валидация данных: для CF (углеродный след) используем мягкий режим без блокировок
  let validationErrors: string[] = [];
  if (reportType === '296-FZ') {
    validationErrors = validate296FZTokens(data);
  } else if (reportType === 'CBAM') {
    validationErrors = validateCBAMTokens(data);
  } else {
    // CF — опциональная валидация: можно добавить позже при необходимости
    validationErrors = [];
  }

  if (validationErrors.length > 0) {
    return {
      processedHtml: '',
      errors: validationErrors,
      unreplacedTokens: []
    };
  }

  // Для CBAM добавляем контроль отображения
  let processData = { ...data };
  if (reportType === 'CBAM') {
    const displayStyles = controlCBAMDisplay(data);
    processData = { ...data, ...displayStyles };
  }

  // Обработка шаблона
  const processedHtml = replaceTokens(template, processData);

  // Проверка незамененных токенов
  const unreplacedTokens = findUnreplacedTokens(processedHtml);

  return {
    processedHtml,
    errors: [],
    unreplacedTokens
  };
}

/**
 * Экспорт типов для использования в других модулях
 */
export type ReportType = '296-FZ' | 'CBAM' | 'CF';
export type ProcessTemplateResult = ReturnType<typeof processTemplate>;