/**
 * Система структурированного логирования для ESG-Lite
 * Поддерживает уровни логирования, форматирование и ротацию
 */

import * as fs from 'fs';
import * as path from 'path';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4
}

export interface LogEntry {
  timestamp: string;
  level: string;
  component: string;
  message: string;
  metadata?: Record<string, any>;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  logDir: string;
  maxFileSize: number; // в байтах
  maxFiles: number;
  component: string;
}

export class Logger {
  private config: LoggerConfig;
  private currentLogFile: string | null = null;
  private fileHandle: fs.WriteStream | null = null;

  constructor(component: string, customConfig?: Partial<LoggerConfig>) {
    this.config = {
      level: this.parseLogLevel(process.env.LOG_LEVEL || 'info'),
      enableConsole: process.env.NODE_ENV !== 'production' || process.env.ENABLE_CONSOLE_LOGS === 'true',
      enableFile: process.env.ENABLE_FILE_LOGS !== 'false',
      logDir: process.env.LOG_DIR || path.join(process.cwd(), 'logs'),
      maxFileSize: parseInt(process.env.LOG_MAX_FILE_SIZE || '10485760'), // 10MB
      maxFiles: parseInt(process.env.LOG_MAX_FILES || '5'),
      component,
      ...customConfig
    };

    // Создаем директорию для логов
    if (this.config.enableFile) {
      this.ensureLogDir();
      this.initializeLogFile();
    }
  }

  private parseLogLevel(level: string): LogLevel {
    switch (level.toLowerCase()) {
      case 'debug': return LogLevel.DEBUG;
      case 'info': return LogLevel.INFO;
      case 'warn': return LogLevel.WARN;
      case 'error': return LogLevel.ERROR;
      case 'fatal': return LogLevel.FATAL;
      default: return LogLevel.INFO;
    }
  }

  private ensureLogDir(): void {
    if (!fs.existsSync(this.config.logDir)) {
      fs.mkdirSync(this.config.logDir, { recursive: true });
    }
  }

  private initializeLogFile(): void {
    const today = new Date().toISOString().split('T')[0];
    this.currentLogFile = path.join(this.config.logDir, `${this.config.component}-${today}.log`);
    
    // Проверяем размер файла и ротируем при необходимости
    this.rotateIfNeeded();
    
    this.fileHandle = fs.createWriteStream(this.currentLogFile, { flags: 'a' });
  }

  private rotateIfNeeded(): void {
    if (!this.currentLogFile || !fs.existsSync(this.currentLogFile)) {
      return;
    }

    const stats = fs.statSync(this.currentLogFile);
    if (stats.size >= this.config.maxFileSize) {
      this.rotateLogFile();
    }
  }

  private rotateLogFile(): void {
    if (!this.currentLogFile) return;

    // Закрываем текущий файл
    if (this.fileHandle) {
      this.fileHandle.end();
    }

    // Переименовываем файлы для ротации
    const baseName = path.basename(this.currentLogFile, '.log');
    const dir = path.dirname(this.currentLogFile);

    // Сдвигаем существующие файлы
    for (let i = this.config.maxFiles - 1; i > 0; i--) {
      const oldFile = path.join(dir, `${baseName}.${i}.log`);
      const newFile = path.join(dir, `${baseName}.${i + 1}.log`);
      
      if (fs.existsSync(oldFile)) {
        if (i === this.config.maxFiles - 1) {
          fs.unlinkSync(oldFile); // Удаляем самый старый файл
        } else {
          fs.renameSync(oldFile, newFile);
        }
      }
    }

    // Переименовываем текущий файл
    const rotatedFile = path.join(dir, `${baseName}.1.log`);
    fs.renameSync(this.currentLogFile, rotatedFile);

    // Создаем новый файл
    this.fileHandle = fs.createWriteStream(this.currentLogFile, { flags: 'a' });
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.config.level;
  }

  private formatLogEntry(level: LogLevel, message: string, metadata?: Record<string, any>, error?: Error): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      component: this.config.component,
      message,
    };

    if (metadata && Object.keys(metadata).length > 0) {
      entry.metadata = metadata;
    }

    if (error) {
      entry.error = {
        message: error.message,
        stack: error.stack,
        code: (error as any).code
      };
    }

    return entry;
  }

  private writeLog(entry: LogEntry): void {
    const logLine = JSON.stringify(entry) + '\n';

    // Консольный вывод
    if (this.config.enableConsole) {
      const coloredOutput = this.colorizeConsoleOutput(entry);
      console.log(coloredOutput);
    }

    // Файловый вывод
    if (this.config.enableFile && this.fileHandle) {
      this.fileHandle.write(logLine);
    }
  }

  private colorizeConsoleOutput(entry: LogEntry): string {
    const colors = {
      DEBUG: '\x1b[36m',  // Cyan
      INFO: '\x1b[32m',   // Green
      WARN: '\x1b[33m',   // Yellow
      ERROR: '\x1b[31m',  // Red
      FATAL: '\x1b[35m',  // Magenta
      RESET: '\x1b[0m'
    };

    const timestamp = entry.timestamp;
    const level = `[${entry.level}]`.padEnd(7);
    const component = `[${entry.component}]`.padEnd(15);
    const color = colors[entry.level as keyof typeof colors] || colors.INFO;

    let output = `${color}${timestamp} ${level} ${component}${colors.RESET} ${entry.message}`;

    if (entry.metadata) {
      output += ` ${JSON.stringify(entry.metadata)}`;
    }

    if (entry.error) {
      output += `\n${colors.ERROR}Error: ${entry.error.message}${colors.RESET}`;
      if (entry.error.stack && entry.level === 'DEBUG') {
        output += `\n${entry.error.stack}`;
      }
    }

    return output;
  }

  // Публичные методы логирования
  debug(message: string, metadata?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      const entry = this.formatLogEntry(LogLevel.DEBUG, message, metadata);
      this.writeLog(entry);
    }
  }

  info(message: string, metadata?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const entry = this.formatLogEntry(LogLevel.INFO, message, metadata);
      this.writeLog(entry);
    }
  }

  warn(message: string, metadata?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.WARN)) {
      const entry = this.formatLogEntry(LogLevel.WARN, message, metadata);
      this.writeLog(entry);
    }
  }

  error(message: string, error?: Error, metadata?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const entry = this.formatLogEntry(LogLevel.ERROR, message, metadata, error);
      this.writeLog(entry);
    }
  }

  fatal(message: string, error?: Error, metadata?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.FATAL)) {
      const entry = this.formatLogEntry(LogLevel.FATAL, message, metadata, error);
      this.writeLog(entry);
    }
  }

  // Методы для специальных типов логирования
  logJobStart(jobId: string, jobType: string, metadata?: Record<string, any>): void {
    this.info('Job started', {
      jobId,
      jobType,
      ...metadata
    });
  }

  logJobComplete(jobId: string, duration: number, metadata?: Record<string, any>): void {
    this.info('Job completed', {
      jobId,
      duration,
      ...metadata
    });
  }

  logJobError(jobId: string, error: Error, metadata?: Record<string, any>): void {
    this.error('Job failed', error, {
      jobId,
      ...metadata
    });
  }

  logQueueStats(stats: Record<string, any>): void {
    this.info('Queue statistics', stats);
  }

  logPerformanceMetric(metric: string, value: number, unit: string): void {
    this.info('Performance metric', {
      metric,
      value,
      unit,
      timestamp: Date.now()
    });
  }

  // Закрытие логгера
  close(): void {
    if (this.fileHandle) {
      this.fileHandle.end();
      this.fileHandle = null;
    }
  }
}

// Фабрика для создания логгеров для разных компонентов
export class LoggerFactory {
  private static loggers: Map<string, Logger> = new Map();

  static getLogger(component: string): Logger {
    if (!this.loggers.has(component)) {
      this.loggers.set(component, new Logger(component));
    }
    return this.loggers.get(component)!;
  }

  static closeAll(): void {
    for (const logger of this.loggers.values()) {
      logger.close();
    }
    this.loggers.clear();
  }
}

// Экспорт готовых логгеров для основных компонентов
export const queueLogger = LoggerFactory.getLogger('queue-manager');
export const workerLogger = LoggerFactory.getLogger('ocr-worker');
export const apiLogger = LoggerFactory.getLogger('api');
export const systemLogger = LoggerFactory.getLogger('system');
