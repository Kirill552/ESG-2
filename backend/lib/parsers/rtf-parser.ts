/**
 * Современный RTF парсер (2025)
 * Использует rtf-parser-wasm для высокой производительности
 * Fallback к @extensionengine/rtf-parser для совместимости
 */

import * as fs from 'fs/promises';
import { BaseParser, ParsedDocument, ParsedRow, DataQuality } from './base-parser';

// Типы для WASM парсера
interface WasmRtfParser {
  parse_rtf: (content: string) => WasmRtfDocument;
}

interface WasmRtfDocument {
  body: WasmRtfNode[];
  header?: WasmRtfNode[];
  footer?: WasmRtfNode[];
}

interface WasmRtfNode {
  type: 'text' | 'paragraph' | 'table' | 'image' | 'control';
  content?: string;
  children?: WasmRtfNode[];
  properties?: Record<string, any>;
}

export interface RtfParserOptions {
  preferWasm?: boolean;
  encoding?: string;
  extractFormatting?: boolean;
  extractTables?: boolean;
  ignoreImages?: boolean;
  maxFileSize?: number;
}

export class RtfParser extends BaseParser {
  private readonly options: Required<RtfParserOptions>;
  private wasmParser: WasmRtfParser | null = null;
  private extensionParser: any = null;

  constructor(options: RtfParserOptions = {}) {
    super();
    this.options = {
      preferWasm: options.preferWasm ?? true,
      encoding: options.encoding || 'utf8',
      extractFormatting: options.extractFormatting ?? false,
      extractTables: options.extractTables ?? true,
      ignoreImages: options.ignoreImages ?? true,
      maxFileSize: options.maxFileSize || 50 * 1024 * 1024 // 50MB
    };
    
    this.initializeParsers();
  }

  private async initializeParsers() {
    try {
      // Загружаем Extension Engine парсер (асинхронный)
      const extensionModule = await import('@extensionengine/rtf-parser');
      this.extensionParser = extensionModule.default || extensionModule;
      console.log('📝 RTF Parser: Extension Engine парсер загружен');
    } catch (error) {
      console.log('⚠️ RTF Parser: Extension Engine парсер недоступен');
    }

    try {
      // Попытка загрузить классический rtf-parser как fallback
      const legacyModule = await import('rtf-parser');
      if (legacyModule.default) {
        this.wasmParser = legacyModule.default;
        console.log('📄 RTF Parser: классический парсер загружен');
      }
    } catch (error) {
      console.log('⚠️ RTF Parser: классический парсер недоступен');
    }
    
    if (!this.extensionParser && !this.wasmParser) {
      console.error('❌ RTF Parser: не удалось загрузить ни один парсер');
    }
  }

  async parseFile(filePath: string): Promise<ParsedDocument> {
    const startTime = Date.now();
    
    try {
      console.log(`📄 RTF Parser: обработка файла ${filePath}`);
      
      // Проверяем размер файла
      const stats = await fs.stat(filePath);
      if (stats.size > this.options.maxFileSize) {
        throw new Error(`Файл слишком большой: ${stats.size} байт (максимум: ${this.options.maxFileSize})`);
      }
      
      // Читаем содержимое файла
      const content = await fs.readFile(filePath, this.options.encoding);
      
      // Проверяем, что это действительно RTF файл
      if (!this.isValidRtf(content)) {
        throw new Error('Файл не является корректным RTF документом');
      }
      
      // Парсим содержимое
      const result = await this.parseRtfContent(content);
      
      const processingTime = Date.now() - startTime;
      console.log(`✅ RTF Parser: файл обработан за ${processingTime}ms`);
      
      return {
        ...result,
        metadata: {
          ...result.metadata,
          format: '.rtf',
          processingTime,
          parser: this.wasmParser ? 'RtfParser-WASM' : 'RtfParser-Extension',
          fileSize: stats.size,
          encoding: this.options.encoding
        }
      };
      
    } catch (error) {
      console.error(`❌ RTF Parser: ошибка обработки файла ${filePath}:`, error);
      throw new Error(`Ошибка обработки RTF файла: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Проверяет, является ли содержимое корректным RTF
   */
  private isValidRtf(content: string): boolean {
    return content.trim().startsWith('{\\rtf1');
  }

  /**
   * Парсит RTF содержимое
   */
  private async parseRtfContent(content: string): Promise<ParsedDocument> {
    // Убеждаемся, что парсеры инициализированы
    if (!this.extensionParser && !this.wasmParser) {
      await this.initializeParsers();
    }

    let parsedData: any = null;
    let parserUsed = '';

    // Начинаем с простого парсера для лучшей поддержки кириллицы
    try {
      parsedData = this.simpleRtfParse(content);
      parserUsed = 'Simple';
      console.log('📄 RTF Parser: использован простой парсер (основной)');
    } catch (error) {
      console.log('⚠️ RTF Parser: простой парсер не смог обработать файл:', error.message);
    }

    // Fallback к Extension Engine парсеру
    if (!parsedData && this.extensionParser) {
      try {
        if (typeof this.extensionParser === 'function') {
          parsedData = await this.extensionParser(content);
          parserUsed = 'Extension';
          console.log('📝 RTF Parser: использован Extension Engine парсер');
        }
      } catch (error) {
        console.log('⚠️ RTF Parser: Extension парсер не смог обработать файл:', error.message);
      }
    }

    // Последний fallback к классическому парсеру
    if (!parsedData && this.wasmParser) {
      try {
        const parser = new this.wasmParser();
        parsedData = parser.parse(content);
        parserUsed = 'Legacy';
        console.log('📄 RTF Parser: использован классический парсер');
      } catch (error) {
        console.log('⚠️ RTF Parser: классический парсер не смог обработать файл:', error.message);
      }
    }

    if (!parsedData) {
      console.error('❌ RTF Parser: все парсеры не смогли обработать файл');
      throw new Error('Все доступные RTF парсеры не смогли обработать файл');
    }

    if (!parsedData) {
      throw new Error('Не удалось распарсить RTF содержимое');
    }

    // Извлекаем текст из результатов парсинга
    const extractedText = this.extractTextFromParsedData(parsedData, parserUsed);
    
    // Обрабатываем извлеченный текст
    return this.processExtractedText(extractedText, parserUsed);
  }

  /**
   * Извлекает текст из данных, полученных от парсера
   */
  private extractTextFromParsedData(parsedData: any, parserUsed: string): string {
    if (parserUsed === 'Simple') {
      return parsedData; // Простой парсер уже возвращает текст
    } else if (parserUsed === 'Legacy' && parsedData.doc) {
      return this.extractTextFromLegacyData(parsedData);
    } else {
      return this.extractTextFromExtensionData(parsedData);
    }
  }

  /**
   * Извлекает текст из Legacy парсера
   */
  private extractTextFromLegacyData(data: any): string {
    const textParts: string[] = [];
    
    const extractFromElement = (element: any): void => {
      if (!element) return;
      
      if (element.text) {
        textParts.push(element.text);
      }
      
      if (element.content && Array.isArray(element.content)) {
        for (const child of element.content) {
          extractFromElement(child);
        }
      } else if (element.content) {
        extractFromElement(element.content);
      }
      
      if (element.children && Array.isArray(element.children)) {
        for (const child of element.children) {
          extractFromElement(child);
        }
      }
    };
    
    extractFromElement(data.doc);
    return textParts.join(' ').trim();
  }

  /**
   * Извлекает текст из WASM парсера
   */
  private extractTextFromWasmData(data: WasmRtfDocument): string {
    const textParts: string[] = [];
    
    const extractFromNodes = (nodes: WasmRtfNode[]): void => {
      for (const node of nodes) {
        if (node.type === 'text' && node.content) {
          textParts.push(node.content);
        } else if (node.type === 'paragraph') {
          if (node.content) {
            textParts.push(node.content);
          }
          if (node.children) {
            extractFromNodes(node.children);
          }
          textParts.push('\n');
        } else if (node.children) {
          extractFromNodes(node.children);
        }
      }
    };
    
    if (data.header) {
      extractFromNodes(data.header);
      textParts.push('\n\n');
    }
    
    if (data.body) {
      extractFromNodes(data.body);
    }
    
    if (data.footer) {
      textParts.push('\n\n');
      extractFromNodes(data.footer);
    }
    
    return textParts.join('').trim();
  }

  /**
   * Простой RTF парсер как fallback
   */
  private simpleRtfParse(content: string): string {
    // Удаляем RTF контрольные последовательности и извлекаем текст
    let text = content
      // Убираем RTF заголовок
      .replace(/^\{\\rtf1[^}]*\}/, '')
      // Убираем таблицы шрифтов
      .replace(/\{\\fonttbl[^}]*\}/g, '')
      // Убираем таблицы цветов
      .replace(/\{\\colortbl[^}]*\}/g, '')
      // Убираем стили
      .replace(/\{\\stylesheet[^}]*\}/g, '')
      // Убираем контрольные слова с параметрами
      .replace(/\\[a-z]+\d*\s*/gi, ' ')
      // Убираем фигурные скобки
      .replace(/[{}]/g, '')
      // Убираем множественные пробелы
      .replace(/\s+/g, ' ')
      .trim();

    return text;
  }

  /**
   * Извлекает текст из Extension Engine парсера
   */
  private extractTextFromExtensionData(data: any): string {
    if (typeof data === 'string') {
      return data;
    }
    
    // Extension Engine возвращает RTFDocument объект
    if (data && data.content && Array.isArray(data.content)) {
      return this.extractFromRTFDocument(data);
    }
    
    if (data && typeof data.text === 'string') {
      return data.text;
    }
    
    if (data && typeof data.content === 'string') {
      return data.content;
    }
    
    if (data && Array.isArray(data.body)) {
      return data.body.map((item: any) => {
        if (typeof item === 'string') return item;
        if (item.text) return item.text;
        if (item.content) return item.content;
        return '';
      }).join(' ');
    }

    if (data && data.doc && data.doc.content) {
      return this.extractFromDocContent(data.doc.content);
    }
    
    // Fallback к простому парсеру
    console.log('🔍 RTF Parser: неожиданная структура, используем простой парсер');
    
    return String(data);
  }

  /**
   * Извлекает текст из RTFDocument (Extension Engine)
   */
  private extractFromRTFDocument(doc: any): string {
    const textParts: string[] = [];
    
    if (doc.content && Array.isArray(doc.content)) {
      for (const paragraph of doc.content) {
        if (paragraph.content && Array.isArray(paragraph.content)) {
          for (const item of paragraph.content) {
            if (typeof item === 'string') {
              textParts.push(item);
            } else if (item && typeof item.text === 'string') {
              textParts.push(item.text);
            } else if (item && typeof item.value === 'string') {
              textParts.push(item.value);
            }
          }
          textParts.push(' '); // Разделитель между параграфами
        }
      }
    }
    
    return textParts.join('').trim();
  }

  /**
   * Извлекает текст из содержимого документа
   */
  private extractFromDocContent(content: any[]): string {
    const textParts: string[] = [];
    
    const extractText = (items: any[]): void => {
      for (const item of items) {
        if (typeof item === 'string') {
          textParts.push(item);
        } else if (item && item.type === 'text' && item.value) {
          textParts.push(item.value);
        } else if (item && item.content && Array.isArray(item.content)) {
          extractText(item.content);
        } else if (item && typeof item.text === 'string') {
          textParts.push(item.text);
        }
      }
    };
    
    extractText(content);
    return textParts.join(' ');
  }

  /**
   * Обрабатывает извлеченный текст и создает документ
   */
  private processExtractedText(text: string, parserUsed: string): ParsedDocument {
    const rows: ParsedRow[] = [];
    
    // Разбиваем текст на параграфы
    const paragraphs = text
      .split(/\n\s*\n|\r\n\s*\r\n/)
      .map(p => p.trim())
      .filter(p => p.length > 0);
    
    // Обрабатываем каждый параграф
    paragraphs.forEach((paragraph, index) => {
      const cleanParagraph = this.cleanRtfText(paragraph);
      
      if (cleanParagraph.length > 10) { // Игнорируем слишком короткие параграфы
        const extractedData = this.extractDataFromText(cleanParagraph);
        
        // Добавляем строку если есть данные или параграф достаточно длинный
        if (extractedData.hasData || cleanParagraph.length > 30) {
          rows.push({
            index: index + 1,
            content: cleanParagraph,
            extractedData: extractedData.data,
            confidence: extractedData.hasData ? extractedData.confidence : 0.2,
            metadata: {
              source: 'rtf_paragraph',
              parserUsed,
              wordCount: cleanParagraph.split(/\s+/).length,
              charCount: cleanParagraph.length
            }
          });
        }
      }
    });
    
    const quality = this.assessDataQuality(rows);
    
    return {
      success: true,
      data: rows,
      metadata: {
        format: '.rtf',
        totalParagraphs: paragraphs.length,
        dataParagraphs: rows.filter(r => Object.keys(r.extractedData || {}).length > 0).length,
        quality: quality.quality,
        confidence: quality.confidence,
        extractedTypes: this.getExtractedTypes(rows),
        parserUsed,
        textStats: this.calculateTextStats(text, rows)
      }
    };
  }

  /**
   * Очищает RTF текст от специальных символов
   */
  private cleanRtfText(text: string): string {
    return text
      // Убираем RTF контрольные символы
      .replace(/\\[a-z]+\d*\s*/gi, '')
      .replace(/[{}]/g, '')
      // Стандартная очистка
      .replace(/\s+/g, ' ')
      .replace(/[\u00A0\u2000-\u200B\u2028\u2029]/g, ' ')
      .trim();
  }

  /**
   * Извлекает энергетические данные из текста
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
  private getContext(text: string, match: string, contextLength: number = 40): string {
    const index = text.indexOf(match);
    if (index === -1) return '';
    
    const start = Math.max(0, index - contextLength);
    const end = Math.min(text.length, index + match.length + contextLength);
    
    return text.substring(start, end).trim();
  }

  /**
   * Рассчитывает статистику текста
   */
  private calculateTextStats(text: string, rows: ParsedRow[]): any {
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
          regex: /(\d+(?:[.,]\d+)?)\s*(?:м[3³]|куб\.?\s*м|кубометр|тысяч\s+нормальных\s+кубометров)/gi,
          confidence: 0.9,
          unit: 'м³'
        },
        {
          regex: /(?:газ|природный\s+газ|сухой\s+лед)[:\s]*(\d+(?:[.,]\d+)?)/gi,
          confidence: 0.8,
          unit: 'м³'
        }
      ],
      fuel: [
        {
          regex: /(\d+(?:[.,]\d+)?)\s*(?:л|лит|литр|кубических\s+метров|г)/gi,
          confidence: 0.9,
          unit: 'л'
        },
        {
          regex: /(?:бензин|дизель|топливо|ГСМ|биодизель|авиатопливо|условное\s+топливо)[:\s]*(\d+(?:[.,]\d+)?)/gi,
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
      chemicals: [
        {
          regex: /(\d+(?:[.,]\d+)?)\s*(?:тонн[а-я]*|т)/gi,
          confidence: 0.8,
          unit: 'тонны'
        },
        {
          regex: /(?:эмали|C2H2|производство\s+азотной\s+кислоты)[:\s]*(\d+(?:[.,]\d+)?)/gi,
          confidence: 0.85,
          unit: 'тонны'
        }
      ]
    };
  }

  /**
   * Оценивает качество извлеченных данных
   */
  private assessDataQuality(rows: ParsedRow[]): {
    quality: DataQuality;
    confidence: number;
  } {
    if (rows.length === 0) {
      return { quality: 'poor', confidence: 0 };
    }

    const dataRows = rows.filter(r => Object.keys(r.extractedData || {}).length > 0);
    const dataRatio = dataRows.length / rows.length;
    const avgConfidence = rows.reduce((sum, row) => sum + row.confidence, 0) / rows.length;
    
    let quality: DataQuality;
    
    if (dataRatio > 0.4 && avgConfidence > 0.8) {
      quality = 'excellent';
    } else if (dataRatio > 0.2 && avgConfidence > 0.6) {
      quality = 'good';
    } else if (dataRatio > 0.1 && avgConfidence > 0.4) {
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

  /**
   * Получает список поддерживаемых форматов
   */
  getSupportedFormats(): string[] {
    return ['.rtf'];
  }
}