import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { Logger } from "@/lib/logger";
import { getCurrentUserMode } from "@/lib/user-mode-utils";
import { notificationService, NotificationType, NotificationPriority } from "@/lib/notification-service";
import { batchNotificationService } from "@/lib/batch-notification-service";
import { uploadFile, generateFileKey } from "@/lib/s3";
import { getBoss } from "@/lib/pg-boss-config";
import crypto from "crypto";

const logger = new Logger("documents-upload-api");

// Максимальный размер файла (50 МБ)
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Поддерживаемые типы файлов
const SUPPORTED_FILE_TYPES = {
  'application/pdf': { extension: 'pdf', category: 'document' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { extension: 'xlsx', category: 'spreadsheet' },
  'application/vnd.ms-excel': { extension: 'xls', category: 'spreadsheet' },
  'text/csv': { extension: 'csv', category: 'spreadsheet' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { extension: 'docx', category: 'document' },
  'application/msword': { extension: 'doc', category: 'document' },
  'image/jpeg': { extension: 'jpg', category: 'image' },
  'image/png': { extension: 'png', category: 'image' },
  'image/gif': { extension: 'gif', category: 'image' },
  'text/plain': { extension: 'txt', category: 'document' }
};

// Функция для определения категории документа по имени файла
function inferDocumentCategory(fileName: string): string {
  const lowercaseName = fileName.toLowerCase();

  if (lowercaseName.includes('производств') || lowercaseName.includes('продукц')) {
    return 'PRODUCTION';
  }
  if (lowercaseName.includes('поставщик') || lowercaseName.includes('supplier')) {
    return 'SUPPLIERS';
  }
  if (lowercaseName.includes('отход') || lowercaseName.includes('waste')) {
    return 'WASTE';
  }
  if (lowercaseName.includes('транспорт') || lowercaseName.includes('transport')) {
    return 'TRANSPORT';
  }
  if (lowercaseName.includes('энерг') || lowercaseName.includes('energy')) {
    return 'ENERGY';
  }

  return 'OTHER';
}

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

    // Проверяем режим пользователя
    const userMode = await getCurrentUserMode();

    if (userMode === 'DEMO') {
      // В демо-режиме имитируем успешную загрузку
      logger.info("Demo file upload simulated", {
        userMode,
        userEmail: session.user.email
      });

      // Генерируем мок-данные для демо-режима
      const mockDocument = {
        id: `demo-upload-${Date.now()}`,
        fileName: `Загруженный_документ_${Date.now()}.pdf`,
        originalName: "example_document.pdf",
        fileSize: Math.floor(Math.random() * 10 * 1024 * 1024) + 1024 * 1024, // 1-10 МБ
        fileType: "application/pdf",
        status: "UPLOADED",
        category: "OTHER",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        processingProgress: 0,
        processingMessage: null
      };

      return NextResponse.json({
        ok: true,
        message: "Документ успешно загружен (демо-режим).",
        document: mockDocument
      });
    }

    // Получаем пользователя из БД
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

    // Проверяем, что пользователь имеет доступ к загрузке
    if (user.mode === 'TRIAL' || user.mode === 'EXPIRED') {
      return NextResponse.json(
        {
          ok: false,
          message: "Загрузка документов недоступна в пробном режиме. Оформите подписку для получения доступа.",
        },
        { status: 403 }
      );
    }

    // Парсим форму с файлом
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const categoryOverride = formData.get('category') as string;
    const batchId = formData.get('batchId') as string | null;

    if (!file) {
      return NextResponse.json(
        {
          ok: false,
          message: "Файл не найден в запросе.",
        },
        { status: 400 }
      );
    }

    // Валидация файла
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          ok: false,
          message: `Размер файла превышает максимально допустимый (${MAX_FILE_SIZE / 1024 / 1024} МБ).`,
        },
        { status: 400 }
      );
    }

    if (!SUPPORTED_FILE_TYPES[file.type as keyof typeof SUPPORTED_FILE_TYPES]) {
      return NextResponse.json(
        {
          ok: false,
          message: "Неподдерживаемый тип файла. Поддерживаются: PDF, Excel, Word, CSV, изображения.",
        },
        { status: 400 }
      );
    }

    // Определяем категорию документа
    const category = categoryOverride || inferDocumentCategory(file.name);

    // Получаем buffer файла
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Генерируем уникальный ключ файла для S3
    const fileKey = generateFileKey(file.name, `documents/${user.id}`);

    // Загружаем файл в Yandex Object Storage (S3)
    logger.info("Uploading file to S3", {
      userId: user.id,
      fileName: file.name,
      fileSize: file.size,
      fileKey
    });

    const s3Url = await uploadFile(fileKey, buffer, file.type);

    logger.info("File uploaded to S3 successfully", {
      userId: user.id,
      fileKey,
      s3Url
    });

    // Создаем запись в БД
    const document = await prisma.document.create({
      data: {
        fileName: fileKey, // Сохраняем S3 key вместо локального пути
        originalName: file.name,
        fileSize: file.size,
        fileType: file.type,
        filePath: s3Url, // Сохраняем S3 URL
        status: 'UPLOADED',
        category: category as any,
        userId: user.id,
        processingProgress: 0,
        batchId: batchId || undefined
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

    logger.info("Document uploaded successfully", {
      documentId: document.id,
      userId: user.id,
      userMode,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      category
    });

    // Отправляем уведомление о загрузке (только для малых загрузок 1-2 файла)
    try {
      const shouldSendIndividual = await batchNotificationService.shouldSendIndividualNotification(document.id);

      if (shouldSendIndividual) {
        await notificationService.sendNotification({
          userId: user.id,
          type: NotificationType.DOCUMENT_UPLOADED,
          title: 'Документ успешно загружен',
          message: `Файл "${file.name}" загружен и поставлен в очередь на обработку.`,
          metadata: {
            documentId: document.id,
            fileName: file.name,
            fileSize: file.size,
            link: '/documents',
            priority: NotificationPriority.LOW
          }
        });
        logger.info("Upload notification sent", { documentId: document.id });
      } else {
        logger.info("Upload notification skipped (batch mode)", { documentId: document.id });
      }
    } catch (notifError) {
      logger.error("Failed to send upload notification",
        notifError instanceof Error ? notifError : undefined,
        { documentId: document.id }
      );
      // Не прерываем выполнение если уведомление не отправилось
    }

    // ✅ Добавляем задачу в очередь OCR для автоматической обработки
    try {
      const boss = await getBoss();
      await boss.send('ocr-processing', {
        documentId: document.id,
        userId: user.id,
        filePath: s3Url,
        fileName: file.name,
        fileType: file.type,
        category: category
      });

      logger.info("Document added to OCR queue", {
        documentId: document.id,
        userId: user.id,
        fileName: file.name
      });
    } catch (queueError) {
      logger.error("Failed to add document to OCR queue",
        queueError instanceof Error ? queueError : undefined,
        { documentId: document.id }
      );
      // Не прерываем выполнение, если не удалось добавить в очередь
      // Пользователь может обработать документ вручную позже
    }

    return NextResponse.json({
      ok: true,
      message: "Документ успешно загружен и поставлен в очередь на обработку.",
      document
    });

  } catch (error) {
    logger.error(
      "Failed to upload document",
      error instanceof Error ? error : undefined,
      {
        email: session?.user?.email,
      }
    );

    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось загрузить документ.",
      },
      { status: 500 }
    );
  }
}