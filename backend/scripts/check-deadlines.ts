/**
 * Cron Job для проверки дедлайнов отчётов
 * Задача 7.12: Cron job для дедлайнов
 *
 * Запускается 1 раз в день (например, в 9:00 MSK) и проверяет отчёты с приближающимися дедлайнами.
 * Отправляет уведомления пользователям за 30, 7 и 1 день до крайнего срока.
 *
 * Использование:
 * - Локально: npx tsx backend/scripts/check-deadlines.ts
 * - Продакшн: настроить cron job или используя Vercel Cron Jobs
 */

import { prisma } from '../lib/prisma';
import { notificationService, NotificationType, NotificationPriority } from '../lib/notification-service';
import { Logger } from '../lib/logger';

const logger = new Logger('check-deadlines-cron');

/**
 * Получить дату N дней назад
 */
function getDaysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Получить дату через N дней
 */
function getDaysFromNow(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(23, 59, 59, 999);
  return date;
}

/**
 * Форматировать дату для отображения
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

/**
 * Проверить отчёты с дедлайном через указанное количество дней
 */
async function checkDeadlinesForDays(days: number): Promise<number> {
  try {
    const targetDate = getDaysFromNow(days);
    const previousCheck = getDaysAgo(1); // Проверяем что не отправляли вчера

    logger.info(`Проверка отчётов с дедлайном через ${days} дней`, {
      targetDate: formatDate(targetDate),
      previousCheck: formatDate(previousCheck)
    });

    // Находим отчёты с дедлайном в целевой день
    // Исключаем уже отправленные/утвержденные отчёты
    const reports = await prisma.report.findMany({
      where: {
        submissionDeadline: {
          gte: getDaysFromNow(days - 1), // Начало целевого дня
          lte: targetDate // Конец целевого дня
        },
        status: {
          in: ['DRAFT', 'READY']
        }
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    });

    logger.info(`Найдено отчётов с дедлайном через ${days} дней: ${reports.length}`);

    let sentCount = 0;

    for (const report of reports) {
      try {
        // Проверяем настройки пользователя - должны ли отправлять уведомления о дедлайнах
        const preferences = await prisma.notificationPreferences.findUnique({
          where: { userId: report.userId }
        });

        // Проверяем что у пользователя включены уведомления о дедлайнах
        if (preferences && !preferences.deadlinesEnabled) {
          logger.info(`Уведомления о дедлайнах отключены для пользователя`, {
            userId: report.userId,
            reportId: report.id
          });
          continue;
        }

        // Проверяем что этот срок (30/7/1 день) включен в настройках
        if (preferences && preferences.deadlineDays) {
          const deadlineDaysArray = preferences.deadlineDays as number[];
          if (!deadlineDaysArray.includes(days)) {
            logger.info(`Уведомление за ${days} дней не включено в настройках`, {
              userId: report.userId,
              reportId: report.id,
              enabledDays: deadlineDaysArray
            });
            continue;
          }
        }

        // Определяем тип уведомления в зависимости от количества дней
        let notificationType: NotificationType;
        let priority: NotificationPriority;

        if (days === 30) {
          notificationType = NotificationType.DEADLINE_30_DAYS;
          priority = NotificationPriority.LOW;
        } else if (days === 7) {
          notificationType = NotificationType.DEADLINE_7_DAYS;
          priority = NotificationPriority.MEDIUM;
        } else if (days === 1) {
          notificationType = NotificationType.DEADLINE_1_DAY;
          priority = NotificationPriority.URGENT;
        } else {
          // Для других сроков используем общий тип
          notificationType = NotificationType.DEADLINE_7_DAYS;
          priority = NotificationPriority.MEDIUM;
        }

        // Формируем сообщение
        const deadlineFormatted = report.submissionDeadline
          ? formatDate(report.submissionDeadline)
          : 'Скоро';

        const title = days === 1
          ? `Срочно! Завтра дедлайн отчёта "${report.name}"`
          : `Напоминание: до дедлайна отчёта "${report.name}" осталось ${days} ${getDaysWord(days)}`;

        const message = days === 1
          ? `Завтра истекает срок подачи отчёта. Убедитесь что все данные проверены и отчёт готов к отправке!`
          : `Срок подачи отчёта: ${deadlineFormatted}. Осталось ${days} ${getDaysWord(days)}. ${report.status === 'DRAFT' ? 'Отчёт ещё в черновике, завершите его подготовку.' : 'Проверьте готовность данных.'}`;

        // Отправляем уведомление
        await notificationService.sendNotification({
          userId: report.userId,
          type: notificationType,
          title,
          message,
          metadata: {
            reportId: report.id,
            reportName: report.name,
            deadline: deadlineFormatted,
            daysLeft: days,
            reportStatus: report.status,
            link: `/reports/${report.id}`,
            priority
          }
        });

        sentCount++;
        logger.info(`Уведомление о дедлайне отправлено`, {
          userId: report.userId,
          reportId: report.id,
          reportName: report.name,
          daysLeft: days
        });

      } catch (error) {
        logger.error('Ошибка отправки уведомления о дедлайне',
          error instanceof Error ? error : new Error(String(error)),
          {
            reportId: report.id,
            userId: report.userId
          }
        );
        // Продолжаем обработку других отчётов
      }
    }

    logger.info(`Завершена проверка дедлайнов через ${days} дней`, {
      found: reports.length,
      sent: sentCount
    });

    return sentCount;

  } catch (error) {
    logger.error(`Ошибка при проверке дедлайнов через ${days} дней`,
      error instanceof Error ? error : new Error(String(error))
    );
    throw error;
  }
}

/**
 * Получить правильную форму слова "день"
 */
function getDaysWord(days: number): string {
  if (days === 1) return 'день';
  if (days >= 2 && days <= 4) return 'дня';
  return 'дней';
}

/**
 * Главная функция проверки дедлайнов
 */
async function checkDeadlines() {
  const startTime = Date.now();

  logger.info('🚀 Запуск проверки дедлайнов отчётов', {
    timestamp: new Date().toISOString()
  });

  try {
    // Проверяем дедлайны за 30, 7 и 1 день
    const results = await Promise.allSettled([
      checkDeadlinesForDays(30),
      checkDeadlinesForDays(7),
      checkDeadlinesForDays(1)
    ]);

    let totalSent = 0;
    const errors: string[] = [];

    results.forEach((result, index) => {
      const days = [30, 7, 1][index];
      if (result.status === 'fulfilled') {
        totalSent += result.value;
        logger.info(`✅ Дедлайны через ${days} дней: отправлено ${result.value} уведомлений`);
      } else {
        const error = `Ошибка при проверке дедлайнов через ${days} дней: ${result.reason}`;
        errors.push(error);
        logger.error(error);
      }
    });

    const executionTime = Date.now() - startTime;

    logger.info('✅ Проверка дедлайнов завершена', {
      totalSent,
      errors: errors.length,
      executionTimeMs: executionTime
    });

    if (errors.length > 0) {
      console.error('⚠️ Обнаружены ошибки при проверке дедлайнов:', errors);
    }

  } catch (error) {
    logger.error('❌ Критическая ошибка при проверке дедлайнов',
      error instanceof Error ? error : new Error(String(error))
    );
    throw error;
  } finally {
    // Закрываем соединение с БД
    await prisma.$disconnect();
  }
}

// Запускаем проверку если скрипт вызван напрямую
if (require.main === module) {
  checkDeadlines()
    .then(() => {
      console.log('✅ Проверка дедлайнов успешно завершена');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Ошибка при проверке дедлайнов:', error);
      process.exit(1);
    });
}

// Экспортируем для использования в других местах (например, API route для Vercel Cron)
export { checkDeadlines };