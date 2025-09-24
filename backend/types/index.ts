// ============================================================================
// Основные типы для ESG-Lite MVP
// ============================================================================

/**
 * Статусы обработки файлов
 */
export type ProcessingStatus = 
  | 'pending'     // Ожидает обработки
  | 'processing'  // В процессе обработки
  | 'completed'   // Завершено
  | 'failed'      // Ошибка
  | 'cancelled'   // Отменено

/**
 * Типы файлов для загрузки
 */
export type FileType = 'pdf' | 'csv' | 'xlsx' | 'xls'

/**
 * Типы топлива согласно 296-ФЗ
 */
export type FuelType = 
  | 'electricity'    // Электроэнергия
  | 'natural_gas'    // Природный газ
  | 'coal'           // Уголь
  | 'fuel_oil'       // Мазут
  | 'diesel'         // Дизельное топливо
  | 'gasoline'       // Бензин

/**
 * Пользователь системы
 */
export interface User {
  id: string
  email: string
  firstName?: string
  lastName?: string
  company?: string
  createdAt: Date
  updatedAt: Date
}

/**
 * Загруженный файл
 */
export interface UploadedFile {
  id: string
  userId: string
  originalName: string
  fileName: string
  fileType: FileType
  fileSize: number
  uploadedAt: Date
  status: ProcessingStatus
  ocrData?: OCRResult
  reportId?: string
}

/**
 * Результат OCR обработки
 */
export interface OCRResult {
  id: string
  fileId: string
  extractedText: string
  confidence: number
  processingTime: number // в миллисекундах
  extractedData: ExtractedEnergyData
  createdAt: Date
}

/**
 * Извлечённые данные об энергопотреблении
 */
export interface ExtractedEnergyData {
  // Основные данные
  period: {
    startDate: Date
    endDate: Date
  }
  consumption: {
    value: number
    unit: string // кВт⋅ч, Гкал, м³ и т.д.
  }
  supplier: {
    name?: string
    inn?: string
  }
  consumer: {
    name?: string
    inn?: string
    address?: string
  }
  
  // Метаданные
  documentNumber?: string
  documentDate?: Date
  confidence: number // 0-1
}

/**
 * Коэффициенты выбросов по 296-ФЗ
 */
export interface EmissionFactor {
  id: string
  fuelType: FuelType
  region: string
  factor: number // кг CO2/единица
  unit: string // кВт⋅ч, м³, кг и т.д.
  validFrom: Date
  validTo?: Date
  source: string // ссылка на документ
}

/**
 * Расчёт выбросов CO2
 */
export interface EmissionCalculation {
  id: string
  fileId: string
  energyData: ExtractedEnergyData
  emissionFactor: EmissionFactor
  
  // Результаты расчёта
  totalEmissions: number // кг CO2
  emissionsPerUnit: number // кг CO2 на единицу
  
  // Метаданные
  calculatedAt: Date
  version: string // версия методики расчёта
}

/**
 * Отчёт по 296-ФЗ
 */
export interface ESGReport {
  id: string
  userId: string
  fileId: string
  calculationId: string
  
  // Основные данные отчёта
  reportNumber: string
  reportDate: Date
  reportingPeriod: {
    startDate: Date
    endDate: Date
  }
  
  // Данные организации
  organization: {
    name: string
    inn: string
    kpp?: string
    address: string
    contactPerson?: string
    contactEmail?: string
    contactPhone?: string
  }
  
  // Данные о выбросах
  emissions: {
    scope1: number // Прямые выбросы
    scope2: number // Косвенные выбросы от энергии
    scope3?: number // Прочие косвенные выбросы
    total: number
    unit: 'kg' | 't' // килограммы или тонны CO2
  }
  
  // Файлы отчётов
  pdfReport?: {
    fileName: string
    fileUrl: string
    generatedAt: Date
  }
  csvData?: {
    fileName: string
    fileUrl: string
    generatedAt: Date
  }
  
  status: ProcessingStatus
  createdAt: Date
  updatedAt: Date
}

/**
 * Платёж за генерацию отчёта
 */
export interface Payment {
  id: string
  userId: string
  reportId: string
  
  // Данные платежа
  amount: number
  currency: 'RUB'
  status: 'pending' | 'paid' | 'failed' | 'refunded'
  
  // Внешние ID
  // online acquiring disabled
  
  // Временные метки
  createdAt: Date
  paidAt?: Date
  failedAt?: Date
}

/**
 * Настройки приложения
 */
export interface AppSettings {
  // Цены на услуги
  pricing: {
    reportGeneration: number // в рублях
    currency: 'RUB'
  }
  
  // Лимиты файлов
  fileUpload: {
    maxSizeInMB: number
    allowedTypes: FileType[]
  }
  
  // Настройки OCR
  ocr: {
    minConfidence: number // 0-1
    timeoutMs: number
  }
  
  // Коэффициенты выбросов
  emissionFactors: {
    version: string
    lastUpdated: Date
    defaultFactor: number // для электроэнергии в РФ
  }
}

/**
 * API ответ с данными и метаданными
 */
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: any
  }
  meta?: {
    total?: number
    page?: number
    limit?: number
    hasMore?: boolean
  }
}

/**
 * Параметры пагинации
 */
export interface PaginationParams {
  page: number
  limit: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

/**
 * Фильтры для отчётов
 */
export interface ReportFilters {
  status?: ProcessingStatus[]
  dateFrom?: Date
  dateTo?: Date
  organization?: string
}

/**
 * Статистика дашборда
 */
export interface DashboardStats {
  totalReports: number
  completedReports: number
  totalEmissions: number // в кг CO2
  averageProcessingTime: number // в минутах
  
  // Статистика за период
  monthlyStats: {
    month: string
    reportsCount: number
    totalEmissions: number
  }[]
  
  // Последние отчёты
  recentReports: ESGReport[]
}

/**
 * Событие для логирования
 */
export interface LogEvent {
  id: string
  userId?: string
  action: string
  resource: string
  metadata?: Record<string, any>
  ipAddress?: string
  userAgent?: string
  createdAt: Date
}

/**
 * Конфигурация для Yandex Cloud
 */
export interface YandexCloudConfig {
  cloudId: string
  folderId: string
  serviceAccountKey: string
  endpoint: string
}

/**
 * Конфигурация для S3 хранилища
 */
export interface S3Config {
  endpoint: string
  accessKeyId: string
  secretAccessKey: string
  bucketName: string
}

/**
 * Конфигурация для YooKassa
 */
// YooKassa удалена

// ============================================================================
// Утилитарные типы
// ============================================================================

/**
 * Создание типа - все поля опциональны
 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

/**
 * Создание типа - все поля обязательны
 */
export type RequiredBy<T, K extends keyof T> = T & Required<Pick<T, K>>

/**
 * Тип для форм создания (без ID и временных меток)
 */
export type CreateType<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>

/**
 * Тип для форм обновления (только изменяемые поля)
 */
export type UpdateType<T> = Partial<Omit<T, 'id' | 'createdAt'>> & {
  updatedAt?: Date
} 