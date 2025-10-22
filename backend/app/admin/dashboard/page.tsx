'use client';

/**
 * Дашборд администратора
 * Глобальная статистика, графики, алерты
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminPageWrapper from '../components/AdminPageWrapper';

interface DashboardData {
  statistics: {
    organizations: {
      total: number;
      active: number;
      blocked: number;
      demo: number;
    };
    users: {
      total: number;
      byMode: {
        demo: number;
        trial: number;
        paid: number;
        expired: number;
      };
    };
    activeSessions: number;
    documentsThisMonth: {
      count: number;
      change: number;
    };
    reportsThisMonth: {
      count: number;
      change: number;
    };
    trialRequests: {
      pending: number;
      processing: number;
      total: number;
    };
  };
  trends: {
    registrations: {
      thisWeek: number;
      lastWeek: number;
      change: number;
    };
  };
  alerts: {
    criticalIncidents: {
      count: number;
      severity: string;
    };
    newTrialRequests: {
      count: number;
      recent: any[];
    };
    expiringTrials: {
      count: number;
      users: any[];
    };
  };
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const response = await fetch('/api/admin/dashboard');

      if (response.status === 401) {
        router.push('/admin/login');
        return;
      }

      if (!response.ok) {
        throw new Error('Ошибка загрузки данных');
      }

      const dashboardData = await response.json();
      setData(dashboardData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Загрузка дашборда...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || 'Ошибка загрузки данных'}</p>
          <button
            onClick={loadDashboard}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
          >
            Повторить попытку
          </button>
        </div>
      </div>
    );
  }

  const StatCard = ({ title, value, change, icon }: any) => (
    <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl border border-gray-800 p-6 hover:border-gray-700 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-400">{title}</h3>
        <div className="text-emerald-500">{icon}</div>
      </div>
      <div className="flex items-baseline gap-2">
        <p className="text-3xl font-bold text-white">{value.toLocaleString('ru-RU')}</p>
        {change !== undefined && (
          <span
            className={`text-sm font-medium ${
              change >= 0 ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {change >= 0 ? '+' : ''}
            {change.toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );

  const AlertBadge = ({ count, label, color = 'yellow', onClick }: any) => {
    const colors = {
      red: 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20',
      yellow: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20 hover:bg-yellow-500/20',
      green: 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20',
    };

    return (
      <button
        onClick={onClick}
        className={`px-4 py-3 rounded-lg border ${colors[color as keyof typeof colors]} transition-all cursor-pointer`}
      >
        <p className="text-sm font-medium">
          {count} {label}
        </p>
      </button>
    );
  };

  return (
    <AdminPageWrapper
      title="Обзор системы"
      breadcrumbs={[{ label: 'Дашборд' }]}
    >
      {/* Алерты */}
      {(data.alerts.newTrialRequests.count > 0 ||
        data.alerts.expiringTrials.count > 0 ||
        data.alerts.criticalIncidents.count > 0) && (
        <div className="mb-6 bg-gray-900/50 backdrop-blur-xl rounded-xl border border-gray-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Требуют внимания
          </h2>
          <div className="flex flex-wrap gap-3">
            {data.alerts.newTrialRequests.count > 0 && (
              <AlertBadge
                count={data.alerts.newTrialRequests.count}
                label="новых заявок"
                color="yellow"
                onClick={() => router.push('/admin/trial-requests')}
              />
            )}
            {data.alerts.expiringTrials.count > 0 && (
              <AlertBadge
                count={data.alerts.expiringTrials.count}
                label="заканчивающихся trial"
                color="yellow"
                onClick={() => router.push('/admin/users?filter=expiring')}
              />
            )}
            {data.alerts.criticalIncidents.count > 0 && (
              <AlertBadge
                count={data.alerts.criticalIncidents.count}
                label="критических ошибок"
                color="red"
                onClick={() => router.push('/admin/logs?severity=critical')}
              />
            )}
          </div>
        </div>
      )}

      {/* Статистика - первый ряд */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <StatCard
          title="Всего компаний"
          value={data.statistics.organizations.total}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          }
        />
        <StatCard
          title="Всего пользователей"
          value={data.statistics.users.total}
          change={data.trends.registrations.change}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
          }
        />
        <StatCard
          title="Активных сессий"
          value={data.statistics.activeSessions}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
        />
        <StatCard
          title="Заявок на рассмотрении"
          value={data.statistics.trialRequests.total}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
          }
        />
      </div>

      {/* Статистика - второй ряд */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <StatCard
          title="Документов за месяц"
          value={data.statistics.documentsThisMonth.count}
          change={data.statistics.documentsThisMonth.change}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
          }
        />
        <StatCard
          title="Отчетов за месяц"
          value={data.statistics.reportsThisMonth.count}
          change={data.statistics.reportsThisMonth.change}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          }
        />
        <StatCard
          title="DEMO пользователей"
          value={data.statistics.users.byMode.demo}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
          }
        />
        <StatCard
          title="PAID пользователей"
          value={data.statistics.users.byMode.paid}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
        />
      </div>

      {/* Навигация к разделам */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <button
          onClick={() => router.push('/admin/trial-requests')}
          className="bg-gray-900/50 backdrop-blur-xl rounded-xl border border-gray-800 p-6 hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/10 transition-all text-left group"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-yellow-500/10 rounded-lg flex items-center justify-center group-hover:bg-yellow-500/20 transition-colors">
              <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white">Заявки на доступ</h3>
          </div>
          <p className="text-gray-400 text-sm mb-4">
            Управление запросами на trial и платные тарифы
          </p>
          <div className="text-emerald-500 text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
            {data.statistics.trialRequests.pending} ожидают рассмотрения
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>

        <button
          onClick={() => router.push('/admin/users')}
          className="bg-gray-900/50 backdrop-blur-xl rounded-xl border border-gray-800 p-6 hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/10 transition-all text-left group"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white">Пользователи</h3>
          </div>
          <p className="text-gray-400 text-sm mb-4">
            Управление всеми пользователями платформы
          </p>
          <div className="text-emerald-500 text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
            {data.statistics.users.total} пользователей
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>

        <button
          onClick={() => router.push('/admin/organizations')}
          className="bg-gray-900/50 backdrop-blur-xl rounded-xl border border-gray-800 p-6 hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/10 transition-all text-left group"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white">Компании</h3>
          </div>
          <p className="text-gray-400 text-sm mb-4">
            Просмотр и управление зарегистрированными организациями
          </p>
          <div className="text-emerald-500 text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
            {data.statistics.organizations.total} компаний
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>

        <button
          onClick={() => router.push('/admin/logs')}
          className="bg-gray-900/50 backdrop-blur-xl rounded-xl border border-gray-800 p-6 hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/10 transition-all text-left group"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-gray-500/10 rounded-lg flex items-center justify-center group-hover:bg-gray-500/20 transition-colors">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white">Логи и аудит</h3>
          </div>
          <p className="text-gray-400 text-sm mb-4">
            Просмотр действий пользователей и инцидентов безопасности
          </p>
          <div className="text-emerald-500 text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
            Перейти к логам
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>
      </div>
    </AdminPageWrapper>
  );
}
