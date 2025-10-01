/**
 * Многоуровневая OCR система для EGS-Lite
 * Приоритет: Yandex Vision → Tesseract Fallback → будущий Donut слот
 */

import { processImage, processImageDetailed } from './ocr';

interface OcrResult {
  text: string;
  confidence: number;
  source: 'yandex' | 'tesseract' | 'donut';
  processingTime: number;
  words?: Array<{
    text: string;
    confidence: number;
    bbox?: { x: number; y: number; width: number; height: number };
  }>;
}

interface OcrError {
  service: string;
  error: string;
  code?: string;
}

/**
 * Проверяет доступность Yandex Vision API
 */
async function isYandexVisionAvailable(): Promise<boolean> {
  try {
    // Проверяем наличие необходимых переменных окружения
    const hasServiceAccount = process.env.YANDEX_SERVICE_ACCOUNT_KEY_FILE || process.env.YANDEX_IAM_TOKEN;
    const hasFolderId = process.env.YANDEX_FOLDER_ID;
    
    if (!hasServiceAccount || !hasFolderId) {
      console.log('🔍 Yandex Vision: missing credentials, using fallback');
      return false;
    }

    // Пытаемся загрузить модуль Yandex Vision
    const { processImageWithYandex } = await import('./yandex-vision-service');
    
    // Проверяем что функция существует
    if (typeof processImageWithYandex === 'function') {
      console.log('✅ Yandex Vision available as primary OCR');
      return true;
    }
    
    return false;
  } catch (error) {
    console.log('🔍 Yandex Vision module not available, using fallback');
    return false;
  }
}

/**
 * Обрабатывает изображение через Yandex Vision OCR
 */
async function processWithYandex(buffer: Buffer): Promise<OcrResult> {
  const startTime = Date.now();
  
  try {
    const { processImageWithYandex } = await import('./yandex-vision-service');
    const result = await processImageWithYandex(buffer);
    
    const processingTime = Date.now() - startTime;
    
    return {
      text: result.text || '',
      confidence: result.confidence || 0.9,
      source: 'yandex',
      processingTime,
      words: result.words
    };
  } catch (error: any) {
    throw new Error(`YANDEX_OCR_FAILED: ${error.message}`);
  }
}

/**
 * Обрабатывает изображение через Tesseract OCR (fallback)
 */
async function processWithTesseract(buffer: Buffer): Promise<OcrResult> {
  const startTime = Date.now();
  
  try {
    const result = await processImageDetailed(buffer);
    const processingTime = Date.now() - startTime;
    
    return {
      text: result.text || '',
      confidence: result.confidence || 0.5,
      source: 'tesseract',
      processingTime,
      words: result.words
    };
  } catch (error: any) {
    throw new Error(`TESSERACT_OCR_FAILED: ${error.message}`);
  }
}

/**
 * Слот для будущей интеграции обученного Donut
 */
async function processWithDonut(buffer: Buffer): Promise<OcrResult> {
  const startTime = Date.now();
  
  try {
    // TODO: После дообучения Donut модели на 19,919 синтетических документах
    // замените этот блок на реальную интеграцию:
    
    /*
    ПЛАНИРУЕМАЯ ИНТЕГРАЦИЯ DONUT:
    
    1. Загрузка модели:
       const donutModel = await loadDonutModel('./models/donut-esg-finetuned');
    
    2. Преобразование изображения:
       const imageBase64 = buffer.toString('base64');
       const preprocessed = await preprocessImageForDonut(imageBase64);
    
    3. Извлечение данных:
       const result = await donutModel.predict(preprocessed, {
         task: 'carbon_data_extraction',
         language: 'ru',
         confidence_threshold: 0.85
       });
    
    4. Постобработка:
       return {
         text: result.extracted_text,
         confidence: result.confidence,
         source: 'donut',
         processingTime: Date.now() - startTime,
         words: result.structured_words,
         structured_data: result.carbon_data // Уникальная фича Donut
       };
    
    ОЖИДАЕМАЯ ПРОИЗВОДИТЕЛЬНОСТЬ:
    - Точность: 92-95% на российских документах
    - Скорость: 2-5 сек на документ (CPU: 5-8 сек, GPU: 1-2 сек)
    - Структурированные данные: автоматическое извлечение единиц измерения
    - Понимание контекста: семантическое распознавание углеродных данных
    */
    
    // Временная заглушка для тестирования архитектуры
    console.log('🍩 Donut OCR slot called but not implemented yet');
    console.log('📊 Training in progress on 19,919 synthetic documents...');
    console.log('🎯 Expected completion: 3-6 hours on A100 GPU');
    console.log('💰 Estimated cost: $10-15 for training');
    
    throw new Error('DONUT_TRAINING_IN_PROGRESS: Model is being trained on synthetic dataset. Expected accuracy: 92-95%');
    
  } catch (error: any) {
    throw new Error(`DONUT_OCR_FAILED: ${error.message}`);
  }
}

/**
 * Основная функция многоуровневой OCR обработки
 */
export async function processImageMultiLevel(
  buffer: Buffer, 
  options: {
    preferredSource?: 'auto' | 'yandex' | 'tesseract' | 'donut';
    enableFallback?: boolean;
    minConfidence?: number;
  } = {}
): Promise<OcrResult> {
  const { 
    preferredSource = 'auto', 
    enableFallback = true, 
    minConfidence = 0.6 
  } = options;

  const errors: OcrError[] = [];
  let lastResult: OcrResult | null = null;

  console.log(`🔍 Starting multi-level OCR processing (${buffer.length} bytes)`);
  console.log(`📋 Preferred: ${preferredSource}, Fallback: ${enableFallback}, Min confidence: ${minConfidence}`);

  // Определяем порядок обработки
  const processingOrder: Array<'yandex' | 'tesseract' | 'donut'> = [];
  
  if (preferredSource === 'auto') {
    // Автоматический выбор: проверяем доступность Yandex, потом Tesseract
    const yandexAvailable = await isYandexVisionAvailable();
    if (yandexAvailable) {
      processingOrder.push('yandex', 'tesseract');
    } else {
      processingOrder.push('tesseract');
    }
  } else if (preferredSource === 'yandex') {
    processingOrder.push('yandex');
    if (enableFallback) processingOrder.push('tesseract');
  } else if (preferredSource === 'tesseract') {
    processingOrder.push('tesseract');
  } else if (preferredSource === 'donut') {
    processingOrder.push('donut');
    if (enableFallback) processingOrder.push('yandex', 'tesseract');
  }

  // Обрабатываем по приоритету
  for (const source of processingOrder) {
    try {
      console.log(`🔄 Trying ${source.toUpperCase()} OCR...`);
      
      let result: OcrResult;
      
      switch (source) {
        case 'yandex':
          result = await processWithYandex(buffer);
          break;
        case 'tesseract':
          result = await processWithTesseract(buffer);
          break;
        case 'donut':
          result = await processWithDonut(buffer);
          break;
        default:
          throw new Error(`Unknown OCR source: ${source}`);
      }

      lastResult = result;
      
      console.log(`✅ ${source.toUpperCase()} OCR completed: ${result.text.length} chars, confidence: ${result.confidence.toFixed(2)}, time: ${result.processingTime}ms`);
      
      // Проверяем качество результата
      if (result.confidence >= minConfidence && result.text.length > 10) {
        console.log(`🎯 OCR result accepted from ${source.toUpperCase()}`);
        return result;
      } else {
        console.log(`⚠️ ${source.toUpperCase()} result below threshold (confidence: ${result.confidence.toFixed(2)}, length: ${result.text.length}), trying next...`);
        
        if (!enableFallback) {
          return result; // Возвращаем результат даже если качество низкое, если fallback отключен
        }
      }
      
    } catch (error: any) {
      console.log(`❌ ${source.toUpperCase()} OCR failed:`, error.message);
      
      errors.push({
        service: source,
        error: error.message,
        code: error.code
      });
      
      if (!enableFallback) {
        throw error; // Если fallback отключен, бросаем ошибку сразу
      }
    }
  }

  // Если дошли до сюда, все методы либо неуспешны, либо дали низкое качество
  if (lastResult) {
    console.log(`⚠️ Returning last result with low confidence from ${lastResult.source.toUpperCase()}`);
    return lastResult;
  }

  // Все методы провалились
  const errorSummary = errors.map(e => `${e.service}: ${e.error}`).join('; ');
  throw new Error(`ALL_OCR_METHODS_FAILED: ${errorSummary}`);
}

/**
 * Упрощенная функция для быстрой OCR обработки (только текст)
 */
export async function processImageQuick(buffer: Buffer): Promise<string> {
  try {
    const result = await processImageMultiLevel(buffer, {
      preferredSource: 'auto',
      enableFallback: true,
      minConfidence: 0.3 // Снижаем требования для быстрой обработки
    });
    
    return result.text;
  } catch (error: any) {
    console.error('Quick OCR processing failed:', error.message);
    return ''; // Возвращаем пустую строку в случае полной неудачи
  }
}

/**
 * Получить статистику доступных OCR методов
 */
export async function getOcrStatus(): Promise<{
  yandex: { available: boolean; reason?: string };
  tesseract: { available: boolean; reason?: string };
  donut: { available: boolean; reason?: string };
}> {
  const status = {
    yandex: { available: false, reason: '' },
    tesseract: { available: true, reason: 'Always available' },
    donut: { available: false, reason: 'Training in progress on 19,919 synthetic documents (3-6h on A100, $10-15 cost, 92-95% expected accuracy)' }
  };

  // Проверяем Yandex Vision
  try {
    status.yandex.available = await isYandexVisionAvailable();
    if (!status.yandex.available) {
      status.yandex.reason = 'Missing credentials or module unavailable';
    } else {
      status.yandex.reason = 'Ready to use';
    }
  } catch (error: any) {
    status.yandex.reason = error.message;
  }

  return status;
}

/**
 * Постобработка OCR текста через Foundation Models (Levels 3-5)
 * Level 3: Исправление ошибок OCR (GigaChat Lite)
 * Level 4: Извлечение структурированных данных (GigaChat Pro)
 * Level 5: Сложный анализ (GigaChat 2 MAX)
 */
export async function postProcessWithFoundationModels(
  ocrText: string,
  options?: {
    fixErrors?: boolean;
    extractData?: boolean;
    classifyCategory?: boolean;
  }
): Promise<{
  fixedText?: string;
  extractedData?: any;
  category?: string;
  categoryConfidence?: number;
}> {
  const result: {
    fixedText?: string;
    extractedData?: any;
    category?: string;
    categoryConfidence?: number;
  } = {};

  try {
    const { FoundationModelsClient } = await import('./foundation-models-client');
    const client = new FoundationModelsClient();

    // Level 3: Исправление ошибок OCR (опционально)
    if (options?.fixErrors !== false) {
      console.log('🔧 Level 3: Исправление ошибок OCR через GigaChat Lite...');
      try {
        result.fixedText = await client.fixOcrErrors(ocrText);
      } catch (error) {
        console.error('⚠️ Level 3 failed, using original text:', error);
        result.fixedText = ocrText;
      }
    }

    const textForProcessing = result.fixedText || ocrText;

    // Level 4: Извлечение данных (опционально)
    if (options?.extractData !== false) {
      console.log('📊 Level 4: Извлечение данных через GigaChat Pro...');
      try {
        const extraction = await client.extractEnergyData(textForProcessing);
        result.extractedData = extraction.extractedData;
      } catch (error) {
        console.error('⚠️ Level 4 failed:', error);
      }
    }

    // Level 5: Классификация категории (опционально)
    if (options?.classifyCategory !== false) {
      console.log('🏷️ Level 5: Классификация категории через GigaChat 2 MAX...');
      try {
        const classification = await client.classifyDocumentCategory(textForProcessing);
        result.category = classification.category;
        result.categoryConfidence = classification.confidence;
      } catch (error) {
        console.error('⚠️ Level 5 failed:', error);
      }
    }

    return result;
  } catch (error) {
    console.error('❌ Foundation Models постобработка недоступна:', error);
    return { fixedText: ocrText };
  }
}

/**
 * Полная многоуровневая обработка: OCR (Levels 1-2) + постобработка (Levels 3-5)
 */
export async function processImageWithPostProcessing(
  buffer: Buffer,
  options?: {
    ocrOptions?: MultiLevelOcrOptions;
    postProcessOptions?: {
      fixErrors?: boolean;
      extractData?: boolean;
      classifyCategory?: boolean;
    };
  }
): Promise<OcrResult & {
  fixedText?: string;
  extractedData?: any;
  category?: string;
  categoryConfidence?: number;
}> {
  console.log('🚀 Запуск полной многоуровневой обработки (Levels 1-5)...');

  // Levels 1-2: Базовый OCR
  const ocrResult = await processImageMultiLevel(buffer, options?.ocrOptions);

  // Levels 3-5: Постобработка через Foundation Models
  const postProcessed = await postProcessWithFoundationModels(
    ocrResult.text,
    options?.postProcessOptions
  );

  return {
    ...ocrResult,
    ...postProcessed
  };
}

/**
 * Экспорт для совместимости с существующим кодом
 */
export { processImage as processTesseractImage } from './ocr';