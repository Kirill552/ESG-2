/**
 * OCR Worker - обработчик задач OCR из очереди pg-boss
 * Упрощенная версия 2025 для новой архитектуры
 *
 * 📋 МАРШРУТИЗАЦИЯ ФАЙЛОВ (2025):
 *
 * 1. СТРУКТУРИРОВАННЫЕ ФОРМАТЫ (приоритет #1):
 *    - Excel (.xlsx, .xls) → ExcelParser
 *    - CSV/TSV → CsvTsvParser
 *    - JSON → JsonParser
 *    - XML → XmlParser
 *    ✅ Быстрая обработка, высокая точность
 *
 * 2. ТЕКСТОВЫЕ ФОРМАТЫ (приоритет #2):
 *    - Word (.docx, .doc) → OfficeDocumentParser
 *    - RTF → RtfParser
 *    - HTML → HtmlParser
 *    - TXT → TxtParser
 *    ⚠️ Fallback на OCR если парсер не справился
 *
 * 3. OCR ОБРАБОТКА (приоритет #3):
 *    - PDF → Yandex Vision OCR
 *    - Изображения (JPEG, PNG, GIF, BMP) → Yandex Vision или Tesseract
 *    🔍 Медленная обработка, требует постобработки Foundation Models
 */

// КРИТИЧНО: Загружаем переменные окружения из .env файла
import * as dotenv from 'dotenv';
import * as path from 'path';

// Используем process.cwd() вместо __dirname для корректной работы после компиляции
const envPath = path.resolve(process.cwd(), '.env');
console.log('🔧 [ENV] Загружаем .env из:', envPath);
dotenv.config({ path: envPath });

// Диагностика: проверяем что переменные загрузились
console.log('🔧 [ENV CHECK] YC_BUCKET_NAME:', process.env.YC_BUCKET_NAME || '❌ НЕ НАЙДЕН!');
console.log('🔧 [ENV CHECK] DATABASE_URL:', process.env.DATABASE_URL ? '✅ загружен' : '❌ НЕ НАЙДЕН!');
console.log('🔧 [ENV CHECK] YC_ACCESS_KEY_ID:', process.env.YC_ACCESS_KEY_ID ? '✅ загружен' : '❌ НЕ НАЙДЕН!');
console.log('🔧 [ENV CHECK] YANDEX_FOLDER_ID:', process.env.YANDEX_FOLDER_ID || '❌ НЕ НАЙДЕН!');

import { createPgBoss, QUEUE_NAMES } from '../lib/pg-boss-config';
import { processImageWithPostProcessing } from '../lib/multi-level-ocr-service';
import { prisma } from '../lib/prisma';
import { getFileBuffer } from '../lib/s3';
import { extractINN, validateINN, compareINNs } from '../lib/inn-extractor';
import * as fs from 'fs';

// Используем интерфейс из pg-boss-config.ts для единообразия
interface OcrJobData {
  documentId: string;
  userId: string;
  fileKey: string;        // S3 ключ файла
  fileName: string;       // Оригинальное имя
  mimeType: string;       // MIME тип
  fileSize: number;       // Размер в байтах
  category?: string;
  userMode?: 'DEMO' | 'TRIAL' | 'PAID' | 'EXPIRED';
}

// Расширяем минимально ожидаемый результат (добавляем опциональные поля, которые
// возвращает postProcessWithFoundationModels, но отсутствуют в базовом OcrResult)
type ExtendedOcrResult = {
  text: string;
  confidence: number;
  source: string;
  processingTime: number;
  words?: any[];
  fixedText?: string;
  extractedData?: any;
  category?: string;
  categoryConfidence?: number;
  subcategory?: string;
  categoryReasoning?: string;
};

/**
 * Вспомогательная функция для OCR обработки
 */
async function processWithOcr(buffer: Buffer): Promise<ExtendedOcrResult> {
  // Читаем настройки для каждого уровня постобработки отдельно
  const enableErrorCorrection = process.env.ENABLE_OCR_ERROR_CORRECTION !== 'false';
  const enableDataExtraction = process.env.ENABLE_DATA_EXTRACTION !== 'false';
  const enableCategoryClassification = process.env.ENABLE_CATEGORY_CLASSIFICATION !== 'false';

  // Постобработка включена если хотя бы один уровень активен
  const enablePostProcessing = enableErrorCorrection || enableDataExtraction || enableCategoryClassification;

  console.log(`🤖 Foundation Models - уровни постобработки:`);
  console.log(`   Level 2 (Исправление ошибок OCR): ${enableErrorCorrection ? '✅ вкл' : '❌ откл'}`);
  console.log(`   Level 3 (Извлечение данных): ${enableDataExtraction ? '✅ вкл' : '❌ откл'}`);
  console.log(`   Level 4 (Классификация): ${enableCategoryClassification ? '✅ вкл' : '❌ откл'}`);

  if (enablePostProcessing) {
    // С постобработкой через Foundation Models (гибкое управление уровнями)
    return await processImageWithPostProcessing(buffer, {
      ocrOptions: {
        preferredSource: 'auto',
        enableFallback: true,
        minConfidence: 0.6
      },
      postProcessOptions: {
        fixErrors: enableErrorCorrection,
        extractData: enableDataExtraction,
        classifyCategory: enableCategoryClassification
      }
    });
  } else {
    // Без постобработки (только OCR Levels 1-2)
    console.log('⚠️ Все уровни постобработки отключены, используем только базовый OCR');
    const { processImageMultiLevel } = await import('../lib/multi-level-ocr-service');
    return await processImageMultiLevel(buffer, {
      preferredSource: 'auto',
      enableFallback: true,
      minConfidence: 0.6
    });
  }
}

/**
 * Основная функция обработки OCR задачи
 */
async function processOcrJob(job: any): Promise<void> {
  const jobData: OcrJobData = job.data;
  const startTime = Date.now();

  console.log(`🔄 [OCR Worker] Начинаем обработку документа: ${jobData.documentId}`);
  console.log(`📄 Файл: ${jobData.fileName} (${jobData.mimeType}, ${jobData.fileSize} байт)`);
  console.log(`📂 S3 ключ: ${jobData.fileKey}`);

  try {
    // 1. Проверяем существование документа
    const document = await prisma.document.findUnique({
      where: { id: jobData.documentId },
      select: {
        id: true,
        fileName: true,
        filePath: true,
        status: true,
        category: true
      }
    });

    if (!document) {
      console.log(`⚠️  Документ ${jobData.documentId} не найден в БД. Пропускаем.`);
      return;
    }

    // 2. Обновляем статус на "PROCESSING"
    if (document.status !== 'PROCESSING') {
      await prisma.document.update({
        where: { id: jobData.documentId },
        data: {
          status: 'PROCESSING',
          processingStartedAt: new Date(),
          processingProgress: 0,
          processingMessage: 'Начинаем обработку документа...'
        }
      });
      console.log(`✅ Статус документа обновлен на PROCESSING`);
    }

    // 3. Загружаем файл из S3 используя fileKey
    console.log(`📥 Скачиваем файл из S3: ${jobData.fileKey}`);
    let fileBuffer: Buffer;
    try {
      const result = await getFileBuffer(jobData.fileKey);
      fileBuffer = result.buffer;
      console.log(`📦 Файл скачан из S3: ${fileBuffer.length} байт`);
    } catch (dlErr: any) {
      throw new Error(`Не удалось получить файл из S3: ${dlErr.message}`);
    }

    // 4. Определяем формат файла и выбираем стратегию обработки
    const { FormatDetector } = await import('../lib/format-detector');
    const formatInfo = FormatDetector.detectFormat(jobData.fileName, fileBuffer, jobData.mimeType);
    const strategy = FormatDetector.getProcessingStrategy(formatInfo);

    console.log(`📋 Формат файла: ${formatInfo.format} (${formatInfo.subFormat || 'N/A'})`);
    console.log(`📊 Стратегия обработки: ${strategy.processingPriority}`);
    console.log(`🔧 Парсер: ${strategy.primaryParser || 'N/A'}`);

    let ocrResult: ExtendedOcrResult;

    // 5. Маршрутизация по типу файла
    if (strategy.processingPriority === 'structural') {
      // ===== СТРУКТУРИРОВАННЫЕ ФОРМАТЫ: Excel, CSV, JSON =====
      console.log(`📊 Используем структурный парсер для ${formatInfo.format}`);

      const { ParserFactory } = await import('../lib/parsers');
      const parseResult = await ParserFactory.parseFile(
        jobData.fileName,
        fileBuffer,
        jobData.mimeType
      );

      if (!parseResult.result.success) {
        throw new Error(`Парсинг ${formatInfo.format} не удался: ${parseResult.result.error}`);
      }

      const parsedData = parseResult.result.data!;

      // Формируем результат в формате ExtendedOcrResult
      ocrResult = {
        text: JSON.stringify(parsedData.extractedData, null, 2),
        confidence: parsedData.confidence,
        source: `${parseResult.parserUsed} (structural)`,
        processingTime: parseResult.result.processingTime,
        extractedData: parsedData.extractedData
      };

      console.log(`✅ Структурный парсинг завершен: ${parsedData.metadata.russian_units_found.length} российских единиц найдено`);

    } else if (strategy.processingPriority === 'textual') {
      // ===== ТЕКСТОВЫЕ ФОРМАТЫ: DOCX, RTF, TXT =====
      console.log(`📄 Используем текстовый парсер для ${formatInfo.format}`);

      const { ParserFactory } = await import('../lib/parsers');
      const parseResult = await ParserFactory.parseFile(
        jobData.fileName,
        fileBuffer,
        jobData.mimeType
      );

      if (!parseResult.result.success) {
        // Fallback на OCR если парсер не сработал
        console.log(`⚠️ Текстовый парсер не справился, используем OCR fallback`);
        ocrResult = await processWithOcr(fileBuffer);
      } else {
        const parsedData = parseResult.result.data!;

        ocrResult = {
          text: JSON.stringify(parsedData.extractedData, null, 2),
          confidence: parsedData.confidence,
          source: `${parseResult.parserUsed} (textual)`,
          processingTime: parseResult.result.processingTime,
          extractedData: parsedData.extractedData
        };

        console.log(`✅ Текстовый парсинг завершен`);
      }

    } else {
      // ===== OCR ОБРАБОТКА: PDF, изображения =====
      console.log(`🔍 Используем OCR для ${formatInfo.format}`);
      ocrResult = await processWithOcr(fileBuffer);
    }

  console.log(`✅ Обработка завершена: ${ocrResult.text.length} символов, confidence: ${ocrResult.confidence.toFixed(2)}`);
  console.log(`🔍 Источник: ${ocrResult.source}, Время: ${ocrResult.processingTime}ms`);

    // 6. Извлекаем ИНН из OCR текста
    const extractedText = ocrResult.fixedText || ocrResult.text;
    const extractedINN = extractINN(extractedText);

    console.log(`🔍 Извлечение ИНН из документа:`);
    if (extractedINN) {
      console.log(`   ✅ ИНН найден: ${extractedINN}`);
    } else {
      console.log(`   ⚠️  ИНН не найден в тексте документа`);
    }

    // 7. Проверяем совпадение ИНН с организацией пользователя
    let innMatches = false;
    if (extractedINN) {
      // Получаем ИНН организации пользователя
      const userOrg = await prisma.organization.findUnique({
        where: { userId: jobData.userId },
        include: { profile: true }
      });

      if (userOrg?.profile?.inn) {
        innMatches = compareINNs(extractedINN, userOrg.profile.inn);

        console.log(`🔍 Проверка ИНН:`);
        console.log(`   Документ:    ${extractedINN}`);
        console.log(`   Организация: ${userOrg.profile.inn}`);
        console.log(`   Совпадение:  ${innMatches ? '✅ ДА' : '❌ НЕТ'}`);

        if (!innMatches) {
          console.log(`   ⚠️  ВНИМАНИЕ: ИНН документа НЕ совпадает с ИНН организации`);
        }
      } else {
        console.log(`   ⚠️  ИНН организации не указан в профиле`);
      }
    }

    // 8. Подготавливаем данные для сохранения
    const updateData: any = {
      status: 'PROCESSED',
      processingCompletedAt: new Date(),
      processingProgress: 100,
      processingMessage: 'Документ успешно обработан',
      ocrProcessed: true,
      ocrConfidence: ocrResult.confidence,
      extractedINN: extractedINN || null,
      innMatches: extractedINN ? innMatches : null,
      ocrData: {
        text: ocrResult.text,
        confidence: ocrResult.confidence,
        source: ocrResult.source,
        processingTime: ocrResult.processingTime,
        words: ocrResult.words || [],
        extractedData: ocrResult.extractedData ?? null,
        fixedText: ocrResult.fixedText ?? null,
        category: ocrResult.category ?? null,
        categoryConfidence: ocrResult.categoryConfidence ?? null,
        subcategory: ocrResult.subcategory ?? null,
        categoryReasoning: ocrResult.categoryReasoning ?? null,
        extractedINN: extractedINN || null,
        innMatches: extractedINN ? innMatches : null
      }
    };

    // 9. Автоматически устанавливаем категорию если confidence > 0.5
    if (ocrResult.category && (ocrResult.categoryConfidence ?? 0) > 0.5) {
      // Маппинг русских названий категорий в enum значения
      const categoryMap: Record<string, string> = {
        'Производство': 'PRODUCTION',
        'Поставщики': 'SUPPLIERS',
        'Отходы': 'WASTE',
        'Транспорт': 'TRANSPORT',
        'Топливо': 'FUEL',
        'Электроэнергия': 'ENERGY',
        'Теплоэнергия': 'HEAT',
        'Энергия': 'ENERGY',
        'Прочее': 'OTHER',
        'Другое': 'OTHER'
      };

      const mappedCategory = categoryMap[ocrResult.category] || ocrResult.category;
      updateData.category = mappedCategory as any;
      console.log(`🏷️  Категория определена автоматически: ${ocrResult.category} → ${mappedCategory} (${((ocrResult.categoryConfidence || 0) * 100).toFixed(1)}%)`);
    }

    // 10. Сохраняем результаты
    await prisma.document.update({
      where: { id: jobData.documentId },
      data: updateData
    });

    const totalTime = Date.now() - startTime;
    console.log(`✅ [OCR Worker] Документ ${jobData.documentId} успешно обработан за ${totalTime}ms`);

  } catch (error: any) {
    console.error(`❌ [OCR Worker] Ошибка обработки документа ${jobData.documentId}:`, error.message);

    // Сохраняем ошибку в БД
    await prisma.document.update({
      where: { id: jobData.documentId },
      data: {
        status: 'FAILED',
        processingCompletedAt: new Date(),
        processingProgress: 0,
        processingMessage: `Ошибка: ${error.message}`,
        errorDetails: {
          error: error.message,
          errorStack: error.stack,
          timestamp: new Date().toISOString()
        },
        errorType: 'OCR_ERROR'
      }
    }).catch(err => {
      console.error('Не удалось сохранить ошибку в БД:', err);
    });

    throw error; // Пробрасываем ошибку для retry в pg-boss
  }
}

/**
 * Запуск worker
 */
async function main() {
  console.log('🚀 Запуск OCR Worker...');
  console.log(`📁 Рабочая директория: ${process.cwd()}`);
  console.log(`🔗 База данных: ${process.env.DATABASE_URL ? 'подключена' : 'НЕ НАСТРОЕНА!'}`);

  try {
    // Создаем подключение к pg-boss
    const boss = await createPgBoss();
    console.log('✅ Подключение к pg-boss установлено');

    // pg-boss v11: Создаем очередь явно перед использованием
    await boss.createQueue(QUEUE_NAMES.OCR);
    console.log(`✅ Очередь ${QUEUE_NAMES.OCR} создана/проверена`);

    // Проверяем статистику очереди (v11 использует getQueueStats вместо getQueueSize)
    try {
      const stats = await boss.getQueueStats(QUEUE_NAMES.OCR);
      console.log(`📊 Статистика очереди ${QUEUE_NAMES.OCR}:`, stats);
    } catch (statsError) {
      console.log(`⚠️ Не удалось получить статистику очереди (это нормально при первом запуске)`);
    }

    // Настраиваем обработчик задач OCR (v11 API)
    const batchSize = parseInt(process.env.OCR_WORKER_BATCH_SIZE || '5');
    const pollingIntervalSeconds = parseInt(process.env.OCR_POLLING_INTERVAL || '2');

    console.log(`⚙️  Обработка батчами: до ${batchSize} задач за раз`);
    console.log(`⏱️  Интервал опроса: ${pollingIntervalSeconds} секунд`);

    // v11: batchSize определяет сколько задач забирается за один раз
    // Обработчик получает МАССИВ задач
    await boss.work(QUEUE_NAMES.OCR, {
      batchSize: batchSize,
      pollingIntervalSeconds: pollingIntervalSeconds
    }, async (jobs: any[]) => {
      console.log(`🎯 Получено ${jobs.length} задач из очереди`);

      // Обрабатываем каждую задачу последовательно
      for (const job of jobs) {
        console.log(`📦 Обработка задачи ${job.id}:`, JSON.stringify(job.data, null, 2));
        await processOcrJob(job);
      }
    });

    console.log(`✅ OCR Worker запущен и слушает очередь: ${QUEUE_NAMES.OCR}`);
    console.log(`⚙️  Батч: ${batchSize} задач, опрос каждые ${pollingIntervalSeconds}с`);
    console.log('');
    console.log('Ожидание задач...');

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n⚠️  Получен сигнал ${signal}, завершаем работу...`);
      try {
        await boss.stop();
        console.log('✅ Worker остановлен');
        process.exit(0);
      } catch (error) {
        console.error('❌ Ошибка при остановке:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    console.error('❌ Критическая ошибка запуска worker:', error);
    process.exit(1);
  }
}

// Запуск
main().catch((error) => {
  console.error('❌ Необработанная ошибка:', error);
  process.exit(1);
});
