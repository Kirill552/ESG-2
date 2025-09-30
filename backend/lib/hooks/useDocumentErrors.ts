'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Document } from './useDocuments';

export interface ErrorSummary {
  totalErrors: number;
  recentErrors: number;
  errorsByType: Record<string, number>;
  errorsByCategory: Record<string, number>;
  canReprocess: number;
  recommendations: Array<{
    type: 'info' | 'warning' | 'error' | 'success';
    message: string;
    action: string;
  }>;
}

export interface DocumentErrorsResponse {
  ok: boolean;
  documents: Document[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
    startIndex: number;
    endIndex: number;
  };
  stats: {
    totalErrors: number;
    errorsByType: Record<string, number>;
    canReprocess: number;
  };
  filters: {
    statuses: Array<{ value: string; label: string; icon: string }>;
    categories: Array<{ value: string; label: string; icon: string }>;
  };
}

export interface UseDocumentErrorsOptions {
  page?: number;
  pageSize?: number;
  autoFetch?: boolean;
}

export interface UseDocumentErrorsReturn {
  errorDocuments: Document[];
  pagination: DocumentErrorsResponse['pagination'] | null;
  stats: DocumentErrorsResponse['stats'] | null;
  summary: ErrorSummary | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setPage: (page: number) => void;
  reprocessErrors: (ids?: string[]) => Promise<void>;
}

export function useDocumentErrors(options: UseDocumentErrorsOptions = {}): UseDocumentErrorsReturn {
  const { data: session } = useSession();
  const { page: initialPage = 1, pageSize = 25, autoFetch = true } = options;

  // State
  const [errorDocuments, setErrorDocuments] = useState<Document[]>([]);
  const [pagination, setPagination] = useState<DocumentErrorsResponse['pagination'] | null>(null);
  const [stats, setStats] = useState<DocumentErrorsResponse['stats'] | null>(null);
  const [summary, setSummary] = useState<ErrorSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(initialPage);

  // Функция для получения документов с ошибками
  const fetchErrorDocuments = useCallback(async () => {
    if (!session) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        details: 'true',
      });

      const response = await fetch(`/api/documents/errors?${params.toString()}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: DocumentErrorsResponse = await response.json();

      if (!data.ok) {
        throw new Error(data.message || 'Не удалось загрузить документы с ошибками');
      }

      setErrorDocuments(data.documents);
      setPagination(data.pagination);
      setStats(data.stats);

    } catch (err) {
      console.error('Error fetching error documents:', err);
      setError(err instanceof Error ? err.message : 'Произошла ошибка при загрузке документов с ошибками');
      setErrorDocuments([]);
      setPagination(null);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [session, page, pageSize]);

  // Функция для получения сводки ошибок
  const fetchErrorSummary = useCallback(async () => {
    if (!session) return;

    try {
      const response = await fetch('/api/documents/error-summary', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.ok) {
        throw new Error(data.message || 'Не удалось загрузить сводку ошибок');
      }

      setSummary(data.summary);

    } catch (err) {
      console.error('Error fetching error summary:', err);
      // Не устанавливаем error здесь, так как это второстепенная функция
    }
  }, [session]);

  // Функция переобработки документов с ошибками
  const reprocessErrors = useCallback(async (ids?: string[]) => {
    if (!session) throw new Error('Не авторизован');

    // Если IDs не переданы, используем все документы с ошибками на текущей странице
    const documentIds = ids || errorDocuments.map(doc => doc.id);

    if (documentIds.length === 0) {
      throw new Error('Нет документов для переобработки');
    }

    const response = await fetch('/api/documents/reprocess', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        documentIds,
        errorFilter: true // Указываем, что это операция для документов с ошибками
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.ok) {
      throw new Error(data.message || 'Не удалось переобработать документы');
    }

    // Обновляем данные
    await Promise.all([fetchErrorDocuments(), fetchErrorSummary()]);

    return data;
  }, [session, errorDocuments, fetchErrorDocuments, fetchErrorSummary]);

  // Функция обновления данных
  const refresh = useCallback(async () => {
    await Promise.all([fetchErrorDocuments(), fetchErrorSummary()]);
  }, [fetchErrorDocuments, fetchErrorSummary]);

  // Автоматическая загрузка при изменении параметров
  useEffect(() => {
    if (autoFetch && session) {
      fetchErrorDocuments();
    }
  }, [session, page, autoFetch, fetchErrorDocuments]);

  // Загрузка сводки при первом рендере
  useEffect(() => {
    if (autoFetch && session) {
      fetchErrorSummary();
    }
  }, [session, autoFetch, fetchErrorSummary]);

  return {
    errorDocuments,
    pagination,
    stats,
    summary,
    loading,
    error,
    refresh,
    setPage,
    reprocessErrors,
  };
}