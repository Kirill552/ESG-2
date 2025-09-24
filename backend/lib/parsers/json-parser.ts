/**
 * Парсер для JSON файлов с поддержкой различных структур и российских единиц измерения
 * Обрабатывает как плоские, так и вложенные JSON структуры
 */

import { 
  BaseParser, 
  ParsedDocumentData, 
  ParseOptions, 
  ParserResult,
  RussianUnitsHelper 
} from './base-parser';

export class JsonParser extends BaseParser {
  protected readonly supportedFormats = ['json'];

  /**
   * Парсит JSON файл с автоопределением структуры
   */
  async parse(buffer: Buffer, options: ParseOptions = {}): Promise<ParserResult> {
    const startTime = Date.now();
    
    try {
      // Определяем кодировку
      const encoding = options.encoding === 'auto' || !options.encoding 
        ? this.detectEncoding(buffer) 
        : options.encoding;
      
      console.log(`📄 JSON Parser: detected encoding ${encoding}`);
      
      // Конвертируем буфер в текст
      let text: string;
      if (encoding === 'cp1251') {
        text = this.convertFromCp1251(buffer);
      } else {
        text = buffer.toString(encoding === 'cp866' ? 'binary' : 'utf8');
      }
      
      // Парсим JSON
      let jsonData: any;
      try {
        jsonData = JSON.parse(text);
      } catch (parseError) {
        return {
          success: false,
          error: `Invalid JSON format: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
          processingTime: Date.now() - startTime
        };
      }
      
      console.log(`📄 JSON Parser: parsed JSON structure`);
      
      // Преобразуем JSON в плоский массив строк для анализа
      const flatData = this.flattenJsonData(jsonData, options.maxRows);
      console.log(`📄 JSON Parser: flattened to ${flatData.length} data items`);
      
      if (flatData.length === 0) {
        return {
          success: false,
          error: 'No extractable data found in JSON file',
          processingTime: Date.now() - startTime
        };
      }
      
      // Извлекаем данные по российским единицам
      const extractedUnitsData = this.extractRussianUnitsData(flatData);
      
      // Пытаемся определить структуру данных
      const structureInfo = this.analyzeJsonStructure(jsonData);
      
      // Оцениваем качество данных
      const dataQuality = RussianUnitsHelper.assessDataQuality(
        extractedUnitsData.russian_units_found, 
        flatData.length
      );
      
      const confidence = this.calculateConfidence(
        extractedUnitsData, 
        flatData.length, 
        dataQuality,
        structureInfo.complexity
      );
      
      const result: ParsedDocumentData = {
        documentType: 'json',
        confidence,
        extractedData: {
          ...extractedUnitsData,
          raw_rows: flatData,
          total_rows: flatData.length,
          headers: structureInfo.possibleHeaders
        },
        metadata: {
          encoding,
          format_detected: `JSON (${structureInfo.type})`,
          processing_time_ms: Date.now() - startTime,
          russian_units_found: extractedUnitsData.russian_units_found,
          data_quality: dataQuality,
          json_structure: {
            type: structureInfo.type,
            depth: structureInfo.depth,
            arrays_count: structureInfo.arraysCount,
            objects_count: structureInfo.objectsCount
          }
        }
      };
      
      console.log(`✅ JSON Parser: success! Found ${extractedUnitsData.russian_units_found.length} units, quality: ${dataQuality}`);
      
      return {
        success: true,
        data: result,
        processingTime: Date.now() - startTime
      };
      
    } catch (error) {
      console.error('❌ JSON Parser failed:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Преобразует JSON данные в плоский массив для анализа
   */
  private flattenJsonData(data: any, maxRows?: number): any[][] {
    const result: any[][] = [];
    
    if (Array.isArray(data)) {
      // Если корень - массив
      data.forEach((item, index) => {
        if (maxRows && result.length >= maxRows) return;
        
        if (typeof item === 'object' && item !== null) {
          // Объект - превращаем в строку ключ-значение
          const row = this.objectToRow(item);
          result.push(row);
        } else {
          // Примитивное значение
          result.push([String(item)]);
        }
      });
    } else if (typeof data === 'object' && data !== null) {
      // Если корень - объект
      const entries = Object.entries(data);
      
      entries.forEach(([key, value], index) => {
        if (maxRows && result.length >= maxRows) return;
        
        if (Array.isArray(value)) {
          // Значение - массив
          value.forEach((arrayItem, arrayIndex) => {
            if (maxRows && result.length >= maxRows) return;
            
            if (typeof arrayItem === 'object' && arrayItem !== null) {
              const row = this.objectToRow(arrayItem, key);
              result.push(row);
            } else {
              result.push([key, String(arrayItem)]);
            }
          });
        } else if (typeof value === 'object' && value !== null) {
          // Значение - объект
          const row = this.objectToRow(value, key);
          result.push(row);
        } else {
          // Значение - примитив
          result.push([key, String(value)]);
        }
      });
    } else {
      // Примитивное значение в корне
      result.push([String(data)]);
    }
    
    return result;
  }

  /**
   * Преобразует объект в строку массива
   */
  private objectToRow(obj: any, prefix?: string): any[] {
    const row: any[] = [];
    
    if (prefix) {
      row.push(prefix);
    }
    
    Object.entries(obj).forEach(([key, value]) => {
      if (typeof value === 'object' && value !== null) {
        // Вложенный объект - сериализуем в строку
        row.push(`${key}: ${JSON.stringify(value)}`);
      } else {
        row.push(key, String(value));
      }
    });
    
    return row;
  }

  /**
   * Анализирует структуру JSON данных
   */
  private analyzeJsonStructure(data: any): {
    type: string;
    depth: number;
    complexity: 'simple' | 'medium' | 'complex';
    arraysCount: number;
    objectsCount: number;
    possibleHeaders?: string[];
  } {
    let type = 'unknown';
    let depth = 0;
    let arraysCount = 0;
    let objectsCount = 0;
    let possibleHeaders: string[] = [];
    
    const analyzeRecursive = (obj: any, currentDepth: number = 0): void => {
      depth = Math.max(depth, currentDepth);
      
      if (Array.isArray(obj)) {
        arraysCount++;
        type = type === 'unknown' ? 'array' : 'mixed';
        
        // Анализируем элементы массива
        obj.forEach(item => {
          if (typeof item === 'object' && item !== null) {
            analyzeRecursive(item, currentDepth + 1);
          }
        });
        
        // Если массив объектов, извлекаем заголовки из первого элемента
        if (obj.length > 0 && typeof obj[0] === 'object' && obj[0] !== null && !Array.isArray(obj[0])) {
          possibleHeaders = Object.keys(obj[0]);
        }
      } else if (typeof obj === 'object' && obj !== null) {
        objectsCount++;
        type = type === 'unknown' ? 'object' : 'mixed';
        
        // Если это первый объект и у нас нет заголовков, используем его ключи
        if (possibleHeaders.length === 0) {
          possibleHeaders = Object.keys(obj);
        }
        
        Object.values(obj).forEach(value => {
          if (typeof value === 'object' && value !== null) {
            analyzeRecursive(value, currentDepth + 1);
          }
        });
      }
    };
    
    analyzeRecursive(data);
    
    // Определяем сложность
    let complexity: 'simple' | 'medium' | 'complex';
    if (depth <= 1 && (arraysCount + objectsCount) <= 2) {
      complexity = 'simple';
    } else if (depth <= 3 && (arraysCount + objectsCount) <= 10) {
      complexity = 'medium';
    } else {
      complexity = 'complex';
    }
    
    return {
      type,
      depth,
      complexity,
      arraysCount,
      objectsCount,
      possibleHeaders: possibleHeaders.length > 0 ? possibleHeaders : undefined
    };
  }

  /**
   * Конвертирует буфер из CP1251 в UTF-8 (упрощенная версия)
   */
  private convertFromCp1251(buffer: Buffer): string {
    const cp1251Map: { [key: number]: string } = {
      192: 'А', 193: 'Б', 194: 'В', 195: 'Г', 196: 'Д', 197: 'Е', 198: 'Ж', 199: 'З',
      200: 'И', 201: 'Й', 202: 'К', 203: 'Л', 204: 'М', 205: 'Н', 206: 'О', 207: 'П',
      208: 'Р', 209: 'С', 210: 'Т', 211: 'У', 212: 'Ф', 213: 'Х', 214: 'Ц', 215: 'Ч',
      216: 'Ш', 217: 'Щ', 218: 'Ъ', 219: 'Ы', 220: 'Ь', 221: 'Э', 222: 'Ю', 223: 'Я',
      224: 'а', 225: 'б', 226: 'в', 227: 'г', 228: 'д', 229: 'е', 230: 'ж', 231: 'з',
      232: 'и', 233: 'й', 234: 'к', 235: 'л', 236: 'м', 237: 'н', 238: 'о', 239: 'п',
      240: 'р', 241: 'с', 242: 'т', 243: 'у', 244: 'ф', 245: 'х', 246: 'ц', 247: 'ч',
      248: 'ш', 249: 'щ', 250: 'ъ', 251: 'ы', 252: 'ь', 253: 'э', 254: 'ю', 255: 'я',
      168: 'Ё', 184: 'ё'
    };
    
    let result = '';
    for (let i = 0; i < buffer.length; i++) {
      const byte = buffer[i];
      if (cp1251Map[byte]) {
        result += cp1251Map[byte];
      } else {
        result += String.fromCharCode(byte);
      }
    }
    
    return result;
  }

  /**
   * Рассчитывает уверенность парсинга JSON
   */
  private calculateConfidence(
    extractedData: any, 
    totalRows: number, 
    dataQuality: 'high' | 'medium' | 'low',
    complexity: 'simple' | 'medium' | 'complex'
  ): number {
    let confidence = 0.6; // Базовая уверенность для структурного формата
    
    // Бонус за качество данных
    switch (dataQuality) {
      case 'high': confidence += 0.3; break;
      case 'medium': confidence += 0.2; break;
      case 'low': confidence += 0.1; break;
    }
    
    // Бонус/штраф за сложность структуры
    switch (complexity) {
      case 'simple': confidence += 0.1; break;
      case 'medium': confidence += 0.05; break;
      case 'complex': confidence -= 0.05; break;
    }
    
    // Бонус за найденные единицы
    const unitsCount = extractedData.russian_units_found.length;
    confidence += Math.min(unitsCount * 0.02, 0.25);
    
    // Бонус за количество строк
    if (totalRows > 5) confidence += 0.05;
    if (totalRows > 20) confidence += 0.05;
    
    return Math.min(confidence, 0.99);
  }

  /**
   * Проверяет, является ли файл JSON форматом
   */
  canParse(filename: string, mimeType?: string): boolean {
    const extension = filename.toLowerCase().split('.').pop();
    
    if (extension && this.supportedFormats.includes(extension)) {
      return true;
    }
    
    // Дополнительная проверка по MIME типу
    if (mimeType) {
      const jsonMimeTypes = [
        'application/json',
        'text/json',
        'application/x-json'
      ];
      
      return jsonMimeTypes.includes(mimeType);
    }
    
    return false;
  }
}