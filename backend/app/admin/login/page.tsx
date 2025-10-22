'use client';

/**
 * Страница входа администратора
 * Вход через Passkey + fallback на backup коды
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { startAuthentication } from '@simplewebauthn/browser';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [loginMode, setLoginMode] = useState<'passkey' | 'password' | 'recovery'>('password');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  /**
   * Вход через email + password
   */
  const handlePasswordLogin = async () => {
    if (!email || !password) {
      setError('Введите email и пароль');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Неверный email или пароль');
      }

      // Успешный вход - редирект на дашборд
      router.push('/admin/dashboard');
    } catch (err: any) {
      console.error('Password login error:', err);
      setError(err.message || 'Ошибка при входе');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Вход через Passkey
   */
  const handlePasskeyLogin = async () => {
    if (!email) {
      setError('Введите email');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Получаем options для аутентификации
      const beginResponse = await fetch('/api/admin/auth/passkey/login-begin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!beginResponse.ok) {
        const data = await beginResponse.json();
        throw new Error(data.error || 'Ошибка при начале аутентификации');
      }

      const responseData = await beginResponse.json();
      console.log('[Client] Full response from server:', responseData);
      const { options } = responseData;
      console.log('[Client] Options to pass to startAuthentication:', options);

      // 2. Запускаем WebAuthn аутентификацию
      const authResponse = await startAuthentication(options);

      // 3. Завершаем аутентификацию
      const finishResponse = await fetch('/api/admin/auth/passkey/login-finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          authResponse, // Исправлено: было "response: authResponse"
        }),
      });

      if (!finishResponse.ok) {
        const data = await finishResponse.json();
        throw new Error(data.error || 'Ошибка при завершении аутентификации');
      }

      // Успешный вход - редирект на дашборд
      router.push('/admin/dashboard');
    } catch (err: any) {
      console.error('Passkey login error:', err);
      setError(err.message || 'Ошибка при входе через Passkey');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Вход через recovery код
   */
  const handleRecoveryCodeLogin = async () => {
    if (!email || !recoveryCode) {
      setError('Введите email и код восстановления');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/auth/recovery-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          code: recoveryCode,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Неверный код восстановления');
      }

      const data = await response.json();

      // Предупреждение если осталось мало кодов
      if (data.warning) {
        alert(data.warning);
      }

      // Успешный вход - редирект на дашборд
      router.push('/admin/dashboard');
    } catch (err: any) {
      console.error('Recovery code login error:', err);
      setError(err.message || 'Ошибка при входе через код восстановления');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-950 to-black">
      <div className="max-w-md w-full mx-4">
        {/* Логотип и заголовок */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/10 rounded-xl mb-4">
            <svg
              className="w-8 h-8 text-emerald-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">ESG-Лайт</h1>
          <p className="text-gray-400">Админ-панель</p>
        </div>

        {/* Форма входа */}
        <div className="bg-gray-900/50 backdrop-blur-xl rounded-2xl border border-gray-800 p-8 shadow-2xl">
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Переключатель режима входа */}
          <div className="flex gap-2 mb-6 bg-gray-800/30 p-1 rounded-lg">
            <button
              onClick={() => setLoginMode('password')}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                loginMode === 'password'
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
              disabled={loading}
            >
              Пароль
            </button>
            <button
              onClick={() => setLoginMode('passkey')}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                loginMode === 'passkey'
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
              disabled={loading}
            >
              Passkey
            </button>
            <button
              onClick={() => setLoginMode('recovery')}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                loginMode === 'recovery'
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
              disabled={loading}
            >
              Recovery
            </button>
          </div>

          {/* Email поле */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Email администратора
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (loginMode === 'password') handlePasswordLogin();
                  else if (loginMode === 'passkey') handlePasskeyLogin();
                  else if (loginMode === 'recovery') handleRecoveryCodeLogin();
                }
              }}
            />
          </div>

          {loginMode === 'password' && (
            <>
              {/* Поле пароля */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Пароль
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  disabled={loading}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handlePasswordLogin();
                  }}
                />
              </div>

              {/* Кнопка входа по паролю */}
              <button
                onClick={handlePasswordLogin}
                disabled={loading || !email || !password}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                {loading ? 'Вход...' : 'Войти'}
              </button>
            </>
          )}

          {loginMode === 'passkey' && (
            <>
              {/* Кнопка Passkey входа */}
              <button
                onClick={handlePasskeyLogin}
                disabled={loading || !email}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Вход...
                  </>
                ) : (
                  <>
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                      />
                    </svg>
                    Войти через Passkey
                  </>
                )}
              </button>
            </>
          )}

          {loginMode === 'recovery' && (
            <>
              {/* Поле recovery кода */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Код восстановления
                </label>
                <input
                  type="text"
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                  placeholder="XXXX-XXXX"
                  className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-mono"
                  disabled={loading}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRecoveryCodeLogin();
                  }}
                />
              </div>

              {/* Кнопка входа через recovery код */}
              <button
                onClick={handleRecoveryCodeLogin}
                disabled={loading || !email || !recoveryCode}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                {loading ? 'Вход...' : 'Войти'}
              </button>
            </>
          )}
        </div>

        {/* Подсказка по безопасности */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>🔐 Защищено с помощью WebAuthn (FIDO2)</p>
        </div>
      </div>
    </div>
  );
}
