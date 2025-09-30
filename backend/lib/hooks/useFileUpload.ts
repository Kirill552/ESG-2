'use client';

import { useState, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface UploadedFile {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress?: UploadProgress;
  result?: any;
  error?: string;
}

export interface UseFileUploadOptions {
  maxFileSize?: number; // в байтах, по умолчанию 50MB
  allowedTypes?: string[]; // MIME types
  maxFiles?: number;
  onUploadComplete?: (files: UploadedFile[]) => void;
  onUploadProgress?: (file: UploadedFile) => void;
  onUploadError?: (file: UploadedFile, error: string) => void;
}

export interface UseFileUploadReturn {
  files: UploadedFile[];
  uploading: boolean;
  progress: number; // общий прогресс 0-100
  addFiles: (fileList: FileList | File[]) => void;
  removeFile: (id: string) => void;
  clearFiles: () => void;
  uploadFiles: (category?: string) => Promise<void>;
  cancelUpload: () => void;
  validateFile: (file: File) => { valid: boolean; error?: string };
}

const DEFAULT_ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'image/jpeg',
  'image/png',
  'image/gif',
  'text/plain'
];

const DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export function useFileUpload(options: UseFileUploadOptions = {}): UseFileUploadReturn {
  const { data: session } = useSession();
  const {
    maxFileSize = DEFAULT_MAX_FILE_SIZE,
    allowedTypes = DEFAULT_ALLOWED_TYPES,
    maxFiles = 10,
    onUploadComplete,
    onUploadProgress,
    onUploadError
  } = options;

  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Валидация файла
  const validateFile = useCallback((file: File): { valid: boolean; error?: string } => {
    if (file.size > maxFileSize) {
      return {
        valid: false,
        error: `Файл превышает максимальный размер ${Math.round(maxFileSize / 1024 / 1024)} МБ`
      };
    }

    if (!allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: 'Неподдерживаемый тип файла'
      };
    }

    return { valid: true };
  }, [maxFileSize, allowedTypes]);

  // Добавление файлов
  const addFiles = useCallback((fileList: FileList | File[]) => {
    const newFiles: UploadedFile[] = [];
    const filesArray = Array.from(fileList);

    for (const file of filesArray) {
      // Проверяем лимит файлов
      if (files.length + newFiles.length >= maxFiles) {
        break;
      }

      // Проверяем, не добавлен ли уже этот файл
      const isDuplicate = files.some(f =>
        f.file.name === file.name &&
        f.file.size === file.size &&
        f.file.lastModified === file.lastModified
      );

      if (isDuplicate) {
        continue;
      }

      const validation = validateFile(file);

      newFiles.push({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        status: validation.valid ? 'pending' : 'error',
        error: validation.error
      });
    }

    setFiles(prev => [...prev, ...newFiles]);
  }, [files, maxFiles, validateFile]);

  // Удаление файла
  const removeFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  // Очистка списка файлов
  const clearFiles = useCallback(() => {
    setFiles([]);
  }, []);

  // Отмена загрузки
  const cancelUpload = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setUploading(false);

    // Сбрасываем статусы файлов
    setFiles(prev => prev.map(file => ({
      ...file,
      status: file.status === 'uploading' ? 'pending' : file.status,
      progress: undefined
    })));
  }, []);

  // Загрузка файлов
  const uploadFiles = useCallback(async (category?: string) => {
    if (!session) {
      throw new Error('Не авторизован');
    }

    const validFiles = files.filter(f => f.status === 'pending');
    if (validFiles.length === 0) {
      throw new Error('Нет файлов для загрузки');
    }

    setUploading(true);
    abortControllerRef.current = new AbortController();

    // Создаем batch для массовой загрузки (3+ файла)
    let batchId: string | null = null;
    if (validFiles.length >= 3) {
      try {
        const batchResponse = await fetch('/api/documents/create-batch', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentCount: validFiles.length }),
        });

        if (batchResponse.ok) {
          const batchData = await batchResponse.json();
          batchId = batchData.batchId;
          console.log(`📦 Создан batch для ${validFiles.length} документов: ${batchId}`);
        }
      } catch (error) {
        console.warn('⚠️ Не удалось создать batch, продолжаем без группировки:', error);
      }
    }

    const uploadPromises = validFiles.map(async (uploadFile) => {
      try {
        // Обновляем статус файла
        setFiles(prev => prev.map(f =>
          f.id === uploadFile.id
            ? { ...f, status: 'uploading', progress: { loaded: 0, total: uploadFile.file.size, percentage: 0 } }
            : f
        ));

        const formData = new FormData();
        formData.append('file', uploadFile.file);
        if (category) {
          formData.append('category', category);
        }
        if (batchId) {
          formData.append('batchId', batchId);
        }

        const response = await fetch('/api/documents/upload', {
          method: 'POST',
          credentials: 'include',
          body: formData,
          signal: abortControllerRef.current?.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.ok) {
          throw new Error(data.message || 'Не удалось загрузить файл');
        }

        // Успешная загрузка
        const updatedFile: UploadedFile = {
          ...uploadFile,
          status: 'success',
          result: data.document,
          progress: { loaded: uploadFile.file.size, total: uploadFile.file.size, percentage: 100 }
        };

        setFiles(prev => prev.map(f =>
          f.id === uploadFile.id ? updatedFile : f
        ));

        onUploadProgress?.(updatedFile);

        return updatedFile;

      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return null; // Отменено пользователем
        }

        const errorMessage = error instanceof Error ? error.message : 'Произошла ошибка при загрузке';

        const errorFile: UploadedFile = {
          ...uploadFile,
          status: 'error',
          error: errorMessage
        };

        setFiles(prev => prev.map(f =>
          f.id === uploadFile.id ? errorFile : f
        ));

        onUploadError?.(errorFile, errorMessage);

        return errorFile;
      }
    });

    try {
      const results = await Promise.all(uploadPromises);
      const successfulUploads = results.filter(r => r !== null && r.status === 'success');

      if (successfulUploads.length > 0) {
        onUploadComplete?.(successfulUploads);
      }

    } finally {
      setUploading(false);
      abortControllerRef.current = null;
    }
  }, [session, files, onUploadComplete, onUploadProgress, onUploadError]);

  // Вычисление общего прогресса
  const progress = files.length > 0
    ? Math.round(files.reduce((sum, file) => {
        if (file.status === 'success') return sum + 100;
        if (file.status === 'uploading' && file.progress) return sum + file.progress.percentage;
        return sum;
      }, 0) / files.length)
    : 0;

  return {
    files,
    uploading,
    progress,
    addFiles,
    removeFile,
    clearFiles,
    uploadFiles,
    cancelUpload,
    validateFile,
  };
}