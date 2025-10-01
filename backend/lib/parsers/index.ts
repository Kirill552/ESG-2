/**
 * Индексный файл для всех структурных парсеров
 * Экспортирует все парсеры и утилиты для удобного импорта
 */

// Базовые типы и интерфейсы
export * from './base-parser';

// Конкретные парсеры
export { CsvTsvParser } from './csv-parser';
export { ExcelParser } from './excel-parser';
export { JsonParser } from './json-parser';
export { TxtParser } from './txt-parser';
export { HtmlParser } from './html-parser';
export { OfficeDocumentParser } from './office-parser';
export { PdfParser } from './pdf-parser';
export { RtfParser } from './rtf-parser';
export { XmlParser } from './xml-parser';

// Детектор формата
export { FormatDetector } from '../format-detector';

// Фабрика парсеров
import { BaseParser, ParseOptions, ParserResult } from './base-parser';
import { CsvTsvParser } from './csv-parser';
import { ExcelParser } from './excel-parser';
import { JsonParser } from './json-parser';
import { TxtParser } from './txt-parser';
import { HtmlParser } from './html-parser';
import { OfficeDocumentParser } from './office-parser';
import { PdfParser } from './pdf-parser';
import { RtfParser } from './rtf-parser';
import { XmlParser } from './xml-parser';
import { FormatDetector, FileFormatInfo } from '../format-detector';

/**
 * Фабрика для создания парсеров по типу файла
 */
export class ParserFactory {
  private static parsers = new Map<string, typeof BaseParser>([
    ['csv', CsvTsvParser],
    ['tsv', CsvTsvParser],
    ['excel', ExcelParser],
    ['json', JsonParser],
    ['txt', TxtParser],
    ['html', HtmlParser],
    ['docx', OfficeDocumentParser],
    ['doc', OfficeDocumentParser],
    ['xlsx', OfficeDocumentParser],
    ['xls', OfficeDocumentParser],
    ['pptx', OfficeDocumentParser],
    ['ppt', OfficeDocumentParser],
    ['odt', OfficeDocumentParser],
    ['odp', OfficeDocumentParser],
    ['ods', OfficeDocumentParser],
    ['rtf', RtfParser],
    ['pdf', PdfParser],
    ['xml', XmlParser]
  ]);

  /**
   * Создает парсер для указанного формата
   */
  static createParser(format: string): BaseParser | null {
    const ParserClass = this.parsers.get(format);
    return ParserClass ? new ParserClass() : null;
  }

  /**
   * Автоматически определяет формат и создает подходящий парсер
   */
  static createParserForFile(
    filename: string,
    buffer: Buffer,
    mimeType?: string
  ): { parser: BaseParser | null; formatInfo: FileFormatInfo } {
    const formatInfo = FormatDetector.detectFormat(filename, buffer, mimeType);
    const parser = this.createParser(formatInfo.format);
    
    return { parser, formatInfo };
  }

  /**
   * Парсит файл, автоматически определив его формат
   */
  static async parseFile(
    filename: string,
    buffer: Buffer,
    mimeType?: string,
    options?: ParseOptions
  ): Promise<{
    result: ParserResult;
    formatInfo: FileFormatInfo;
    parserUsed: string | null;
  }> {
    const { parser, formatInfo } = this.createParserForFile(filename, buffer, mimeType);
    
    if (!parser) {
      return {
        result: {
          success: false,
          error: `No parser available for format: ${formatInfo.format}`,
          processingTime: 0
        },
        formatInfo,
        parserUsed: null
      };
    }

    console.log(`📋 ParserFactory: using ${parser.constructor.name} for ${formatInfo.format} file`);
    
    const result = await parser.parse(buffer, options);
    
    return {
      result,
      formatInfo,
      parserUsed: parser.constructor.name
    };
  }

  /**
   * Получает список поддерживаемых форматов
   */
  static getSupportedFormats(): string[] {
    return Array.from(this.parsers.keys());
  }

  /**
   * Проверяет, поддерживается ли формат
   */
  static isFormatSupported(format: string): boolean {
    return this.parsers.has(format);
  }

  /**
   * Регистрирует новый парсер
   */
  static registerParser(format: string, parserClass: typeof BaseParser): void {
    this.parsers.set(format, parserClass);
    console.log(`📋 ParserFactory: registered parser for ${format} format`);
  }
}

/**
 * Утилиты для работы с парсерами
 */
export class ParserUtils {
  /**
   * Проверяет качество извлеченных данных
   */
  static assessExtractionQuality(result: ParserResult): {
    quality: 'excellent' | 'good' | 'fair' | 'poor';
    score: number;
    recommendations: string[];
  } {
    if (!result.success || !result.data) {
      return {
        quality: 'poor',
        score: 0,
        recommendations: ['Парсинг не удался, проверьте формат файла']
      };
    }

    const data = result.data;
    const recommendations: string[] = [];
    let score = 0;

    // Базовая оценка по confidence
    score += data.confidence * 50;

    // Бонус за найденные российские единицы
    const unitsCount = data.metadata.russian_units_found.length;
    if (unitsCount > 0) {
      score += Math.min(unitsCount * 5, 25);
    } else {
      recommendations.push('Не найдены российские единицы измерения');
    }

    // Бонус за качество данных
    switch (data.metadata.data_quality) {
      case 'high': score += 20; break;
      case 'medium': score += 10; break;
      case 'low': 
        score += 5; 
        recommendations.push('Низкое качество данных - проверьте структуру файла');
        break;
    }

    // Штраф за низкое время обработки (может указывать на ошибки)
    if (data.metadata.processing_time_ms < 10) {
      score -= 10;
      recommendations.push('Подозрительно быстрая обработка - возможны ошибки');
    }

    // Определяем качество
    let quality: 'excellent' | 'good' | 'fair' | 'poor';
    if (score >= 80) {
      quality = 'excellent';
    } else if (score >= 60) {
      quality = 'good';
    } else if (score >= 40) {
      quality = 'fair';
      recommendations.push('Рассмотрите использование другого формата файла');
    } else {
      quality = 'poor';
      recommendations.push('Файл может быть поврежден или иметь неподдерживаемую структуру');
    }

    return { quality, score: Math.min(score, 100), recommendations };
  }

  /**
   * Извлекает ключевые метрики из результата парсинга
   */
  static extractMetrics(result: ParserResult): {
    totalRows: number;
    unitsFound: number;
    dataQuality: string;
    processingTime: number;
    confidence: number;
    extractedTypes: string[];
  } {
    if (!result.success || !result.data) {
      return {
        totalRows: 0,
        unitsFound: 0,
        dataQuality: 'unknown',
        processingTime: result.processingTime,
        confidence: 0,
        extractedTypes: []
      };
    }

    const data = result.data;
    const extractedTypes: string[] = [];

    // Определяем типы найденных данных
    if (data.extractedData.fuel_data && data.extractedData.fuel_data.length > 0) {
      extractedTypes.push('fuel');
    }
    if (data.extractedData.electricity_data && data.extractedData.electricity_data.length > 0) {
      extractedTypes.push('electricity');
    }
    if (data.extractedData.gas_data && data.extractedData.gas_data.length > 0) {
      extractedTypes.push('gas');
    }
    if (data.extractedData.transport_data && data.extractedData.transport_data.length > 0) {
      extractedTypes.push('transport');
    }

    return {
      totalRows: data.extractedData.total_rows || 0,
      unitsFound: data.metadata.russian_units_found.length,
      dataQuality: data.metadata.data_quality,
      processingTime: data.metadata.processing_time_ms,
      confidence: Math.round(data.confidence * 100),
      extractedTypes
    };
  }
}