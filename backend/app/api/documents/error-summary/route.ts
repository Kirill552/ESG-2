import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { Logger } from "@/lib/logger";
import { getCurrentUserMode } from "@/lib/user-mode-utils";

const logger = new Logger("documents-error-summary-api");

// Демо данные для статистики ошибок
const DEMO_ERROR_SUMMARY = {
  totalErrors: 12,
  recentErrors: 4, // за последние 24 часа
  errorsByType: {
    'Поврежденный файл': 3,
    'Неподдерживаемый формат': 2,
    'Превышен размер': 2,
    'Ошибка OCR': 3,
    'Сервис недоступен': 1,
    'Другая ошибка': 1
  },
  errorsByCategory: {
    'PRODUCTION': 4,
    'SUPPLIERS': 3,
    'WASTE': 2,
    'TRANSPORT': 2,
    'ENERGY': 1
  },
  canReprocess: 11, // документы, которые можно переобработать
  recommendations: [
    {
      type: 'info',
      message: 'У вас есть 3 поврежденных файла. Проверьте исходные документы.',
      action: 'review_corrupted'
    },
    {
      type: 'warning',
      message: '2 файла превысили лимит размера. Рассмотрите сжатие или разделение файлов.',
      action: 'optimize_size'
    },
    {
      type: 'success',
      message: '11 документов готовы к переобработке.',
      action: 'reprocess_all'
    }
  ]
};

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  try {
    if (!session?.user?.email) {
      return NextResponse.json(
        {
          ok: false,
          message: "Пользователь не авторизован.",
        },
        { status: 401 }
      );
    }

    // Проверяем режим пользователя
    const userMode = await getCurrentUserMode();

    if (userMode === 'DEMO') {
      // В демо-режиме возвращаем моковые данные
      logger.info("Demo error summary retrieved", {
        userMode
      });

      return NextResponse.json({
        ok: true,
        summary: DEMO_ERROR_SUMMARY
      });
    }

    // Для реальных пользователей получаем данные из БД
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    });

    if (!user) {
      return NextResponse.json(
        {
          ok: false,
          message: "Пользователь не найден.",
        },
        { status: 404 }
      );
    }

    // Получаем общую статистику ошибок
    const totalErrors = await prisma.document.count({
      where: {
        userId: user.id,
        status: 'FAILED'
      }
    });

    // Ошибки за последние 24 часа
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const recentErrors = await prisma.document.count({
      where: {
        userId: user.id,
        status: 'FAILED',
        updatedAt: {
          gte: yesterday
        }
      }
    });

    // Группировка по типам ошибок
    const errorDocuments = await prisma.document.findMany({
      where: {
        userId: user.id,
        status: 'FAILED'
      },
      select: {
        errorType: true,
        processingMessage: true,
        category: true,
        retryCount: true
      }
    });

    const errorsByType: Record<string, number> = {};
    const errorsByCategory: Record<string, number> = {};
    let canReprocess = 0;

    errorDocuments.forEach(doc => {
      // Классификация по типу ошибки
      const errorType = doc.errorType || classifyErrorType(doc.processingMessage || "");
      errorsByType[errorType] = (errorsByType[errorType] || 0) + 1;

      // Группировка по категории
      errorsByCategory[doc.category] = (errorsByCategory[doc.category] || 0) + 1;

      // Проверяем, можно ли переобработать (обычно если попыток < 3)
      if ((doc.retryCount || 0) < 3) {
        canReprocess++;
      }
    });

    // Генерируем рекомендации
    const recommendations = generateRecommendations(errorsByType, totalErrors, canReprocess);

    const summary = {
      totalErrors,
      recentErrors,
      errorsByType,
      errorsByCategory,
      canReprocess,
      recommendations
    };

    logger.info("Error summary retrieved", {
      userId: user.id,
      userMode,
      totalErrors,
      recentErrors
    });

    return NextResponse.json({
      ok: true,
      summary
    });

  } catch (error) {
    logger.error(
      "Failed to get error summary",
      error instanceof Error ? error : undefined,
      {
        email: session?.user?.email,
      }
    );

    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось получить сводку ошибок.",
      },
      { status: 500 }
    );
  }
}

// Вспомогательная функция для классификации ошибок
function classifyErrorType(message: string): string {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('поврежден') || lowerMessage.includes('зашифрован')) {
    return 'Поврежденный файл';
  }
  if (lowerMessage.includes('неподдерживаемый') || lowerMessage.includes('формат')) {
    return 'Неподдерживаемый формат';
  }
  if (lowerMessage.includes('размер') || lowerMessage.includes('лимит')) {
    return 'Превышен размер';
  }
  if (lowerMessage.includes('ocr') || lowerMessage.includes('распознавание')) {
    return 'Ошибка OCR';
  }
  if (lowerMessage.includes('сервис') || lowerMessage.includes('недоступен')) {
    return 'Сервис недоступен';
  }
  if (lowerMessage.includes('таймаут') || lowerMessage.includes('время')) {
    return 'Таймаут обработки';
  }

  return 'Другая ошибка';
}

// Генерация рекомендаций на основе статистики ошибок
function generateRecommendations(errorsByType: Record<string, number>, totalErrors: number, canReprocess: number) {
  const recommendations = [];

  // Рекомендации по типам ошибок
  if (errorsByType['Поврежденный файл'] > 0) {
    recommendations.push({
      type: 'info',
      message: `У вас есть ${errorsByType['Поврежденный файл']} поврежденных файлов. Проверьте исходные документы.`,
      action: 'review_corrupted'
    });
  }

  if (errorsByType['Превышен размер'] > 0) {
    recommendations.push({
      type: 'warning',
      message: `${errorsByType['Превышен размер']} файлов превысили лимит размера. Рассмотрите сжатие или разделение файлов.`,
      action: 'optimize_size'
    });
  }

  if (errorsByType['Неподдерживаемый формат'] > 0) {
    recommendations.push({
      type: 'warning',
      message: `${errorsByType['Неподдерживаемый формат']} файлов имеют неподдерживаемый формат. Конвертируйте в PDF, Excel или Word.`,
      action: 'convert_format'
    });
  }

  if (errorsByType['Сервис недоступен'] > 0) {
    recommendations.push({
      type: 'error',
      message: `${errorsByType['Сервис недоступен']} документов не обработались из-за недоступности сервиса. Попробуйте переобработать позже.`,
      action: 'retry_later'
    });
  }

  // Общие рекомендации
  if (canReprocess > 0) {
    recommendations.push({
      type: 'success',
      message: `${canReprocess} документов готовы к переобработке.`,
      action: 'reprocess_all'
    });
  }

  if (totalErrors === 0) {
    recommendations.push({
      type: 'success',
      message: 'Отлично! У вас нет документов с ошибками.',
      action: 'none'
    });
  }

  return recommendations;
}