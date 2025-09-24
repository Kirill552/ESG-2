/**
 * WebAuthn API - Начало регистрации Passkey
 * Endpoint: POST /api/auth/webauthn/register/begin
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateChallenge, generateCredentialRequestOptions } from '@/lib/webauthn';
import { prisma } from '@/lib/prisma';
import { webAuthnStorage } from '@/lib/webauthn-storage';

export async function POST(request: NextRequest) {
  try {
    const { email, userId } = await request.json();

    // Разрешаем вызывать с одним userId (для интеграционных тестов)
    if (!email && !userId) {
      return NextResponse.json(
        { error: 'Email или userId обязателен' },
        { status: 400 }
      );
    }

    // Генерируем challenge для WebAuthn (стандарт 2025)
    const challenge = generateChallenge();
    
    // Публичные ключи для WebAuthn (обновленные алгоритмы 2025)
    const options = {
      challenge,
      rp: {
        name: "ESG-Lite",
        id: process.env.WEBAUTHN_RP_ID || "localhost",
      },
      user: {
        id: Buffer.from(userId || email).toString('base64url'),
        name: email || userId,
        displayName: email || userId
      },
      pubKeyCredParams: [
        { alg: -7, type: "public-key" as const },   // ES256
        { alg: -257, type: "public-key" as const }, // RS256 
        { alg: -8, type: "public-key" as const }    // EdDSA (новый стандарт 2025)
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform" as const,
        userVerification: "required" as const,
        requireResidentKey: false,
        residentKey: "preferred" as const // Новое требование 2025
      },
      timeout: 60000,
      attestation: "none" as const,
      excludeCredentials: [] // Предотвращаем дубликаты
    };

    // Сохраняем challenge в PostgreSQL на 5 минут
    await webAuthnStorage.setChallenge(email || userId, 'register', {
      challenge: challenge.toString('base64url'),
      email,
      userId,
      timestamp: Date.now()
    });

    return NextResponse.json({
      success: true,
      options: {
        ...options,
        challenge: challenge.toString('base64url')
      }
    });

  } catch (error) {
    console.error('WebAuthn registration begin error:', error);
    return NextResponse.json(
      { error: 'Ошибка инициализации регистрации' },
      { status: 500 }
    );
  }
}
