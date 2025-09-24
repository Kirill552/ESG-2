/**
 * API для получения списка Passkeys пользователя
 * GET /api/auth/webauthn/list
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Проверяем авторизацию
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Не авторизован' },
        { status: 401 }
      );
    }

    // Получаем все WebAuthn Passkeys пользователя из нашей таблицы webauthn_credentials
    const credentials = await prisma.webAuthnCredential.findMany({
      where: {
        userId: session.user.id
      },
      select: {
        id: true,
        credentialId: true,
        transports: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Преобразуем данные в формат для фронтенда
    const passkeys = credentials.map((cred) => {
      const transports = cred.transports || [];
      // Определяем тип устройства по транспортам: internal => platform, иначе cross-platform
      const deviceType = transports.includes('internal') ? 'platform' : 'cross-platform';
      // Определяем человекочитаемое имя устройства
      const deviceInfo = getDeviceInfo(transports, deviceType);

      return {
        id: cred.id,
        credentialId: cred.credentialId,
        name: deviceInfo.name,
        deviceType,
        transports,
        // Поле резервного копирования недоступно в нашей модели; по умолчанию false
        isBackedUp: false,
        createdAt: cred.createdAt.toISOString(),
        // updatedAt актуализируется при успешной аутентификации
        lastUsed: cred.updatedAt ? cred.updatedAt.toISOString() : null
      };
    });

    return NextResponse.json({
      success: true,
      passkeys,
      total: passkeys.length
    });

  } catch (error) {
    console.error('WebAuthn list error:', error);
    return NextResponse.json(
      { error: 'Ошибка получения списка Passkeys' },
      { status: 500 }
    );
  }
}

// Определяем информацию об устройстве на основе транспортов и типа
function getDeviceInfo(transports: string[], deviceType?: string | null) {
  const transportSet = new Set(transports);
  
  // Если есть internal transport - это встроенная биометрия
  if (transportSet.has('internal')) {
    if (transportSet.has('hybrid')) {
      return {
        name: 'Windows Hello',
        icon: 'monitor'
      };
    }
    return {
      name: 'Встроенная биометрия',
      icon: 'fingerprint'
    };
  }
  
  // Если есть hybrid - может быть iPhone/Android
  if (transportSet.has('hybrid')) {
    return {
      name: 'Смартфон (Face ID/Touch ID)',
      icon: 'smartphone'
    };
  }
  
  // USB ключи
  if (transportSet.has('usb')) {
    return {
      name: 'USB Security Key',
      icon: 'shield'
    };
  }
  
  // NFC ключи
  if (transportSet.has('nfc')) {
    return {
      name: 'NFC Security Key',
      icon: 'shield'
    };
  }
  
  // По умолчанию
  return {
    name: 'Security Key',
    icon: 'shield'
  };
}
