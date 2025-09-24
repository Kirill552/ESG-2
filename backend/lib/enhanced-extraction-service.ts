/**
 * Улучшенный сервис извлечения данных из российских документов
 * Покрывает все типы документов для полной отчетности по 296-ФЗ, CBAM, углеродному следу
 */

import { 
  RUSSIAN_DOCUMENT_PATTERNS, 
  RUSSIAN_EMISSION_FACTORS_2025, 
  UNIVERSAL_EXTRACTION_FIELDS,
  findDocumentPattern,
  getPriorityFields,
  FUEL_EXTRACTION_PATTERNS,
  ELECTRICITY_EXTRACTION_PATTERNS,
  GAS_HEAT_EXTRACTION_PATTERNS,
  TRANSPORT_EXTRACTION_PATTERNS,
  INDUSTRIAL_EXTRACTION_PATTERNS
} from './russian-document-patterns';

// Интеграция с интеллектуальной системой обработки файлов
import { processImageMultiLevel } from './multi-level-ocr-service';
import { processFileIntelligently, type ParsingResult } from './intelligent-file-processor';
import { findCanonical, getCategory, getSynonyms } from './synonym-dictionary';
import { metricsCollector, type ProcessingMetrics } from './extraction-metrics';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Сохраняет лог паттернов для отладки
 */
function savePatternsLog(filename: string, data: any) {
  try {
    const logsDir = path.join(process.cwd(), 'debug_output', 'patterns_logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    const logPath = path.join(logsDir, `${Date.now()}_${filename}.json`);
    fs.writeFileSync(logPath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`💾 Паттерны лог сохранен: ${logPath}`);
  } catch (error) {
    console.warn('⚠️ Не удалось сохранить паттерны лог:', error);
  }
}

export interface ExtractedDocumentData {
  documentId: string;
  documentType: string;
  confidence: number;
  extractedFields: {
    fullText?: string;
    fuel_data?: Array<{ type: string; volume: number; unit: string }>;
    electricity_data?: { consumption_kwh: number; region?: string; tariff_type?: string };
    thermal_data?: { consumption_gcal: number; energy_type?: string };
    transport_data?: { distance_km: number; transport_type?: string; vehicle_class?: string };
    fgas_data?: Array<{ type: string; amount_kg: number; gwp: number; co2_equivalent: number }>;
    industrial_processes?: Array<{ process: string; production_tons: number; emission_factor: number; co2_kg: number }>;
    [key: string]: any; // Дополнительные поля
  };
  emissions: {
    co2_kg: number;
    ch4_kg: number;
    n2o_kg: number;
    fgas_co2_equivalent?: number; // F-газы в CO2-эквиваленте
    industrial_process_co2?: number; // Промышленные процессы
    calculation_method: string;
    confidence: number;
  };
  metadata: {
    classification_confidence: number;
    fields_extracted: number;
    fields_expected: number;
    data_quality: 'high' | 'medium' | 'low';
  };
}

/**
 * Нормализует и парсит числовые значения из OCR текста
 * ИСПРАВЛЕНО: фильтрует ИНН, КПП и другие идентификаторы
 */
function parseNumericValue(value: any): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  
  let str = String(value);
  
  // ФИЛЬТР: игнорируем значения, которые похожи на ИНН, КПП, телефоны и другие идентификаторы
  if (str.length >= 10) {
    // ИНН (10-12 цифр), КПП (9 цифр), телефоны и т.д.
    if (/^\d{9,12}$/.test(str.replace(/\D/g, ''))) {
      return 0; // Игнорируем как идентификатор
    }
  }
  
  // Убираем все кроме цифр, точек, запятых и знаков
  str = str.replace(/[^\d.,\-+]/g, '');
  
  // Заменяем запятую на точку (русская локаль)
  str = str.replace(',', '.');
  
  const num = parseFloat(str);
  
  // ДОПОЛНИТЕЛЬНЫЙ ФИЛЬТР: реалистичные диапазоны для топлива
  if (isFinite(num)) {
    // Слишком большие значения (больше 100,000) скорее всего ошибка
    if (num > 100000) {
      return 0;
    }
    return num;
  }
  
  return 0;
}

/**
 * Извлекает единицы измерения из текста
 */
function extractUnit(text: string): string {
  const units = {
    // Основные единицы
    'литр': 'l',
    'л': 'l', 
    'л.': 'l',
    'кВт*ч': 'kwh',
    'кВт·ч': 'kwh',
    'квт*ч': 'kwh',
    'м³': 'm3',
    'м3': 'm3',
    'куб': 'm3',
    'гкал': 'gcal',
    'км': 'km',
    'километр': 'km',
    'тонн': 't',
    'кг': 'kg',
    'руб': 'rub',
    
    // РАСШИРЕННЫЕ ЭНЕРГЕТИЧЕСКИЕ ЕДИНИЦЫ
    'мдж': 'mj',          // мегаджоули
    'МДж': 'mj',
    'mj': 'mj',
    'ккал': 'kcal',        // килокалории
    'кКал': 'kcal',
    'kcal': 'kcal',
    'мкал': 'mcal',        // мегакалории
    'Мкал': 'mcal',
    'mcal': 'mcal',
    'гкал/ч': 'gcal_h',    // гигакалорий в час
    'тут': 'toe',          // тонны условного топлива
    'ТУТ': 'toe',
    'toe': 'toe',
    
    // ЭЛЕКТРОЭНЕРГИЯ РАСШИРЕННО
    'мВтч': 'mwh',        // мегаватт-час
    'МВтч': 'mwh',
    'МВт·ч': 'mwh',
    'mwh': 'mwh',
    'гВтч': 'gwh',        // гигаватт-час
    'ГВтч': 'gwh',
    'gwh': 'gwh',
    'кВАр': 'kvar',       // киловар
    'МВАр': 'mvar',       // мегавар
    
    // ГАЗ РАСШИРЕННЮЕ ЕДИНИЦЫ
    'нм³': 'nm3',         // нормальные кубометры
    'Нм³': 'nm3',
    'nm3': 'nm3',
    'м³/ч': 'm3_h',        // кубометров в час
    'м³/с': 'm3_s',        // кубометров в секунду
    'тыс. м³': 'tm3',     // тысяч кубометров
    'млн м³': 'mm3',     // миллион кубометров
    
    // МАССА РАСШИРЕННО
    'г': 'g',              // граммы
    'мг': 'mg',            // миллиграммы
    'т': 't',              // тонны
    'кт': 'kt',            // килотонны
    'Мт': 'mt',            // мегатонны
    'ц': 'c',              // центнеры
    'пуд': 'pud',          // пуд (старая русская единица)
    
    // КОНЦЕНТРАЦИЯ И ПЛОТНОСТЬ
    'мг/м³': 'mg_m3',      // миллиграмм на кубометр
    'г/м³': 'g_m3',        // грамм на кубометр
    'кг/м³': 'kg_m3',      // килограмм на кубометр
    'ppm': 'ppm',           // миллионные доли
    'ppb': 'ppb',           // миллиардные доли
    '%': 'percent',         // проценты
    'об.проц': 'vol_percent', // объемные проценты
    
    // ДАВЛЕНИЕ И ТЕМПЕРАТУРА
    'па': 'pa',            // паскали
    'Мпа': 'mpa',          // мегапаскали
    'бар': 'bar',          // бары
    'атм': 'atm',          // атмосферы
    '°с': 'celsius',      // градусы Цельсия
    '℃': 'celsius',
    'k': 'kelvin',          // Кельвин
    
    // ПЛОЩАДЬ И ОБЪЕМ
    'м²': 'm2',            // квадратные метры
    'км²': 'km2',          // квадратные километры
    'га': 'ha',            // гектары
    'сотка': 'are',       // сотки (ары)
    'дм³': 'dm3',         // дециметры кубические
    'мл': 'ml',            // миллилитры
    
    // СКОРОСТЬ И ПОТОК
    'м/с': 'm_s',          // метров в секунду
    'км/ч': 'km_h',        // километров в час
    'узлов': 'knots',       // морские узлы
    'об/мин': 'rpm',       // обороты в минуту
    'м³/сут': 'm3_day',     // кубометров в сутки
    
    // ЭМИССИИ И ВЫБРОСЫ 
    'т co2': 't_co2',       // тонн CO2
    'тco2': 't_co2',
    'кг co2': 'kg_co2',     // килограмм CO2
    'г co2': 'g_co2',       // грамм CO2
    'т co2э': 't_co2e',     // тонн CO2-эквивалента
    'тco2э': 't_co2e'
  };
  
  const textLower = text.toLowerCase();
  for (const [unit, code] of Object.entries(units)) {
    if (textLower.includes(unit)) return code;
  }
  return '';
}

/**
 * НОВАЯ ФУНКЦИЯ: Извлечение F-газов и промышленных процессов (критично для 296-ФЗ)
 */
function extractIndustrialProcessData(fields: Record<string, any>): {
  fgases: Array<{ type: string; amount_kg: number; gwp: number; co2_equivalent: number }>;
  industrial_processes: Array<{ process: string; production_tons: number; emission_factor: number; co2_kg: number }>;
} {
  const fgases = [];
  const industrial_processes = [];
  
  // F-ГАЗЫ (хладагенты, SF6 и др.)
  const fgasPatterns = {
    // Хладагенты
    'r-404a': { gwp: 3922, pattern: /(r[\-\s]?404a|r404a|хладагент.*404)/gi },
    'r-134a': { gwp: 1430, pattern: /(r[\-\s]?134a|r134a|хладагент.*134)/gi },
    'r-410a': { gwp: 2088, pattern: /(r[\-\s]?410a|r410a|хладагент.*410)/gi },
    'r-407c': { gwp: 1774, pattern: /(r[\-\s]?407c|r407c|хладагент.*407)/gi },
    'r-22': { gwp: 1810, pattern: /(r[\-\s]?22|r22|хладагент.*22)/gi },
    'r-507a': { gwp: 3985, pattern: /(r[\-\s]?507a|r507a|хладагент.*507)/gi },
    'r-32': { gwp: 675, pattern: /(r[\-\s]?32|r32|хладагент.*32)/gi },
    
    // SF6 и другие промышленные газы
    'sf6': { gwp: 22800, pattern: /(sf6|элегаз|гексафторид.*серы)/gi },
    'nf3': { gwp: 17200, pattern: /(nf3|трифторид.*азота)/gi },
    'cf4': { gwp: 7390, pattern: /(cf4|тетрафторметан)/gi },
    'c2f6': { gwp: 12200, pattern: /(c2f6|гексафторэтан)/gi }
  };
  
  for (const [key, value] of Object.entries(fields)) {
    const keyText = `${key} ${value}`.toLowerCase();
    
    // Поиск F-газов
    for (const [gasType, gasInfo] of Object.entries(fgasPatterns)) {
      if (gasInfo.pattern.test(keyText)) {
        const amount = parseNumericValue(value);
        if (amount > 0) {
          const co2_equivalent = amount * gasInfo.gwp;
          fgases.push({
            type: gasType.toUpperCase(),
            amount_kg: amount,
            gwp: gasInfo.gwp,
            co2_equivalent
          });
        }
      }
    }
  }
  
  // ПРОМЫШЛЕННЫЕ ПРОЦЕССЫ - используем новые расширенные паттерны из russian-document-patterns.ts
  for (const patternGroup of INDUSTRIAL_EXTRACTION_PATTERNS) {
    for (const regex of patternGroup.patterns) {
      for (const [key, value] of Object.entries(fields)) {
        const fieldText = `${key} ${value}`.toLowerCase();
        const match = regex.exec(fieldText);
        
        if (match) {
          const production = parseNumericValue(match[1]);
          if (production > 0) {
            // Определяем коэффициент выбросов на основе подкатегории
            let emissionFactor = 1000; // Коэффициент по умолчанию
            let processType = patternGroup.subcategory;
            
            if (patternGroup.subcategory.includes('steel')) {
              emissionFactor = 1850;
              processType = 'Производство стали';
            } else if (patternGroup.subcategory.includes('cement')) {
              emissionFactor = 870;
              processType = 'Производство цемента';
            } else if (patternGroup.subcategory.includes('aluminum')) {
              emissionFactor = 11500;
              processType = 'Производство алюминия';
            } else if (patternGroup.subcategory.includes('chemical')) {
              emissionFactor = 1900;
              processType = 'Химическое производство';
            }
            
            const co2_kg = production * emissionFactor;
            industrial_processes.push({
              process: processType,
              production_tons: production,
              emission_factor: emissionFactor,
              co2_kg
            });
          }
        }
      }
    }
  }
  
  return { fgases, industrial_processes };
}

/**
 * Продвинутое извлечение топливных данных
 */
function extractFuelData(fields: Record<string, any>): Array<{
  type: string;
  volume: number;
  unit: string;
  confidence: number;
}> {
  const fuels = [];
  
  // Российские виды топлива (РАСШИРЕННЫЕ)
  const fuelMappings = {
    // Бензины
    'аи-80': 'АИ-80',
    'аи-92': 'АИ-92', 
    'аи-95': 'АИ-95',
    'аи-98': 'АИ-98',
    'аи-100': 'АИ-100',
    'бензин': 'АИ-92', // по умолчанию
    'gasoline': 'АИ-95',
    'газолин': 'АИ-95',
    'моторное топливо': 'АИ-92',
    
    // Дизельное топливо
    'дт': 'ДТ летнее',
    'дизель': 'ДТ летнее',
    'diesel': 'ДТ летнее',
    'дизтопливо': 'ДТ летнее',
    'дт летнее': 'ДТ летнее',
    'дт зимнее': 'ДТ зимнее',
    'дт арктическое': 'ДТ арктическое',
    
    // Газообразные топлива
    'газ': 'Природный газ РФ',
    'природный газ': 'Природный газ РФ',
    'метан': 'Природный газ РФ',
    'cng': 'Природный газ РФ',
    'пропан': 'Сжиженный газ',
    'бутан': 'Сжиженный газ',
    'lpg': 'Сжиженный газ',
    'спбт': 'Сжиженный газ',
    'сжиженный газ': 'Сжиженный газ',
    'биометан': 'Биометан',
    'биогаз': 'Биометан',
    
    // Авиационное топливо
    'керосин': 'Керосин авиационный',
    'авиакеросин': 'Керосин авиационный',
    'jet fuel': 'Керосин авиационный',
    'jet a-1': 'Керосин авиационный',
    'рт': 'Керосин авиационный', // реактивное топливо
    'тс-1': 'Керосин авиационный',
    
    // Мазут и морское топливо
    'мазут': 'Мазут топочный М100',
    'м100': 'Мазут топочный М100',
    'fuel oil': 'Мазут топочный М100',
    'газойль': 'Газойль',
    'морское топливо': 'Мазут флотский Ф5',
    
    // Твердые топлива
    'уголь': 'Каменный уголь',
    'каменный уголь': 'Каменный уголь',
    'бурый уголь': 'Бурый уголь',
    'антрацит': 'Антрацит',
    'кокс': 'Кокс',
    'торф': 'Торф',
    'дрова': 'Щепа древесная',
    'щепа': 'Щепа древесная',
    'пеллеты': 'Пеллеты древесные',
    'брикеты': 'Топливные брикеты',
    
    // Альтернативные виды топлива
    'водород': 'Водород',
    'hydrogen': 'Водород',
    'биодизель': 'Биодизель',
    'биоэтанол': 'Биоэтанол',
    'biodiesel': 'Биодизель',
    'bioethanol': 'Биоэтанол',
    'e85': 'Биоэтанол'
  };
  
  for (const [key, value] of Object.entries(fields)) {
    const keyText = `${key} ${value}`.toLowerCase();
    let fuelType = '';
    let confidence = 0;
    
    // Определяем тип топлива
    for (const [pattern, fuel] of Object.entries(fuelMappings)) {
      if (keyText.includes(pattern)) {
        fuelType = fuel;
        confidence = pattern.length > 2 ? 0.9 : 0.7;
        break;
      }
    }
    
    // РАСШИРЕННАЯ ЛОГИКА: если поле содержит ключевые слова топлива
    if (!fuelType && (key.includes('fuel') || key.includes('топлив') || key.includes('бензин'))) {
      fuelType = 'АИ-95'; // по умолчанию
      confidence = 0.6;
    }
    
    if (fuelType) {
      const volume = parseNumericValue(value);
      const unit = extractUnit(keyText) || 'l';
      
      if (volume > 0) {
        fuels.push({ type: fuelType, volume, unit, confidence });
      }
    }
  }
  
  // FALLBACK: если ничего не найдено, но есть поле с объемом
  if (fuels.length === 0) {
    for (const [key, value] of Object.entries(fields)) {
      if (key.includes('volume') || key.includes('объем')) {
        const volume = parseNumericValue(value);
        if (volume > 0 && volume < 10000) {
          fuels.push({
            type: 'АИ-95', // по умолчанию
            volume,
            unit: 'l',
            confidence: 0.4
          });
          break;
        }
      }
    }
  }
  
  return fuels;
}

/**
 * Извлечение данных по электроэнергии с учетом региона (РАСШИРЕННОЕ)
 */
function extractElectricityData(fields: Record<string, any>): {
  consumption_kwh: number;
  consumption_mwh: number;
  region: string;
  tariff_type: string;
  peak_consumption?: number;
  off_peak_consumption?: number;
} {
  let consumption = 0;
  let consumption_mwh = 0;
  let region = 'средняя РФ';
  let tariff_type = 'standard';
  let peak_consumption = 0;
  let off_peak_consumption = 0;
  
  // Поиск потребления электроэнергии (РАСШИРЕННОЕ)
  for (const [key, value] of Object.entries(fields)) {
    const keyLower = key.toLowerCase();
    const keyText = `${key} ${value}`.toLowerCase();
    
    // Основное потребление в кВт·ч
    if (keyLower.includes('квт') || keyLower.includes('электр') || keyLower.includes('kwh')) {
      const val = parseNumericValue(value);
      if (keyText.includes('мвт') || keyText.includes('mwh')) {
        consumption_mwh += val;
        consumption += val * 1000; // МВт·ч в кВт·ч
      } else if (keyText.includes('гвт') || keyText.includes('gwh')) {
        consumption += val * 1000000; // ГВт·ч в кВт·ч
      } else {
        consumption += val;
      }
    }
    
    // Пиковое и полупиковое потребление
    if (keyLower.includes('пик') || keyLower.includes('peak')) {
      peak_consumption += parseNumericValue(value);
    }
    if (keyLower.includes('полупик') || keyLower.includes('off-peak') || keyLower.includes('night')) {
      off_peak_consumption += parseNumericValue(value);
    }
    
    // Тариф
    if (keyLower.includes('тариф')) {
      if (keyText.includes('двухзон') || keyText.includes('пик')) tariff_type = 'two_zone';
      else if (keyText.includes('однозон')) tariff_type = 'single_zone';
      else if (keyText.includes('трехзон')) tariff_type = 'three_zone';
    }
    
    // Определение региона
    const valueStr = String(value).toLowerCase();
    if (valueStr.includes('москва') || valueStr.includes('подмосков')) region = 'ЦФО';
    else if (valueStr.includes('спб') || valueStr.includes('ленинград')) region = 'СЗФО';
    else if (valueStr.includes('екатеринбург') || valueStr.includes('челябинск')) region = 'УФО';
    else if (valueStr.includes('новосибирск') || valueStr.includes('красноярск')) region = 'СФО';
    else if (valueStr.includes('владивосток') || valueStr.includes('хабаровск')) region = 'ДФО';
  }
  
  return { 
    consumption_kwh: consumption, 
    consumption_mwh: consumption_mwh,
    region, 
    tariff_type, 
    peak_consumption: peak_consumption > 0 ? peak_consumption : undefined,
    off_peak_consumption: off_peak_consumption > 0 ? off_peak_consumption : undefined
  };
}

/**
 * Извлечение транспортных данных
 */
function extractTransportData(fields: Record<string, any>): {
  distance_km: number;
  transport_type: string;
  vehicle_class: string;
  cargo_weight: number;
} {
  let distance = 0;
  let transport_type = 'unknown';
  let vehicle_class = 'unknown';
  let cargo_weight = 0;
  
  for (const [key, value] of Object.entries(fields)) {
    const keyText = `${key} ${value}`.toLowerCase();
    
    // Расстояние
    if (keyText.includes('км') || keyText.includes('расстояние')) {
      distance += parseNumericValue(value);
    }
    
    // Тип транспорта
    if (keyText.includes('самолет') || keyText.includes('авиа')) transport_type = 'aviation';
    else if (keyText.includes('поезд') || keyText.includes('жд')) transport_type = 'railway';
    else if (keyText.includes('автомобиль') || keyText.includes('грузов')) transport_type = 'road';
    else if (keyText.includes('корабль') || keyText.includes('морск')) transport_type = 'marine';
    
    // Класс автомобиля
    if (keyText.includes('евро-2')) vehicle_class = 'Евро-2';
    else if (keyText.includes('евро-3')) vehicle_class = 'Евро-3';
    else if (keyText.includes('евро-4')) vehicle_class = 'Евро-4';
    else if (keyText.includes('евро-5')) vehicle_class = 'Евро-5';
    else if (keyText.includes('евро-6')) vehicle_class = 'Евро-6';
    
    // Вес груза
    if (keyText.includes('вес') || keyText.includes('тонн')) {
      cargo_weight += parseNumericValue(value);
    }
  }
  
  return { distance_km: distance, transport_type, vehicle_class, cargo_weight };
}

/**
 * Рассчитывает выбросы по российским коэффициентам
 */
function calculateRussianEmissions(
  fuelData: Array<{ type: string; volume: number; unit: string }>,
  electricityData: { consumption_kwh: number; region: string },
  thermalData?: { consumption_gcal: number; energy_type: string },
  transportData?: { distance_km: number; transport_type: string; vehicle_class: string }
): { co2_kg: number; ch4_kg: number; n2o_kg: number; details: string[] } {
  
  let co2_total = 0;
  let ch4_total = 0; 
  let n2o_total = 0;
  const details = [];
  
  // Расчет по топливу
  console.log(`🔥 Расчет выбросов для ${fuelData.length} видов топлива`);
  for (const fuel of fuelData) {
    console.log(`🔍 Обрабатываем топливо: ${fuel.type} (${fuel.volume} ${fuel.unit})`);
    const mappedFuelType = mapFuelTypeToEmissionFactor(fuel.type, fuel.unit);
    console.log(`🗂️  Mapped type: ${mappedFuelType}`);
    const factor = mappedFuelType ? RUSSIAN_EMISSION_FACTORS_2025[mappedFuelType as keyof typeof RUSSIAN_EMISSION_FACTORS_2025] : null;
    console.log(`⚗️  Коэффициент эмиссии: ${factor}`);
    
    if (factor && fuel.volume > 0) {
      const co2 = fuel.volume * factor;
      co2_total += co2;
      console.log(`💨 Рассчитан CO2: ${fuel.volume} × ${factor} = ${co2.toFixed(2)} кг`);
      
      // Приблизительный расчет CH4 и N2O для топлива
      ch4_total += co2 * 0.0002; // ~0.02%
      n2o_total += co2 * 0.00005; // ~0.005%
      
      details.push(`${fuel.type} (${mappedFuelType}): ${fuel.volume} ${fuel.unit} → ${co2.toFixed(2)} кг CO2`);
    } else {
      console.log(`❌ Пропускаем: factor=${factor}, volume=${fuel.volume}`);
      details.push(`${fuel.type}: не найден коэффициент (mapped: ${mappedFuelType})`);
    }
  }
  
  console.log(`🎯 Итого CO2 от топлива: ${co2_total.toFixed(2)} кг`);
  
  // Расчет по электроэнергии
  if (electricityData.consumption_kwh > 0) {
    const factorKey = `Электроэнергия ${electricityData.region}` as keyof typeof RUSSIAN_EMISSION_FACTORS_2025;
    const factor = RUSSIAN_EMISSION_FACTORS_2025[factorKey] || RUSSIAN_EMISSION_FACTORS_2025['Электроэнергия средняя РФ'];
    const co2 = electricityData.consumption_kwh * factor;
    co2_total += co2;
    
    details.push(`Электроэнергия (${electricityData.region}): ${electricityData.consumption_kwh} кВт·ч → ${co2.toFixed(2)} кг CO2`);
  }

  // Расчет по тепловой энергии
  if (thermalData && thermalData.consumption_gcal > 0) {
    // Коэффициент для тепловой энергии: 0.184 кг CO2/кВт·ч для средней тепловой энергии РФ
    // 1 Гкал = 1163 кВт·ч
    const thermalFactor = 0.184; // кг CO2/кВт·ч для теплосетей РФ
    const kwh_equivalent = thermalData.consumption_gcal * 1163; // Переводим Гкал в кВт·ч
    const co2 = kwh_equivalent * thermalFactor;
    co2_total += co2;
    
    // Примерные коэффициенты для CH4 и N2O от тепловой энергии
    ch4_total += co2 * 0.0001; // ~0.01%
    n2o_total += co2 * 0.00003; // ~0.003%
    
    details.push(`Тепловая энергия (${thermalData.energy_type}): ${thermalData.consumption_gcal} Гкал → ${co2.toFixed(2)} кг CO2`);
  }
  
  // Расчет по транспорту
  if (transportData && transportData.distance_km > 0 && transportData.transport_type !== 'unknown') {
    let factor = 0;
    
    if (transportData.transport_type === 'aviation') {
      factor = RUSSIAN_EMISSION_FACTORS_2025['Внутренние рейсы'];
    } else if (transportData.transport_type === 'railway') {
      factor = RUSSIAN_EMISSION_FACTORS_2025['ЖД грузовые'];
    } else if (transportData.transport_type === 'road' && transportData.vehicle_class !== 'unknown') {
      const vehicleKey = `Легковой ${transportData.vehicle_class}` as keyof typeof RUSSIAN_EMISSION_FACTORS_2025;
      factor = RUSSIAN_EMISSION_FACTORS_2025[vehicleKey] || 0.15;
    }
    
    if (factor > 0) {
      const co2 = transportData.distance_km * factor;
      co2_total += co2;
      details.push(`Транспорт (${transportData.transport_type}): ${transportData.distance_km} км → ${co2.toFixed(2)} кг CO2`);
    }
  }
  
  return { co2_kg: co2_total, ch4_kg: ch4_total, n2o_kg: n2o_total, details };
}

/**
 * НОВАЯ ФУНКЦИЯ: Специальная обработка CSV данных
 */
function parseCSVFuelData(fullText: string): {
  fuelData: Array<{ type: string; volume: number; unit: string }>;
  electricityData: { consumption_kwh: number };
  transportData: { distance_km: number };
} {
  const result = {
    fuelData: [] as Array<{ type: string; volume: number; unit: string }>,
    electricityData: { consumption_kwh: 0 },
    transportData: { distance_km: 0 }
  };
  
  savePatternsLog('csv_parsing_attempt', {
    fullText: fullText.substring(0, 500),
    timestamp: new Date().toISOString()
  });
  
  // Разбиваем на строки
  const lines = fullText.split(/[\r\n]+/).filter(line => line.trim());
  
  for (const line of lines) {
    // Разбиваем по точке с запятой (русский CSV)
    const fields = line.split(';');
    
    // Обрабатываем акт газа
    if (line.includes('Акт газа') || line.includes('газ')) {
      for (let i = 0; i < fields.length; i++) {
        const field = fields[i];
        
        // Проверяем числовые значения для газа
        const cleanField = field.replace(/[^0-9.,]/g, '');
        const number = parseFloat(cleanField.replace(',', '.'));
        
        if (!isNaN(number) && number > 100 && number < 100000) { // Реалистичный диапазон для газа
          console.log(`💨 CSV: Найден объем газа: ${number} м³`);
          result.fuelData.push({
            type: 'Природный газ РФ',
            volume: number,
            unit: 'м3'
          });
          break;
        }
      }
    }
    
    // Обрабатываем путевой лист (топливо)
    if (line.includes('Путевой лист') || line.includes('ДТ') || line.includes('бензин')) {
      for (let i = 0; i < fields.length; i++) {
        const field = fields[i];
        const cleanField = field.replace(/[^0-9.,]/g, '');
        const number = parseFloat(cleanField.replace(',', '.'));
        
        if (!isNaN(number) && number > 10 && number < 10000) { // Диапазон для топлива
          console.log(`⛽ CSV: Найден расход топлива: ${number} литров`);
          
          // Определяем тип топлива
          let fuelType = 'ДТ летнее'; // по умолчанию дизель
          if (line.includes('бензин') || line.includes('АИ')) {
            fuelType = 'АИ-95';
          }
          
          result.fuelData.push({
            type: fuelType,
            volume: number,
            unit: 'л'
          });
          break;
        }
      }
    }
    
    // Обрабатываем электроэнергию
    if (line.includes('электроэнергия') || line.includes('кВт') || line.includes('квт')) {
      for (let i = 0; i < fields.length; i++) {
        const field = fields[i];
        const cleanField = field.replace(/[^0-9.,]/g, '');
        const number = parseFloat(cleanField.replace(',', '.'));
        
        if (!isNaN(number) && number > 100) { // кВт·ч
          console.log(`⚡ CSV: Найдено потребление электроэнергии: ${number} кВт·ч`);
          result.electricityData.consumption_kwh = number;
          break;
        }
      }
    }
  }
  
  savePatternsLog('csv_parsing_result', {
    result,
    extractedCount: result.fuelData.length,
    timestamp: new Date().toISOString()
  });
  
  return result;
}

/**
 * НОВАЯ ФУНКЦИЯ: Извлечение данных напрямую из полей OCR
 */
function extractDataFromFields(fields: Record<string, any>): {
  fuelData: Array<{ type: string; volume: number; unit: string }>;
  electricityData: { consumption_kwh: number };
  transportData: { distance_km: number };
} {
  const result = {
    fuelData: [] as Array<{ type: string; volume: number; unit: string }>,
    electricityData: { consumption_kwh: 0 },
    transportData: { distance_km: 0 }
  };

  for (const [key, value] of Object.entries(fields)) {
    const keyLower = key.toLowerCase();
    const valueNum = parseNumericValue(value);
    
    if (valueNum <= 0) continue;

    // Электроэнергия
    if (keyLower.includes('consumption_kwh') || 
        keyLower.includes('потребление') && keyLower.includes('квт')) {
      result.electricityData.consumption_kwh = valueNum;
    }
    
    // Газ
    if (keyLower.includes('volume_m3') || 
        keyLower.includes('газ') || 
        (keyLower.includes('consumption') && keyLower.includes('м3'))) {
      result.fuelData.push({
        type: 'Природный газ РФ',
        volume: valueNum,
        unit: 'м³'
      });
    }
    
    // Дизель
    if (keyLower.includes('fuel_volume') && keyLower.includes('дизель') ||
        keyLower.includes('дт') ||
        keyLower.includes('diesel')) {
      result.fuelData.push({
        type: 'ДТ летнее',
        volume: valueNum,
        unit: 'л'
      });
    }
    
    // Бензин
    if (keyLower.includes('бензин') || keyLower.includes('gasoline')) {
      result.fuelData.push({
        type: 'АИ-95',
        volume: valueNum,
        unit: 'л'
      });
    }
    
    // Уголь
    if (keyLower.includes('coal') || keyLower.includes('уголь')) {
      result.fuelData.push({
        type: 'Каменный уголь',
        volume: valueNum,
        unit: 'т'
      });
    }
    
    // Тепловая энергия
    if (keyLower.includes('heat') || keyLower.includes('тепло') || keyLower.includes('гкал')) {
      result.fuelData.push({
        type: 'Теплоэнергия газовая', // Используем ключ из RUSSIAN_EMISSION_FACTORS_2025
        volume: valueNum,
        unit: 'Гкал'
      });
    }
    
    // Расстояние
    if (keyLower.includes('distance') || keyLower.includes('км')) {
      result.transportData.distance_km = valueNum;
    }
  }

  return result;
}

/**
 * Основная функция извлечения данных из документа
 * Поддерживает многоуровневую OCR систему: Yandex Vision → Tesseract fallback
 */
export async function extractDocumentDataEnhanced(
  documentId: string,
  ocrData: any,
  filePath?: string
): Promise<ExtractedDocumentData> {
  // НОВАЯ ИНТЕГРАЦИЯ: Интеллектуальная система обработки файлов
  if (filePath && fs.existsSync(filePath)) {
    try {
      console.log('🚀 Используем интеллектуальную систему обработки файлов');
      return await extractWithIntelligentProcessor(documentId, filePath);
    } catch (processingError) {
      console.warn('⚠️ Интеллектуальная система: fallback к старому методу:', processingError instanceof Error ? processingError.message : String(processingError));
      // Продолжаем со старым методом как fallback
    }
  }
  
  // LEGACY: Многоуровневая OCR система для совместимости
  const useMultiLevelOCR = process.env.PRIMARY_OCR_METHOD === 'yandex' || process.env.ENABLE_OCR_FALLBACK !== 'false';
  
  if (useMultiLevelOCR && filePath) {
    try {
      return await extractWithMultiLevelOCR(documentId, filePath);
    } catch (ocrError) {
      console.warn('⚠️ Multi-level OCR fallback to pattern extraction:', ocrError instanceof Error ? ocrError.message : String(ocrError));
      // Продолжаем с извлечением по паттернам как fallback
    }
  }
  
  // ИСПРАВЛЕНО: поддержка обоих форматов - fullText и fields
  const fullText = ocrData?.fullText || '';
  const fields = ocrData?.fields || {};
  
  // Создаем объединенный текст для анализа
  let allText = fullText.toLowerCase();
  if (!allText && fields) {
    // Fallback: создаем текст из полей если fullText отсутствует
    allText = Object.entries(fields)
      .map(([key, value]) => `${key} ${value}`)
      .join(' ')
      .toLowerCase();
  }
  
  // Классификация документа
  const pattern = findDocumentPattern(allText);
  const documentType = pattern?.type || 'unknown';
  const classificationConfidence = pattern ? 0.8 : 0.3;
  
  // ИСПРАВЛЕНО: Извлечение данных из текста И полей
  let fuelData = extractFuelDataFromText(allText);
  let electricityData = extractElectricityDataFromText(allText);
  let thermalData = extractThermalEnergyDataFromText(allText);
  let transportData = extractTransportDataFromText(allText);
  
  // НОВОЕ: Специальная обработка CSV данных
  if (fullText && (fullText.includes(';') || fullText.includes('csv'))) {
    console.log('🗂️  Обнаружен CSV формат, применяем специальный парсер...');
    const csvData = parseCSVFuelData(fullText);
    
    // Заменяем данные из текста на данные из CSV если CSV дал результаты
    if (csvData.fuelData.length > 0) {
      console.log(`🔥 CSV парсер извлек ${csvData.fuelData.length} топливных записей, заменяем данные из текста`);
      fuelData = csvData.fuelData;
    }
    if (csvData.electricityData.consumption_kwh > 0) {
      electricityData.consumption_kwh = csvData.electricityData.consumption_kwh;
    }
    if (csvData.transportData.distance_km > 0) {
      transportData.distance_km = csvData.transportData.distance_km;
    }
  }
  
  // НОВОЕ: Дополнительное извлечение напрямую из fields (БЕЗ дублирования)  
  let industrialProcessData: {
    fgases: Array<{ type: string; amount_kg: number; gwp: number; co2_equivalent: number }>;
    industrial_processes: Array<{ process: string; production_tons: number; emission_factor: number; co2_kg: number }>;
  } = { fgases: [], industrial_processes: [] };
  if (fields && Object.keys(fields).length > 0) {
    const fieldsExtraction = extractDataFromFields(fields);
    // Извлекаем промышленные процессы и F-газы
    industrialProcessData = extractIndustrialProcessData(fields);
    
    // Объединяем результаты, ЗАМЕНЯЕМ данные из текста если fields содержат больше
    if (fieldsExtraction.fuelData.length > 0) {
      // Если из полей получили больше данных, используем их вместо данных из текста
      if (fieldsExtraction.fuelData.length >= fuelData.length) {
        fuelData = fieldsExtraction.fuelData;
      }
    }
    if (fieldsExtraction.electricityData.consumption_kwh > 0) {
      electricityData.consumption_kwh = fieldsExtraction.electricityData.consumption_kwh;
    }
    if (fieldsExtraction.transportData.distance_km > 0) {
      transportData.distance_km = fieldsExtraction.transportData.distance_km;
    }
  }
  
  // Расчет выбросов (включая F-газы и промышленные процессы)
  const emissions = calculateRussianEmissions(fuelData, electricityData, thermalData, transportData);
  
  // Добавляем выбросы от F-газов (CO2-эквивалент)
  let fgasEmissions = 0;
  for (const fgas of industrialProcessData.fgases) {
    fgasEmissions += fgas.co2_equivalent;
  }
  
  // Добавляем выбросы от промышленных процессов
  let industrialEmissions = 0;
  for (const process of industrialProcessData.industrial_processes) {
    industrialEmissions += process.co2_kg;
  }
  
  // Общие выбросы CO2
  const totalCO2 = emissions.co2_kg + fgasEmissions + industrialEmissions;
  
  // ИСПРАВЛЕНО: Оценка качества данных на основе извлеченных данных
  const expectedFields = pattern?.required_fields.length || 5;
  const extractedDataCount = (fuelData.length > 0 ? 2 : 0) + 
                            (electricityData.consumption_kwh > 0 ? 2 : 0) +
                            (thermalData && thermalData.consumption_gcal > 0 ? 2 : 0) +
                            (transportData.distance_km > 0 ? 1 : 0);
  const dataQuality = extractedDataCount >= expectedFields ? 'high' : 
                     extractedDataCount >= expectedFields * 0.6 ? 'medium' : 'low';
  
  const emissionConfidence = emissions.co2_kg > 0 ? 0.8 : 0.3;
  
  return {
    documentId,
    documentType,
    confidence: classificationConfidence,
    extractedFields: {
      fullText: fullText.substring(0, 1000), // Первые 1000 символов для проверки
      fuel_data: fuelData,
      electricity_data: electricityData,
      thermal_data: thermalData,
      transport_data: transportData,
      fgas_data: industrialProcessData.fgases, // F-газы (хладагенты, SF6)
      industrial_processes: industrialProcessData.industrial_processes // Промышленные процессы
    },
    emissions: {
      co2_kg: totalCO2, // Включает все источники выбросов
      ch4_kg: emissions.ch4_kg, 
      n2o_kg: emissions.n2o_kg,
      fgas_co2_equivalent: fgasEmissions, // Отдельно F-газы в CO2-эквиваленте
      industrial_process_co2: industrialEmissions, // Отдельно промышленные процессы
      calculation_method: 'russian_factors_2025_extended',
      confidence: emissionConfidence
    },
    metadata: {
      classification_confidence: classificationConfidence,
      fields_extracted: extractedDataCount,
      fields_expected: expectedFields,
      data_quality: dataQuality
    }
  };
}

/**
 * Массовое извлечение данных из множества документов
 */
export async function extractMultipleDocumentsEnhanced(
  documents: Array<{ id: string; ocrData?: any; filePath?: string }>
): Promise<{
  documents: ExtractedDocumentData[];
  summary: {
    total_documents: number;
    high_quality_documents: number;
    total_co2_kg: number;
    total_ch4_kg: number;
    total_n2o_kg: number;
    document_types: Record<string, number>;
    data_quality_distribution: Record<string, number>;
  };
}> {
  console.log(`🚀 Начало массового извлечения данных из ${documents.length} документов`);
  
  // Логируем входные данные
  savePatternsLog('input_documents', {
    total: documents.length,
    documentIds: documents.map(d => d.id),
    documentsWithOcr: documents.filter(d => d.ocrData).length,
    timestamp: new Date().toISOString()
  });
  
  const results: ExtractedDocumentData[] = [];
  const documentTypes: Record<string, number> = {};
  const qualityDistribution: Record<string, number> = { high: 0, medium: 0, low: 0 };
  let totalCO2 = 0;
  let totalCH4 = 0;
  let totalN2O = 0;
  
  for (const doc of documents) {
    try {
      console.log(`📄 Обрабатываем документ: ${doc.id}`);
      const extracted = await extractDocumentDataEnhanced(doc.id, doc.ocrData, doc.filePath);
      results.push(extracted);
      
      // Логируем результат обработки каждого документа
      savePatternsLog(`document_${doc.id}_result`, {
        documentId: doc.id,
        documentType: extracted.documentType,
        confidence: extracted.confidence,
        emissions: extracted.emissions,
        extractedFields: extracted.extractedFields,
        metadata: extracted.metadata,
        timestamp: new Date().toISOString()
      });
      
      // Статистика
      documentTypes[extracted.documentType] = (documentTypes[extracted.documentType] || 0) + 1;
      qualityDistribution[extracted.metadata.data_quality]++;
      totalCO2 += extracted.emissions.co2_kg;
      totalCH4 += extracted.emissions.ch4_kg;
      totalN2O += extracted.emissions.n2o_kg;
      
      console.log(`✅ Документ ${doc.id} обработан: CO2=${extracted.emissions.co2_kg}кг, тип=${extracted.documentType}`);
      
    } catch (error) {
      console.warn(`Failed to extract data from document ${doc.id}:`, error);
      
      // Логируем ошибку
      savePatternsLog(`document_${doc.id}_error`, {
        documentId: doc.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      });
      
      results.push({
        documentId: doc.id,
        documentType: 'error',
        confidence: 0,
        extractedFields: {},
        emissions: { co2_kg: 0, ch4_kg: 0, n2o_kg: 0, calculation_method: 'error', confidence: 0 },
        metadata: { classification_confidence: 0, fields_extracted: 0, fields_expected: 0, data_quality: 'low' }
      });
      qualityDistribution.low++;
    }
  }
  
  // Финальное резюме
  const summary = {
    total_documents: documents.length,
    high_quality_documents: qualityDistribution.high,
    total_co2_kg: totalCO2,
    total_ch4_kg: totalCH4,
    total_n2o_kg: totalN2O,
    document_types: documentTypes,
    data_quality_distribution: qualityDistribution
  };
  
  console.log(`🎉 Массовое извлечение завершено: CO2=${totalCO2.toFixed(2)}кг, CH4=${totalCH4.toFixed(2)}кг, N2O=${totalN2O.toFixed(2)}кг`);
  
  // Логируем итоговое резюме
  savePatternsLog('final_summary', {
    summary,
    totalDocuments: results.length,
    successfullyProcessed: results.filter(r => r.documentType !== 'error').length,
    timestamp: new Date().toISOString()
  });

  return {
    documents: results,
    summary
  };
}

/**
 * НОВЫЕ ФУНКЦИИ ДЛЯ РАБОТЫ С FULLTEXT
 */

/**
 * Сопоставляет извлеченный тип топлива с ключами коэффициентов
 */
function mapFuelTypeToEmissionFactor(extractedFuelType: string, unit?: string): string | null {
  const fuelType = extractedFuelType.toLowerCase();
  
  // Дизельное топливо
  if (fuelType.includes('дизель') || fuelType.includes('дт')) {
    if (fuelType.includes('летн')) return 'ДТ летнее';
    if (fuelType.includes('зим')) return 'ДТ зимнее';
    if (fuelType.includes('аркт')) return 'ДТ арктическое';
    return 'ДТ летнее'; // По умолчанию летнее
  }
  
  // Бензин - проверяем прямое совпадение АИ- и паттерны
  if (fuelType.includes('бензин') || fuelType.includes('аи-')) {
    if (fuelType.includes('аи-80') || fuelType.includes('80')) return 'АИ-80';
    if (fuelType.includes('аи-92') || fuelType.includes('92')) return 'АИ-92';
    if (fuelType.includes('аи-95') || fuelType.includes('95')) return 'АИ-95';
    if (fuelType.includes('аи-98') || fuelType.includes('98')) return 'АИ-98';
    if (fuelType.includes('аи-100') || fuelType.includes('100')) return 'АИ-100';
    return 'АИ-92'; // По умолчанию 92
  }
  
  // Природный газ
  if (fuelType.includes('природный газ') || fuelType.includes('газ природн') || fuelType.includes('метан')) {
    return 'Природный газ РФ';
  }
  
  if (fuelType.includes('сжиженный газ') || fuelType.includes('пропан')) {
    return 'Сжиженный газ';
  }
  
  // Уголь - добавлены дополнительные варианты
  if (fuelType.includes('уголь') || fuelType.includes('каменный')) {
    return 'Каменный уголь';
  }
  
  // Мазут
  if (fuelType.includes('мазут')) {
    return 'Мазут топочный';
  }
  
  // Топливо прочее - пробуем определить по контексту
  if (fuelType.includes('топливо прочее') || fuelType.includes('прочее топливо')) {
    // Используем переданную единицу измерения
    if (unit && unit.toLowerCase().includes('тонн')) {
      return 'Каменный уголь';
    }
    // Если единица измерения "литр", скорее всего дизель или мазут  
    if (unit && unit.toLowerCase().includes('литр')) {
      return 'Мазут топочный';
    }
    
    // Fallback - пробуем найти единицы в самом названии топлива
    if (extractedFuelType.includes('тонн')) {
      return 'Каменный уголь';
    }
    if (extractedFuelType.includes('литр')) {
      return 'Мазут топочный';
    }
  }
  
  return null;
}

/**
 * Извлечение данных о топливе из полного текста
 */
function extractFuelDataFromText(text: string): Array<{ type: string; volume: number; unit: string }> {
  const fuels = [];
  
  // Используем новые расширенные паттерны топлива из russian-document-patterns.ts
  for (const patternGroup of FUEL_EXTRACTION_PATTERNS) {
    for (const regex of patternGroup.patterns) {
      let match;
      while ((match = regex.exec(text)) !== null) {
        const volume = parseNumericValue(match[1]); // Первая группа захвата содержит число
        if (volume > 0) {
          // Определяем тип топлива на основе контекста и подкатегории
          let fuelType = 'Топливо прочее';
          const context = match[0].toLowerCase();
          
          // Анализируем контекст совпадения для точного определения типа
          if (context.includes('дизель') || context.includes('дт') || context.includes('солярка')) {
            fuelType = 'Дизельное топливо';
          } else if (context.includes('бензин') || context.includes('аи-92') || context.includes('аи-95') || context.includes('аи-98') || context.match(/аи[\-\s]?\d+/)) {
            if (context.includes('аи-95') || context.includes('95')) {
              fuelType = 'АИ-95';
            } else if (context.includes('аи-98') || context.includes('98')) {
              fuelType = 'АИ-98';
            } else {
              fuelType = 'Бензин АИ-92';
            }
          } else if (context.includes('газ') && (context.includes('м3') || context.includes('куб'))) {
            fuelType = 'Газ природный РФ';
          } else if (context.includes('уголь') || context.includes('каменный') || context.includes('угля')) {
            fuelType = 'Уголь каменный';
          } else if (context.includes('мазут')) {
            fuelType = 'Мазут топочный';
          } else if (context.includes('керосин')) {
            fuelType = 'Керосин';
          } else if (context.includes('сжиженный') || context.includes('пропан') || context.includes('lpg')) {
            fuelType = 'Газ сжиженный';
          } else if (context.includes('дрова') || context.includes('древесина') || context.includes('пеллеты')) {
            fuelType = 'Дрова';
          }
          
          // Если не удалось определить из контекста, пробуем по подкатегории
          else if (patternGroup.subcategory.includes('diesel')) {
            fuelType = 'Дизельное топливо';
          } else if (patternGroup.subcategory.includes('gasoline')) {
            fuelType = 'Бензин АИ-92';
          } else if (patternGroup.subcategory.includes('gas')) {
            fuelType = 'Газ природный РФ';
          }
          
          // Определяем единицы из подкатегории или контекста
          let unit = 'литр';
          if (patternGroup.subcategory.includes('gas') || match[0].toLowerCase().includes('м3')) {
            unit = 'м³';
          } else if (match[0].toLowerCase().includes('тонн') || match[0].toLowerCase().includes('т.')) {
            unit = 'тонна';
          }
          
          fuels.push({
            type: fuelType,
            volume,
            unit
          });
        }
      }
    }
  }
  
  return fuels;
}

/**
 * Извлечение данных об электроэнергии из полного текста
 */
function extractElectricityDataFromText(text: string): {
  consumption_kwh: number;
  consumption_mwh: number;
  region: string;
  tariff_type: string;
  peak_consumption?: number;
  off_peak_consumption?: number;
} {
  let consumption_kwh = 0;
  let consumption_mwh = 0;
  let region = 'РФ средняя';
  let tariff_type = 'single';
  let peak_consumption = 0;
  let off_peak_consumption = 0;
  
  // Используем новые расширенные паттерны электроэнергии из russian-document-patterns.ts
  for (const patternGroup of ELECTRICITY_EXTRACTION_PATTERNS) {
    for (const regex of patternGroup.patterns) {
      let match;
      while ((match = regex.exec(text)) !== null) {
        const value = parseNumericValue(match[1]);
        if (value > 0) {
          // Определяем единицы по контексту
          const context = match[0].toLowerCase();
          if (context.includes('мвт') || context.includes('mwh')) {
            consumption_mwh += value;
            consumption_kwh += value * 1000;
          } else {
            consumption_kwh += value;
          }
          
          // Определяем тарифные зоны
          if (patternGroup.subcategory.includes('peak')) {
            peak_consumption += value;
          } else if (patternGroup.subcategory.includes('off_peak')) {
            off_peak_consumption += value;
          }
        }
      }
    }
  }
  
  // Определение региона
  const regions = [
    { pattern: /(москва|московская|подмосков)/gi, code: 'ЦФО' },
    { pattern: /(спб|санкт-петербург|ленинград)/gi, code: 'СЗФО' },
    { pattern: /(екатеринбург|свердлов|челябинск)/gi, code: 'УФО' },
    { pattern: /(новосибирск|красноярск|омск)/gi, code: 'СФО' },
    { pattern: /(владивосток|хабаровск|приморск)/gi, code: 'ДФО' }
  ];
  
  for (const reg of regions) {
    if (reg.pattern.test(text)) {
      region = reg.code;
      break;
    }
  }
  
  // Определение типа тарифа
  if (/пиковая|пик/gi.test(text)) tariff_type = 'peak';
  else if (/двухзон|двухставочн/gi.test(text)) tariff_type = 'two_zone';
  else if (/трехзон|трехставочн/gi.test(text)) tariff_type = 'three_zone';
  
  return {
    consumption_kwh,
    consumption_mwh,
    region,
    tariff_type,
    peak_consumption: peak_consumption > 0 ? peak_consumption : undefined,
    off_peak_consumption: off_peak_consumption > 0 ? off_peak_consumption : undefined
  };
}

/**
 * Извлечение данных по тепловой энергии из текста
 */
function extractThermalEnergyDataFromText(text: string): {
  consumption_gcal: number;
  consumption_gj: number;
  energy_type: string;
} {
  let consumption_gcal = 0;
  let consumption_gj = 0;
  let energy_type = 'heating';
  
  // Используем новые расширенные паттерны газа и тепла из russian-document-patterns.ts
  for (const patternGroup of GAS_HEAT_EXTRACTION_PATTERNS) {
    for (const regex of patternGroup.patterns) {
      let match;
      while ((match = regex.exec(text)) !== null) {
        if (patternGroup.category === 'heat' || patternGroup.category === 'thermal') {
          const value = parseNumericValue(match[1]);
          if (value > 0) {
            const context = match[0].toLowerCase();
            if (context.includes('гкал') || context.includes('gcal')) {
              consumption_gcal += value;
              consumption_gj += value * 4.184; // конвертация гкал в ГДж
            } else if (context.includes('гдж') || context.includes('gj')) {
              consumption_gj += value;
              consumption_gcal += value / 4.184; // конвертация ГДж в гкал
            } else if (context.includes('мдж') || context.includes('mj')) {
              consumption_gj += value / 1000; // МДж в ГДж
              consumption_gcal += value / 4184; // МДж в гкал
            }
          }
        }
      }
    }
  }
  
  // Определение типа тепловой энергии
  if (/(гвс|горячее\s*водоснабжение|hot\s*water)/gi.test(text)) {
    energy_type = 'hot_water';
  } else if (/(отопление|heating)/gi.test(text)) {
    energy_type = 'heating';
  } else if (/(технологическая|промышленная|производственная)/gi.test(text)) {
    energy_type = 'industrial';
  }
  
  return {
    consumption_gcal,
    consumption_gj,
    energy_type
  };
}

/**
 * Извлечение транспортных данных из полного текста
 */
function extractTransportDataFromText(text: string): {
  distance_km: number;
  transport_type: string;
  vehicle_class: string;
  cargo_weight: number;
} {
  let distance = 0;
  let transport_type = 'unknown';
  let vehicle_class = 'unknown';
  let cargo_weight = 0;
  
  // Используем новые расширенные паттерны транспорта из russian-document-patterns.ts
  for (const patternGroup of TRANSPORT_EXTRACTION_PATTERNS) {
    for (const regex of patternGroup.patterns) {
      let match;
      while ((match = regex.exec(text)) !== null) {
        // Извлекаем расстояние
        if (patternGroup.category === 'transport' && patternGroup.subcategory.includes('distance')) {
          const value = parseNumericValue(match[1]);
          if (value > 0) {
            // Конвертируем в км если нужно
            const context = match[0].toLowerCase();
            if (context.includes('м') && !context.includes('км')) {
              distance += value / 1000; // метры в километры
            } else if (context.includes('миля') || context.includes('mil')) {
              distance += value * 1.60934; // мили в километры
            } else {
              distance += value;
            }
          }
        }
        
        // Извлекаем массу груза
        if (patternGroup.subcategory.includes('cargo') || patternGroup.subcategory.includes('weight')) {
          const weight = parseNumericValue(match[1]);
          if (weight > 0) {
            cargo_weight += weight;
          }
        }
        
        // Определяем тип транспорта из подкатегории
        if (patternGroup.subcategory.includes('aviation')) {
          transport_type = 'aviation';
        } else if (patternGroup.subcategory.includes('railway')) {
          transport_type = 'railway';
        } else if (patternGroup.subcategory.includes('road')) {
          transport_type = 'road';
        } else if (patternGroup.subcategory.includes('marine')) {
          transport_type = 'marine';
        }
        
        // Определяем класс транспорта
        if (patternGroup.subcategory.includes('passenger')) {
          vehicle_class = 'passenger';
        } else if (patternGroup.subcategory.includes('freight')) {
          vehicle_class = 'freight';
        } else if (patternGroup.subcategory.includes('cargo')) {
          vehicle_class = 'freight';
        }
      }
    }
  }
  
  // МАКСИМАЛЬНО ПОЛНЫЕ паттерны для веса груза
  const weightPatterns = [
    // ========== Основные паттерны массы ==========
    /(вес|масса|груз|загрузка|нагрузка|weight|load)[_:\s]*(\d+[,.]?\d*)\s*(т|тонн|тонны?|kg|кг|килограмм)/gi,
    /(\d+[,.]?\d*)\s*(т|тонн|тонны?|kg|кг|килограмм)\s*.*?(груз|вес|масса|load)/gi,
    
    // ========== Грузоподъемность ==========
    /(грузоподъемность|carrying\s*capacity|payload)[\s\S]*?(\d+[,.]?\d*)\s*(т|тонн)/gi,
    /(полная\s*масса|gross\s*weight|полный\s*вес)[\s\S]*?(\d+[,.]?\d*)\s*(т|тонн|кг)/gi,
    /(снаряженная\s*масса|curb\s*weight)[\s\S]*?(\d+[,.]?\d*)\s*(т|тонн|кг)/gi,
    
    // ========== Структурированные данные ==========
    /товар[_:\s]*([^\\n]*)[\\s\\S]*?масса[_:\s]*(\d+[,.]?\d*)\s*(т|тонн|кг)/gi,
    /наименование[_:\s]*([^\\n]*)[\\s\\S]*?вес[_:\s]*(\d+[,.]?\d*)\s*(т|тонн|кг)/gi,
    /груз[_:\s]*([^\\n]*)[\\s\\S]*?(\d+[,.]?\d*)\s*(т|тонн|кг)/gi,
    
    // ========== Транспортная документация ==========
    /(к\s*перевозке|перевозимый\s*груз|cargo\s*weight)[\s\S]*?(\d+[,.]?\d*)\s*(т|тонн|кг)/gi,
    /(накладная|waybill)[\s\S]*?(масса|вес)[\s\S]*?(\d+[,.]?\d*)\s*(т|тонн|кг)/gi,
    /(брутто|нетто|gross|net)[\s\S]*?(\d+[,.]?\d*)\s*(т|тонн|кг)/gi,
    
    // ========== Табличные форматы ==========
    /(масса|вес|груз|т)[^|\\n]*\|[^|]*(\d+[,.]?\d*)/gi,
    /([^;,\\n]*(?:масса|вес|груз|т)[^;,\\n]*)[;,][^;,]*(\d+[,.]?\d*)/gi,
    
    // ========== Спецификации транспорта ==========
    /(максимальная\s*загрузка|max\s*load)[\s\S]*?(\d+[,.]?\d*)\s*(т|тонн)/gi,
    /(разрешенная\s*масса|допустимый\s*вес)[\s\S]*?(\d+[,.]?\d*)\s*(т|тонн)/gi
  ];
  
  for (const pattern of weightPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const value = parseNumericValue(match[match.length - 2] || match[2] || match[1]);
      if (value > 0) {
        // Конвертируем в тонны если нужно
        const unit = (match[match.length - 1] || '').toLowerCase();
        if (unit.includes('кг') || unit.includes('kg')) {
          cargo_weight += value / 1000; // килограммы в тонны
        } else {
          cargo_weight += value;
        }
      }
    }
  }
  
  return {
    distance_km: distance,
    transport_type,
    vehicle_class,
    cargo_weight
  };
}

/**
 * Извлечение данных с помощью многоуровневой OCR системы
 */
async function extractWithMultiLevelOCR(
  documentId: string,
  filePath: string
): Promise<ExtractedDocumentData> {
  console.log(`🔍 Starting multi-level OCR extraction for document: ${documentId}`);
  
  try {
    // Читаем файл для OCR обработки
    const fs = require('fs');
    const fileBuffer = fs.readFileSync(filePath);
    
    // Используем многоуровневую OCR систему
    const ocrResult = await processImageMultiLevel(fileBuffer, {
      preferredSource: 'auto',
      enableFallback: true,
      minConfidence: 0.5
    });
    
    console.log(`✅ OCR completed via ${ocrResult.source}: ${ocrResult.text.length} chars, confidence: ${ocrResult.confidence}`);
    
    // Извлекаем данные из текста через паттерны
    const extractedData = await extractDocumentDataFromText(ocrResult.text, documentId);
    
    const confidence = Math.min(ocrResult.confidence * 0.9, 0.95); // Немного снижаем уверенность
    const dataQuality = confidence > 0.8 ? 'high' : confidence > 0.6 ? 'medium' : 'low';
    
    return {
      documentId,
      documentType: extractedData.documentType || 'ocr_processed',
      confidence,
      extractedFields: {
        ...extractedData.extractedFields,
        ocr_source: ocrResult.source,
        ocr_text: ocrResult.text.slice(0, 1000), // Сохраняем первые 1000 символов
        processing_time_ms: ocrResult.processingTime
      },
      emissions: extractedData.emissions || { co2_kg: 0, ch4_kg: 0, n2o_kg: 0, calculation_method: 'ocr_error', confidence: 0 },
      metadata: {
        classification_confidence: confidence,
        fields_extracted: Object.keys(extractedData.extractedFields || {}).length,
        fields_expected: 5,
        data_quality: dataQuality
      }
    };
    
  } catch (error) {
    console.error('Multi-level OCR extraction failed:', error);
    
    // Fallback: возвращаем структуру с ошибкой
    return {
      documentId,
      documentType: 'ocr_error',
      confidence: 0,
      extractedFields: { 
        error: error instanceof Error ? error.message : String(error),
        fallback_attempted: true
      },
      emissions: { co2_kg: 0, ch4_kg: 0, n2o_kg: 0, calculation_method: 'ocr_error', confidence: 0 },
      metadata: { classification_confidence: 0, fields_extracted: 0, fields_expected: 0, data_quality: 'low' }
    };
  }
}

/**
 * НОВАЯ ФУНКЦИЯ: Извлечение данных с помощью интеллектуальной системы обработки файлов
 */
async function extractWithIntelligentProcessor(
  documentId: string,
  filePath: string
): Promise<ExtractedDocumentData> {
  console.log(`🤖 Интеллектуальная обработка документа: ${documentId} (${filePath})`);
  
  const startTime = Date.now();
  const errors: string[] = [];
  const warnings: string[] = [];
  
  try {
    // Получаем информацию о файле для метрик
    const fileStats = fs.statSync(filePath);
    const fileType = path.extname(filePath).toLowerCase();
    
    // Используем интеллектуальную систему обработки файлов
    const processingResult: ParsingResult = await processFileIntelligently(filePath);
    
    // Проверяем успешность на основе confidence и отсутствия критических ошибок
    const isSuccess = processingResult.confidence > 0.3 && processingResult.text.length > 0;
    if (!isSuccess) {
      const errorMsg = processingResult.errors?.join(', ') || 'Low confidence or empty result';
      throw new Error(`Интеллектуальная обработка не удалась: ${errorMsg}`);
    }
    
    console.log(`✅ Интеллектуальная обработка завершена: уверенность ${processingResult.confidence}`);
    
    // Создаем поля из метаданных и текста для нормализации
    const extractedFields = {
      fullText: processingResult.text,
      ...(processingResult.metadata || {})
    };
    
    console.log(`📊 Извлечено полей: ${Object.keys(extractedFields).length}`);
    
    // Применяем словарь синонимов для нормализации терминологии
    const normalizedFields = normalizeFieldsWithSynonyms(extractedFields);
    console.log(`🔄 Нормализовано с помощью словаря синонимов: ${Object.keys(normalizedFields).length} полей`);
    
    // Извлекаем данные из обработанного текста и нормализованных полей
    const fuelData = extractFuelData(normalizedFields);
    const electricityData = extractElectricityData(normalizedFields);
    const thermalData = extractThermalEnergyDataFromText(processingResult.text || '');
    const transportData = extractTransportData(normalizedFields);
    const industrialProcessData = extractIndustrialProcessData(normalizedFields);
    
    // Рассчитываем выбросы по российским коэффициентам 2025
    const baseEmissions = calculateRussianEmissions(fuelData, electricityData, thermalData, transportData);
    
    // Добавляем выбросы от F-газов и промышленных процессов
    let fgasEmissions = 0;
    for (const fgas of industrialProcessData.fgases) {
      fgasEmissions += fgas.co2_equivalent;
    }
    
    let industrialEmissions = 0;
    for (const process of industrialProcessData.industrial_processes) {
      industrialEmissions += process.co2_kg;
    }
    
    const totalCO2 = baseEmissions.co2_kg + fgasEmissions + industrialEmissions;
    
    // Определяем тип документа на основе источника
    const documentType = processingResult.source || 'intelligent_processed';
    
    // Оценка качества данных
    const extractedDataCount = (fuelData.length > 0 ? 2 : 0) + 
                              (electricityData.consumption_kwh > 0 ? 2 : 0) +
                              (thermalData && thermalData.consumption_gcal > 0 ? 2 : 0) +
                              (transportData.distance_km > 0 ? 1 : 0) +
                              (industrialProcessData.fgases.length > 0 ? 1 : 0) +
                              (industrialProcessData.industrial_processes.length > 0 ? 1 : 0);
    
    const dataQuality = processingResult.confidence > 0.8 ? 'high' : 
                       processingResult.confidence > 0.6 ? 'medium' : 'low';
    
    const result: ExtractedDocumentData = {
      documentId,
      documentType,
      confidence: processingResult.confidence,
      extractedFields: {
        fullText: (processingResult.text || '').substring(0, 1000),
        fuel_data: fuelData,
        electricity_data: electricityData,
        thermal_data: thermalData,
        transport_data: transportData,
        fgas_data: industrialProcessData.fgases,
        industrial_processes: industrialProcessData.industrial_processes,
        // Дополнительные метаданные
        processing_method: processingResult.source,
        processing_time: processingResult.processingTime,
        normalized_fields: normalizedFields,
        extraction_warnings: processingResult.warnings || []
      },
      emissions: {
        co2_kg: totalCO2,
        ch4_kg: baseEmissions.ch4_kg,
        n2o_kg: baseEmissions.n2o_kg,
        fgas_co2_equivalent: fgasEmissions,
        industrial_process_co2: industrialEmissions,
        calculation_method: 'intelligent_processor_2025_with_synonyms',
        confidence: totalCO2 > 0 ? 0.9 : 0.4
      },
      metadata: {
        classification_confidence: processingResult.confidence,
        fields_extracted: extractedDataCount,
        fields_expected: 8, // Увеличили ожидание полей из-за F-газов и промпроцессов
        data_quality: dataQuality
      }
    };
    
    // Сохраняем подробные логи для анализа
    savePatternsLog(`intelligent_extraction_${documentId}`, {
      documentId,
      filePath,
      processingResult: {
        success: processingResult.success,
        parser: processingResult.parser,
        confidence: processingResult.confidence,
        attempts: processingResult.attempts?.length || 1,
        detectedFormat: processingResult.detectedFormat
      },
      extractedData: {
        fuelDataCount: fuelData.length,
        electricityConsumption: electricityData.consumption_kwh,
        thermalConsumption: thermalData?.consumption_gcal || 0,
        transportDistance: transportData.distance_km,
        fgasCount: industrialProcessData.fgases.length,
        industrialProcessCount: industrialProcessData.industrial_processes.length
      },
      emissions: {
        total_co2: totalCO2,
        base_co2: baseEmissions.co2_kg,
        fgas_co2: fgasEmissions,
        industrial_co2: industrialEmissions
      },
      timestamp: new Date().toISOString()
    });
    
    console.log(`🎉 Интеллектуальная обработка успешна: CO2=${totalCO2.toFixed(2)}кг (база: ${baseEmissions.co2_kg.toFixed(2)}, F-газы: ${fgasEmissions.toFixed(2)}, промпроцессы: ${industrialEmissions.toFixed(2)})`);
    
    // СБОР МЕТРИК
    const endTime = Date.now();
    const synonymsApplied = Object.keys(normalizedFields).filter(key => 
      key.includes('_synonyms') || key.includes('_category')).length;
    
    const processingMetrics: ProcessingMetrics = {
      documentId,
      filePath,
      fileSize: fileStats.size,
      fileType,
      processingMethod: 'intelligent_processor',
      startTime,
      endTime,
      processingTimeMs: endTime - startTime,
      
      parserUsed: processingResult.source,
      fallbackAttempts: 0, // ParsingResult не содержит информации о попытках
      confidence: processingResult.confidence,
      
      fieldsExtracted: extractedDataCount,
      fieldsExpected: 8,
      extractionSuccess: totalCO2 > 0 || extractedDataCount >= 4,
      dataQuality: dataQuality,
      
      fuelDataExtracted: fuelData.length,
      electricityDataExtracted: electricityData.consumption_kwh > 0,
      thermalDataExtracted: (thermalData && thermalData.consumption_gcal > 0) || false,
      transportDataExtracted: transportData.distance_km > 0,
      fgasDataExtracted: industrialProcessData.fgases.length,
      industrialProcessesExtracted: industrialProcessData.industrial_processes.length,
      
      totalCO2Calculated: totalCO2,
      baseEmissions: baseEmissions.co2_kg,
      fgasEmissions,
      industrialEmissions,
      emissionCalculationMethod: 'intelligent_processor_2025_with_synonyms',
      
      synonymsApplied,
      fieldsNormalized: Object.keys(normalizedFields).length,
      categoriesIdentified: Object.keys(normalizedFields).filter(key => key.includes('_category')).length,
      
      errors: processingResult.errors || [],
      warnings: processingResult.warnings || [],
      fallbackReason: undefined, // ParsingResult не содержит подробной информации о fallback
      
      timestamp: new Date().toISOString()
    };
    
    // Записываем метрики
    metricsCollector.recordProcessingMetrics(processingMetrics);
    
    // Анализируем качество извлечения
    const qualityAnalysis = metricsCollector.analyzeExtractionQuality(processingMetrics);
    console.log(`📊 Оценка качества: ${qualityAnalysis.overallScore}/100`);
    if (qualityAnalysis.recommendations.length > 0) {
      console.log(`💡 Рекомендации: ${qualityAnalysis.recommendations.join(', ')}`);
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ Ошибка интеллектуальной обработки:', error);
    
    // СБОР МЕТРИК ДЛЯ ОШИБОК
    const endTime = Date.now();
    const errorMessage = error instanceof Error ? error.message : String(error);
    errors.push(errorMessage);
    
    const processingMetrics: ProcessingMetrics = {
      documentId,
      filePath,
      fileSize: (fileStats && fileStats.size) || 0,
      fileType: path.extname(filePath).toLowerCase(),
      processingMethod: 'intelligent_processor_failed',
      startTime,
      endTime,
      processingTimeMs: endTime - startTime,
      
      parserUsed: 'none',
      fallbackAttempts: 1,
      confidence: 0,
      
      fieldsExtracted: 0,
      fieldsExpected: 8,
      extractionSuccess: false,
      dataQuality: 'low',
      
      fuelDataExtracted: 0,
      electricityDataExtracted: false,
      thermalDataExtracted: false,
      transportDataExtracted: false,
      fgasDataExtracted: 0,
      industrialProcessesExtracted: 0,
      
      totalCO2Calculated: 0,
      baseEmissions: 0,
      fgasEmissions: 0,
      industrialEmissions: 0,
      emissionCalculationMethod: 'failed',
      
      synonymsApplied: 0,
      fieldsNormalized: 0,
      categoriesIdentified: 0,
      
      errors,
      warnings,
      fallbackReason: `Intelligent processor failed: ${errorMessage}`,
      
      timestamp: new Date().toISOString()
    };
    
    // Записываем метрики даже для ошибок
    metricsCollector.recordProcessingMetrics(processingMetrics);
    
    // Fallback к стандартной обработке
    throw error; // Позволяем fallback к старому методу
  }
}

/**
 * Нормализует поля с помощью словаря синонимов
 */
function normalizeFieldsWithSynonyms(fields: Record<string, any>): Record<string, any> {
  const normalizedFields: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(fields)) {
    const keyStr = String(key).toLowerCase();
    const valueStr = String(value).toLowerCase();
    
    // Нормализуем ключ поля
    let normalizedKey = key;
    const canonicalKey = findCanonical(keyStr);
    if (canonicalKey) {
      normalizedKey = canonicalKey;
    }
    
    // Нормализуем значение поля
    let normalizedValue = value;
    const canonicalValue = findCanonical(valueStr);
    if (canonicalValue) {
      normalizedValue = canonicalValue;
    }
    
    // Добавляем синонимы для лучшего поиска
    const keySynonyms = getSynonyms(keyStr);
    const valueSynonyms = getSynonyms(valueStr);
    
    normalizedFields[normalizedKey] = normalizedValue;
    
    // Создаем дополнительные поля с синонимами для лучшего извлечения
    if (keySynonyms.length > 0) {
      normalizedFields[`${normalizedKey}_synonyms`] = keySynonyms;
    }
    if (valueSynonyms.length > 0) {
      normalizedFields[`${normalizedKey}_value_synonyms`] = valueSynonyms;
    }
    
    // Определяем категорию поля
    const category = getCategory(keyStr) || getCategory(valueStr);
    if (category) {
      normalizedFields[`${normalizedKey}_category`] = category;
    }
  }
  
  return normalizedFields;
}

/**
 * Извлекает данные из текста с помощью российских паттернов
 */
async function extractDocumentDataFromText(text: string, documentId: string): Promise<Partial<ExtractedDocumentData>> {
  // Используем существующую логику извлечения по паттернам
  const pattern = findDocumentPattern(text);
  const priorityFields = getPriorityFields(text, pattern?.type || 'unknown');
  
  // Извлекаем данные по типам
  const fuelData = extractFuelData({ fullText: text });
  const electricityData = extractElectricityData({ fullText: text });
  const transportData = extractTransportData({ fullText: text });
  
  // Рассчитываем выбросы
  const emissions = calculateRussianEmissions(fuelData, electricityData, undefined, transportData);
  
  return {
    documentType: pattern?.type || 'unknown_document',
    extractedFields: {
      fuel_data: fuelData,
      electricity_data: electricityData,
      transport_data: transportData,
      priority_fields: priorityFields
    },
    emissions: {
      co2_kg: emissions.co2_kg,
      ch4_kg: emissions.ch4_kg,
      n2o_kg: emissions.n2o_kg,
      calculation_method: 'pattern_extraction_2025',
      confidence: emissions.co2_kg > 0 ? 0.8 : 0.3
    }
  };
}