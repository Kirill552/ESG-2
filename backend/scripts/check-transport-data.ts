/**
 * Скрипт для проверки данных транспортных документов в базе
 */

import prisma from '../lib/prisma';

async function checkTransportDocuments() {
  console.log('🔍 Проверка транспортных документов в базе данных...\n');

  try {
    // Находим все обработанные документы
    const documents = await prisma.document.findMany({
      where: {
        status: 'PROCESSED'
      },
      select: {
        id: true,
        fileName: true,
        ocrData: true,
        category: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5
    });

    console.log(`📊 Найдено обработанных документов: ${documents.length}\n`);

    for (const doc of documents) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`📄 Документ: ${doc.fileName}`);
      console.log(`🆔 ID: ${doc.id}`);
      console.log(`📅 Дата: ${doc.createdAt.toLocaleString('ru-RU')}`);
      console.log(`${'='.repeat(80)}\n`);

      if (doc.ocrData && typeof doc.ocrData === 'object') {
        const data = doc.ocrData as any;

        console.log('📋 Структура ocrData:');
        console.log(JSON.stringify(Object.keys(data), null, 2));
        console.log('');

        // Проверяем наличие транспортных данных
        if (data.extractedData) {
          console.log('✅ extractedData найден');
          console.log('Ключи extractedData:', Object.keys(data.extractedData));

          if (data.extractedData.transport) {
            console.log('\n🚗 ТРАНСПОРТНЫЕ ДАННЫЕ НАЙДЕНЫ:');
            console.log(JSON.stringify(data.extractedData.transport, null, 2));
          } else {
            console.log('\n❌ extractedData.transport НЕ НАЙДЕН');
          }
        } else {
          console.log('❌ extractedData не найден в ocrData');
        }

        // Проверяем другие возможные поля с выбросами
        if (data.emissions) {
          console.log(`\n💨 emissions: ${data.emissions}`);
        }
        if (data.co2) {
          console.log(`💨 co2: ${data.co2}`);
        }
        if (data.carbon) {
          console.log(`💨 carbon: ${data.carbon}`);
        }

        // Показываем категорию
        if (data.category) {
          console.log(`\n🏷️ Категория: ${data.category}`);
        }
      } else {
        console.log('❌ ocrData пустой или не является объектом');
      }
    }

    console.log(`\n\n${'='.repeat(80)}`);
    console.log('✅ Проверка завершена');
    console.log(`${'='.repeat(80)}\n`);

  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTransportDocuments();
