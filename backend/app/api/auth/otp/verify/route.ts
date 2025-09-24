import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hashOtpCode, normalizePhone } from "@/lib/otp";
import { issueNextAuthDatabaseSession } from "@/lib/nextauth-session";

export async function POST(req: NextRequest) {
  try {
    const { phone, code, purpose } = (await req.json().catch(() => ({}))) as { phone?: string; code?: string; purpose?: string };
    if (!phone || !code) return NextResponse.json({ error: "phone_and_code_required" }, { status: 400 });
    
    // Нормализуем телефон
    const normalizedContact = normalizePhone(phone);
    
    const codeHash = hashOtpCode(normalizedContact, code, purpose || "login");

    const found = await prisma.otpCode.findFirst({
      where: { contact: normalizedContact, codeHash },
      orderBy: { createdAt: "desc" },
    });
    if (!found) return NextResponse.json({ error: "invalid_code" }, { status: 400 });
    if (found.expiresAt < new Date()) return NextResponse.json({ error: "expired_code" }, { status: 400 });

    // Создаём/находим пользователя по синтетическому email на основе телефона
    const syntheticEmail = `phone-${normalizedContact.replace(/\D+/g, "")}@auth.local`;
    
    const user = await (prisma as any).user.upsert({
      where: { email: syntheticEmail },
      update: {},
      create: { email: syntheticEmail },
    });
    const resp = NextResponse.json({ ok: true });
    await issueNextAuthDatabaseSession(resp, (user as any).id);

    // Удаляем использованный код
    await prisma.otpCode.delete({ where: { id: found.id } });
    return resp;
  } catch (error) {
    console.error('OTP verify error:', error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}


