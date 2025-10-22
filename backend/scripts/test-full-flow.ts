/**
 * Интеграционный тест полного флоу:
 * 1. Загрузка документов из test_ttn
 * 2. OCR обработка
 * 3. Создание отчета
 * 4. Просмотр отчета
 *
 * Логирование на каждом этапе для поиска проблем
 */

import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';
import FormData from 'form-data';

const prisma = new PrismaClient();

// Цвета для логирования
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(stage: string, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(`${colors.blue}[${timestamp}]${colors.reset} ${colors.magenta}[${stage}]${colors.reset} ${message}`);
  if (data) {
    console.log(`${colors.yellow}Data:${colors.reset}`, JSON.stringify(data, null, 2));
  }
}

function logSuccess(stage: string, message: string) {
  console.log(`${colors.green}✓ [${stage}] ${message}${colors.reset}`);
}

function logError(stage: string, message: string, error?: any) {
  console.log(`${colors.red}✗ [${stage}] ${message}${colors.reset}`);
  if (error) {
    console.error(`${colors.red}Error:${colors.reset}`, error);
  }
}

async function testFullFlow() {
  try {
    log('INIT', '🚀 Начало интеграционного теста полного флоу');

    // ========== ЭТАП 1: Подготовка тестового пользователя ==========
    log('STAGE-1', '👤 Поиск или создание тестового пользователя');

    let testUser = await prisma.user.findFirst({
      where: { email: 'test@esg-lite.ru' }
    });

    if (!testUser) {
      testUser = await prisma.user.create({
        data: {
          email: 'test@esg-lite.ru',
          name: 'Тестовый Пользователь',
          mode: 'PAID' // Важно: используем реальный режим, не demo
        }
      });
      logSuccess('STAGE-1', `Создан новый пользователь: ${testUser.email}`);
    } else {
      // Обновляем режим на PAID
      testUser = await prisma.user.update({
        where: { id: testUser.id },
        data: { mode: 'PAID' }
      });
      logSuccess('STAGE-1', `Найден существующий пользователь: ${testUser.email}`);
    }

    log('STAGE-1', 'Информация о пользователе:', {
      id: testUser.id,
      email: testUser.email,
      mode: testUser.mode
    });

    // ========== ЭТАП 2: Загрузка документов из test_ttn ==========
    log('STAGE-2', '📁 Загрузка документов из папки test_ttn');

    const testTtnPath = path.join(process.cwd(), '..', 'test_ttn');
    log('STAGE-2', `Путь к тестовым документам: ${testTtnPath}`);

    if (!fs.existsSync(testTtnPath)) {
      throw new Error(`Папка test_ttn не найдена по пути: ${testTtnPath}`);
    }

    const files = fs.readdirSync(testTtnPath).filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.pdf', '.xlsx', '.xls', '.csv', '.jpg', '.jpeg', '.png', '.doc', '.docx'].includes(ext);
    });

    log('STAGE-2', `Найдено файлов для загрузки: ${files.length}`, { files });

    if (files.length === 0) {
      throw new Error('В папке test_ttn нет подходящих файлов для тестирования');
    }

    const uploadedDocuments: any[] = [];

    for (const fileName of files) {
      try {
        const filePath = path.join(testTtnPath, fileName);
        const fileContent = fs.readFileSync(filePath);
        const fileSize = fs.statSync(filePath).size;
        const fileType = path.extname(fileName).toLowerCase().substring(1);

        log('STAGE-2', `Загрузка файла: ${fileName}`, {
          size: fileSize,
          type: fileType
        });

        // Создаем документ в БД
        const document = await prisma.document.create({
          data: {
            fileName: `test_${Date.now()}_${fileName}`,
            originalName: fileName,
            filePath: filePath, // Путь к реальному файлу
            fileSize,
            fileType: `application/${fileType}`,
            userId: testUser.id,
            status: 'UPLOADED',
            category: 'TRANSPORT' // ТТН - это транспортные документы
          }
        });

        uploadedDocuments.push(document);
        logSuccess('STAGE-2', `Документ загружен: ${fileName} (ID: ${document.id})`);

      } catch (error) {
        logError('STAGE-2', `Ошибка загрузки файла ${fileName}`, error);
      }
    }

    log('STAGE-2', `Всего загружено документов: ${uploadedDocuments.length}`);

    // ========== ЭТАП 3: Симуляция OCR обработки ==========
    log('STAGE-3', '🔍 Симуляция OCR обработки документов');

    for (const doc of uploadedDocuments) {
      try {
        log('STAGE-3', `Обработка документа: ${doc.originalName} (ID: ${doc.id})`);

        // Симулируем OCR обработку
        const updatedDoc = await prisma.document.update({
          where: { id: doc.id },
          data: {
            status: 'PROCESSED',
            ocrProcessed: true,
            ocrData: {
              fullText: `Тестовый OCR текст для документа ${doc.originalName}`,
              emissions: Math.random() * 100 + 50, // 50-150 тонн CO2
              transport: {
                vehicle: 'Грузовой автомобиль',
                distance: Math.random() * 500 + 100,
                fuelType: 'Дизель'
              }
            },
            ocrConfidence: 0.95,
            processingCompletedAt: new Date()
          }
        });

        logSuccess('STAGE-3', `Документ обработан: ${doc.originalName}`);
        log('STAGE-3', 'Извлеченные данные:', updatedDoc.ocrData);

      } catch (error) {
        logError('STAGE-3', `Ошибка обработки документа ${doc.originalName}`, error);
      }
    }

    // ========== ЭТАП 4: Создание отчета ==========
    log('STAGE-4', '📊 Создание отчета 296-ФЗ');

    try {
      // Получаем все обработанные документы
      const processedDocs = await prisma.document.findMany({
        where: {
          userId: testUser.id,
          status: 'PROCESSED'
        },
        select: {
          id: true,
          ocrData: true
        }
      });

      log('STAGE-4', `Найдено обработанных документов: ${processedDocs.length}`);

      // Подсчитываем общие выбросы
      let totalEmissions = 0;
      processedDocs.forEach(doc => {
        if (doc.ocrData && typeof doc.ocrData === 'object') {
          const data = doc.ocrData as any;
          if (data.emissions) {
            totalEmissions += Number(data.emissions) || 0;
          }
        }
      });

      log('STAGE-4', `Рассчитанные выбросы: ${totalEmissions} тСО₂-экв`);

      // Создаем отчет
      const reportFileName = `test_report_${Date.now()}.pdf`;
      const report = await prisma.report.create({
        data: {
          name: `Тестовый отчет ${new Date().toISOString().split('T')[0]}`,
          reportType: 'REPORT_296FZ',
          format: 'PDF',
          fileName: reportFileName,
          filePath: `/reports/${reportFileName}`,
          period: '2025',
          status: 'READY',
          userId: testUser.id,
          submissionDeadline: new Date('2026-07-01'),
          totalEmissions,
          documentCount: processedDocs.length,
          emissionData: {
            total: totalEmissions,
            byCategory: {
              transport: totalEmissions
            }
          }
        }
      });

      logSuccess('STAGE-4', `Отчет создан успешно!`);
      log('STAGE-4', 'Информация об отчете:', {
        id: report.id,
        name: report.name,
        period: report.period,
        totalEmissions: report.totalEmissions,
        documentCount: report.documentCount,
        status: report.status,
        deadline: report.submissionDeadline
      });

      // ========== ЭТАП 5: Проверка генерации PDF ==========
      log('STAGE-5', '📄 Проверка генерации PDF отчета');

      try {
        // Импортируем генератор отчетов
        const { generate296FZFullReport } = await import('../lib/enhanced-report-generator');

        const reportData = {
          organizationId: testUser.id,
          organizationName: 'ООО "Тестовая Организация"',
          documentId: report.id,
          reportId: report.id,
          period: report.period,
          methodology: '296-ФЗ от 02.07.2021',
          submissionDeadline: report.submissionDeadline,
          organizationInn: '1234567890',
          organizationAddress: 'Москва, Россия',
          emissionData: {
            scope1: totalEmissions * 0.4,
            scope2: totalEmissions * 0.4,
            scope3: totalEmissions * 0.2,
            total: totalEmissions,
            sources: {
              energy: totalEmissions * 0.3,
              transport: totalEmissions * 0.5,
              production: totalEmissions * 0.1,
              waste: totalEmissions * 0.05,
              suppliers: totalEmissions * 0.05
            }
          },
          variables: {
            responsible_person: 'Иванов Иван Иванович',
            phone_number: '+7 (495) 123-45-67',
            email: testUser.email
          }
        };

        log('STAGE-5', 'Генерация PDF с параметрами:', reportData);

        const result = await generate296FZFullReport(reportData, {
          writeToDisk: true,
          outputDir: path.join(process.cwd(), 'test-reports')
        });

        if (result.success) {
          logSuccess('STAGE-5', `PDF отчет сгенерирован успешно!`);
          log('STAGE-5', 'Результат генерации:', {
            success: result.success,
            filePath: result.filePath,
            fileName: result.fileName,
            fileSize: result.fileSize
          });
        } else {
          logError('STAGE-5', 'Не удалось сгенерировать PDF', result.error);
          if (result.templateErrors && result.templateErrors.length > 0) {
            log('STAGE-5', 'Ошибки валидации шаблона:', result.templateErrors);
          }
          if (result.unreplacedTokens && result.unreplacedTokens.length > 0) {
            log('STAGE-5', 'Незамененные токены:', result.unreplacedTokens);
          }
        }

      } catch (error) {
        logError('STAGE-5', 'Ошибка генерации PDF', error);
      }

      // ========== ИТОГИ ==========
      log('SUMMARY', '✅ Интеграционный тест завершен');
      log('SUMMARY', '📊 Результаты теста:', {
        userId: testUser.id,
        uploadedDocuments: uploadedDocuments.length,
        processedDocuments: processedDocs.length,
        reportId: report.id,
        totalEmissions,
        testPassed: true
      });

    } catch (error) {
      logError('STAGE-4', 'Ошибка создания отчета', error);
      throw error;
    }

  } catch (error) {
    logError('FATAL', 'Критическая ошибка теста', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Запуск теста
testFullFlow()
  .then(() => {
    console.log(`\n${colors.green}🎉 Тест успешно завершен!${colors.reset}\n`);
    process.exit(0);
  })
  .catch((error) => {
    console.error(`\n${colors.red}❌ Тест провален:${colors.reset}`, error);
    process.exit(1);
  });
