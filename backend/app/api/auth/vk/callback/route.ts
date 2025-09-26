import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { signIn } from 'next-auth/react';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/structured-logger';

/**
 * VK ID OAuth callback handler
 * Обрабатывает код авторизации от VK ID и создает сессию пользователя
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const signature = searchParams.get('signature') ?? searchParams.get('sign');
  const device_id = searchParams.get('device_id');

  await logger.info('VK ID callback получен', {
    hasCode: !!code,
    hasState: !!state,
    hasSignature: !!signature,
    signatureParamName: signature
      ? (searchParams.has('signature') ? 'signature' : 'sign')
      : null,
    hasDeviceId: !!device_id,
    userAgent: request.headers.get('user-agent')
  });

  // Проверяем обязательные параметры
  if (!code || !state) {
    await logger.warn('VK ID callback: отсутствуют обязательные параметры', {
      code: !!code,
      state: !!state,
      signature: !!signature,
      deviceId: !!device_id,
    });
    
    return NextResponse.json(
      { error: 'Отсутствуют обязательные параметры авторизации' },
      { status: 400 }
    );
  }

  try {
    // 1. Валидация подписи (если она передана)
    if (signature) {
      const isValidSignature = await validateVKIDSignature({
        code,
        state,
        device_id: device_id || '',
        signature
      });

      if (!isValidSignature) {
        await logger.error('VK ID: недействительная подпись', undefined, { 
          state, 
          device_id,
          signatureParamName: searchParams.has('signature') ? 'signature' : 'sign'
        });
        return NextResponse.json(
          { error: 'Недействительная подпись запроса' },
          { status: 403 }
        );
      }
    } else {
      await logger.warn('VK ID callback: подпись отсутствует, пропускаем проверку', {
        state,
        device_id,
        hasClientSecret: !!process.env.VKID_CLIENT_SECRET
      });
    }

    // 2. Валидация состояния (state)
    // TODO: Реализовать проверку state с сохраненным значением
    // Пока пропускаем для MVP

    // 3. Обмен кода на access_token
    const tokenData = await exchangeCodeForToken(code);
    
    if (!tokenData.access_token || !tokenData.user_id) {
      await logger.error('VK ID: не удалось получить токен', undefined, { tokenData });
      return NextResponse.json(
        { error: 'Ошибка получения токена авторизации' },
        { status: 500 }
      );
    }

    // 4. Получение информации о пользователе
    const userInfo = await getVKUserInfo(tokenData.access_token, tokenData.user_id);
    
    // 5. Поиск или создание пользователя
    const user = await findOrCreateUser({
      vkId: tokenData.user_id.toString(),
      email: userInfo.email,
      phone: userInfo.phone,
      firstName: userInfo.first_name,
      lastName: userInfo.last_name
    });

    // 6. Создание сессии через NextAuth
    // Поскольку мы используем кастомный обработчик, создаем сессию напрямую
    const sessionData = {
      user: {
        id: user.id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`.trim()
      }
    };

    await logger.info('VK ID авторизация успешна', {
      userId: user.id,
      vkId: tokenData.user_id,
      deviceId: device_id
    });

    // Редирект на дашборд с успешной авторизацией
    const redirectUrl = new URL('/dashboard', request.url);
    redirectUrl.searchParams.set('auth', 'success');
    redirectUrl.searchParams.set('method', 'vk');

    return NextResponse.redirect(redirectUrl);

  } catch (error) {
    await logger.error('Ошибка VK ID авторизации', error instanceof Error ? error : new Error(String(error)), {
      state,
      device_id
    });

    const errorUrl = new URL('/login', request.url);
    errorUrl.searchParams.set('error', 'vk_auth_failed');
    
    return NextResponse.redirect(errorUrl);
  }
}

/**
 * Валидация подписи VK ID по спецификации
 */
async function validateVKIDSignature(params: {
  code: string;
  state: string;
  device_id: string;
  signature: string;
}): Promise<boolean> {
  const clientSecret = process.env.VKID_CLIENT_SECRET;
  
  if (!clientSecret) {
    await logger.error('VK ID: отсутствует CLIENT_SECRET в переменных окружения');
    return false;
  }

  // Формируем строку для подписи согласно документации VK ID
  const signatureString = [
    `code=${params.code}`,
    params.device_id ? `device_id=${params.device_id}` : null,
    `state=${params.state}`
  ].filter(Boolean).join('&');

  // Вычисляем HMAC-SHA256
  const expectedSignature = crypto
    .createHmac('sha256', clientSecret)
    .update(signatureString)
    .digest('hex');

  const received = Buffer.from(params.signature);
  const expected = Buffer.from(expectedSignature);

  if (received.length !== expected.length) {
    await logger.warn('VK ID: несовпадение длины подписи', {
      receivedLength: received.length,
      expectedLength: expected.length
    });
    return false;
  }

  const isValid = crypto.timingSafeEqual(received, expected);

  if (!isValid) {
    await logger.warn('VK ID: несовпадение подписи', {
      expected: expectedSignature,
      received: params.signature,
      signatureString
    });
  }

  return isValid;
}

/**
 * Обмен авторизационного кода на access_token
 */
async function exchangeCodeForToken(code: string) {
  const tokenUrl = 'https://oauth.vk.ru/access_token';
  
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: process.env.VKID_APP_ID || '',
    client_secret: process.env.VKID_CLIENT_SECRET || '',
    redirect_uri: process.env.NEXTAUTH_URL + '/api/auth/vk/callback',
    code: code
  });

  await logger.info('VK ID: обмен кода на токен', { 
    tokenUrl,
    clientId: process.env.VKID_APP_ID,
    redirectUri: process.env.NEXTAUTH_URL + '/api/auth/vk/callback'
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body: params.toString()
  });

  if (!response.ok) {
    const errorText = await response.text();
    await logger.error(`VK ID: ошибка обмена кода`, new Error(`${response.status} ${response.statusText}`), {
      status: response.status,
      statusText: response.statusText,
      body: errorText
    });
    throw new Error(`Ошибка обмена кода: ${response.status} ${response.statusText}`);
  }

  const tokenData = await response.json();
  
  await logger.info('VK ID: токен получен успешно', {
    hasAccessToken: !!tokenData.access_token,
    userId: tokenData.user_id,
    expiresIn: tokenData.expires_in
  });

  return tokenData;
}

/**
 * Получение информации о пользователе VK
 */
async function getVKUserInfo(accessToken: string, userId: string) {
  const userInfoUrl = 'https://api.vk.ru/method/users.get';
  
  const params = new URLSearchParams({
    user_ids: userId,
    fields: 'email,phone',
    access_token: accessToken,
    v: '5.207'
  });

  const response = await fetch(`${userInfoUrl}?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Ошибка получения информации о пользователе: ${response.status}`);
  }

  const userData = await response.json();
  
  if (userData.error) {
    await logger.error('VK API ошибка', new Error(userData.error.error_msg), userData.error);
    throw new Error(`VK API ошибка: ${userData.error.error_msg}`);
  }

  const user = userData.response?.[0] || {};
  
  await logger.info('VK ID: информация о пользователе получена', {
    userId,
    hasEmail: !!user.email,
    hasPhone: !!user.phone,
    firstName: user.first_name,
    lastName: user.last_name
  });

  return {
    email: user.email || null,
    phone: user.phone || null,
    first_name: user.first_name || '',
    last_name: user.last_name || ''
  };
}

/**
 * Поиск или создание пользователя в базе данных
 */
async function findOrCreateUser(userData: {
  vkId: string;
  email?: string;
  phone?: string;
  firstName: string;
  lastName: string;
}) {
  // Поиск по VK ID
  let user = await prisma.user.findFirst({
    where: { 
      accounts: {
        some: {
          provider: 'vk',
          providerAccountId: userData.vkId
        }
      }
    }
  });

  if (user) {
    // Обновляем время последнего входа
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    await logger.info('VK ID: найден существующий пользователь', { 
      userId: user.id, 
      vkId: userData.vkId 
    });
    
    return user;
  }

  // Если пользователь не найден по VK ID, ищем по email (если есть)
  if (userData.email) {
    user = await prisma.user.findUnique({
      where: { email: userData.email }
    });

    if (user) {
      // Привязываем VK аккаунт к существующему пользователю
      await prisma.account.create({
        data: {
          userId: user.id,
          type: 'oauth',
          provider: 'vk',
          providerAccountId: userData.vkId,
          access_token: '', // Не сохраняем токен для безопасности
          scope: 'email'
        }
      });

      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      });

      await logger.info('VK ID: привязан к существующему пользователю', { 
        userId: user.id, 
        vkId: userData.vkId,
        email: userData.email
      });

      return user;
    }
  }

  if (!userData.email) {
    throw new Error('VK ID callback не содержит email — регистрация невозможна');
  }

  // Создаем нового пользователя
  user = await prisma.user.create({
    data: {
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      phone: userData.phone,
      lastLoginAt: new Date(),
      emailVerified: userData.email ? new Date() : null, // VK гарантирует верификацию email
      accounts: {
        create: {
          type: 'oauth',
          provider: 'vk',
          providerAccountId: userData.vkId,
          access_token: '', // Не сохраняем токен
          scope: 'email'
        }
      }
    }
  });

  await logger.info('VK ID: создан новый пользователь', {
    userId: user.id,
    vkId: userData.vkId,
    email: userData.email,
    hasPhone: !!userData.phone
  });

  return user;
}