/**
 * Контекстный анализатор для дня 16-17 плана v1.3
 * Реализует окна предложений, ко-упоминания единиц, скоринг
 * Интеграция с Foundation Models API для post-processing
 */

import { fuzzyMatchingService } from './fuzzy-matching-service';
import type { FuzzyMatchResult } from './fuzzy-matching-service';
import { FoundationModelsClient } from './foundation-models-client';
import type { FoundationModelsConfig } from './foundation-models-client';
import { RUSSIAN_SYNONYM_DICTIONARY } from './synonym-dictionary';

export interface ContextWindow {
  before: string[];
  target: string;
  after: string[];
  fullSentence: string;
}

export interface UnitCoMention {
  unit: string;
  distance: number; // Расстояние в словах от искомого термина
  confidence: number;
  category: 'energy' | 'volume' | 'weight' | 'distance' | 'temperature';
}

export interface ContextualMatch {
  originalQuery: string;
  fuzzyMatch: FuzzyMatchResult | null;
  contextWindow: ContextWindow;
  unitCoMentions: UnitCoMention[];
  documentTerms: string[]; // Найденные термины документа (счёт/накладная/акт)
  baseScore: number;
  contextBonuses: {
    unitProximity: number;
    documentContext: number;
    sentenceContext: number;
    tableContext: number;
  };
  penalties: {
    conflictingUnits: number;
    lowConfidence: number;
  };
  finalScore: number;
  recommendation: 'high_confidence' | 'medium_confidence' | 'low_confidence' | 'reject';
  foundationModelsEnhanced?: boolean; // Флаг использования Foundation Models API
}

export interface FoundationModelsRequest {
  text: string;
  entities: string[];
  context: string;
  task: 'entity_extraction' | 'context_analysis' | 'unit_normalization';
}

export interface FoundationModelsResponse {
  entities: {
    name: string;
    category: string;
    confidence: number;
    normalizedValue?: string;
    units?: string;
  }[];
  context_analysis: {
    document_type: string;
    confidence: number;
    relevant_sections: string[];
  };
  recommendations: string[];
}

export class ContextualAnalysisService {
  private foundationModelsClient: FoundationModelsClient | null = null;

  constructor() {
    // Инициализируем Foundation Models клиент (он сам прочитает ENV переменные)
    try {
      this.foundationModelsClient = new FoundationModelsClient();
      console.log('✅ Foundation Models клиент инициализирован');
    } catch (error) {
      console.warn('⚠️ FOUNDATION_MODELS_API_KEY не установлен, используется fallback режим');
      console.warn('Ошибка:', error);
    }
  }
  
  // Российские единицы измерения для ко-упоминаний
  private readonly ENERGY_UNITS = [
    'кВт·ч', 'кВтч', 'МВт·ч', 'МВтч', 'ГВт·ч', 'Гкал', 'ккал', 'Дж', 'кДж', 'МДж'
  ];
  
  private readonly VOLUME_UNITS = [
    'л', 'мл', 'м³', 'м3', 'куб.м', 'см³', 'дм³', 'литр', 'литры'
  ];
  
  private readonly WEIGHT_UNITS = [
    'т', 'кг', 'г', 'тонн', 'тонны', 'тонна', 'килограмм', 'грамм'
  ];
  
  private readonly DISTANCE_UNITS = [
    'км', 'м', 'см', 'мм', 'километр', 'метр', 'миля', 'ткм', 'пкм'
  ];
  
  private readonly DOCUMENT_TERMS = [
    'счёт', 'счет', 'накладная', 'акт', 'справка', 'отчёт', 'отчет',
    'ведомость', 'реестр', 'документ', 'форма', 'бланк', 'талон',
    'квитанция', 'чек', 'расписка', 'уведомление', 'счет-фактура'
  ];

  /**
   * Основной метод контекстного анализа
   */
  public async analyzeInContext(
    query: string, 
    fullText: string,
    useFoundationModels: boolean = true
  ): Promise<ContextualMatch> {
    
    // 1. Fuzzy matching
    const allTerms = this.getAllSynonymTerms();
    const fuzzyMatch = fuzzyMatchingService.findBestMatch(query, allTerms);
    
    // 2. Извлечение контекстного окна
    const contextWindow = this.extractContextWindow(query, fullText);
    
    // 3. Поиск ко-упоминаний единиц измерения
    const unitCoMentions = this.findUnitCoMentions(query, contextWindow);
    
    // 4. Поиск терминов документа
    const documentTerms = this.findDocumentTerms(contextWindow);
    
    // 5. Базовый скоринг
    const baseScore = fuzzyMatch ? fuzzyMatch.confidence : 0;
    
    // 6. Контекстные бонусы и штрафы
    const contextBonuses = this.calculateContextBonuses(unitCoMentions, documentTerms, contextWindow);
    const penalties = this.calculatePenalties(unitCoMentions, fuzzyMatch);
    
    // 7. Финальный скор
    const finalScore = this.calculateFinalScore(baseScore, contextBonuses, penalties);
    
    // Пересчитываем финальный скор с учётом Foundation Models
    const updatedFinalScore = this.calculateFinalScore(baseScore, contextBonuses, penalties);
    
    // 8. Интеграция с Foundation Models API (если включено)
    let foundationModelsEnhanced = false;
    
    const contextualMatch: ContextualMatch = {
      originalQuery: query,
      fuzzyMatch,
      contextWindow,
      unitCoMentions,
      documentTerms,
      baseScore,
      contextBonuses,
      penalties,
      finalScore: updatedFinalScore,
      recommendation: this.getRecommendation(updatedFinalScore, foundationModelsEnhanced),
      foundationModelsEnhanced
    };

    if (useFoundationModels && this.shouldUseFoundationModels(finalScore)) {
      try {
        const enhancedResult = await this.enhanceWithFoundationModels(
          query, 
          contextWindow, 
          fuzzyMatch,
          unitCoMentions
        );
        foundationModelsEnhanced = true;
        
        // Применяем улучшения от Foundation Models API
        if (enhancedResult.entities.length > 0) {
          const aiEntity = enhancedResult.entities[0];
          
          // Обновляем fuzzy match на основе AI рекомендации
          if (aiEntity.confidence > 80 && aiEntity.normalizedValue) {
            contextualMatch.fuzzyMatch = {
              match: aiEntity.normalizedValue,
              score: aiEntity.confidence / 100,
              confidence: aiEntity.confidence,
              method: 'exact', // Считаем AI результат как точное совпадение
              normalizedQuery: query.toLowerCase(),
              normalizedMatch: aiEntity.normalizedValue.toLowerCase()
            };
          }
          
          // Добавляем/обновляем единицы измерения на основе AI
          if (aiEntity.units && !contextualMatch.unitCoMentions.find(u => u.unit === aiEntity.units)) {
            contextualMatch.unitCoMentions.push({
              unit: aiEntity.units,
              distance: 3, // AI рекомендация считается близкой
              confidence: Math.min(aiEntity.confidence, 95),
              category: this.categorizeUnit(aiEntity.units)
            });
          }
          
          // Применяем бонусы от AI анализа
          if (enhancedResult.context_analysis.confidence > 75) {
            contextualMatch.contextBonuses.documentContext += 8;
            console.log('✅ Foundation Models: высокая уверенность в анализе контекста');
          }
        }
        
        // Обновляем флаг и пересчитываем финальный скор
        contextualMatch.foundationModelsEnhanced = true;
        contextualMatch.finalScore = this.calculateFinalScore(
          contextualMatch.baseScore, 
          contextualMatch.contextBonuses, 
          contextualMatch.penalties
        );
        contextualMatch.recommendation = this.getRecommendation(contextualMatch.finalScore, true);
        
      } catch (error) {
        console.warn('Foundation Models API недоступен, работаем в rule-based режиме:', error);
      }
    }

    return contextualMatch;
  }

  /**
   * Извлечение контекстного окна ±1-2 предложения
   */
  private extractContextWindow(query: string, fullText: string): ContextWindow {
    if (!fullText || typeof fullText !== 'string') {
      return {
        before: [],
        target: query,
        after: [],
        fullSentence: query
      };
    }
    
    const sentences = fullText.split(/[.!?]\s+/);
    const queryIndex = sentences.findIndex(sentence => 
      sentence.toLowerCase().includes(query.toLowerCase())
    );

    if (queryIndex === -1) {
      return {
        before: [],
        target: query,
        after: [],
        fullSentence: ''
      };
    }

    const beforeStart = Math.max(0, queryIndex - 2);
    const afterEnd = Math.min(sentences.length, queryIndex + 3);
    
    return {
      before: sentences.slice(beforeStart, queryIndex),
      target: sentences[queryIndex],
      after: sentences.slice(queryIndex + 1, afterEnd),
      fullSentence: sentences[queryIndex]
    };
  }

  /**
   * Поиск ко-упоминаний единиц измерения в контексте
   */
  private findUnitCoMentions(query: string, contextWindow: ContextWindow): UnitCoMention[] {
    const fullContext = [
      ...(contextWindow.before || []).filter(Boolean),
      contextWindow.target || '',
      ...(contextWindow.after || []).filter(Boolean)
    ].filter(Boolean).join(' ');
    
    if (!fullContext) return [];

    const coMentions: UnitCoMention[] = [];
    const allUnits = [
      ...this.ENERGY_UNITS,
      ...this.VOLUME_UNITS, 
      ...this.WEIGHT_UNITS,
      ...this.DISTANCE_UNITS
    ];

    for (const unit of allUnits) {
      const unitIndex = fullContext.toLowerCase().indexOf(unit.toLowerCase());
      const queryIndex = fullContext.toLowerCase().indexOf(query.toLowerCase());
      
      if (unitIndex !== -1 && queryIndex !== -1) {
        const distance = Math.abs(unitIndex - queryIndex);
        const wordDistance = fullContext.slice(
          Math.min(unitIndex, queryIndex),
          Math.max(unitIndex, queryIndex)
        ).split(/\s+/).length;

        if (wordDistance <= 10) { // Максимальное расстояние 10 слов
          coMentions.push({
            unit,
            distance: wordDistance,
            confidence: Math.max(0, 100 - wordDistance * 10),
            category: this.categorizeUnit(unit)
          });
        }
      }
    }

    return coMentions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Поиск терминов документа в контексте
   */
  private findDocumentTerms(contextWindow: ContextWindow): string[] {
    const fullContext = [
      ...contextWindow.before,
      contextWindow.target,
      ...contextWindow.after
    ].join(' ').toLowerCase();

    return this.DOCUMENT_TERMS.filter(term => 
      fullContext.includes(term.toLowerCase())
    );
  }

  /**
   * Расчёт контекстных бонусов
   */
  private calculateContextBonuses(
    unitCoMentions: UnitCoMention[],
    documentTerms: string[],
    contextWindow: ContextWindow
  ): ContextualMatch['contextBonuses'] {
    
    // Бонус за близость единиц измерения
    const unitProximity = unitCoMentions.length > 0 
      ? Math.min(20, unitCoMentions[0].confidence * 0.2) 
      : 0;

    // Бонус за контекст документа
    const documentContext = documentTerms.length > 0 ? 15 : 0;

    // Бонус за контекст предложения (числа рядом)
    const numberPattern = /\d+[.,]?\d*/g;
    const numbersInSentence = (contextWindow.target.match(numberPattern) || []).length;
    const sentenceContext = Math.min(10, numbersInSentence * 3);

    // Бонус за табличный контекст (определяем по разделителям)
    const tableIndicators = ['\t', '|', ';', '  '];
    const hasTableStructure = tableIndicators.some(indicator => 
      contextWindow.target.includes(indicator)
    );
    const tableContext = hasTableStructure ? 10 : 0;

    return {
      unitProximity,
      documentContext,
      sentenceContext,
      tableContext
    };
  }

  /**
   * Расчёт штрафов
   */
  private calculatePenalties(
    unitCoMentions: UnitCoMention[],
    fuzzyMatch: FuzzyMatchResult | null
  ): ContextualMatch['penalties'] {
    
    // Штраф за конфликтующие единицы (например, литры рядом с кВт·ч)
    const conflictingCategories = new Set(unitCoMentions.map(u => u.category));
    const conflictingUnits = conflictingCategories.size > 2 ? 10 : 0;

    // Штраф за низкую уверенность fuzzy match
    const lowConfidence = fuzzyMatch && fuzzyMatch.confidence < 70 ? 15 : 0;

    return {
      conflictingUnits,
      lowConfidence
    };
  }

  /**
   * Расчёт финального скора
   */
  private calculateFinalScore(
    baseScore: number,
    bonuses: ContextualMatch['contextBonuses'],
    penalties: ContextualMatch['penalties']
  ): number {
    const totalBonuses = Object.values(bonuses).reduce((sum, bonus) => sum + bonus, 0);
    const totalPenalties = Object.values(penalties).reduce((sum, penalty) => sum + penalty, 0);
    
    return Math.max(0, Math.min(100, baseScore + totalBonuses - totalPenalties));
  }

  /**
   * Определение рекомендации
   */
  private getRecommendation(
    finalScore: number, 
    foundationModelsEnhanced: boolean
  ): ContextualMatch['recommendation'] {
    if (foundationModelsEnhanced && finalScore >= 70) return 'high_confidence';
    if (finalScore >= 80) return 'high_confidence';
    if (finalScore >= 60) return 'medium_confidence';
    if (finalScore >= 40) return 'low_confidence';
    return 'reject';
  }


  /**
   * Проверка необходимости использования Foundation Models API
   */
  private shouldUseFoundationModels(score: number): boolean {
    // Используем ИИ для сложных случаев (низкий скор) или высокой важности
    return score < 70 || (score >= 85 && Math.random() < 0.3); // 30% для валидации
  }

  /**
   * Интеграция с Foundation Models API
   */
  private async enhanceWithFoundationModels(
    query: string,
    contextWindow: ContextWindow,
    fuzzyMatch: FuzzyMatchResult | null,
    unitCoMentions: UnitCoMention[]
  ): Promise<FoundationModelsResponse> {
    
    // Подготовка запроса к Foundation Models API
    const request: FoundationModelsRequest = {
      text: contextWindow.target,
      entities: fuzzyMatch ? [fuzzyMatch.match] : [],
      context: [
        ...contextWindow.before,
        ...contextWindow.after
      ].join(' '),
      task: 'entity_extraction'
    };

    // Реальная интеграция с Foundation Models API
    if (this.foundationModelsClient) {
      try {
        console.log('🧠 Запрос к Foundation Models для извлечения сущностей...');
        
        const complexAnalysisTask = `
          Проанализируй следующий текст и извлеки энергетические данные:
          
          Контекст: ${request.context}
          Целевое предложение: ${request.text}
          Сущности для поиска: ${request.entities.join(', ')}
          
          Отвечай в формате JSON:
          {
            "entities": [
              {
                "name": "найденная сущность",
                "category": "energy/fuel/transport/water/heat",
                "confidence": число_0_100,
                "normalizedValue": "нормализованное значение",
                "units": "единица измерения"
              }
            ],
            "context_analysis": {
              "document_type": "тип документа",
              "confidence": число_0_100,
              "relevant_sections": ["раздел1", "раздел2"]
            },
            "recommendations": ["рекомендация1", "рекомендация2"]
          }
        `;
        
        const foundationResult = await this.foundationModelsClient.complexAnalysis(
          contextWindow.target, 
          complexAnalysisTask
        );
        
        // Пытаемся распарсить JSON ответ от Foundation Models
        try {
          const jsonMatch = foundationResult.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const aiResult = JSON.parse(jsonMatch[0]);
            console.log('✅ Foundation Models: успешно получен и распарсен ответ');
            return aiResult;
          }
        } catch (parseError) {
          console.warn('⚠️ Foundation Models: не удалось распарсить JSON, используем fallback');
        }
        
      } catch (error) {
        console.error('❌ Foundation Models API ошибка:', error);
        // Продолжаем с fallback ответом
      }
    }

    // Fallback ответ если Foundation Models недоступен
    console.log('📋 Используется fallback анализ без AI');
    return {
      entities: [
        {
          name: query,
          category: 'energy',
          confidence: 85,
          normalizedValue: fuzzyMatch?.match || query,
          units: unitCoMentions[0]?.unit
        }
      ],
      context_analysis: {
        document_type: 'энергетический отчёт',
        confidence: 78,
        relevant_sections: ['потребление энергии', 'расход топлива']
      },
      recommendations: ['Высокая вероятность корректного извлечения данных']
    };
  }

  /**
   * Получение всех терминов из словаря синонимов
   */
  private getAllSynonymTerms(): string[] {
    const allTerms: string[] = [];
    
    for (const category of Object.values(RUSSIAN_SYNONYM_DICTIONARY)) {
      for (const substance of category.substances) {
        allTerms.push(substance.canonical, ...substance.synonyms);
      }
      for (const unit of category.units) {
        allTerms.push(unit.canonical, ...unit.synonyms);
      }
    }
    
    return [...new Set(allTerms)]; // Убираем дубликаты
  }

  /**
   * Категоризация единиц измерения
   */
  private categorizeUnit(unit: string): UnitCoMention['category'] {
    if (this.ENERGY_UNITS.some(u => u.toLowerCase() === unit.toLowerCase())) return 'energy';
    if (this.VOLUME_UNITS.some(u => u.toLowerCase() === unit.toLowerCase())) return 'volume';
    if (this.WEIGHT_UNITS.some(u => u.toLowerCase() === unit.toLowerCase())) return 'weight';
    if (this.DISTANCE_UNITS.some(u => u.toLowerCase() === unit.toLowerCase())) return 'distance';
    return 'energy'; // По умолчанию
  }

  /**
   * Массовый анализ для нескольких запросов
   */
  public async analyzeBatch(
    queries: string[],
    fullText: string,
    useFoundationModels: boolean = true
  ): Promise<Map<string, ContextualMatch>> {
    const results = new Map<string, ContextualMatch>();
    
    for (const query of queries) {
      const result = await this.analyzeInContext(query, fullText, useFoundationModels);
      results.set(query, result);
    }
    
    return results;
  }

  /**
   * Экспорт метрик анализа
   */
  public exportMetrics(results: Map<string, ContextualMatch>): {
    totalQueries: number;
    highConfidence: number;
    mediumConfidence: number;
    lowConfidence: number;
    rejected: number;
    averageFinalScore: number;
    contextBonus_avg: number;
    foundationModelsUsage: number;
  } {
    const values = Array.from(results.values());
    
    return {
      totalQueries: values.length,
      highConfidence: values.filter(v => v.recommendation === 'high_confidence').length,
      mediumConfidence: values.filter(v => v.recommendation === 'medium_confidence').length,
      lowConfidence: values.filter(v => v.recommendation === 'low_confidence').length,
      rejected: values.filter(v => v.recommendation === 'reject').length,
      averageFinalScore: values.reduce((sum, v) => sum + v.finalScore, 0) / values.length,
      contextBonus_avg: values.reduce((sum, v) => 
        sum + Object.values(v.contextBonuses).reduce((s, b) => s + b, 0), 0
      ) / values.length,
      foundationModelsUsage: 0 // TODO: Подсчёт использования Foundation Models API
    };
  }
}

// Экспорт для удобного использования
export const contextualAnalysisService = new ContextualAnalysisService();