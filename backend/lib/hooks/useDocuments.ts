'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

// Типы для документов
export interface DocumentMetadata {
  icon: string;
  name: string;
  category: string;
  color: string;
  bgColor: string;
}

export interface TransportData {
  vehicle?: {
    model?: string;
    licensePlate?: string;
    fuelType?: {
      fuelType: 'diesel' | 'gasoline' | 'gas';
      confidence: number;
      reasoning?: string;
    };
  };
  route?: {
    from?: string;
    to?: string;
    distance?: {
      distance: number;
      distanceSource?: string;
      confidence?: number;
    };
  };
  emissions?: number;
  fuelConsumed?: number;
  userOverride?: {
    fuelType?: string;
    yearOfManufacture?: number;
    actualConsumption?: number;
  };
}

export interface Document {
  id: string;
  fileName: string;
  originalName: string;
  fileSize: number;
  formattedFileSize: string;
  fileType: string;
  status: 'UPLOADED' | 'PROCESSING' | 'PROCESSED' | 'FAILED';
  category: 'PRODUCTION' | 'SUPPLIERS' | 'WASTE' | 'TRANSPORT' | 'ENERGY' | 'OTHER';
  createdAt: string;
  updatedAt: string;
  processingProgress: number;
  processingMessage?: string;
  fileTypeMetadata: DocumentMetadata;
  statusMetadata: DocumentMetadata;
  categoryMetadata: DocumentMetadata;
  displayName: string;
  isProcessing: boolean;
  hasError: boolean;
  isCompleted: boolean;
  progressPercent: number;
  ocrData?: any; // Полные данные OCR
  transportData?: TransportData; // Извлеченные транспортные данные
  extractedINN?: string | null; // ИНН извлеченный из документа через OCR
  innMatches?: boolean | null; // Совпадает ли extractedINN с ИНН организации
}

export interface DocumentsResponse {
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
    total: number;
    uploaded: number;
    processed: number;
    processing: number;
    failed: number;
  };
  filters: {
    statuses: Array<{ value: string; label: string; icon: string }>;
    categories: Array<{ value: string; label: string; icon: string }>;
  };
  sorting: {
    field: string;
    order: string;
    available: Array<{ value: string; label: string }>;
  };
}

export interface DocumentsFilters {
  q?: string;
  status?: string;
  category?: string;
  page?: number;
  pageSize?: number;
  order?: string;
}

export interface UseDocumentsOptions {
  initialFilters?: DocumentsFilters;
  autoFetch?: boolean;
}

export interface UseDocumentsReturn {
  documents: Document[];
  pagination: DocumentsResponse['pagination'] | null;
  stats: DocumentsResponse['stats'] | null;
  filters: DocumentsResponse['filters'] | null;
  sorting: DocumentsResponse['sorting'] | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setFilters: (filters: DocumentsFilters) => void;
  uploadDocument: (file: File, category?: string) => Promise<Document>;
  deleteDocument: (id: string) => Promise<void>;
  downloadDocument: (id: string, filename: string) => Promise<void>;
  reprocessDocuments: (ids: string[]) => Promise<{ ok: boolean; message: string; results: any }>;
  bulkAction: (action: string, ids: string[], options?: any) => Promise<{ ok: boolean; message: string; results: any }>;
}

export function useDocuments(options: UseDocumentsOptions = {}): UseDocumentsReturn {
  const { data: session } = useSession();
  const { initialFilters = {}, autoFetch = true } = options;

  // State
  const [documents, setDocuments] = useState<Document[]>([]);
  const [pagination, setPagination] = useState<DocumentsResponse['pagination'] | null>(null);
  const [stats, setStats] = useState<DocumentsResponse['stats'] | null>(null);
  const [filters, setFiltersState] = useState<DocumentsResponse['filters'] | null>(null);
  const [sorting, setSorting] = useState<DocumentsResponse['sorting'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFilters, setCurrentFilters] = useState<DocumentsFilters>(initialFilters);

  // Функция для получения документов
  const fetchDocuments = useCallback(async (fetchFilters: DocumentsFilters = {}) => {
    if (!session) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();

      // Добавляем фильтры в URL параметры
      Object.entries({ ...currentFilters, ...fetchFilters }).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          params.append(key, String(value));
        }
      });

      const response = await fetch(`/api/documents?${params.toString()}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: DocumentsResponse = await response.json();

      if (!data.ok) {
        throw new Error(data.message || 'Не удалось загрузить документы');
      }

      setDocuments(data.documents);
      setPagination(data.pagination);
      setStats(data.stats);
      setFiltersState(data.filters);
      setSorting(data.sorting);

    } catch (err) {
      console.error('Error fetching documents:', err);
      setError(err instanceof Error ? err.message : 'Произошла ошибка при загрузке документов');
      setDocuments([]);
      setPagination(null);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [session, currentFilters]);

  // Функция для обновления фильтров
  const setFilters = useCallback((newFilters: DocumentsFilters) => {
    setCurrentFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  // Функция загрузки документа
  const uploadDocument = useCallback(async (file: File, category?: string): Promise<Document> => {
    if (!session) throw new Error('Не авторизован');

    const formData = new FormData();
    formData.append('file', file);
    if (category) {
      formData.append('category', category);
    }

    const response = await fetch('/api/documents/upload', {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.ok) {
      throw new Error(data.message || 'Не удалось загрузить файл');
    }

    // Обновляем список документов
    await fetchDocuments();

    return data.document;
  }, [session, fetchDocuments]);

  // Функция удаления документа
  const deleteDocument = useCallback(async (id: string): Promise<void> => {
    if (!session) throw new Error('Не авторизован');

    const response = await fetch(`/api/documents/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.ok) {
      throw new Error(data.message || 'Не удалось удалить документ');
    }

    // Обновляем список документов
    await fetchDocuments();
  }, [session, fetchDocuments]);

  // Функция скачивания документа
  const downloadDocument = useCallback(async (id: string, filename: string): Promise<void> => {
    if (!session) throw new Error('Не авторизован');

    const response = await fetch(`/api/documents/${id}/download`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Создаем blob и скачиваем файл
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }, [session]);

  // Функция переобработки документов
  const reprocessDocuments = useCallback(async (ids: string[]) => {
    if (!session) throw new Error('Не авторизован');

    const response = await fetch('/api/documents/reprocess', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ documentIds: ids }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.ok) {
      throw new Error(data.message || 'Не удалось переобработать документы');
    }

    // Обновляем список документов
    await fetchDocuments();

    return data;
  }, [session, fetchDocuments]);

  // Функция массовых операций
  const bulkAction = useCallback(async (action: string, ids: string[], options?: any) => {
    if (!session) throw new Error('Не авторизован');

    const response = await fetch('/api/documents/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ operation: action, documentIds: ids, options }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.ok) {
      throw new Error(data.message || 'Не удалось выполнить операцию');
    }

    // Обновляем список документов
    await fetchDocuments();

    return data;
  }, [session, fetchDocuments]);

  // Функция обновления
  const refresh = useCallback(async () => {
    await fetchDocuments();
  }, [fetchDocuments]);

  // Автоматическая загрузка при изменении фильтров
  useEffect(() => {
    if (autoFetch && session) {
      fetchDocuments();
    }
  }, [session, currentFilters, autoFetch, fetchDocuments]);

  return {
    documents,
    pagination,
    stats,
    filters,
    sorting,
    loading,
    error,
    refresh,
    setFilters,
    uploadDocument,
    deleteDocument,
    downloadDocument,
    reprocessDocuments,
    bulkAction,
  };
}