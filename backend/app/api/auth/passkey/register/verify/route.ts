import { NextRequest, NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { z } from "zod";
import { $Enums } from "@prisma/client";

import prisma from "@/lib/prisma";
import { Logger } from "@/lib/logger";
import { createUserSession, getSessionCookieConfig } from "@/lib/session-utils";
import {
  WEBAUTHN_EXPECTED_ORIGIN,
  WEBAUTHN_RP_ID,
  normalizeEmail,
} from "@/lib/webauthn-config";

const logger = new Logger("passkey-register-verify");

const requestSchema = z.object({
  email: z.string().trim().min(5).email(),
  response: z.any(),
});

export async function POST(req: NextRequest) {
  let payload: z.infer<typeof requestSchema>;

  try {
    payload = requestSchema.parse(await req.json());
  } catch (error) {
    logger.warn("Invalid passkey registration verify payload", { error });
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
          message: "Пользователь с таким email не найден. Запросите новую регистрацию.",
        },
        { status: 404 }
      );
    }

    const challengeRecord = await prisma.webAuthnChallenge.findFirst({
      where: {
        userId: user.id,
  type: $Enums.WebAuthnChallengeType.REGISTRATION,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!challengeRecord) {
      return NextResponse.json(
        {
          ok: false,
          message: "Регистрационный challenge не найден или устарел.",
        },
        { status: 400 }
      );
    }

    if (challengeRecord.expiresAt < new Date()) {
      await prisma.webAuthnChallenge.delete({ where: { id: challengeRecord.id } });
      return NextResponse.json(
        {
          ok: false,
          message: "Срок действия challenge истёк. Начните регистрацию заново.",
        },
        { status: 410 }
      );
    }

    const verification = await verifyRegistrationResponse({
      response: payload.response,
      expectedChallenge: challengeRecord.challenge,
      expectedOrigin: WEBAUTHN_EXPECTED_ORIGIN,
      expectedRPID: WEBAUTHN_RP_ID,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json(
        {
          ok: false,
          message: "Не удалось подтвердить Passkey. Попробуйте ещё раз.",
        },
        { status: 400 }
      );
    }

    const { registrationInfo } = verification;

    const credential = registrationInfo.credential;
    const credentialID = credential.id;
    const transports = Array.from(
      new Set([
        ...(credential.transports ?? []),
        ...(payload.response?.response?.transports ?? []),
      ])
    );

    const { sessionToken, sessionExpires } = await prisma.$transaction(async (tx) => {
      await tx.webAuthnCredential.upsert({
        where: { credentialId: credentialID },
        create: {
          userId: user.id,
          credentialId: credentialID,
          publicKey: Buffer.from(credential.publicKey),
          counter: BigInt(credential.counter ?? 0),
          transports,
        },
        update: {
          publicKey: Buffer.from(credential.publicKey),
          counter: BigInt(credential.counter ?? 0),
          transports,
          updatedAt: new Date(),
        },
      });

      await tx.webAuthnChallenge.deleteMany({
        where: {
          userId: user.id,
          type: $Enums.WebAuthnChallengeType.REGISTRATION,
        },
      });

      const now = new Date();

      await tx.user.update({
        where: { id: user.id },
        data: {
          emailVerified: user.emailVerified ?? now,
          lastLoginAt: now,
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

    logger.info("Passkey registration verified", {
      userId: user.id,
      credentialId: credentialID,
    });

    return response;
  } catch (error) {
    logger.error(
      "Passkey registration verification failed",
      error instanceof Error ? error : undefined,
      { email }
    );

    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось завершить регистрацию Passkey. Попробуйте позже.",
      },
      { status: 500 }
    );
  }
}
