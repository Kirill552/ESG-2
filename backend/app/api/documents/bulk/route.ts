import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { Logger } from "@/lib/logger";
import { getCurrentUserMode } from "@/lib/user-mode-utils";

const logger = new Logger("documents-bulk-api");

// Допустимые операции
const ALLOWED_OPERATIONS = ['delete', 'reprocess', 'change_category', 'export'];

export async function POST(req: NextRequest) {
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

    const body = await req.json();
    const { operation, documentIds, options } = body;

    // Валидация входных данных
    if (!operation || !ALLOWED_OPERATIONS.includes(operation)) {
      return NextResponse.json(
        {
          ok: false,
          message: "Некорректная операция.",
        },
        { status: 400 }
      );
    }

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "Не указаны ID документов для операции.",
        },
        { status: 400 }
      );
    }

    if (documentIds.length > 100) {
      return NextResponse.json(
        {
          ok: false,
          message: "Слишком много документов для одной операции (максимум 100).",
        },
        { status: 400 }
      );
    }

    // Проверяем режим пользователя
    const userMode = await getCurrentUserMode();

    if (userMode === 'DEMO') {
      // В демо-режиме имитируем выполнение операции
      logger.info("Demo bulk operation simulated", {
        operation,
        documentCount: documentIds.length,
        userMode
      });

      return NextResponse.json({
        ok: true,
        message: `Операция "${operation}" успешно выполнена для ${documentIds.length} документов (демо-режим).`,
        results: {
          processed: documentIds.length,
          successful: documentIds.length,
          failed: 0,
          errors: []
        }
      });
    }

    // Для реальных пользователей
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, mode: true }
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

    // Проверяем права доступа
    if (user.mode === 'TRIAL' || user.mode === 'EXPIRED') {
      return NextResponse.json(
        {
          ok: false,
          message: "Массовые операции с документами недоступны в пробном режиме.",
        },
        { status: 403 }
      );
    }

    // Проверяем, что все документы принадлежат пользователю
    const userDocuments = await prisma.document.findMany({
      where: {
        id: { in: documentIds },
        userId: user.id
      },
      select: {
        id: true,
        fileName: true,
        status: true,
        category: true
      }
    });

    if (userDocuments.length !== documentIds.length) {
      return NextResponse.json(
        {
          ok: false,
          message: "Некоторые документы не найдены или не принадлежат пользователю.",
        },
        { status: 404 }
      );
    }

    let results = {
      processed: 0,
      successful: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Выполняем операцию в зависимости от типа
    switch (operation) {
      case 'delete':
        try {
          const deleteResult = await prisma.document.deleteMany({
            where: {
              id: { in: documentIds },
              userId: user.id
            }
          });

          results.processed = documentIds.length;
          results.successful = deleteResult.count;
          results.failed = documentIds.length - deleteResult.count;

          // TODO: Удалить физические файлы
          // await deletePhysicalFiles(userDocuments);

        } catch (error) {
          results.errors.push("Ошибка при удалении документов");
        }
        break;

      case 'reprocess':
        try {
          const updateResult = await prisma.document.updateMany({
            where: {
              id: { in: documentIds },
              userId: user.id,
              status: { in: ['PROCESSED', 'FAILED'] } // Только обработанные или упавшие
            },
            data: {
              status: 'PROCESSING',
              processingProgress: 0,
              processingMessage: 'Документ поставлен в очередь на переобработку',
              updatedAt: new Date()
            }
          });

          results.processed = documentIds.length;
          results.successful = updateResult.count;
          results.failed = documentIds.length - updateResult.count;

          // TODO: Добавить в очередь обработки
          // await addBulkToProcessingQueue(documentIds);

        } catch (error) {
          results.errors.push("Ошибка при переобработке документов");
        }
        break;

      case 'change_category':
        if (!options?.category) {
          return NextResponse.json(
            {
              ok: false,
              message: "Не указана новая категория документов.",
            },
            { status: 400 }
          );
        }

        try {
          const updateResult = await prisma.document.updateMany({
            where: {
              id: { in: documentIds },
              userId: user.id
            },
            data: {
              category: options.category as any,
              updatedAt: new Date()
            }
          });

          results.processed = documentIds.length;
          results.successful = updateResult.count;
          results.failed = documentIds.length - updateResult.count;

        } catch (error) {
          results.errors.push("Ошибка при изменении категории документов");
        }
        break;

      case 'export':
        try {
          // TODO: Реализовать экспорт списка документов в CSV/Excel
          // const exportData = await generateDocumentsExport(userDocuments, options);

          results.processed = documentIds.length;
          results.successful = documentIds.length;
          results.failed = 0;

          // Временно возвращаем ссылку на скачивание
          return NextResponse.json({
            ok: true,
            message: `Экспорт ${documentIds.length} документов подготовлен.`,
            results,
            downloadUrl: `/api/documents/export?ids=${documentIds.join(',')}`
          });

        } catch (error) {
          results.errors.push("Ошибка при экспорте документов");
        }
        break;

      default:
        return NextResponse.json(
          {
            ok: false,
            message: "Неподдерживаемая операция.",
          },
          { status: 400 }
        );
    }

    logger.info("Bulk operation completed", {
      operation,
      userId: user.id,
      userMode,
      documentCount: documentIds.length,
      results
    });

    return NextResponse.json({
      ok: true,
      message: `Операция "${operation}" выполнена. Обработано: ${results.successful}/${results.processed}`,
      results
    });

  } catch (error) {
    logger.error(
      "Failed to execute bulk operation",
      error instanceof Error ? error : undefined,
      {
        email: session?.user?.email,
      }
    );

    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось выполнить массовую операцию.",
      },
      { status: 500 }
    );
  }
}