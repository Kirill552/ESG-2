import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { Logger } from "@/lib/logger";
import { getCurrentUserMode } from "@/lib/user-mode-utils";
import { getCompanyInfo } from "@/lib/checko-service";

const logger = new Logger("settings-organization");

const organizationSchema = z.object({
  name: z.string().min(1, "Название организации обязательно").max(200, "Слишком длинное название"),
  inn: z.string().min(10, "ИНН должен содержать минимум 10 цифр").max(12, "ИНН не может быть длиннее 12 цифр"),
  kpp: z.string().optional(),
  ogrn: z.string().optional(),
  address: z.string().max(500, "Слишком длинный адрес").optional(),
  industry: z.string().max(200, "Слишком длинное название отрасли").optional(),
  okvedCode: z.string().optional(),
  okvedName: z.string().optional(),
  director: z.string().max(100, "Слишком длинное имя директора").optional(),
  directorPosition: z.string().max(100, "Слишком длинная должность").optional(),
  phone: z.string().optional(),
  email: z.string().email("Некорректный email").optional(),
  website: z.string().url("Некорректный URL сайта").optional(),
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
        organization: {
          name: "ООО \"Демо Компания\"",
          inn: "7735560386",
          kpp: "773501001",
          ogrn: "1097746328360",
          address: "г. Москва, ул. Демо, д. 1",
          industry: "Разработка программного обеспечения",
          okvedCode: "62.01",
          okvedName: "Разработка компьютерного программного обеспечения",
          director: "Демо Директоров Демо Демович",
          directorPosition: "Генеральный директор",
          phone: "+7 (XXX) XXX-XX-XX",
          email: "demo@company.ru",
          website: "https://demo-company.ru"
        }
      });
    }

    // Для реальных пользователей получаем данные из БД
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

    // Ищем организацию по ownerId (userId)
    const organization = await prisma.organization.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        name: true,
        inn: true,
        address: true,
        phone: true,
        email: true,
        profile: {
          select: {
            kpp: true,
            ogrn: true,
            okpo: true,
            okved: true,
            oktmo: true,
            okato: true,
            fullName: true,
            shortName: true,
            legalAddress: true,
            directorName: true,
            directorPosition: true,
          }
        }
      }
    });

    logger.info("Organization data retrieved", {
      userId: user.id,
      hasOrganization: !!organization,
      mode: userMode
    });

    // Объединяем данные из organization и profile
    const organizationData = organization ? {
      id: organization.id,
      name: organization.name,
      inn: organization.inn,
      address: organization.address,
      phone: organization.phone,
      email: organization.email,
      website: organization.website,
      // Данные из profile
      kpp: organization.profile?.kpp,
      ogrn: organization.profile?.ogrn,
      okpo: organization.profile?.okpo,
      okved: organization.profile?.okved,
      oktmo: organization.profile?.oktmo,
      okato: organization.profile?.okato,
      fullName: organization.profile?.fullName,
      shortName: organization.profile?.shortName,
      legalAddress: organization.profile?.legalAddress,
      directorName: organization.profile?.directorName,
      directorPosition: organization.profile?.directorPosition,
    } : null;

    return NextResponse.json({
      ok: true,
      organization: organizationData
    });

  } catch (error) {
    logger.error(
      "Failed to get organization data",
      error instanceof Error ? error : undefined,
      {
        email: session?.user?.email,
      }
    );

    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось получить данные организации.",
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
          message: "В демо-режиме редактирование организации недоступно. Получите полный доступ на странице тарифов.",
        },
        { status: 403 }
      );
    }

    // Парсим и валидируем данные
    let payload: z.infer<typeof organizationSchema>;
    try {
      payload = organizationSchema.parse(await req.json());
    } catch (error) {
      logger.warn("Invalid organization update payload", { error, email: session.user.email });
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

    // Получаем существующую организацию с профилем
    const existingOrganization = await prisma.organization.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        name: true,
        inn: true,
        profile: {
          select: {
            id: true,
            inn: true,
            kpp: true,
          }
        }
      }
    });

    // Проверяем уникальность ИНН в OrganizationProfile
    const existingProfile = await prisma.organizationProfile.findUnique({
      where: { inn: payload.inn },
      select: { id: true, organizationId: true }
    });

    if (existingProfile && existingProfile.organizationId !== existingOrganization?.id) {
      return NextResponse.json(
        {
          ok: false,
          message: "Организация с таким ИНН уже зарегистрирована другим пользователем.",
        },
        { status: 409 }
      );
    }

    // Сохраняем старые значения для аудита
    const oldValues = existingOrganization ? {
      name: existingOrganization.name,
      inn: existingOrganization.inn,
      kpp: existingOrganization.profile?.kpp,
    } : null;

    // Обновляем или создаем организацию
    const organization = await prisma.organization.upsert({
      where: { userId: user.id },
      update: {
        name: payload.name,
        inn: payload.inn,
        address: payload.address || null,
        phone: payload.phone || null,
        email: payload.email || null,
      },
      create: {
        userId: user.id,
        name: payload.name,
        inn: payload.inn,
        address: payload.address || null,
        phone: payload.phone || null,
        email: payload.email || null,
        isBlocked: false,
      },
      select: {
        id: true,
        name: true,
        inn: true,
        address: true,
        phone: true,
        email: true,
      }
    });

    // Обновляем или создаем профиль организации
    const profile = await prisma.organizationProfile.upsert({
      where: {
        organizationId: organization.id
      },
      update: {
        inn: payload.inn,
        kpp: payload.kpp || null,
        ogrn: payload.ogrn || null,
        okved: payload.okvedCode || null,
        legalAddress: payload.address || null,
        directorName: payload.director || null,
        directorPosition: payload.directorPosition || null,
      },
      create: {
        organizationId: organization.id,
        inn: payload.inn,
        kpp: payload.kpp || null,
        ogrn: payload.ogrn || null,
        okved: payload.okvedCode || null,
        legalAddress: payload.address || null,
        directorName: payload.director || null,
        directorPosition: payload.directorPosition || null,
      },
      select: {
        id: true,
        kpp: true,
        ogrn: true,
        okpo: true,
        okved: true,
        oktmo: true,
        okato: true,
        fullName: true,
        shortName: true,
        legalAddress: true,
        directorName: true,
        directorPosition: true,
      }
    });

    // Объединяем данные для возврата
    const organizationData = {
      id: organization.id,
      name: organization.name,
      inn: organization.inn,
      address: organization.address,
      phone: organization.phone,
      email: organization.email,
      kpp: profile.kpp,
      ogrn: profile.ogrn,
      okpo: profile.okpo,
      okved: profile.okved,
      oktmo: profile.oktmo,
      okato: profile.okato,
      fullName: profile.fullName,
      shortName: profile.shortName,
      legalAddress: profile.legalAddress,
      directorName: profile.directorName,
      directorPosition: profile.directorPosition,
    };

    // Записываем в аудит-лог
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: existingOrganization ? 'ORGANIZATION_UPDATED' : 'ORGANIZATION_CREATED',
        resourceType: 'ORGANIZATION',
        resourceId: organization.id,
        ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown",
        userAgent: req.headers.get("user-agent") || "unknown",
        details: {
          oldValues,
          newValues: {
            name: payload.name,
            inn: payload.inn,
            kpp: payload.kpp,
          }
        }
      }
    });

    logger.info("Organization updated successfully", {
      userId: user.id,
      organizationId: organization.id,
      email: session.user.email,
      action: existingOrganization ? 'updated' : 'created'
    });

    return NextResponse.json({
      ok: true,
      message: existingOrganization ? "Организация успешно обновлена." : "Организация успешно создана.",
      organization: organizationData
    });

  } catch (error) {
    logger.error(
      "Failed to update organization",
      error instanceof Error ? error : undefined,
      {
        email: session?.user?.email,
      }
    );

    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось обновить данные организации. Попробуйте позже.",
      },
      { status: 500 }
    );
  }
}

// Отдельный endpoint для автозаполнения по ИНН
export async function PATCH(req: NextRequest) {
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

    const userMode = await getCurrentUserMode();
    if (userMode === 'DEMO') {
      return NextResponse.json(
        {
          ok: false,
          message: "Автозаполнение по ИНН недоступно в демо-режиме.",
        },
        { status: 403 }
      );
    }

    const { inn } = await req.json();

    if (!inn) {
      return NextResponse.json(
        {
          ok: false,
          message: "ИНН обязателен для автозаполнения.",
        },
        { status: 400 }
      );
    }

    try {
      const companyInfo = await getCompanyInfo(inn);

      if (!companyInfo) {
        return NextResponse.json(
          {
            ok: false,
            message: "Данные по указанному ИНН не найдены.",
          },
          { status: 404 }
        );
      }

      logger.info("Organization auto-fill successful", {
        inn,
        email: session.user.email,
        companyName: companyInfo.shortName || companyInfo.fullName
      });

      return NextResponse.json({
        ok: true,
        suggestion: {
          name: companyInfo.shortName || companyInfo.fullName || "",
          inn: companyInfo.inn,
          kpp: companyInfo.kpp || "",
          ogrn: companyInfo.ogrn || "",
          address: companyInfo.address || "",
          okvedCode: companyInfo.okvedCode || "",
          okvedName: companyInfo.okvedName || "",
          director: companyInfo.director || "",
          directorPosition: companyInfo.directorPosition || "",
          phone: companyInfo.phone || "",
          email: companyInfo.email || "",
          website: companyInfo.website || "",
          industry: companyInfo.okvedName || ""
        }
      });

    } catch (error) {
      logger.error(
        "Auto-fill failed",
        error instanceof Error ? error : undefined,
        { inn, email: session.user.email }
      );

      return NextResponse.json(
        {
          ok: false,
          message: error instanceof Error ? error.message : "Не удалось получить данные о компании.",
        },
        { status: 500 }
      );
    }

  } catch (error) {
    logger.error(
      "Auto-fill request failed",
      error instanceof Error ? error : undefined,
      {
        email: session?.user?.email,
      }
    );

    return NextResponse.json(
      {
        ok: false,
        message: "Произошла ошибка при автозаполнении.",
      },
      { status: 500 }
    );
  }
}