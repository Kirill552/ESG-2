/**
 * Интеллектуальный процессор файлов с автовыбором парсера
 * Реализует задачи 5.1.2-5.1.4: авто-выбор + fallback + логирование
 */

import { detectFormat, type FileFormatInfo, type ProcessingStrategy, ProcessingPriority, ParserType } from './format-detector';
import { processImageMultiLevel } from './multi-level-ocr-service';
import * as fs from 'fs';
import * as path from 'path';

// Интерфейсы для результатов парсинга
interface ParsingResult {
  text: string;
  confidence: number;
  source: string;
  processingTime: number;
  metadata?: Record<string, any>;
  warnings?: string[];
  errors?: string[];
}

interface ProcessingLog {
  filename: string;
  fileSize: number;
  detectedFormat: FileFormatInfo;
  strategy: ProcessingStrategy;
  attempts: Array<{
    parser: ParserType;
    result: 'success' | 'error' | 'low_confidence';
    confidence: number;
    processingTime: number;
    error?: string;
    textLength: number;
  }>;
  finalResult: ParsingResult;
  totalProcessingTime: number;
  timestamp: Date;
}

// Конфигурация процессора
interface ProcessingConfig {
  minConfidence: number;
  maxRetries: number;
  enableLogging: boolean;
  logDirectory: string;
  enableFallback: boolean;
  timeoutMs: number;
}

class IntelligentFileProcessor {
  private config: ProcessingConfig;
  private processingLogs: ProcessingLog[] = [];

  constructor(config: Partial<ProcessingConfig> = {}) {
    this.config = {
      minConfidence: 0.7,
      maxRetries: 3,
      enableLogging: true,
      logDirectory: './debug_output/processing_logs',
      enableFallback: true,
      timeoutMs: 30000,
      ...config
    };

    // Создаем директорию для логов если нужно
    if (this.config.enableLogging) {
      this.ensureLogDirectory();
    }
  }

  /**
   * Главная функция для обработки файла с интеллектуальным выбором парсера
   * Поддерживает оба варианта входа:
   * 1) processFile(filePath: string, customStrategy?)
   * 2) processFile(fileBuffer: Buffer, filename: string, customStrategy?)
   *
   * Также безопасно переживает ошибочные вызовы вида processFile(filePath, filename, strategy)
   * — в этом случае второй строковый аргумент игнорируется как дублирующее имя файла.
   */
  async processFile(
    input: string | Buffer,
    arg2?: string | Partial<ProcessingStrategy>,
    arg3?: Partial<ProcessingStrategy>
  ): Promise<ParsingResult> {
    const startTime = Date.now();

    // Нормализуем входные параметры
    let filename: string;
    let fileBuffer: Buffer;
    let customStrategy: Partial<ProcessingStrategy> | undefined;

    if (typeof input === 'string') {
      // Вариант 1: передан путь к файлу
      filename = path.basename(input);
      fileBuffer = fs.readFileSync(input);
      // Если второй аргумент — строка (часто ошибочно передают filename), игнорируем его как имя
      // и берём стратегию из третьего аргумента
      if (typeof arg2 === 'string') {
        customStrategy = arg3;
      } else {
        customStrategy = arg2;
      }
    } else {
      // Вариант 2: передан Buffer
      fileBuffer = input;
      if (typeof arg2 === 'string') {
        filename = arg2 || 'file.dat';
        customStrategy = arg3;
      } else {
        // Имя файла неизвестно — подставим заглушку
        filename = 'file.dat';
        customStrategy = arg2;
      }
    }

    const fileSize = fileBuffer.length;

    console.log(`🔍 Начинаем обработку файла: ${filename} (${fileSize} байт)`);

    // 1. Определяем формат и стратегию
  const formatInfo = detectFormat(filename, fileBuffer);
  const strategy = customStrategy ? { ...formatInfo.strategy, ...customStrategy } : formatInfo.strategy;

    console.log(`📋 Формат: ${formatInfo.extension.toUpperCase()}, Тип: ${formatInfo.type}`);
    console.log(`🎯 Стратегия: Приоритет=${strategy.priority}, Рекомендуемый=${strategy.recommendedParser}`);

    const log: ProcessingLog = {
      filename,
      fileSize,
      detectedFormat: formatInfo,
      strategy,
      attempts: [],
      finalResult: { text: '', confidence: 0, source: 'none', processingTime: 0 },
      totalProcessingTime: 0,
      timestamp: new Date()
    };

    let result: ParsingResult | null = null;
    let lastError: string = '';

    // 2. Пробуем парсеры по приоритету
    const parsersToTry = this.getParsersInOrder(strategy);
    
    for (const parserType of parsersToTry) {
      if (result && result.confidence >= this.config.minConfidence) {
        break; // Уже получили хороший результат
      }

      console.log(`🔄 Пробуем парсер: ${parserType.toUpperCase()}`);
      const attemptStart = Date.now();

      try {
  const attemptResult = await this.tryParser(parserType, filename, fileBuffer, formatInfo);
        const attemptTime = Date.now() - attemptStart;

        log.attempts.push({
          parser: parserType,
          result: attemptResult.confidence >= this.config.minConfidence ? 'success' : 'low_confidence',
          confidence: attemptResult.confidence,
          processingTime: attemptTime,
          textLength: attemptResult.text.length
        });

        console.log(`📊 Результат ${parserType}: уверенность=${(attemptResult.confidence * 100).toFixed(1)}%, текст=${attemptResult.text.length} симв., время=${attemptTime}мс`);

        if (!result || attemptResult.confidence > result.confidence) {
          result = attemptResult;
        }

        // Если достигли минимальной уверенности, можем остановиться
        if (attemptResult.confidence >= this.config.minConfidence) {
          console.log(`✅ Достигнута минимальная уверенность ${this.config.minConfidence}, используем результат`);
          break;
        }

      } catch (error) {
        const attemptTime = Date.now() - attemptStart;
        lastError = error instanceof Error ? error.message : String(error);
        
        log.attempts.push({
          parser: parserType,
          result: 'error',
          confidence: 0,
          processingTime: attemptTime,
          error: lastError,
          textLength: 0
        });

        console.log(`❌ Ошибка ${parserType}: ${lastError}`);
        
        if (!this.config.enableFallback) {
          break; // Прекращаем попытки если fallback отключен
        }
      }
    }

    // 3. Проверяем результат
    if (!result || result.text.length === 0) {
      result = {
        text: '',
        confidence: 0,
        source: 'failed',
        processingTime: Date.now() - startTime,
        errors: [`Все парсеры не смогли обработать файл. Последняя ошибка: ${lastError}`]
      };
    }

    // 4. Финализируем лог
    log.finalResult = result;
    log.totalProcessingTime = Date.now() - startTime;
    this.processingLogs.push(log);

    // 5. Сохраняем логи
    if (this.config.enableLogging) {
      await this.saveProcessingLog(log);
    }

    console.log(`🎉 Обработка завершена: ${result.text.length} символов, уверенность=${(result.confidence * 100).toFixed(1)}%, время=${log.totalProcessingTime}мс`);
    return result;
  }

  /**
   * Определяет порядок парсеров на основе стратегии
   */
  private getParsersInOrder(strategy: ProcessingStrategy): ParserType[] {
    const parsers: ParserType[] = [];
    
    // Добавляем рекомендуемый парсер первым
    if (strategy.recommendedParser && !parsers.includes(strategy.recommendedParser)) {
      parsers.push(strategy.recommendedParser);
    }

    // Добавляем fallback парсеры
    if (strategy.fallbackParsers) {
      for (const parser of strategy.fallbackParsers) {
        if (!parsers.includes(parser)) {
          parsers.push(parser);
        }
      }
    }

    // Добавляем стандартную последовательность в зависимости от приоритета
    const standardSequence = this.getStandardParserSequence(strategy.priority);
    for (const parser of standardSequence) {
      if (!parsers.includes(parser)) {
        parsers.push(parser);
      }
    }

    return parsers;
  }

  /**
   * Стандартная последовательность парсеров по приоритету
   */
  private getStandardParserSequence(priority: ProcessingPriority): ParserType[] {
    switch (priority) {
      case ProcessingPriority.STRUCTURAL:
        return ['pdf-parse', 'xlsx', 'docx', 'text', 'ocr'];
      
      case ProcessingPriority.TEXTUAL:
        return ['text', 'docx', 'pdf-parse', 'xlsx', 'ocr'];
      
      case ProcessingPriority.OCR:
        return ['ocr', 'text', 'pdf-parse', 'docx', 'xlsx'];
      
      case ProcessingPriority.HYBRID:
      default:
        return ['pdf-parse', 'docx', 'xlsx', 'text', 'ocr'];
    }
  }

  /**
   * Пробует конкретный парсер
   */
  private async tryParser(
    parserType: ParserType, 
    filePath: string, 
    fileBuffer: Buffer,
    formatInfo: FileFormatInfo
  ): Promise<ParsingResult> {
    const startTime = Date.now();
    
    switch (parserType) {
      case 'ocr':
        return await this.tryOCRParser(fileBuffer, formatInfo);
      
      case 'pdf-parse':
        return await this.tryPDFParser(fileBuffer);
      
      case 'xlsx':
        return await this.tryExcelParser(fileBuffer);
      
      case 'docx':
        return await this.tryDocxParser(fileBuffer);
      
      case 'text':
        return await this.tryTextParser(fileBuffer, formatInfo);
      
      default:
        throw new Error(`Неподдерживаемый тип парсера: ${parserType}`);
    }
  }

  /**
   * OCR парсер через многоуровневую систему
   */
  private async tryOCRParser(fileBuffer: Buffer, formatInfo: FileFormatInfo): Promise<ParsingResult> {
    try {
      const result = await processImageMultiLevel(fileBuffer, {
        preferredSource: 'auto',
        enableFallback: true,
        minConfidence: 0.3
      });

      return {
        text: result.text,
        confidence: result.confidence,
        source: `ocr_${result.source}`,
        processingTime: result.processingTime || 0,
        metadata: {
          words: result.words?.length || 0,
          ocrEngine: result.source
        }
      };
    } catch (error) {
      throw new Error(`OCR парсер не смог обработать файл: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * PDF парсер
   */
  private async tryPDFParser(fileBuffer: Buffer): Promise<ParsingResult> {
    try {
      // Загружаем pdf-parse динамически 
      const pdfParseModule = await import('pdf-parse');
      const pdfParse = (pdfParseModule as any).default || pdfParseModule;
      const result = await pdfParse(fileBuffer);

      return {
        text: result.text,
        confidence: result.text.length > 0 ? 0.9 : 0.1,
        source: 'pdf-parse',
        processingTime: 0,
        metadata: {
          pages: result.numpages,
          info: result.info
        }
      };
    } catch (error) {
      throw new Error(`PDF парсер не смог обработать файл: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Excel парсер
   */
  private async tryExcelParser(fileBuffer: Buffer): Promise<ParsingResult> {
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      
      let allText = '';
      let sheetCount = 0;
      
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(sheet);
        allText += `\n=== ${sheetName} ===\n${csv}\n`;
        sheetCount++;
      }

      return {
        text: allText.trim(),
        confidence: allText.length > 0 ? 0.95 : 0.1,
        source: 'xlsx',
        processingTime: 0,
        metadata: {
          sheets: sheetCount,
          sheetNames: workbook.SheetNames
        }
      };
    } catch (error) {
      throw new Error(`Excel парсер не смог обработать файл: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Word документ парсер
   */
  private async tryDocxParser(fileBuffer: Buffer): Promise<ParsingResult> {
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      
      const warnings = result.messages.map((message) => message.message);

      return {
        text: result.value,
        confidence: result.value.length > 0 ? 0.9 : 0.1,
        source: 'docx',
        processingTime: 0,
        metadata: {
          warnings
        },
        warnings
      };
    } catch (error) {
      throw new Error(`Word парсер не смог обработать файл: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Текстовый парсер
   */
  private async tryTextParser(fileBuffer: Buffer, formatInfo: FileFormatInfo): Promise<ParsingResult> {
    try {
      // Пробуем разные кодировки
      const encodings = ['utf8', 'win1251', 'cp866'];
      let bestResult: { text: string; confidence: number } = { text: '', confidence: 0 };
      
      for (const encoding of encodings) {
        try {
          const text = fileBuffer.toString(encoding as BufferEncoding);
          const confidence = this.evaluateTextQuality(text);
          
          if (confidence > bestResult.confidence) {
            bestResult = { text, confidence };
          }
        } catch (error) {
          // Пропускаем некорректные кодировки
        }
      }

      return {
        text: bestResult.text,
        confidence: bestResult.confidence,
        source: 'text',
        processingTime: 0,
        metadata: {
          detectedEncoding: 'auto',
          fileExtension: formatInfo.extension
        }
      };
    } catch (error) {
      throw new Error(`Текстовый парсер не смог обработать файл: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Оценивает качество текста (для выбора кодировки)
   */
  private evaluateTextQuality(text: string): number {
    if (!text || text.length === 0) return 0;
    
    // Проверяем на наличие русских символов
    const russianChars = (text.match(/[а-яёА-ЯЁ]/g) || []).length;
    const totalChars = text.length;
    const russianRatio = russianChars / totalChars;
    
    // Проверяем на наличие "мусорных" символов
    const garbageChars = (text.match(/[^\x20-\x7E\u0400-\u04FF\n\r\t]/g) || []).length;
    const garbageRatio = garbageChars / totalChars;
    
    // Базовая уверенность на основе длины
    let confidence = Math.min(text.length / 100, 1.0);
    
    // Бонус за русский текст
    confidence += russianRatio * 0.3;
    
    // Штраф за мусорные символы
    confidence -= garbageRatio * 0.5;
    
    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Создает директорию для логов
   */
  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.config.logDirectory)) {
      fs.mkdirSync(this.config.logDirectory, { recursive: true });
    }
  }

  /**
   * Сохраняет лог обработки
   */
  private async saveProcessingLog(log: ProcessingLog): Promise<void> {
    try {
      const timestamp = log.timestamp.toISOString().replace(/[:.]/g, '-');
      const logFile = path.join(this.config.logDirectory, `${timestamp}_${log.filename}.json`);
      
      fs.writeFileSync(logFile, JSON.stringify(log, null, 2), 'utf8');
      
      // Также сохраняем краткую сводку
      const summaryFile = path.join(this.config.logDirectory, 'processing_summary.json');
      let summary: any[] = [];
      
      if (fs.existsSync(summaryFile)) {
        try {
          summary = JSON.parse(fs.readFileSync(summaryFile, 'utf8'));
        } catch (error) {
          summary = [];
        }
      }
      
      summary.push({
        filename: log.filename,
        timestamp: log.timestamp,
        success: log.finalResult.confidence >= this.config.minConfidence,
        confidence: log.finalResult.confidence,
        processingTime: log.totalProcessingTime,
        attempts: log.attempts.length,
        finalParser: log.finalResult.source
      });
      
      // Храним только последние 1000 записей
      if (summary.length > 1000) {
        summary = summary.slice(-1000);
      }
      
      fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2), 'utf8');
      
    } catch (error) {
      console.error('Ошибка при сохранении лога:', error);
    }
  }

  /**
   * Получает статистику обработки
   */
  getProcessingStats() {
    const total = this.processingLogs.length;
    if (total === 0) return null;

    const successful = this.processingLogs.filter(log => 
      log.finalResult.confidence >= this.config.minConfidence).length;
    
    const avgProcessingTime = this.processingLogs.reduce((sum, log) => 
      sum + log.totalProcessingTime, 0) / total;
    
    const parserStats: Record<string, number> = {};
    this.processingLogs.forEach(log => {
      const parser = log.finalResult.source;
      parserStats[parser] = (parserStats[parser] || 0) + 1;
    });

    return {
      totalFiles: total,
      successfulFiles: successful,
      successRate: (successful / total * 100).toFixed(1) + '%',
      avgProcessingTime: Math.round(avgProcessingTime),
      parserUsage: parserStats
    };
  }
}

// Экспортируем основные функции
export { IntelligentFileProcessor, type ParsingResult, type ProcessingConfig, type ProcessingLog };

/**
 * Основная функция для обработки файла с умной маршрутизацией
 */
export async function processFileIntelligently(
  filePath: string, 
  config?: Partial<ProcessingConfig>
): Promise<ParsingResult> {
  const processor = new IntelligentFileProcessor(config);
  return await processor.processFile(filePath);
}

/**
 * Пакетная обработка файлов
 */
export async function processBatch(
  filePaths: string[], 
  config?: Partial<ProcessingConfig>
): Promise<ParsingResult[]> {
  const processor = new IntelligentFileProcessor(config);
  const results: ParsingResult[] = [];
  
  console.log(`🚀 Начинаем пакетную обработку ${filePaths.length} файлов`);
  
  for (let i = 0; i < filePaths.length; i++) {
    const filePath = filePaths[i];
    console.log(`\n📄 Обрабатываем файл ${i + 1}/${filePaths.length}: ${path.basename(filePath)}`);
    
    try {
      const result = await processor.processFile(filePath);
      results.push(result);
    } catch (error) {
      console.error(`❌ Ошибка при обработке ${filePath}:`, error);
      results.push({
        text: '',
        confidence: 0,
        source: 'error',
        processingTime: 0,
        errors: [error instanceof Error ? error.message : String(error)]
      });
    }
  }
  
  // Выводим итоговую статистику
  const stats = processor.getProcessingStats();
  if (stats) {
    console.log(`\n📊 Итоговая статистика пакетной обработки:`);
    console.log(`   Успешно обработано: ${stats.successfulFiles}/${stats.totalFiles} (${stats.successRate})`);
    console.log(`   Среднее время обработки: ${stats.avgProcessingTime}мс`);
    console.log(`   Использование парсеров:`, stats.parserUsage);
  }
  
  return results;
}