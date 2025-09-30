import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { Logger } from "@/lib/logger";
import { getCurrentUserMode } from "@/lib/user-mode-utils";

const logger = new Logger("organization-contacts");

// Валидация российских номеров телефонов
const phoneRegex = /^(\+7|7|8)?[\s\-]?\(?[489][0-9]{2}\)?[\s\-]?[0-9]{3}[\s\-]?[0-9]{2}[\s\-]?[0-9]{2}$/;

const contactSchema = z.object({
  name: z.string().min(1, "Имя контактного лица обязательно").max(100, "Слишком длинное имя"),
  email: z.string().email("Некорректный email"),
  phone: z.string().optional().refine(
    (phone) => !phone || phoneRegex.test(phone),
    "Некорректный формат телефона (РФ)"
  ),
  position: z.string().max(100, "Слишком длинная должность").optional(),
  role: z.enum(['MAIN', 'ACCOUNTANT', 'ECOLOGIST', 'MANAGER', 'OTHER'], {
    errorMap: () => ({ message: "Некорректная роль контактного лица" })
  }),
  isPrimary: z.boolean().default(false),
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
      // В демо-режиме возвращаем демо-контакты
      return NextResponse.json({
        ok: true,
        contacts: [
          {
            id: "demo-contact-1",
            name: "Демо Контактов Демо Демович",
            email: "contact@demo-company.ru",
            phone: "+7 (999) 123-45-67",
            position: "Главный эколог",
            role: "ECOLOGIST",
            isPrimary: true
          },
          {
            id: "demo-contact-2",
            name: "Демо Бухгалтеров Демо Демович",
            email: "accounting@demo-company.ru",
            phone: "+7 (999) 123-45-68",
            position: "Главный бухгалтер",
            role: "ACCOUNTANT",
            isPrimary: false
          }
        ]
      });
    }

    // Находим пользователя
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
      }
    });

    if (!user) {
      return NextResponse.json({
        ok: true,
        contacts: []
      });
    }

    // Находим организацию пользователя
    const organization = await prisma.organization.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        contacts: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            position: true,
            role: true,
            isPrimary: true,
            createdAt: true,
          },
          orderBy: [
            { isPrimary: 'desc' },
            { createdAt: 'asc' }
          ]
        }
      }
    });

    if (!organization) {
      return NextResponse.json({
        ok: true,
        contacts: []
      });
    }

    logger.info("Organization contacts retrieved", {
      userId: user.id,
      organizationId: organization.id,
      contactsCount: organization.contacts.length,
      mode: userMode
    });

    return NextResponse.json({
      ok: true,
      contacts: organization.contacts
    });

  } catch (error) {
    logger.error(
      "Failed to get organization contacts",
      error instanceof Error ? error : undefined,
      {
        email: session?.user?.email,
      }
    );

    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось получить список контактных лиц.",
      },
      { status: 500 }
    );
  }
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
      return NextResponse.json(
        {
          ok: false,
          message: "В демо-режиме добавление контактных лиц недоступно. Получите полный доступ на странице тарифов.",
        },
        { status: 403 }
      );
    }

    // Парсим и валидируем данные
    let payload: z.infer<typeof contactSchema>;
    try {
      payload = contactSchema.parse(await req.json());
    } catch (error) {
      logger.warn("Invalid contact creation payload", { error, email: session.user.email });
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

    // Находим организацию пользователя
    const organization = await prisma.organization.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        contacts: {
          select: {
            id: true,
            isPrimary: true,
            email: true,
          }
        }
      }
    });

    if (!organization) {
      return NextResponse.json(
        {
          ok: false,
          message: "Организация не найдена. Сначала создайте организацию.",
        },
        { status: 404 }
      );
    }

    // Проверяем уникальность email
    const existingContact = organization.contacts.find(c => c.email === payload.email);
    if (existingContact) {
      return NextResponse.json(
        {
          ok: false,
          message: "Контактное лицо с таким email уже существует.",
        },
        { status: 409 }
      );
    }

    // Если добавляется основной контакт, убираем флаг с других
    if (payload.isPrimary) {
      await prisma.organizationContact.updateMany({
        where: {
          organizationId: organization.id,
          isPrimary: true
        },
        data: {
          isPrimary: false
        }
      });
    }

    // Создаем контактное лицо
    const contact = await prisma.organizationContact.create({
      data: {
        organizationId: organization.id,
        name: payload.name,
        email: payload.email,
        phone: payload.phone || null,
        position: payload.position || null,
        role: payload.role,
        isPrimary: payload.isPrimary,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        position: true,
        role: true,
        isPrimary: true,
        createdAt: true,
      }
    });

    // Записываем в аудит-лог
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'ORGANIZATION_CONTACT_CREATED',
        resourceType: 'ORGANIZATION_CONTACT',
        resourceId: contact.id,
        ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown",
        userAgent: req.headers.get("user-agent") || "unknown",
        details: {
          contactName: payload.name,
          contactEmail: payload.email,
          role: payload.role,
          isPrimary: payload.isPrimary
        }
      }
    });

    logger.info("Organization contact created", {
      userId: user.id,
      organizationId: organization.id,
      contactId: contact.id,
      email: session.user.email,
      contactRole: payload.role
    });

    return NextResponse.json({
      ok: true,
      message: "Контактное лицо успешно добавлено.",
      contact
    });

  } catch (error) {
    logger.error(
      "Failed to create organization contact",
      error instanceof Error ? error : undefined,
      {
        email: session?.user?.email,
      }
    );

    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось добавить контактное лицо. Попробуйте позже.",
      },
      { status: 500 }
    );
  }
}