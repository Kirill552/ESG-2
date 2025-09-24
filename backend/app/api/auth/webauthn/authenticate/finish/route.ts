/**
 * WebAuthn API - Завершение аутентификации Passkey
 * Endpoint: POST /api/auth/webauthn/authenticate/finish
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { prisma } from '@/lib/prisma';
import { webAuthnStorage } from '@/lib/webauthn-storage';
import crypto from 'crypto';
import { issueNextAuthDatabaseSession } from '@/lib/nextauth-session';

export async function POST(request: NextRequest) {
  try {
    const { email, credential } = await request.json();

    if (!email || !credential) {
      return NextResponse.json(
        { error: 'Email и данные авторизации обязательны' },
        { status: 400 }
      );
    }

    console.log('[DEBUG] WebAuthn auth finish:', {
      email,
      credentialId: credential.id,
      credentialType: typeof credential.id
    });

    // Получаем сохраненный challenge из PostgreSQL
    const challengeData = await webAuthnStorage.getChallenge(email, 'authenticate');
    
    if (!challengeData) {
      return NextResponse.json(
        { error: 'Challenge истек или не найден' },
        { status: 400 }
      );
    }

    const { challenge, userId } = challengeData;

  // Находим пользователя и его WebAuthnCredentials
  const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return NextResponse.json(
        { error: 'Пользователь не найден' },
        { status: 404 }
      );
    }
    // Нормализуем credentialId с клиента
    let credentialIdStr: string = credential.id;
    if (credential.id instanceof Uint8Array || Array.isArray(credential.id)) {
      credentialIdStr = Buffer.from(credential.id).toString('base64url');
    }
    // Ищем credential в нашей таблице WebAuthnCredential
    const dbCredential = await prisma.webAuthnCredential.findFirst({
      where: { userId: user.id, credentialId: credentialIdStr }
    });
    if (!dbCredential) {
      return NextResponse.json(
        { error: 'Passkey не найден' },
        { status: 404 }
      );
    }

    // Верифицируем аутентификацию
    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: challenge,
      expectedOrigin: process.env.WEBAUTHN_ORIGIN || 'http://localhost:3000',
      expectedRPID: process.env.WEBAUTHN_RP_ID || 'localhost',
      authenticator: {
        credentialID: Buffer.from(dbCredential.credentialId, 'base64url'),
        credentialPublicKey: Buffer.from(dbCredential.publicKey),
        counter: Number(dbCredential.counter),
        transports: dbCredential.transports as any
      }
    } as any);

    console.log('[DEBUG] Verification:', {
      verified: verification.verified,
  credentialFromClient: credential.id,
  credentialFromDB: dbCredential.credentialId
    });

    if (!verification.verified) {
      return NextResponse.json(
        { error: 'Не удалось верифицировать аутентификацию' },
        { status: 400 }
      );
    }

    // Обновляем счетчик в базе данных
    if (verification.authenticationInfo) {
      const newCounter = verification.authenticationInfo.newCounter ?? (Number(dbCredential.counter) + 1);
      await prisma.webAuthnCredential.update({
        where: { id: dbCredential.id },
        data: { counter: BigInt(newCounter), updatedAt: new Date() }
      });
    }

    // Обновляем последний вход пользователя (удаляем поле lastLoginAt, так как его нет в схеме)
    await prisma.user.update({
      where: { id: user.id },
      data: { updatedAt: new Date() }
    });

    // Удаляем использованный challenge
    await webAuthnStorage.deleteChallenge(email, 'authenticate');

  // Создаем NextAuth-совместимую сессию (database strategy) и ставим корректные куки
  const response = NextResponse.json({
      success: true,
      verified: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });

  await issueNextAuthDatabaseSession(response, user.id, 30);

    return response;

  } catch (error) {
    console.error('WebAuthn authentication finish error:', error);
    return NextResponse.json(
      { error: 'Ошибка завершения аутентификации' },
      { status: 500 }
    );
  }
}
