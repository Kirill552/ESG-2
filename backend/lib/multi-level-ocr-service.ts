/**
 * Многоуровневая OCR система для ESG-Лайт
 *
 * 📋 МАРШРУТИЗАЦИЯ ФОРМАТОВ (2025):
 *
 * ✅ Yandex Vision OCR (приоритет #1):
 *    - PDF (до 20MB, до 300 страниц) ← ОСНОВНОЙ ФОРМАТ!
 *    - JPEG, PNG, GIF, BMP
 *    - Автоопределение формата по сигнатуре файла
 *
 * ⚠️ Tesseract OCR (fallback):
 *    - ТОЛЬКО изображения: JPEG, PNG, GIF, BMP
 *    - НЕ поддерживает PDF! (требует конвертации)
 *
 * 🔄 Foundation Models (постобработка через GLM-4.6):
 *    - Level 2: Исправление OCR ошибок
 *    - Level 3: Извлечение данных по Приказу 371
 *    - Level 4: Классификация категорий (Function Calling)
 *
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

interface MultiLevelOcrOptions {
  preferredSource?: 'auto' | 'yandex' | 'tesseract' | 'donut';
  enableFallback?: boolean;
  minConfidence?: number;
}

/**
 * Проверяет доступность Yandex Vision API
 */
async function isYandexVisionAvailable(): Promise<boolean> {
  try {
    // Проверяем наличие необходимых переменных окружения
    const serviceAccountPath = process.env.YANDEX_SERVICE_ACCOUNT_KEY_FILE;
    const iamToken = process.env.YANDEX_IAM_TOKEN;
    const folderId = process.env.YANDEX_FOLDER_ID;

    console.log('🔍 [Yandex Vision Check] Service Account Path:', serviceAccountPath || 'NOT SET');
    console.log('🔍 [Yandex Vision Check] IAM Token:', iamToken ? 'SET' : 'NOT SET');
    console.log('🔍 [Yandex Vision Check] Folder ID:', folderId || 'NOT SET');

    const hasServiceAccount = serviceAccountPath || iamToken;

    if (!hasServiceAccount || !folderId) {
      console.log('❌ Yandex Vision: missing credentials, using fallback');
      return false;
    }

    // Пытаемся загрузить модуль Yandex Vision
    console.log('🔍 [Yandex Vision Check] Attempting to import yandex-vision-service...');
    const { processImageWithYandex } = await import('./yandex-vision-service');

    // Проверяем что функция существует
    if (typeof processImageWithYandex === 'function') {
      console.log('✅ Yandex Vision available as primary OCR');
      return true;
    }

    console.log('❌ Yandex Vision: processImageWithYandex is not a function');
    return false;
  } catch (error: any) {
    console.log('❌ Yandex Vision module not available:', error.message);
    console.log('   Error stack:', error.stack?.split('\n')[0]);
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
 * Постобработка OCR текста через Foundation Models (Levels 2-4)
 * Использует единую модель GLM-4.6 для всех операций (FOUNDATION_MODELS_DEFAULT_MODEL в env)
 * Level 2: Исправление ошибок OCR
 * Level 3: Извлечение структурированных данных
 * Level 4: Классификация категорий (Function Calling + транспортные документы)
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
  subcategory?: string;
  categoryReasoning?: string;
}> {
  const result: {
    fixedText?: string;
    extractedData?: any;
    category?: string;
    categoryConfidence?: number;
    subcategory?: string;
    categoryReasoning?: string;
  } = {};

  try {
    const { FoundationModelsClient } = await import('./foundation-models-client');
    const client = new FoundationModelsClient();

    // Level 2: Исправление ошибок OCR (опционально)
    if (options?.fixErrors !== false) {
      console.log('🔧 Level 2: Исправление ошибок OCR через Foundation Models...');
      try {
        result.fixedText = await client.fixOcrErrors(ocrText);
        console.log('✅ Level 2: Ошибки OCR исправлены');
      } catch (error) {
        console.error('⚠️ Level 2 failed, using original text:', error);
        result.fixedText = ocrText;
      }
    } else {
      console.log('⏭️ Level 2: Исправление ошибок OCR отключено');
      result.fixedText = ocrText;
    }

    const textForProcessing = result.fixedText || ocrText;

    // Level 3: Извлечение данных (опционально)
    if (options?.extractData !== false) {
      console.log('📊 Level 3: Извлечение данных через Foundation Models...');
      try {
        const extraction = await client.extractEnergyData(textForProcessing);
        // ✅ ИСПРАВЛЕНО: Мержим данные, не перезаписываем полностью
        result.extractedData = {
          ...result.extractedData,
          ...extraction.extractedData
        };
        console.log('✅ Level 3: Данные извлечены');
      } catch (error) {
        console.error('⚠️ Level 3 failed:', error);
      }
    } else {
      console.log('⏭️ Level 3: Извлечение данных отключено');
    }

    // Level 4: Классификация категории (опционально)
    if (options?.classifyCategory !== false) {
      console.log('🏷️ Level 4: Классификация категории через Foundation Models (Function Calling)...');
      try {
        // Используем новый метод с Function Calling для максимальной точности
        const classification = await client.classifyDocumentCategoryWithTools(
          textForProcessing,
          undefined // fileName можно передать если доступно
        );

        // Маппинг категорий обратно в русские названия для совместимости
        const categoryMapping: Record<string, string> = {
          'PRODUCTION': 'Производство',
          'SUPPLIERS': 'Поставщики',
          'WASTE': 'Отходы',
          'TRANSPORT': 'Транспорт',
          'ENERGY': 'Энергия',
          'OTHER': 'Прочее'
        };

        result.category = categoryMapping[classification.category] || 'Прочее';
        result.categoryConfidence = classification.confidence;

        // Сохраняем дополнительную информацию
        if (classification.subcategory) {
          result.subcategory = classification.subcategory;
        }
        if (classification.reasoning) {
          result.categoryReasoning = classification.reasoning;
        }

        console.log(`✅ Level 4: Категория: ${result.category} (${(classification.confidence * 100).toFixed(1)}%)`);
        if (classification.subcategory) {
          console.log(`📝 Подкатегория: ${classification.subcategory}`);
        }
        console.log(`💭 Обоснование: ${classification.reasoning.substring(0, 100)}...`);

        // НОВОЕ: Обработка транспортных документов (Задачи 10.2-10.6)
        if (result.category === 'Транспорт') {
          console.log('🚗 Обнаружен транспортный документ, запуск специализированной обработки...');

          try {
            // Извлекаем данные транспортного документа через GLM
            let transportData = await client.extractTransportDocumentData(textForProcessing);

            console.log('🔍 GLM: Извлеченные данные транспорта:', {
              vehicle: {
                model: transportData.vehicle.model || 'НЕ ИЗВЛЕЧЕНО',
                licensePlate: transportData.vehicle.licensePlate || 'НЕ ИЗВЛЕЧЕНО',
                confidence: transportData.vehicle.modelConfidence
              },
              route: {
                fromCity: transportData.route.fromCity || 'НЕ ИЗВЛЕЧЕНО',
                toCity: transportData.route.toCity || 'НЕ ИЗВЛЕЧЕНО',
                from: transportData.route.from || 'НЕ ИЗВЛЕЧЕНО',
                to: transportData.route.to || 'НЕ ИЗВЛЕЧЕНО'
              },
              cargo: transportData.cargo ? `${transportData.cargo.weight} ${transportData.cargo.unit}` : 'НЕ ИЗВЛЕЧЕНО',
              confidence: transportData.confidence
            });

            // Если GLM не справился - пробуем regex fallback
            if (!transportData.vehicle.model || !transportData.route.fromCity || !transportData.route.toCity) {
              console.log('⚠️ GLM не извлек полные данные, пробуем regex fallback...');

              const { extractTransportDataRegex, isValidTransportData } = await import('./transport-regex-extractor');
              const regexData = extractTransportDataRegex(textForProcessing);

              // Если regex нашел больше данных - используем его результат
              if (isValidTransportData(regexData)) {
                console.log('✅ Regex fallback успешно извлек данные!');
                transportData = regexData;
              } else if (regexData.confidence > transportData.confidence) {
                console.log('⚙️ Regex fallback частично улучшил результат');
                // Мержим лучшие результаты от GLM и regex
                transportData = {
                  vehicle: {
                    model: transportData.vehicle.model || regexData.vehicle.model,
                    licensePlate: transportData.vehicle.licensePlate || regexData.vehicle.licensePlate,
                    modelConfidence: Math.max(transportData.vehicle.modelConfidence, regexData.vehicle.modelConfidence)
                  },
                  route: {
                    from: transportData.route.from || regexData.route.from,
                    to: transportData.route.to || regexData.route.to,
                    fromCity: transportData.route.fromCity || regexData.route.fromCity,
                    toCity: transportData.route.toCity || regexData.route.toCity
                  },
                  cargo: transportData.cargo || regexData.cargo,
                  confidence: Math.max(transportData.confidence, regexData.confidence)
                };
              }
            }

            // Если данные успешно извлечены, обрабатываем параллельно
            if (transportData.vehicle.model && transportData.route.fromCity && transportData.route.toCity) {
              console.log('✅ Минимальные требования выполнены, запускаем параллельную обработку...');

              // Импортируем процессор транспортных документов
              const { processTransportDocumentParallel } = await import('./transport-document-processor');

              // Параллельная обработка (определение топлива + расчет расстояния + выбросы)
              const transportAnalysis = await processTransportDocumentParallel(transportData, client);

              // Сохраняем результаты анализа в extractedData
              if (!result.extractedData) {
                result.extractedData = {};
              }

              result.extractedData.transport = {
                ...transportData,
                analysis: transportAnalysis
              };

              console.log('🎯 Транспортный документ обработан:', {
                fuelType: transportAnalysis.vehicle.fuelType.fuelType,
                distance: transportAnalysis.route.distance.distance,
                emissions: transportAnalysis.emissions?.co2Emissions,
                needsReview: transportAnalysis.needsUserReview
              });

              if (transportAnalysis.needsUserReview) {
                console.warn('⚠️ Транспортный документ требует проверки пользователем (низкая уверенность)');
              }
            } else {
              // Детальная информация о том, что именно не удалось извлечь
              const missingFields = [];
              if (!transportData.vehicle.model) missingFields.push('модель автомобиля');
              if (!transportData.route.fromCity) missingFields.push('город отправления');
              if (!transportData.route.toCity) missingFields.push('город назначения');

              console.warn(`⚠️ Не удалось извлечь полные данные транспортного документа. Отсутствуют: ${missingFields.join(', ')}`);
              console.warn(`📝 Совет: Убедитесь что в документе четко указаны марка автомобиля и маршрут (откуда-куда)`);
            }
          } catch (transportError) {
            console.error('❌ Ошибка обработки транспортного документа:', transportError);
            // Не прерываем основной процесс
          }
        }

      } catch (error) {
        console.error('⚠️ Level 4 failed:', error);
      }
    } else {
      console.log('⏭️ Level 4: Классификация категории отключена');
    }

    return result;
  } catch (error) {
    console.error('❌ Foundation Models постобработка недоступна:', error);
    return { fixedText: ocrText };
  }
}

/**
 * Полная многоуровневая обработка: OCR (Level 1) + постобработка (Levels 2-4)
 * Level 1: Yandex Vision / Tesseract OCR
 * Level 2: Исправление ошибок OCR
 * Level 3: Извлечение данных
 * Level 4: Классификация + транспортные документы
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
  subcategory?: string;
  categoryReasoning?: string;
}> {
  console.log('🚀 Запуск полной многоуровневой обработки (Levels 1-4)...');

  // Level 1: Базовый OCR (Yandex Vision / Tesseract)
  const ocrResult = await processImageMultiLevel(buffer, options?.ocrOptions);

  // Levels 2-4: Постобработка через Foundation Models
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