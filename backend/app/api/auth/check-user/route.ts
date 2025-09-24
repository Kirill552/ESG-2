/**
 * API для проверки существования пользователя и доступных методов авторизации
 * Endpoint: POST /api/auth/check-user
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    
    if (!email) {
      return NextResponse.json({ error: "email_required" }, { status: 400 });
    }

    // Проверяем существует ли пользователь с таким email
    const normalizedEmail = email.toLowerCase().trim();
    
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { 
        id: true, 
        email: true,
        hashedPassword: true, // проверяем есть ли пароль у пользователя
        accounts: {
          select: {
            provider: true
          }
        },
        webAuthnCredentials: {
          select: { id: true },
          take: 1
        }
      }
    });
    
    if (!user) {
      return NextResponse.json({ 
        exists: false,
        authMethods: ['magic-link', 'vk-id', 'passkeys-register']
      });
    }

    // Определяем доступные методы авторизации
    const authMethods: string[] = [];
    let hasPassword = false;
  let hasPasskeys = false;
    let hasVkId = false;

    // Проверяем есть ли пароль у пользователя
    hasPassword = !!user.hashedPassword;

    // Проверяем какие методы авторизации настроены
    for (const account of user.accounts) {
      if (account.provider === 'vkid') {
        hasVkId = true;
      }
    }

    // Наличие Passkeys определяем по таблице webauthn_credentials (а не по accounts)
    hasPasskeys = (user.webAuthnCredentials && user.webAuthnCredentials.length > 0);

    // Формируем список доступных методов
    if (hasPassword) {
      authMethods.push('password'); // основной для пользователей с паролем
      authMethods.push('magic-link');
    } else {
      authMethods.push('magic-link'); // основной для пользователей без пароля
    }

    if (hasPasskeys) {
      authMethods.push('passkeys');
    } else {
      authMethods.push('passkeys-register'); // можно настроить
    }

    if (!hasVkId) {
      authMethods.push('vk-id'); // можно привязать
    }

    return NextResponse.json({ 
      exists: true,
      authMethods,
      hasPassword,
      hasPasskeys,
      hasVkId
    });
  } catch (error) {
    console.error('Check user error:', error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
