import { Logger } from "@/lib/logger";

const logger = new Logger("file-metadata-service");

// Маппинг MIME типов к иконкам и человекочитаемым названиям
export const FILE_TYPE_METADATA = {
  'application/pdf': {
    icon: '📄',
    name: 'PDF документ',
    category: 'document',
    color: '#DC2626', // red-600
    bgColor: '#FEE2E2' // red-100
  },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
    icon: '📊',
    name: 'Excel таблица',
    category: 'spreadsheet',
    color: '#16A34A', // green-600
    bgColor: '#DCFCE7' // green-100
  },
  'application/vnd.ms-excel': {
    icon: '📊',
    name: 'Excel таблица (старая)',
    category: 'spreadsheet',
    color: '#16A34A',
    bgColor: '#DCFCE7'
  },
  'text/csv': {
    icon: '📈',
    name: 'CSV файл',
    category: 'spreadsheet',
    color: '#059669', // emerald-600
    bgColor: '#D1FAE5' // emerald-100
  },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    icon: '📝',
    name: 'Word документ',
    category: 'document',
    color: '#2563EB', // blue-600
    bgColor: '#DBEAFE' // blue-100
  },
  'application/msword': {
    icon: '📝',
    name: 'Word документ (старый)',
    category: 'document',
    color: '#2563EB',
    bgColor: '#DBEAFE'
  },
  'image/jpeg': {
    icon: '🖼️',
    name: 'JPEG изображение',
    category: 'image',
    color: '#7C3AED', // violet-600
    bgColor: '#EDE9FE' // violet-100
  },
  'image/png': {
    icon: '🖼️',
    name: 'PNG изображение',
    category: 'image',
    color: '#7C3AED',
    bgColor: '#EDE9FE'
  },
  'image/gif': {
    icon: '🎞️',
    name: 'GIF изображение',
    category: 'image',
    color: '#7C3AED',
    bgColor: '#EDE9FE'
  },
  'text/plain': {
    icon: '📄',
    name: 'Текстовый файл',
    category: 'document',
    color: '#6B7280', // gray-500
    bgColor: '#F3F4F6' // gray-100
  },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': {
    icon: '📊',
    name: 'PowerPoint презентация',
    category: 'presentation',
    color: '#EA580C', // orange-600
    bgColor: '#FED7AA' // orange-100
  }
};

// Статусы документов с метаданными
export const DOCUMENT_STATUS_METADATA = {
  'UPLOADED': {
    label: 'Загружен',
    color: '#6B7280', // gray-500
    bgColor: '#F3F4F6', // gray-100
    icon: '⬆️'
  },
  'QUEUED': {
    label: 'В очереди',
    color: '#3B82F6', // blue-500
    bgColor: '#DBEAFE', // blue-100
    icon: '🔄'
  },
  'PROCESSING': {
    label: 'Обрабатывается',
    color: '#F59E0B', // amber-500
    bgColor: '#FEF3C7', // amber-100
    icon: '⏳'
  },
  'PROCESSED': {
    label: 'Обработан',
    color: '#16A34A', // green-600
    bgColor: '#DCFCE7', // green-100
    icon: '✅'
  },
  'FAILED': {
    label: 'Ошибка распознавания',
    color: '#DC2626', // red-600
    bgColor: '#FEE2E2', // red-100
    icon: '❌'
  }
};

// Категории документов с метаданными
export const DOCUMENT_CATEGORY_METADATA = {
  'PRODUCTION': {
    label: 'Производство',
    color: '#0EA5E9', // sky-500
    bgColor: '#E0F2FE', // sky-100
    icon: '🏭'
  },
  'SUPPLIERS': {
    label: 'Поставщики',
    color: '#8B5CF6', // violet-500
    bgColor: '#EDE9FE', // violet-100
    icon: '🚛'
  },
  'WASTE': {
    label: 'Отходы',
    color: '#F59E0B', // amber-500
    bgColor: '#FEF3C7', // amber-100
    icon: '🗑️'
  },
  'TRANSPORT': {
    label: 'Транспорт',
    color: '#06B6D4', // cyan-500
    bgColor: '#CFFAFE', // cyan-100
    icon: '🚚'
  },
  'ENERGY': {
    label: 'Энергия',
    color: '#EAB308', // yellow-500
    bgColor: '#FEF9C3', // yellow-100
    icon: '⚡'
  },
  'OTHER': {
    label: 'Другое',
    color: '#6B7280', // gray-500
    bgColor: '#F3F4F6', // gray-100
    icon: '📋'
  }
};

// Функция для форматирования размера файла
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Б';

  const k = 1024;
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Функция для получения метаданных типа файла
export function getFileTypeMetadata(mimeType: string) {
  return FILE_TYPE_METADATA[mimeType as keyof typeof FILE_TYPE_METADATA] || {
    icon: '📄',
    name: 'Неизвестный файл',
    category: 'unknown',
    color: '#6B7280',
    bgColor: '#F3F4F6'
  };
}

// Функция для получения метаданных статуса
export function getStatusMetadata(status: string) {
  return DOCUMENT_STATUS_METADATA[status as keyof typeof DOCUMENT_STATUS_METADATA] || {
    label: status,
    color: '#6B7280',
    bgColor: '#F3F4F6',
    icon: '❓'
  };
}

// Функция для получения метаданных категории
export function getCategoryMetadata(category: string) {
  return DOCUMENT_CATEGORY_METADATA[category as keyof typeof DOCUMENT_CATEGORY_METADATA] || {
    label: category,
    color: '#6B7280',
    bgColor: '#F3F4F6',
    icon: '📋'
  };
}

// Функция для обогащения документа метаданными
export function enrichDocumentWithMetadata(document: any) {
  const fileTypeMetadata = getFileTypeMetadata(document.fileType);
  const statusMetadata = getStatusMetadata(document.status);
  const categoryMetadata = getCategoryMetadata(document.category);

  // Извлекаем транспортные данные из ocrData если документ из категории "Транспорт"
  let transportData = null;
  if (document.category === 'TRANSPORT' && document.ocrData) {
    const ocrData = typeof document.ocrData === 'string'
      ? JSON.parse(document.ocrData)
      : document.ocrData;

    if (ocrData.transportData) {
      transportData = ocrData.transportData;
    }
  }

  return {
    ...document,
    fileSize: typeof document.fileSize === 'number' ? document.fileSize : parseInt(document.fileSize),
    formattedFileSize: formatFileSize(document.fileSize),
    fileTypeMetadata,
    statusMetadata,
    categoryMetadata,
    // Добавляем удобные поля для UI
    displayName: document.originalName || document.fileName,
    isProcessing: document.status === 'PROCESSING',
    hasError: document.status === 'FAILED',
    isCompleted: document.status === 'PROCESSED',
    progressPercent: document.processingProgress || 0,
    // Транспортные данные (только для категории TRANSPORT)
    transportData: transportData
  };
}

// Функция для получения доступных фильтров
export function getAvailableFilters() {
  return {
    statuses: Object.entries(DOCUMENT_STATUS_METADATA).map(([key, value]) => ({
      value: key,
      label: value.label,
      icon: value.icon
    })),
    categories: Object.entries(DOCUMENT_CATEGORY_METADATA).map(([key, value]) => ({
      value: key,
      label: value.label,
      icon: value.icon
    }))
  };
}

// Функция для валидации сортировки
export function validateSortField(field: string): boolean {
  const allowedFields = ['fileName', 'originalName', 'fileSize', 'fileType', 'status', 'category', 'createdAt', 'updatedAt', 'processingProgress'];
  return allowedFields.includes(field);
}

// Функция для получения человекочитаемого названия поля сортировки
export function getSortFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    'fileName': 'Название файла',
    'originalName': 'Оригинальное название',
    'fileSize': 'Размер файла',
    'fileType': 'Тип файла',
    'status': 'Статус',
    'category': 'Категория',
    'createdAt': 'Дата создания',
    'updatedAt': 'Дата обновления',
    'processingProgress': 'Прогресс обработки'
  };

  return labels[field] || field;
}