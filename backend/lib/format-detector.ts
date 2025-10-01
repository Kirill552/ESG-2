/**
 * Детектор формата файлов для автоматического определения типа документа
 * Поддерживает российские документы и специфичные форматы
 */

// Типы парсеров
export type ParserType = 'ocr' | 'pdf-parse' | 'xlsx' | 'docx' | 'text' | 'csv' | 'json';

// Приоритеты обработки
export enum ProcessingPriority {
  STRUCTURAL = 'structural',    // структурированные данные (CSV, Excel)
  TEXTUAL = 'textual',         // текстовые документы (DOCX, PDF с текстом)
  OCR = 'ocr',                 // изображения и сканы
  HYBRID = 'hybrid'            // комбинированный подход
}

// Стратегия обработки
export interface ProcessingStrategy {
  priority: ProcessingPriority;
  recommendedParser?: ParserType;
  fallbackParsers?: ParserType[];
  minConfidence?: number;
  timeoutMs?: number;
}

export interface FileFormatInfo {
  format: 'csv' | 'tsv' | 'excel' | 'json' | 'txt' | 'pdf' | 'html' | 'docx' | 'odt' | 'rtf' | 'office' | 'unknown';
  extension: string;
  type: string; 
  confidence: number;
  encoding?: string;
  mimeType?: string;
  subFormat?: string; // например: "xlsx", "xls", "html5"
  characteristics: {
    hasStructure: boolean;
    isTextBased: boolean;
    requiresOcr: boolean;
    supportedByParser: boolean;
  };
  strategy: ProcessingStrategy;
  recommendedParser?: string;
  fallbackOptions?: string[];
}

export interface DetectionOptions {
  sampleSize?: number; // размер выборки для анализа (по умолчанию 2048 байт)
  strictMode?: boolean; // строгий режим определения
  checkMagicBytes?: boolean; // проверка магических байтов
  analyzeContent?: boolean; // анализ содержимого
}

/**
 * Магические байты для различных форматов
 */
const MAGIC_BYTES = {
  pdf: [0x25, 0x50, 0x44, 0x46], // %PDF
  xlsx: [0x50, 0x4B], // PK (ZIP archive)
  docx: [0x50, 0x4B], // PK (ZIP archive) 
  odt: [0x50, 0x4B], // PK (ZIP archive)
  rtf: [0x7B, 0x5C, 0x72, 0x74, 0x66], // {\rtf
  html: [0x3C, 0x68, 0x74, 0x6D, 0x6C], // <html
  xml: [0x3C, 0x3F, 0x78, 0x6D, 0x6C], // <?xml
};

/**
 * MIME типы для форматов
 */
const MIME_TYPES = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'excel',
  'application/vnd.ms-excel': 'excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.oasis.opendocument.text': 'odt',
  'application/rtf': 'rtf',
  'text/rtf': 'rtf',
  'text/html': 'html',
  'application/json': 'json',
  'text/json': 'json',
  'text/csv': 'csv',
  'text/tab-separated-values': 'tsv',
  'text/plain': 'txt',
  'application/xml': 'xml',
  'text/xml': 'xml'
};

export class FormatDetector {
  /**
   * Определяет формат файла по имени, содержимому и MIME типу
   */
  static detectFormat(
    filename: string,
    buffer: Buffer,
    mimeType?: string,
    options: DetectionOptions = {}
  ): FileFormatInfo {
    const opts = {
      sampleSize: 2048,
      strictMode: false,
      checkMagicBytes: true,
      analyzeContent: true,
      ...options
    };

    // Извлекаем расширение файла
    const extension = filename.toLowerCase().split('.').pop() || '';
    
    // Получаем выборку для анализа
    const sampleSize = Math.min(opts.sampleSize, buffer.length);
    const sample = buffer.slice(0, sampleSize);
    
    console.log(`🔍 Format Detector: analyzing ${filename} (${buffer.length} bytes, ext: ${extension})`);

    // 1. Проверка по MIME типу (если предоставлен)
    if (mimeType && MIME_TYPES[mimeType]) {
      const format = MIME_TYPES[mimeType] as any;
      console.log(`🔍 Format Detector: MIME type suggests ${format}`);
      
      const info = this.createFormatInfo(format, 0.9, { subFormat: extension });
      if (opts.strictMode || info.confidence > 0.8) {
        return info;
      }
    }

    // 2. Проверка магических байтов
    if (opts.checkMagicBytes) {
      const magicResult = this.checkMagicBytes(sample);
      if (magicResult.format !== 'unknown') {
        console.log(`🔍 Format Detector: magic bytes suggest ${magicResult.format}`);
        
        // Дополнительная проверка для ZIP-based форматов
        if (magicResult.format === 'xlsx' && this.isExcelFile(sample, extension)) {
          return this.createFormatInfo('excel', 0.95, { subFormat: extension });
        }
        if (magicResult.format === 'docx') {
          return this.createFormatInfo('docx', 0.95, { subFormat: extension });
        }
        if (magicResult.format === 'odt') {
          return this.createFormatInfo('odt', 0.95, { subFormat: extension });
        }
        
        return this.createFormatInfo(magicResult.format as any, magicResult.confidence);
      }
    }

    // 3. Анализ по расширению файла
    const extensionResult = this.analyzeByExtension(extension);
    if (extensionResult.format !== 'unknown') {
      console.log(`🔍 Format Detector: extension suggests ${extensionResult.format}`);
    }

    // 4. Анализ содержимого
    let contentResult = { format: 'unknown' as any, confidence: 0 };
    if (opts.analyzeContent) {
      contentResult = this.analyzeContent(sample);
      if (contentResult.format !== 'unknown') {
        console.log(`🔍 Format Detector: content analysis suggests ${contentResult.format}`);
      }
    }

    // 5. Выбираем лучший результат
    const candidates = [extensionResult, contentResult].filter(r => r.format !== 'unknown');
    
    if (candidates.length === 0) {
      console.log(`🔍 Format Detector: no format detected, defaulting to txt`);
      return this.createFormatInfo('txt', 0.3);
    }

    const bestResult = candidates.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );

    console.log(`🔍 Format Detector: best match is ${bestResult.format} (confidence: ${bestResult.confidence})`);
    
    return this.createFormatInfo(bestResult.format, bestResult.confidence, { 
      subFormat: extension,
      encoding: this.detectEncoding(sample)
    });
  }

  /**
   * Проверяет магические байты
   */
  private static checkMagicBytes(sample: Buffer): { format: string; confidence: number } {
    // PDF
    if (this.matchesBytes(sample, MAGIC_BYTES.pdf, 0)) {
      return { format: 'pdf', confidence: 1.0 };
    }

    // RTF
    if (this.matchesBytes(sample, MAGIC_BYTES.rtf, 0)) {
      return { format: 'rtf', confidence: 1.0 };
    }

    // HTML
    const text = sample.toString('utf8', 0, Math.min(100, sample.length)).toLowerCase();
    if (text.includes('<html') || text.includes('<!doctype html')) {
      return { format: 'html', confidence: 0.9 };
    }

    // XML with XML declaration
    if (this.matchesBytes(sample, MAGIC_BYTES.xml, 0)) {
      return { format: 'xml', confidence: 0.9 };
    }

    // ZIP-based formats (XLSX, DOCX, ODT)
    if (this.matchesBytes(sample, MAGIC_BYTES.xlsx, 0)) {
      return { format: 'xlsx', confidence: 0.7 }; // Нужна дополнительная проверка
    }

    return { format: 'unknown', confidence: 0 };
  }

  /**
   * Проверяет, является ли ZIP-архив Excel файлом
   */
  private static isExcelFile(sample: Buffer, extension: string): boolean {
    // Проверяем расширение
    if (['xlsx', 'xls'].includes(extension)) {
      return true;
    }

    // Можно добавить проверку содержимого ZIP архива в будущем
    return false;
  }

  /**
   * Анализирует формат по расширению файла
   */
  private static analyzeByExtension(extension: string): { format: any; confidence: number } {
    const extensionMap: { [key: string]: { format: any; confidence: number } } = {
      'csv': { format: 'csv', confidence: 0.9 },
      'tsv': { format: 'tsv', confidence: 0.9 },
      'xlsx': { format: 'excel', confidence: 0.9 },
      'xls': { format: 'excel', confidence: 0.9 },
      'json': { format: 'json', confidence: 0.9 },
      'pdf': { format: 'pdf', confidence: 0.9 },
      'html': { format: 'html', confidence: 0.8 },
      'htm': { format: 'html', confidence: 0.8 },
      'docx': { format: 'docx', confidence: 0.8 },
      'odt': { format: 'odt', confidence: 0.8 },
      'rtf': { format: 'rtf', confidence: 0.8 },
      'txt': { format: 'txt', confidence: 0.7 },
      'xml': { format: 'xml', confidence: 0.8 }
    };

    return extensionMap[extension] || { format: 'unknown', confidence: 0 };
  }

  /**
   * Анализирует содержимое файла
   */
  private static analyzeContent(sample: Buffer): { format: any; confidence: number } {
    const text = sample.toString('utf8', 0, Math.min(1000, sample.length));
    
    // JSON
    if (this.looksLikeJson(text)) {
      return { format: 'json', confidence: 0.8 };
    }

    // CSV/TSV
    const csvScore = this.analyzeCsvStructure(text);
    if (csvScore > 0.5) {
      const delimiter = this.detectCsvDelimiter(text);
      return { 
        format: delimiter === '\t' ? 'tsv' : 'csv', 
        confidence: csvScore 
      };
    }

    // HTML
    if (text.toLowerCase().includes('<html') || text.toLowerCase().includes('<!doctype')) {
      return { format: 'html', confidence: 0.8 };
    }

    // XML
    if (text.trim().startsWith('<?xml') || text.includes('<root>') || text.includes('</')) {
      return { format: 'xml', confidence: 0.7 };
    }

    return { format: 'unknown', confidence: 0 };
  }

  /**
   * Проверяет, похож ли текст на JSON
   */
  private static looksLikeJson(text: string): boolean {
    const trimmed = text.trim();
    
    // Начинается с { или [
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      return false;
    }

    try {
      JSON.parse(trimmed);
      return true;
    } catch {
      // Может быть неполный JSON в выборке
      const jsonIndicators = ['":', '",', '"}', '"]', '"[', '"{']; 
      return jsonIndicators.some(indicator => trimmed.includes(indicator));
    }
  }

  /**
   * Анализирует CSV структуру
   */
  private static analyzeCsvStructure(text: string): number {
    const lines = text.split('\n').slice(0, 10); // Первые 10 строк
    if (lines.length < 2) return 0;

    const delimiters = [',', ';', '\t', '|'];
    let bestScore = 0;

    delimiters.forEach(delimiter => {
      const counts = lines.map(line => (line.match(new RegExp(`\\${delimiter}`, 'g')) || []).length);
      const avgCount = counts.reduce((a, b) => a + b, 0) / counts.length;
      const variance = counts.reduce((sum, count) => sum + Math.pow(count - avgCount, 2), 0) / counts.length;
      
      // Консистентность структуры
      const consistencyScore = avgCount > 0 ? Math.min(avgCount / (1 + variance), 1) : 0;
      bestScore = Math.max(bestScore, consistencyScore);
    });

    return Math.min(bestScore / 3, 0.9); // Нормализуем
  }

  /**
   * Определяет разделитель CSV
   */
  private static detectCsvDelimiter(text: string): string {
    const sample = text.split('\n').slice(0, 5).join('\n');
    const delimiters = [',', ';', '\t', '|'];
    
    let bestDelimiter = ',';
    let bestScore = 0;

    delimiters.forEach(delimiter => {
      const count = (sample.match(new RegExp(`\\${delimiter}`, 'g')) || []).length;
      if (count > bestScore) {
        bestScore = count;
        bestDelimiter = delimiter;
      }
    });

    return bestDelimiter;
  }

  /**
   * Определяет кодировку
   */
  private static detectEncoding(sample: Buffer): string {
    const text = sample.toString('utf8', 0, Math.min(1000, sample.length));
    
    // Проверяем наличие русских символов в UTF-8
    if (/[а-яё]/i.test(text)) {
      return 'utf8';
    }
    
    // Проверяем CP1251 (упрощенно)
    try {
      const cp1251Text = sample.toString('binary', 0, Math.min(1000, sample.length));
      if (cp1251Text.includes('р') || cp1251Text.includes('с') || cp1251Text.includes('т')) {
        return 'cp1251';
      }
    } catch {}
    
    return 'utf8';
  }

  /**
   * Проверяет соответствие байтов
   */
  private static matchesBytes(buffer: Buffer, pattern: number[], offset: number = 0): boolean {
    if (buffer.length < offset + pattern.length) return false;
    
    for (let i = 0; i < pattern.length; i++) {
      if (buffer[offset + i] !== pattern[i]) return false;
    }
    
    return true;
  }

  /**
   * Создает объект информации о формате
   */
  private static createFormatInfo(
    format: FileFormatInfo['format'], 
    confidence: number, 
    extra: Partial<FileFormatInfo> = {}
  ): FileFormatInfo {
    const characteristics = this.getFormatCharacteristics(format);
    
    return {
      format,
      confidence: Math.min(confidence, 0.99),
      characteristics,
      ...extra
    };
  }

  /**
   * Возвращает характеристики формата
   */
  private static getFormatCharacteristics(format: FileFormatInfo['format']) {
    const formatMap = {
      // Структурированные форматы (приоритет 1) - 100% покрытие
      csv: { hasStructure: true, isTextBased: true, requiresOcr: false, supportedByParser: true },
      tsv: { hasStructure: true, isTextBased: true, requiresOcr: false, supportedByParser: true },
      excel: { hasStructure: true, isTextBased: false, requiresOcr: false, supportedByParser: true },
      json: { hasStructure: true, isTextBased: true, requiresOcr: false, supportedByParser: true },
      xml: { hasStructure: true, isTextBased: true, requiresOcr: false, supportedByParser: true },
      
      // Текстовые форматы (приоритет 2) - структурные парсеры 2025
      txt: { hasStructure: false, isTextBased: true, requiresOcr: false, supportedByParser: true },
      html: { hasStructure: true, isTextBased: true, requiresOcr: false, supportedByParser: true },
      office: { hasStructure: true, isTextBased: false, requiresOcr: false, supportedByParser: true },
      docx: { hasStructure: true, isTextBased: false, requiresOcr: false, supportedByParser: true },
      odt: { hasStructure: true, isTextBased: false, requiresOcr: false, supportedByParser: true },
      rtf: { hasStructure: false, isTextBased: true, requiresOcr: false, supportedByParser: true },
      
      // PDF форматы (приоритет 3) - PDF парсер + OCR fallback
      pdf: { hasStructure: false, isTextBased: false, requiresOcr: true, supportedByParser: true },
      
      // Неизвестные (приоритет 4) - только OCR
      unknown: { hasStructure: false, isTextBased: false, requiresOcr: true, supportedByParser: false }
    };

    return formatMap[format] || formatMap.unknown;
  }

  /**
   * Получает рекомендуемый парсер для формата с fallback опциями
   */
  static getRecommendedParser(formatInfo: FileFormatInfo): string | null {
    if (!formatInfo.characteristics.supportedByParser) {
      return null;
    }

    const parserMap = {
      // Структурированные форматы (приоритет 1)
      csv: 'CsvTsvParser',
      tsv: 'CsvTsvParser',
      excel: 'ExcelParser',
      json: 'JsonParser',
      xml: 'XmlParser',
      
      // Текстовые форматы (приоритет 2)
      txt: 'TxtParser',
      html: 'HtmlParser',
      office: 'OfficeParser',
      docx: 'OfficeParser',
      odt: 'OfficeParser', 
      rtf: 'RtfParser',
      
      // PDF форматы (приоритет 3)
      pdf: 'PdfParser'
    };

    return parserMap[formatInfo.format] || null;
  }

  /**
   * Получает стратегию обработки с fallback опциями
   */
  static getProcessingStrategy(formatInfo: FileFormatInfo): {
    primaryParser: string | null;
    fallbackParsers: string[];
    requiresOcr: boolean;
    processingPriority: 'structural' | 'textual' | 'ocr';
  } {
    const strategy = {
      primaryParser: this.getRecommendedParser(formatInfo),
      fallbackParsers: [] as string[],
      requiresOcr: formatInfo.characteristics.requiresOcr,
      processingPriority: 'ocr' as const
    };

    // Определяем приоритет обработки и fallback стратегии
    if (formatInfo.characteristics.hasStructure && !formatInfo.characteristics.requiresOcr) {
      // Структурированные форматы - наивысший приоритет
      strategy.processingPriority = 'structural';
      strategy.fallbackParsers = ['TxtParser']; // fallback на текстовый если не парсится
      
    } else if (formatInfo.characteristics.isTextBased && !formatInfo.characteristics.requiresOcr) {
      // Текстовые форматы - средний приоритет
      strategy.processingPriority = 'textual';
      strategy.fallbackParsers = ['TxtParser']; // простой текстовый fallback
      
    } else {
      // OCR требуется - низкий приоритет
      strategy.processingPriority = 'ocr';
      strategy.fallbackParsers = [];
      
      // Для PDF пробуем сначала извлечь текст, потом OCR
      if (formatInfo.format === 'pdf') {
        strategy.fallbackParsers = ['MultiLevelOcrService'];
      }
    }

    return strategy;
  }

  /**
   * Проверяет, нужен ли OCR для формата
   */
  static requiresOcr(formatInfo: FileFormatInfo): boolean {
    return formatInfo.characteristics.requiresOcr;
  }

  /**
   * Логирует результаты детекции формата
   */
  static logDetectionResult(
    filename: string, 
    formatInfo: FileFormatInfo, 
    strategy: ReturnType<typeof FormatDetector.getProcessingStrategy>,
    processingTime?: number
  ): void {
    const logData = {
      timestamp: new Date().toISOString(),
      filename,
      detection: {
        format: formatInfo.format,
        confidence: formatInfo.confidence,
        encoding: formatInfo.encoding,
        subFormat: formatInfo.subFormat
      },
      characteristics: formatInfo.characteristics,
      processing: {
        primaryParser: strategy.primaryParser,
        fallbackParsers: strategy.fallbackParsers,
        priority: strategy.processingPriority,
        requiresOcr: strategy.requiresOcr
      },
      performance: {
        detectionTimeMs: processingTime
      }
    };

    console.log(`📊 Format Detection Result: ${JSON.stringify(logData, null, 2)}`);

    // В продакшене можно отправлять в систему метрик
    if (process.env.NODE_ENV === 'production') {
      // TODO: отправка метрик в Yandex Cloud Monitoring
    }
  }

  /**
   * Получает статистику поддерживаемых форматов
   */
  static getSupportedFormatsStats(): {
    totalFormats: number;
    structuralFormats: number;
    textualFormats: number;
    ocrFormats: number;
    supportedByParsers: number;
  } {
    const allFormats: FileFormatInfo['format'][] = [
      'csv', 'tsv', 'excel', 'json', 'txt', 'html', 'office', 'docx', 'odt', 'rtf', 'pdf'
    ];

    let structuralFormats = 0;
    let textualFormats = 0;
    let ocrFormats = 0;
    let supportedByParsers = 0;

    allFormats.forEach(format => {
      const characteristics = this.getFormatCharacteristics(format);
      
      if (characteristics.hasStructure) structuralFormats++;
      if (characteristics.isTextBased) textualFormats++;
      if (characteristics.requiresOcr) ocrFormats++;
      if (characteristics.supportedByParser) supportedByParsers++;
    });

    return {
      totalFormats: allFormats.length,
      structuralFormats,
      textualFormats,
      ocrFormats,
      supportedByParsers
    };
  }
}

/**
 * Основная функция для определения формата файла
 * @param filePath - путь к файлу
 * @param fileBuffer - буфер файла (опционально)
 * @param options - опции детектирования
 * @returns информация о формате файла
 */
export function detectFormat(filePath: string, fileBuffer?: Buffer, options?: DetectionOptions): FileFormatInfo {
  // Простая реализация для совместимости
  const extension = filePath.toLowerCase().substring(filePath.lastIndexOf('.'));
  
  let format: FileFormatInfo['format'] = 'unknown';
  let priority = ProcessingPriority.HYBRID;
  let recommendedParser: ParserType = 'text';
  
  // Определяем формат по расширению
  switch (extension) {
    case '.pdf':
      format = 'pdf';
      priority = ProcessingPriority.TEXTUAL;
      recommendedParser = 'pdf-parse';
      break;
    case '.xlsx':
    case '.xls':
      format = 'excel';
      priority = ProcessingPriority.STRUCTURAL;
      recommendedParser = 'xlsx';
      break;
    case '.docx':
    case '.doc':
      format = 'docx';
      priority = ProcessingPriority.TEXTUAL;
      recommendedParser = 'docx';
      break;
    case '.csv':
      format = 'csv';
      priority = ProcessingPriority.STRUCTURAL;
      recommendedParser = 'text';
      break;
    case '.txt':
      format = 'txt';
      priority = ProcessingPriority.TEXTUAL;
      recommendedParser = 'text';
      break;
    case '.jpg':
    case '.jpeg':
    case '.png':
    case '.gif':
    case '.bmp':
    case '.tiff':
      format = 'unknown';
      priority = ProcessingPriority.OCR;
      recommendedParser = 'ocr';
      break;
    default:
      format = 'txt';
      priority = ProcessingPriority.TEXTUAL;
      recommendedParser = 'text';
  }
  
  return {
    format,
    extension,
    type: format,
    confidence: 0.8,
    characteristics: {
      hasStructure: priority === ProcessingPriority.STRUCTURAL,
      isTextBased: priority === ProcessingPriority.TEXTUAL,
      requiresOcr: priority === ProcessingPriority.OCR,
      supportedByParser: true
    },
    strategy: {
      priority,
      recommendedParser,
      fallbackParsers: priority === ProcessingPriority.OCR ? ['text'] : ['ocr'],
      minConfidence: 0.3,
      timeoutMs: 30000
    }
  };
}