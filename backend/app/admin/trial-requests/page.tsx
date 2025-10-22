'use client';

/**
 * Страница управления заявками на доступ
 * Фильтры, поиск, одобрение/отклонение
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminPageWrapper from '../components/AdminPageWrapper';
import DataTable, { Column } from '../components/DataTable';
import ConfirmDialog from '../components/ConfirmDialog';

interface TrialRequest {
  id: string;
  userEmail: string;
  userName: string;
  companyName: string;
  position: string;
  phone: string | null;
  message: string;
  requestType: string;
  status: string;
  createdAt: string;
  processedAt: string | null;
  processedBy: string | null;
  adminNotes: string | null;
}

export default function TrialRequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<TrialRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [filters, setFilters] = useState({
    status: '',
    type: '',
    search: '',
  });
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    action: 'approve' | 'reject' | null;
    request: TrialRequest | null;
  }>({ isOpen: false, action: null, request: null });
  const [actionLoading, setActionLoading] = useState(false);
  const [approvalModal, setApprovalModal] = useState<{
    isOpen: boolean;
    requestId: string | null;
  }>({ isOpen: false, requestId: null });
  const [approvalData, setApprovalData] = useState({
    userMode: 'TRIAL',
    trialDurationDays: 14,
    adminNotes: '',
  });

  useEffect(() => {
    loadRequests();
  }, [filters]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.type) params.append('type', filters.type);
      if (filters.search) params.append('search', filters.search);

      const response = await fetch(`/api/admin/trial-requests?${params}`);

      if (response.status === 401) {
        router.push('/admin/login');
        return;
      }

      if (!response.ok) throw new Error('Ошибка загрузки заявок');

      const data = await response.json();
      setRequests(data.requests);
      setStats(data.stats);
    } catch (error) {
      console.error('Error loading requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!confirmDialog.request) return;

    try {
      setActionLoading(true);
      const response = await fetch(`/api/admin/trial-requests/${confirmDialog.request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          rejectionReason: 'Отклонено администратором',
        }),
      });

      if (!response.ok) throw new Error('Ошибка при отклонении заявки');

      await loadRequests();
      setConfirmDialog({ isOpen: false, action: null, request: null });
    } catch (error) {
      console.error('Error rejecting request:', error);
      alert('Ошибка при отклонении заявки');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!approvalModal.requestId) return;

    try {
      setActionLoading(true);
      const response = await fetch(`/api/admin/trial-requests/${approvalModal.requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          ...approvalData,
        }),
      });

      if (!response.ok) throw new Error('Ошибка при одобрении заявки');

      await loadRequests();
      setApprovalModal({ isOpen: false, requestId: null });
      setApprovalData({
        userMode: 'TRIAL',
        trialDurationDays: 14,
        adminNotes: '',
      });
    } catch (error) {
      console.error('Error approving request:', error);
      alert('Ошибка при одобрении заявки');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      PROCESSING: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      APPROVED: 'bg-green-500/10 text-green-400 border-green-500/20',
      REJECTED: 'bg-red-500/10 text-red-400 border-red-500/20',
    };

    const labels: Record<string, string> = {
      PENDING: 'Ожидает',
      PROCESSING: 'В обработке',
      APPROVED: 'Одобрена',
      REJECTED: 'Отклонена',
    };

    return (
      <span className={`px-2 py-1 text-xs rounded-md border ${colors[status] || 'bg-gray-500/10 text-gray-400'}`}>
        {labels[status] || status}
      </span>
    );
  };

  const columns: Column<TrialRequest>[] = [
    {
      key: 'createdAt',
      label: 'Дата',
      sortable: true,
      width: 'w-32',
      render: (req) => new Date(req.createdAt).toLocaleDateString('ru-RU'),
    },
    {
      key: 'userName',
      label: 'Пользователь',
      sortable: true,
      render: (req) => (
        <div>
          <div className="text-sm text-white font-medium">{req.userName}</div>
          <div className="text-xs text-gray-400">{req.userEmail}</div>
        </div>
      ),
    },
    {
      key: 'companyName',
      label: 'Компания',
      sortable: true,
      render: (req) => <span className="text-sm">{req.companyName}</span>,
    },
    {
      key: 'requestType',
      label: 'Тип',
      width: 'w-32',
      render: (req) => (
        <span className="text-xs px-2 py-1 bg-gray-800 text-gray-300 rounded">
          {req.requestType === 'TRIAL' ? 'Trial' : 'Полный доступ'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Статус',
      width: 'w-36',
      render: (req) => getStatusBadge(req.status),
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Загрузка заявок...</p>
        </div>
      </div>
    );
  }

  return (
    <AdminPageWrapper
      title="Заявки на доступ"
      breadcrumbs={[{ label: 'Дашборд', href: '/admin/dashboard' }, { label: 'Заявки' }]}
    >
      <div className="space-y-6">
        {/* Статистика */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gray-900/50 rounded-lg border border-gray-800 p-4">
              <p className="text-sm text-gray-400 mb-1">Ожидают</p>
              <p className="text-2xl font-bold text-yellow-400">{stats.pending}</p>
            </div>
            <div className="bg-gray-900/50 rounded-lg border border-gray-800 p-4">
              <p className="text-sm text-gray-400 mb-1">В обработке</p>
              <p className="text-2xl font-bold text-blue-400">{stats.processing}</p>
            </div>
            <div className="bg-gray-900/50 rounded-lg border border-gray-800 p-4">
              <p className="text-sm text-gray-400 mb-1">Одобрены</p>
              <p className="text-2xl font-bold text-green-400">{stats.approved}</p>
            </div>
            <div className="bg-gray-900/50 rounded-lg border border-gray-800 p-4">
              <p className="text-sm text-gray-400 mb-1">Отклонены</p>
              <p className="text-2xl font-bold text-red-400">{stats.rejected}</p>
            </div>
          </div>
        )}

        {/* Таблица с фильтрами */}
        <DataTable
          columns={columns}
          data={requests}
          keyExtractor={(req) => req.id}
          searchable
          searchPlaceholder="Поиск по email, имени или компании..."
          filters={
            <>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
              >
                <option value="">Все статусы</option>
                <option value="PENDING">Ожидают</option>
                <option value="PROCESSING">В обработке</option>
                <option value="APPROVED">Одобрены</option>
                <option value="REJECTED">Отклонены</option>
              </select>
              <select
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                className="px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
              >
                <option value="">Все типы</option>
                <option value="TRIAL">Trial</option>
                <option value="FULL_ACCESS">Полный доступ</option>
              </select>
            </>
          }
          rowActions={(req) =>
            req.status === 'PENDING' ? (
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setApprovalModal({ isOpen: true, requestId: req.id })}
                  className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  Одобрить
                </button>
                <button
                  onClick={() => setConfirmDialog({ isOpen: true, action: 'reject', request: req })}
                  className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  Отклонить
                </button>
              </div>
            ) : null
          }
          emptyMessage="Нет заявок для отображения"
        />
      </div>

      {/* Диалог подтверждения отклонения */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, action: null, request: null })}
        onConfirm={handleReject}
        title="Отклонить заявку?"
        message={`Вы уверены что хотите отклонить заявку от ${confirmDialog.request?.userName} (${confirmDialog.request?.userEmail})?`}
        confirmText="Отклонить"
        variant="danger"
        loading={actionLoading}
      />

      {/* Модалка одобрения */}
      {approvalModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !actionLoading && setApprovalModal({ isOpen: false, requestId: null })} />
          <div className="relative bg-gray-900 border border-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-xl font-bold text-white mb-4">Одобрить заявку</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Режим доступа</label>
                  <select
                    value={approvalData.userMode}
                    onChange={(e) => setApprovalData({ ...approvalData, userMode: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="TRIAL">Trial (пробный период)</option>
                    <option value="PAID">Paid (платный доступ)</option>
                  </select>
                </div>

                {approvalData.userMode === 'TRIAL' && (
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Длительность trial (дней)</label>
                    <input
                      type="number"
                      value={approvalData.trialDurationDays}
                      onChange={(e) => setApprovalData({ ...approvalData, trialDurationDays: parseInt(e.target.value) || 14 })}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                      min="1"
                      max="365"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Комментарий (необязательно)</label>
                  <textarea
                    value={approvalData.adminNotes}
                    onChange={(e) => setApprovalData({ ...approvalData, adminNotes: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                    rows={3}
                    placeholder="Примечания для внутреннего использования..."
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setApprovalModal({ isOpen: false, requestId: null })}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Отмена
                </button>
                <button
                  onClick={handleApprove}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {actionLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      <span>Обработка...</span>
                    </>
                  ) : (
                    'Одобрить'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminPageWrapper>
  );
}
