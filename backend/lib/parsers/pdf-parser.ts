/**
 * PDF парсер для извлечения российских единиц измерения
 * Использует pdf-parse для обработки PDF документов
 */

import pdfParse from 'pdf-parse';
import {
  BaseParser,
  ParsedDocumentData,
  ParseOptions,
  ParserResult,
  RussianUnitsHelper
} from './base-parser';

export class PdfParser extends BaseParser {
  protected readonly supportedFormats = ['pdf'];

  /**
   * Парсит PDF файл и извлекает российские единицы измерения
   */
  async parse(buffer: Buffer, options: ParseOptions = {}): Promise<ParserResult> {
    const startTime = Date.now();

    try {
      console.log(`📄 PDF Parser: starting parse (${buffer.length} bytes)`);

      // Парсим PDF
      const pdfData = await pdfParse(buffer, {
        max: options.maxRows || 100, // Ограничиваем количество страниц для производительности
        version: 'v1.10.100', // Используем стабильную версию
      });

      console.log(`📊 PDF содержит ${pdfData.numpages} страниц, ${pdfData.text.length} символов`);

      if (!pdfData.text || pdfData.text.trim().length === 0) {
        return {
          success: false,
          error: 'No text content found in PDF',
          processingTime: Date.now() - startTime
        };
      }

      // Разбиваем текст на строки для обработки
      const lines = pdfData.text
        .split(/\n+/)
        .map(line => line.trim())
        .filter(line => line.length > 0);

      console.log(`📄 PDF Parser: extracted ${lines.length} text lines`);

      // Извлекаем данные по российским единицам
      const extractedUnitsData = this.extractRussianUnitsData(lines);

      // Оцениваем качество данных
      const dataQuality = RussianUnitsHelper.assessDataQuality(
        extractedUnitsData.russian_units_found,
        lines.length
      );

      const confidence = this.calculateConfidence(
        extractedUnitsData,
        lines.length,
        dataQuality,
        pdfData.numpages
      );

      const result: ParsedDocumentData = {
        documentType: 'txt', // PDF рассматриваем как текстовый документ
        confidence,
        extractedData: {
          ...extractedUnitsData,
          raw_rows: options.maxRows ? lines.slice(0, options.maxRows) : lines,
          total_rows: lines.length
        },
        metadata: {
          format_detected: `PDF (${pdfData.numpages} pages)`,
          processing_time_ms: Date.now() - startTime,
          russian_units_found: extractedUnitsData.russian_units_found,
          data_quality: dataQuality
        }
      };

      console.log(`✅ PDF Parser: success! Found ${extractedUnitsData.russian_units_found.length} units, quality: ${dataQuality}`);

      return {
        success: true,
        data: result,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      console.error('❌ PDF Parser failed:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Рассчитывает уверенность парсинга PDF
   */
  private calculateConfidence(
    extractedData: any,
    totalRows: number,
    dataQuality: 'high' | 'medium' | 'low',
    totalPages: number
  ): number {
    let confidence = 0.4; // Базовая уверенность для PDF (ниже чем у структурированных форматов)

    // Бонус за качество данных
    switch (dataQuality) {
      case 'high': confidence += 0.4; break;
      case 'medium': confidence += 0.2; break;
      case 'low': confidence += 0.1; break;
    }

    // Бонус за найденные единицы
    const unitsCount = extractedData.russian_units_found.length;
    confidence += Math.min(unitsCount * 0.02, 0.3);

    // Бонус за количество строк и страниц
    if (totalRows > 50) confidence += 0.1;
    if (totalPages > 1) confidence += 0.05;

    return Math.min(confidence, 0.95); // PDF редко даёт максимальную уверенность
  }

  /**
   * Проверяет, является ли файл PDF форматом
   */
  canParse(filename: string, mimeType?: string): boolean {
    const extension = filename.toLowerCase().split('.').pop();

    if (extension && this.supportedFormats.includes(extension)) {
      return true;
    }

    // Дополнительная проверка по MIME типу
    if (mimeType) {
      const pdfMimeTypes = [
        'application/pdf',
        'application/x-pdf'
      ];

      return pdfMimeTypes.includes(mimeType);
    }

    return false;
  }
}