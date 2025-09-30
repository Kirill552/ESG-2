"use client";

import React, { useEffect, useState } from "react";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { ArrowLeft, Fingerprint, Mail } from "lucide-react";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { VKIDWidget } from "./VKIDWidget";

interface AuthFormProps {
  onSuccess: () => void;
  onBack: () => void;
}

export function AuthForm({ onSuccess, onBack }: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [authMethod, setAuthMethod] = useState<"email" | "magic" | "vk" | null>(null);
  const [isPasskeyAvailable, setIsPasskeyAvailable] = useState(false);
  const [passkeyStatus, setPasskeyStatus] = useState<{
    hasUser: boolean;
    hasPasskey: boolean;
    canUsePasskey: boolean;
  } | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const detectPasskeyAvailability = async () => {
      if (typeof window === "undefined" || typeof window.PublicKeyCredential === "undefined") {
        if (isMounted) {
          setIsPasskeyAvailable(false);
        }
        return;
      }

      try {
        const available = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.();
        if (isMounted) {
          setIsPasskeyAvailable(Boolean(available));
        }
      } catch (detectError) {
        console.warn("Passkey availability detection failed", detectError);
        if (isMounted) {
          setIsPasskeyAvailable(false);
        }
      }
    };

    detectPasskeyAvailability();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setStatusMessage(null);
    setPasskeyStatus(null);

    // Проверяем статус Passkey только если email корректный
    const checkPasskeyStatus = async () => {
      const trimmedEmail = email.trim().toLowerCase();
      if (!trimmedEmail || !trimmedEmail.includes('@')) {
        return;
      }

      try {
        const response = await fetch('/api/auth/passkey/status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: trimmedEmail }),
        });

        const result = await response.json();
        if (response.ok && result.ok) {
          setPasskeyStatus({
            hasUser: result.hasUser,
            hasPasskey: result.hasPasskey,
            canUsePasskey: result.canUsePasskey
          });
        }
      } catch (error) {
        // Игнорируем ошибки проверки статуса
        console.warn('Failed to check passkey status', error);
      }
    };

    const timeoutId = setTimeout(checkPasskeyStatus, 500); // Дебаунс 500мс
    return () => clearTimeout(timeoutId);
  }, [email]);

  const handleMagicLink = async () => {
    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      setError("Введите корректный email");
      return;
    }
    setIsLoading(true);
    setError(null);
    setStatusMessage(null);

    try {
      const response = await fetch('/api/auth/magic-link/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: normalizedEmail,
          redirectTo: '/?view=dashboard'
        })
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(result?.message || 'Не удалось отправить ссылку. Попробуйте позже.');
        return;
      }

      setAuthMethod('magic');
      setStatusMessage('Ссылка отправлена. Проверьте почтовый ящик.');
    } catch (err) {
      console.error('Magic link request failed', err);
      setError('Не удалось отправить ссылку. Проверьте соединение и попробуйте ещё раз.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVkAuthSuccess = (data: any) => {
    console.log('VK ID авторизация успешна:', data);
    setIsLoading(false);
    onSuccess();
  };

  const handleVkAuthError = (error: any) => {
    console.error('Ошибка VK ID авторизации:', error);
    setIsLoading(false);
    // Можно показать уведомление об ошибке
  };

  const handlePasskeyAuth = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError("Введите email, чтобы использовать Passkey");
      return;
    }

    if (!isPasskeyAvailable) {
      setError("Ваше устройство не поддерживает вход по Passkey");
      return;
    }

    setIsLoading(true);
    setStatusMessage(null);
    setError(null);

    const deriveDisplayName = () => {
      const localPart = normalizedEmail.split("@")[0] ?? normalizedEmail;
  const cleaned = localPart.replace(/[^\p{L}\p{N}\s_-]+/gu, " ").replace(/\s{2,}/g, " ").trim();
      return cleaned.length ? cleaned : normalizedEmail;
    };

    try {
      const authOptionsResponse = await fetch("/api/auth/passkey/authenticate/options", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      const authOptionsPayload = await authOptionsResponse.json().catch(() => ({}));

      if (authOptionsResponse.ok && authOptionsPayload?.options) {
        setStatusMessage("Подтвердите вход через Passkey");
        const assertion = await startAuthentication(authOptionsPayload.options);

        const verifyResponse = await fetch("/api/auth/passkey/authenticate/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: normalizedEmail,
            response: assertion,
          }),
        });

        const verifyPayload = await verifyResponse.json().catch(() => ({}));

        if (!verifyResponse.ok) {
          throw new Error(verifyPayload?.message ?? "Не удалось подтвердить Passkey. Попробуйте еще раз.");
        }

        onSuccess();
        return;
      }

      if (authOptionsResponse.status === 400 || authOptionsResponse.status === 404) {
        setStatusMessage("Создаем Passkey для вашего аккаунта...");

        const registerOptionsResponse = await fetch("/api/auth/passkey/register/options", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: normalizedEmail,
            displayName: deriveDisplayName(),
          }),
        });

        const registerOptionsPayload = await registerOptionsResponse.json().catch(() => ({}));

        if (!registerOptionsResponse.ok || !registerOptionsPayload?.options) {
          throw new Error(registerOptionsPayload?.message ?? "Не удалось подготовить Passkey. Попробуйте позже.");
        }

        const attestation = await startRegistration(registerOptionsPayload.options);

        const verifyRegistrationResponse = await fetch("/api/auth/passkey/register/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: normalizedEmail,
            response: attestation,
          }),
        });

        const verifyRegistrationPayload = await verifyRegistrationResponse.json().catch(() => ({}));

        if (!verifyRegistrationResponse.ok) {
          throw new Error(verifyRegistrationPayload?.message ?? "Не удалось завершить регистрацию Passkey.");
        }

        onSuccess();
        return;
      }

      throw new Error(authOptionsPayload?.message ?? "Не удалось получить параметры Passkey.");
    } catch (err) {
      console.error("Passkey flow failed", err);
      if (err instanceof Error) {
        if ((err as DOMException).name === "NotAllowedError") {
          setError("Запрос Passkey был отменен. Попробуйте ещё раз.");
        } else {
          setError(err.message);
        }
      } else {
        setError("Не удалось выполнить вход по Passkey. Попробуйте позже.");
      }
    } finally {
      setIsLoading(false);
      setStatusMessage(null);
    }
  };

  if (authMethod === 'magic') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-muted/20">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-6 h-6 text-primary" />
            </div>
            <CardTitle>Проверьте почту</CardTitle>
            <CardDescription>
              Мы отправили ссылку для входа на {email}
              {statusMessage && (
                <span className="block mt-2 text-muted-foreground">{statusMessage}</span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="outline" 
              onClick={onBack}
              className="w-full"
            >
              Назад
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-muted/20">
      <div className="w-full max-w-md">
        <Button 
          variant="ghost" 
          onClick={onBack}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Назад
        </Button>

        <Card>
          <CardHeader className="text-center">
            <CardTitle>Вход или регистрация</CardTitle>
            <CardDescription>
              Платформа для автоматического создания отчетов
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Email вход */}
            <div className="space-y-3">
              <div>
                <Input
                  type="email"
                  placeholder="Электронная почта"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) {
                      setError(null);
                    }
                  }}
                  className="h-12"
                  disabled={isLoading}
                />
                {error && (
                  <p className="mt-2 text-sm text-red-500">{error}</p>
                )}
              </div>
              <Button 
                onClick={handleMagicLink}
                disabled={!email.trim() || isLoading}
                className="w-full h-12 bg-[#1dc962] hover:bg-[#19b558] text-white"
              >
                <Mail className="w-5 h-5 mr-3" />
                Продолжить по почте
              </Button>
            </div>

            <div className="text-center text-sm text-muted-foreground">
              или
            </div>

            <div className="space-y-2">
              <Button
                onClick={handlePasskeyAuth}
                disabled={isLoading || !isPasskeyAvailable || !email.trim() || (passkeyStatus && !passkeyStatus.canUsePasskey)}
                variant="outline"
                className="w-full h-12 relative"
              >
                <Fingerprint className="w-5 h-5 mr-3" />
                {passkeyStatus?.hasPasskey ? 'Войти через Passkey' : 'Настроить Passkey'}
              </Button>
              {!isPasskeyAvailable && (
                <p className="text-xs text-muted-foreground text-center">
                  Passkey доступен на устройствах с Face ID, Touch ID или Windows Hello.
                </p>
              )}
              {passkeyStatus && !passkeyStatus.hasUser && email.trim() && (
                <p className="text-xs text-muted-foreground text-center">
                  Сначала создайте аккаунт через почту, затем настройте Passkey в настройках.
                </p>
              )}
              {statusMessage && (
                <p className="text-sm text-muted-foreground text-center">{statusMessage}</p>
              )}
            </div>

            {/* VK ID Виджет */}
            <VKIDWidget 
              onSuccess={handleVkAuthSuccess}
              onError={handleVkAuthError}
            />

            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Продолжая, вы соглашаетесь с{' '}
                <a href="#" className="text-[#1dc962] hover:underline">
                  условиями использования
                </a>{' '}
                и{' '}
                <a href="#" className="text-[#1dc962] hover:underline">
                  политикой конфиденциальности
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}