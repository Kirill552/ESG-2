/**
 * 🚀 Упрощенный OCR сервис ESG-Lite 2025
 * Только Tesseract.js без Yandex Vision для уменьшения сложности
 */

import { createWorker } from 'tesseract.js';
import * as XLSX from 'xlsx';
import { prisma } from './prisma';

// DOCX извлечение текста через mammoth (если доступен)
let mammoth: any = null;
try {
  mammoth = require('mammoth');
} catch {}

interface OcrResult {
  text: string;
  confidence: number;
  words?: any[];
}

interface SimplifiedOcrConfig {
  confidenceThreshold: number;
  tessractLanguages: string;
  enableExcelProcessing: boolean;
  enableDocxProcessing: boolean;
  enablePdfTextExtraction: boolean;
}

interface ProcessingOptions {
  confidenceThreshold?: number;
  maxProcessingTime?: number;
}

interface ExtendedOcrResult extends OcrResult {
  provider: 'tesseract' | 'structured';
  processingTime: number;
  docType?: string;
  bypassReason?: 'structured_csv' | 'structured_json' | 'structured_xml' | 'structured_excel' | 'structured_docx' | 'structured_pdf';
}

/**
 * 📄 Классификация документов по типу
 */
function classifyDocument(filename: string, mimeType: string) {
  const ext = filename.toLowerCase().split('.').pop();
  
  if (ext === 'csv' || mimeType === 'text/csv') {
    return { docType: 'csv', category: 'structured' };
  }
  if (ext === 'json') {
    return { docType: 'json', category: 'structured' };
  }
  if (ext === 'xml') {
    return { docType: 'xml', category: 'structured' };
  }
  if (['xlsx', 'xls'].includes(ext!)) {
    return { docType: 'excel', category: 'structured' };
  }
  if (ext === 'docx') {
    return { docType: 'docx', category: 'document' };
  }
  if (ext === 'pdf') {
    return { docType: 'pdf', category: 'document' };
  }
  if (['png', 'jpg', 'jpeg', 'tiff', 'bmp'].includes(ext!)) {
    return { docType: 'image', category: 'image' };
  }
  if (ext === 'txt') {
    return { docType: 'text', category: 'text' };
  }
  
  return { docType: 'unknown', category: 'unknown' };
}

/**
 * 📊 Обработка Excel файлов
 */
async function processExcelBuffer(buffer: Buffer): Promise<string> {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    let allText = '';
    
    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(worksheet);
      allText += `\n=== Лист: ${sheetName} ===\n${csv}\n`;
    });
    
    return allText;
  } catch (error) {
    throw new Error(`Ошибка обработки Excel: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
  }
}

/**
 * 🔍 Основной класс упрощенного OCR сервиса
 */
class SimplifiedOcrService {
  private config: SimplifiedOcrConfig;
  private tesseractWorker: any = null;

  constructor() {
    this.config = {
      confidenceThreshold: parseFloat(process.env.OCR_CONFIDENCE_THRESHOLD || '0.7'),
      tessractLanguages: process.env.TESSERACT_LANGUAGES || 'rus+eng',
      enableExcelProcessing: process.env.ENABLE_EXCEL_PROCESSING !== 'false',
      enableDocxProcessing: process.env.ENABLE_DOCX_PROCESSING !== 'false',
      enablePdfTextExtraction: process.env.ENABLE_PDF_TEXT_EXTRACTION !== 'false'
    };
  }

  /**
   * 🔧 Загрузка конфигурации из системных настроек
   */
  private async loadConfigFromSystemSettings(): Promise<void> {
    try {
      const keys = [
        'OCR_CONFIDENCE_THRESHOLD',
        'TESSERACT_LANGUAGES',
        'ENABLE_EXCEL_PROCESSING',
        'ENABLE_DOCX_PROCESSING',
        'ENABLE_PDF_TEXT_EXTRACTION'
      ];
      
      const rows = await prisma.systemSettings.findMany({ 
        where: { key: { in: keys } } 
      });
      
      const map = new Map(rows.map(r => [r.key, r.value]));

      this.config = {
        confidenceThreshold: map.has('OCR_CONFIDENCE_THRESHOLD') 
          ? Number(map.get('OCR_CONFIDENCE_THRESHOLD')) 
          : this.config.confidenceThreshold,
        tessractLanguages: map.has('TESSERACT_LANGUAGES') 
          ? String(map.get('TESSERACT_LANGUAGES')) 
          : this.config.tessractLanguages,
        enableExcelProcessing: map.has('ENABLE_EXCEL_PROCESSING') 
          ? Boolean(map.get('ENABLE_EXCEL_PROCESSING')) 
          : this.config.enableExcelProcessing,
        enableDocxProcessing: map.has('ENABLE_DOCX_PROCESSING') 
          ? Boolean(map.get('ENABLE_DOCX_PROCESSING')) 
          : this.config.enableDocxProcessing,
        enablePdfTextExtraction: map.has('ENABLE_PDF_TEXT_EXTRACTION') 
          ? Boolean(map.get('ENABLE_PDF_TEXT_EXTRACTION')) 
          : this.config.enablePdfTextExtraction
      };
    } catch {
      // Безопасно игнорируем ошибки, остаемся на ENV конфиге
    }
  }

  /**
   * 🚀 Главная функция обработки файлов
   */
  async processFile(
    buffer: Buffer, 
    filename: string, 
    options: ProcessingOptions = {}
  ): Promise<ExtendedOcrResult> {
    await this.loadConfigFromSystemSettings();
    
    const startTime = Date.now();
    const fileExtension = filename.toLowerCase().split('.').pop();
    const mimeType = this.getMimeType(filename);
    const cls = classifyDocument(filename, mimeType);

    // === ОБРАБОТКА СТРУКТУРИРОВАННЫХ ФОРМАТОВ ===
    
    // CSV файлы
    if (fileExtension === 'csv' || mimeType === 'text/csv') {
      const text = buffer.toString('utf8');
      return {
        text,
        confidence: 1.0,
        words: [],
        provider: 'structured',
        processingTime: Date.now() - startTime,
        docType: cls.docType,
        bypassReason: 'structured_csv'
      };
    }

    // JSON файлы
    if (fileExtension === 'json' || mimeType === 'application/json') {
      const text = buffer.toString('utf8');
      return {
        text,
        confidence: 1.0,
        words: [],
        provider: 'structured',
        processingTime: Date.now() - startTime,
        docType: cls.docType,
        bypassReason: 'structured_json'
      };
    }

    // XML файлы
    if (fileExtension === 'xml' || mimeType === 'application/xml' || mimeType === 'text/xml') {
      const text = buffer.toString('utf8');
      return {
        text,
        confidence: 1.0,
        words: [],
        provider: 'structured',
        processingTime: Date.now() - startTime,
        docType: cls.docType,
        bypassReason: 'structured_xml'
      };
    }

    // Excel файлы
    if ((fileExtension === 'xlsx' || fileExtension === 'xls') && this.config.enableExcelProcessing) {
      const text = await processExcelBuffer(buffer);
      return {
        text,
        confidence: 1.0,
        words: [],
        provider: 'structured',
        processingTime: Date.now() - startTime,
        docType: cls.docType,
        bypassReason: 'structured_excel'
      };
    }

    // DOCX файлы
    if ((fileExtension === 'docx' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') 
        && mammoth && this.config.enableDocxProcessing) {
      try {
        const result = await mammoth.extractRawText({ buffer });
        return {
          text: result.value,
          confidence: 0.95,
          words: [],
          provider: 'structured',
          processingTime: Date.now() - startTime,
          docType: cls.docType,
          bypassReason: 'structured_docx'
        };
      } catch (error) {
        console.warn('Ошибка извлечения DOCX, используем Tesseract:', error);
      }
    }

    // TXT файлы
    if (fileExtension === 'txt' || mimeType === 'text/plain') {
      try {
        // Пытаемся разные кодировки
        let text = '';
        try {
          text = buffer.toString('utf8');
        } catch {
          try {
            // Используем latin1 вместо windows-1251 для совместимости с TypeScript
            text = buffer.toString('latin1');
          } catch {
            text = buffer.toString('ascii');
          }
        }
        
        return {
          text,
          confidence: 0.98,
          words: [],
          provider: 'structured',
          processingTime: Date.now() - startTime,
          docType: cls.docType
        };
      } catch (error) {
        console.warn('Ошибка обработки TXT, используем Tesseract:', error);
      }
    }

    // PDF файлы - пытаемся извлечь текст напрямую
    if (fileExtension === 'pdf') {
      if (this.config.enablePdfTextExtraction) {
        try {
          // Здесь можно добавить pdf-parse если нужно
          // const pdfParse = require('pdf-parse');
          // const data = await pdfParse(buffer);
          // if (data.text && data.text.length > 50) {
          //   return { text: data.text, confidence: 0.9, ... };
          // }
        } catch (error) {
          console.warn('Ошибка извлечения PDF, используем Tesseract:', error);
        }
      } else {
        // PDF OCR отключен
        return {
          text: '[PDF файл - OCR отключен]',
          confidence: 0.0,
          words: [],
          provider: 'structured',
          processingTime: Date.now() - startTime,
          docType: cls.docType,
          bypassReason: 'structured_pdf'
        };
      }
    }

    // === TESSERACT OCR ДЛЯ ИЗОБРАЖЕНИЙ И СЛОЖНЫХ ДОКУМЕНТОВ ===
    return await this.processWithTesseract(buffer, options, startTime, cls.docType);
  }

  /**
   * 🔍 Обработка через Tesseract OCR
   */
  private async processWithTesseract(
    buffer: Buffer, 
    options: ProcessingOptions, 
    startTime: number,
    docType?: string
  ): Promise<ExtendedOcrResult> {
    try {
      // Инициализируем worker если нужно
      if (!this.tesseractWorker) {
        console.log('🔧 Инициализация Tesseract worker...');
        this.tesseractWorker = await createWorker(this.config.tessractLanguages, 1, {
          logger: (m: any) => {
            if (m.status === 'recognizing text') {
              console.log(`📊 Tesseract: ${Math.round(m.progress * 100)}%`);
            }
          }
        });
      }

      console.log('🔍 Запуск Tesseract OCR...');
      const { data } = await this.tesseractWorker.recognize(buffer);
      
      const confidence = data.confidence / 100; // Tesseract возвращает в процентах
      
      console.log(`✅ Tesseract завершен. Уверенность: ${Math.round(confidence * 100)}%`);
      
      return {
        text: data.text,
        confidence,
        words: data.words || [],
        provider: 'tesseract',
        processingTime: Date.now() - startTime,
        docType
      };

    } catch (error) {
      console.error('❌ Ошибка Tesseract OCR:', error);
      throw new Error(`Tesseract OCR failed: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    }
  }

  /**
   * 🔧 Определение MIME типа
   */
  private getMimeType(filename: string): string {
    const extension = filename.toLowerCase().split('.').pop();
    
    const mimeTypes: Record<string, string> = {
      'pdf': 'application/pdf',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'tiff': 'image/tiff',
      'bmp': 'image/bmp',
      'csv': 'text/csv',
      'txt': 'text/plain',
      'json': 'application/json',
      'xml': 'application/xml',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'xls': 'application/vnd.ms-excel',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };
    
    return mimeTypes[extension!] || 'application/octet-stream';
  }

  /**
   * 📊 Статистика сервиса
   */
  async getStats(): Promise<{
    tesseractAvailable: boolean;
    configuration: SimplifiedOcrConfig;
    supportedFormats: string[];
  }> {
    return {
      tesseractAvailable: true,
      configuration: this.config,
      supportedFormats: [
        'PDF (через OCR)',
        'PNG, JPG, JPEG, TIFF, BMP (OCR)',
        'CSV (прямое чтение)',
        'JSON (прямое чтение)',
        'XML (прямое чтение)',
        'XLSX, XLS (структурный парсинг)',
        'DOCX (извлечение текста)',
        'TXT (прямое чтение)'
      ]
    };
  }

  /**
   * 🧹 Очистка ресурсов
   */
  async cleanup(): Promise<void> {
    if (this.tesseractWorker) {
      await this.tesseractWorker.terminate();
      this.tesseractWorker = null;
      console.log('🧹 Tesseract worker завершен');
    }
  }
}

export { SimplifiedOcrService, type ExtendedOcrResult, type ProcessingOptions };
export type { SimplifiedOcrConfig };