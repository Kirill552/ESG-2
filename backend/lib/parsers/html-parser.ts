/**
 * Современный HTML парсер (2025) 
 * Использует node-html-parser - самый быстрый HTML парсер для Node.js
 */

import * as fs from 'fs/promises';
import { parse, HTMLElement } from 'node-html-parser';
import { htmlToText } from 'html-to-text';
import * as iconv from 'iconv-lite';
import { BaseParser, ParsedDocument, ParsedRow, DataQuality } from './base-parser';

export interface HtmlParserOptions {
  extractText?: boolean;
  extractTables?: boolean;
  extractLinks?: boolean;
  extractMetadata?: boolean;
  removeScripts?: boolean;
  preserveFormatting?: boolean;
  encoding?: string;
  autoDetectEncoding?: boolean;
}

export class HtmlParser extends BaseParser {
  private readonly options: Required<HtmlParserOptions>;

  constructor(options: HtmlParserOptions = {}) {
    super();
    this.options = {
      extractText: options.extractText ?? true,
      extractTables: options.extractTables ?? true,
      extractLinks: options.extractLinks ?? false,
      extractMetadata: options.extractMetadata ?? true,
      removeScripts: options.removeScripts ?? true,
      preserveFormatting: options.preserveFormatting ?? false,
      encoding: options.encoding || 'utf8',
      autoDetectEncoding: options.autoDetectEncoding ?? true,
    };
  }

  async parseFile(filePath: string): Promise<ParsedDocument> {
    const startTime = Date.now();
    
    try {
      console.log(`🌐 HTML Parser: обработка файла ${filePath}`);
      
      // Читаем файл с определением кодировки
      const buffer = await fs.readFile(filePath);
      const encoding = this.detectEncoding(buffer);
      const content = iconv.decode(buffer, encoding);
      
      console.log(`🔤 Определена кодировка: ${encoding}`);
      
      // Парсим HTML
      const result = this.parseHtml(content);
      
      const processingTime = Date.now() - startTime;
      console.log(`✅ HTML Parser: файл обработан за ${processingTime}ms`);
      
      return {
        ...result,
        metadata: {
          ...result.metadata,
          encoding,
          processingTime,
          parser: 'HtmlParser'
        }
      };
      
    } catch (error) {
      console.error(`❌ HTML Parser: ошибка обработки файла ${filePath}:`, error);
      throw error;
    }
  }

  parseHtml(content: string): ParsedDocument {
    try {
      // Парсим HTML документ
      const root = parse(content, {
        blockTextElements: {
          script: false,
          noscript: false,
          style: false,
          pre: true,
        }
      });

      const rows: ParsedRow[] = [];
      let confidence = 0.7;

      // Удаляем скрипты если нужно
      if (this.options.removeScripts) {
        this.removeScripts(root);
      }

      // Извлекаем таблицы
      if (this.options.extractTables) {
        const tableRows = this.extractTables(root);
        rows.push(...tableRows);
        if (tableRows.length > 0) {
          confidence = Math.max(confidence, 0.9);
        }
      }

      // Извлекаем текстовое содержимое
      if (this.options.extractText) {
        const textRows = this.extractTextContent(root);
        rows.push(...textRows);
      }

      // Извлекаем ссылки
      if (this.options.extractLinks) {
        const linkRows = this.extractLinks(root);
        rows.push(...linkRows);
      }

      // Извлекаем метаданные
      let metadata: any = { format: 'html' };
      if (this.options.extractMetadata) {
        metadata = { ...metadata, ...this.extractMetadata(root) };
        confidence = Math.max(confidence, 0.8);
      }

      const quality = this.assessDataQuality(rows, confidence);
      
      return {
        success: true,
        data: rows,
        metadata: {
          ...metadata,
          totalElements: rows.length,
          quality: quality.quality,
          confidence: quality.confidence,
          extractedTypes: this.getExtractedTypes(rows)
        }
      };
      
    } catch (error) {
      console.error('❌ HTML Parser: ошибка парсинга HTML:', error);
      throw error;
    }
  }

  /**
   * Удаляет скрипты и стили из документа
   */
  private removeScripts(root: HTMLElement): void {
    root.querySelectorAll('script, style, noscript').forEach(element => {
      element.remove();
    });
  }

  /**
   * Извлекает данные из таблиц
   */
  private extractTables(root: HTMLElement): ParsedRow[] {
    const rows: ParsedRow[] = [];
    const tables = root.querySelectorAll('table');
    
    tables.forEach((table, tableIndex) => {
      const tableRows = table.querySelectorAll('tr');
      
      tableRows.forEach((row, rowIndex) => {
        const cells = row.querySelectorAll('td, th');
        const cellData: string[] = [];
        
        cells.forEach(cell => {
          const text = this.cleanText(cell.text);
          if (text) {
            cellData.push(text);
          }
        });
        
        if (cellData.length > 0) {
          const rowText = cellData.join(' ');
          const extractedData = this.extractDataFromText(rowText);
          
          if (extractedData.hasData || cellData.length > 1) {
            rows.push({
              index: rows.length + 1,
              content: rowText,
              extractedData: extractedData.data,
              confidence: extractedData.hasData ? extractedData.confidence : 0.5,
              metadata: {
                source: 'table',
                tableIndex,
                rowIndex,
                cellCount: cellData.length
              }
            });
          }
        }
      });
    });
    
    return rows;
  }

  /**
   * Извлекает текстовое содержимое
   */
  private extractTextContent(root: HTMLElement): ParsedRow[] {
    const rows: ParsedRow[] = [];
    
    // Конвертируем HTML в чистый текст
    let textContent: string;
    
    if (this.options.preserveFormatting) {
      textContent = htmlToText(root.toString(), {
        wordwrap: false,
        preserveNewlines: true,
        singleNewLineParagraphs: true,
      });
    } else {
      textContent = root.text;
    }
    
    // Разбиваем на строки и обрабатываем
    const lines = textContent.split('\n').filter(line => line.trim());
    
    lines.forEach((line, index) => {
      const cleanLine = this.cleanText(line);
      if (cleanLine.length > 10) { // Игнорируем слишком короткие строки
        const extractedData = this.extractDataFromText(cleanLine);
        
        if (extractedData.hasData) {
          rows.push({
            index: rows.length + 1,
            content: cleanLine,
            extractedData: extractedData.data,
            confidence: extractedData.confidence,
            metadata: {
              source: 'text',
              lineIndex: index
            }
          });
        }
      }
    });
    
    return rows;
  }

  /**
   * Извлекает ссылки
   */
  private extractLinks(root: HTMLElement): ParsedRow[] {
    const rows: ParsedRow[] = [];
    const links = root.querySelectorAll('a[href]');
    
    links.forEach((link, index) => {
      const text = this.cleanText(link.text);
      const href = link.getAttribute('href');
      
      if (text && href) {
        const extractedData = this.extractDataFromText(text);
        
        rows.push({
          index: rows.length + 1,
          content: text,
          extractedData: extractedData.data,
          confidence: extractedData.hasData ? extractedData.confidence : 0.3,
          metadata: {
            source: 'link',
            href,
            linkIndex: index
          }
        });
      }
    });
    
    return rows;
  }

  /**
   * Извлекает метаданные документа
   */
  private extractMetadata(root: HTMLElement): any {
    const metadata: any = {};
    
    // Заголовок документа
    const title = root.querySelector('title');
    if (title) {
      metadata.title = this.cleanText(title.text);
    }
    
    // Meta теги
    const metaTags = root.querySelectorAll('meta');
    metaTags.forEach(meta => {
      const name = meta.getAttribute('name') || meta.getAttribute('property');
      const content = meta.getAttribute('content');
      
      if (name && content) {
        metadata[name] = content;
      }
    });
    
    // Заголовки h1-h6
    const headings: string[] = [];
    for (let i = 1; i <= 6; i++) {
      const levelHeadings = root.querySelectorAll(`h${i}`);
      levelHeadings.forEach(heading => {
        const text = this.cleanText(heading.text);
        if (text) {
          headings.push(text);
        }
      });
    }
    
    if (headings.length > 0) {
      metadata.headings = headings;
    }
    
    return metadata;
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
   * Очищает текст от лишних символов
   */
  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/[\u00A0\u2000-\u200B\u2028\u2029]/g, ' ')
      .trim();
  }

  /**
   * Определяет кодировку файла
   */
  private detectEncoding(buffer: Buffer): string {
    if (!this.options.autoDetectEncoding) {
      return this.options.encoding;
    }

    // Ищем charset в HTML
    const htmlStart = buffer.subarray(0, Math.min(buffer.length, 2048)).toString('ascii');
    const charsetMatch = htmlStart.match(/charset\s*=\s*["']?([^"'>\s]+)/i);
    
    if (charsetMatch) {
      const charset = charsetMatch[1].toLowerCase();
      if (iconv.encodingExists(charset)) {
        return charset;
      }
    }

    // Проверяем BOM
    if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
      return 'utf8';
    }

    // По умолчанию UTF-8
    return 'utf8';
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
        }
      ],
      transport: [
        {
          regex: /(\d+(?:[.,]\d+)?)\s*(?:км|километр)/gi,
          confidence: 0.9,
          unit: 'км'
        }
      ]
    };
  }

  /**
   * Оценивает качество извлеченных данных
   */
  private assessDataQuality(rows: ParsedRow[], baseConfidence: number): {
    quality: DataQuality;
    confidence: number;
  } {
    if (rows.length === 0) {
      return { quality: 'poor', confidence: 0 };
    }

    const avgConfidence = rows.reduce((sum, row) => sum + row.confidence, 0) / rows.length;
    const finalConfidence = (avgConfidence + baseConfidence) / 2;
    
    let quality: DataQuality;
    
    if (finalConfidence > 0.8 && rows.length > 5) {
      quality = 'excellent';
    } else if (finalConfidence > 0.6 && rows.length > 2) {
      quality = 'good';
    } else if (finalConfidence > 0.4 || rows.length > 0) {
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
}