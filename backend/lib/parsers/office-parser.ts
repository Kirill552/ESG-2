/**
 * Современный парсер офисных документов (2025)
 * Использует OfficeParser для DOCX, PPTX, XLSX, ODT, ODP, ODS файлов
 */

import * as fs from 'fs/promises';
import * as officeParser from 'officeparser';
import { BaseParser, ParsedDocument, ParsedRow, DataQuality } from './base-parser';

export interface OfficeParserOptions {
  newlineDelimiter?: string;
  ignoreNotes?: boolean;
  putNotesAtLast?: boolean;
  outputErrorToConsole?: boolean;
  extractMetadata?: boolean;
  splitByParagraphs?: boolean;
}

interface OfficeParserConfig {
  newlineDelimiter?: string;
  ignoreNotes?: boolean;
  putNotesAtLast?: boolean;
  outputErrorToConsole?: boolean;
}

export class OfficeDocumentParser extends BaseParser {
  private readonly options: Required<OfficeParserOptions>;
  
  // Поддерживаемые форматы (согласно актуальной документации OfficeParser)
  private readonly supportedFormats = [
    '.docx', '.doc', '.pptx', '.ppt', '.xlsx', '.xls',
    '.odt', '.odp', '.ods', '.pdf'
  ];

  constructor(options: OfficeParserOptions = {}) {
    super();
    this.options = {
      newlineDelimiter: options.newlineDelimiter || '\n',
      ignoreNotes: options.ignoreNotes ?? false,
      putNotesAtLast: options.putNotesAtLast ?? false,
      outputErrorToConsole: options.outputErrorToConsole ?? false,
      extractMetadata: options.extractMetadata ?? true,
      splitByParagraphs: options.splitByParagraphs ?? true,
    };
  }

  async parseFile(filePath: string): Promise<ParsedDocument> {
    const startTime = Date.now();
    
    try {
      console.log(`📄 Office Parser: обработка файла ${filePath}`);
      
      // Проверяем поддержку формата
      const format = this.detectFormat(filePath);
      if (!this.isFormatSupported(format)) {
        throw new Error(`Формат ${format} не поддерживается`);
      }
      
      // Читаем файл как буфер для лучшей производительности
      const fileBuffer = await fs.readFile(filePath);
      
      // Конфигурация для OfficeParser
      const config: OfficeParserConfig = {
        newlineDelimiter: this.options.newlineDelimiter,
        ignoreNotes: this.options.ignoreNotes,
        putNotesAtLast: this.options.putNotesAtLast,
        outputErrorToConsole: this.options.outputErrorToConsole
      };
      
      // Парсим документ
      const extractedText = await this.parseOfficeDocument(fileBuffer, config);
      
      // Обрабатываем извлеченный текст
      const result = this.processExtractedText(extractedText, format);
      
      const processingTime = Date.now() - startTime;
      console.log(`✅ Office Parser: файл обработан за ${processingTime}ms`);
      
      return {
        ...result,
        metadata: {
          ...result.metadata,
          format,
          processingTime,
          parser: 'OfficeDocumentParser',
          fileSize: fileBuffer.length
        }
      };
      
    } catch (error) {
      console.error(`❌ Office Parser: ошибка обработки файла ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Парсит офисный документ с помощью OfficeParser
   */
  private async parseOfficeDocument(fileBuffer: Buffer, config: OfficeParserConfig): Promise<string> {
    try {
      // Используем parseOfficeAsync с буфером файла
      const extractedText = await officeParser.parseOfficeAsync(fileBuffer, config);
      
      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error('Не удалось извлечь текст из документа');
      }
      
      return extractedText;
      
    } catch (error) {
      console.error('❌ OfficeParser: ошибка парсинга документа:', error);
      throw new Error(`Ошибка парсинга документа: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Обрабатывает извлеченный текст
   */
  private processExtractedText(text: string, format: string): ParsedDocument {
    const rows: ParsedRow[] = [];
    
    // Разбиваем текст на части
    const sections = this.options.splitByParagraphs 
      ? this.splitByParagraphs(text)
      : this.splitByLines(text);
    
    // Обрабатываем каждую секцию
    sections.forEach((section, index) => {
      const cleanSection = this.cleanText(section);
      
      if (cleanSection.length > 10) { // Игнорируем слишком короткие секции
        const extractedData = this.extractDataFromText(cleanSection);
        
        if (extractedData.hasData || cleanSection.length > 50) {
          rows.push({
            index: index + 1,
            content: cleanSection,
            extractedData: extractedData.data,
            confidence: extractedData.hasData ? extractedData.confidence : 0.3,
            metadata: {
              source: 'document',
              sectionType: this.detectSectionType(cleanSection),
              wordCount: cleanSection.split(/\s+/).length
            }
          });
        }
      }
    });
    
    const quality = this.assessDataQuality(rows, format);
    
    return {
      success: true,
      data: rows,
      metadata: {
        format,
        totalSections: sections.length,
        dataSections: rows.filter(r => Object.keys(r.extractedData || {}).length > 0).length,
        quality: quality.quality,
        confidence: quality.confidence,
        extractedTypes: this.getExtractedTypes(rows),
        documentStats: this.calculateDocumentStats(text, rows)
      }
    };
  }

  /**
   * Разбивает текст на параграфы
   */
  private splitByParagraphs(text: string): string[] {
    // Разбиваем по двойным переводам строк или специальным разделителям
    return text
      .split(/\n\s*\n|\r\n\s*\r\n/)
      .map(p => p.trim())
      .filter(p => p.length > 0);
  }

  /**
   * Разбивает текст на строки
   */
  private splitByLines(text: string): string[] {
    return text
      .split(/\n|\r\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0);
  }

  /**
   * Очищает текст от лишних символов
   */
  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/[\u00A0\u2000-\u200B\u2028\u2029]/g, ' ')
      .replace(/[^\w\s\.\,\:\;\!\?\-\(\)\[\]\"\'№\/\\\+\=\*\%\@\#\$\^\&]/g, ' ')
      .trim();
  }

  /**
   * Определяет тип секции документа
   */
  private detectSectionType(text: string): string {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('заголовок') || /^[А-ЯA-Z\s]{3,50}$/.test(text)) {
      return 'heading';
    } else if (lowerText.includes('таблица') || /\|\s*\w+\s*\|/.test(text)) {
      return 'table';
    } else if (lowerText.includes('список') || /^\s*[\d\-\*]/.test(text)) {
      return 'list';
    } else if (text.split(/\s+/).length > 20) {
      return 'paragraph';
    } else {
      return 'fragment';
    }
  }

  /**
   * Извлекает данные из текста
   */
  private extractDataFromText(text: string): {
    hasData: boolean;
    data: any;
    confidence: number;
  } {
    const patterns = this.getEnergyPatterns();
    const extracted: any = {};
    let confidence = 0;
    let hasData = false;

    for (const [category, categoryPatterns] of Object.entries(patterns)) {
      for (const pattern of categoryPatterns) {
        const matches = text.match(pattern.regex);
        if (matches) {
          if (!extracted[category]) {
            extracted[category] = [];
          }
          
          const value = this.extractValue(matches, pattern);
          if (value) {
            extracted[category].push({
              value: value.amount,
              unit: value.unit,
              text: matches[0],
              confidence: pattern.confidence,
              context: this.getContext(text, matches[0])
            });
            
            confidence = Math.max(confidence, pattern.confidence);
            hasData = true;
          }
        }
      }
    }

    return { hasData, data: extracted, confidence };
  }

  /**
   * Получает контекст вокруг найденного значения
   */
  private getContext(text: string, match: string, contextLength: number = 50): string {
    const index = text.indexOf(match);
    if (index === -1) return '';
    
    const start = Math.max(0, index - contextLength);
    const end = Math.min(text.length, index + match.length + contextLength);
    
    return text.substring(start, end).trim();
  }

  /**
   * Рассчитывает статистику документа
   */
  private calculateDocumentStats(text: string, rows: ParsedRow[]): any {
    const words = text.split(/\s+/).length;
    const chars = text.length;
    const dataRows = rows.filter(r => Object.keys(r.extractedData || {}).length > 0);
    
    return {
      totalWords: words,
      totalChars: chars,
      totalRows: rows.length,
      dataRows: dataRows.length,
      dataRatio: dataRows.length / Math.max(rows.length, 1),
      avgWordsPerRow: words / Math.max(rows.length, 1)
    };
  }

  /**
   * Определяет формат файла
   */
  private detectFormat(filePath: string): string {
    const extension = filePath.toLowerCase().substring(filePath.lastIndexOf('.'));
    return extension;
  }

  /**
   * Проверяет поддержку формата
   */
  private isFormatSupported(format: string): boolean {
    return this.supportedFormats.includes(format.toLowerCase());
  }

  /**
   * Получает паттерны для поиска энергетических данных
   */
  private getEnergyPatterns() {
    return {
      electricity: [
        {
          regex: /(\d+(?:[.,]\d+)?)\s*(?:кВт[·\*]?ч|kwh|кватт?[-\s]?час)/gi,
          confidence: 0.9,
          unit: 'кВт·ч'
        },
        {
          regex: /электроэнергия[:\s]*(\d+(?:[.,]\d+)?)/gi,
          confidence: 0.8,
          unit: 'кВт·ч'
        },
        {
          regex: /потребление\s+электричества[:\s]*(\d+(?:[.,]\d+)?)/gi,
          confidence: 0.85,
          unit: 'кВт·ч'
        }
      ],
      gas: [
        {
          regex: /(\d+(?:[.,]\d+)?)\s*(?:м[3³]|куб\.?\s*м|кубометр)/gi,
          confidence: 0.9,
          unit: 'м³'
        },
        {
          regex: /(?:газ|природный\s+газ)[:\s]*(\d+(?:[.,]\d+)?)/gi,
          confidence: 0.8,
          unit: 'м³'
        }
      ],
      fuel: [
        {
          regex: /(\d+(?:[.,]\d+)?)\s*(?:л|лит|литр)/gi,
          confidence: 0.9,
          unit: 'л'
        },
        {
          regex: /(?:бензин|дизель|топливо|ГСМ)[:\s]*(\d+(?:[.,]\d+)?)/gi,
          confidence: 0.8,
          unit: 'л'
        }
      ],
      heat: [
        {
          regex: /(\d+(?:[.,]\d+)?)\s*(?:гкал|ГКал|гигакалори)/gi,
          confidence: 0.9,
          unit: 'Гкал'
        },
        {
          regex: /(?:тепл[а-я]*|отопление)[:\s]*(\d+(?:[.,]\d+)?)/gi,
          confidence: 0.7,
          unit: 'Гкал'
        }
      ],
      transport: [
        {
          regex: /(\d+(?:[.,]\d+)?)\s*(?:км|километр)/gi,
          confidence: 0.9,
          unit: 'км'
        },
        {
          regex: /(?:пробег|расстояние|дистанция)[:\s]*(\d+(?:[.,]\d+)?)/gi,
          confidence: 0.8,
          unit: 'км'
        }
      ]
    };
  }

  /**
   * Оценивает качество извлеченных данных
   */
  private assessDataQuality(rows: ParsedRow[], format: string): {
    quality: DataQuality;
    confidence: number;
  } {
    if (rows.length === 0) {
      return { quality: 'poor', confidence: 0 };
    }

    const dataRows = rows.filter(r => Object.keys(r.extractedData || {}).length > 0);
    const dataRatio = dataRows.length / rows.length;
    const avgConfidence = rows.reduce((sum, row) => sum + row.confidence, 0) / rows.length;
    
    // Бонус за специфические форматы
    let formatBonus = 0;
    if (['.xlsx', '.xls', '.ods'].includes(format)) {
      formatBonus = 0.1; // Таблицы обычно содержат больше данных
    } else if (['.docx', '.doc', '.odt'].includes(format)) {
      formatBonus = 0.05; // Документы могут содержать данные
    }
    
    const finalConfidence = Math.min(avgConfidence + formatBonus, 1.0);
    
    let quality: DataQuality;
    
    if (dataRatio > 0.3 && finalConfidence > 0.8) {
      quality = 'excellent';
    } else if (dataRatio > 0.15 && finalConfidence > 0.6) {
      quality = 'good';
    } else if (dataRatio > 0.05 && finalConfidence > 0.4) {
      quality = 'fair';
    } else {
      quality = 'poor';
    }

    return { quality, confidence: finalConfidence };
  }

  /**
   * Получает типы извлеченных данных
   */
  private getExtractedTypes(rows: ParsedRow[]): string[] {
    const types = new Set<string>();
    
    for (const row of rows) {
      if (row.extractedData) {
        Object.keys(row.extractedData).forEach(key => types.add(key));
      }
    }
    
    return Array.from(types);
  }

  /**
   * Получает список поддерживаемых форматов
   */
  getSupportedFormats(): string[] {
    return [...this.supportedFormats];
  }
}