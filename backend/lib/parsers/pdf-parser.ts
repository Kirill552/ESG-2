/**
 * Современный PDF парсер (2025)
 * Использует UnPDF - оптимизированную библиотеку для серверных сред и AI приложений
 */

import * as fs from 'fs/promises';
import { extractText, getDocumentProxy, getMeta, extractLinks } from 'unpdf';
import { BaseParser, ParsedDocument, ParsedRow, DataQuality } from './base-parser';

export interface PdfParserOptions {
  mergePages?: boolean;
  extractMetadata?: boolean;
  extractLinks?: boolean;
  pageRange?: { start?: number; end?: number };
  splitByPages?: boolean;
  splitByParagraphs?: boolean;
  minimumTextLength?: number;
}

export class PdfParser extends BaseParser {
  private readonly options: Required<PdfParserOptions>;

  constructor(options: PdfParserOptions = {}) {
    super();
    this.options = {
      mergePages: options.mergePages ?? false,
      extractMetadata: options.extractMetadata ?? true,
      extractLinks: options.extractLinks ?? false,
      pageRange: options.pageRange ?? {},
      splitByPages: options.splitByPages ?? true,
      splitByParagraphs: options.splitByParagraphs ?? true,
      minimumTextLength: options.minimumTextLength ?? 10,
    };
  }

  async parseFile(filePath: string): Promise<ParsedDocument> {
    const startTime = Date.now();
    
    try {
      console.log(`📄 PDF Parser: обработка файла ${filePath}`);
      
      // Читаем PDF файл
      const buffer = await fs.readFile(filePath);
      const pdfData = new Uint8Array(buffer);
      
      // Получаем документ PDF.js
      const pdf = await getDocumentProxy(pdfData);
      console.log(`📊 PDF содержит ${pdf.numPages} страниц`);
      
      // Извлекаем текст
      const textResult = await this.extractTextContent(pdf);
      
      // Извлекаем метаданные
      let metadata: any = { format: 'pdf', totalPages: pdf.numPages };
      if (this.options.extractMetadata) {
        const metaResult = await getMeta(pdf);
        metadata = { ...metadata, ...metaResult.info, documentMetadata: metaResult.metadata };
      }
      
      // Извлекаем ссылки
      let links: string[] = [];
      if (this.options.extractLinks) {
        const linksResult = await extractLinks(pdf);
        links = linksResult.links;
        metadata.linksCount = links.length;
      }
      
      // Обрабатываем извлеченный текст
      const result = this.processExtractedContent(textResult, links, metadata);
      
      const processingTime = Date.now() - startTime;
      console.log(`✅ PDF Parser: файл обработан за ${processingTime}ms`);
      
      return {
        ...result,
        metadata: {
          ...result.metadata,
          processingTime,
          parser: 'PdfParser',
          fileSize: buffer.length
        }
      };
      
    } catch (error) {
      console.error(`❌ PDF Parser: ошибка обработки файла ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Извлекает текстовое содержимое из PDF
   */
  private async extractTextContent(pdf: any): Promise<{
    totalPages: number;
    text: string | string[];
    pageTexts?: string[];
  }> {
    try {
      // Определяем диапазон страниц
      const startPage = this.options.pageRange.start || 1;
      const endPage = this.options.pageRange.end || pdf.numPages;
      
      if (startPage > pdf.numPages || endPage > pdf.numPages) {
        throw new Error(`Указанный диапазон страниц (${startPage}-${endPage}) превышает количество страниц в документе (${pdf.numPages})`);
      }
      
      console.log(`🔍 Извлечение текста со страниц ${startPage}-${endPage}`);
      
      if (this.options.mergePages && !this.options.splitByPages) {
        // Извлекаем все страницы как один текст
        const result = await extractText(pdf, { mergePages: true });
        return {
          totalPages: result.totalPages,
          text: result.text
        };
      } else {
        // Извлекаем текст по страницам
        const result = await extractText(pdf, { mergePages: false });
        
        // Фильтруем по диапазону если нужно
        const filteredTexts = this.options.pageRange.start || this.options.pageRange.end
          ? result.text.slice(startPage - 1, endPage)
          : result.text;
        
        return {
          totalPages: result.totalPages,
          text: filteredTexts,
          pageTexts: filteredTexts
        };
      }
    } catch (error) {
      console.error('❌ PDF Parser: ошибка извлечения текста:', error);
      throw new Error(`Ошибка извлечения текста из PDF: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Обрабатывает извлеченное содержимое
   */
  private processExtractedContent(
    textResult: { totalPages: number; text: string | string[]; pageTexts?: string[] },
    links: string[],
    metadata: any
  ): ParsedDocument {
    const rows: ParsedRow[] = [];
    
    if (this.options.splitByPages && textResult.pageTexts) {
      // Обрабатываем по страницам
      textResult.pageTexts.forEach((pageText, pageIndex) => {
        if (pageText && pageText.trim().length >= this.options.minimumTextLength) {
          const pageRows = this.processPageText(pageText, pageIndex + 1);
          rows.push(...pageRows);
        }
      });
    } else if (typeof textResult.text === 'string') {
      // Обрабатываем весь текст как один блок
      const allTextRows = this.processTextContent(textResult.text);
      rows.push(...allTextRows);
    }
    
    // Обрабатываем ссылки
    if (links.length > 0) {
      links.forEach((link, index) => {
        rows.push({
          index: rows.length + 1,
          content: link,
          extractedData: {},
          confidence: 0.3,
          metadata: {
            source: 'link',
            linkIndex: index,
            type: this.classifyLink(link)
          }
        });
      });
    }
    
    const quality = this.assessDataQuality(rows, textResult.totalPages);
    
    return {
      success: true,
      data: rows,
      metadata: {
        ...metadata,
        totalSections: rows.length,
        dataSections: rows.filter(r => Object.keys(r.extractedData || {}).length > 0).length,
        quality: quality.quality,
        confidence: quality.confidence,
        extractedTypes: this.getExtractedTypes(rows),
        documentStats: this.calculateDocumentStats(textResult, rows)
      }
    };
  }

  /**
   * Обрабатывает текст одной страницы
   */
  private processPageText(pageText: string, pageNumber: number): ParsedRow[] {
    const rows: ParsedRow[] = [];
    
    if (this.options.splitByParagraphs) {
      const paragraphs = this.splitIntoParagraphs(pageText);
      
      paragraphs.forEach((paragraph, paragraphIndex) => {
        if (paragraph.trim().length >= this.options.minimumTextLength) {
          const extractedData = this.extractDataFromText(paragraph);
          
          rows.push({
            index: rows.length + 1,
            content: paragraph.trim(),
            extractedData: extractedData.data,
            confidence: extractedData.hasData ? extractedData.confidence : 0.3,
            metadata: {
              source: 'page',
              pageNumber,
              paragraphIndex,
              wordCount: paragraph.split(/\s+/).length
            }
          });
        }
      });
    } else {
      // Обрабатываем всю страницу как один блок
      const extractedData = this.extractDataFromText(pageText);
      
      rows.push({
        index: 1,
        content: pageText.trim(),
        extractedData: extractedData.data,
        confidence: extractedData.hasData ? extractedData.confidence : 0.3,
        metadata: {
          source: 'page',
          pageNumber,
          wordCount: pageText.split(/\s+/).length
        }
      });
    }
    
    return rows;
  }

  /**
   * Обрабатывает текстовое содержимое
   */
  private processTextContent(text: string): ParsedRow[] {
    const rows: ParsedRow[] = [];
    
    if (this.options.splitByParagraphs) {
      const paragraphs = this.splitIntoParagraphs(text);
      
      paragraphs.forEach((paragraph, index) => {
        if (paragraph.trim().length >= this.options.minimumTextLength) {
          const extractedData = this.extractDataFromText(paragraph);
          
          rows.push({
            index: index + 1,
            content: paragraph.trim(),
            extractedData: extractedData.data,
            confidence: extractedData.hasData ? extractedData.confidence : 0.3,
            metadata: {
              source: 'text',
              paragraphIndex: index,
              wordCount: paragraph.split(/\s+/).length
            }
          });
        }
      });
    } else {
      const extractedData = this.extractDataFromText(text);
      
      rows.push({
        index: 1,
        content: text.trim(),
        extractedData: extractedData.data,
        confidence: extractedData.hasData ? extractedData.confidence : 0.3,
        metadata: {
          source: 'text',
          wordCount: text.split(/\s+/).length
        }
      });
    }
    
    return rows;
  }

  /**
   * Разбивает текст на параграфы
   */
  private splitIntoParagraphs(text: string): string[] {
    return text
      .split(/\n\s*\n|\r\n\s*\r\n/)
      .map(p => p.replace(/\n/g, ' ').trim())
      .filter(p => p.length >= this.options.minimumTextLength);
  }

  /**
   * Классифицирует тип ссылки
   */
  private classifyLink(link: string): string {
    if (link.startsWith('mailto:')) {
      return 'email';
    } else if (link.startsWith('tel:')) {
      return 'phone';
    } else if (link.startsWith('http')) {
      return 'web';
    } else if (link.includes('@')) {
      return 'email';
    } else {
      return 'other';
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
  private getContext(text: string, match: string, contextLength: number = 100): string {
    const index = text.indexOf(match);
    if (index === -1) return '';
    
    const start = Math.max(0, index - contextLength);
    const end = Math.min(text.length, index + match.length + contextLength);
    
    return text.substring(start, end).replace(/\s+/g, ' ').trim();
  }

  /**
   * Рассчитывает статистику документа
   */
  private calculateDocumentStats(textResult: any, rows: ParsedRow[]): any {
    const allText = typeof textResult.text === 'string' 
      ? textResult.text 
      : textResult.text.join(' ');
      
    const words = allText.split(/\s+/).length;
    const chars = allText.length;
    const dataRows = rows.filter(r => Object.keys(r.extractedData || {}).length > 0);
    
    return {
      totalWords: words,
      totalChars: chars,
      totalPages: textResult.totalPages,
      totalRows: rows.length,
      dataRows: dataRows.length,
      dataRatio: dataRows.length / Math.max(rows.length, 1),
      avgWordsPerPage: words / Math.max(textResult.totalPages, 1),
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
  private assessDataQuality(rows: ParsedRow[], totalPages: number): {
    quality: DataQuality;
    confidence: number;
  } {
    if (rows.length === 0) {
      return { quality: 'poor', confidence: 0 };
    }

    const dataRows = rows.filter(r => Object.keys(r.extractedData || {}).length > 0);
    const dataRatio = dataRows.length / rows.length;
    const avgConfidence = rows.reduce((sum, row) => sum + row.confidence, 0) / rows.length;
    
    // Бонус за PDF формат (часто содержат структурированные данные)
    const formatBonus = 0.1;
    const pageBonus = Math.min(totalPages * 0.01, 0.1); // Бонус за многостраничность
    
    const finalConfidence = Math.min(avgConfidence + formatBonus + pageBonus, 1.0);
    
    let quality: DataQuality;
    
    if (dataRatio > 0.2 && finalConfidence > 0.8) {
      quality = 'excellent';
    } else if (dataRatio > 0.1 && finalConfidence > 0.6) {
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
}