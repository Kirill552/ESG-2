import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticator } from "otplib";
import { getCurrentUserFromSession } from "@/lib/auth-user";

export async function POST(req: NextRequest) {
  try {
    const { code } = (await req.json().catch(() => ({}))) as { code?: string };
    if (!code) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

    const { user, error } = await getCurrentUserFromSession();
    if (error || !user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (!user.totpSecret) return NextResponse.json({ error: "totp_not_enabled" }, { status: 400 });

    const isValid = authenticator.check(code, user.totpSecret);
    if (!isValid) return NextResponse.json({ error: "invalid_code" }, { status: 400 });

  await (prisma as any).user.update({ where: { id: user.id }, data: { totpSecret: null } });
  const res = NextResponse.json({ ok: true });
  const isProd = process.env.NODE_ENV === "production";
  res.cookies.set("mfa", "verified", { path: "/", sameSite: "lax", secure: isProd });
  return res;
  } catch {
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
