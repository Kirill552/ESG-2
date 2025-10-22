'use client';

/**
 * Страница управления администраторами
 * Только для SUPER_ADMIN
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminPageWrapper from '../components/AdminPageWrapper';

interface Admin {
  id: string;
  email: string;
  role: 'SUPER_ADMIN' | 'FINANCE_ADMIN' | 'SUPPORT_ADMIN' | 'SYSTEM_ADMIN';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  sessions: any[];
  _count: {
    sessions: number;
    webAuthnCredentials: number;
    recoveryCodes: number;
  };
}

export default function AdminsPage() {
  const router = useRouter();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [createModal, setCreateModal] = useState(false);
  const [actionModal, setActionModal] = useState<{
    open: boolean;
    action: 'change_role' | 'deactivate' | 'activate' | 'delete' | null;
    adminId: string | null;
  }>({ open: false, action: null, adminId: null });
  const [formData, setFormData] = useState({
    email: '',
    role: 'SUPPORT_ADMIN' as Admin['role'],
    password: '',
  });
  const [actionData, setActionData] = useState({
    role: 'SUPPORT_ADMIN' as Admin['role'],
  });

  useEffect(() => {
    loadAdmins();
  }, []);

  const loadAdmins = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/admins');

      if (response.status === 401) {
        router.push('/admin/login');
        return;
      }

      if (response.status === 403) {
        alert('Недостаточно прав. Только SUPER_ADMIN может просматривать эту страницу.');
        router.push('/admin/dashboard');
        return;
      }

      if (!response.ok) throw new Error('Ошибка загрузки администраторов');

      const data = await response.json();
      setAdmins(data.admins);
      setStats(data.stats);
    } catch (error) {
      console.error('Error loading admins:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const response = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Ошибка при создании');
      }

      await loadAdmins();
      setCreateModal(false);
      setFormData({ email: '', role: 'SUPPORT_ADMIN', password: '' });
    } catch (error: any) {
      console.error('Error creating admin:', error);
      alert(error.message || 'Ошибка при создании администратора');
    }
  };

  const handleAction = async () => {
    if (!actionModal.adminId || !actionModal.action) return;

    try {
      if (actionModal.action === 'delete') {
        const response = await fetch(`/api/admin/admins/${actionModal.adminId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Ошибка при удалении');
        }
      } else {
        const body: any = { action: actionModal.action };
        if (actionModal.action === 'change_role') {
          body.role = actionData.role;
        }

        const response = await fetch(`/api/admin/admins/${actionModal.adminId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Ошибка при выполнении действия');
        }
      }

      await loadAdmins();
      setActionModal({ open: false, action: null, adminId: null });
    } catch (error: any) {
      console.error('Error processing action:', error);
      alert(error.message || 'Ошибка при выполнении действия');
    }
  };

  const getRoleBadge = (role: Admin['role']) => {
    const badges = {
      SUPER_ADMIN: <span className="px-2 py-1 text-xs rounded-md border bg-red-500/10 text-red-400 border-red-500/20">SUPER ADMIN</span>,
      FINANCE_ADMIN: <span className="px-2 py-1 text-xs rounded-md border bg-green-500/10 text-green-400 border-green-500/20">FINANCE</span>,
      SUPPORT_ADMIN: <span className="px-2 py-1 text-xs rounded-md border bg-blue-500/10 text-blue-400 border-blue-500/20">SUPPORT</span>,
      SYSTEM_ADMIN: <span className="px-2 py-1 text-xs rounded-md border bg-purple-500/10 text-purple-400 border-purple-500/20">SYSTEM</span>,
    };
    return badges[role];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Загрузка администраторов...</p>
        </div>
      </div>
    );
  }

  return (
    <AdminPageWrapper
      title="Управление администраторами"
      breadcrumbs={[{ label: 'Дашборд', href: '/admin/dashboard' }, { label: 'Администраторы' }]}
      actions={
        <button
          onClick={() => setCreateModal(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
        >
          + Добавить администратора
        </button>
      }
    >
      <div className="space-y-6">
        {/* Статистика */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-900/50 rounded-lg border border-gray-800 p-4">
              <p className="text-sm text-gray-400 mb-1">Всего администраторов</p>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
            </div>
            <div className="bg-gray-900/50 rounded-lg border border-gray-800 p-4">
              <p className="text-sm text-gray-400 mb-1">Активные</p>
              <p className="text-2xl font-bold text-green-400">{stats.active}</p>
            </div>
            {stats.byRole.map((item: any) => (
              <div key={item.role} className="bg-gray-900/50 rounded-lg border border-gray-800 p-4">
                <p className="text-sm text-gray-400 mb-1">{item.role}</p>
                <p className="text-2xl font-bold text-white">{item._count}</p>
              </div>
            ))}
          </div>
        )}

        {/* Таблица администраторов */}
        <div className="bg-gray-900/50 rounded-lg border border-gray-800 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-800/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Роль</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Статус</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Создан</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Сессии</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {admins.map((admin) => (
                <tr key={admin.id} className="hover:bg-gray-800/30">
                  <td className="px-4 py-3">
                    <div className="text-sm text-white">{admin.email}</div>
                    <div className="text-xs text-gray-500">
                      Passkeys: {admin._count.webAuthnCredentials} | Backup: {admin._count.recoveryCodes}
                    </div>
                  </td>
                  <td className="px-4 py-3">{getRoleBadge(admin.role)}</td>
                  <td className="px-4 py-3">
                    {admin.isActive ? (
                      <span className="px-2 py-1 text-xs rounded-md border bg-green-500/10 text-green-400 border-green-500/20">
                        Активен
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs rounded-md border bg-red-500/10 text-red-400 border-red-500/20">
                        Деактивирован
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {new Date(admin.createdAt).toLocaleDateString('ru-RU')}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {admin._count.sessions}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => {
                          setActionData({ role: admin.role });
                          setActionModal({ open: true, action: 'change_role', adminId: admin.id });
                        }}
                        className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded"
                      >
                        Роль
                      </button>
                      {admin.isActive ? (
                        <button
                          onClick={() => {
                            setActionModal({ open: true, action: 'deactivate', adminId: admin.id });
                          }}
                          className="px-3 py-1 text-xs bg-yellow-600 hover:bg-yellow-700 text-white rounded"
                        >
                          Деактивировать
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setActionModal({ open: true, action: 'activate', adminId: admin.id });
                          }}
                          className="px-3 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded"
                        >
                          Активировать
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setActionModal({ open: true, action: 'delete', adminId: admin.id });
                        }}
                        className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded"
                      >
                        Удалить
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      {/* Модалка создания администратора */}
      {createModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-white mb-6">Новый администратор</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                  placeholder="admin@example.com"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Роль</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as Admin['role'] })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                >
                  <option value="SUPPORT_ADMIN">SUPPORT_ADMIN</option>
                  <option value="FINANCE_ADMIN">FINANCE_ADMIN</option>
                  <option value="SYSTEM_ADMIN">SYSTEM_ADMIN</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Временный пароль (мин. 12 символов)</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                  placeholder="Минимум 12 символов"
                />
                <p className="text-xs text-gray-500 mt-1">
                  После первого входа администратор должен настроить Passkey
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCreate}
                className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
              >
                Создать
              </button>
              <button
                onClick={() => setCreateModal(false)}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка действий */}
      {actionModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-white mb-4">
              {actionModal.action === 'change_role' && 'Изменить роль'}
              {actionModal.action === 'deactivate' && 'Деактивировать администратора'}
              {actionModal.action === 'activate' && 'Активировать администратора'}
              {actionModal.action === 'delete' && 'Удалить администратора'}
            </h3>

            {actionModal.action === 'change_role' && (
              <div>
                <label className="block text-sm text-gray-400 mb-2">Новая роль</label>
                <select
                  value={actionData.role}
                  onChange={(e) => setActionData({ role: e.target.value as Admin['role'] })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                >
                  <option value="SUPPORT_ADMIN">SUPPORT_ADMIN</option>
                  <option value="FINANCE_ADMIN">FINANCE_ADMIN</option>
                  <option value="SYSTEM_ADMIN">SYSTEM_ADMIN</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                </select>
              </div>
            )}

            {actionModal.action === 'deactivate' && (
              <p className="text-gray-400 mb-4">
                Вы уверены, что хотите деактивировать этого администратора? Все его активные сессии будут завершены.
              </p>
            )}

            {actionModal.action === 'activate' && (
              <p className="text-gray-400 mb-4">
                Вы уверены, что хотите активировать этого администратора?
              </p>
            )}

            {actionModal.action === 'delete' && (
              <p className="text-gray-400 mb-4">
                <strong className="text-red-400">ВНИМАНИЕ!</strong> Это действие необратимо. Администратор и все его данные будут удалены.
              </p>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleAction}
                className={`flex-1 px-4 py-2 rounded-lg text-white ${
                  actionModal.action === 'delete'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                Подтвердить
              </button>
              <button
                onClick={() => setActionModal({ open: false, action: null, adminId: null })}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </AdminPageWrapper>
  );
}
