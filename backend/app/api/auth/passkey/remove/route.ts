import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { Logger } from "@/lib/logger";
import { normalizeEmail } from "@/lib/webauthn-config";

const logger = new Logger("passkey-remove");

const requestSchema = z.object({
  email: z.string().trim().min(5, "Введите корректный email").email("Введите корректный email"),
});

export async function POST(req: NextRequest) {
  let payload: z.infer<typeof requestSchema>;

  try {
    payload = requestSchema.parse(await req.json());
  } catch (error) {
    logger.warn("Invalid passkey remove payload", { error });
    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось обработать запрос. Проверьте введённые данные.",
      },
      { status: 400 }
    );
  }

  const email = normalizeEmail(payload.email);

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        webAuthnCredentials: true
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

    // Удаляем все Passkey пользователя
    await prisma.webAuthnCredential.deleteMany({
      where: { userId: user.id }
    });

    // Также удаляем все активные вызовы
    await prisma.webAuthnChallenge.deleteMany({
      where: { userId: user.id }
    });

    logger.info("Removed all passkeys for user", {
      userId: user.id,
      removedCount: user.webAuthnCredentials.length
    });

    return NextResponse.json({
      ok: true,
      message: "Все Passkey удалены успешно"
    });
  } catch (error) {
    logger.error(
      "Passkey removal failed",
      error instanceof Error ? error : undefined,
      {
        email,
      }
    );

    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось удалить Passkey. Попробуйте позже.",
      },
      { status: 500 }
    );
  }
}