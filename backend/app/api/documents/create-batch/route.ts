import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { Logger } from "@/lib/logger";
import { getCurrentUserMode } from "@/lib/user-mode-utils";

const logger = new Logger("documents-create-batch-api");

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
    const { documentCount } = body;

    if (!documentCount || documentCount < 3) {
      return NextResponse.json(
        {
          ok: false,
          message: "Batch создается только для 3+ документов.",
        },
        { status: 400 }
      );
    }

    // Проверяем режим пользователя
    const userMode = await getCurrentUserMode();

    if (userMode === 'DEMO') {
      // В демо-режиме возвращаем мок batch ID
      logger.info("Demo batch creation simulated", {
        userMode,
        documentCount
      });

      return NextResponse.json({
        ok: true,
        batchId: `demo-batch-${Date.now()}`,
        message: "Batch создан (демо-режим)."
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

    // Создаем batch в БД
    const batch = await prisma.documentBatch.create({
      data: {
        userId: user.id,
        totalCount: documentCount,
        pendingCount: documentCount,
        processedCount: 0,
        failedCount: 0,
        notificationSent: false
      },
      select: {
        id: true,
        totalCount: true,
        createdAt: true
      }
    });

    logger.info("Document batch created", {
      batchId: batch.id,
      userId: user.id,
      userMode,
      documentCount
    });

    return NextResponse.json({
      ok: true,
      batchId: batch.id,
      message: `Batch создан для ${documentCount} документов.`
    });

  } catch (error) {
    logger.error(
      "Failed to create document batch",
      error instanceof Error ? error : undefined,
      {
        email: session?.user?.email,
      }
    );

    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось создать batch.",
      },
      { status: 500 }
    );
  }
}