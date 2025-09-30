import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { Logger } from "@/lib/logger";
import { getCurrentUserMode } from "@/lib/user-mode-utils";
import { readFile } from "fs/promises";
import { existsSync } from "fs";

const logger = new Logger("documents-download-api");

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
      // В демо-режиме возвращаем пустой PDF файл для демонстрации
      logger.info("Demo document download simulated", {
        documentId,
        userMode
      });

      // Создаем минимальный PDF контент для демонстрации
      const demoContent = Buffer.from(`%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj
4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
100 700 Td
(Demo Document) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000207 00000 n
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
295
%%EOF`);

      return new NextResponse(demoContent, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="demo-document-${documentId}.pdf"`,
          'Content-Length': demoContent.length.toString(),
        },
      });
    }

    // Для реальных пользователей получаем файл из файловой системы
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
        fileType: true,
        filePath: true,
        fileSize: true
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

    if (!document.filePath || !existsSync(document.filePath)) {
      logger.error("Document file not found on disk", undefined, {
        documentId,
        filePath: document.filePath
      });

      return NextResponse.json(
        {
          ok: false,
          message: "Файл документа не найден на сервере.",
        },
        { status: 404 }
      );
    }

    // Читаем файл
    const fileBuffer = await readFile(document.filePath);

    logger.info("Document downloaded successfully", {
      documentId,
      userId: user.id,
      userMode,
      fileName: document.originalName,
      fileSize: document.fileSize
    });

    // Возвращаем файл с правильными заголовками
    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        'Content-Type': document.fileType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(document.originalName)}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    });

  } catch (error) {
    logger.error(
      "Failed to download document",
      error instanceof Error ? error : undefined,
      {
        documentId,
        email: session?.user?.email,
      }
    );

    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось скачать документ.",
      },
      { status: 500 }
    );
  }
}