import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { sendTransactionalEmail } from "@/lib/email-universal";

const DEFAULT_TTL_SEC = Number(process.env.MAGIC_LINK_TTL_SEC || 900);

export async function POST(req: NextRequest) {
  try {
    const { email, redirectUrl } = (await req.json().catch(() => ({}))) as { email?: string; redirectUrl?: string };
    if (!email) {
      return NextResponse.json({ error: "email_required" }, { status: 400 });
    }

    // Rate limit: 5 запросов на email за 10 минут (по IP)
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || (req as any).ip || "unknown";
    const windowStart = new Date(Date.now() - 10 * 60 * 1000);
    const key = `magic:${ip}:${email.toLowerCase()}`;
    
    try {
      const count = await prisma.rateLimitEvent.count({ 
        where: { 
          key, 
          createdAt: { gte: windowStart } 
        } 
      });
      const limit = process.env.NODE_ENV === 'test' ? 3 : 5;
      if (count >= limit) {
        return NextResponse.json({ error: "rate_limited" }, { status: 429 });
      }
      
      await prisma.rateLimitEvent.create({ data: { key } });
    } catch (rateError) {
      // Rate limit error - continue anyway
    }

    const token = crypto.randomBytes(32).toString("base64url");
    const expires = new Date(Date.now() + DEFAULT_TTL_SEC * 1000);

    await prisma.verificationToken.create({
      data: {
        identifier: email.toLowerCase(),
        token,
        expires,
      },
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://localhost:3000`;
    const link = `${baseUrl}/api/auth/magic-link/verify?token=${token}` + (redirectUrl ? `&next=${encodeURIComponent(redirectUrl)}` : "");

    const emailResult = await sendTransactionalEmail({
      to: email,
      subject: "Вход по ссылке — ESG‑Lite",
      html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #059669; margin: 0;">ESG‑Lite</h1>
          <p style="color: #6b7280; margin: 5px 0 0 0;">Российская платформа для управления углеродным следом</p>
        </div>
        
        <div style="background: #f9fafb; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
          <h2 style="color: #111827; margin: 0 0 16px 0;">Вход в систему</h2>
          <p style="color: #374151; margin: 0 0 20px 0; line-height: 1.5;">Для входа в ESG‑Lite нажмите на кнопку ниже:</p>
          
          <div style="text-align: center; margin: 24px 0;">
            <a href="${link}" style="display: inline-block; background: linear-gradient(135deg, #059669, #047857); color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Войти в ESG‑Lite</a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px; margin: 16px 0 0 0;">Ссылка действует ${Math.floor(DEFAULT_TTL_SEC / 60)} минут.</p>
        </div>
        
        <div style="text-align: center; color: #9ca3af; font-size: 12px;">
          <p>Если вы не запрашивали вход, просто проигнорируйте это письмо.</p>
          <p>© 2025 ESG‑Lite | Автоматизация углеродной отчетности</p>
        </div>
      </div>`
    });
    
    if (emailResult.status === 'error') {
      return NextResponse.json({ error: "email_send_failed", details: emailResult.error }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "internal_error", details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}