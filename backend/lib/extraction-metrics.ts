/**
 * Модуль для сбора и анализа метрик качества извлечения данных
 * Собирает статистику по всем этапам обработки документов
 */

import * as fs from 'fs';
import * as path from 'path';

// Интерфейсы для метрик
export interface ProcessingMetrics {
  documentId: string;
  filePath: string;
  fileSize: number;
  fileType: string;
  processingMethod: string;
  startTime: number;
  endTime: number;
  processingTimeMs: number;
  
  // Метрики обработки
  parserUsed: string;
  fallbackAttempts: number;
  confidence: number;
  
  // Метрики извлечения данных
  fieldsExtracted: number;
  fieldsExpected: number;
  extractionSuccess: boolean;
  dataQuality: 'high' | 'medium' | 'low';
  
  // Метрики по типам данных
  fuelDataExtracted: number;
  electricityDataExtracted: boolean;
  thermalDataExtracted: boolean;
  transportDataExtracted: boolean;
  fgasDataExtracted: number;
  industrialProcessesExtracted: number;
  
  // Метрики выбросов
  totalCO2Calculated: number;
  baseEmissions: number;
  fgasEmissions: number;
  industrialEmissions: number;
  emissionCalculationMethod: string;
  
  // Метрики синонимов
  synonymsApplied: number;
  fieldsNormalized: number;
  categoriesIdentified: number;
  
  // Ошибки и предупреждения
  errors: string[];
  warnings: string[];
  fallbackReason?: string;
  
  // Временные метки
  timestamp: string;
}

export interface AggregatedMetrics {
  totalDocuments: number;
  successfulExtractions: number;
  failedExtractions: number;
  avgProcessingTime: number;
  avgConfidence: number;
  
  // Распределение по методам обработки
  methodsUsed: Record<string, number>;
  parsersUsed: Record<string, number>;
  dataQualityDistribution: Record<string, number>;
  
  // Метрики извлечения
  avgFieldsExtracted: number;
  avgFieldsExpected: number;
  extractionSuccessRate: number;
  
  // Типы данных
  fuelExtractionRate: number;
  electricityExtractionRate: number;
  thermalExtractionRate: number;
  transportExtractionRate: number;
  
  // Выбросы
  avgTotalCO2: number;
  avgBaseEmissions: number;
  documentsWithFgas: number;
  documentsWithIndustrialProcesses: number;
  
  // Синонимы
  avgSynonymsApplied: number;
  avgFieldsNormalized: number;
  
  // Временной диапазон
  periodStart: string;
  periodEnd: string;
}

/**
 * Класс для сбора и анализа метрик качества извлечения
 */
export class ExtractionMetricsCollector {
  private metricsDir: string;
  private currentMetrics: ProcessingMetrics[] = [];
  
  constructor() {
    this.metricsDir = path.join(process.cwd(), 'debug_output', 'extraction_metrics');
    this.ensureMetricsDirectory();
  }
  
  private ensureMetricsDirectory(): void {
    if (!fs.existsSync(this.metricsDir)) {
      fs.mkdirSync(this.metricsDir, { recursive: true });
    }
  }
  
  /**
   * Начало отслеживания обработки документа
   */
  startDocumentProcessing(documentId: string, filePath: string): string {
    const sessionId = `${documentId}_${Date.now()}`;
    return sessionId;
  }
  
  /**
   * Записывает метрики для обработанного документа
   */
  recordProcessingMetrics(metrics: ProcessingMetrics): void {
    this.currentMetrics.push(metrics);
    
    // Сохраняем индивидуальные метрики в файл
    const filename = `metrics_${metrics.documentId}_${Date.now()}.json`;
    const filePath = path.join(this.metricsDir, filename);
    
    try {
      fs.writeFileSync(filePath, JSON.stringify(metrics, null, 2), 'utf8');
      console.log(`📊 Метрики сохранены: ${filePath}`);
    } catch (error) {
      console.warn('⚠️ Не удалось сохранить метрики:', error);
    }
  }
  
  /**
   * Анализирует качество извлечения на основе метрик
   */
  analyzeExtractionQuality(metrics: ProcessingMetrics): {
    overallScore: number;
    recommendations: string[];
    strengths: string[];
    weaknesses: string[];
  } {
    const recommendations: string[] = [];
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    
    let score = 0;
    const maxScore = 100;
    
    // Оценка по уверенности (30 баллов)
    if (metrics.confidence >= 0.9) {
      score += 30;
      strengths.push('Высокая уверенность обработки');
    } else if (metrics.confidence >= 0.7) {
      score += 20;
      strengths.push('Средняя уверенность обработки');
    } else {
      score += 10;
      weaknesses.push('Низкая уверенность обработки');
      recommendations.push('Рассмотреть использование других методов обработки');
    }
    
    // Оценка по извлечению полей (25 баллов)
    const fieldExtractionRate = metrics.fieldsExtracted / Math.max(metrics.fieldsExpected, 1);
    if (fieldExtractionRate >= 0.8) {
      score += 25;
      strengths.push('Хорошее извлечение полей данных');
    } else if (fieldExtractionRate >= 0.5) {
      score += 15;
    } else {
      score += 5;
      weaknesses.push('Неполное извлечение полей');
      recommendations.push('Улучшить паттерны извлечения данных');
    }
    
    // Оценка по качеству данных (20 баллов)
    if (metrics.dataQuality === 'high') {
      score += 20;
      strengths.push('Высокое качество извлеченных данных');
    } else if (metrics.dataQuality === 'medium') {
      score += 12;
    } else {
      score += 4;
      weaknesses.push('Низкое качество извлеченных данных');
      recommendations.push('Проверить точность извлечения');
    }
    
    // Оценка по разнообразию данных (15 баллов)
    let dataTypesExtracted = 0;
    if (metrics.fuelDataExtracted > 0) dataTypesExtracted++;
    if (metrics.electricityDataExtracted) dataTypesExtracted++;
    if (metrics.thermalDataExtracted) dataTypesExtracted++;
    if (metrics.transportDataExtracted) dataTypesExtracted++;
    if (metrics.fgasDataExtracted > 0) dataTypesExtracted++;
    if (metrics.industrialProcessesExtracted > 0) dataTypesExtracted++;
    
    const dataTypeScore = (dataTypesExtracted / 6) * 15;
    score += dataTypeScore;
    
    if (dataTypesExtracted >= 4) {
      strengths.push('Извлечены разнообразные типы данных');
    } else if (dataTypesExtracted >= 2) {
      strengths.push('Извлечены основные типы данных');
    } else {
      weaknesses.push('Ограниченное разнообразие извлеченных данных');
      recommendations.push('Расширить паттерны для различных типов данных');
    }
    
    // Оценка по производительности (10 баллов)
    if (metrics.processingTimeMs < 2000) {
      score += 10;
      strengths.push('Быстрая обработка документа');
    } else if (metrics.processingTimeMs < 5000) {
      score += 7;
    } else if (metrics.processingTimeMs < 10000) {
      score += 4;
    } else {
      score += 1;
      weaknesses.push('Медленная обработка документа');
      recommendations.push('Оптимизировать производительность обработки');
    }
    
    // Штрафы за ошибки и fallback
    if (metrics.errors.length > 0) {
      score -= metrics.errors.length * 2;
      weaknesses.push(`Обнаружены ошибки: ${metrics.errors.length}`);
      recommendations.push('Устранить ошибки обработки');
    }
    
    if (metrics.fallbackAttempts > 0) {
      score -= metrics.fallbackAttempts;
      weaknesses.push('Потребовались попытки fallback');
      recommendations.push('Улучшить основной метод обработки');
    }
    
    const overallScore = Math.max(0, Math.min(maxScore, score));
    
    return {
      overallScore,
      recommendations,
      strengths,
      weaknesses
    };
  }
  
  /**
   * Вычисляет агрегированные метрики за период
   */
  calculateAggregatedMetrics(periodDays: number = 7): AggregatedMetrics {
    const now = new Date();
    const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
    
    // Загружаем все метрики за период
    const periodMetrics = this.loadMetricsForPeriod(periodStart, now);
    
    if (periodMetrics.length === 0) {
      return this.getEmptyAggregatedMetrics(periodStart, now);
    }
    
    const totalDocuments = periodMetrics.length;
    const successfulExtractions = periodMetrics.filter(m => m.extractionSuccess).length;
    const failedExtractions = totalDocuments - successfulExtractions;
    
    // Средние значения
    const avgProcessingTime = periodMetrics.reduce((sum, m) => sum + m.processingTimeMs, 0) / totalDocuments;
    const avgConfidence = periodMetrics.reduce((sum, m) => sum + m.confidence, 0) / totalDocuments;
    const avgFieldsExtracted = periodMetrics.reduce((sum, m) => sum + m.fieldsExtracted, 0) / totalDocuments;
    const avgFieldsExpected = periodMetrics.reduce((sum, m) => sum + m.fieldsExpected, 0) / totalDocuments;
    
    // Распределения
    const methodsUsed: Record<string, number> = {};
    const parsersUsed: Record<string, number> = {};
    const dataQualityDistribution: Record<string, number> = { high: 0, medium: 0, low: 0 };
    
    periodMetrics.forEach(m => {
      methodsUsed[m.processingMethod] = (methodsUsed[m.processingMethod] || 0) + 1;
      parsersUsed[m.parserUsed] = (parsersUsed[m.parserUsed] || 0) + 1;
      dataQualityDistribution[m.dataQuality]++;
    });
    
    // Коэффициенты извлечения
    const fuelExtractionRate = periodMetrics.filter(m => m.fuelDataExtracted > 0).length / totalDocuments;
    const electricityExtractionRate = periodMetrics.filter(m => m.electricityDataExtracted).length / totalDocuments;
    const thermalExtractionRate = periodMetrics.filter(m => m.thermalDataExtracted).length / totalDocuments;
    const transportExtractionRate = periodMetrics.filter(m => m.transportDataExtracted).length / totalDocuments;
    
    // Метрики выбросов
    const avgTotalCO2 = periodMetrics.reduce((sum, m) => sum + m.totalCO2Calculated, 0) / totalDocuments;
    const avgBaseEmissions = periodMetrics.reduce((sum, m) => sum + m.baseEmissions, 0) / totalDocuments;
    const documentsWithFgas = periodMetrics.filter(m => m.fgasDataExtracted > 0).length;
    const documentsWithIndustrialProcesses = periodMetrics.filter(m => m.industrialProcessesExtracted > 0).length;
    
    // Синонимы
    const avgSynonymsApplied = periodMetrics.reduce((sum, m) => sum + m.synonymsApplied, 0) / totalDocuments;
    const avgFieldsNormalized = periodMetrics.reduce((sum, m) => sum + m.fieldsNormalized, 0) / totalDocuments;
    
    return {
      totalDocuments,
      successfulExtractions,
      failedExtractions,
      avgProcessingTime,
      avgConfidence,
      methodsUsed,
      parsersUsed,
      dataQualityDistribution,
      avgFieldsExtracted,
      avgFieldsExpected,
      extractionSuccessRate: successfulExtractions / totalDocuments,
      fuelExtractionRate,
      electricityExtractionRate,
      thermalExtractionRate,
      transportExtractionRate,
      avgTotalCO2,
      avgBaseEmissions,
      documentsWithFgas,
      documentsWithIndustrialProcesses,
      avgSynonymsApplied,
      avgFieldsNormalized,
      periodStart: periodStart.toISOString(),
      periodEnd: now.toISOString()
    };
  }
  
  /**
   * Загружает метрики за указанный период
   */
  private loadMetricsForPeriod(start: Date, end: Date): ProcessingMetrics[] {
    const metrics: ProcessingMetrics[] = [];
    
    try {
      const files = fs.readdirSync(this.metricsDir);
      const metricsFiles = files.filter(f => f.startsWith('metrics_') && f.endsWith('.json'));
      
      for (const file of metricsFiles) {
        try {
          const filePath = path.join(this.metricsDir, file);
          const content = fs.readFileSync(filePath, 'utf8');
          const metric: ProcessingMetrics = JSON.parse(content);
          
          const metricDate = new Date(metric.timestamp);
          if (metricDate >= start && metricDate <= end) {
            metrics.push(metric);
          }
        } catch (error) {
          console.warn(`⚠️ Не удалось загрузить метрики из файла ${file}:`, error);
        }
      }
    } catch (error) {
      console.warn('⚠️ Не удалось прочитать директорию метрик:', error);
    }
    
    return metrics;
  }
  
  /**
   * Возвращает пустые агрегированные метрики
   */
  private getEmptyAggregatedMetrics(start: Date, end: Date): AggregatedMetrics {
    return {
      totalDocuments: 0,
      successfulExtractions: 0,
      failedExtractions: 0,
      avgProcessingTime: 0,
      avgConfidence: 0,
      methodsUsed: {},
      parsersUsed: {},
      dataQualityDistribution: { high: 0, medium: 0, low: 0 },
      avgFieldsExtracted: 0,
      avgFieldsExpected: 0,
      extractionSuccessRate: 0,
      fuelExtractionRate: 0,
      electricityExtractionRate: 0,
      thermalExtractionRate: 0,
      transportExtractionRate: 0,
      avgTotalCO2: 0,
      avgBaseEmissions: 0,
      documentsWithFgas: 0,
      documentsWithIndustrialProcesses: 0,
      avgSynonymsApplied: 0,
      avgFieldsNormalized: 0,
      periodStart: start.toISOString(),
      periodEnd: end.toISOString()
    };
  }
  
  /**
   * Сохраняет агрегированные метрики в файл
   */
  saveAggregatedMetrics(metrics: AggregatedMetrics, filename?: string): void {
    const defaultFilename = `aggregated_metrics_${new Date().toISOString().slice(0, 10)}.json`;
    const actualFilename = filename || defaultFilename;
    const filePath = path.join(this.metricsDir, actualFilename);
    
    try {
      fs.writeFileSync(filePath, JSON.stringify(metrics, null, 2), 'utf8');
      console.log(`📊 Агрегированные метрики сохранены: ${filePath}`);
    } catch (error) {
      console.warn('⚠️ Не удалось сохранить агрегированные метрики:', error);
    }
  }
  
  /**
   * Генерирует отчет о качестве извлечения
   */
  generateQualityReport(periodDays: number = 7): string {
    const aggregated = this.calculateAggregatedMetrics(periodDays);
    
    let report = `
# Отчет о качестве извлечения данных

**Период:** ${new Date(aggregated.periodStart).toLocaleDateString()} - ${new Date(aggregated.periodEnd).toLocaleDateString()}

## Общая статистика
- **Всего документов:** ${aggregated.totalDocuments}
- **Успешных извлечений:** ${aggregated.successfulExtractions}
- **Неудачных извлечений:** ${aggregated.failedExtractions}
- **Коэффициент успеха:** ${(aggregated.extractionSuccessRate * 100).toFixed(1)}%

## Производительность
- **Среднее время обработки:** ${aggregated.avgProcessingTime.toFixed(0)}мс
- **Средняя уверенность:** ${(aggregated.avgConfidence * 100).toFixed(1)}%
- **Среднее количество полей:** ${aggregated.avgFieldsExtracted.toFixed(1)} из ${aggregated.avgFieldsExpected.toFixed(1)}

## Методы обработки
`;

    for (const [method, count] of Object.entries(aggregated.methodsUsed)) {
      const percentage = (count / aggregated.totalDocuments * 100).toFixed(1);
      report += `- **${method}:** ${count} (${percentage}%)\n`;
    }

    report += `
## Качество данных
- **Высокое качество:** ${aggregated.dataQualityDistribution.high} документов
- **Среднее качество:** ${aggregated.dataQualityDistribution.medium} документов  
- **Низкое качество:** ${aggregated.dataQualityDistribution.low} документов

## Извлечение по типам данных
- **Топливо:** ${(aggregated.fuelExtractionRate * 100).toFixed(1)}%
- **Электроэнергия:** ${(aggregated.electricityExtractionRate * 100).toFixed(1)}%
- **Тепловая энергия:** ${(aggregated.thermalExtractionRate * 100).toFixed(1)}%
- **Транспорт:** ${(aggregated.transportExtractionRate * 100).toFixed(1)}%

## Выбросы
- **Среднее количество CO2:** ${aggregated.avgTotalCO2.toFixed(2)} кг
- **Документы с F-газами:** ${aggregated.documentsWithFgas}
- **Документы с промпроцессами:** ${aggregated.documentsWithIndustrialProcesses}

## Нормализация данных
- **Среднее количество синонимов:** ${aggregated.avgSynonymsApplied.toFixed(1)}
- **Нормализованных полей:** ${aggregated.avgFieldsNormalized.toFixed(1)}
`;

    return report;
  }
}

// Экспорт singleton instance
export const metricsCollector = new ExtractionMetricsCollector();