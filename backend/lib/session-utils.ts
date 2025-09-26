import crypto from "crypto";
import type { Prisma, PrismaClient } from "@prisma/client";

import { authOptions } from "@/lib/auth-options";

export type PrismaClientOrTransaction = PrismaClient | Prisma.TransactionClient;

export const getSessionCookieConfig = () => {
  const sessionCookie = authOptions.cookies?.sessionToken;
  const name =
    sessionCookie?.name ||
    (process.env.NODE_ENV === "production"
      ? "__Secure-next-auth.session-token"
      : "next-auth.session-token");

  return {
    name,
    httpOnly: sessionCookie?.options?.httpOnly ?? true,
    sameSite: sessionCookie?.options?.sameSite ?? "lax" as const,
    secure: sessionCookie?.options?.secure ?? process.env.NODE_ENV === "production",
    path: sessionCookie?.options?.path ?? "/",
    domain: sessionCookie?.options?.domain,
    maxAge: sessionCookie?.options?.maxAge ?? authOptions.session?.maxAge ?? 30 * 24 * 60 * 60,
  } as const;
};

export const createUserSession = async (
  client: PrismaClientOrTransaction,
  userId: string
) => {
  const sessionMaxAgeSeconds = authOptions.session?.maxAge ?? 30 * 24 * 60 * 60;
  const sessionExpires = new Date(Date.now() + sessionMaxAgeSeconds * 1000);
  const sessionToken = crypto.randomUUID();

  await client.session.create({
    data: {
      sessionToken,
      userId,
      expires: sessionExpires,
    },
  });

  return { sessionToken, sessionExpires } as const;
};
