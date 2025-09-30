import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { Logger } from "@/lib/logger";
import { normalizeEmail } from "@/lib/webauthn-config";

const logger = new Logger("passkey-status");

const requestSchema = z.object({
  email: z.string().trim().min(5, "Введите корректный email").email("Введите корректный email"),
});

export async function POST(req: NextRequest) {
  let payload: z.infer<typeof requestSchema>;

  try {
    payload = requestSchema.parse(await req.json());
  } catch (error) {
    logger.warn("Invalid passkey status payload", { error });
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
      return NextResponse.json({
        ok: true,
        hasUser: false,
        hasPasskey: false,
        canUsePasskey: false
      });
    }

    const hasPasskey = user.webAuthnCredentials.length > 0;

    return NextResponse.json({
      ok: true,
      hasUser: true,
      hasPasskey,
      canUsePasskey: hasPasskey
    });
  } catch (error) {
    logger.error(
      "Passkey status check failed",
      error instanceof Error ? error : undefined,
      {
        email,
      }
    );

    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось проверить статус Passkey. Попробуйте позже.",
      },
      { status: 500 }
    );
  }
}