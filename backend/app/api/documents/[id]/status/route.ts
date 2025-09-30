import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { Logger } from "@/lib/logger";
import { getCurrentUserMode } from "@/lib/user-mode-utils";

const logger = new Logger("documents-status-api");

// Допустимые статусы для изменения
const ALLOWED_STATUS_TRANSITIONS = {
  'UPLOADED': ['PROCESSING', 'FAILED'],
  'PROCESSING': ['PROCESSED', 'FAILED'],
  'PROCESSED': ['PROCESSING'], // Для переобработки
  'FAILED': ['PROCESSING'] // Для повторной обработки
};

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: documentId } = await params;
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
    const { status, processingMessage } = body;

    // Валидация статуса
    if (!status || !['UPLOADED', 'PROCESSING', 'PROCESSED', 'FAILED'].includes(status)) {
      return NextResponse.json(
        {
          ok: false,
          message: "Некорректный статус документа.",
        },
        { status: 400 }
      );
    }

    // Проверяем режим пользователя
    const userMode = await getCurrentUserMode();

    if (userMode === 'DEMO') {
      // В демо-режиме имитируем изменение статуса
      logger.info("Demo document status update simulated", {
        documentId,
        newStatus: status,
        userMode
      });

      return NextResponse.json({
        ok: true,
        message: "Статус документа успешно обновлен (демо-режим).",
        document: {
          id: documentId,
          status,
          processingMessage: processingMessage || null,
          processingProgress: status === 'PROCESSING' ? 50 : (status === 'PROCESSED' ? 100 : 0),
          updatedAt: new Date().toISOString()
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
          message: "Изменение статуса документов недоступно в пробном режиме.",
        },
        { status: 403 }
      );
    }

    // Находим документ
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        userId: user.id
      },
      select: {
        id: true,
        status: true,
        fileName: true
      }
    });

    if (!document) {
      return NextResponse.json(
        {
          ok: false,
          message: "Документ не найден.",
        },
        { status: 404 }
      );
    }

    // Проверяем допустимость перехода статуса
    const allowedTransitions = ALLOWED_STATUS_TRANSITIONS[document.status as keyof typeof ALLOWED_STATUS_TRANSITIONS];
    if (!allowedTransitions || !allowedTransitions.includes(status)) {
      return NextResponse.json(
        {
          ok: false,
          message: `Недопустимый переход статуса с ${document.status} на ${status}.`,
        },
        { status: 400 }
      );
    }

    // Определяем прогресс обработки
    let processingProgress = 0;
    switch (status) {
      case 'UPLOADED':
        processingProgress = 0;
        break;
      case 'PROCESSING':
        processingProgress = 50;
        break;
      case 'PROCESSED':
        processingProgress = 100;
        break;
      case 'FAILED':
        processingProgress = 0;
        break;
    }

    // Обновляем статус документа
    const updatedDocument = await prisma.document.update({
      where: { id: document.id },
      data: {
        status: status as any,
        processingProgress,
        processingMessage: processingMessage || null,
        updatedAt: new Date()
      },
      select: {
        id: true,
        status: true,
        processingProgress: true,
        processingMessage: true,
        updatedAt: true
      }
    });

    logger.info("Document status updated successfully", {
      documentId,
      userId: user.id,
      userMode,
      oldStatus: document.status,
      newStatus: status,
      fileName: document.fileName
    });

    // TODO: Если статус изменился на PROCESSING, добавить задачу в очередь обработки
    // if (status === 'PROCESSING') {
    //   await addToProcessingQueue(document.id);
    // }

    return NextResponse.json({
      ok: true,
      message: "Статус документа успешно обновлен.",
      document: updatedDocument
    });

  } catch (error) {
    logger.error(
      "Failed to update document status",
      error instanceof Error ? error : undefined,
      {
        documentId: documentId,
        email: session?.user?.email,
      }
    );

    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось обновить статус документа.",
      },
      { status: 500 }
    );
  }
}