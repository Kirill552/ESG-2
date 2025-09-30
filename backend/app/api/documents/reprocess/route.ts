import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { Logger } from "@/lib/logger";
import { getCurrentUserMode } from "@/lib/user-mode-utils";

const logger = new Logger("documents-reprocess-api");

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
    const { documentIds, errorFilter } = body;

    // Валидация входных данных
    if (!documentIds || !Array.isArray(documentIds)) {
      return NextResponse.json(
        {
          ok: false,
          message: "Не указаны ID документов для переобработки.",
        },
        { status: 400 }
      );
    }

    if (documentIds.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "Список документов для переобработки пуст.",
        },
        { status: 400 }
      );
    }

    if (documentIds.length > 50) {
      return NextResponse.json(
        {
          ok: false,
          message: "Слишком много документов для переобработки за один раз (максимум 50).",
        },
        { status: 400 }
      );
    }

    // Проверяем режим пользователя
    const userMode = await getCurrentUserMode();

    if (userMode === 'DEMO') {
      // В демо-режиме имитируем переобработку
      logger.info("Demo documents reprocessing simulated", {
        documentCount: documentIds.length,
        userMode
      });

      return NextResponse.json({
        ok: true,
        message: `Переобработка ${documentIds.length} документов запущена (демо-режим).`,
        results: {
          queued: documentIds.length,
          failed: 0,
          alreadyProcessing: 0,
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
          message: "Переобработка документов недоступна в пробном режиме.",
        },
        { status: 403 }
      );
    }

    // Получаем документы пользователя
    let whereCondition: any = {
      id: { in: documentIds },
      userId: user.id
    };

    // Если указан фильтр только по ошибкам
    if (errorFilter) {
      whereCondition.status = 'FAILED';
    }

    const documents = await prisma.document.findMany({
      where: whereCondition,
      select: {
        id: true,
        fileName: true,
        status: true,
        processingMessage: true
      }
    });

    if (documents.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "Документы для переобработки не найдены.",
        },
        { status: 404 }
      );
    }

    // Фильтруем документы, которые можно переобработать
    const reprocessableDocuments = documents.filter(doc =>
      doc.status === 'FAILED' || doc.status === 'PROCESSED'
    );

    const alreadyProcessingDocuments = documents.filter(doc =>
      doc.status === 'PROCESSING' || doc.status === 'UPLOADED'
    );

    let results = {
      queued: 0,
      failed: 0,
      alreadyProcessing: alreadyProcessingDocuments.length,
      errors: [] as string[]
    };

    if (reprocessableDocuments.length > 0) {
      try {
        // Обновляем статус документов на PROCESSING
        const updateResult = await prisma.document.updateMany({
          where: {
            id: { in: reprocessableDocuments.map(d => d.id) },
            userId: user.id
          },
          data: {
            status: 'PROCESSING',
            processingProgress: 0,
            processingMessage: 'Документ поставлен в очередь на переобработку',
            updatedAt: new Date()
          }
        });

        results.queued = updateResult.count;

        // TODO: Здесь добавить документы в очередь OCR обработки
        // await addDocumentsToProcessingQueue(reprocessableDocuments.map(d => d.id));

        logger.info("Documents queued for reprocessing", {
          userId: user.id,
          userMode,
          documentCount: reprocessableDocuments.length,
          documentIds: reprocessableDocuments.map(d => d.id)
        });

      } catch (error) {
        logger.error("Failed to queue documents for reprocessing", error instanceof Error ? error : undefined, {
          userId: user.id,
          documentIds: reprocessableDocuments.map(d => d.id)
        });

        results.failed = reprocessableDocuments.length;
        results.errors.push("Ошибка при постановке документов в очередь на переобработку");
      }
    }

    // Формируем ответное сообщение
    let message = "";
    if (results.queued > 0) {
      message += `${results.queued} документов поставлено в очередь на переобработку. `;
    }
    if (results.alreadyProcessing > 0) {
      message += `${results.alreadyProcessing} документов уже обрабатываются. `;
    }
    if (results.failed > 0) {
      message += `${results.failed} документов не удалось поставить в очередь. `;
    }

    return NextResponse.json({
      ok: true,
      message: message.trim() || "Переобработка завершена.",
      results
    });

  } catch (error) {
    logger.error(
      "Failed to reprocess documents",
      error instanceof Error ? error : undefined,
      {
        email: session?.user?.email,
      }
    );

    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось запустить переобработку документов.",
      },
      { status: 500 }
    );
  }
}