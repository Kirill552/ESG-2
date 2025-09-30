import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { Logger } from "@/lib/logger";
import { getCurrentUserMode } from "@/lib/user-mode-utils";

const logger = new Logger("documents-export-api");

// Функция для создания CSV контента
function generateCSV(documents: any[]): string {
  const headers = [
    'ID',
    'Имя файла',
    'Оригинальное имя',
    'Размер (байт)',
    'Тип файла',
    'Статус',
    'Категория',
    'Дата создания',
    'Дата обновления',
    'Прогресс обработки (%)',
    'Сообщение обработки'
  ];

  const rows = documents.map(doc => [
    doc.id,
    `"${doc.fileName}"`,
    `"${doc.originalName}"`,
    doc.fileSize,
    `"${doc.fileType}"`,
    doc.status,
    doc.category,
    new Date(doc.createdAt).toLocaleDateString('ru-RU'),
    new Date(doc.updatedAt).toLocaleDateString('ru-RU'),
    doc.processingProgress || 0,
    `"${doc.processingMessage || ''}"`
  ]);

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

// Функция для создания Excel-подобного контента (TSV)
function generateTSV(documents: any[]): string {
  const headers = [
    'ID',
    'Имя файла',
    'Оригинальное имя',
    'Размер (байт)',
    'Тип файла',
    'Статус',
    'Категория',
    'Дата создания',
    'Дата обновления',
    'Прогресс обработки (%)',
    'Сообщение обработки'
  ];

  const rows = documents.map(doc => [
    doc.id,
    doc.fileName,
    doc.originalName,
    doc.fileSize,
    doc.fileType,
    doc.status,
    doc.category,
    new Date(doc.createdAt).toLocaleDateString('ru-RU'),
    new Date(doc.updatedAt).toLocaleDateString('ru-RU'),
    doc.processingProgress || 0,
    doc.processingMessage || ''
  ]);

  return [headers.join('\t'), ...rows.map(row => row.join('\t'))].join('\n');
}

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
    const idsParam = searchParams.get("ids");
    const format = searchParams.get("format") || "csv"; // csv, tsv, json
    const allDocuments = searchParams.get("all") === "true";

    // Валидация формата
    if (!['csv', 'tsv', 'json'].includes(format)) {
      return NextResponse.json(
        {
          ok: false,
          message: "Неподдерживаемый формат экспорта. Поддерживаются: csv, tsv, json.",
        },
        { status: 400 }
      );
    }

    // Проверяем режим пользователя
    const userMode = await getCurrentUserMode();

    if (userMode === 'DEMO') {
      // В демо-режиме возвращаем демо-данные
      const demoDocuments = [
        {
          id: "demo-doc-1",
          fileName: "Производство_данные_39.xlsx",
          originalName: "Производство_данные_39.xlsx",
          fileSize: 29686784,
          fileType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          status: "UPLOADED",
          category: "PRODUCTION",
          createdAt: "2025-09-11T10:00:00Z",
          updatedAt: "2025-09-11T10:00:00Z",
          processingProgress: 0,
          processingMessage: null
        },
        {
          id: "demo-doc-2",
          fileName: "Поставщики_данные_1.csv",
          originalName: "Поставщики_данные_1.csv",
          fileSize: 39269376,
          fileType: "text/csv",
          status: "PROCESSED",
          category: "SUPPLIERS",
          createdAt: "2025-09-02T10:00:00Z",
          updatedAt: "2025-09-02T11:00:00Z",
          processingProgress: 100,
          processingMessage: "Документ успешно обработан"
        }
      ];

      logger.info("Demo documents export", {
        format,
        documentCount: demoDocuments.length,
        userMode
      });

      let content: string;
      let contentType: string;
      let filename: string;

      switch (format) {
        case 'csv':
          content = generateCSV(demoDocuments);
          contentType = 'text/csv; charset=utf-8';
          filename = 'documents-export-demo.csv';
          break;
        case 'tsv':
          content = generateTSV(demoDocuments);
          contentType = 'text/tab-separated-values; charset=utf-8';
          filename = 'documents-export-demo.tsv';
          break;
        case 'json':
          content = JSON.stringify(demoDocuments, null, 2);
          contentType = 'application/json; charset=utf-8';
          filename = 'documents-export-demo.json';
          break;
        default:
          content = generateCSV(demoDocuments);
          contentType = 'text/csv; charset=utf-8';
          filename = 'documents-export-demo.csv';
      }

      return new NextResponse(content, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': Buffer.byteLength(content, 'utf8').toString(),
        },
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
          message: "Экспорт документов недоступен в пробном режиме.",
        },
        { status: 403 }
      );
    }

    // Строим условие для выборки документов
    let whereCondition: any = { userId: user.id };

    if (!allDocuments && idsParam) {
      const documentIds = idsParam.split(',').filter(id => id.trim());
      if (documentIds.length === 0) {
        return NextResponse.json(
          {
            ok: false,
            message: "Не указаны ID документов для экспорта.",
          },
          { status: 400 }
        );
      }
      whereCondition.id = { in: documentIds };
    }

    // Получаем документы
    const documents = await prisma.document.findMany({
      where: whereCondition,
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
        createdAt: 'desc'
      }
    });

    if (documents.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "Документы для экспорта не найдены.",
        },
        { status: 404 }
      );
    }

    logger.info("Documents exported successfully", {
      userId: user.id,
      userMode,
      format,
      documentCount: documents.length,
      allDocuments
    });

    let content: string;
    let contentType: string;
    let filename: string;
    const timestamp = new Date().toISOString().slice(0, 10);

    switch (format) {
      case 'csv':
        content = generateCSV(documents);
        contentType = 'text/csv; charset=utf-8';
        filename = `documents-export-${timestamp}.csv`;
        break;
      case 'tsv':
        content = generateTSV(documents);
        contentType = 'text/tab-separated-values; charset=utf-8';
        filename = `documents-export-${timestamp}.tsv`;
        break;
      case 'json':
        content = JSON.stringify(documents, null, 2);
        contentType = 'application/json; charset=utf-8';
        filename = `documents-export-${timestamp}.json`;
        break;
      default:
        content = generateCSV(documents);
        contentType = 'text/csv; charset=utf-8';
        filename = `documents-export-${timestamp}.csv`;
    }

    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': Buffer.byteLength(content, 'utf8').toString(),
      },
    });

  } catch (error) {
    logger.error(
      "Failed to export documents",
      error instanceof Error ? error : undefined,
      {
        email: session?.user?.email,
      }
    );

    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось экспортировать документы.",
      },
      { status: 500 }
    );
  }
}