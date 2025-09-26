import crypto from "crypto";
import { addMinutes, subMinutes } from "date-fns";
import { $Enums, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { sendTransactionalEmail } from "@/lib/email-universal";
import { Logger } from "@/lib/logger";
import { authOptions } from "@/lib/auth-options";

export class MagicLinkError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 400
  ) {
    super(message);
    this.name = "MagicLinkError";
  }
}

const logger = new Logger("magic-link-service");
const { MagicLinkDeliveryStatus } = $Enums;

const MAGIC_LINK_EXPIRATION_MINUTES = parseInt(process.env.MAGIC_LINK_EXPIRES_MINUTES || "15", 10);
const MAGIC_LINK_RATE_WINDOW_MINUTES = parseInt(process.env.MAGIC_LINK_RATE_WINDOW_MINUTES || "60", 10);
const MAGIC_LINK_MAX_EMAIL_REQUESTS = parseInt(process.env.MAGIC_LINK_MAX_EMAIL_REQUESTS || "5", 10);
const MAGIC_LINK_MAX_IP_REQUESTS = parseInt(process.env.MAGIC_LINK_MAX_IP_REQUESTS || "10", 10);
const MAGIC_LINK_RESEND_COOLDOWN_SECONDS = parseInt(process.env.MAGIC_LINK_RESEND_COOLDOWN_SECONDS || "60", 10);

const APP_BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.APP_BASE_URL ||
  process.env.APP_URL ||
  "http://localhost:3000";

const DEFAULT_REDIRECT_PATH =
  process.env.MAGIC_LINK_DEFAULT_REDIRECT ||
  process.env.POST_LOGIN_PATH ||
  "/?view=dashboard";

const sanitizeRedirect = (redirectTo?: string | null): string => {
  if (!redirectTo) {
    return DEFAULT_REDIRECT_PATH;
  }

  try {
    const trimmed = redirectTo.trim();
    if (!trimmed.startsWith("/")) {
      return DEFAULT_REDIRECT_PATH;
    }

    // Запрет на переходы в /api и внешние URL
    if (trimmed.startsWith("/api")) {
      return DEFAULT_REDIRECT_PATH;
    }

    return trimmed;
  } catch (error) {
    logger.warn("Failed to sanitize redirect", { error });
    return DEFAULT_REDIRECT_PATH;
  }
};

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const sha256 = (value: string): string =>
  crypto.createHash("sha256").update(value).digest("hex");

const generateToken = (): string => crypto.randomBytes(32).toString("base64url");

const getClientIp = (headers: Headers): string | undefined => {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const parts = forwardedFor.split(",");
    if (parts.length > 0) {
      return parts[0]?.trim();
    }
  }
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp;
  return undefined;
};

const buildEmailHtml = (link: string, expiresMinutes: number): string => `
  <!DOCTYPE html>
  <html lang="ru">
    <head>
      <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
      <title>Вход в ESG‑Lite</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f4f5; padding: 24px; }
        .container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; box-shadow: 0 24px 48px rgba(15, 23, 42, 0.08); }
        .title { font-size: 24px; font-weight: 600; color: #0f172a; margin-bottom: 16px; }
        .subtitle { color: #475569; font-size: 15px; line-height: 1.6; margin-bottom: 32px; }
        .button { display: inline-block; background: #1dc962; color: #ffffff !important; padding: 14px 24px; border-radius: 9999px; font-weight: 600; text-decoration: none; }
        .footnote { margin-top: 24px; font-size: 13px; color: #64748b; line-height: 1.6; }
        .link { word-break: break-all; color: #1dc962; }
      </style>
    </head>
    <body>
      <div class="container">
        <p class="title">Вход в ESG‑Lite</p>
        <p class="subtitle">Нажмите кнопку ниже, чтобы войти. Ссылка действует ${expiresMinutes} мин и предназначена только для одноразового использования.</p>
        <a class="button" href="${link}" target="_blank" rel="noopener">Войти в ESG‑Lite</a>
        <p class="footnote">
          или скопируйте ссылку вручную:<br />
          <span class="link">${link}</span>
        </p>
        <p class="footnote">Если вы не запрашивали вход, просто игнорируйте это письмо. Мы никогда не попросим вас пароль.</p>
      </div>
    </body>
  </html>
`;

const buildEmailText = (link: string, expiresMinutes: number): string =>
  `Вход в ESG-Lite. Ссылка действует ${expiresMinutes} минут. Перейдите по адресу: ${link}\n\nЕсли вы не запрашивали вход, проигнорируйте это письмо.`;

async function enforceRateLimits(params: { emailHash: string; requestedIp?: string }) {
  const since = subMinutes(new Date(), MAGIC_LINK_RATE_WINDOW_MINUTES);

  const [emailRequests, ipRequests, lastEmailToken] = await Promise.all([
    prisma.magicLinkToken.count({
      where: {
        emailHash: params.emailHash,
        createdAt: { gte: since },
      },
    }),
    params.requestedIp
      ? prisma.magicLinkToken.count({
          where: {
            requestedIp: params.requestedIp,
            createdAt: { gte: since },
          },
        })
      : Promise.resolve(0),
    prisma.magicLinkToken.findFirst({
      where: {
        emailHash: params.emailHash,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (emailRequests >= MAGIC_LINK_MAX_EMAIL_REQUESTS) {
    throw new MagicLinkError(
      "rate_limit_email",
      "Превышено количество запросов магической ссылки для этого email. Попробуйте позже.",
      429
    );
  }

  if (params.requestedIp && ipRequests >= MAGIC_LINK_MAX_IP_REQUESTS) {
    throw new MagicLinkError(
      "rate_limit_ip",
      "Превышено количество запросов с вашего IP адреса. Попробуйте позже.",
      429
    );
  }

  if (lastEmailToken &&
      lastEmailToken.createdAt > subMinutes(new Date(), Math.ceil(MAGIC_LINK_RESEND_COOLDOWN_SECONDS / 60)) &&
      (new Date().getTime() - lastEmailToken.createdAt.getTime()) / 1000 < MAGIC_LINK_RESEND_COOLDOWN_SECONDS) {
    throw new MagicLinkError(
      "cooldown",
      "Ссылка уже была отправлена. Проверьте почтовый ящик или запросите новую чуть позже.",
      429
    );
  }
}

export async function createMagicLinkRequest(params: {
  email: string;
  redirectTo?: string | null;
  headers: Headers;
  userAgent?: string | null;
}) {
  const emailNormalized = normalizeEmail(params.email);
  const emailHash = sha256(emailNormalized);
  const requestedIp = getClientIp(params.headers);
  const redirectTo = sanitizeRedirect(params.redirectTo);

  await enforceRateLimits({ emailHash, requestedIp });

  const token = generateToken();
  const tokenHash = sha256(token);
  const expiresAt = addMinutes(new Date(), MAGIC_LINK_EXPIRATION_MINUTES);

  const now = new Date();

  await prisma.magicLinkToken.updateMany({
    where: { emailHash, consumedAt: null },
    data: {
      consumedAt: now,
  deliveryStatus: MagicLinkDeliveryStatus.SKIPPED,
      deliveryError: "superseded",
    },
  });

  const record = await prisma.magicLinkToken.create({
    data: {
      email: emailNormalized,
      emailHash,
      tokenHash,
      redirectTo,
      requestedIp,
      userAgent: params.userAgent ?? null,
      expiresAt,
  deliveryStatus: MagicLinkDeliveryStatus.PENDING,
    },
  });

  const verifyUrl = `${APP_BASE_URL.replace(/\/$/, "")}/api/auth/magic-link/verify?token=${token}`;

  const html = buildEmailHtml(verifyUrl, MAGIC_LINK_EXPIRATION_MINUTES);
  const text = buildEmailText(verifyUrl, MAGIC_LINK_EXPIRATION_MINUTES);

  const emailResult = await sendTransactionalEmail({
    to: emailNormalized,
    subject: "Вход в ESG‑Lite",
    html: `${html}\n<!-- Plain text fallback -->\n<pre style="display:none;">${text}</pre>`,
    text,
  });

  const deliveryStatus =
    emailResult.status === "ok"
  ? MagicLinkDeliveryStatus.SENT
      : emailResult.status === "skipped"
  ? MagicLinkDeliveryStatus.SKIPPED
  : MagicLinkDeliveryStatus.FAILED;

  await prisma.magicLinkToken.update({
    where: { id: record.id },
    data: {
      deliveryStatus,
      deliveryError: emailResult.status === "error" ? String(emailResult.error ?? "unknown") : null,
    },
  });

  logger.info("Magic link email processed", {
    email: emailNormalized,
    deliveryStatus,
    messageId: emailResult.message_id,
    requestedIp,
  });

  return {
    token,
    recordId: record.id,
    deliveryStatus,
  };
}

export async function consumeMagicLinkToken(params: {
  token: string;
  headers: Headers;
}) {
  const tokenHash = sha256(params.token);
  const ip = getClientIp(params.headers);
  const userAgent = params.headers.get("user-agent") ?? undefined;
  const now = new Date();

  const tokenRecord = await prisma.magicLinkToken.findUnique({ where: { tokenHash } });

  if (!tokenRecord) {
    throw new MagicLinkError("not_found", "Ссылка для входа устарела или недействительна.", 400);
  }

  if (tokenRecord.consumedAt) {
    throw new MagicLinkError("already_used", "Эта ссылка уже была использована.", 400);
  }

  if (tokenRecord.expiresAt < now) {
    await prisma.magicLinkToken.update({
      where: { id: tokenRecord.id },
      data: {
        consumedAt: now,
  deliveryStatus: MagicLinkDeliveryStatus.SKIPPED,
        deliveryError: "expired",
      },
    });
    throw new MagicLinkError("expired", "Срок действия ссылки истёк. Запросите новую.", 410);
  }

  const sessionMaxAgeSeconds = authOptions.session?.maxAge ?? 30 * 24 * 60 * 60;
  const sessionExpires = new Date(now.getTime() + sessionMaxAgeSeconds * 1000);
  const sessionToken = crypto.randomUUID();

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const updateResult = await tx.magicLinkToken.updateMany({
      where: { id: tokenRecord.id, consumedAt: null },
      data: {
        consumedAt: now,
        consumedIp: ip,
        userAgent,
      },
    });

    if (updateResult.count === 0) {
      throw new MagicLinkError("already_used", "Эта ссылка уже была использована.", 400);
    }

    let user = await tx.user.findUnique({ where: { email: tokenRecord.email } });

    if (!user) {
      user = await tx.user.create({
        data: {
          email: tokenRecord.email,
          emailVerified: now,
          lastLoginAt: now,
        },
      });
    } else {
      user = await tx.user.update({
        where: { id: user.id },
        data: {
          emailVerified: user.emailVerified ?? now,
          lastLoginAt: now,
        },
      });
    }

    await tx.session.create({
      data: {
        sessionToken,
        userId: user.id,
        expires: sessionExpires,
      },
    });

    return { user, redirectTo: tokenRecord.redirectTo ?? "/dashboard" };
  });

  logger.info("Magic link consumed", {
    userId: result.user.id,
    email: result.user.email,
    ip,
  });

  return {
    user: result.user,
    redirectTo: sanitizeRedirect(result.redirectTo),
    sessionToken,
    sessionExpires,
  };
}
