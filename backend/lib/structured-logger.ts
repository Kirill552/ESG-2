/**
 * Structured Logger для ESG-Lite
 * Поддерживает различные уровни логирования и ротацию файлов
 */

import * as fs from 'fs';
import * as path from 'path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  data?: any;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  jobId?: string;
  organizationId?: string;
  userId?: string;
}

interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  logDirectory: string;
  maxFileSize: number; // в байтах
  maxFiles: number;
  component: string;
}

class StructuredLogger {
  private config: LoggerConfig;
  private currentLogFile: string;
  private currentFileSize: number = 0;

  constructor(component: string, config?: Partial<LoggerConfig>) {
    this.config = {
      level: (process.env.LOG_LEVEL as LogLevel) || 'info',
      enableConsole: process.env.NODE_ENV === 'development',
      enableFile: process.env.LOG_TO_FILE === 'true',
      logDirectory: process.env.LOG_DIRECTORY || './logs',
      maxFileSize: parseInt(process.env.LOG_MAX_FILE_SIZE || '10485760'), // 10MB
      maxFiles: parseInt(process.env.LOG_MAX_FILES || '5'),
      component,
      ...config
    };

    this.currentLogFile = this.getLogFileName();
    this.ensureLogDirectory();
  }

  private getLogLevel(): number {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[this.config.level];
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[level] >= this.getLogLevel();
  }

  private getLogFileName(): string {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.config.logDirectory, `${this.config.component}-${date}.log`);
  }

  private ensureLogDirectory(): void {
    if (this.config.enableFile && !fs.existsSync(this.config.logDirectory)) {
      fs.mkdirSync(this.config.logDirectory, { recursive: true });
    }
  }

  private formatLogEntry(entry: LogEntry): string {
    return JSON.stringify(entry) + '\n';
  }

  private async rotateLogFile(): Promise<void> {
    if (!this.config.enableFile) return;

    try {
      const stats = fs.statSync(this.currentLogFile);
      if (stats.size >= this.config.maxFileSize) {
        // Переименовываем текущий файл
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rotatedFile = this.currentLogFile.replace('.log', `-${timestamp}.log`);
        fs.renameSync(this.currentLogFile, rotatedFile);

        // Удаляем старые файлы
        await this.cleanupOldLogs();

        // Обновляем текущий файл
        this.currentLogFile = this.getLogFileName();
        this.currentFileSize = 0;
      }
    } catch (error) {
      // Если не можем проверить размер файла, игнорируем
    }
  }

  private async cleanupOldLogs(): Promise<void> {
    try {
      const files = fs.readdirSync(this.config.logDirectory)
        .filter(file => file.startsWith(this.config.component) && file.endsWith('.log'))
        .map(file => ({
          name: file,
          path: path.join(this.config.logDirectory, file),
          mtime: fs.statSync(path.join(this.config.logDirectory, file)).mtime
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      // Удаляем файлы сверх лимита
      if (files.length > this.config.maxFiles) {
        const filesToDelete = files.slice(this.config.maxFiles);
        for (const file of filesToDelete) {
          fs.unlinkSync(file.path);
        }
      }
    } catch (error) {
      // Игнорируем ошибки очистки
    }
  }

  private async writeToFile(entry: LogEntry): Promise<void> {
    if (!this.config.enableFile) return;

    try {
      await this.rotateLogFile();
      const logLine = this.formatLogEntry(entry);
      fs.appendFileSync(this.currentLogFile, logLine);
      this.currentFileSize += logLine.length;
    } catch (error) {
      // Если не можем писать в файл, логируем только в консоль
      if (this.config.enableConsole) {
        console.error('Failed to write log to file:', error);
      }
    }
  }

  private writeToConsole(entry: LogEntry): void {
    if (!this.config.enableConsole) return;

    const colorMap = {
      debug: '\x1b[36m', // cyan
      info: '\x1b[32m',  // green
      warn: '\x1b[33m',  // yellow
      error: '\x1b[31m'  // red
    };

    const reset = '\x1b[0m';
    const color = colorMap[entry.level];
    
    const timestamp = entry.timestamp;
    const level = entry.level.toUpperCase().padEnd(5);
    const component = `[${entry.component}]`.padEnd(15);
    
    let message = `${color}${timestamp} ${level}${reset} ${component} ${entry.message}`;
    
    if (entry.jobId) {
      message += ` jobId=${entry.jobId}`;
    }
    
    if (entry.organizationId) {
      message += ` orgId=${entry.organizationId}`;
    }

    if (entry.data) {
      message += `\n  Data: ${JSON.stringify(entry.data, null, 2)}`;
    }

    if (entry.error) {
      message += `\n  Error: ${entry.error.name}: ${entry.error.message}`;
      if (entry.error.stack) {
        message += `\n  Stack: ${entry.error.stack}`;
      }
    }

    console.log(message);
  }

  private async log(level: LogLevel, message: string, data?: any, error?: Error, context?: {
    jobId?: string;
    organizationId?: string;
    userId?: string;
  }): Promise<void> {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component: this.config.component,
      message,
      ...context
    };

    if (data !== undefined) {
      entry.data = data;
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    }

    // Записываем в консоль и файл параллельно
    const promises: Promise<void>[] = [];
    
    if (this.config.enableConsole) {
      this.writeToConsole(entry);
    }

    if (this.config.enableFile) {
      promises.push(this.writeToFile(entry));
    }

    await Promise.allSettled(promises);
  }

  // Публичные методы логирования
  async debug(message: string, data?: any, context?: { jobId?: string; organizationId?: string; userId?: string }): Promise<void> {
    return this.log('debug', message, data, undefined, context);
  }

  async info(message: string, data?: any, context?: { jobId?: string; organizationId?: string; userId?: string }): Promise<void> {
    return this.log('info', message, data, undefined, context);
  }

  async warn(message: string, data?: any, context?: { jobId?: string; organizationId?: string; userId?: string }): Promise<void> {
    return this.log('warn', message, data, undefined, context);
  }

  async error(message: string, error?: Error, data?: any, context?: { jobId?: string; organizationId?: string; userId?: string }): Promise<void> {
    return this.log('error', message, data, error, context);
  }

  // Специальные методы для очередей
  async jobStarted(jobId: string, jobType: string, data?: any): Promise<void> {
    return this.info(`Job started: ${jobType}`, data, { jobId });
  }

  async jobCompleted(jobId: string, jobType: string, duration: number, data?: any): Promise<void> {
    return this.info(`Job completed: ${jobType} in ${duration}ms`, { duration, ...data }, { jobId });
  }

  async jobFailed(jobId: string, jobType: string, error: Error, attempt: number, maxAttempts: number): Promise<void> {
    return this.error(`Job failed: ${jobType} (attempt ${attempt}/${maxAttempts})`, error, { attempt, maxAttempts }, { jobId });
  }

  async jobRetry(jobId: string, jobType: string, attempt: number, delay: number): Promise<void> {
    return this.warn(`Job retry: ${jobType} (attempt ${attempt}) scheduled in ${delay}ms`, { attempt, delay }, { jobId });
  }

  async workerStarted(workerId: string, queueName: string): Promise<void> {
    return this.info(`Worker started for queue: ${queueName}`, { workerId, queueName });
  }

  async workerStopped(workerId: string, queueName: string, reason?: string): Promise<void> {
    return this.info(`Worker stopped for queue: ${queueName}`, { workerId, queueName, reason });
  }

  async queueHealthCheck(queueName: string, stats: any): Promise<void> {
    return this.debug(`Queue health check: ${queueName}`, stats);
  }
}

// Фабрика для создания логгеров для разных компонентов
export function createLogger(component: string, config?: Partial<LoggerConfig>): StructuredLogger {
  return new StructuredLogger(component, config);
}

// Экспортируем готовые логгеры для основных компонентов
export const queueLogger = createLogger('queue-manager');
export const workerLogger = createLogger('ocr-worker');
export const apiLogger = createLogger('api');
export const healthLogger = createLogger('health-monitor');
export const metricsLogger = createLogger('metrics');

export { StructuredLogger };
