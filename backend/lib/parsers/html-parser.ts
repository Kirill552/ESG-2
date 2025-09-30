/**
 * HTML парсер для извлечения российских единиц измерения
 * Использует node-html-parser для обработки HTML документов
 */

import { parse, HTMLElement } from 'node-html-parser';
import {
  BaseParser,
  ParsedDocumentData,
  ParseOptions,
  ParserResult,
  RussianUnitsHelper
} from './base-parser';

export class HtmlParser extends BaseParser {
  protected readonly supportedFormats = ['html', 'htm'];

  /**
   * Парсит HTML файл и извлекает российские единицы измерения
   */
  async parse(buffer: Buffer, options: ParseOptions = {}): Promise<ParserResult> {
    const startTime = Date.now();

    try {
      console.log(`🌐 HTML Parser: starting parse (${buffer.length} bytes)`);

      // Определяем кодировку
      const encoding = options.encoding === 'auto' || !options.encoding
        ? this.detectEncoding(buffer)
        : options.encoding;

      console.log(`🔤 HTML Parser: detected encoding ${encoding}`);

      // Конвертируем буфер в текст
      let htmlContent: string;
      if (encoding === 'cp1251') {
        htmlContent = this.convertFromCp1251(buffer);
      } else {
        htmlContent = buffer.toString(encoding === 'cp866' ? 'binary' : 'utf8');
      }

      // Парсим HTML
      const root = parse(htmlContent, {
        blockTextElements: {
          script: false,
          noscript: false,
          style: false,
          pre: true,
        }
      });

      // Удаляем скрипты и стили
      root.querySelectorAll('script, style, noscript').forEach(element => {
        element.remove();
      });

      // Извлекаем текст из HTML
      const textLines = this.extractTextFromHtml(root);
      console.log(`🌐 HTML Parser: extracted ${textLines.length} text lines`);

      if (textLines.length === 0) {
        return {
          success: false,
          error: 'No text content found in HTML',
          processingTime: Date.now() - startTime
        };
      }

      // Извлекаем данные по российским единицам
      const extractedUnitsData = this.extractRussianUnitsData(textLines);

      // Оцениваем качество данных
      const dataQuality = RussianUnitsHelper.assessDataQuality(
        extractedUnitsData.russian_units_found,
        textLines.length
      );

      const confidence = this.calculateConfidence(
        extractedUnitsData,
        textLines.length,
        dataQuality
      );

      const result: ParsedDocumentData = {
        documentType: 'txt', // HTML рассматриваем как текстовый документ
        confidence,
        extractedData: {
          ...extractedUnitsData,
          raw_rows: options.maxRows ? textLines.slice(0, options.maxRows) : textLines,
          total_rows: textLines.length
        },
        metadata: {
          encoding,
          format_detected: 'HTML',
          processing_time_ms: Date.now() - startTime,
          russian_units_found: extractedUnitsData.russian_units_found,
          data_quality: dataQuality
        }
      };

      console.log(`✅ HTML Parser: success! Found ${extractedUnitsData.russian_units_found.length} units, quality: ${dataQuality}`);

      return {
        success: true,
        data: result,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      console.error('❌ HTML Parser failed:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Извлекает текст из HTML элементов
   */
  private extractTextFromHtml(root: HTMLElement): string[] {
    const textLines: string[] = [];

    // Извлекаем текст из таблиц (приоритет)
    const tables = root.querySelectorAll('table');
    tables.forEach(table => {
      const rows = table.querySelectorAll('tr');
      rows.forEach(row => {
        const cells = row.querySelectorAll('td, th');
        const cellTexts: string[] = [];
        cells.forEach(cell => {
          const text = this.cleanText(cell.text);
          if (text) cellTexts.push(text);
        });
        if (cellTexts.length > 0) {
          textLines.push(cellTexts.join(' | '));
        }
      });
    });

    // Удаляем таблицы чтобы не дублировать текст
    tables.forEach(table => table.remove());

    // Извлекаем остальной текст
    const textContent = root.text;
    const lines = textContent
      .split(/\n+/)
      .map(line => this.cleanText(line))
      .filter(line => line.length > 5); // Игнорируем слишком короткие строки

    textLines.push(...lines);

    return textLines;
  }

  /**
   * Рассчитывает уверенность парсинга HTML
   */
  private calculateConfidence(
    extractedData: any,
    totalRows: number,
    dataQuality: 'high' | 'medium' | 'low'
  ): number {
    let confidence = 0.5; // Базовая уверенность для HTML

    // Бонус за качество данных
    switch (dataQuality) {
      case 'high': confidence += 0.3; break;
      case 'medium': confidence += 0.2; break;
      case 'low': confidence += 0.1; break;
    }

    // Бонус за найденные единицы
    const unitsCount = extractedData.russian_units_found.length;
    confidence += Math.min(unitsCount * 0.02, 0.2);

    // Бонус за количество строк
    if (totalRows > 20) confidence += 0.1;
    if (totalRows > 100) confidence += 0.1;

    return Math.min(confidence, 0.9);
  }

  /**
   * Очищает текст от лишних символов
   */
  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/[\u00A0\u2000-\u200B\u2028\u2029]/g, ' ')
      .trim();
  }

  /**
   * Конвертирует буфер из CP1251 в UTF-8
   */
  private convertFromCp1251(buffer: Buffer): string {
    // Простая реализация для основных русских символов
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
   * Проверяет, является ли файл HTML форматом
   */
  canParse(filename: string, mimeType?: string): boolean {
    const extension = filename.toLowerCase().split('.').pop();

    if (extension && this.supportedFormats.includes(extension)) {
      return true;
    }

    // Дополнительная проверка по MIME типу
    if (mimeType) {
      const htmlMimeTypes = [
        'text/html',
        'application/xhtml+xml',
        'text/xhtml'
      ];

      return htmlMimeTypes.includes(mimeType);
    }

    return false;
  }
}