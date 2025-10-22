/**
 * Скрипт для сброса зависших задач через прямое подключение к PostgreSQL
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { Client } from 'pg';

// Загружаем переменные окружения
const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

async function resetStuckJobs() {
  console.log('🔧 Сброс зависших задач через прямое SQL подключение...\n');

  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('✅ Подключено к PostgreSQL\n');

    // Проверяем текущее состояние
    console.log('📊 Текущее состояние задач:');
    const statsBefore = await client.query(`
      SELECT state, COUNT(*) as count
      FROM pgboss.job
      WHERE name = 'ocr-processing'
      GROUP BY state
    `);

    statsBefore.rows.forEach(row => {
      console.log(`   - ${row.state}: ${row.count}`);
    });
    console.log('');

    // Помечаем все активные задачи как failed
    const updateResult = await client.query(`
      UPDATE pgboss.job
      SET state = 'failed',
          completedon = NOW(),
          output = '{"error": "Task was stuck in active state and manually reset"}'::jsonb
      WHERE name = 'ocr-processing'
        AND state = 'active'
    `);

    console.log(`✅ Обновлено задач: ${updateResult.rowCount}\n`);

    // Проверяем результат
    console.log('📊 Состояние после очистки:');
    const statsAfter = await client.query(`
      SELECT state, COUNT(*) as count
      FROM pgboss.job
      WHERE name = 'ocr-processing'
      GROUP BY state
    `);

    statsAfter.rows.forEach(row => {
      console.log(`   - ${row.state}: ${row.count}`);
    });

    await client.end();
    console.log('\n✅ Скрипт выполнен успешно');
    process.exit(0);

  } catch (error) {
    console.error('❌ Ошибка:', error);
    await client.end();
    process.exit(1);
  }
}

resetStuckJobs();
