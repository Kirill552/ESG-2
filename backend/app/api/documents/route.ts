import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { Logger } from "@/lib/logger";
import { getCurrentUserMode } from "@/lib/user-mode-utils";
import {
  enrichDocumentWithMetadata,
  validateSortField,
  getAvailableFilters
} from "@/lib/file-metadata-service";

const logger = new Logger("documents-api");

// Моковые данные для демо-режима
const DEMO_DOCUMENTS = [
  {
    id: "demo-doc-1",
    fileName: "Производство_данные_39.xlsx",
    originalName: "Производство_данные_39.xlsx",
    fileSize: 28.3 * 1024 * 1024, // в байтах
    fileType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    status: "UPLOADED",
    category: "PRODUCTION",
    createdAt: "2025-09-11T10:00:00Z",
    updatedAt: "2025-09-11T10:00:00Z"
  },
  {
    id: "demo-doc-2",
    fileName: "Поставщики_данные_1.csv",
    originalName: "Поставщики_данные_1.csv",
    fileSize: 37.4 * 1024 * 1024,
    fileType: "text/csv",
    status: "PROCESSED",
    category: "SUPPLIERS",
    createdAt: "2025-09-02T10:00:00Z",
    updatedAt: "2025-09-02T11:00:00Z"
  },
  {
    id: "demo-doc-3",
    fileName: "Поставщики_данные_2.csv",
    originalName: "Поставщики_данные_2.csv",
    fileSize: 46.9 * 1024 * 1024,
    fileType: "text/csv",
    status: "UPLOADED",
    category: "SUPPLIERS",
    createdAt: "2025-09-14T10:00:00Z",
    updatedAt: "2025-09-14T10:00:00Z"
  },
  {
    id: "demo-doc-4",
    fileName: "Отходы_данные_3.docx",
    originalName: "Отходы_данные_3.docx",
    fileSize: 38.2 * 1024 * 1024,
    fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    status: "UPLOADED",
    category: "WASTE",
    createdAt: "2025-09-13T10:00:00Z",
    updatedAt: "2025-09-13T10:00:00Z"
  },
  {
    id: "demo-doc-5",
    fileName: "Поставщики_данные_7.pdf",
    originalName: "Поставщики_данные_7.pdf",
    fileSize: 43.4 * 1024 * 1024,
    fileType: "application/pdf",
    status: "PROCESSING",
    category: "SUPPLIERS",
    createdAt: "2025-09-08T10:00:00Z",
    updatedAt: "2025-09-08T10:30:00Z"
  },
  {
    id: "demo-doc-6",
    fileName: "Транспорт_данные_37.jpg",
    originalName: "Транспорт_данные_37.jpg",
    fileSize: 23.7 * 1024 * 1024,
    fileType: "image/jpeg",
    status: "PROCESSING",
    category: "TRANSPORT",
    createdAt: "2025-09-08T10:00:00Z",
    updatedAt: "2025-09-08T10:30:00Z"
  },
  {
    id: "demo-doc-7",
    fileName: "Энергия_данные_17.docx",
    originalName: "Энергия_данные_17.docx",
    fileSize: 31.7 * 1024 * 1024,
    fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    status: "PROCESSED",
    category: "ENERGY",
    createdAt: "2025-09-06T10:00:00Z",
    updatedAt: "2025-09-06T11:00:00Z"
  },
  {
    id: "demo-doc-8",
    fileName: "Транспорт_данные_4.pdf",
    originalName: "Транспорт_данные_4.pdf",
    fileSize: 50.9 * 1024 * 1024,
    fileType: "application/pdf",
    status: "UPLOADED",
    category: "TRANSPORT",
    createdAt: "2025-09-03T10:00:00Z",
    updatedAt: "2025-09-03T10:00:00Z"
  },
  {
    id: "demo-doc-9",
    fileName: "Транспорт_данные_5.jpg",
    originalName: "Транспорт_данные_5.jpg",
    fileSize: 27.2 * 1024 * 1024,
    fileType: "image/jpeg",
    status: "FAILED",
    category: "TRANSPORT",
    createdAt: "2025-09-20T10:00:00Z",
    updatedAt: "2025-09-20T10:30:00Z"
  },
  {
    id: "demo-doc-10",
    fileName: "Производство_данные_8.pdf",
    originalName: "Производство_данные_8.pdf",
    fileSize: 15.6 * 1024 * 1024,
    fileType: "application/pdf",
    status: "FAILED",
    category: "PRODUCTION",
    createdAt: "2025-09-08T10:00:00Z",
    updatedAt: "2025-09-08T10:30:00Z"
  }
];

// Функция для генерации дополнительных демо-документов до 150+
function generateDemoDocuments(count: number = 150) {
  const documents = [...DEMO_DOCUMENTS];
  const categories = ["PRODUCTION", "SUPPLIERS", "WASTE", "TRANSPORT", "ENERGY"];
  const statuses = ["UPLOADED", "PROCESSED", "PROCESSING", "FAILED"];
  const fileTypes = [
    { ext: "xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    { ext: "csv", mime: "text/csv" },
    { ext: "docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
    { ext: "pdf", mime: "application/pdf" },
    { ext: "jpg", mime: "image/jpeg" }
  ];

  for (let i = documents.length; i < count; i++) {
    const category = categories[Math.floor(Math.random() * categories.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const fileType = fileTypes[Math.floor(Math.random() * fileTypes.length)];
    const categoryName = {
      PRODUCTION: "Производство",
      SUPPLIERS: "Поставщики",
      WASTE: "Отходы",
      TRANSPORT: "Транспорт",
      ENERGY: "Энергия"
    }[category];

    const createdDate = new Date(2025, 7, Math.floor(Math.random() * 30) + 1);

    documents.push({
      id: `demo-doc-${i + 1}`,
      fileName: `${categoryName}_данные_${i + 1}.${fileType.ext}`,
      originalName: `${categoryName}_данные_${i + 1}.${fileType.ext}`,
      fileSize: Math.floor(Math.random() * 50 * 1024 * 1024) + 1024 * 1024, // 1-50 МБ
      fileType: fileType.mime,
      status,
      category,
      createdAt: createdDate.toISOString(),
      updatedAt: status === "PROCESSING" || status === "PROCESSED" || status === "FAILED"
        ? new Date(createdDate.getTime() + 30 * 60 * 1000).toISOString()
        : createdDate.toISOString()
    });
  }

  return documents;
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
    const q = searchParams.get("q") || "";
    const status = searchParams.get("status") || "";
    const category = searchParams.get("category") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "25");
    const order = searchParams.get("order") || "createdAt_desc";

    // Проверяем режим пользователя
    const userMode = await getCurrentUserMode();

    if (userMode === 'DEMO') {
      // В демо-режиме возвращаем моковые данные
      let documents = generateDemoDocuments(150);

      // Применяем фильтры
      if (q) {
        documents = documents.filter(doc =>
          doc.fileName.toLowerCase().includes(q.toLowerCase()) ||
          doc.originalName.toLowerCase().includes(q.toLowerCase())
        );
      }

      if (status && status !== "all") {
        documents = documents.filter(doc => doc.status === status.toUpperCase());
      }

      if (category && category !== "all") {
        documents = documents.filter(doc => doc.category === category.toUpperCase());
      }

      // Сортировка
      const [sortField, sortOrder] = order.split("_");

      // Валидация поля сортировки
      if (!validateSortField(sortField)) {
        return NextResponse.json(
          {
            ok: false,
            message: "Некорректное поле для сортировки.",
          },
          { status: 400 }
        );
      }

      documents.sort((a, b) => {
        let aVal = a[sortField as keyof typeof a];
        let bVal = b[sortField as keyof typeof b];

        if (sortField === "createdAt" || sortField === "updatedAt") {
          aVal = new Date(aVal as string).getTime();
          bVal = new Date(bVal as string).getTime();
        }

        if (sortOrder === "desc") {
          return aVal > bVal ? -1 : 1;
        }
        return aVal < bVal ? -1 : 1;
      });

      // Пагинация
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedDocuments = documents.slice(startIndex, endIndex);

      // Подсчет статистики
      const stats = {
        total: documents.length,
        uploaded: documents.filter(d => d.status === "UPLOADED").length,
        processed: documents.filter(d => d.status === "PROCESSED").length,
        processing: documents.filter(d => d.status === "PROCESSING").length,
        failed: documents.filter(d => d.status === "FAILED").length,
      };

      logger.info("Demo documents list retrieved", {
        userMode,
        total: documents.length,
        page,
        pageSize,
        filters: { q, status, category }
      });

      return NextResponse.json({
        ok: true,
        documents: paginatedDocuments.map(doc => enrichDocumentWithMetadata({
          ...doc,
          fileSize: Math.round(doc.fileSize), // конвертируем в целые байты
        })),
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
        stats,
        filters: getAvailableFilters(),
        sorting: {
          field: sortField,
          order: sortOrder,
          available: [
            { value: 'createdAt_desc', label: 'Дата создания (новые)' },
            { value: 'createdAt_asc', label: 'Дата создания (старые)' },
            { value: 'fileName_asc', label: 'Имя файла (А-Я)' },
            { value: 'fileName_desc', label: 'Имя файла (Я-А)' },
            { value: 'fileSize_desc', label: 'Размер (большие)' },
            { value: 'fileSize_asc', label: 'Размер (маленькие)' },
            { value: 'status_asc', label: 'Статус' }
          ]
        }
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

    // Строим WHERE условие для фильтрации
    const whereConditions: any = {
      userId: user.id
    };

    if (q) {
      whereConditions.OR = [
        { fileName: { contains: q, mode: "insensitive" } },
        { originalName: { contains: q, mode: "insensitive" } }
      ];
    }

    if (status && status !== "all") {
      whereConditions.status = status.toUpperCase();
    }

    if (category && category !== "all") {
      whereConditions.category = category.toUpperCase();
    }

    // Получаем общее количество документов
    const totalCount = await prisma.document.count({
      where: whereConditions
    });

    // Получаем статистику по статусам
    const statusCounts = await prisma.document.groupBy({
      by: ['status'],
      where: { userId: user.id },
      _count: {
        id: true
      }
    });

    const stats = {
      total: totalCount,
      uploaded: statusCounts.find(s => s.status === "UPLOADED")?._count.id || 0,
      processed: statusCounts.find(s => s.status === "PROCESSED")?._count.id || 0,
      processing: statusCounts.find(s => s.status === "PROCESSING")?._count.id || 0,
      failed: statusCounts.find(s => s.status === "FAILED")?._count.id || 0,
    };

    // Сортировка
    const [sortField, sortOrder] = order.split("_");

    // Валидация поля сортировки
    if (!validateSortField(sortField)) {
      return NextResponse.json(
        {
          ok: false,
          message: "Некорректное поле для сортировки.",
        },
        { status: 400 }
      );
    }

    const orderBy: any = {};
    orderBy[sortField] = sortOrder || "desc";

    // Получаем документы с пагинацией
    const documents = await prisma.document.findMany({
      where: whereConditions,
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
        processingMessage: true,
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize
    });

    logger.info("Documents list retrieved", {
      userId: user.id,
      userMode,
      total: totalCount,
      page,
      pageSize,
      filters: { q, status, category }
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
      stats,
      filters: getAvailableFilters(),
      sorting: {
        field: sortField,
        order: sortOrder,
        available: [
          { value: 'createdAt_desc', label: 'Дата создания (новые)' },
          { value: 'createdAt_asc', label: 'Дата создания (старые)' },
          { value: 'fileName_asc', label: 'Имя файла (А-Я)' },
          { value: 'fileName_desc', label: 'Имя файла (Я-А)' },
          { value: 'fileSize_desc', label: 'Размер (большие)' },
          { value: 'fileSize_asc', label: 'Размер (маленькие)' },
          { value: 'status_asc', label: 'Статус' }
        ]
      }
    });

  } catch (error) {
    logger.error(
      "Failed to get documents list",
      error instanceof Error ? error : undefined,
      {
        email: session?.user?.email,
      }
    );

    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось получить список документов.",
      },
      { status: 500 }
    );
  }
}