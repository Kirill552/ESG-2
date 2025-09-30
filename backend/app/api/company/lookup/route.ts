import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth-options";
import { Logger } from "@/lib/logger";
import { getCurrentUserMode } from "@/lib/user-mode-utils";
import { getCompanyInfo } from "@/lib/checko-service";

const logger = new Logger("company-lookup");

const lookupSchema = z.object({
  inn: z.string().min(10, "ИНН должен содержать минимум 10 цифр").max(12, "ИНН не может быть длиннее 12 цифр"),
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

    // Проверяем режим пользователя
    const userMode = await getCurrentUserMode();
    if (userMode === 'DEMO') {
      return NextResponse.json(
        {
          ok: false,
          message: "Поиск по ИНН недоступен в демо-режиме. Получите полный доступ на странице тарифов.",
        },
        { status: 403 }
      );
    }

    // Парсим и валидируем данные
    let payload: z.infer<typeof lookupSchema>;
    try {
      payload = lookupSchema.parse(await req.json());
    } catch (error) {
      logger.warn("Invalid company lookup payload", { error, email: session.user.email });
      return NextResponse.json(
        {
          ok: false,
          message: "Некорректный ИНН. Проверьте формат.",
          errors: error instanceof z.ZodError ? error.errors : undefined
        },
        { status: 400 }
      );
    }

    try {
      // Получаем информацию о компании через Checko API
      const companyInfo = await getCompanyInfo(payload.inn);

      if (!companyInfo) {
        return NextResponse.json(
          {
            ok: false,
            message: "Данные по указанному ИНН не найдены.",
          },
          { status: 404 }
        );
      }

      logger.info("Company lookup successful", {
        inn: payload.inn,
        email: session.user.email,
        companyName: companyInfo.shortName || companyInfo.fullName
      });

      return NextResponse.json({
        ok: true,
        company: {
          inn: companyInfo.inn,
          kpp: companyInfo.kpp,
          ogrn: companyInfo.ogrn,
          shortName: companyInfo.shortName,
          fullName: companyInfo.fullName,
          address: companyInfo.address,
          okvedCode: companyInfo.okvedCode,
          okvedName: companyInfo.okvedName,
          status: companyInfo.status,
          director: companyInfo.director,
          directorPosition: companyInfo.directorPosition,
          phone: companyInfo.phone,
          email: companyInfo.email,
          website: companyInfo.website,
        }
      });

    } catch (error) {
      logger.error(
        "Company lookup failed",
        error instanceof Error ? error : undefined,
        {
          inn: payload.inn,
          email: session.user.email,
        }
      );

      if (error instanceof Error && error.message.includes("Некорректный формат ИНН")) {
        return NextResponse.json(
          {
            ok: false,
            message: error.message,
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        {
          ok: false,
          message: "Не удалось получить данные о компании. Попробуйте позже.",
        },
        { status: 500 }
      );
    }

  } catch (error) {
    logger.error(
      "Company lookup request failed",
      error instanceof Error ? error : undefined,
      {
        email: session?.user?.email,
      }
    );

    return NextResponse.json(
      {
        ok: false,
        message: "Произошла ошибка при обработке запроса.",
      },
      { status: 500 }
    );
  }
}