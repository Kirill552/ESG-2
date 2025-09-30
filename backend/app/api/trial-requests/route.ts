import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { Logger } from "@/lib/logger";

const logger = new Logger("trial-requests");

const trialRequestSchema = z.object({
  message: z.string().min(10, "Сообщение должно содержать минимум 10 символов").max(1000, "Сообщение слишком длинное"),
  companyName: z.string().min(2, "Название компании обязательно").max(200, "Название компании слишком длинное"),
  position: z.string().min(2, "Должность обязательна").max(100, "Должность слишком длинная"),
  phone: z.string().optional(),
  requestType: z.enum(["TRIAL", "DEMO_EXTEND", "FULL_ACCESS"]).default("TRIAL")
});

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

    // Парсим данные запроса
    let payload: z.infer<typeof trialRequestSchema>;
    try {
      payload = trialRequestSchema.parse(await req.json());
    } catch (error) {
      logger.warn("Invalid trial request payload", { error, email: session.user.email });
      return NextResponse.json(
        {
          ok: false,
          message: "Некорректные данные запроса. Проверьте все поля.",
        },
        { status: 400 }
      );
    }

    // Проверяем, существует ли пользователь
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        email: true,
        name: true,
        mode: true,
      },
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

    // Проверяем, есть ли уже активная заявка от этого пользователя
    const existingRequest = await prisma.trialRequest.findFirst({
      where: {
        userId: user.id,
        status: "PENDING"
      }
    });

    if (existingRequest) {
      return NextResponse.json(
        {
          ok: false,
          message: "У вас уже есть активная заявка на доступ. Ожидайте обработки.",
        },
        { status: 409 }
      );
    }

    // Создаем заявку на доступ
    const trialRequest = await prisma.trialRequest.create({
      data: {
        userId: user.id,
        message: payload.message,
        companyName: payload.companyName,
        position: payload.position,
        phone: payload.phone,
        requestType: payload.requestType,
        status: "PENDING",
        userEmail: user.email,
        userName: user.name || "Не указано",
        ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown",
        userAgent: req.headers.get("user-agent") || "unknown"
      }
    });

    logger.info("Trial request created successfully", {
      requestId: trialRequest.id,
      userId: user.id,
      email: user.email,
      requestType: payload.requestType,
      companyName: payload.companyName
    });

    // Отправляем уведомление менеджеру
    try {
      const { notifyManagerAboutTrialRequest } = await import("@/lib/manager-notification");

      await notifyManagerAboutTrialRequest({
        requestId: trialRequest.id,
        userId: user.id,
        userEmail: user.email,
        userName: user.name || "Не указано",
        companyName: payload.companyName,
        position: payload.position,
        phone: payload.phone,
        message: payload.message,
        requestType: payload.requestType,
        createdAt: trialRequest.createdAt
      });
    } catch (notificationError) {
      // Не прерываем процесс, если уведомление не отправилось
      logger.warn("Failed to send manager notification", {
        requestId: trialRequest.id,
        error: notificationError
      });
    }

    return NextResponse.json({
      ok: true,
      message: "Заявка на доступ успешно отправлена. Мы свяжемся с вами в ближайшее время.",
      requestId: trialRequest.id
    });

  } catch (error) {
    logger.error(
      "Failed to create trial request",
      error instanceof Error ? error : undefined,
      {
        email: session?.user?.email,
      }
    );

    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось отправить заявку. Попробуйте позже.",
      },
      { status: 500 }
    );
  }
}

// GET метод для получения статуса заявки пользователя
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

    // Получаем последнюю заявку пользователя
    const latestRequest = await prisma.trialRequest.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        requestType: true,
        createdAt: true,
        processedAt: true,
        message: true
      }
    });

    return NextResponse.json({
      ok: true,
      request: latestRequest
    });

  } catch (error) {
    logger.error(
      "Failed to get trial request status",
      error instanceof Error ? error : undefined,
      {
        email: session?.user?.email,
      }
    );

    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось получить статус заявки.",
      },
      { status: 500 }
    );
  }
}