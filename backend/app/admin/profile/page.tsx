'use client';

/**
 * Страница профиля администратора
 * Настройка Passkey, смена пароля, просмотр активных сессий
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminPageWrapper from '../components/AdminPageWrapper';

interface Admin {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  telegramBotToken: string | null;
  telegramEnabled: boolean;
  notifyTrialRequests: boolean;
  notifyUserErrors: boolean;
  notifySystemErrors: boolean;
  notifyPayments: boolean;
  notifySecurityIssues: boolean;
  _count: {
    webAuthnCredentials: number;
    recoveryCodes: number;
    sessions: number;
  };
}

interface Passkey {
  id: string;
  credentialId: string;
  transports: string[];
  createdAt: string;
}

export default function AdminProfilePage() {
  const router = useRouter();
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(true);
  const [passkeySetupModal, setPasskeySetupModal] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [showRecoveryCodes, setShowRecoveryCodes] = useState(false);
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [removingPasskeyId, setRemovingPasskeyId] = useState<string | null>(null);

  // Telegram settings state
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [notifyTrialRequests, setNotifyTrialRequests] = useState(true);
  const [notifyUserErrors, setNotifyUserErrors] = useState(true);
  const [notifySystemErrors, setNotifySystemErrors] = useState(true);
  const [notifyPayments, setNotifyPayments] = useState(false);
  const [notifySecurityIssues, setNotifySecurityIssues] = useState(true);
  const [savingTelegram, setSavingTelegram] = useState(false);

  useEffect(() => {
    loadAdminProfile();
    loadPasskeys();
  }, []);

  const loadAdminProfile = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/profile');

      if (response.status === 401) {
        router.push('/admin/login');
        return;
      }

      if (!response.ok) throw new Error('Ошибка загрузки профиля');

      const data = await response.json();
      setAdmin(data.admin);

      // Populate Telegram settings
      setTelegramBotToken(data.admin.telegramBotToken || '');
      setTelegramEnabled(data.admin.telegramEnabled || false);
      setNotifyTrialRequests(data.admin.notifyTrialRequests ?? true);
      setNotifyUserErrors(data.admin.notifyUserErrors ?? true);
      setNotifySystemErrors(data.admin.notifySystemErrors ?? true);
      setNotifyPayments(data.admin.notifyPayments ?? false);
      setNotifySecurityIssues(data.admin.notifySecurityIssues ?? true);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPasskeys = async () => {
    try {
      const response = await fetch('/api/admin/auth/passkey/list');
      if (!response.ok) throw new Error('Ошибка загрузки списка Passkey');

      const data = await response.json();
      setPasskeys(data.passkeys || []);
    } catch (error) {
      console.error('Error loading passkeys:', error);
    }
  };

  const handleSaveTelegramSettings = async () => {
    try {
      setSavingTelegram(true);

      const response = await fetch('/api/admin/profile/telegram', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramBotToken: telegramBotToken || null,
          telegramEnabled,
          notifyTrialRequests,
          notifyUserErrors,
          notifySystemErrors,
          notifyPayments,
          notifySecurityIssues,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Ошибка сохранения настроек');
      }

      const data = await response.json();

      // Обновляем локальное состояние админа
      setAdmin(data.admin);

      alert('✅ Настройки Telegram успешно сохранены!');
    } catch (error: any) {
      console.error('Telegram settings save error:', error);
      alert(`❌ Ошибка: ${error.message}`);
    } finally {
      setSavingTelegram(false);
    }
  };

  const handleSetupPasskey = async () => {
    try {
      // Динамический импорт @simplewebauthn/browser
      const { startRegistration } = await import('@simplewebauthn/browser');

      // Начинаем регистрацию Passkey
      const optionsRes = await fetch('/api/admin/auth/passkey/register-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!optionsRes.ok) throw new Error('Не удалось начать регистрацию Passkey');

      const { options } = await optionsRes.json();

      // Вызываем WebAuthn API браузера через @simplewebauthn/browser
      // Это правильно конвертирует base64url строки в ArrayBuffer
      const credential = await startRegistration(options);

      // Отправляем credential на сервер для верификации
      const verifyRes = await fetch('/api/admin/auth/passkey/register-finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credential),
      });

      if (!verifyRes.ok) throw new Error('Ошибка верификации Passkey');

      const result = await verifyRes.json();

      // Показываем recovery коды
      setRecoveryCodes(result.recoveryCodes);
      setShowRecoveryCodes(true);
      setPasskeySetupModal(false);

      // Обновляем профиль и список Passkey
      await loadAdminProfile();
      await loadPasskeys();

      alert('✅ Passkey успешно настроен! Сохраните backup коды.');
    } catch (error: any) {
      console.error('Passkey setup error:', error);
      alert(`❌ Ошибка: ${error.message}`);
    }
  };

  const handleRemovePasskey = async (passkeyId: string) => {
    if (!confirm('Вы уверены, что хотите удалить этот Passkey? Это действие нельзя отменить.')) {
      return;
    }

    try {
      setRemovingPasskeyId(passkeyId);

      const response = await fetch('/api/admin/auth/passkey/remove', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passkeyId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Ошибка удаления Passkey');
      }

      alert('✅ Passkey успешно удален');

      // Обновляем профиль и список Passkey
      await loadAdminProfile();
      await loadPasskeys();
    } catch (error: any) {
      console.error('Passkey remove error:', error);
      alert(`❌ Ошибка: ${error.message}`);
    } finally {
      setRemovingPasskeyId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Загрузка профиля...</p>
        </div>
      </div>
    );
  }

  return (
    <AdminPageWrapper
      title="Мой профиль"
      breadcrumbs={[{ label: 'Дашборд', href: '/admin/dashboard' }, { label: 'Профиль' }]}
    >
      <div className="space-y-6">
        {/* Информация о профиле */}
        <div className="bg-gray-900/50 rounded-lg border border-gray-800 p-6">
          <h2 className="text-lg font-bold text-white mb-4">Информация</h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-400">Email</p>
              <p className="text-white font-medium">{admin?.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Роль</p>
              <span className="px-2 py-1 text-xs rounded-md border bg-red-500/10 text-red-400 border-red-500/20">
                {admin?.role}
              </span>
            </div>
            <div>
              <p className="text-sm text-gray-400">Создан</p>
              <p className="text-white">{admin?.createdAt ? new Date(admin.createdAt).toLocaleString('ru-RU') : '—'}</p>
            </div>
          </div>
        </div>

        {/* Passkey настройки */}
        <div className="bg-gray-900/50 rounded-lg border border-gray-800 p-6">
          <h2 className="text-lg font-bold text-white mb-4">🔐 Passkey (WebAuthn)</h2>
          <p className="text-sm text-gray-400 mb-4">
            Passkey позволяет входить с помощью биометрии (отпечаток пальца, Face ID) или аппаратного ключа.
            Это более безопасно чем пароль.
          </p>

          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-gray-400">Настроенных Passkey</p>
              <p className="text-2xl font-bold text-white">{admin?._count.webAuthnCredentials || 0}</p>
            </div>
            <button
              onClick={() => setPasskeySetupModal(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
            >
              {admin?._count.webAuthnCredentials ? '+ Добавить Passkey' : '⚡ Настроить Passkey'}
            </button>
          </div>

          {/* Список настроенных Passkey */}
          {passkeys.length > 0 && (
            <div className="space-y-2 mb-4">
              {passkeys.map((passkey) => (
                <div
                  key={passkey.id}
                  className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex items-center justify-between"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-white">
                        🔑 Passkey {passkey.credentialId.substring(0, 8)}...
                      </span>
                      {passkey.transports.length > 0 && (
                        <span className="text-xs px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded">
                          {passkey.transports.join(', ')}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      Создан: {new Date(passkey.createdAt).toLocaleString('ru-RU')}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemovePasskey(passkey.id)}
                    disabled={removingPasskeyId === passkey.id}
                    className="ml-4 px-3 py-1.5 text-sm bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-600/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {removingPasskeyId === passkey.id ? 'Удаление...' : 'Удалить'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {admin?._count.webAuthnCredentials === 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
              <p className="text-sm text-yellow-400">
                ⚠️ <strong>Рекомендуем настроить Passkey</strong> для более безопасного входа без пароля.
              </p>
            </div>
          )}
        </div>

        {/* Backup коды */}
        <div className="bg-gray-900/50 rounded-lg border border-gray-800 p-6">
          <h2 className="text-lg font-bold text-white mb-4">🔑 Backup коды восстановления</h2>
          <p className="text-sm text-gray-400 mb-4">
            Используйте эти коды для входа, если потеряете доступ к Passkey устройству.
          </p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Доступных кодов</p>
              <p className="text-2xl font-bold text-white">{admin?._count.recoveryCodes || 0}</p>
            </div>
          </div>
        </div>

        {/* Активные сессии */}
        <div className="bg-gray-900/50 rounded-lg border border-gray-800 p-6">
          <h2 className="text-lg font-bold text-white mb-4">📱 Активные сессии</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Активных сессий</p>
              <p className="text-2xl font-bold text-white">{admin?._count.sessions || 0}</p>
            </div>
          </div>
        </div>

        {/* Telegram Bot настройки */}
        <div className="bg-gray-900/50 rounded-lg border border-gray-800 p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-white mb-2">📲 Уведомления в Telegram</h2>
              <p className="text-sm text-gray-400">
                Настройте бота для получения уведомлений о важных событиях в системе
              </p>
            </div>
            {telegramEnabled && (
              <span className="px-2 py-1 text-xs rounded-md border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                Активно
              </span>
            )}
          </div>

          <div className="space-y-4">
            {/* Bot Token Input */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Токен Telegram бота
              </label>
              <div className="flex gap-2">
                <input
                  type={telegramBotToken && !telegramBotToken.startsWith('***') ? 'text' : 'password'}
                  value={telegramBotToken}
                  onChange={(e) => setTelegramBotToken(e.target.value)}
                  placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Получите токен у <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">@BotFather</a> в Telegram
              </p>
            </div>

            {/* Enable Toggle */}
            <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-white">Включить уведомления</p>
                <p className="text-xs text-gray-500">Активировать отправку сообщений в Telegram</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={telegramEnabled}
                  onChange={(e) => setTelegramEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {/* Notification Preferences */}
            <div className="border-t border-gray-800 pt-4">
              <p className="text-sm font-medium text-white mb-3">Типы уведомлений</p>
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-2 hover:bg-gray-800/50 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyTrialRequests}
                    onChange={(e) => setNotifyTrialRequests(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 bg-gray-700 border-gray-600 rounded focus:ring-emerald-500 focus:ring-offset-gray-900"
                  />
                  <div>
                    <p className="text-sm text-white">Новые заявки на доступ</p>
                    <p className="text-xs text-gray-500">Уведомление о новых trial requests</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-2 hover:bg-gray-800/50 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyUserErrors}
                    onChange={(e) => setNotifyUserErrors(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 bg-gray-700 border-gray-600 rounded focus:ring-emerald-500 focus:ring-offset-gray-900"
                  />
                  <div>
                    <p className="text-sm text-white">Ошибки пользователей</p>
                    <p className="text-xs text-gray-500">Проблемы с загрузкой документов, OCR и т.д.</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-2 hover:bg-gray-800/50 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifySystemErrors}
                    onChange={(e) => setNotifySystemErrors(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 bg-gray-700 border-gray-600 rounded focus:ring-emerald-500 focus:ring-offset-gray-900"
                  />
                  <div>
                    <p className="text-sm text-white">Системные ошибки</p>
                    <p className="text-xs text-gray-500">Критические сбои в работе платформы</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-2 hover:bg-gray-800/50 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyPayments}
                    onChange={(e) => setNotifyPayments(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 bg-gray-700 border-gray-600 rounded focus:ring-emerald-500 focus:ring-offset-gray-900"
                  />
                  <div>
                    <p className="text-sm text-white">Платежи</p>
                    <p className="text-xs text-gray-500">Успешные и неудачные транзакции</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-2 hover:bg-gray-800/50 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifySecurityIssues}
                    onChange={(e) => setNotifySecurityIssues(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 bg-gray-700 border-gray-600 rounded focus:ring-emerald-500 focus:ring-offset-gray-900"
                  />
                  <div>
                    <p className="text-sm text-white">Проблемы безопасности</p>
                    <p className="text-xs text-gray-500">Подозрительная активность, блокировки</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Save Button */}
            <button
              onClick={handleSaveTelegramSettings}
              disabled={savingTelegram}
              className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
            >
              {savingTelegram ? 'Сохранение...' : 'Сохранить настройки Telegram'}
            </button>
          </div>
        </div>
      </div>

      {/* Модалка настройки Passkey */}
      {passkeySetupModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-white mb-4">Настройка Passkey</h3>
            <p className="text-sm text-gray-400 mb-6">
              Сейчас браузер попросит вас подтвердить свою личность с помощью биометрии (отпечаток пальца, Face ID)
              или аппаратного ключа безопасности.
            </p>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-400">
                💡 После настройки вы получите <strong>backup коды восстановления</strong>.
                Обязательно сохраните их в безопасном месте!
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSetupPasskey}
                className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
              >
                Продолжить
              </button>
              <button
                onClick={() => setPasskeySetupModal(false)}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка с recovery кодами */}
      {showRecoveryCodes && recoveryCodes.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-white mb-4">🔑 Сохраните backup коды!</h3>
            <p className="text-sm text-gray-400 mb-4">
              Эти коды позволят вам войти, если вы потеряете доступ к Passkey устройству.
              <strong className="text-yellow-400"> Они показываются только один раз!</strong>
            </p>

            <div className="bg-gray-800 rounded-lg p-4 mb-4 font-mono text-sm space-y-1">
              {recoveryCodes.map((code, i) => (
                <div key={i} className="text-emerald-400">
                  {code}
                </div>
              ))}
            </div>

            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
              <p className="text-xs text-red-400">
                ⚠️ Сохраните эти коды в безопасном месте (менеджер паролей, бумажный носитель).
                После закрытия этого окна вы не сможете посмотреть их снова.
              </p>
            </div>

            <button
              onClick={() => {
                setShowRecoveryCodes(false);
                setRecoveryCodes([]);
              }}
              className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
            >
              Я сохранил коды
            </button>
          </div>
        </div>
      )}
    </AdminPageWrapper>
  );
}
