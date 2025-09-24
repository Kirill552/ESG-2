/**
 * TypeScript типы для системы очередей
 */

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  total: number;
}

export interface DetailedQueueStats extends QueueStats {
  byStatus: Record<string, number>;
}

export interface ActiveJob {
  id: string;
  data: any;
  createdAt: Date;
  startedAt?: Date;
  priority: number;
}

export interface FailedJob {
  id: string;
  data: any;
  error: string;
  failedAt: Date;
  retryCount: number;
}

export interface PerformanceMetrics {
  averageProcessingTime: number;
  throughputPerHour: number;
  errorRate: number;
  queueHealth: 'healthy' | 'warning' | 'critical';
}

export interface JobStatus {
  id: string;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  progress?: number;
  result?: any;
  error?: string;
  createdAt: Date;
  processedAt?: Date;
  finishedAt?: Date;
  priority: number;
  data?: any; // Метаданные задачи
}

// Типы для новых полей документа
export type QueueStatus = 'WAITING' | 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'DELAYED' | 'STALLED';

export interface DocumentQueueInfo {
  jobId?: string;
  queueStatus?: QueueStatus;
  processingStartedAt?: Date;
  processingCompletedAt?: Date;
}

export interface DocumentWithQueueInfo {
  id: string;
  fileName: string;
  status: string;
  jobId?: string;
  queueStatus?: QueueStatus;
  processingStartedAt?: Date;
  processingCompletedAt?: Date;
  processingProgress?: number;
  processingStage?: string;
  processingMessage?: string;
  ocrProcessed: boolean;
  ocrConfidence?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AddJobOptions {
  priority?: 'normal' | 'high' | 'urgent';
  retryLimit?: number;
  expireInHours?: number;
}

export interface QueueManagerInterface {
  // Основные методы
  initialize(): Promise<void>;
  stop(): Promise<void>;
  
  // Управление задачами
  addOcrJob(data: any, options?: AddJobOptions): Promise<string | null>;
  getJobStatus(jobId: string): Promise<JobStatus | null>;
  cancelJob(jobId: string): Promise<boolean>;
  retryFailedJob(jobId: string): Promise<string | null>;
  
  // Статистика и мониторинг
  getQueueStats(): Promise<QueueStats>;
  getDetailedQueueStats(): Promise<DetailedQueueStats>;
  getActiveJobs(limit?: number): Promise<ActiveJob[]>;
  getFailedJobs(limit?: number): Promise<FailedJob[]>;
  getPerformanceMetrics(): Promise<PerformanceMetrics>;
  
  // Управление очередью
  cleanCompletedJobs(olderThanHours?: number): Promise<number>;
  
  // Монетизация
  getSurgePricingInfo(): { isSurge: boolean; multiplier: number };
  onJobCompleted(jobId: string, result: any): Promise<void>;
}