'use client';

import { useEffect, useRef, useState } from 'react';

// Минимальная типизация для VK ID SDK (UMD) v2.6.x
declare global {
  interface Window {
    VKIDSDK?: VKIDSDK;
  }
}

type VKIDOAuthProvider = 'vkid' | 'ok_ru' | 'mail_ru';

interface VKIDConfig {
  app: number;
  redirectUrl: string;
  responseMode?: string;
  source?: string;
  scope?: string;
  state?: string;
}

interface VKIDOAuthList {
  render(params: {
    container: HTMLElement;
    styles?: {
      borderRadius?: number;
      height?: number;
    };
    oauthList: VKIDOAuthProvider[];
    lang?: number;
    scheme?: string;
  }): VKIDOAuthList;
  on(event: string, callback: (payload?: any) => void): VKIDOAuthList;
}

interface VKIDAuthModule {
  exchangeCode(code: string, deviceId: string): Promise<unknown>;
}

interface VKIDSDK {
  Config: {
    init(config: VKIDConfig): void;
  };
  ConfigResponseMode: {
    Callback: string;
    Redirect: string;
  };
  ConfigSource: {
    LOWCODE: string;
  };
  WidgetEvents: {
    ERROR: string;
  };
  OAuthListInternalEvents: {
    LOGIN_SUCCESS: string;
  };
  OAuthList: new () => VKIDOAuthList;
  Auth: VKIDAuthModule;
  Languages?: {
    RUS: number;
  };
  Scheme?: {
    LIGHT: string;
  };
}

interface VKIDWidgetProps {
  onSuccess: (data: any) => void;
  onError: (error: any) => void;
  className?: string;
}

export function VKIDWidget({ 
  onSuccess, 
  onError,
  className = ""
}: VKIDWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Получаем конфигурацию из переменных окружения
  const appId = Number.parseInt(process.env.NEXT_PUBLIC_VKID_APP_ID ?? '54017823', 10);
  const publicAppUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://oppositionary-subdialectally-bebe.ngrok-free.dev').replace(/\/$/, '');
  const redirectUrl = `${publicAppUrl}/api/auth/vk/callback`;

  const sdkUrl = 'https://unpkg.com/@vkid/sdk@<3.0.0/dist-sdk/umd/index.js';

  // Генерируем случайный state для безопасности OAuth
  const generateRandomState = (): string => {
    return Math.random().toString(36).substr(2) + Date.now().toString(36);
  };

  useEffect(() => {
    let isCancelled = false;

    const waitForSDK = (attempt = 0) => {
      if (isCancelled) {
        return;
      }

      if (window.VKIDSDK) {
        console.log('VK ID SDK готов к работе');
        initVKID(window.VKIDSDK);
        return;
      }

      if (attempt >= 100) {
        console.error('VK ID SDK не загрузился за 5 секунд');
        setIsLoading(false);
        onError(new Error('Таймаут загрузки VK ID SDK'));
        return;
      }

      setTimeout(() => waitForSDK(attempt + 1), 50);
    };

    if (window.VKIDSDK) {
      console.log('VK ID SDK уже загружен');
      initVKID(window.VKIDSDK);
    } else {
      console.log('Загружаем VK ID SDK...');

      let script = document.querySelector<HTMLScriptElement>(`script[src="${sdkUrl}"]`);

      if (!script) {
        script = document.createElement('script');
        script.src = sdkUrl;
        script.async = true;
        script.onload = () => {
          console.log('VK ID SDK скрипт загружен, ожидание инициализации...');
          waitForSDK();
        };
        script.onerror = () => {
          console.error('Ошибка загрузки VK ID SDK');
          setIsLoading(false);
          onError(new Error('Не удалось загрузить VK ID SDK'));
        };
        document.head.appendChild(script);
      } else {
        console.log('Скрипт VK ID SDK уже присутствует, ожидаем глобальный объект...');
        waitForSDK();
      }
    }

    return () => {
      isCancelled = true;
    };
  }, []);

  const initVKID = (VKID: VKIDSDK) => {
    if (!containerRef.current) {
      console.error('Контейнер для VK ID виджета не найден');
      setIsLoading(false);
      onError(new Error('VK ID контейнер недоступен'));
      return;
    }

    try {
      console.log('Инициализируем VK ID SDK...');

      VKID.Config.init({
        app: appId,
        redirectUrl,
        responseMode: VKID.ConfigResponseMode.Callback,
        source: VKID.ConfigSource.LOWCODE,
        scope: 'email phone',
        state: generateRandomState()
      });

      const widget = new VKID.OAuthList();

      widget
        .render({
          container: containerRef.current,
          styles: {
            borderRadius: 11,
            height: 44
          },
          oauthList: ['vkid', 'ok_ru', 'mail_ru'],
          scheme: VKID.Scheme?.LIGHT,
          lang: VKID.Languages?.RUS
        })
        .on(VKID.WidgetEvents.ERROR, (error: unknown) => {
          console.error('Ошибка VK ID виджета:', error);
          setIsLoaded(false);
          setIsLoading(false);
          onError(error);
        })
        .on(VKID.OAuthListInternalEvents.LOGIN_SUCCESS, (payload: any) => {
          console.log('VK ID успешная авторизация:', payload);

          onSuccess(payload);

          const params = new URLSearchParams({
            code: payload?.code ?? '',
            state: payload?.state ?? '',
            device_id: payload?.device_id ?? ''
          });

          window.location.href = `${redirectUrl}?${params.toString()}`;
        });

      console.log('VK ID виджет успешно инициализирован');
      setIsLoaded(true);
      setIsLoading(false);
    } catch (error) {
      console.error('Ошибка инициализации VK ID:', error);
      setIsLoaded(false);
      setIsLoading(false);
      onError(error);
    }
  };

  return (
    <div className={`relative w-full ${className}`} style={{ minHeight: '44px' }}>
      {(isLoading || !isLoaded) && (
        <div className="absolute inset-0 z-[1] flex items-center justify-center rounded-md bg-muted/20 animate-pulse">
          <span className="text-sm text-muted-foreground">
            {isLoading ? 'Загрузка VK ID...' : 'Ошибка загрузки VK ID'}
          </span>
        </div>
      )}
      <div
        ref={containerRef}
        className="h-full"
        style={{ opacity: isLoaded ? 1 : 0, transition: 'opacity 0.2s ease' }}
      />
    </div>
  );
}