/**
 * Hybrid OCR Service - Интеллектуальная маршрутизация между различными OCR провайдерами
 * Поддерживает: Tesseract.js, Yandex Vision (планируется), GigaChat (планируется)
 */

import { createWorker, Worker } from 'tesseract.js';
import { FormatDetector, FormatDetectionResult } from './format-detector';
import { Logger } from './logger';
import { getCurrentUserMode } from './user-mode-utils';

// Импорт Sharp для предобработки изображений (опционально)
let sharp: any = null;
try {
  sharp = require('sharp');
} catch {
  // Sharp недоступен, предобработка изображений отключена
}

const logger = new Logger('hybrid-ocr');

export interface OCRProvider {
  name: string;
  priority: number; // 1 = высший приоритет
  supportedFormats: string[];
  maxFileSize: number; // в байтах
  costPerPage?: number; // стоимость за страницу (для планирования)
  available: boolean;
}

export interface OCRResult {
  text: string;
  confidence: number;
  provider: string;
  processingTime: number;
  extractedData?: {
    fuel_data?: any[];
    electricity_data?: any[];
    gas_data?: any[];
    transport_data?: any[];
    structured_data?: any[];
  };
  metadata?: {
    pageCount?: number;
    language?: string;
    encoding?: string;
    wordCount?: number;
  };
}

export interface OCROptions {
  preferredProvider?: string;
  maxRetries?: number;
  timeout?: number;
  language?: string;
  preprocessImage?: boolean;
  extractStructuredData?: boolean;
  userMode?: 'DEMO' | 'TRIAL' | 'PAID' | 'EXPIRED';
}

/**
 * Конфигурация провайдеров OCR
 */
const OCR_PROVIDERS: Record<string, OCRProvider> = {
  tesseract: {
    name: 'Tesseract.js',
    priority: 3,
    supportedFormats: ['image/jpeg', 'image/png', 'image/tiff', 'image/bmp'],
    maxFileSize: 50 * 1024 * 1024, // 50MB
    costPerPage: 0, // Бесплатно
    available: true
  },

  yandex_vision: {
    name: 'Yandex Vision',
    priority: 2,
    supportedFormats: ['image/jpeg', 'image/png', 'image/tiff', 'application/pdf'],
    maxFileSize: 20 * 1024 * 1024, // 20MB
    costPerPage: 0.01, // 1 копейка за страницу
    available: false // Пока отключено
  },

  gigachat: {
    name: 'GigaChat Vision',
    priority: 1,
    supportedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
    maxFileSize: 10 * 1024 * 1024, // 10MB
    costPerPage: 0.05, // 5 копеек за страницу
    available: false // Пока отключено
  }
};

export class HybridOCRService {
  private tesseractWorker: Worker | null = null;
  private isInitialized = false;

  constructor() {
    this.initializeProviders();
  }

  /**
   * Инициализация провайдеров OCR
   */
  private async initializeProviders(): Promise<void> {
    try {
      logger.info('Инициализация провайдеров OCR...');

      // Инициализация Tesseract
      if (OCR_PROVIDERS.tesseract.available) {
        await this.initializeTesseract();
      }

      // TODO: Инициализация Yandex Vision
      // TODO: Инициализация GigaChat

      this.isInitialized = true;
      logger.info('Провайдеры OCR инициализированы успешно', {
        availableProviders: Object.keys(OCR_PROVIDERS).filter(p => OCR_PROVIDERS[p].available)
      });

    } catch (error) {
      logger.error('Ошибка инициализации провайдеров OCR', error);
      throw error;
    }
  }

  /**
   * Инициализация Tesseract worker
   */
  private async initializeTesseract(): Promise<void> {
    try {
      this.tesseractWorker = await createWorker('rus+eng', 1, {
        logger: (m) => {
          if (process.env.DEBUG_OCR === 'true') {
            logger.debug('Tesseract:', m);
          }
        }
      });

      // Настройка параметров для русского текста и таблиц
      await this.tesseractWorker.setParameters({
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюя.,;:!?-()[]{}"\' \t\n',
        preserve_interword_spaces: '1',
        tessedit_pageseg_mode: '6' // Uniform block of text
      });

      logger.info('Tesseract worker инициализирован успешно');
    } catch (error) {
      logger.error('Ошибка инициализации Tesseract', error);
      OCR_PROVIDERS.tesseract.available = false;
      throw error;
    }
  }

  /**
   * Выбирает оптимального провайдера для обработки файла
   */
  private selectProvider(
    formatResult: FormatDetectionResult,
    fileSize: number,
    options: OCROptions = {}
  ): string | null {
    const userMode = options.userMode || 'DEMO';
    const mimeType = formatResult.format.mimeType;

    // Получаем доступных провайдеров для данного формата и размера файла
    const availableProviders = Object.entries(OCR_PROVIDERS)
      .filter(([_, provider]) => {
        return provider.available &&
               provider.supportedFormats.includes(mimeType) &&
               fileSize <= provider.maxFileSize;
      })
      .sort((a, b) => a[1].priority - b[1].priority); // Сортируем по приоритету

    if (availableProviders.length === 0) {
      logger.warn('Нет доступных провайдеров для файла', {
        mimeType,
        fileSize,
        userMode
      });
      return null;
    }

    // Выбираем провайдера на основе режима пользователя
    switch (userMode) {
      case 'DEMO':
        // В демо режиме используем только бесплатные провайдеры
        const freeProvider = availableProviders.find(([_, provider]) => provider.costPerPage === 0);
        return freeProvider ? freeProvider[0] : null;

      case 'TRIAL':
        // В trial режиме ограничиваем дорогие провайдеры
        const trialProvider = availableProviders.find(([_, provider]) => (provider.costPerPage || 0) <= 0.01);
        return trialProvider ? trialProvider[0] : availableProviders[0][0];

      case 'PAID':
        // В платном режиме используем лучшего доступного провайдера
        if (options.preferredProvider &&
            availableProviders.some(([name]) => name === options.preferredProvider)) {
          return options.preferredProvider;
        }
        return availableProviders[0][0];

      case 'EXPIRED':
        // В просроченном режиме только бесплатные
        const expiredProvider = availableProviders.find(([_, provider]) => provider.costPerPage === 0);
        return expiredProvider ? expiredProvider[0] : null;

      default:
        return availableProviders[0][0];
    }
  }

  /**
   * Основной метод для OCR обработки
   */
  async processDocument(
    buffer: Buffer,
    filename: string,
    options: OCROptions = {}
  ): Promise<OCRResult> {
    const startTime = Date.now();

    try {
      if (!this.isInitialized) {
        await this.initializeProviders();
      }

      // Определяем формат файла
      const formatResult = await FormatDetector.detectFormat(buffer, filename);

      logger.info('Начало OCR обработки', {
        filename,
        fileSize: buffer.length,
        format: formatResult.format.mimeType,
        confidence: formatResult.format.confidence
      });

      // Проверяем, нужен ли OCR для данного формата
      if (!formatResult.format.needsOCR) {
        logger.warn('Файл не требует OCR обработки', {
          filename,
          format: formatResult.format.mimeType
        });

        return {
          text: '',
          confidence: 0,
          provider: 'none',
          processingTime: Date.now() - startTime,
          metadata: {
            wordCount: 0
          }
        };
      }

      // Выбираем провайдера
      const selectedProvider = this.selectProvider(formatResult, buffer.length, options);

      if (!selectedProvider) {
        throw new Error('Нет доступных провайдеров OCR для данного файла');
      }

      logger.info('Выбран провайдер OCR', {
        provider: selectedProvider,
        filename
      });

      // Выполняем OCR обработку
      let result: OCRResult;

      switch (selectedProvider) {
        case 'tesseract':
          result = await this.processTesseract(buffer, formatResult, options);
          break;

        case 'yandex_vision':
          result = await this.processYandexVision(buffer, formatResult, options);
          break;

        case 'gigachat':
          result = await this.processGigaChat(buffer, formatResult, options);
          break;

        default:
          throw new Error(`Неизвестный провайдер OCR: ${selectedProvider}`);
      }

      result.processingTime = Date.now() - startTime;
      result.provider = selectedProvider;

      // Извлекаем структурированные данные, если нужно
      if (options.extractStructuredData && result.text) {
        result.extractedData = await this.extractStructuredData(result.text);
      }

      logger.info('OCR обработка завершена', {
        filename,
        provider: selectedProvider,
        confidence: result.confidence,
        textLength: result.text.length,
        processingTime: result.processingTime
      });

      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error('Ошибка OCR обработки', error, {
        filename,
        processingTime
      });

      // Возвращаем пустой результат в случае ошибки
      return {
        text: '',
        confidence: 0,
        provider: 'error',
        processingTime,
        metadata: {
          wordCount: 0
        }
      };
    }
  }

  /**
   * Обработка через Tesseract.js
   */
  private async processTesseract(
    buffer: Buffer,
    formatResult: FormatDetectionResult,
    options: OCROptions
  ): Promise<OCRResult> {
    if (!this.tesseractWorker) {
      throw new Error('Tesseract worker не инициализирован');
    }

    try {
      // Предобработка изображения, если доступна
      let processedBuffer = buffer;
      if (options.preprocessImage !== false && sharp) {
        processedBuffer = await this.preprocessImage(buffer);
      }

      // Выполняем OCR
      const result = await this.tesseractWorker.recognize(processedBuffer);

      return {
        text: result.data.text || '',
        confidence: result.data.confidence / 100, // Нормализуем к 0-1
        provider: 'tesseract',
        processingTime: 0, // Будет установлено в основном методе
        metadata: {
          wordCount: result.data.words?.length || 0,
          language: 'rus+eng'
        }
      };

    } catch (error) {
      logger.error('Ошибка Tesseract OCR', error);
      throw error;
    }
  }

  /**
   * Обработка через Yandex Vision (заглушка)
   */
  private async processYandexVision(
    buffer: Buffer,
    formatResult: FormatDetectionResult,
    options: OCROptions
  ): Promise<OCRResult> {
    // TODO: Реализовать интеграцию с Yandex Vision API
    logger.warn('Yandex Vision OCR пока не реализован');

    return {
      text: '',
      confidence: 0,
      provider: 'yandex_vision',
      processingTime: 0,
      metadata: {
        wordCount: 0
      }
    };
  }

  /**
   * Обработка через GigaChat (заглушка)
   */
  private async processGigaChat(
    buffer: Buffer,
    formatResult: FormatDetectionResult,
    options: OCROptions
  ): Promise<OCRResult> {
    // TODO: Реализовать интеграцию с GigaChat Vision API
    logger.warn('GigaChat OCR пока не реализован');

    return {
      text: '',
      confidence: 0,
      provider: 'gigachat',
      processingTime: 0,
      metadata: {
        wordCount: 0
      }
    };
  }

  /**
   * Предобработка изображения для улучшения OCR
   */
  private async preprocessImage(buffer: Buffer): Promise<Buffer> {
    if (!sharp) {
      return buffer;
    }

    try {
      const metadata = await sharp(buffer).metadata();
      const { width, height } = metadata;

      if (!width || !height) {
        return buffer;
      }

      // Оптимальный размер для OCR: 1200-2400px по ширине
      const targetWidth = Math.min(Math.max(width, 1200), 2400);
      const scaleFactor = targetWidth / width;

      const processedBuffer = await sharp(buffer)
        .resize({ width: targetWidth })
        .normalize() // Нормализация контраста
        .sharpen({ sigma: 0.5 }) // Небольшое повышение резкости
        .png({ quality: 95 }) // Высокое качество PNG
        .toBuffer();

      logger.debug('Изображение предобработано для OCR', {
        originalSize: `${width}x${height}`,
        newSize: `${targetWidth}x${Math.round(height * scaleFactor)}`,
        scaleFactor: scaleFactor.toFixed(2)
      });

      return processedBuffer;

    } catch (error) {
      logger.warn('Ошибка предобработки изображения, используем оригинал', error);
      return buffer;
    }
  }

  /**
   * Извлечение структурированных данных из текста
   */
  private async extractStructuredData(text: string): Promise<any> {
    try {
      // Используем базовый парсер для извлечения российских данных
      const { RussianUnitsHelper } = await import('./parsers/base-parser');

      const extractedValues = RussianUnitsHelper.extractValuesWithUnits(text);

      const structuredData = {
        fuel_data: extractedValues.filter(v => v.type.includes('fuel')),
        electricity_data: extractedValues.filter(v => v.type.includes('electricity')),
        gas_data: extractedValues.filter(v => v.type.includes('gas')),
        transport_data: extractedValues.filter(v => v.type.includes('transport')),
        raw_values: extractedValues
      };

      logger.debug('Извлечены структурированные данные', {
        totalValues: extractedValues.length,
        fuelData: structuredData.fuel_data.length,
        electricityData: structuredData.electricity_data.length,
        gasData: structuredData.gas_data.length,
        transportData: structuredData.transport_data.length
      });

      return structuredData;

    } catch (error) {
      logger.error('Ошибка извлечения структурированных данных', error);
      return {};
    }
  }

  /**
   * Получение статуса провайдеров
   */
  getProvidersStatus(): Record<string, OCRProvider> {
    return { ...OCR_PROVIDERS };
  }

  /**
   * Проверка здоровья сервиса
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    providers: Record<string, boolean>;
    details: any;
  }> {
    const providerStatus: Record<string, boolean> = {};
    const details: any = {
      tesseract: { available: false, error: null },
      yandex_vision: { available: false, error: 'Not implemented' },
      gigachat: { available: false, error: 'Not implemented' }
    };

    // Проверяем Tesseract
    try {
      if (this.tesseractWorker) {
        // Простая проверка - создаем тестовое изображение и обрабатываем
        providerStatus.tesseract = true;
        details.tesseract.available = true;
      } else {
        details.tesseract.error = 'Worker not initialized';
      }
    } catch (error) {
      details.tesseract.error = error instanceof Error ? error.message : 'Unknown error';
    }

    // TODO: Проверка других провайдеров

    const availableProviders = Object.values(providerStatus).filter(Boolean).length;
    const totalProviders = Object.keys(OCR_PROVIDERS).length;

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (availableProviders === totalProviders) {
      status = 'healthy';
    } else if (availableProviders > 0) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      providers: providerStatus,
      details
    };
  }

  /**
   * Очистка ресурсов
   */
  async cleanup(): Promise<void> {
    try {
      if (this.tesseractWorker) {
        await this.tesseractWorker.terminate();
        this.tesseractWorker = null;
      }

      this.isInitialized = false;
      logger.info('HybridOCRService очищен');

    } catch (error) {
      logger.error('Ошибка очистки HybridOCRService', error);
    }
  }
}

// Экспорт singleton instance
export const hybridOCRService = new HybridOCRService();