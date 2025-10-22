/**
 * Скрипт для очистки зависших задач в pg-boss
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Загружаем переменные окружения
const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });
console.log('🔧 [ENV] Загружаем .env из:', envPath);

import { createPgBoss, QUEUE_NAMES } from '../lib/pg-boss-config';

async function clearStuckJobs() {
  console.log('🔧 Очистка зависших задач в pg-boss...\n');

  try {
    const boss = await createPgBoss();
    console.log('✅ Подключение к pg-boss установлено\n');

    // Получаем статистику очереди
    const stats = await boss.getQueueStats(QUEUE_NAMES.OCR);
    console.log('📊 Статистика очереди ПЕРЕД очисткой:');
    console.log(`   - В очереди (queued): ${stats.queuedCount}`);
    console.log(`   - В работе (active): ${stats.activeCount}`);
    console.log(`   - Отложенные (deferred): ${stats.deferredCount}`);
    console.log(`   - Всего: ${stats.totalCount}\n`);

    if (stats.activeCount > 0) {
      console.log(`⚠️  Обнаружено ${stats.activeCount} зависших задач в статусе 'active'`);
      console.log('🔄 Используем resume() для повторной обработки...\n');

      // pg-boss v11: resume() повторно ставит активные задачи в очередь
      await boss.resume(QUEUE_NAMES.OCR);
      console.log('✅ Задачи возвращены в очередь для повторной обработки\n');

      // Даем время на обновление статистики
      await new Promise(resolve => setTimeout(resolve, 1000));
    } else {
      console.log('✅ Зависших задач не обнаружено\n');
    }

    // Статистика ПОСЛЕ очистки
    const statsAfter = await boss.getQueueStats(QUEUE_NAMES.OCR);
    console.log('📊 Статистика очереди ПОСЛЕ очистки:');
    console.log(`   - В очереди (queued): ${statsAfter.queuedCount}`);
    console.log(`   - В работе (active): ${statsAfter.activeCount}`);
    console.log(`   - Отложенные (deferred): ${statsAfter.deferredCount}`);
    console.log(`   - Всего: ${statsAfter.totalCount}\n`);

    await boss.stop();
    console.log('✅ Скрипт выполнен успешно');
    process.exit(0);

  } catch (error) {
    console.error('❌ Ошибка при очистке задач:', error);
    process.exit(1);
  }
}

clearStuckJobs();
