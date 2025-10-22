'use client';

/**
 * Страница управления пользователями
 * Список, поиск, блокировка/разблокировка, смена режима
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminPageWrapper from '../components/AdminPageWrapper';
import DataTable, { Column } from '../components/DataTable';
import ConfirmDialog from '../components/ConfirmDialog';

interface User {
  id: string;
  email: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  mode: 'DEMO' | 'TRIAL' | 'PAID' | 'EXPIRED';
  isBlocked: boolean;
  planExpiry: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  organization: {
    id: string;
    name: string;
    inn: string | null;
    isBlocked: boolean;
  } | null;
  organizationMemberships: any[];
  _count: {
    documents: number;
    reports: number;
    sessions: number;
  };
}

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [filters, setFilters] = useState({
    search: '',
    mode: '',
    isBlocked: '',
  });
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [detailsModal, setDetailsModal] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    action: 'block' | 'unblock' | null;
    user: User | null;
  }>({ isOpen: false, action: null, user: null });
  const [actionLoading, setActionLoading] = useState(false);
  const [changeModeModal, setChangeModeModal] = useState<{
    isOpen: boolean;
    userId: string | null;
    currentMode: User['mode'] | null;
  }>({ isOpen: false, userId: null, currentMode: null });
  const [modeData, setModeData] = useState({
    mode: 'TRIAL' as 'DEMO' | 'TRIAL' | 'PAID' | 'EXPIRED',
    planExpiry: '',
  });

  useEffect(() => {
    loadUsers();
  }, [filters]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.mode) params.append('mode', filters.mode);
      if (filters.isBlocked) params.append('isBlocked', filters.isBlocked);

      const response = await fetch(`/api/admin/users?${params}`);

      if (response.status === 401) {
        router.push('/admin/login');
        return;
      }

      if (!response.ok) throw new Error('Ошибка загрузки пользователей');

      const data = await response.json();
      setUsers(data.users);
      setStats(data.stats);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (userId: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`);
      if (!response.ok) throw new Error('Ошибка загрузки деталей');

      const data = await response.json();
      setSelectedUser(data);
      setDetailsModal(true);
    } catch (error) {
      console.error('Error loading user details:', error);
      alert('Ошибка при загрузке деталей пользователя');
    }
  };

  const handleBlock = async () => {
    if (!confirmDialog.user) return;

    try {
      setActionLoading(true);
      const response = await fetch(`/api/admin/users/${confirmDialog.user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'block',
          blockReason: 'Заблокирован администратором',
        }),
      });

      if (!response.ok) throw new Error('Ошибка блокировки');

      await loadUsers();
      setConfirmDialog({ isOpen: false, action: null, user: null });
    } catch (error) {
      console.error('Error blocking user:', error);
      alert('Ошибка при блокировке пользователя');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnblock = async () => {
    if (!confirmDialog.user) return;

    try {
      setActionLoading(true);
      const response = await fetch(`/api/admin/users/${confirmDialog.user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unblock' }),
      });

      if (!response.ok) throw new Error('Ошибка разблокировки');

      await loadUsers();
      setConfirmDialog({ isOpen: false, action: null, user: null });
    } catch (error) {
      console.error('Error unblocking user:', error);
      alert('Ошибка при разблокировке пользователя');
    } finally {
      setActionLoading(false);
    }
  };

  const handleChangeMode = async () => {
    if (!changeModeModal.userId) return;

    try {
      setActionLoading(true);
      const response = await fetch(`/api/admin/users/${changeModeModal.userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'change_mode',
          mode: modeData.mode,
        }),
      });

      if (!response.ok) throw new Error('Ошибка смены режима');

      await loadUsers();
      setChangeModeModal({ isOpen: false, userId: null, currentMode: null });
      setModeData({ mode: 'TRIAL', planExpiry: '' });
    } catch (error) {
      console.error('Error changing mode:', error);
      alert('Ошибка при смене режима');
    } finally {
      setActionLoading(false);
    }
  };

  const getModeBadge = (mode: User['mode']) => {
    const badges = {
      DEMO: <span className="px-2 py-1 text-xs rounded-md border bg-yellow-500/10 text-yellow-400 border-yellow-500/20">Демо</span>,
      TRIAL: <span className="px-2 py-1 text-xs rounded-md border bg-blue-500/10 text-blue-400 border-blue-500/20">Trial</span>,
      PAID: <span className="px-2 py-1 text-xs rounded-md border bg-green-500/10 text-green-400 border-green-500/20">Платный</span>,
      EXPIRED: <span className="px-2 py-1 text-xs rounded-md border bg-red-500/10 text-red-400 border-red-500/20">Истек</span>,
    };
    return badges[mode];
  };

  const columns: Column<User>[] = [
    {
      key: 'email',
      label: 'Пользователь',
      sortable: true,
      render: (user) => (
        <div>
          <div className="text-sm text-white font-medium">
            {user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email}
          </div>
          <div className="text-xs text-gray-400">{user.email}</div>
          {user.lastLoginAt && (
            <div className="text-xs text-gray-500">
              Вход: {new Date(user.lastLoginAt).toLocaleDateString('ru-RU')}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'organization',
      label: 'Компания',
      render: (user) =>
        user.organization ? (
          <div>
            <div className="text-sm text-gray-300">{user.organization.name}</div>
            {user.organization.inn && (
              <div className="text-xs text-gray-500">{user.organization.inn}</div>
            )}
          </div>
        ) : (
          <span className="text-xs text-gray-500">Без компании</span>
        ),
    },
    {
      key: 'mode',
      label: 'Режим',
      width: 'w-28',
      sortable: true,
      render: (user) => getModeBadge(user.mode),
    },
    {
      key: 'activity',
      label: 'Активность',
      width: 'w-32',
      render: (user) => (
        <div className="text-xs text-gray-400">
          Док: {user._count.documents} | Отч: {user._count.reports}
        </div>
      ),
    },
    {
      key: 'isBlocked',
      label: 'Статус',
      width: 'w-32',
      sortable: true,
      render: (user) =>
        user.isBlocked ? (
          <span className="px-2 py-1 text-xs rounded-md border bg-red-500/10 text-red-400 border-red-500/20">
            Заблокирован
          </span>
        ) : (
          <span className="px-2 py-1 text-xs rounded-md border bg-green-500/10 text-green-400 border-green-500/20">
            Активен
          </span>
        ),
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Загрузка пользователей...</p>
        </div>
      </div>
    );
  }

  return (
    <AdminPageWrapper
      title="Управление пользователями"
      breadcrumbs={[{ label: 'Дашборд', href: '/admin/dashboard' }, { label: 'Пользователи' }]}
    >
      <div className="space-y-6">
        {/* Статистика */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-gray-900/50 rounded-lg border border-gray-800 p-4">
              <p className="text-sm text-gray-400 mb-1">Всего пользователей</p>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
            </div>
            <div className="bg-gray-900/50 rounded-lg border border-gray-800 p-4">
              <p className="text-sm text-gray-400 mb-1">Демо</p>
              <p className="text-2xl font-bold text-yellow-400">{stats.byMode.demo}</p>
            </div>
            <div className="bg-gray-900/50 rounded-lg border border-gray-800 p-4">
              <p className="text-sm text-gray-400 mb-1">Trial</p>
              <p className="text-2xl font-bold text-blue-400">{stats.byMode.trial}</p>
            </div>
            <div className="bg-gray-900/50 rounded-lg border border-gray-800 p-4">
              <p className="text-sm text-gray-400 mb-1">Платные</p>
              <p className="text-2xl font-bold text-green-400">{stats.byMode.paid}</p>
            </div>
            <div className="bg-gray-900/50 rounded-lg border border-gray-800 p-4">
              <p className="text-sm text-gray-400 mb-1">Заблокированные</p>
              <p className="text-2xl font-bold text-red-400">{stats.blocked}</p>
            </div>
          </div>
        )}

        {/* Таблица с DataTable */}
        <DataTable
          columns={columns}
          data={users}
          keyExtractor={(user) => user.id}
          searchable
          searchPlaceholder="Поиск по email, имени или телефону..."
          filters={
            <>
              <select
                value={filters.mode}
                onChange={(e) => setFilters({ ...filters, mode: e.target.value })}
                className="px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
              >
                <option value="">Все режимы</option>
                <option value="DEMO">Демо</option>
                <option value="TRIAL">Trial</option>
                <option value="PAID">Платные</option>
                <option value="EXPIRED">Истекшие</option>
              </select>
              <select
                value={filters.isBlocked}
                onChange={(e) => setFilters({ ...filters, isBlocked: e.target.value })}
                className="px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
              >
                <option value="">Все</option>
                <option value="false">Активные</option>
                <option value="true">Заблокированные</option>
              </select>
            </>
          }
          rowActions={(user) => (
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => handleViewDetails(user.id)}
                className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Детали
              </button>
              <button
                onClick={() => {
                  setModeData({ ...modeData, mode: user.mode });
                  setChangeModeModal({ isOpen: true, userId: user.id, currentMode: user.mode });
                }}
                className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Режим
              </button>
              {!user.isBlocked ? (
                <button
                  onClick={() => setConfirmDialog({ isOpen: true, action: 'block', user })}
                  className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  Блок
                </button>
              ) : (
                <button
                  onClick={() => setConfirmDialog({ isOpen: true, action: 'unblock', user })}
                  className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  Разблок
                </button>
              )}
            </div>
          )}
          emptyMessage="Нет пользователей для отображения"
        />
      </div>

      {/* Диалог блокировки */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen && confirmDialog.action === 'block'}
        onClose={() => setConfirmDialog({ isOpen: false, action: null, user: null })}
        onConfirm={handleBlock}
        title="Заблокировать пользователя?"
        message={`Вы уверены что хотите заблокировать пользователя ${confirmDialog.user?.name || confirmDialog.user?.email}? Пользователь потеряет доступ к платформе.`}
        confirmText="Заблокировать"
        variant="danger"
        loading={actionLoading}
      />

      {/* Диалог разблокировки */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen && confirmDialog.action === 'unblock'}
        onClose={() => setConfirmDialog({ isOpen: false, action: null, user: null })}
        onConfirm={handleUnblock}
        title="Разблокировать пользователя?"
        message={`Вы уверены что хотите разблокировать пользователя ${confirmDialog.user?.name || confirmDialog.user?.email}?`}
        confirmText="Разблокировать"
        variant="info"
        loading={actionLoading}
      />

      {/* Модалка смены режима */}
      {changeModeModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !actionLoading && setChangeModeModal({ isOpen: false, userId: null, currentMode: null })}
          />
          <div className="relative bg-gray-900 border border-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-xl font-bold text-white mb-4">Изменить режим пользователя</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Новый режим доступа</label>
                  <select
                    value={modeData.mode}
                    onChange={(e) => setModeData({ ...modeData, mode: e.target.value as any })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="DEMO">DEMO — демонстрационный режим</option>
                    <option value="TRIAL">TRIAL — пробный период</option>
                    <option value="PAID">PAID — платный доступ</option>
                    <option value="EXPIRED">EXPIRED — срок истек</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-2">
                    Текущий режим: <span className="font-medium">{changeModeModal.currentMode}</span>
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setChangeModeModal({ isOpen: false, userId: null, currentMode: null })}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Отмена
                </button>
                <button
                  onClick={handleChangeMode}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {actionLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      <span>Обработка...</span>
                    </>
                  ) : (
                    'Изменить'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модалка деталей пользователя */}
      {detailsModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 max-w-4xl w-full mx-4 my-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-white">
                {selectedUser.user.name || selectedUser.user.email}
              </h3>
              <button
                onClick={() => setDetailsModal(false)}
                className="text-gray-400 hover:text-gray-300"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              {/* Основная информация */}
              <div className="bg-gray-800/50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-400 mb-3">Основная информация</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <p className="text-sm text-white">{selectedUser.user.email}</p>
                  </div>
                  {selectedUser.user.phone && (
                    <div>
                      <p className="text-xs text-gray-500">Телефон</p>
                      <p className="text-sm text-white">{selectedUser.user.phone}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-500">Режим</p>
                    <p className="text-sm">{getModeBadge(selectedUser.user.mode)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Дата регистрации</p>
                    <p className="text-sm text-white">
                      {new Date(selectedUser.user.createdAt).toLocaleDateString('ru-RU')}
                    </p>
                  </div>
                  {selectedUser.user.planExpiry && (
                    <div>
                      <p className="text-xs text-gray-500">Срок действия плана</p>
                      <p className="text-sm text-white">
                        {new Date(selectedUser.user.planExpiry).toLocaleDateString('ru-RU')}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Статистика активности */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <p className="text-xs text-gray-400 mb-1">Документов (всего/месяц)</p>
                  <p className="text-2xl font-bold text-white">
                    {selectedUser.user._count.documents} / {selectedUser.stats.documentsThisMonth}
                  </p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <p className="text-xs text-gray-400 mb-1">Отчетов (всего/месяц)</p>
                  <p className="text-2xl font-bold text-white">
                    {selectedUser.user._count.reports} / {selectedUser.stats.reportsThisMonth}
                  </p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <p className="text-xs text-gray-400 mb-1">Активных сессий</p>
                  <p className="text-2xl font-bold text-white">{selectedUser.stats.activeSessions}</p>
                </div>
              </div>

              {/* Компания */}
              {selectedUser.user.organization && (
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-400 mb-3">Компания</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Название</p>
                      <p className="text-sm text-white">{selectedUser.user.organization.name}</p>
                    </div>
                    {selectedUser.user.organization.profile?.inn && (
                      <div>
                        <p className="text-xs text-gray-500">ИНН</p>
                        <p className="text-sm text-white">{selectedUser.user.organization.profile.inn}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setDetailsModal(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminPageWrapper>
  );
}
