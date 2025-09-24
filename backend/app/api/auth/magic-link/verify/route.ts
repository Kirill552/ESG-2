import { NextRequest, NextResponse } from "next/server";
import { issueNextAuthDatabaseSession } from "@/lib/nextauth-session";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    const next = searchParams.get("next");
    if (!token) return NextResponse.json({ error: "token_required" }, { status: 400 });

    const vt = await prisma.verificationToken.findUnique({ where: { token } });
    if (!vt) return NextResponse.json({ error: "invalid_token" }, { status: 400 });
    if (vt.expires < new Date()) return NextResponse.json({ error: "token_expired" }, { status: 400 });

    // Два сценария: обычный вход по email (identifier = email) или линковка VKID (identifier = link-vkid:<providerId>:<email>)
    let userId: string | null = null;
    const identifier = vt.identifier;
    if (/^link-vkid:/.test(identifier)) {
      const parts = identifier.split(":");
      // [ 'link-vkid', providerAccountId, email ]
      const providerAccountId = parts[1];
      const email = (parts.slice(2).join(":") || "").toLowerCase();
      if (!providerAccountId || !email) {
        return NextResponse.json({ error: "invalid_link_identifier" }, { status: 400 });
      }
      const user = await (prisma as any).user.upsert({
        where: { email },
        update: {},
        create: { email },
      });
      userId = user.id;
      const existing = await (prisma as any).account.findUnique({
        where: { provider_providerAccountId: { provider: "vkid", providerAccountId } },
      });
      if (existing) {
        if (existing.userId !== user.id) {
          return NextResponse.json({ error: "provider_already_linked" }, { status: 400 });
        }
        // уже привязан к этому пользователю — ничего не делаем
      } else {
        await (prisma as any).account.create({
          data: {
            userId: user.id,
            type: "oauth",
            provider: "vkid",
            providerAccountId,
          },
        });
      }
    } else {
      const email = identifier.toLowerCase();
      const user = await (prisma as any).user.upsert({
        where: { email },
        update: {},
        create: { email },
      });
      userId = user.id;
    }
    if (!userId) {
      return NextResponse.json({ error: "user_not_resolved" }, { status: 400 });
    }
    
    // Устанавливаем сессию
    const resp = NextResponse.redirect(new URL(next || "/dashboard", req.url));
    await issueNextAuthDatabaseSession(resp, userId);

    // Автоматически создаем организацию и пробный план для нового пользователя
    try {
      // Проверяем, есть ли уже организация
      let organization = await (prisma as any).organization.findFirst({ where: { userId: userId } });
      
      if (!organization) {
        // Создаем организацию
        const userEmail = identifier.includes(':') ? identifier.split(':').pop() : identifier;
        organization = await (prisma as any).organization.create({
          data: {
            userId: userId,
            name: userEmail ? `Организация ${userEmail}` : 'Новая организация',
            email: userEmail || ''
          }
        });
        
        // Создаем пробный план на 14 дней
        const trialExpires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
        await (prisma as any).organization_subscriptions.create({
          data: {
            organizationId: organization.id,
            plan_type: 'TRIAL',
            status: 'ACTIVE',
            starts_at: new Date(),
            expires_at: trialExpires
          }
        });
      }
    } catch (error) {
      // Не прерываем процесс авторизации из-за этой ошибки
    }

    // Удаляем использованный токен
    await prisma.verificationToken.delete({ where: { token } });
    
    return resp;
  } catch (error) {
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}


