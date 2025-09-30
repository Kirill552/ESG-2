import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { Logger } from "@/lib/logger";
import { getCurrentUserMode } from "@/lib/user-mode-utils";
import { enrichDocumentWithMetadata, getAvailableFilters } from "@/lib/file-metadata-service";

const logger = new Logger("documents-errors-api");

// Моковые документы с ошибками для демо-режима
const DEMO_ERROR_DOCUMENTS = [
  {
    id: "demo-error-1",
    fileName: "Поврежденный_файл_1.pdf",
    originalName: "Поврежденный_файл_1.pdf",
    fileSize: 1024 * 1024 * 2.5,
    fileType: "application/pdf",
    status: "FAILED",
    category: "PRODUCTION",
    createdAt: "2025-09-20T10:00:00Z",
    updatedAt: "2025-09-20T10:30:00Z",
    processingProgress: 0,
    processingMessage: "Ошибка чтения PDF: файл поврежден или зашифрован"
  },
  {
    id: "demo-error-2",
    fileName: "Неподдерживаемый_формат.xyz",
    originalName: "Неподдерживаемый_формат.xyz",
    fileSize: 1024 * 512,
    fileType: "application/octet-stream",
    status: "FAILED",
    category: "SUPPLIERS",
    createdAt: "2025-09-19T14:15:00Z",
    updatedAt: "2025-09-19T14:16:00Z",
    processingProgress: 0,
    processingMessage: "Неподдерживаемый формат файла"
  },
  {
    id: "demo-error-3",
    fileName: "Слишком_большой_файл.xlsx",
    originalName: "Слишком_большой_файл.xlsx",
    fileSize: 1024 * 1024 * 120,
    fileType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    status: "FAILED",
    category: "ENERGY",
    createdAt: "2025-09-18T09:00:00Z",
    updatedAt: "2025-09-18T09:05:00Z",
    processingProgress: 15,
    processingMessage: "Превышен лимит размера файла для обработки (макс. 100 МБ)"
  },
  {
    id: "demo-error-4",
    fileName: "OCR_ошибка_сканирования.jpg",
    originalName: "OCR_ошибка_сканирования.jpg",
    fileSize: 1024 * 1024 * 8.7,
    fileType: "image/jpeg",
    status: "FAILED",
    category: "WASTE",
    createdAt: "2025-09-17T16:30:00Z",
    updatedAt: "2025-09-17T16:45:00Z",
    processingProgress: 75,
    processingMessage: "OCR сервис недоступен, повторите попытку позже"
  }
];

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

    // Получаем параметры запроса
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "25");
    const includeDetails = searchParams.get("details") === "true";

    // Проверяем режим пользователя
    const userMode = await getCurrentUserMode();

    if (userMode === 'DEMO') {
      // В демо-режиме возвращаем моковые данные
      const documents = DEMO_ERROR_DOCUMENTS;

      // Пагинация
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedDocuments = documents.slice(startIndex, endIndex);

      // Группировка ошибок по типам
      const errorsByType = documents.reduce((acc, doc) => {
        const errorType = getErrorType(doc.processingMessage || "");
        acc[errorType] = (acc[errorType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      logger.info("Demo error documents retrieved", {
        userMode,
        total: documents.length,
        page,
        pageSize
      });

      return NextResponse.json({
        ok: true,
        documents: paginatedDocuments.map(doc => enrichDocumentWithMetadata(doc)),
        pagination: {
          page,
          pageSize,
          total: documents.length,
          pages: Math.ceil(documents.length / pageSize),
          hasNext: page < Math.ceil(documents.length / pageSize),
          hasPrev: page > 1,
          startIndex: (page - 1) * pageSize + 1,
          endIndex: Math.min(page * pageSize, documents.length)
        },
        stats: {
          totalErrors: documents.length,
          errorsByType,
          canReprocess: documents.length
        },
        filters: getAvailableFilters()
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

    // Получаем общее количество документов с ошибками
    const totalCount = await prisma.document.count({
      where: {
        userId: user.id,
        status: 'FAILED'
      }
    });

    // Получаем документы с ошибками с пагинацией
    const documents = await prisma.document.findMany({
      where: {
        userId: user.id,
        status: 'FAILED'
      },
      select: {
        id: true,
        fileName: true,
        originalName: true,
        fileSize: true,
        fileType: true,
        status: true,
        category: true,
        createdAt: true,
        updatedAt: true,
        processingProgress: true,
        processingMessage: true
      },
      orderBy: {
        updatedAt: 'desc'
      },
      skip: (page - 1) * pageSize,
      take: pageSize
    });

    // Группировка ошибок по типам (для статистики)
    const errorsByType: Record<string, number> = {};
    if (includeDetails) {
      const allErrorDocuments = await prisma.document.findMany({
        where: {
          userId: user.id,
          status: 'FAILED'
        },
        select: {
          processingMessage: true
        }
      });

      allErrorDocuments.forEach(doc => {
        const errorType = getErrorType(doc.processingMessage || "");
        errorsByType[errorType] = (errorsByType[errorType] || 0) + 1;
      });
    }

    logger.info("Error documents retrieved", {
      userId: user.id,
      userMode,
      total: totalCount,
      page,
      pageSize
    });

    return NextResponse.json({
      ok: true,
      documents: documents.map(doc => enrichDocumentWithMetadata(doc)),
      pagination: {
        page,
        pageSize,
        total: totalCount,
        pages: Math.ceil(totalCount / pageSize),
        hasNext: page < Math.ceil(totalCount / pageSize),
        hasPrev: page > 1,
        startIndex: (page - 1) * pageSize + 1,
        endIndex: Math.min(page * pageSize, totalCount)
      },
      stats: {
        totalErrors: totalCount,
        errorsByType,
        canReprocess: totalCount
      },
      filters: getAvailableFilters()
    });

  } catch (error) {
    logger.error(
      "Failed to get error documents",
      error instanceof Error ? error : undefined,
      {
        email: session?.user?.email,
      }
    );

    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось получить список документов с ошибками.",
      },
      { status: 500 }
    );
  }
}

// Вспомогательная функция для классификации типов ошибок
function getErrorType(message: string): string {
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