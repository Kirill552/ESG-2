import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserFromSession } from "@/lib/auth-user";
import { hashBackupCode } from "@/lib/backup-codes";

export async function POST(req: NextRequest) {
  try {
    const { code } = (await req.json().catch(() => ({}))) as { code?: string };
    if (!code) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

    const { user, error } = await getCurrentUserFromSession();
    if (error || !user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const codeHash = hashBackupCode(user.id, code);

    const found = await (prisma as any).backupCode.findFirst({ where: { userId: user.id, codeHash, used: false } });
    if (!found) return NextResponse.json({ error: "invalid_code" }, { status: 400 });

  await (prisma as any).backupCode.update({ where: { id: found.id }, data: { used: true } });
  const res = NextResponse.json({ ok: true });
  const isProd = process.env.NODE_ENV === "production";
  res.cookies.set("mfa", "verified", { path: "/", sameSite: "lax", secure: isProd });
  return res;
  } catch {
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
