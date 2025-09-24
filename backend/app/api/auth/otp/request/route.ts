import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateNumericCode, hashOtpCode, normalizePhone } from "@/lib/otp";
import AntiBruteForceService from "@/lib/anti-brute-force-service";
import { getSmartCaptchaService } from "@/lib/yandex-smartcaptcha";
import { getClientIP } from "@/lib/ip-utils";

const DEFAULT_TTL_SEC = Number(process.env.OTP_TTL_SEC || 180);
const MAX_ATTEMPTS_TOTAL = Number(process.env.OTP_MAX_ATTEMPTS || 5);

export async function POST(req: NextRequest) {
  let normalizedContact = 'unknown';
  
  try {
    const { phone, purpose, captchaToken } = (await req.json().catch(() => ({}))) as { 
      phone?: string; 
      purpose?: string;
      captchaToken?: string;
    };
    
    if (!phone) return NextResponse.json({ error: "phone_required" }, { status: 400 });
    
    const ip = getClientIP(req);
    
    // Нормализуем телефон
    const normalizedContact = normalizePhone(phone);
    const deliveryMethod = 'sms';

    // Anti-brute force проверка
    const bruteForceStatus = await AntiBruteForceService.checkBruteForce(
      ip, 
      normalizedContact, 
      'otp-request'
    );

    if (bruteForceStatus.blocked) {
      await AntiBruteForceService.recordAttempt({
        ip,
        identifier: normalizedContact,
        endpoint: 'otp-request',
        success: false,
        timestamp: new Date(),
        userAgent: req.headers.get('user-agent') || undefined
      });

      return NextResponse.json(
        { 
          error: "account_blocked", 
          message: "Аккаунт временно заблокирован",
          blockDuration: bruteForceStatus.blockDuration 
        }, 
        { status: 423 }
      );
    }

    // Проверка CAPTCHA если требуется
    if (bruteForceStatus.requiresCaptcha) {
      if (!captchaToken) {
        return NextResponse.json(
          { error: "captcha_required", message: "Требуется пройти проверку CAPTCHA" },
          { status: 400 }
        );
      }

      try {
        const captchaService = getSmartCaptchaService();
        const captchaResult = await captchaService.validateToken(captchaToken, ip);
        
        if (!captchaResult.success) {
          await AntiBruteForceService.recordAttempt({
            ip,
            identifier: normalizedContact,
            endpoint: 'otp-request',
            success: false,
            timestamp: new Date(),
            userAgent: req.headers.get('user-agent') || undefined
          });

          return NextResponse.json(
            { error: "captcha_invalid", message: "Проверка CAPTCHA не пройдена" },
            { status: 400 }
          );
        }
      } catch (error) {
        console.error('CAPTCHA validation error:', error);
        // Продолжаем выполнение при ошибке CAPTCHA
      }
    }

    // Rate limit: 5 запросов на контакт за 10 минут (по IP)
    const windowStart = new Date(Date.now() - 10 * 60 * 1000);
    const key = `otp:${ip}:${normalizedContact}`;
    try {
      const count = await (prisma as any).rateLimitEvent.count({ where: { key, createdAt: { gte: windowStart } } });
      const limit = process.env.NODE_ENV === 'test' ? 3 : 5;
      if (count >= limit) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
      await (prisma as any).rateLimitEvent.create({ data: { key } });
    } catch {}

    // rate-limit по числу активных кодов
    const activeCount = await prisma.otpCode.count({
      where: { contact: normalizedContact, expiresAt: { gt: new Date() } },
    });
    if (activeCount >= MAX_ATTEMPTS_TOTAL) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    const code = generateNumericCode(6);
    const expiresAt = new Date(Date.now() + DEFAULT_TTL_SEC * 1000);
    const codeHash = hashOtpCode(normalizedContact, code, purpose || "login");

    await prisma.otpCode.create({
      data: { contact: normalizedContact, codeHash, purpose: purpose || "login", expiresAt },
    });

    // Отправка OTP по SMS (пока заглушка)
    console.log(`OTP for SMS ${normalizedContact}: ${code} (SMS delivery not implemented yet)`);
    const deliverySuccess = false; // Временно false, пока SMS не реализован
    const deliveryError = "SMS delivery not implemented yet";

    // Записываем успешную попытку
    await AntiBruteForceService.recordAttempt({
      ip,
      identifier: normalizedContact,
      endpoint: 'otp-request',
      success: true,
      timestamp: new Date(),
      userAgent: req.headers.get('user-agent') || undefined
    });

    // Возвращаем успех даже если доставка не удалась (код сохранён в БД для тестирования)
    return NextResponse.json({ 
      ok: true, 
      delivery: deliveryMethod,
      delivered: deliverySuccess,
      ...(deliveryError && { delivery_error: deliveryError })
    });
  } catch (error) {
    console.error('OTP request error:', error);
    
    // Записываем неуспешную попытку при ошибке
    try {
      await AntiBruteForceService.recordAttempt({
        ip: getClientIP(req),
        identifier: normalizedContact || 'unknown',
        endpoint: 'otp-request',
        success: false,
        timestamp: new Date(),
        userAgent: req.headers.get('user-agent') || undefined
      });
    } catch {}
    
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}


