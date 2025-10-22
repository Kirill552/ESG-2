/**
 * Конфигурация WebAuthn для администраторов
 * Использует @simplewebauthn/server для Passkey авторизации
 */

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type VerifiedRegistrationResponse,
  type VerifiedAuthenticationResponse,
} from '@simplewebauthn/server';
import { prisma } from './prisma';

// Типы для WebAuthn responses (используем any вместо импорта отдельного пакета)
type RegistrationResponseJSON = any;
type AuthenticationResponseJSON = any;

// Конфигурация WebAuthn
const RP_NAME = 'ESG-Лайт Admin';

/**
 * Получить RP ID и Origin из переменных окружения или использовать дефолтные
 */
function getWebAuthnConfig() {
  const rpId = process.env.NEXT_PUBLIC_WEBAUTHN_RP_ID || 'localhost';
  const origin = process.env.NEXT_PUBLIC_WEBAUTHN_ORIGIN || 'http://localhost:3000';

  return { rpId, origin };
}

/**
 * Начать регистрацию Passkey для администратора
 */
export async function beginAdminPasskeyRegistration(
  adminId: string,
  email: string,
  rpId?: string,
  origin?: string
) {
  const config = getWebAuthnConfig();
  const RP_ID = rpId || config.rpId;
  const ORIGIN = origin || config.origin;
  // Получаем существующие credentials администратора
  const existingCredentials = await prisma.adminWebAuthnCredential.findMany({
    where: { adminId },
  });

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: email,
    userDisplayName: email,
    attestationType: 'none',
    excludeCredentials: existingCredentials.map((cred) => ({
      id: cred.credentialId,
      type: 'public-key',
      transports: cred.transports as AuthenticatorTransport[],
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
      authenticatorAttachment: 'platform', // Предпочитаем встроенные (Touch ID, Face ID, Windows Hello)
    },
  });

  // Сохраняем challenge в БД для проверки
  await prisma.webAuthnChallenge.create({
    data: {
      email,
      challenge: options.challenge,
      type: 'REGISTRATION',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 минут
    },
  });

  return options;
}

/**
 * Завершить регистрацию Passkey для администратора
 */
export async function finishAdminPasskeyRegistration(
  adminId: string,
  email: string,
  response: RegistrationResponseJSON,
  rpId?: string,
  origin?: string
): Promise<{ verified: boolean; credential?: any }> {
  const config = getWebAuthnConfig();
  const RP_ID = rpId || config.rpId;
  const ORIGIN = origin || config.origin;

  // Получаем challenge из БД
  const challengeRecord = await prisma.webAuthnChallenge.findFirst({
    where: {
      email,
      type: 'REGISTRATION',
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!challengeRecord) {
    throw new Error('Challenge not found or expired');
  }

  // Верифицируем ответ
  let verification: VerifiedRegistrationResponse;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challengeRecord.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
    });
  } catch (error) {
    console.error('Passkey registration verification failed:', error);
    return { verified: false };
  }

  if (!verification.verified || !verification.registrationInfo) {
    return { verified: false };
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

  // Сохраняем credential в БД
  const savedCredential = await prisma.adminWebAuthnCredential.create({
    data: {
      adminId,
      credentialId: Buffer.from(credential.id).toString('base64url'),
      publicKey: Buffer.from(credential.publicKey),
      counter: credential.counter,
      transports: response.response.transports || [],
    },
  });

  // Удаляем использованный challenge
  await prisma.webAuthnChallenge.delete({
    where: { id: challengeRecord.id },
  });

  return {
    verified: true,
    credential: savedCredential,
  };
}

/**
 * Начать аутентификацию Passkey для администратора
 */
export async function beginAdminPasskeyAuthentication(
  email: string,
  rpId?: string,
  origin?: string
) {
  const config = getWebAuthnConfig();
  const RP_ID = rpId || config.rpId;

  // Находим администратора по email
  const admin = await prisma.adminUser.findUnique({
    where: { email },
    include: {
      webAuthnCredentials: true,
    },
  });

  if (!admin || !admin.isActive) {
    throw new Error('Admin not found or inactive');
  }

  if (admin.webAuthnCredentials.length === 0) {
    throw new Error('No passkeys registered for this admin');
  }

  console.log(`[WebAuthn Config] RP ID для аутентификации: ${RP_ID}`);
  console.log(`[WebAuthn Config] Найдено credentials: ${admin.webAuthnCredentials.length}`);

  const allowCredentials = admin.webAuthnCredentials.map((cred) => {
    console.log(`[WebAuthn Config] Credential ID: ${cred.credentialId}`);
    console.log(`[WebAuthn Config] Transports: ${JSON.stringify(cred.transports)}`);
    return {
      id: cred.credentialId,
      type: 'public-key' as const,
      transports: cred.transports as AuthenticatorTransport[],
    };
  });

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials, // Вернули обратно
    userVerification: 'preferred',
  });

  console.log(`[WebAuthn Config] Challenge создан: ${options.challenge}`);

  // Сохраняем challenge в БД
  await prisma.webAuthnChallenge.create({
    data: {
      email,
      challenge: options.challenge,
      type: 'AUTHENTICATION',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 минут
    },
  });

  return options;
}

/**
 * Завершить аутентификацию Passkey для администратора
 */
export async function finishAdminPasskeyAuthentication(
  email: string,
  response: AuthenticationResponseJSON,
  rpId?: string,
  origin?: string
): Promise<{ verified: boolean; admin?: any }> {
  const config = getWebAuthnConfig();
  const RP_ID = rpId || config.rpId;
  const ORIGIN = origin || config.origin;

  // Находим администратора
  const admin = await prisma.adminUser.findUnique({
    where: { email },
    include: {
      webAuthnCredentials: true,
    },
  });

  if (!admin || !admin.isActive) {
    throw new Error('Admin not found or inactive');
  }

  // Получаем challenge
  const challengeRecord = await prisma.webAuthnChallenge.findFirst({
    where: {
      email,
      type: 'AUTHENTICATION',
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!challengeRecord) {
    throw new Error('Challenge not found or expired');
  }

  // Находим credential
  // response.id уже приходит как base64url строка из @simplewebauthn/browser
  const credential = admin.webAuthnCredentials.find((c) => c.credentialId === response.id);

  if (!credential) {
    throw new Error('Credential not found');
  }

  // Верифицируем ответ
  let verification: VerifiedAuthenticationResponse;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challengeRecord.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      credential: {
        id: Buffer.from(credential.credentialId, 'base64url'),
        publicKey: credential.publicKey,
        counter: Number(credential.counter),
      },
    });
  } catch (error) {
    console.error('Passkey authentication verification failed:', error);
    return { verified: false };
  }

  if (!verification.verified) {
    return { verified: false };
  }

  // Обновляем counter для защиты от replay attacks
  await prisma.adminWebAuthnCredential.update({
    where: { id: credential.id },
    data: {
      counter: verification.authenticationInfo.newCounter,
      updatedAt: new Date(),
    },
  });

  // Удаляем использованный challenge
  await prisma.webAuthnChallenge.delete({
    where: { id: challengeRecord.id },
  });

  return {
    verified: true,
    admin: {
      id: admin.id,
      email: admin.email,
      role: admin.role,
    },
  };
}

/**
 * Получить список зарегистрированных устройств администратора
 */
export async function getAdminPasskeyDevices(adminId: string) {
  return prisma.adminWebAuthnCredential.findMany({
    where: { adminId },
    select: {
      id: true,
      credentialId: true,
      transports: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Удалить Passkey устройство администратора
 */
export async function deleteAdminPasskeyDevice(adminId: string, credentialId: string) {
  return prisma.adminWebAuthnCredential.deleteMany({
    where: {
      adminId,
      id: credentialId,
    },
  });
}
