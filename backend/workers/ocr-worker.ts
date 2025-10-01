/**
 * OCR Worker - обработчик задач OCR из очереди pg-boss
 * Упрощенная версия 2025 для новой архитектуры
 */

import { createPgBoss, QUEUE_NAMES } from '../lib/pg-boss-config';
import { processImageWithPostProcessing } from '../lib/multi-level-ocr-service';
import { prisma } from '../lib/prisma';
import * as fs from 'fs';
import * as path from 'path';

interface OcrJobData {
  documentId: string;
  filePath: string;
  fileName: string;
  userId: string;
}

/**
 * Основная функция обработки OCR задачи
 */
async function processOcrJob(job: any): Promise<void> {
  const jobData: OcrJobData = job.data;
  const startTime = Date.now();

  console.log(`🔄 [OCR Worker] Начинаем обработку документа: ${jobData.documentId}`);
  console.log(`📄 Файл: ${jobData.fileName}`);

  try {
    // 1. Проверяем существование документа
    const document = await prisma.document.findUnique({
      where: { id: jobData.documentId },
      select: {
        id: true,
        fileName: true,
        filePath: true,
        ocrStatus: true,
        category: true
      }
    });

    if (!document) {
      console.log(`⚠️  Документ ${jobData.documentId} не найден в БД. Пропускаем.`);
      return;
    }

    // 2. Обновляем статус на "processing"
    await prisma.document.update({
      where: { id: jobData.documentId },
      data: {
        ocrStatus: 'processing',
        ocrStartedAt: new Date()
      }
    });

    // 3. Читаем файл
    const fullPath = path.resolve(jobData.filePath);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`Файл не найден: ${fullPath}`);
    }

    const fileBuffer = fs.readFileSync(fullPath);
    console.log(`📦 Файл прочитан: ${fileBuffer.length} байт`);

    // 4. Обрабатываем файл через многоуровневую OCR систему
    const enablePostProcessing = process.env.ENABLE_FOUNDATION_MODELS_POSTPROCESSING !== 'false';

    console.log(`🤖 Foundation Models постобработка: ${enablePostProcessing ? 'включена' : 'выключена'}`);

    let ocrResult;

    if (enablePostProcessing) {
      // С постобработкой через Foundation Models
      ocrResult = await processImageWithPostProcessing(fileBuffer, {
        ocrOptions: {
          preferredSource: 'auto',
          enableFallback: true,
          minConfidence: 0.6
        },
        postProcessOptions: {
          fixErrors: true,
          extractData: true,
          classifyCategory: true
        }
      });
    } else {
      // Без постобработки (только OCR)
      const { processImageMultiLevel } = await import('../lib/multi-level-ocr-service');
      ocrResult = await processImageMultiLevel(fileBuffer, {
        preferredSource: 'auto',
        enableFallback: true,
        minConfidence: 0.6
      });
    }

    console.log(`✅ OCR завершен: ${ocrResult.text.length} символов, confidence: ${ocrResult.confidence.toFixed(2)}`);
    console.log(`🔍 Источник: ${ocrResult.source}, Время: ${ocrResult.processingTime}ms`);

    // 5. Подготавливаем данные для сохранения
    const updateData: any = {
      ocrStatus: 'completed',
      ocrCompletedAt: new Date(),
      ocrData: {
        text: ocrResult.text,
        confidence: ocrResult.confidence,
        source: ocrResult.source,
        processingTime: ocrResult.processingTime,
        words: ocrResult.words || [],
        extractedData: ocrResult.extractedData || null,
        fixedText: ocrResult.fixedText || null,
        category: ocrResult.category || null,
        categoryConfidence: ocrResult.categoryConfidence || null
      }
    };

    // 6. Автоматически устанавливаем категорию если confidence > 0.5
    if (ocrResult.category && ocrResult.categoryConfidence && ocrResult.categoryConfidence > 0.5) {
      updateData.category = ocrResult.category;
      console.log(`🏷️  Категория определена автоматически: ${ocrResult.category} (${(ocrResult.categoryConfidence * 100).toFixed(1)}%)`);
    }

    // 7. Сохраняем результаты
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
        ocrStatus: 'error',
        ocrCompletedAt: new Date(),
        ocrData: {
          error: error.message,
          errorStack: error.stack
        }
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

    // Настраиваем обработчик задач OCR
    await boss.work(
      QUEUE_NAMES.OCR,
      {
        teamSize: parseInt(process.env.OCR_WORKER_CONCURRENCY || '3'),
        batchSize: 1
      },
      async (job: any) => {
        await processOcrJob(job);
      }
    );

    console.log(`✅ OCR Worker запущен и слушает очередь: ${QUEUE_NAMES.OCR}`);
    console.log(`⚙️  Параллельность: ${process.env.OCR_WORKER_CONCURRENCY || 3}`);
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
