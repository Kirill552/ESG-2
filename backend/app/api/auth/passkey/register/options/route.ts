import { NextRequest, NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
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
  WEBAUTHN_RP_NAME,
  getRequestIp,
} from "@/lib/webauthn-config";

const logger = new Logger("passkey-register-options");

const requestSchema = z.object({
  email: z.string().trim().min(5, "Введите корректный email").email("Введите корректный email"),
  displayName: z.string().trim().min(1).max(120).optional(),
});

export async function POST(req: NextRequest) {
  let payload: z.infer<typeof requestSchema>;

  try {
    payload = requestSchema.parse(await req.json());
  } catch (error) {
    logger.warn("Invalid passkey registration options payload", { error });
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
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name: payload.displayName ?? null,
        },
      });
    }

    const credentials = await prisma.webAuthnCredential.findMany({
      where: { userId: user.id },
    });

    const options = await generateRegistrationOptions({
      rpName: WEBAUTHN_RP_NAME,
      rpID: WEBAUTHN_RP_ID,
      userID: Buffer.from(user.id),
      userName: user.email,
      userDisplayName: user.name ?? user.email,
      timeout: PASSKEY_TIMEOUT_MS,
      attestationType: "none",
      excludeCredentials: credentials.map((credential) => ({
        id: credential.credentialId,
        type: "public-key" as const,
        transports: credential.transports as AuthenticatorTransportFuture[] | undefined,
      })),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "required",
        authenticatorAttachment: "platform",
      },
      supportedAlgorithmIDs: [-7, -257, -35, -36],
    });

    const expiresAt = new Date(Date.now() + PASSKEY_CHALLENGE_TTL_SECONDS * 1000);

    await prisma.$transaction(async (tx) => {
      await tx.webAuthnChallenge.deleteMany({
        where: {
          userId: user.id,
          type: $Enums.WebAuthnChallengeType.REGISTRATION,
        },
      });

      await tx.webAuthnChallenge.create({
        data: {
          userId: user.id,
          email: user.email,
          challenge: options.challenge,
          type: $Enums.WebAuthnChallengeType.REGISTRATION,
          data: {
            userId: user.id,
          },
          expiresAt,
          ipAddress: getRequestIp(req.headers),
          userAgent: req.headers.get("user-agent"),
        },
      });
    });

    logger.info("Issued passkey registration options", {
      userId: user.id,
    });

    return NextResponse.json({
      ok: true,
      options,
    });
  } catch (error) {
    logger.error(
      "Passkey registration options failed",
      error instanceof Error ? error : undefined,
      {
        email,
      }
    );

    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось подготовить регистрацию Passkey. Попробуйте позже.",
      },
      { status: 500 }
    );
  }
}
