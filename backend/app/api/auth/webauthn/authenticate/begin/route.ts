/**
 * WebAuthn API - Начало аутентификации Passkey
 * Endpoint: POST /api/auth/webauthn/authenticate/begin
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { webAuthnStorage } from '@/lib/webauthn-storage';
import { generateAuthenticationOptions } from '@simplewebauthn/server';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email обязателен' },
        { status: 400 }
      );
    }

    // Находим пользователя и его WebAuthnCredentials (а не NextAuth accounts)
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json(
        { error: 'Пользователь не найден' },
        { status: 404 }
      );
    }

    const credentials = await prisma.webAuthnCredential.findMany({
      where: { userId: user.id }
    });

    if (!credentials || credentials.length === 0) {
      return NextResponse.json(
        { error: 'Passkey не найден для этого пользователя' },
        { status: 404 }
      );
    }

    const rpID = process.env.WEBAUTHN_RP_ID || 'localhost';
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: 'required',
      allowCredentials: credentials.map((c) => ({
        id: c.credentialId,
        type: 'public-key' as const,
        transports: (c.transports || []).map(t => t as any)
      }))
    });

    // Сохраняем challenge в PostgreSQL
    await webAuthnStorage.setChallenge(email, 'authenticate', {
      challenge: options.challenge,
      email,
      userId: user.id,
      timestamp: Date.now()
    });

    return NextResponse.json({ success: true, options });

  } catch (error) {
    console.error('WebAuthn authentication begin error:', error);
    return NextResponse.json(
      { error: 'Ошибка инициализации аутентификации' },
      { status: 500 }
    );
  }
}
