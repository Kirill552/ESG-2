/**
 * Скрипт для переобработки транспортных документов с исправленной логикой
 */

import prisma from '../lib/prisma';
import PgBoss from 'pg-boss';

async function reprocessTransportDocuments() {
  console.log('🔄 Запуск переобработки транспортных документов...\n');

  try {
    // Подключаемся к PgBoss
    const boss = new PgBoss({
      connectionString: process.env.DATABASE_URL!
    });

    await boss.start();
    console.log('✅ PgBoss подключен\n');

    // Находим все транспортные документы
    const transportDocs = await prisma.document.findMany({
      where: {
        status: 'PROCESSED',
        category: 'TRANSPORT'
      },
      select: {
        id: true,
        fileName: true,
        filePath: true,
        userId: true,
        fileType: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });

    console.log(`📊 Найдено транспортных документов: ${transportDocs.length}\n`);

    if (transportDocs.length === 0) {
      console.log('❌ Нет транспортных документов для переобработки');
      await boss.stop();
      return;
    }

    // Обновляем статус и отправляем в очередь
    for (const doc of transportDocs) {
      console.log(`📄 Переобработка: ${doc.fileName}`);
      console.log(`   ID: ${doc.id}`);

      // Обновляем статус на QUEUED
      await prisma.document.update({
        where: { id: doc.id },
        data: {
          status: 'QUEUED',
          processingStage: 'QUEUED',
          processingMessage: 'Переобработка с исправленной логикой сохранения transport data',
          retryCount: 0,
          errorDetails: null,
          errorType: null
        }
      });

      // Добавляем в очередь OCR
      await boss.send('ocr-processing', {
        documentId: doc.id,
        userId: doc.userId,
        filePath: doc.filePath,
        fileType: doc.fileType
      });

      console.log(`   ✅ Отправлен в очередь на переобработку\n`);
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`✅ Переобработка запущена для ${transportDocs.length} документов`);
    console.log(`🔍 Отслеживайте прогресс в логах воркера`);
    console.log(`${'='.repeat(80)}\n`);

    await boss.stop();

  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

reprocessTransportDocuments();
