/**
 * Fuzzy Matching Service для нечеткого сопоставления текста
 * Основан на Context7 исследовании современных библиотек 2025 года
 * 
 * Использует:
 * - fuse.js@7.1.0 - основной fuzzy search (Trust: 7.7)
 * - fuzzysort@3.1.0 - быстрый fuzzy search (Trust: 9.2)
 * - fastest-levenshtein@1.x - edit distance (Trust: 8.4)
 */

import Fuse from 'fuse.js';
import fuzzysort from 'fuzzysort';
import { distance as levenshteinDistance, closest as findClosest } from 'fastest-levenshtein';

export interface FuzzyMatchResult {
  match: string;
  score: number;
  confidence: number;
  method: 'exact' | 'fuse' | 'fuzzysort' | 'levenshtein';
  normalizedQuery: string;
  normalizedMatch: string;
}

export interface FuzzyMatchingConfig {
  tolerance: number; // Левенштейн distance threshold (по умолчанию 2)
  minLength: number; // Минимальная длина для fuzzy поиска (по умолчанию 3)
  fuseThreshold: number; // Fuse.js threshold (0.0-1.0, чем меньше - точнее)
  enableNormalization: boolean; // Включить нормализацию токенов
}

export class FuzzyMatchingService {
  private config: FuzzyMatchingConfig;
  private fuseOptions: any;

  constructor(config?: Partial<FuzzyMatchingConfig>) {
    // Загружаем конфигурацию из ENV с fallback на дефолты
    this.config = {
      tolerance: parseInt(process.env.FUZZY_TOLERANCE || '2'),
      minLength: parseInt(process.env.FUZZY_MIN_LENGTH || '3'),
      fuseThreshold: parseFloat(process.env.FUSE_THRESHOLD || '0.4'),
      enableNormalization: process.env.FUZZY_NORMALIZATION !== 'false',
      ...config
    };

    // Настройка Fuse.js для оптимальной производительности
    this.fuseOptions = {
      threshold: this.config.fuseThreshold,
      location: 0,
      distance: 100,
      maxPatternLength: 32,
      minMatchCharLength: 2,
      keys: [] // Для простых строк
    };
  }

  /**
   * Нормализация токена перед fuzzy поиском
   * Основано на рекомендациях из плана v1.3
   */
  private normalizeToken(text: string): string {
    if (!text || typeof text !== 'string') {
      return '';
    }
    
    if (!this.config.enableNormalization) {
      return text;
    }

    return text
      .toLowerCase()
      .trim()
      // Удаление диакритики и спецсимволов
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      // Унификация разделителей: «кВт·ч» → «квтч»
      .replace(/[·\-\s\/\\\.]/g, '')
      // Замена украинских букв на русские для OCR ошибок
      .replace(/[іїєґ]/g, (match) => {
        const mapping: Record<string, string> = {
          'і': 'и',
          'ї': 'и', 
          'є': 'е',
          'ґ': 'г'
        };
        return mapping[match] || match;
      })
      // Замена латинских букв на кириллицу (частые OCR ошибки)
      .replace(/[aeopcxy]/g, (match) => {
        const mapping: Record<string, string> = {
          'a': 'а',
          'e': 'е',
          'o': 'о',
          'p': 'р',
          'c': 'с',
          'x': 'х',
          'y': 'у'
        };
        return mapping[match] || match;
      });
  }

  /**
   * Основной метод fuzzy поиска с каскадом алгоритмов
   */
  public findBestMatch(query: string, candidates: string[]): FuzzyMatchResult | null {
    if (!query || !candidates.length) {
      return null;
    }

    const normalizedQuery = this.normalizeToken(query);
    const filteredCandidates = candidates.filter(c => c && typeof c === 'string');
    const normalizedCandidates = filteredCandidates.map(c => this.normalizeToken(c));

    // 1. Точное совпадение (самый быстрый)
    const exactIndex = normalizedCandidates.indexOf(normalizedQuery);
    if (exactIndex !== -1) {
      return {
        match: filteredCandidates[exactIndex],
        score: 1.0,
        confidence: 100,
        method: 'exact',
        normalizedQuery,
        normalizedMatch: normalizedCandidates[exactIndex]
      };
    }

    // 2. Слишком короткий запрос - только Левенштейн
    if (normalizedQuery.length < this.config.minLength) {
      return this.findLevenshteinMatch(normalizedQuery, filteredCandidates, normalizedCandidates);
    }

    // 3. Fuzzysort (самый быстрый fuzzy)
    const fuzzysortResult = this.findFuzzysortMatch(normalizedQuery, filteredCandidates, normalizedCandidates);
    if (fuzzysortResult && fuzzysortResult.confidence > 70) {
      return fuzzysortResult;
    }

    // 4. Fuse.js (более точный, но медленнее)
    const fuseResult = this.findFuseMatch(normalizedQuery, filteredCandidates, normalizedCandidates);
    if (fuseResult && fuseResult.confidence > 60) {
      return fuseResult;
    }

    // 5. Левенштейн как fallback
    const levenshteinResult = this.findLevenshteinMatch(normalizedQuery, filteredCandidates, normalizedCandidates);
    
    // Возвращаем лучший результат или null если все плохие
    const results = [fuzzysortResult, fuseResult, levenshteinResult].filter(Boolean) as FuzzyMatchResult[];
    if (!results.length) return null;

    return results.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );
  }

  /**
   * Поиск через Fuzzysort (быстрый алгоритм)
   */
  private findFuzzysortMatch(
    normalizedQuery: string, 
    originalCandidates: string[], 
    normalizedCandidates: string[]
  ): FuzzyMatchResult | null {
    try {
      const results = fuzzysort.go(normalizedQuery, normalizedCandidates, {
        threshold: -1000, // Принимаем любые результаты для последующей фильтрации
        limit: 1
      });

      if (!results.length) return null;

      const bestResult = results[0];
      const index = normalizedCandidates.indexOf(bestResult.target);
      
      // Конвертируем score в confidence (fuzzysort использует отрицательные скоры)
      const confidence = Math.max(0, 100 + (bestResult.score || -1000) / 10);
      
      if (confidence < 30) return null; // Слишком плохое совпадение

      return {
        match: originalCandidates[index],
        score: Math.abs(bestResult.score || 0) / 1000,
        confidence,
        method: 'fuzzysort',
        normalizedQuery,
        normalizedMatch: bestResult.target
      };
    } catch (error) {
      console.warn('Fuzzysort error:', error);
      return null;
    }
  }

  /**
   * Поиск через Fuse.js (точный алгоритм)
   */
  private findFuseMatch(
    normalizedQuery: string,
    originalCandidates: string[],
    normalizedCandidates: string[]
  ): FuzzyMatchResult | null {
    try {
      const fuse = new Fuse(normalizedCandidates, this.fuseOptions);
      const results = fuse.search(normalizedQuery);

      if (!results.length) return null;

      const bestResult = results[0];
      const score = bestResult.score || 1; // Fallback для undefined
      const refIndex = bestResult.refIndex || 0; // Fallback для undefined
      const confidence = Math.max(0, (1 - score) * 100);
      
      if (confidence < 40) return null; // Слишком плохое совпадение

      return {
        match: originalCandidates[refIndex],
        score: 1 - score,
        confidence,
        method: 'fuse',
        normalizedQuery,
        normalizedMatch: bestResult.item
      };
    } catch (error) {
      console.warn('Fuse.js error:', error);
      return null;
    }
  }

  /**
   * Поиск через Левенштейн distance (fallback)
   */
  private findLevenshteinMatch(
    normalizedQuery: string,
    originalCandidates: string[],
    normalizedCandidates: string[]
  ): FuzzyMatchResult | null {
    try {
      if (!normalizedCandidates.length) return null;
      
      const closestMatch = findClosest(normalizedQuery, normalizedCandidates);
      if (!closestMatch || typeof closestMatch !== 'string') return null;
      
      const distance = levenshteinDistance(normalizedQuery, closestMatch);
      
      // Проверяем tolerance
      if (distance > this.config.tolerance) return null;
      
      // Для коротких строк используем более строгий tolerance
      const effectiveTolerance = normalizedQuery.length <= 4 ? 1 : this.config.tolerance;
      if (distance > effectiveTolerance) return null;

      const index = normalizedCandidates.indexOf(closestMatch);
      const maxLength = Math.max(normalizedQuery.length, closestMatch.length);
      const confidence = Math.max(0, (1 - distance / maxLength) * 100);

      return {
        match: originalCandidates[index],
        score: 1 - distance / maxLength,
        confidence,
        method: 'levenshtein',
        normalizedQuery,
        normalizedMatch: closestMatch
      };
    } catch (error) {
      console.warn('Levenshtein error:', error);
      return null;
    }
  }

  /**
   * Массовый поиск для множественных запросов
   */
  public findMultipleMatches(queries: string[], candidates: string[]): Map<string, FuzzyMatchResult | null> {
    const results = new Map<string, FuzzyMatchResult | null>();
    
    for (const query of queries) {
      results.set(query, this.findBestMatch(query, candidates));
    }

    return results;
  }

  /**
   * Benchmark производительности для 1000 сравнений
   */
  public benchmark(queries: string[], candidates: string[]): {
    totalTime: number;
    averageTime: number;
    matchesFound: number;
    performance: 'excellent' | 'good' | 'poor';
  } {
    const startTime = Date.now();
    let matchesFound = 0;

    // Тестируем первые 1000 запросов или все, если меньше
    const testQueries = queries.slice(0, 1000);
    
    for (const query of testQueries) {
      const result = this.findBestMatch(query, candidates);
      if (result) matchesFound++;
    }

    const totalTime = Date.now() - startTime;
    const averageTime = totalTime / testQueries.length;

    let performanceRating: 'excellent' | 'good' | 'poor';
    if (totalTime < 10) performanceRating = 'excellent'; // < 10ms на 1000 операций
    else if (totalTime < 100) performanceRating = 'good';
    else performanceRating = 'poor';

    return {
      totalTime,
      averageTime,
      matchesFound,
      performance: performanceRating
    };
  }

  /**
   * Получение текущей конфигурации
   */
  public getConfig(): FuzzyMatchingConfig {
    return { ...this.config };
  }

  /**
   * Обновление конфигурации в runtime
   */
  public updateConfig(newConfig: Partial<FuzzyMatchingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Обновляем Fuse.js опции
    if (newConfig.fuseThreshold !== undefined) {
      this.fuseOptions.threshold = newConfig.fuseThreshold;
    }
  }
}

// Экспорт для удобного использования
export const fuzzyMatchingService = new FuzzyMatchingService();

// Экспорт вспомогательных функций
export const fuzzyMatch = (query: string, candidates: string[]) => 
  fuzzyMatchingService.findBestMatch(query, candidates);

export const fuzzyMatchMultiple = (queries: string[], candidates: string[]) =>
  fuzzyMatchingService.findMultipleMatches(queries, candidates);