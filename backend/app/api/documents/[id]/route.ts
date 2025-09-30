import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { Logger } from "@/lib/logger";
import { getCurrentUserMode } from "@/lib/user-mode-utils";
import { readFile } from "fs/promises";
import { existsSync } from "fs";

const logger = new Logger("documents-detail-api");

// Моковые данные для демо-режима (расширенная версия)
const DEMO_DOCUMENT_DETAILS = {
  "demo-doc-1": {
    id: "demo-doc-1",
    fileName: "Производство_данные_39.xlsx",
    originalName: "Производство_данные_39.xlsx",
    fileSize: 28.3 * 1024 * 1024,
    fileType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    status: "UPLOADED",
    category: "PRODUCTION",
    createdAt: "2025-09-11T10:00:00Z",
    updatedAt: "2025-09-11T10:00:00Z",
    processingProgress: 0,
    processingMessage: null,
    extractedData: null,
    downloadUrl: "/api/documents/demo-doc-1/download"
  },
  "demo-doc-2": {
    id: "demo-doc-2",
    fileName: "Поставщики_данные_1.csv",
    originalName: "Поставщики_данные_1.csv",
    fileSize: 37.4 * 1024 * 1024,
    fileType: "text/csv",
    status: "PROCESSED",
    category: "SUPPLIERS",
    createdAt: "2025-09-02T10:00:00Z",
    updatedAt: "2025-09-02T11:00:00Z",
    processingProgress: 100,
    processingMessage: "Документ успешно обработан",
    extractedData: {
      tablesCount: 3,
      recordsCount: 1247,
      columnsDetected: ["Название поставщика", "ИНН", "Объем поставок", "CO2 эквивалент"]
    },
    downloadUrl: "/api/documents/demo-doc-2/download"
  }
};

export async function GET(
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

    // Проверяем режим пользователя
    const userMode = await getCurrentUserMode();

    if (userMode === 'DEMO') {
      // Возвращаем демо-данные
      const demoDocument = DEMO_DOCUMENT_DETAILS[documentId as keyof typeof DEMO_DOCUMENT_DETAILS];

      if (demoDocument) {
        logger.info("Demo document details retrieved", {
          documentId,
          userMode
        });

        return NextResponse.json({
          ok: true,
          document: demoDocument
        });
      } else {
        return NextResponse.json(
          {
            ok: false,
            message: "Документ не найден.",
          },
          { status: 404 }
        );
      }
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

    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        userId: user.id
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

    logger.info("Document details retrieved", {
      documentId,
      userId: user.id,
      userMode
    });

    return NextResponse.json({
      ok: true,
      document: {
        ...document,
        downloadUrl: `/api/documents/${document.id}/download`
      }
    });

  } catch (error) {
    logger.error(
      "Failed to get document details",
      error instanceof Error ? error : undefined,
      {
        documentId: documentId,
        email: session?.user?.email,
      }
    );

    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось получить данные документа.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    // Проверяем режим пользователя
    const userMode = await getCurrentUserMode();

    if (userMode === 'DEMO') {
      // В демо-режиме имитируем удаление
      logger.info("Demo document deletion simulated", {
        documentId,
        userMode
      });

      return NextResponse.json({
        ok: true,
        message: "Документ успешно удален (демо-режим)."
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
          message: "Удаление документов недоступно в пробном режиме.",
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
        filePath: true,
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

    // Удаляем запись из БД
    await prisma.document.delete({
      where: { id: document.id }
    });

    // TODO: Удалить физический файл
    // if (document.filePath && existsSync(document.filePath)) {
    //   await unlink(document.filePath);
    // }

    logger.info("Document deleted successfully", {
      documentId,
      userId: user.id,
      userMode,
      fileName: document.fileName
    });

    return NextResponse.json({
      ok: true,
      message: "Документ успешно удален."
    });

  } catch (error) {
    logger.error(
      "Failed to delete document",
      error instanceof Error ? error : undefined,
      {
        documentId: documentId,
        email: session?.user?.email,
      }
    );

    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось удалить документ.",
      },
      { status: 500 }
    );
  }
}