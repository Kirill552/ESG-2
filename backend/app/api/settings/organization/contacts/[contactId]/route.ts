import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { Logger } from "@/lib/logger";
import { getCurrentUserMode } from "@/lib/user-mode-utils";

const logger = new Logger("organization-contact-details");

// Валидация российских номеров телефонов
const phoneRegex = /^(\+7|7|8)?[\s\-]?\(?[489][0-9]{2}\)?[\s\-]?[0-9]{3}[\s\-]?[0-9]{2}[\s\-]?[0-9]{2}$/;

const contactUpdateSchema = z.object({
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const session = await getServerSession(authOptions);
  const { contactId } = await params;

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
      // В демо-режиме возвращаем демо-контакт если ID соответствует
      if (contactId === "demo-contact-1" || contactId === "demo-contact-2") {
        const demoContact = contactId === "demo-contact-1"
          ? {
              id: "demo-contact-1",
              name: "Демо Контактов Демо Демович",
              email: "contact@demo-company.ru",
              phone: "+7 (999) 123-45-67",
              position: "Главный эколог",
              role: "ECOLOGIST",
              isPrimary: true
            }
          : {
              id: "demo-contact-2",
              name: "Демо Бухгалтеров Демо Демович",
              email: "accounting@demo-company.ru",
              phone: "+7 (999) 123-45-68",
              position: "Главный бухгалтер",
              role: "ACCOUNTANT",
              isPrimary: false
            };

        return NextResponse.json({
          ok: true,
          contact: demoContact
        });
      }

      return NextResponse.json(
        {
          ok: false,
          message: "Контактное лицо не найдено.",
        },
        { status: 404 }
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

    // Находим организацию и контакт
    const organization = await prisma.organization.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        contacts: {
          where: { id: contactId },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            position: true,
            role: true,
            isPrimary: true,
            createdAt: true,
            updatedAt: true,
          }
        }
      }
    });

    if (!organization || organization.contacts.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "Контактное лицо не найдено.",
        },
        { status: 404 }
      );
    }

    const contact = organization.contacts[0];

    logger.info("Organization contact retrieved", {
      userId: user.id,
      organizationId: organization.id,
      contactId: contact.id,
      mode: userMode
    });

    return NextResponse.json({
      ok: true,
      contact
    });

  } catch (error) {
    logger.error(
      "Failed to get organization contact",
      error instanceof Error ? error : undefined,
      {
        email: session?.user?.email,
        contactId: contactId
      }
    );

    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось получить данные контактного лица.",
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const session = await getServerSession(authOptions);
  const { contactId } = await params;

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
          message: "В демо-режиме редактирование контактных лиц недоступно. Получите полный доступ на странице тарифов.",
        },
        { status: 403 }
      );
    }

    // Парсим и валидируем данные
    let payload: z.infer<typeof contactUpdateSchema>;
    try {
      payload = contactUpdateSchema.parse(await req.json());
    } catch (error) {
      logger.warn("Invalid contact update payload", { error, email: session.user.email });
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

    // Находим организацию и существующий контакт
    const organization = await prisma.organization.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        contacts: {
          select: {
            id: true,
            email: true,
            name: true,
            isPrimary: true,
          }
        }
      }
    });

    if (!organization) {
      return NextResponse.json(
        {
          ok: false,
          message: "Организация не найдена.",
        },
        { status: 404 }
      );
    }

    // Проверяем существование контакта
    const existingContact = organization.contacts.find(c => c.id === contactId);
    if (!existingContact) {
      return NextResponse.json(
        {
          ok: false,
          message: "Контактное лицо не найдено.",
        },
        { status: 404 }
      );
    }

    // Проверяем уникальность email, если он изменился
    if (existingContact.email !== payload.email) {
      const contactWithSameEmail = organization.contacts.find(c => c.email === payload.email && c.id !== contactId);
      if (contactWithSameEmail) {
        return NextResponse.json(
          {
            ok: false,
            message: "Контактное лицо с таким email уже существует.",
          },
          { status: 409 }
        );
      }
    }

    // Если делаем контакт основным, убираем флаг с других
    if (payload.isPrimary && !existingContact.isPrimary) {
      await prisma.organizationContact.updateMany({
        where: {
          organizationId: organization.id,
          isPrimary: true,
          id: { not: contactId }
        },
        data: {
          isPrimary: false
        }
      });
    }

    // Сохраняем старые значения для аудита
    const oldValues = {
      name: existingContact.name,
      email: existingContact.email,
      isPrimary: existingContact.isPrimary,
    };

    // Обновляем контакт
    const updatedContact = await prisma.organizationContact.update({
      where: { id: contactId },
      data: {
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
        updatedAt: true,
      }
    });

    // Записываем в аудит-лог
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'ORGANIZATION_CONTACT_UPDATED',
        resourceType: 'ORGANIZATION_CONTACT',
        resourceId: updatedContact.id,
        ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown",
        userAgent: req.headers.get("user-agent") || "unknown",
        details: {
          oldValues,
          newValues: {
            name: payload.name,
            email: payload.email,
            isPrimary: payload.isPrimary,
          }
        }
      }
    });

    logger.info("Organization contact updated", {
      userId: user.id,
      organizationId: organization.id,
      contactId: updatedContact.id,
      email: session.user.email,
      contactRole: payload.role
    });

    return NextResponse.json({
      ok: true,
      message: "Контактное лицо успешно обновлено.",
      contact: updatedContact
    });

  } catch (error) {
    logger.error(
      "Failed to update organization contact",
      error instanceof Error ? error : undefined,
      {
        email: session?.user?.email,
        contactId: contactId
      }
    );

    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось обновить контактное лицо. Попробуйте позже.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const session = await getServerSession(authOptions);
  const { contactId } = await params;

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
          message: "В демо-режиме удаление контактных лиц недоступно. Получите полный доступ на странице тарифов.",
        },
        { status: 403 }
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

    // Находим организацию и контакт
    const organization = await prisma.organization.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        contacts: {
          where: { id: contactId },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isPrimary: true,
          }
        }
      }
    });

    if (!organization || organization.contacts.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "Контактное лицо не найдено.",
        },
        { status: 404 }
      );
    }

    const contactToDelete = organization.contacts[0];

    // Удаляем контакт
    await prisma.organizationContact.delete({
      where: { id: contactId }
    });

    // Записываем в аудит-лог
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'ORGANIZATION_CONTACT_DELETED',
        resourceType: 'ORGANIZATION_CONTACT',
        resourceId: contactToDelete.id,
        ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown",
        userAgent: req.headers.get("user-agent") || "unknown",
        details: {
          deletedContact: {
            name: contactToDelete.name,
            email: contactToDelete.email,
            role: contactToDelete.role,
            isPrimary: contactToDelete.isPrimary,
          }
        }
      }
    });

    logger.info("Organization contact deleted", {
      userId: user.id,
      organizationId: organization.id,
      contactId: contactToDelete.id,
      email: session.user.email,
      contactRole: contactToDelete.role
    });

    return NextResponse.json({
      ok: true,
      message: "Контактное лицо успешно удалено."
    });

  } catch (error) {
    logger.error(
      "Failed to delete organization contact",
      error instanceof Error ? error : undefined,
      {
        email: session?.user?.email,
        contactId: contactId
      }
    );

    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось удалить контактное лицо. Попробуйте позже.",
      },
      { status: 500 }
    );
  }
}