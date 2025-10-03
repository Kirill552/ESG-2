#!/usr/bin/env tsx

/**
 * Тестовый скрипт для проверки генерации PDF отчетов 296-ФЗ
 */

import { generate296FZFullReport } from '../lib/enhanced-report-generator';
import { promises as fs } from 'fs';
import path from 'path';

async function testPDFGeneration() {
  console.log('🧪 Тестирование генерации PDF отчета 296-ФЗ...\n');

  try {
    // Тестовые данные
    const testReportData = {
      organizationId: 'test-org-001',
      organizationName: 'ООО "Тестовая Экологическая Компания"',
      documentId: 'test-report-001',
      reportId: 'REP296FZ20250001',
      period: '2024',
      methodology: '296-ФЗ от 02.07.2021 (ПП 707)',
      submissionDeadline: new Date('2025-07-01'), // 296-ФЗ: отчет за 2024 сдается до 1 июля 2025
      organizationInn: '7701234567',
      organizationAddress: '119021, г. Москва, ул. Льва Толстого, д. 16',
      emissionData: {
        scope1: 425.8,    // Прямые выбросы
        scope2: 750.6,    // Энергетические выбросы
        scope3: 125.3,    // Косвенные выбросы
        total: 1301.7,    // Будет пересчитано
        sources: {
          energy: 650.2,      // Электроэнергия
          transport: 235.4,   // Транспорт
          production: 315.1,  // Производство
          waste: 45.7,        // Отходы
          suppliers: 55.3     // Поставщики
        }
      },
      variables: {
        responsible_person: 'Иванов И.И.',
        phone_number: '+7 (495) 123-45-67',
        email: 'eco@testcompany.ru'
      }
    };

    console.log('📊 Данные отчета:');
    console.log(`- Организация: ${testReportData.organizationName}`);
    console.log(`- ИНН: ${testReportData.organizationInn}`);
    console.log(`- Период: ${testReportData.period}`);
    console.log(`- Общие выбросы: ${testReportData.emissionData.total} тСО₂-экв\n`);

    // Генерируем отчет
    console.log('⚡ Генерация отчета...');
    const startTime = Date.now();

    const result = await generate296FZFullReport(testReportData, {
      outputDir: path.join(process.cwd(), 'test_reports'),
      writeToDisk: true
    });

    const duration = Date.now() - startTime;
    console.log(`✨ Генерация завершена за ${duration}ms\n`);

    if (result.success) {
      console.log('✅ Отчет успешно сгенерирован!');
      console.log(`- HTML размер: ${result.html?.length || 0} символов`);
      console.log(`- PDF размер: ${result.pdf?.length || 0} байт`);

      if (result.filePath) {
        console.log(`- Файл сохранен: ${result.filePath}`);
      }

      if (result.meta) {
        console.log(`\n📋 Метаданные отчета:`);
        console.log(`- ID организации: ${result.meta.organizationId}`);
        console.log(`- ID документа: ${result.meta.documentId}`);
        console.log(`- ID отчета: ${result.meta.reportId}`);

        if (result.meta.emissionData) {
          const emissions = result.meta.emissionData;
          console.log(`\n🌱 Данные о выбросах:`);
          console.log(`- Scope 1 (прямые): ${emissions.scope1} тСО₂-экв`);
          console.log(`- Scope 2 (энергия): ${emissions.scope2} тСО₂-экв`);
          console.log(`- Scope 3 (косвенные): ${emissions.scope3} тСО₂-экв`);
          console.log(`- Общий итог: ${emissions.total} тСО₂-экв`);
        }
      }

      // Проверим что PDF файл действительно создан и имеет разумный размер
      if (result.pdf) {
        const minPDFSize = 10000; // Минимум 10KB для валидного PDF
        if (result.pdf.length > minPDFSize) {
          console.log(`\n✅ PDF файл корректного размера (${(result.pdf.length / 1024).toFixed(1)} KB)`);
        } else {
          console.log(`\n⚠️  PDF файл слишком маленький (${result.pdf.length} байт)`);
        }

        // Проверим заголовок PDF файла
        const pdfHeader = result.pdf.toString('ascii', 0, 10);
        if (pdfHeader.startsWith('%PDF-')) {
          console.log(`✅ PDF заголовок корректный: ${pdfHeader}`);
        } else {
          console.log(`❌ Некорректный PDF заголовок: ${pdfHeader}`);
        }
      }

    } else {
      console.log('❌ Ошибка при генерации отчета:');
      console.log(`   ${result.error}`);
    }

  } catch (error) {
    console.error('💥 Критическая ошибка при тестировании:', error);

    if (error instanceof Error) {
      console.error('Сообщение:', error.message);
      console.error('Stack trace:', error.stack);
    }
  }
}

// Запускаем тест
if (require.main === module) {
  testPDFGeneration()
    .then(() => {
      console.log('\n🎉 Тестирование завершено');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Тест завершился с ошибкой:', error);
      process.exit(1);
    });
}

export { testPDFGeneration };