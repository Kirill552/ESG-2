import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createMagicLinkRequest, MagicLinkError } from "@/lib/magic-link-service";
import { Logger } from "@/lib/logger";

const logger = new Logger("magic-link-request");

const requestSchema = z.object({
  email: z.string().trim().min(5, "Введите корректный email").email("Введите корректный email"),
  redirectTo: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  let payload: z.infer<typeof requestSchema>;

  try {
    const json = await req.json();
    payload = requestSchema.parse(json);
  } catch (error) {
    logger.warn("Invalid request payload", { error });
    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось обработать запрос. Проверьте введённые данные.",
      },
      { status: 400 }
    );
  }

  try {
    await createMagicLinkRequest({
      email: payload.email,
      redirectTo: payload.redirectTo,
      headers: req.headers,
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({
      ok: true,
      message: "Если адрес существует в системе, ссылка для входа отправлена.",
    });
  } catch (error) {
    if (error instanceof MagicLinkError) {
      logger.warn("Magic link request rejected", {
        code: error.code,
        email: payload.email,
      });

      return NextResponse.json(
        {
          ok: false,
          code: error.code,
          message: error.message,
        },
        { status: error.status }
      );
    }

    logger.error(
      "Unexpected magic link request error",
      error instanceof Error ? error : undefined,
      {
        email: payload.email,
      }
    );

    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось отправить ссылку. Попробуйте позже.",
      },
      { status: 500 }
    );
  }
}
