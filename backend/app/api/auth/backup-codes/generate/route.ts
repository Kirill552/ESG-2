import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserFromSession } from "@/lib/auth-user";
import { generateBackupCodes, hashBackupCode } from "@/lib/backup-codes";

export async function POST(req: NextRequest) {
  try {
    const { user, error } = await getCurrentUserFromSession();
    if (error || !user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    // Нужна включенная TOTP
    if (!user.totpSecret) return NextResponse.json({ error: "totp_not_enabled" }, { status: 400 });

    const codes = generateBackupCodes(10);
    const hashes = codes.map((c) => ({ userId: user.id, codeHash: hashBackupCode(user.id, c) }));

    // Удалим старые неиспользованные и создадим новые
    await (prisma as any).backupCode.deleteMany({ where: { userId: user.id, used: false } });
    await (prisma as any).backupCode.createMany({ data: hashes });

    return NextResponse.json({ codes }); // отдаём в ответ для показа/сохранения пользователю
  } catch {
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
