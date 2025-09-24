/**
 * Базовые типы и интерфейсы для структурных парсеров
 */

export interface ParsedDocumentData {
  documentType: 'csv' | 'excel' | 'json' | 'txt' | 'unknown';
  confidence: number;
  extractedData: {
    fuel_data?: FuelDataEntry[];
    electricity_data?: ElectricityDataEntry[];
    gas_data?: GasDataEntry[];
    transport_data?: TransportDataEntry[];
    raw_rows?: any[];
    total_rows?: number;
    headers?: string[];
  };
  metadata: {
    encoding?: string;
    delimiter?: string;
    format_detected: string;
    processing_time_ms: number;
    russian_units_found: string[];
    data_quality: 'high' | 'medium' | 'low';
  };
}

export interface FuelDataEntry {
  type: string;         // тип топлива: бензин, дизель, газ
  amount: number;       // количество
  unit: string;         // единица: л, м³, кг, т
  period?: string;      // период потребления
  supplier?: string;    // поставщик
  confidence: number;   // уверенность извлечения (0-1)
}

export interface ElectricityDataEntry {
  consumption_kwh: number;
  consumption_mwh?: number;
  region?: string;
  tariff_type?: string;
  period?: string;
  supplier?: string;
  confidence: number;
}

export interface GasDataEntry {
  consumption_m3: number;
  consumption_gcal?: number;
  gas_type?: string; // природный газ, сжиженный
  period?: string;
  supplier?: string;
  confidence: number;
}

export interface TransportDataEntry {
  distance_km: number;
  transport_type?: string; // автомобиль, железная дорога, самолет
  vehicle_class?: string;
  cargo_weight?: number;
  fuel_consumption?: number;
  period?: string;
  confidence: number;
}

export interface ParseOptions {
  encoding?: 'auto' | 'utf8' | 'cp1251' | 'cp866';
  delimiter?: 'auto' | ',' | ';' | '\t' | '|';
  skipEmptyRows?: boolean;
  maxRows?: number;
  searchRussianUnits?: boolean;
  extractMetadata?: boolean;
  minConfidence?: number;
}

export interface ParserResult {
  success: boolean;
  data?: ParsedDocumentData;
  error?: string;
  processingTime: number;
}

/**
 * Российские единицы измерения для поиска в документах
 */
export const RUSSIAN_UNITS = {
  // Электричество
  electricity: ['квт*ч', 'квт·ч', 'квтч', 'kwh', 'кВт*ч', 'киловатт-час', 'мвт*ч', 'мвт·ч', 'мвтч', 'mwh'],
  
  // Топливо
  fuel_liquid: ['л', 'лит', 'литр', 'литры', 'liters', 'liter'],
  fuel_weight: ['кг', 'т', 'тонн', 'тонны', 'kg', 'ton', 'tons'],
  fuel_gas: ['м3', 'м³', 'куб.м', 'кубометр', 'куб м', 'м.куб', 'cubic'],
  
  // Тепло
  heat: ['гкал', 'ГКал', 'гигакалория', 'gcal', 'мкал', 'ккал'],
  
  // Транспорт
  transport: ['км', 'километр', 'километры', 'km', 'ткм', 'т*км', 'тонно-километр'],
  
  // Масса/вес
  weight: ['кг', 'г', 'т', 'центнер', 'ц', 'kg', 'ton'],
  
  // Валюта
  currency: ['руб', 'рубль', 'рублей', '₽', 'rub', 'rur'],
};

/**
 * Паттерны для поиска российских единиц в тексте
 */
export const UNIT_PATTERNS = {
  // Числовое значение + единица
  number_unit: /(\d+(?:[.,]\d+)?)\s*([а-яё\w*·³]+)/gi,
  
  // Электричество
  electricity: /(\d+(?:[.,]\d+)?)\s*(квт[*·]?ч|kwh|мвт[*·]?ч|mwh)/gi,
  
  // Топливо жидкое
  fuel_liquid: /(\d+(?:[.,]\d+)?)\s*(л(?:ит(?:р|ов)?)?|liters?)/gi,
  
  // Топливо газообразное
  fuel_gas: /(\d+(?:[.,]\d+)?)\s*(м[3³]|куб\.?м|cubic)/gi,
  
  // Тепло
  heat: /(\d+(?:[.,]\d+)?)\s*(г?кал|gcal)/gi,
  
  // Транспорт
  transport_km: /(\d+(?:[.,]\d+)?)\s*(км|километр|km)/gi,
  transport_tkm: /(\d+(?:[.,]\d+)?)\s*(ткм|т[*·]км|тонно-километр)/gi,
};

/**
 * Утилиты для работы с российскими единицами
 */
export class RussianUnitsHelper {
  /**
   * Нормализует число из российского формата
   */
  static normalizeNumber(value: string): number {
    return parseFloat(value.replace(/\s+/g, '').replace(',', '.'));
  }

  /**
   * Определяет тип единицы измерения
   */
  static detectUnitType(unit: string): string {
    const lowerUnit = unit.toLowerCase();
    
    if (RUSSIAN_UNITS.electricity.some(u => lowerUnit.includes(u.toLowerCase()))) {
      return 'electricity';
    }
    if (RUSSIAN_UNITS.fuel_liquid.some(u => lowerUnit.includes(u.toLowerCase()))) {
      return 'fuel_liquid';
    }
    if (RUSSIAN_UNITS.fuel_gas.some(u => lowerUnit.includes(u.toLowerCase()))) {
      return 'fuel_gas';
    }
    if (RUSSIAN_UNITS.heat.some(u => lowerUnit.includes(u.toLowerCase()))) {
      return 'heat';
    }
    if (RUSSIAN_UNITS.transport.some(u => lowerUnit.includes(u.toLowerCase()))) {
      return 'transport';
    }
    
    return 'unknown';
  }

  /**
   * Извлекает числовые значения с единицами из текста
   */
  static extractValuesWithUnits(text: string): Array<{value: number, unit: string, type: string}> {
    const results: Array<{value: number, unit: string, type: string}> = [];
    
    Object.entries(UNIT_PATTERNS).forEach(([patternName, pattern]) => {
      if (patternName === 'number_unit') return; // Skip general pattern
      
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const value = this.normalizeNumber(match[1]);
        const unit = match[2];
        const type = patternName;
        
        if (!isNaN(value) && value > 0) {
          results.push({ value, unit, type });
        }
      }
    });
    
    return results;
  }

  /**
   * Определяет качество данных на основе найденных единиц
   */
  static assessDataQuality(foundUnits: string[], totalRows: number): 'high' | 'medium' | 'low' {
    const unitsPerRow = foundUnits.length / Math.max(totalRows, 1);
    
    if (unitsPerRow > 0.5 && foundUnits.length >= 3) return 'high';
    if (unitsPerRow > 0.2 && foundUnits.length >= 1) return 'medium';
    return 'low';
  }
}

/**
 * Базовый абстрактный класс для всех парсеров
 */
export abstract class BaseParser {
  protected abstract readonly supportedFormats: string[];
  
  /**
   * Проверяет, поддерживается ли данный формат файла
   */
  canParse(filename: string, mimeType?: string): boolean {
    const extension = filename.toLowerCase().split('.').pop();
    return extension ? this.supportedFormats.includes(extension) : false;
  }

  /**
   * Основной метод парсинга (должен быть реализован в наследниках)
   */
  abstract parse(buffer: Buffer, options?: ParseOptions): Promise<ParserResult>;

  /**
   * Определяет кодировку буфера
   */
  protected detectEncoding(buffer: Buffer): string {
    const text = buffer.toString('utf8', 0, Math.min(1000, buffer.length));
    
    // Проверяем наличие русских символов в UTF-8
    if (/[а-яё]/i.test(text)) {
      return 'utf8';
    }
    
    // Пробуем CP1251
    try {
      const cp1251Text = buffer.toString('binary');
      if (cp1251Text.includes('р') || cp1251Text.includes('с') || cp1251Text.includes('т')) {
        return 'cp1251';
      }
    } catch {}
    
    return 'utf8'; // По умолчанию
  }

  /**
   * Извлекает данные по российским единицам
   */
  protected extractRussianUnitsData(rows: any[]): {
    fuel_data: FuelDataEntry[];
    electricity_data: ElectricityDataEntry[];
    gas_data: GasDataEntry[];
    transport_data: TransportDataEntry[];
    russian_units_found: string[];
  } {
    const fuel_data: FuelDataEntry[] = [];
    const electricity_data: ElectricityDataEntry[] = [];
    const gas_data: GasDataEntry[] = [];
    const transport_data: TransportDataEntry[] = [];
    const russian_units_found: string[] = [];

    rows.forEach((row, index) => {
      const rowText = Array.isArray(row) ? row.join(' ') : JSON.stringify(row);
      const valuesWithUnits = RussianUnitsHelper.extractValuesWithUnits(rowText);
      
      valuesWithUnits.forEach(({ value, unit, type }) => {
        russian_units_found.push(unit);
        
        switch (type) {
          case 'electricity':
            electricity_data.push({
              consumption_kwh: unit.toLowerCase().includes('мвт') ? value * 1000 : value,
              region: 'средняя РФ',
              confidence: 0.8
            });
            break;
            
          case 'fuel_liquid':
            fuel_data.push({
              type: this.guessFuelType(rowText),
              amount: value,
              unit: 'л',
              confidence: 0.8
            });
            break;
            
          case 'fuel_gas':
            gas_data.push({
              consumption_m3: value,
              gas_type: 'природный газ',
              confidence: 0.8
            });
            break;
            
          case 'heat':
            electricity_data.push({
              consumption_kwh: value * 1163, // Гкал в кВт·ч
              region: 'средняя РФ',
              confidence: 0.7
            });
            break;
            
          case 'transport_km':
          case 'transport_tkm':
            transport_data.push({
              distance_km: type === 'transport_tkm' ? value : value,
              transport_type: 'автомобиль',
              confidence: 0.7
            });
            break;
        }
      });
    });

    return { fuel_data, electricity_data, gas_data, transport_data, russian_units_found };
  }

  /**
   * Угадывает тип топлива по контексту
   */
  private guessFuelType(context: string): string {
    const lowerContext = context.toLowerCase();
    
    if (lowerContext.includes('бензин') || lowerContext.includes('а-') || lowerContext.includes('аи-')) {
      return 'бензин';
    }
    if (lowerContext.includes('дизель') || lowerContext.includes('дт') || lowerContext.includes('солярка')) {
      return 'дизель';
    }
    if (lowerContext.includes('газ') || lowerContext.includes('метан') || lowerContext.includes('пропан')) {
      return 'газ';
    }
    
    return 'топливо';
  }

  /**
   * Извлекает значение и единицу измерения из совпадения регулярного выражения
   */
  protected extractValue(
    matches: RegExpMatchArray, 
    pattern: { unit: string; confidence: number }
  ): { amount: number; unit: string } | null {
    try {
      // Первая группа в regex должна содержать число
      const numberStr = matches[1];
      if (!numberStr) return null;
      
      // Нормализуем число (заменяем запятые на точки)
      const normalizedNumber = numberStr.replace(',', '.');
      const amount = parseFloat(normalizedNumber);
      
      if (isNaN(amount)) return null;
      
      return {
        amount,
        unit: pattern.unit
      };
    } catch (error) {
      return null;
    }
  }
}