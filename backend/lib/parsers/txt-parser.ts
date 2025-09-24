/**
 * Современный TXT парсер с поддержкой различных кодировок (2025)
 * Использует iconv-lite для автоматического определения и декодирования
 */

import * as fs from 'fs/promises';
import * as iconv from 'iconv-lite';
import { BaseParser, ParsedDocument, ParsedRow, DataQuality } from './base-parser';

export interface TxtParserOptions {
  encoding?: string;
  autoDetectEncoding?: boolean;
  delimiter?: string;
  skipEmptyLines?: boolean;
  trimLines?: boolean;
}

export class TxtParser extends BaseParser {
  private readonly options: Required<TxtParserOptions>;

  constructor(options: TxtParserOptions = {}) {
    super();
    this.options = {
      encoding: options.encoding || 'utf8',
      autoDetectEncoding: options.autoDetectEncoding ?? true,
      delimiter: options.delimiter || '\n',
      skipEmptyLines: options.skipEmptyLines ?? true,
      trimLines: options.trimLines ?? true,
    };
  }

  async parseFile(filePath: string): Promise<ParsedDocument> {
    const startTime = Date.now();
    
    try {
      console.log(`📄 TXT Parser: обработка файла ${filePath}`);
      
      // Читаем файл как буфер для определения кодировки
      const buffer = await fs.readFile(filePath);
      
      // Определяем кодировку
      const encoding = this.detectEncoding(buffer);
      console.log(`🔤 Определена кодировка: ${encoding}`);
      
      // Декодируем содержимое
      const content = this.decodeContent(buffer, encoding);
      
      // Парсим текст
      const result = this.parseText(content);
      
      const processingTime = Date.now() - startTime;
      console.log(`✅ TXT Parser: файл обработан за ${processingTime}ms`);
      
      return {
        ...result,
        metadata: {
          ...result.metadata,
          encoding,
          processingTime,
          parser: 'TxtParser'
        }
      };
      
    } catch (error) {
      console.error(`❌ TXT Parser: ошибка обработки файла ${filePath}:`, error);
      throw error;
    }
  }

  parseText(content: string): ParsedDocument {
    const lines = this.splitIntoLines(content);
    const rows: ParsedRow[] = [];
    
    // Обрабатываем каждую строку
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (this.options.skipEmptyLines && !line.trim()) {
        continue;
      }
      
      const processedLine = this.options.trimLines ? line.trim() : line;
      
      // Ищем данные в строке
      const extractedData = this.extractDataFromLine(processedLine, i + 1);
      
      if (extractedData.hasData) {
        rows.push({
          index: i + 1,
          content: processedLine,
          extractedData: extractedData.data,
          confidence: extractedData.confidence
        });
      }
    }
    
    const quality = this.assessDataQuality(rows, lines.length);
    
    return {
      success: true,
      data: rows,
      metadata: {
        totalLines: lines.length,
        dataLines: rows.length,
        format: 'txt',
        quality: quality.quality,
        confidence: quality.confidence,
        extractedTypes: this.getExtractedTypes(rows)
      }
    };
  }

  /**
   * Определяет кодировку файла
   */
  private detectEncoding(buffer: Buffer): string {
    if (!this.options.autoDetectEncoding) {
      return this.options.encoding;
    }

    // Проверяем BOM
    if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
      return 'utf8';
    }
    
    if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
      return 'utf16le';
    }
    
    if (buffer.length >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF) {
      return 'utf16be';
    }

    // Пробуем определить по содержимому
    const sampleSize = Math.min(buffer.length, 1024);
    const sample = buffer.subarray(0, sampleSize);
    
    // Проверяем на UTF-8
    try {
      const utf8Text = iconv.decode(sample, 'utf8');
      if (this.isValidUtf8(utf8Text)) {
        return 'utf8';
      }
    } catch (e) {
      // Не UTF-8
    }
    
    // Проверяем на CP1251 (Windows-1251) для русского текста
    try {
      const cp1251Text = iconv.decode(sample, 'cp1251');
      if (this.containsCyrillic(cp1251Text)) {
        return 'cp1251';
      }
    } catch (e) {
      // Не CP1251
    }
    
    // Проверяем на CP866 (DOS кодировка)
    try {
      const cp866Text = iconv.decode(sample, 'cp866');
      if (this.containsCyrillic(cp866Text)) {
        return 'cp866';
      }
    } catch (e) {
      // Не CP866
    }
    
    // По умолчанию UTF-8
    return 'utf8';
  }

  /**
   * Декодирует содержимое файла
   */
  private decodeContent(buffer: Buffer, encoding: string): string {
    try {
      return iconv.decode(buffer, encoding);
    } catch (error) {
      console.warn(`⚠️ Ошибка декодирования с ${encoding}, использую UTF-8`);
      return iconv.decode(buffer, 'utf8', { stripBOM: true });
    }
  }

  /**
   * Разбивает текст на строки
   */
  private splitIntoLines(content: string): string[] {
    // Нормализуем переводы строк
    const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    if (this.options.delimiter === '\n') {
      return normalized.split('\n');
    }
    
    return normalized.split(this.options.delimiter);
  }

  /**
   * Извлекает данные из строки
   */
  private extractDataFromLine(line: string, lineNumber: number): {
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
        const matches = line.match(pattern.regex);
        if (matches) {
          if (!extracted[category]) {
            extracted[category] = [];
          }
          
          const value = this.extractValue(matches, pattern);
          if (value) {
            extracted[category].push({
              value: value.amount,
              unit: value.unit,
              line: lineNumber,
              text: matches[0],
              confidence: pattern.confidence
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
   * Проверяет, является ли текст валидным UTF-8
   */
  private isValidUtf8(text: string): boolean {
    // Проверяем на наличие replacement character
    return !text.includes('\uFFFD') && text.length > 0;
  }

  /**
   * Проверяет наличие кириллических символов
   */
  private containsCyrillic(text: string): boolean {
    return /[а-яё]/i.test(text);
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
        }
      ],
      gas: [
        {
          regex: /(\d+(?:[.,]\d+)?)\s*(?:м[3³]|куб\.?\s*м|кубометр)/gi,
          confidence: 0.9,
          unit: 'м³'
        },
        {
          regex: /газ[:\s]*(\d+(?:[.,]\d+)?)/gi,
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
          regex: /(?:бензин|дизель|топливо)[:\s]*(\d+(?:[.,]\d+)?)/gi,
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
          regex: /тепл[а-я]*[:\s]*(\d+(?:[.,]\d+)?)/gi,
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
          regex: /пробег[:\s]*(\d+(?:[.,]\d+)?)/gi,
          confidence: 0.8,
          unit: 'км'
        }
      ]
    };
  }

  /**
   * Оценивает качество извлеченных данных
   */
  private assessDataQuality(rows: ParsedRow[], totalLines: number): {
    quality: DataQuality;
    confidence: number;
  } {
    if (rows.length === 0) {
      return { quality: 'poor', confidence: 0 };
    }

    const dataRatio = rows.length / totalLines;
    const avgConfidence = rows.reduce((sum, row) => sum + row.confidence, 0) / rows.length;
    
    let quality: DataQuality;
    
    if (dataRatio > 0.3 && avgConfidence > 0.8) {
      quality = 'excellent';
    } else if (dataRatio > 0.1 && avgConfidence > 0.6) {
      quality = 'good';
    } else if (dataRatio > 0.05 && avgConfidence > 0.4) {
      quality = 'fair';
    } else {
      quality = 'poor';
    }

    return { quality, confidence: avgConfidence };
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
}