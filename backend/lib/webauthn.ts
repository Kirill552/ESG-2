/**
 * WebAuthn вспомогательные функции для работы с Passkeys
 * Поддержка Face ID, Touch ID, Windows Hello
 */

import crypto from 'crypto';

// Генерация случайного challenge для WebAuthn
export function generateChallenge(): Buffer {
  return crypto.randomBytes(32);
}

// Базовые опции для создания Passkey
export function generateCredentialRequestOptions(user: {
  id: string;
  name: string;
  displayName: string;
}, challenge: Buffer) {
  return {
    challenge,
    rp: {
      name: "ESG-Lite",
      id: process.env.WEBAUTHN_RP_ID || "localhost",
    },
    user: {
      id: Buffer.from(user.id),
      name: user.name,
      displayName: user.displayName
    },
    pubKeyCredParams: [
      { alg: -7, type: "public-key" as const },   // ES256 (рекомендуется)
      { alg: -257, type: "public-key" as const }, // RS256
      { alg: -35, type: "public-key" as const },  // ES384
      { alg: -36, type: "public-key" as const },  // ES512
    ],
    authenticatorSelection: {
      authenticatorAttachment: "platform" as const, // Только встроенные (Touch ID, Face ID, Windows Hello)
      userVerification: "required" as const,
      requireResidentKey: false,
      residentKey: "preferred" as const
    },
    timeout: 60000,
    attestation: "none" as const,
    extensions: {
      credProps: true,
      largeBlob: {
        support: "preferred"
      }
    }
  };
}

// Опции для аутентификации через Passkey
export function generateAuthenticationOptions(challenge: Buffer, allowCredentials?: Array<{
  id: string;
  type: "public-key";
  transports?: AuthenticatorTransport[];
}>) {
  return {
    challenge,
    timeout: 60000,
    userVerification: "required" as const,
    allowCredentials: allowCredentials || [],
    extensions: {
      largeBlob: {
        read: true
      }
    }
  };
}

// Упрощенная верификация регистрации
export async function verifyRegistrationResponse({
  credential,
  expectedChallenge,
  expectedOrigin,
  expectedRPID
}: {
  credential: any;
  expectedChallenge: string;
  expectedOrigin: string;
  expectedRPID: string;
}) {
  try {
    // Базовая верификация без внешних библиотек
    const { response } = credential;
    const clientDataJSON = JSON.parse(Buffer.from(response.clientDataJSON, 'base64url').toString());
    
    // Проверяем основные поля
    if (clientDataJSON.type !== 'webauthn.create') {
      throw new Error('Invalid ceremony type');
    }
    
    if (clientDataJSON.challenge !== expectedChallenge) {
      throw new Error('Challenge mismatch');
    }
    
    if (!clientDataJSON.origin.includes(expectedRPID)) {
      throw new Error('Origin mismatch');
    }

    // Парсим attestationObject
    const attestationObject = Buffer.from(response.attestationObject, 'base64url');
    
    return {
      verified: true,
      registrationInfo: {
        credentialID: Buffer.from(credential.id, 'base64url').toString('base64'),
        credentialPublicKey: attestationObject.slice(0, 64), // Упрощенное извлечение
        counter: 0,
        credentialDeviceType: 'platform',
        credentialBackedUp: false,
        origin: clientDataJSON.origin
      }
    };
  } catch (error) {
    console.error('Registration verification failed:', error);
    return {
      verified: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Упрощенная верификация аутентификации
export async function verifyAuthenticationResponse({
  credential,
  expectedChallenge,
  expectedOrigin,
  expectedRPID,
  authenticator
}: {
  credential: any;
  expectedChallenge: string;
  expectedOrigin: string;
  expectedRPID: string;
  authenticator: {
    credentialID: Buffer;
    credentialPublicKey: Buffer;
    counter: number;
    transports?: string[];
  };
}) {
  try {
    const { response } = credential;
    const clientDataJSON = JSON.parse(Buffer.from(response.clientDataJSON, 'base64url').toString());
    
    // Проверяем основные поля
    if (clientDataJSON.type !== 'webauthn.get') {
      throw new Error('Invalid ceremony type');
    }
    
    if (clientDataJSON.challenge !== expectedChallenge) {
      throw new Error('Challenge mismatch');
    }
    
    if (!clientDataJSON.origin.includes(expectedRPID)) {
      throw new Error('Origin mismatch');
    }

    // Проверяем credentialID
    const receivedCredentialID = Buffer.from(credential.id, 'base64url').toString('base64');
    const expectedCredentialID = authenticator.credentialID.toString('base64');
    
    if (receivedCredentialID !== expectedCredentialID) {
      throw new Error('Credential ID mismatch');
    }

    return {
      verified: true,
      authenticationInfo: {
        newCounter: authenticator.counter + 1,
        credentialID: receivedCredentialID
      }
    };
  } catch (error) {
    console.error('Authentication verification failed:', error);
    return {
      verified: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Проверка поддержки WebAuthn в браузере
export function isWebAuthnSupported(): boolean {
  return typeof window !== 'undefined' && 
         'navigator' in window && 
         'credentials' in navigator &&
         'create' in navigator.credentials &&
         'get' in navigator.credentials;
}

// Проверка поддержки платформенных аутентификаторов (Face ID, Touch ID, Windows Hello)
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/**
 * Валидация структуры WebAuthn credential
 */
export function validateWebAuthnCredential(credential: any): boolean {
  if (!credential || typeof credential !== 'object') {
    return false;
  }

  // Проверяем обязательные поля
  if (!credential.credentialId || typeof credential.credentialId !== 'string' || credential.credentialId.trim() === '') {
    return false;
  }

  if (!credential.publicKey || !Buffer.isBuffer(credential.publicKey)) {
    return false;
  }

  if (typeof credential.counter !== 'number' || credential.counter < 0) {
    return false;
  }

  // Проверяем транспорты, если они указаны
  if (credential.transports) {
    if (!Array.isArray(credential.transports) || credential.transports.length === 0) {
      return false;
    }

    const validTransports = ['usb', 'nfc', 'ble', 'internal'];
    const hasValidTransport = credential.transports.some((transport: string) => 
      validTransports.includes(transport)
    );

    if (!hasValidTransport) {
      return false;
    }
  }

  return true;
}

/**
 * Форматирование опций WebAuthn для клиента
 */
export function formatWebAuthnOptions(serverOptions: any): any {
  if (!serverOptions) {
    throw new Error('Server options are required');
  }

  const clientOptions = { ...serverOptions };

  // Преобразуем Buffer challenge в base64 строку для клиента
  if (Buffer.isBuffer(serverOptions.challenge)) {
    clientOptions.challenge = serverOptions.challenge.toString('base64');
  }

  // Преобразуем user.id из Buffer в строку, если необходимо
  if (serverOptions.user && Buffer.isBuffer(serverOptions.user.id)) {
    clientOptions.user = {
      ...serverOptions.user,
      id: serverOptions.user.id.toString('base64')
    };
  }

  // Проверяем наличие обязательных полей
  if (!clientOptions.rp || !clientOptions.rp.name) {
    throw new Error('RP name is required');
  }

  if (!clientOptions.user || !clientOptions.user.name) {
    throw new Error('User name is required');
  }

  return clientOptions;
}

// Определение типа устройства для лучшего UX
export function getDeviceType(): 'ios' | 'android' | 'windows' | 'mac' | 'unknown' {
  if (typeof window === 'undefined') return 'unknown';
  
  const userAgent = window.navigator.userAgent.toLowerCase();
  
  if (/iphone|ipad|ipod/.test(userAgent)) return 'ios';
  if (/android/.test(userAgent)) return 'android';
  if (/windows/.test(userAgent)) return 'windows';
  if (/mac/.test(userAgent)) return 'mac';
  
  return 'unknown';
}

// Получение подходящего сообщения для конкретного устройства
export function getBiometricPromptMessage(): string {
  const deviceType = getDeviceType();
  
  switch (deviceType) {
    case 'ios':
      return 'Используйте Face ID или Touch ID для входа';
    case 'android':
      return 'Используйте отпечаток пальца или распознавание лица';
    case 'windows':
      return 'Используйте Windows Hello для входа';
    case 'mac':
      return 'Используйте Touch ID для входа';
    default:
      return 'Используйте биометрию для входа';
  }
}

// Конвертация base64url в ArrayBuffer (стандарт WebAuthn 2025)
export function base64urlToArrayBuffer(base64url: string): ArrayBuffer {
  // Обеспечиваем что base64url это строка и обрабатываем null/undefined
  if (!base64url || typeof base64url !== 'string') {
    throw new Error('Invalid base64url input');
  }
  
  try {
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const paddedBase64 = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
    const binaryString = atob(paddedBase64);
    const arrayBuffer = new ArrayBuffer(binaryString.length);
    const view = new Uint8Array(arrayBuffer);
    
    for (let i = 0; i < binaryString.length; i++) {
      view[i] = binaryString.charCodeAt(i);
    }
    
    return arrayBuffer;
  } catch (error) {
    console.error('WebAuthn base64url decode error:', error);
    throw new Error('Failed to decode base64url for WebAuthn');
  }
}

// Конвертация ArrayBuffer в base64url
export function arrayBufferToBase64url(arrayBuffer: ArrayBuffer): string {
  const view = new Uint8Array(arrayBuffer);
  let binaryString = '';
  
  for (let i = 0; i < view.length; i++) {
    binaryString += String.fromCharCode(view[i]);
  }
  
  const base64 = btoa(binaryString);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
