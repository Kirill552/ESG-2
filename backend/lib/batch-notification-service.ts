import { prisma } from './prisma';
import { notificationService, NotificationType, NotificationPriority } from './notification-service';

/**
 * Сервис для управления batch уведомлениями при массовой обработке документов
 */
class BatchNotificationService {
  /**
   * Обновить прогресс batch после обработки документа
   */
  async updateBatchProgress(
    documentId: string,
    success: boolean
  ): Promise<void> {
    try {
      // Получаем документ с batch информацией
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        select: {
          id: true,
          batchId: true,
          fileName: true,
          userId: true
        }
      });

      if (!document || !document.batchId) {
        // Это одиночный документ без batch - отправляем обычное уведомление
        return;
      }

      // Обновляем счетчики в batch
      const batch = await prisma.documentBatch.update({
        where: { id: document.batchId },
        data: {
          processedCount: success ? { increment: 1 } : undefined,
          failedCount: !success ? { increment: 1 } : undefined,
          pendingCount: { decrement: 1 }
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

      console.log(`📊 Batch ${batch.id} прогресс: ${batch.processedCount + batch.failedCount}/${batch.totalCount}`);

      // Проверяем, все ли документы обработаны
      const isCompleted = batch.pendingCount === 0;

      if (isCompleted && !batch.notificationSent) {
        await this.sendBatchCompletionNotification(batch);
      }
    } catch (error) {
      console.error('❌ Ошибка обновления batch прогресса:', error);
      // Не прерываем выполнение
    }
  }

  /**
   * Отправить итоговое уведомление о завершении batch
   */
  private async sendBatchCompletionNotification(batch: any): Promise<void> {
    try {
      const totalProcessed = batch.processedCount + batch.failedCount;
      const hasErrors = batch.failedCount > 0;

      // Формируем сообщение в зависимости от результатов
      let title: string;
      let message: string;
      let priority: NotificationPriority;

      if (batch.failedCount === 0) {
        // Все успешно
        title = 'Все документы обработаны';
        message = `Успешно обработано ${batch.processedCount} ${this.getPluralForm(batch.processedCount, 'документ', 'документа', 'документов')}`;
        priority = NotificationPriority.LOW;
      } else if (batch.processedCount === 0) {
        // Все с ошибками
        title = 'Ошибка обработки документов';
        message = `Не удалось обработать ${batch.failedCount} ${this.getPluralForm(batch.failedCount, 'документ', 'документа', 'документов')}. Проверьте форматы файлов.`;
        priority = NotificationPriority.HIGH;
      } else {
        // Частично успешно
        title = 'Обработка документов завершена';
        message = `Обработано ${batch.processedCount} из ${batch.totalCount} ${this.getPluralForm(batch.totalCount, 'документа', 'документов', 'документов')}. ${batch.failedCount} с ошибками.`;
        priority = NotificationPriority.MEDIUM;
      }

      // Отправляем уведомление
      await notificationService.sendNotification({
        userId: batch.userId,
        type: hasErrors ? NotificationType.DOCUMENT_ERROR : NotificationType.DOCUMENT_PROCESSED,
        title,
        message,
        metadata: {
          batchId: batch.id,
          totalCount: batch.totalCount,
          processedCount: batch.processedCount,
          failedCount: batch.failedCount,
          link: hasErrors ? '/documents?status=error' : '/documents',
          priority
        }
      });

      // Отмечаем что уведомление отправлено
      await prisma.documentBatch.update({
        where: { id: batch.id },
        data: {
          notificationSent: true,
          completedAt: new Date()
        }
      });

      console.log(`📧 Batch уведомление отправлено для batch ${batch.id}`);
    } catch (error) {
      console.error('❌ Ошибка отправки batch уведомления:', error);
    }
  }

  /**
   * Проверить должно ли быть отправлено индивидуальное уведомление
   * Возвращает true если документ одиночный (не в batch) или batch маленький (1-2 документа)
   */
  async shouldSendIndividualNotification(documentId: string): Promise<boolean> {
    try {
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        select: {
          batchId: true,
          batch: {
            select: {
              totalCount: true
            }
          }
        }
      });

      // Если нет batch - отправляем индивидуальное уведомление
      if (!document || !document.batchId || !document.batch) {
        return true;
      }

      // Если batch маленький (1-2 документа) - отправляем индивидуальные уведомления
      if (document.batch.totalCount <= 2) {
        return true;
      }

      // Для больших batch (3+) - не отправляем индивидуальные уведомления
      return false;
    } catch (error) {
      console.error('❌ Ошибка проверки необходимости индивидуального уведомления:', error);
      // В случае ошибки - отправляем уведомление (безопасный fallback)
      return true;
    }
  }

  /**
   * Получить правильную форму множественного числа для русского языка
   */
  private getPluralForm(count: number, form1: string, form2: string, form3: string): string {
    const n = Math.abs(count) % 100;
    const n1 = n % 10;

    if (n > 10 && n < 20) return form3;
    if (n1 > 1 && n1 < 5) return form2;
    if (n1 === 1) return form1;

    return form3;
  }

  /**
   * Создать новый batch для загрузки документов
   */
  async createBatch(userId: string, documentCount: number): Promise<string | null> {
    try {
      // Не создаем batch для одиночных/парных загрузок
      if (documentCount <= 2) {
        return null;
      }

      const batch = await prisma.documentBatch.create({
        data: {
          userId,
          totalCount: documentCount,
          pendingCount: documentCount,
          processedCount: 0,
          failedCount: 0
        }
      });

      console.log(`📦 Создан batch ${batch.id} для ${documentCount} документов`);
      return batch.id;
    } catch (error) {
      console.error('❌ Ошибка создания batch:', error);
      return null;
    }
  }

  /**
   * Получить статистику batch
   */
  async getBatchStats(batchId: string) {
    try {
      const batch = await prisma.documentBatch.findUnique({
        where: { id: batchId },
        select: {
          id: true,
          totalCount: true,
          processedCount: true,
          failedCount: true,
          pendingCount: true,
          notificationSent: true,
          completedAt: true,
          createdAt: true
        }
      });

      return batch;
    } catch (error) {
      console.error('❌ Ошибка получения статистики batch:', error);
      return null;
    }
  }
}

// Экспортируем singleton instance
export const batchNotificationService = new BatchNotificationService();