/**
 * WebAuthn API - Завершение регистрации Passkey
 * Endpoint: POST /api/auth/webauthn/register/finish
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { prisma } from '@/lib/prisma';
import { webAuthnStorage } from '@/lib/webauthn-storage';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

export async function POST(request: NextRequest) {
  try {
    const { email, credential } = await request.json();

    if (!email || !credential) {
      return NextResponse.json(
        { error: 'Email и данные авторизации обязательны' },
        { status: 400 }
      );
    }

    // Получаем сохраненный challenge
    const challengeData = await webAuthnStorage.getChallenge(email, 'register');
    
    if (!challengeData) {
      return NextResponse.json(
        { error: 'Challenge истек или не найден' },
        { status: 400 }
      );
    }

    const { challenge, userId } = challengeData;

    // Верифицируем регистрацию через simplewebauthn
    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: challenge,
      expectedOrigin: process.env.WEBAUTHN_ORIGIN || 'http://localhost:3000',
      expectedRPID: process.env.WEBAUTHN_RP_ID || 'localhost'
    } as any);

    if (!verification.verified) {
      return NextResponse.json(
        { error: 'Не удалось верифицировать регистрацию' },
        { status: 400 }
      );
    }

    // Найдем или создадим пользователя
    let user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name: email.split('@')[0],
          emailVerified: new Date()
        }
      });
    }

    // Сохраняем Passkey в таблице WebAuthnCredential
    if (verification.registrationInfo) {
      const transports = determineTransports(credential);
      const credId = Buffer.isBuffer(verification.registrationInfo.credentialID)
        ? (verification.registrationInfo.credentialID as Buffer).toString('base64url')
        : String(verification.registrationInfo.credentialID);
      const publicKeyBytes = Buffer.from(verification.registrationInfo.credentialPublicKey as any);

      await prisma.webAuthnCredential.create({
        data: {
          userId: user.id,
          credentialId: credId,
          publicKey: publicKeyBytes,
          counter: BigInt(verification.registrationInfo.counter ?? 0),
          transports,
        }
      });
    }

    // Удаляем использованный challenge
    await webAuthnStorage.deleteChallenge(email, 'register');

    return NextResponse.json({
      success: true,
      verified: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });

  } catch (error) {
    console.error('WebAuthn registration finish error:', error);
    return NextResponse.json(
      { error: 'Ошибка завершения регистрации' },
      { status: 500 }
    );
  }
}

// Определяем транспорты на основе User Agent и других данных
function determineTransports(credential: any): string[] {
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  
  // По умолчанию предполагаем внутренний аутентификатор
  const transports = ['internal'];
  
  // Если устройство поддерживает hybrid - добавляем
  // (современные устройства поддерживают cross-device аутентификацию)
  if (userAgent.includes('Chrome') || userAgent.includes('Edge')) {
    transports.push('hybrid');
  }
  
  // Если credential содержит информацию о транспортах - используем её
  if (credential.response?.transports) {
    return credential.response.transports;
  }
  
  return transports;
}
