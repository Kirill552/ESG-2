'use client';

/**
 * Страница управления компаниями
 * Список, поиск, блокировка/разблокировка, просмотр деталей
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminPageWrapper from '../components/AdminPageWrapper';

interface Organization {
  id: string;
  name: string;
  inn: string;
  kpp: string | null;
  isBlocked: boolean;
  adminNotes: string | null;
  createdAt: string;
  users: any[];
  _count: {
    users: number;
    documents: number;
    reports: number;
  };
}

export default function OrganizationsPage() {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [filters, setFilters] = useState({
    search: '',
    isBlocked: '',
  });
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [detailsModal, setDetailsModal] = useState(false);
  const [actionModal, setActionModal] = useState<{
    open: boolean;
    action: 'block' | 'unblock' | null;
    orgId: string | null;
  }>({ open: false, action: null, orgId: null });
  const [actionData, setActionData] = useState({
    blockReason: '',
  });
  const [accessModal, setAccessModal] = useState<{
    open: boolean;
    orgId: string | null;
    org: Organization | null;
  }>({ open: false, orgId: null, org: null });
  const [accessData, setAccessData] = useState({
    canUploadDocuments: true,
    canUseOCR: true,
    canGenerate296FZ: true,
    canGenerateCBAM: false,
    canExportData: true,
    canUseAnalytics: true,
    documentsPerMonth: 0,
    reportsPerMonth: 0,
    ocrPagesPerMonth: 0,
    storageQuotaMB: 0,
    usersPerOrg: 0,
    accessExpiresAt: '',
    autoExtendTrial: false,
    adminNotes: '',
  });

  useEffect(() => {
    loadOrganizations();
  }, [filters]);

  const loadOrganizations = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.isBlocked) params.append('isBlocked', filters.isBlocked);

      const response = await fetch(`/api/admin/organizations?${params}`);

      if (response.status === 401) {
        router.push('/admin/login');
        return;
      }

      if (!response.ok) throw new Error('Ошибка загрузки компаний');

      const data = await response.json();
      setOrganizations(data.organizations);
      setStats(data.stats);
    } catch (error) {
      console.error('Error loading organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (orgId: string) => {
    try {
      const response = await fetch(`/api/admin/organizations/${orgId}`);
      if (!response.ok) throw new Error('Ошибка загрузки деталей');

      const data = await response.json();
      setSelectedOrg(data.organization);
      setDetailsModal(true);
    } catch (error) {
      console.error('Error loading organization details:', error);
      alert('Ошибка при загрузке деталей компании');
    }
  };

  const handleAction = async () => {
    if (!actionModal.orgId || !actionModal.action) return;

    try {
      const response = await fetch(`/api/admin/organizations/${actionModal.orgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionModal.action,
          blockReason: actionData.blockReason,
        }),
      });

      if (!response.ok) throw new Error('Ошибка при выполнении действия');

      await loadOrganizations();

      setActionModal({ open: false, action: null, orgId: null });
      setActionData({ blockReason: '' });
    } catch (error) {
      console.error('Error processing action:', error);
      alert('Ошибка при выполнении действия');
    }
  };

  const handleOpenAccessModal = (org: Organization) => {
    setAccessData({
      canUploadDocuments: (org as any).canUploadDocuments ?? true,
      canUseOCR: (org as any).canUseOCR ?? true,
      canGenerate296FZ: (org as any).canGenerate296FZ ?? true,
      canGenerateCBAM: (org as any).canGenerateCBAM ?? false,
      canExportData: (org as any).canExportData ?? true,
      canUseAnalytics: (org as any).canUseAnalytics ?? true,
      documentsPerMonth: (org as any).documentsPerMonth ?? 0,
      reportsPerMonth: (org as any).reportsPerMonth ?? 0,
      ocrPagesPerMonth: (org as any).ocrPagesPerMonth ?? 0,
      storageQuotaMB: (org as any).storageQuotaMB ?? 0,
      usersPerOrg: (org as any).usersPerOrg ?? 0,
      accessExpiresAt: (org as any).accessExpiresAt ? new Date((org as any).accessExpiresAt).toISOString().slice(0, 16) : '',
      autoExtendTrial: (org as any).autoExtendTrial ?? false,
      adminNotes: org.adminNotes || '',
    });
    setAccessModal({ open: true, orgId: org.id, org });
  };

  const handleSaveAccess = async () => {
    if (!accessModal.orgId) return;

    try {
      const dataToSend = {
        ...accessData,
        accessExpiresAt: accessData.accessExpiresAt ? new Date(accessData.accessExpiresAt).toISOString() : null,
      };

      const response = await fetch(`/api/admin/organizations/${accessModal.orgId}/access`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend),
      });

      if (!response.ok) throw new Error('Ошибка при сохранении доступов');

      await loadOrganizations();
      setAccessModal({ open: false, orgId: null, org: null });
      alert('Доступы успешно обновлены');
    } catch (error) {
      console.error('Error saving access:', error);
      alert('Ошибка при сохранении доступов');
    }
  };

  const getStatusBadge = (org: Organization) => {
    if (org.isBlocked) {
      return <span className="px-2 py-1 text-xs rounded-md border bg-red-500/10 text-red-400 border-red-500/20">Заблокирована</span>;
    }

    const modes = org.users.map((u) => u.mode);
    if (modes.includes('PAID')) {
      return <span className="px-2 py-1 text-xs rounded-md border bg-green-500/10 text-green-400 border-green-500/20">Платная</span>;
    }
    if (modes.includes('TRIAL')) {
      return <span className="px-2 py-1 text-xs rounded-md border bg-blue-500/10 text-blue-400 border-blue-500/20">Trial</span>;
    }
    if (modes.includes('DEMO')) {
      return <span className="px-2 py-1 text-xs rounded-md border bg-yellow-500/10 text-yellow-400 border-yellow-500/20">Демо</span>;
    }

    return <span className="px-2 py-1 text-xs rounded-md border bg-gray-500/10 text-gray-400 border-gray-500/20">Неактивна</span>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Загрузка компаний...</p>
        </div>
      </div>
    );
  }

  return (
    <AdminPageWrapper
      title="Управление компаниями"
      breadcrumbs={[{ label: 'Дашборд', href: '/admin/dashboard' }, { label: 'Компании' }]}
    >
      <div className="space-y-6">
        {/* Статистика */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-900/50 rounded-lg border border-gray-800 p-4">
              <p className="text-sm text-gray-400 mb-1">Всего компаний</p>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
            </div>
            <div className="bg-gray-900/50 rounded-lg border border-gray-800 p-4">
              <p className="text-sm text-gray-400 mb-1">Активные</p>
              <p className="text-2xl font-bold text-green-400">{stats.active}</p>
            </div>
            <div className="bg-gray-900/50 rounded-lg border border-gray-800 p-4">
              <p className="text-sm text-gray-400 mb-1">Заблокированные</p>
              <p className="text-2xl font-bold text-red-400">{stats.blocked}</p>
            </div>
            <div className="bg-gray-900/50 rounded-lg border border-gray-800 p-4">
              <p className="text-sm text-gray-400 mb-1">Платные</p>
              <p className="text-2xl font-bold text-emerald-400">{stats.byMode.paid}</p>
            </div>
          </div>
        )}

        {/* Фильтры */}
        <div className="bg-gray-900/50 rounded-lg border border-gray-800 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Поиск</label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder="Название, ИНН или КПП"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Статус</label>
              <select
                value={filters.isBlocked}
                onChange={(e) => setFilters({ ...filters, isBlocked: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
              >
                <option value="">Все компании</option>
                <option value="false">Активные</option>
                <option value="true">Заблокированные</option>
              </select>
            </div>
          </div>
        </div>

        {/* Таблица компаний */}
        <div className="bg-gray-900/50 rounded-lg border border-gray-800 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-800/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Компания</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">ИНН / КПП</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Пользователей</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Документов</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Статус</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {organizations.map((org) => (
                <tr key={org.id} className="hover:bg-gray-800/30">
                  <td className="px-4 py-3">
                    <div className="text-sm text-white font-medium">{org.name}</div>
                    <div className="text-xs text-gray-400">
                      {new Date(org.createdAt).toLocaleDateString('ru-RU')}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-300">{org.inn}</div>
                    {org.kpp && <div className="text-xs text-gray-500">{org.kpp}</div>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">{org._count.users}</td>
                  <td className="px-4 py-3 text-sm text-gray-300">{org._count.documents}</td>
                  <td className="px-4 py-3">{getStatusBadge(org)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => handleViewDetails(org.id)}
                        className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded"
                      >
                        Детали
                      </button>
                      <button
                        onClick={() => handleOpenAccessModal(org)}
                        className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded"
                      >
                        Доступы
                      </button>
                      {!org.isBlocked ? (
                        <button
                          onClick={() => {
                            setActionModal({ open: true, action: 'block', orgId: org.id });
                          }}
                          className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded"
                        >
                          Заблокировать
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setActionModal({ open: true, action: 'unblock', orgId: org.id });
                          }}
                          className="px-3 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded"
                        >
                          Разблокировать
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      {/* Модалка действий */}
      {actionModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-white mb-4">
              {actionModal.action === 'block' && 'Заблокировать компанию'}
              {actionModal.action === 'unblock' && 'Разблокировать компанию'}
            </h3>

            {actionModal.action === 'block' && (
              <div>
                <label className="block text-sm text-gray-400 mb-2">Причина блокировки</label>
                <textarea
                  value={actionData.blockReason}
                  onChange={(e) => setActionData({ blockReason: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                  rows={4}
                  placeholder="Укажите причину..."
                />
              </div>
            )}

            {actionModal.action === 'unblock' && (
              <p className="text-gray-400 mb-4">
                Вы уверены, что хотите разблокировать эту компанию? Все пользователи смогут снова получить доступ к системе.
              </p>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleAction}
                className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
              >
                Подтвердить
              </button>
              <button
                onClick={() => setActionModal({ open: false, action: null, orgId: null })}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка управления доступами */}
      {accessModal.open && accessModal.org && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 max-w-3xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-white">Управление доступами: {accessModal.org.name}</h3>
              <button
                onClick={() => setAccessModal({ open: false, orgId: null, org: null })}
                className="text-gray-400 hover:text-gray-300"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              {/* Флаги доступа к функциям */}
              <div className="bg-gray-800/50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-400 mb-3">Доступ к функциям</h4>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={accessData.canUploadDocuments}
                      onChange={(e) => setAccessData({ ...accessData, canUploadDocuments: e.target.checked })}
                      className="rounded border-gray-600"
                    />
                    <span className="text-sm text-gray-300">Загрузка документов</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={accessData.canUseOCR}
                      onChange={(e) => setAccessData({ ...accessData, canUseOCR: e.target.checked })}
                      className="rounded border-gray-600"
                    />
                    <span className="text-sm text-gray-300">OCR обработка</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={accessData.canGenerate296FZ}
                      onChange={(e) => setAccessData({ ...accessData, canGenerate296FZ: e.target.checked })}
                      className="rounded border-gray-600"
                    />
                    <span className="text-sm text-gray-300">Отчеты 296-ФЗ</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={accessData.canGenerateCBAM}
                      onChange={(e) => setAccessData({ ...accessData, canGenerateCBAM: e.target.checked })}
                      className="rounded border-gray-600"
                    />
                    <span className="text-sm text-gray-300">CBAM отчеты</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={accessData.canExportData}
                      onChange={(e) => setAccessData({ ...accessData, canExportData: e.target.checked })}
                      className="rounded border-gray-600"
                    />
                    <span className="text-sm text-gray-300">Экспорт данных</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={accessData.canUseAnalytics}
                      onChange={(e) => setAccessData({ ...accessData, canUseAnalytics: e.target.checked })}
                      className="rounded border-gray-600"
                    />
                    <span className="text-sm text-gray-300">Аналитика</span>
                  </label>
                </div>
              </div>

              {/* Лимиты использования */}
              <div className="bg-gray-800/50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-400 mb-3">Лимиты использования (0 = без ограничений)</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Документов в месяц</label>
                    <input
                      type="number"
                      value={accessData.documentsPerMonth}
                      onChange={(e) => setAccessData({ ...accessData, documentsPerMonth: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Отчетов в месяц</label>
                    <input
                      type="number"
                      value={accessData.reportsPerMonth}
                      onChange={(e) => setAccessData({ ...accessData, reportsPerMonth: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Страниц OCR в месяц</label>
                    <input
                      type="number"
                      value={accessData.ocrPagesPerMonth}
                      onChange={(e) => setAccessData({ ...accessData, ocrPagesPerMonth: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Квота места (МБ)</label>
                    <input
                      type="number"
                      value={accessData.storageQuotaMB}
                      onChange={(e) => setAccessData({ ...accessData, storageQuotaMB: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Пользователей в организации</label>
                    <input
                      type="number"
                      value={accessData.usersPerOrg}
                      onChange={(e) => setAccessData({ ...accessData, usersPerOrg: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                      min="0"
                    />
                  </div>
                </div>
              </div>

              {/* Темпоральные ограничения */}
              <div className="bg-gray-800/50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-400 mb-3">Временные ограничения</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Дата истечения доступа</label>
                    <input
                      type="datetime-local"
                      value={accessData.accessExpiresAt}
                      onChange={(e) => setAccessData({ ...accessData, accessExpiresAt: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                    />
                  </div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={accessData.autoExtendTrial}
                      onChange={(e) => setAccessData({ ...accessData, autoExtendTrial: e.target.checked })}
                      className="rounded border-gray-600"
                    />
                    <span className="text-sm text-gray-300">Автоматическое продление trial</span>
                  </label>
                </div>
              </div>

              {/* Заметки администратора */}
              <div className="bg-gray-800/50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-400 mb-3">Заметки администратора</h4>
                <textarea
                  value={accessData.adminNotes}
                  onChange={(e) => setAccessData({ ...accessData, adminNotes: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                  rows={3}
                  placeholder="Внутренние заметки о компании..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSaveAccess}
                className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
              >
                Сохранить изменения
              </button>
              <button
                onClick={() => setAccessModal({ open: false, orgId: null, org: null })}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка деталей компании */}
      {detailsModal && selectedOrg && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 max-w-4xl w-full mx-4 my-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-white">{selectedOrg.name}</h3>
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
                    <p className="text-xs text-gray-500">ИНН</p>
                    <p className="text-sm text-white">{selectedOrg.inn}</p>
                  </div>
                  {selectedOrg.kpp && (
                    <div>
                      <p className="text-xs text-gray-500">КПП</p>
                      <p className="text-sm text-white">{selectedOrg.kpp}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-500">Дата регистрации</p>
                    <p className="text-sm text-white">
                      {new Date(selectedOrg.createdAt).toLocaleDateString('ru-RU')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Статус</p>
                    <p className="text-sm">{getStatusBadge(selectedOrg)}</p>
                  </div>
                </div>
              </div>

              {/* Статистика */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <p className="text-xs text-gray-400 mb-1">Пользователей</p>
                  <p className="text-2xl font-bold text-white">{selectedOrg._count.users}</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <p className="text-xs text-gray-400 mb-1">Документов</p>
                  <p className="text-2xl font-bold text-white">{selectedOrg._count.documents}</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <p className="text-xs text-gray-400 mb-1">Отчетов</p>
                  <p className="text-2xl font-bold text-white">{selectedOrg._count.reports}</p>
                </div>
              </div>

              {/* Пользователи */}
              <div className="bg-gray-800/50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-400 mb-3">Пользователи</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {selectedOrg.users.map((user: any) => (
                    <div key={user.id} className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0">
                      <div>
                        <p className="text-sm text-white">{user.name || user.email}</p>
                        <p className="text-xs text-gray-400">{user.email}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-400">{user.mode}</p>
                        {user.lastLoginAt && (
                          <p className="text-xs text-gray-500">
                            {new Date(user.lastLoginAt).toLocaleDateString('ru-RU')}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedOrg.adminNotes && (
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-400 mb-2">Заметки администратора</h4>
                  <p className="text-sm text-gray-300">{selectedOrg.adminNotes}</p>
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
      </div>
    </AdminPageWrapper>
  );
}
