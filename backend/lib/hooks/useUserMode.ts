/**
 * React хук для работы с режимом пользователя
 */

import { useState, useEffect } from 'react';

interface UserFeatures {
  upload: boolean;
  generateReports: boolean;
  analytics: boolean;
  export: boolean;
}

interface UserLimits {
  documentsPerMonth: number;
  reportsPerMonth: number;
  analyticsAccess: boolean;
  exportAccess: boolean;
}

interface UserModeData {
  mode: 'DEMO' | 'TRIAL' | 'PAID' | 'EXPIRED';
  features: UserFeatures;
  limits: UserLimits;
  isDemoMode: boolean;
}

export function useUserMode() {
  const [userMode, setUserMode] = useState<UserModeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUserMode() {
      try {
        const response = await fetch('/api/user/features');
        const data = await response.json();

        if (data.ok) {
          setUserMode({
            mode: data.mode,
            features: data.features,
            limits: data.limits,
            isDemoMode: data.isDemoMode
          });
        } else {
          setError(data.message || 'Ошибка загрузки данных пользователя');
        }
      } catch (err) {
        setError('Ошибка сети при загрузке данных пользователя');
        console.error('Error fetching user mode:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchUserMode();
  }, []);

  return {
    userMode,
    loading,
    error,
    isDemoMode: userMode?.isDemoMode || false,
    canUpload: userMode?.features.upload || false,
    canGenerateReports: userMode?.features.generateReports || false,
    canViewAnalytics: userMode?.features.analytics || false,
    canExport: userMode?.features.export || false,
    refetch: () => {
      setLoading(true);
      setError(null);
      // Повторный вызов useEffect
      window.location.reload();
    }
  };
}

/**
 * Хук для получения данных с учетом режима пользователя
 */
export function useUserModeData<T>(
  demoData: T,
  realDataFetcher: () => Promise<T>,
  dependencies: any[] = []
) {
  const { isDemoMode, loading: modeLoading } = useUserMode();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (modeLoading) return;

    async function fetchData() {
      try {
        setLoading(true);

        if (isDemoMode) {
          setData(demoData);
        } else {
          const realData = await realDataFetcher();
          setData(realData);
        }
      } catch (err) {
        setError('Ошибка загрузки данных');
        console.error('Error fetching user mode data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [isDemoMode, modeLoading, ...dependencies]);

  return {
    data,
    loading: loading || modeLoading,
    error,
    isDemoMode
  };
}