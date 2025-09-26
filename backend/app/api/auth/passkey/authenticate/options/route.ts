import { NextRequest, NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/server";
import { $Enums } from "@prisma/client";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { Logger } from "@/lib/logger";
import {
  normalizeEmail,
  PASSKEY_CHALLENGE_TTL_SECONDS,
  PASSKEY_TIMEOUT_MS,
  WEBAUTHN_RP_ID,
  getRequestIp,
} from "@/lib/webauthn-config";

const logger = new Logger("passkey-authenticate-options");

const requestSchema = z.object({
  email: z.string().trim().min(5, "Введите корректный email").email("Введите корректный email"),
});

export async function POST(req: NextRequest) {
  let payload: z.infer<typeof requestSchema>;

  try {
    payload = requestSchema.parse(await req.json());
  } catch (error) {
    logger.warn("Invalid passkey authentication options payload", { error });
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
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return NextResponse.json(
        {
          ok: false,
          message: "Пользователь не найден. Зарегистрируйтесь или используйте ссылку на почту.",
        },
        { status: 404 }
      );
    }

    const credentials = await prisma.webAuthnCredential.findMany({
      where: { userId: user.id },
    });

    if (!credentials.length) {
      return NextResponse.json(
        {
          ok: false,
          message: "Для этого аккаунта ещё не настроен Passkey.",
        },
        { status: 400 }
      );
    }

    const options = await generateAuthenticationOptions({
      rpID: WEBAUTHN_RP_ID,
      timeout: PASSKEY_TIMEOUT_MS,
      userVerification: "required",
      allowCredentials: credentials.map((credential) => ({
        id: credential.credentialId,
        type: "public-key" as const,
        transports: credential.transports as AuthenticatorTransportFuture[] | undefined,
      })),
    });

    const expiresAt = new Date(Date.now() + PASSKEY_CHALLENGE_TTL_SECONDS * 1000);

    await prisma.$transaction(async (tx) => {
      await tx.webAuthnChallenge.deleteMany({
        where: {
          userId: user.id,
          type: $Enums.WebAuthnChallengeType.AUTHENTICATION,
        },
      });

      await tx.webAuthnChallenge.create({
        data: {
          userId: user.id,
          email: user.email,
          challenge: options.challenge,
          type: $Enums.WebAuthnChallengeType.AUTHENTICATION,
          data: {
            userId: user.id,
          },
          expiresAt,
          ipAddress: getRequestIp(req.headers),
          userAgent: req.headers.get("user-agent"),
        },
      });
    });

    logger.info("Issued passkey authentication options", {
      userId: user.id,
    });

    return NextResponse.json({
      ok: true,
      options,
    });
  } catch (error) {
    logger.error(
      "Passkey authentication options failed",
      error instanceof Error ? error : undefined,
      {
        email,
      }
    );

    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось подготовить вход по Passkey. Попробуйте позже.",
      },
      { status: 500 }
    );
  }
}
