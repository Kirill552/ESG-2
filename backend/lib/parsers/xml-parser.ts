/**
 * XML Parser для извлечения данных из XML файлов
 * Использует fast-xml-parser для парсинга XML в JavaScript объекты
 */

import { BaseParser, ParseOptions, ParserResult } from './base-parser';
import { XMLParser, XMLValidator } from 'fast-xml-parser';

export class XmlParser extends BaseParser {
  readonly name = 'XmlParser';
  readonly supportedFormats = ['xml'];

  async parse(buffer: Buffer, options?: ParseOptions): Promise<ParserResult> {
    const startTime = Date.now();

    try {
      console.log(`🔍 XmlParser: parsing XML file (${buffer.length} bytes)`);

      // Конвертируем buffer в строку
      const xmlContent = buffer.toString('utf-8');

      // Валидация XML перед парсингом
      const validationResult = XMLValidator.validate(xmlContent, {
        allowBooleanAttributes: true
      });

      if (validationResult !== true) {
        return {
          success: false,
          error: `Invalid XML: ${validationResult.err.msg} at line ${validationResult.err.line}`,
          processingTime: Date.now() - startTime
        };
      }

      // Настройки парсера
      const parserOptions = {
        ignoreAttributes: false, // Сохраняем атрибуты
        attributeNamePrefix: '@_', // Префикс для атрибутов
        textNodeName: '#text', // Имя для текстовых узлов
        parseAttributeValue: true, // Парсим значения атрибутов (числа, булевы)
        parseTagValue: true, // Парсим значения тегов
        trimValues: true, // Удаляем пробелы
        ignoreDeclaration: false, // Сохраняем XML декларацию
        ignorePiTags: false, // Сохраняем processing instructions
        arrayMode: false, // Не форсируем массивы для всех тегов
        cdataPropName: '__cdata' // Имя для CDATA секций
      };

      const parser = new XMLParser(parserOptions);
      const parsedData = parser.parse(xmlContent);

      // Извлекаем текстовое содержимое для OCR-like processing
      const extractedText = this.extractTextFromXml(parsedData);

      // Ищем данные о транспорте, топливе, энергии
      const extractedData = this.extractEnergyData(parsedData, extractedText);

      // Определяем качество данных
      const dataQuality = this.assessDataQuality(extractedData, extractedText);

      // Находим российские единицы измерения
      const russianUnits = this.findRussianUnits(extractedText);

      // Вычисляем confidence на основе найденных данных
      let confidence = 0.5; // Базовый confidence для структурированного XML

      if (russianUnits.length > 0) confidence += 0.2;
      if (extractedData.fuel_data && extractedData.fuel_data.length > 0) confidence += 0.15;
      if (extractedData.electricity_data && extractedData.electricity_data.length > 0) confidence += 0.15;

      confidence = Math.min(confidence, 1.0);

      const processingTime = Date.now() - startTime;

      console.log(`✅ XmlParser: extracted ${extractedText.length} chars, confidence: ${confidence.toFixed(2)}`);

      return {
        success: true,
        data: {
          text: extractedText,
          extractedData,
          confidence,
          metadata: {
            parser_used: this.name,
            processing_time_ms: processingTime,
            file_size_bytes: buffer.length,
            data_quality: dataQuality,
            russian_units_found: russianUnits,
            xml_structure: this.describeXmlStructure(parsedData)
          }
        },
        processingTime
      };

    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      console.error('❌ XmlParser error:', error.message);

      return {
        success: false,
        error: `XML parsing failed: ${error.message}`,
        processingTime
      };
    }
  }

  /**
   * Рекурсивно извлекает весь текстовый контент из XML объекта
   */
  private extractTextFromXml(obj: any, depth: number = 0): string {
    if (depth > 50) return ''; // Защита от слишком глубокой рекурсии

    let text = '';

    if (typeof obj === 'string' || typeof obj === 'number') {
      return String(obj) + ' ';
    }

    if (Array.isArray(obj)) {
      for (const item of obj) {
        text += this.extractTextFromXml(item, depth + 1);
      }
      return text;
    }

    if (typeof obj === 'object' && obj !== null) {
      for (const key of Object.keys(obj)) {
        // Пропускаем технические поля fast-xml-parser
        if (key.startsWith('@_') || key === '?xml' || key === '__cdata') {
          continue;
        }

        const value = obj[key];

        // Добавляем имя тега как контекст
        if (key !== '#text') {
          text += key + ': ';
        }

        text += this.extractTextFromXml(value, depth + 1);
      }
    }

    return text;
  }

  /**
   * Извлекает данные о топливе, электричестве, транспорте из XML
   */
  private extractEnergyData(parsedData: any, fullText: string): any {
    const result: any = {
      fuel_data: [],
      electricity_data: [],
      gas_data: [],
      transport_data: []
    };

    // Рекурсивный поиск энергетических данных в структуре XML
    this.searchForEnergyData(parsedData, result);

    // Дополнительный текстовый поиск если структурный не дал результатов
    if (result.fuel_data.length === 0 && result.electricity_data.length === 0) {
      this.extractFromText(fullText, result);
    }

    // Подсчет общего количества строк данных
    result.total_rows =
      result.fuel_data.length +
      result.electricity_data.length +
      result.gas_data.length +
      result.transport_data.length;

    return result;
  }

  /**
   * Рекурсивно ищет данные в XML структуре
   */
  private searchForEnergyData(obj: any, result: any, depth: number = 0): void {
    if (depth > 30) return; // Защита от слишком глубокой рекурсии

    if (Array.isArray(obj)) {
      for (const item of obj) {
        this.searchForEnergyData(item, result, depth + 1);
      }
      return;
    }

    if (typeof obj !== 'object' || obj === null) return;

    // Ищем ключи связанные с топливом
    const fuelKeys = ['fuel', 'топливо', 'бензин', 'дизель', 'gasoline', 'diesel'];
    const electricityKeys = ['electricity', 'электричество', 'квтч', 'kwh', 'power'];
    const gasKeys = ['gas', 'газ', 'метан', 'природный'];

    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();

      // Проверяем ключ на совпадение с категориями
      if (fuelKeys.some(k => lowerKey.includes(k))) {
        if (typeof value === 'object' && value !== null) {
          result.fuel_data.push(value);
        }
      } else if (electricityKeys.some(k => lowerKey.includes(k))) {
        if (typeof value === 'object' && value !== null) {
          result.electricity_data.push(value);
        }
      } else if (gasKeys.some(k => lowerKey.includes(k))) {
        if (typeof value === 'object' && value !== null) {
          result.gas_data.push(value);
        }
      }

      // Продолжаем рекурсивный поиск
      this.searchForEnergyData(value, result, depth + 1);
    }
  }

  /**
   * Извлекает данные из текста с помощью регулярных выражений
   */
  private extractFromText(text: string, result: any): void {
    // Поиск данных о топливе (л, т, м³)
    const fuelPattern = /(бензин|дизель|топливо|керосин).*?(\d+[.,]?\d*)\s*(л|литр|т|тонн|м³)/gi;
    let match;

    while ((match = fuelPattern.exec(text)) !== null) {
      result.fuel_data.push({
        type: match[1],
        value: parseFloat(match[2].replace(',', '.')),
        unit: match[3]
      });
    }

    // Поиск данных об электричестве (кВт·ч, МВт·ч)
    const electricityPattern = /(\d+[.,]?\d*)\s*(квт.*?ч|мвт.*?ч|kwh|mwh)/gi;

    while ((match = electricityPattern.exec(text)) !== null) {
      result.electricity_data.push({
        value: parseFloat(match[1].replace(',', '.')),
        unit: match[2]
      });
    }

    // Поиск данных о газе (м³, тыс. м³)
    const gasPattern = /(газ|метан).*?(\d+[.,]?\d*)\s*(м³|тыс\.?\s*м³)/gi;

    while ((match = gasPattern.exec(text)) !== null) {
      result.gas_data.push({
        type: match[1],
        value: parseFloat(match[2].replace(',', '.')),
        unit: match[3]
      });
    }
  }

  /**
   * Описывает структуру XML для метаданных
   */
  private describeXmlStructure(parsedData: any): string {
    const rootKeys = Object.keys(parsedData);
    const rootElement = rootKeys.find(k => !k.startsWith('@_') && k !== '?xml') || rootKeys[0];

    if (!rootElement) return 'Empty XML';

    const elementCount = this.countElements(parsedData[rootElement]);
    return `Root: ${rootElement}, Elements: ${elementCount}`;
  }

  /**
   * Подсчитывает количество элементов в XML объекте
   */
  private countElements(obj: any, depth: number = 0): number {
    if (depth > 20) return 0;

    if (Array.isArray(obj)) {
      return obj.reduce((sum, item) => sum + this.countElements(item, depth + 1), 0);
    }

    if (typeof obj === 'object' && obj !== null) {
      return 1 + Object.values(obj).reduce(
        (sum, value) => sum + this.countElements(value, depth + 1),
        0
      );
    }

    return 0;
  }

  /**
   * Оценивает качество извлеченных данных
   */
  private assessDataQuality(extractedData: any, text: string): 'high' | 'medium' | 'low' {
    const totalRows = extractedData.total_rows || 0;
    const textLength = text.length;

    if (totalRows > 5 && textLength > 500) return 'high';
    if (totalRows > 0 || textLength > 200) return 'medium';
    return 'low';
  }

  /**
   * Находит российские единицы измерения в тексте
   */
  private findRussianUnits(text: string): string[] {
    const units = new Set<string>();
    const unitPatterns = [
      /\bл\b/gi,          // литры
      /\bт\b/gi,          // тонны
      /\bм³\b/gi,         // кубические метры
      /\bкВт·ч\b/gi,      // киловатт-час
      /\bМВт·ч\b/gi,      // мегаватт-час
      /\bГкал\b/gi,       // гигакалории
      /\bкг\b/gi,         // килограммы
      /тыс\.\s*м³/gi      // тысячи кубометров
    ];

    for (const pattern of unitPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(m => units.add(m));
      }
    }

    return Array.from(units);
  }
}
