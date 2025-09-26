import { NextRequest, NextResponse } from "next/server";

import { consumeMagicLinkToken, MagicLinkError } from "@/lib/magic-link-service";
import { Logger } from "@/lib/logger";
import { getSessionCookieConfig } from "@/lib/session-utils";

const logger = new Logger("magic-link-verify");

const resolveBaseUrl = (req: NextRequest): URL => {
  const explicitBase =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_BASE_URL ||
    process.env.APP_URL ||
    process.env.NEXTAUTH_URL;

  if (explicitBase) {
    try {
      return new URL(explicitBase);
    } catch (error) {
      // Падаем обратно на origin из запроса, если env некорректен
    }
  }

  return new URL(req.nextUrl.origin);
};

const buildRedirectResponse = (req: NextRequest, targetPath: string) => {
  const baseUrl = resolveBaseUrl(req);
  const url = targetPath.startsWith("http")
    ? new URL(targetPath)
    : new URL(targetPath, baseUrl);
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "no-store");
  return response;
};

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    logger.warn("Magic link verification without token", {});
    return buildRedirectResponse(req, "/sign-in?error=magic-link-missing-token");
  }

  try {
    const result = await consumeMagicLinkToken({ token, headers: req.headers });

    const cookieConfig = getSessionCookieConfig();
    const response = buildRedirectResponse(req, result.redirectTo);

    response.cookies.set(cookieConfig.name, result.sessionToken, {
      httpOnly: cookieConfig.httpOnly,
      sameSite: cookieConfig.sameSite,
      secure: cookieConfig.secure,
      path: cookieConfig.path,
      domain: cookieConfig.domain,
      maxAge: cookieConfig.maxAge,
      expires: result.sessionExpires,
    });

    return response;
  } catch (error) {
    if (error instanceof MagicLinkError) {
      logger.warn("Magic link verification failed", { code: error.code });
      return buildRedirectResponse(req, `/sign-in?error=magic-link-${error.code}`);
    }

    logger.error(
      "Unexpected magic link verification error",
      error instanceof Error ? error : undefined
    );
    return buildRedirectResponse(req, "/sign-in?error=magic-link-unexpected");
  }
}
