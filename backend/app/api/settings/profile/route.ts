import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { Logger } from "@/lib/logger";
import { getCurrentUserMode } from "@/lib/user-mode-utils";

const logger = new Logger("settings-profile");

// Валидация российских номеров телефонов
const phoneRegex = /^(\+7|7|8)?[\s\-]?\(?[489][0-9]{2}\)?[\s\-]?[0-9]{3}[\s\-]?[0-9]{2}[\s\-]?[0-9]{2}$/;

const profileSchema = z.object({
  firstName: z.string().min(1, "Имя обязательно").max(50, "Слишком длинное имя"),
  lastName: z.string().min(1, "Фамилия обязательна").max(50, "Слишком длинная фамилия"),
  email: z.string().email("Некорректный email"),
  phone: z.string().optional().refine(
    (phone) => !phone || phoneRegex.test(phone),
    "Некорректный формат телефона (РФ)"
  ),
  position: z.string().max(100, "Слишком длинная должность").optional(),
});

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

    // Проверяем режим пользователя
    const userMode = await getCurrentUserMode();
    if (userMode === 'DEMO') {
      // В демо-режиме возвращаем демо-данные
      return NextResponse.json({
        ok: true,
        profile: {
          firstName: "Демо",
          lastName: "Пользователь",
          email: session.user.email,
          phone: "+7 (XXX) XXX-XX-XX",
          position: "Эколог"
        }
      });
    }

    // Для реальных пользователей получаем данные из БД
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        // Добавим поле position если его нет в схеме
      }
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

    // Получаем дополнительные данные профиля из связанной таблицы
    let userProfile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
      select: {
        position: true,
      }
    });

    // Если профиля нет, создаем пустой
    if (!userProfile) {
      userProfile = await prisma.userProfile.create({
        data: {
          userId: user.id,
          position: null,
        },
        select: {
          position: true,
        }
      });
    }

    logger.info("Profile data retrieved", {
      userId: user.id,
      email: user.email,
      mode: userMode
    });

    return NextResponse.json({
      ok: true,
      profile: {
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email,
        phone: user.phone || "",
        position: userProfile.position || ""
      }
    });

  } catch (error) {
    logger.error(
      "Failed to get profile data",
      error instanceof Error ? error : undefined,
      {
        email: session?.user?.email,
      }
    );

    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось получить данные профиля.",
      },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
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
      return NextResponse.json(
        {
          ok: false,
          message: "В демо-режиме редактирование профиля недоступно. Получите полный доступ на странице тарифов.",
        },
        { status: 403 }
      );
    }

    // Парсим и валидируем данные
    let payload: z.infer<typeof profileSchema>;
    try {
      payload = profileSchema.parse(await req.json());
    } catch (error) {
      logger.warn("Invalid profile update payload", { error, email: session.user.email });
      return NextResponse.json(
        {
          ok: false,
          message: "Некорректные данные. Проверьте все поля.",
          errors: error instanceof z.ZodError ? error.errors : undefined
        },
        { status: 400 }
      );
    }

    // Находим пользователя
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
      }
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

    // Проверяем, изменился ли email (пока не поддерживаем смену email)
    if (payload.email !== session.user.email) {
      return NextResponse.json(
        {
          ok: false,
          message: "Смена email временно недоступна. Обратитесь в поддержку.",
        },
        { status: 400 }
      );
    }

    // Сохраняем старые значения для аудита
    const oldValues = {
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
    };

    // Обновляем основные данные пользователя
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        firstName: payload.firstName,
        lastName: payload.lastName,
        phone: payload.phone || null,
        name: `${payload.firstName} ${payload.lastName}`, // Обновляем составное имя для NextAuth
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
      }
    });

    // Обновляем или создаем профиль
    const userProfile = await prisma.userProfile.upsert({
      where: { userId: user.id },
      update: {
        position: payload.position || null,
      },
      create: {
        userId: user.id,
        position: payload.position || null,
      },
      select: {
        position: true,
      }
    });

    // Записываем в аудит-лог
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'PROFILE_UPDATED',
        resourceType: 'USER_PROFILE',
        resourceId: user.id,
        ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown",
        userAgent: req.headers.get("user-agent") || "unknown",
        details: {
          oldValues,
          newValues: {
            firstName: payload.firstName,
            lastName: payload.lastName,
            phone: payload.phone,
            position: payload.position,
          }
        }
      }
    });

    logger.info("Profile updated successfully", {
      userId: user.id,
      email: session.user.email,
      changes: Object.keys(payload)
    });

    return NextResponse.json({
      ok: true,
      message: "Профиль успешно обновлен.",
      profile: {
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        email: updatedUser.email,
        phone: updatedUser.phone || "",
        position: userProfile.position || ""
      }
    });

  } catch (error) {
    logger.error(
      "Failed to update profile",
      error instanceof Error ? error : undefined,
      {
        email: session?.user?.email,
      }
    );

    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось обновить профиль. Попробуйте позже.",
      },
      { status: 500 }
    );
  }
}