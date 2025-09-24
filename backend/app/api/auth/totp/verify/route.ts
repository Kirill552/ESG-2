import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticator } from "otplib";
import { getCurrentUserFromSession } from "@/lib/auth-user";

export async function POST(req: NextRequest) {
  try {
    const { secret, code } = (await req.json().catch(() => ({}))) as { secret?: string; code?: string };
    if (!secret || !code) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

    const { user, error } = await getCurrentUserFromSession();
    if (error || !user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const isValid = authenticator.check(code, secret);
    if (!isValid) return NextResponse.json({ error: "invalid_code" }, { status: 400 });

  await (prisma as any).user.update({ where: { id: user.id }, data: { totpSecret: secret } });
    const res = NextResponse.json({ ok: true });
    const isProd = process.env.NODE_ENV === "production";
    res.cookies.set("mfa", "verified", {
      path: "/",
      sameSite: "lax",
      secure: isProd,
    });
    return res;
  } catch (e) {
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
