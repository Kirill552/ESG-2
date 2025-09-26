import { NextRequest, NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/server";
import { $Enums } from "@prisma/client";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { Logger } from "@/lib/logger";
import { createUserSession, getSessionCookieConfig } from "@/lib/session-utils";
import {
  WEBAUTHN_EXPECTED_ORIGIN,
  WEBAUTHN_RP_ID,
  normalizeEmail,
} from "@/lib/webauthn-config";

const logger = new Logger("passkey-authenticate-verify");

const requestSchema = z.object({
  email: z.string().trim().min(5).email(),
  response: z.any(),
});

export async function POST(req: NextRequest) {
  let payload: z.infer<typeof requestSchema>;

  try {
    payload = requestSchema.parse(await req.json());
  } catch (error) {
    logger.warn("Invalid passkey authentication verify payload", { error });
    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось обработать ответ Passkey.",
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
          message: "Пользователь не найден.",
        },
        { status: 404 }
      );
    }

    const challengeRecord = await prisma.webAuthnChallenge.findFirst({
      where: {
        userId: user.id,
  type: $Enums.WebAuthnChallengeType.AUTHENTICATION,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!challengeRecord) {
      return NextResponse.json(
        {
          ok: false,
          message: "Challenge не найден или устарел. Запросите новый.",
        },
        { status: 400 }
      );
    }

    if (challengeRecord.expiresAt < new Date()) {
      await prisma.webAuthnChallenge.delete({ where: { id: challengeRecord.id } });
      return NextResponse.json(
        {
          ok: false,
          message: "Срок действия challenge истёк. Попробуйте снова.",
        },
        { status: 410 }
      );
    }

    const credentialId = payload.response?.id;

    if (!credentialId) {
      return NextResponse.json(
        {
          ok: false,
          message: "Некорректный ответ Passkey.",
        },
        { status: 400 }
      );
    }

    const credential = await prisma.webAuthnCredential.findUnique({
      where: { credentialId },
    });

    if (!credential) {
      return NextResponse.json(
        {
          ok: false,
          message: "Passkey не найден для пользователя.",
        },
        { status: 404 }
      );
    }

    const verification = await verifyAuthenticationResponse({
      response: payload.response,
      expectedChallenge: challengeRecord.challenge,
      expectedOrigin: WEBAUTHN_EXPECTED_ORIGIN,
      expectedRPID: WEBAUTHN_RP_ID,
      credential: {
        id: credential.credentialId,
        publicKey: new Uint8Array(credential.publicKey),
        counter: Number(credential.counter),
        transports: credential.transports as AuthenticatorTransportFuture[] | undefined,
      },
      requireUserVerification: true,
    });

    if (!verification.verified) {
      return NextResponse.json(
        {
          ok: false,
          message: "Не удалось подтвердить Passkey.",
        },
        { status: 400 }
      );
    }

    const { sessionToken, sessionExpires } = await prisma.$transaction(async (tx) => {
      const newCounter = verification.authenticationInfo?.newCounter ?? Number(credential.counter) + 1;

      await tx.webAuthnCredential.update({
        where: { id: credential.id },
        data: {
          counter: BigInt(newCounter),
          updatedAt: new Date(),
        },
      });

      await tx.webAuthnChallenge.deleteMany({
        where: {
          userId: user.id,
          type: $Enums.WebAuthnChallengeType.AUTHENTICATION,
        },
      });

      await tx.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
        },
      });

      return createUserSession(tx, user.id);
    });

    const response = NextResponse.json({
      ok: true,
    });

    const cookieConfig = getSessionCookieConfig();

    response.cookies.set(cookieConfig.name, sessionToken, {
      httpOnly: cookieConfig.httpOnly,
      sameSite: cookieConfig.sameSite,
      secure: cookieConfig.secure,
      path: cookieConfig.path,
      domain: cookieConfig.domain,
      maxAge: cookieConfig.maxAge,
      expires: sessionExpires,
    });

    logger.info("Passkey authentication succeeded", {
      userId: user.id,
      credentialId,
    });

    return response;
  } catch (error) {
    logger.error(
      "Passkey authentication verification failed",
      error instanceof Error ? error : undefined,
      { email }
    );

    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось выполнить вход. Попробуйте опять позже.",
      },
      { status: 500 }
    );
  }
}
