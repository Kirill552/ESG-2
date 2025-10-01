/**
 * Foundation Models API клиент через OpenAI SDK
 * Совместимый интерфейс для постобработки OCR и извлечения данных
 */

import 'dotenv/config';
import OpenAI from 'openai';

export interface FoundationModelsConfig {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
}

export interface ExtractionResult {
  extractedData: any;
  confidence: number;
}

export interface ClassificationResult {
  documentType: string;
  confidence: number;
}

export class FoundationModelsClient {
  private client: OpenAI;
  private defaultModel: string;

  constructor(config?: Partial<FoundationModelsConfig>) {
    // Читаем из ENV с fallback на переданную конфигурацию
    const apiKey = config?.apiKey || process.env.FOUNDATION_MODELS_API_KEY;
    const baseUrl = config?.baseUrl || process.env.FOUNDATION_MODELS_BASE_URL || 'https://foundation-models.api.cloud.ru/v1';
    const defaultModel = config?.defaultModel || process.env.FOUNDATION_MODELS_DEFAULT_MODEL || 'GigaChat/GigaChat-2-Max';

    if (!apiKey) {
      throw new Error('FOUNDATION_MODELS_API_KEY не установлен');
    }

    this.client = new OpenAI({
      apiKey,
      baseURL: baseUrl
    });
    this.defaultModel = defaultModel;
  }

  /**
   * Исправляет ошибки OCR в тексте
   */
  async fixOcrErrors(ocrText: string): Promise<string> {
    console.log('🔧 Foundation Models: исправление ошибок OCR...');
    
    try {
      const response = await this.client.chat.completions.create({
        model: this.defaultModel,
        messages: [
          {
            role: 'system',
            content: 'Ты эксперт по исправлению ошибок OCR в русских документах. Исправь ошибки распознавания, сохраняя числа и единицы измерения точно.'
          },
          {
            role: 'user',
            content: `Исправь ошибки OCR в этом тексте, сохрани все числа и единицы измерения (кВт·ч, Гкал, м³, л, км, т):\n\n${ocrText}`
          }
        ],
        max_tokens: Math.min(ocrText.length * 2, 2000),
        temperature: 0.1 // Низкая температура для точности
      });

      const fixedText = response.choices[0]?.message?.content || ocrText;
      console.log('✅ Foundation Models: OCR ошибки исправлены');
      return fixedText;
    } catch (error) {
      console.error('❌ Foundation Models: ошибка исправления OCR:', error);
      return ocrText;
    }
  }

  /**
   * Извлекает энергетические данные из текста согласно Приказу 371
   */
  async extractEnergyData(text: string): Promise<ExtractionResult> {
    console.log('📊 Foundation Models: извлечение данных по Приказу Минприроды 371...');

    try {
      const response = await this.client.chat.completions.create({
        model: this.defaultModel,
        messages: [
          {
            role: 'system',
            content: `Ты эксперт по извлечению данных для расчёта выбросов парниковых газов согласно Приказу Минприроды РФ от 27.05.2022 N 371.

Извлекай данные в JSON формате:
{
  "fuel": [
    {"type": "бензин"|"дизель"|"природный газ"|"мазут"|"уголь"|"керосин"|"кокс", "value": число, "unit": "л"|"т"|"м³"|"тыс. м³"}
  ],
  "electricity": [
    {"value": число, "unit": "кВт·ч"|"МВт·ч", "period": "период если есть"}
  ],
  "heat": [
    {"value": число, "unit": "Гкал", "period": "период если есть"}
  ]
}

ВАЖНО:
- Точно определяй единицы измерения: л (литры), т (тонны), м³ (кубометры), кВт·ч (киловатт-часы), Гкал (гигакалории)
- Различай виды топлива: бензин, дизель, природный газ, уголь, мазут
- Извлекай ТОЛЬКО числовые значения с правильными единицами`
          },
          {
            role: 'user',
            content: `Извлеки ИСХОДНЫЕ ДАННЫЕ О РАСХОДЕ РЕСУРСОВ (НЕ коэффициенты эмиссии!):

ИЩЕМ:
- Расход топлива: количество и единицы (л, т, м³, тыс. м³)
- Потребление энергии: количество и единицы (кВт·ч, МВт·ч, Гкал)
- Период отчета (год, квартал, месяц)
- Название объекта/филиала (котельная, цех, и т.д.)

НЕ извлекай:
- EF, OF, k, NCV - коэффициенты (они уже есть в системе!)
- Выбросы CO₂, CO₂-эквивалент - результаты расчетов
- ИНН, ОГРН, КПП - реквизиты организации

ПРИМЕРЫ ПРАВИЛЬНЫХ ДАННЫХ:
"Расход природного газа: 27855 тыс. м³"
"Потребление дизтоплива: 5000 л"
"Израсходовано мазута М40: 150 т"
"Электроэнергия: 50000 кВт·ч"
"Тепловая энергия: 1200 Гкал"

Текст для анализа:\n\n${text}`
          }
        ],
        max_tokens: 1500,
        temperature: 0.2
      });

      const content = response.choices[0]?.message?.content || '{}';

      // Пытаемся извлечь JSON из ответа
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const extractedData = JSON.parse(jsonMatch[0]);

        // Простая оценка уверенности на основе количества найденных данных
        const totalItems = Object.values(extractedData).reduce((sum: number, arr: any) =>
          sum + (Array.isArray(arr) ? arr.length : 0), 0);
        const confidence = Math.min(totalItems * 0.2 + 0.3, 0.9);

        console.log('✅ Foundation Models: данные извлечены по Приказу 371');
        return { extractedData, confidence };
      }

      return { extractedData: {}, confidence: 0.1 };
    } catch (error) {
      console.error('❌ Foundation Models: ошибка извлечения данных:', error);
      return { extractedData: {}, confidence: 0 };
    }
  }

  /**
   * Классифицирует тип документа
   */
  async classifyDocument(text: string): Promise<ClassificationResult> {
    console.log('🏷️ Foundation Models: классификация документа...');
    
    try {
      const response = await this.client.chat.completions.create({
        model: this.defaultModel,
        messages: [
          {
            role: 'system',
            content: 'Определи тип документа. Отвечай одним словом: счет, накладная, акт, справка, договор, отчет, или неизвестно.'
          },
          {
            role: 'user',
            content: `Определи тип этого документа:\n\n${text.substring(0, 500)}...`
          }
        ],
        max_tokens: 50,
        temperature: 0.1
      });

      const content = response.choices[0]?.message?.content?.toLowerCase().trim() || 'неизвестно';
      
      // Извлекаем первое слово как тип документа
      const documentType = content.split(/\s+/)[0];
      
      // Простая оценка уверенности
      const knownTypes = ['счет', 'накладная', 'акт', 'справка', 'договор', 'отчет'];
      const confidence = knownTypes.includes(documentType) ? 0.8 : 0.3;
      
      console.log('✅ Foundation Models: документ классифицирован');
      return { documentType, confidence };
    } catch (error) {
      console.error('❌ Foundation Models: ошибка классификации:', error);
      return { documentType: 'неизвестно', confidence: 0 };
    }
  }

  /**
   * Классифицирует категорию документа для ESG отчётности
   */
  async classifyDocumentCategory(text: string): Promise<{
    category: 'Производство' | 'Поставщики' | 'Отходы' | 'Транспорт' | 'Энергия' | 'Прочее';
    confidence: number;
  }> {
    console.log('🏷️ Foundation Models: определение категории ESG документа...');

    try {
      const response = await this.client.chat.completions.create({
        model: this.defaultModel,
        messages: [
          {
            role: 'system',
            content: `Ты эксперт по классификации документов для ESG отчётности.
            Определи категорию документа на основе его содержания:
            - Производство: документы о производственных процессах, выбросах, промышленных операциях
            - Поставщики: счета, накладные, договоры с поставщиками сырья, материалов, топлива
            - Отходы: документы об утилизации, переработке, вывозе отходов
            - Транспорт: путевые листы, данные о перевозках, расход топлива транспорта
            - Энергия: счета за электричество, газ, тепло, данные о потреблении энергоресурсов
            - Прочее: если документ не попадает в другие категории

            Отвечай ТОЛЬКО названием категории одним словом.`
          },
          {
            role: 'user',
            content: `Определи категорию этого документа:\n\n${text.substring(0, 800)}...`
          }
        ],
        max_tokens: 20,
        temperature: 0.1
      });

      const content = response.choices[0]?.message?.content?.trim() || 'Прочее';

      // Нормализуем ответ к одной из доступных категорий
      const categoryMap: Record<string, 'Производство' | 'Поставщики' | 'Отходы' | 'Транспорт' | 'Энергия' | 'Прочее'> = {
        'производство': 'Производство',
        'поставщики': 'Поставщики',
        'отходы': 'Отходы',
        'транспорт': 'Транспорт',
        'энергия': 'Энергия',
        'прочее': 'Прочее'
      };

      const normalizedContent = content.toLowerCase();
      const category = categoryMap[normalizedContent] || 'Прочее';

      // Оценка уверенности
      const confidence = category !== 'Прочее' ? 0.85 : 0.4;

      console.log(`✅ Foundation Models: категория определена - ${category} (${confidence})`);
      return { category, confidence };
    } catch (error) {
      console.error('❌ Foundation Models: ошибка определения категории:', error);
      return { category: 'Прочее', confidence: 0 };
    }
  }

  /**
   * Сложный анализ документа
   */
  async complexAnalysis(text: string, task: string): Promise<string> {
    console.log('🧠 Foundation Models: сложный анализ документа...');

    try {
      const response = await this.client.chat.completions.create({
        model: this.defaultModel,
        messages: [
          {
            role: 'system',
            content: 'Ты эксперт по анализу российских энергетических и экологических документов. Проводи глубокий семантический анализ.'
          },
          {
            role: 'user',
            content: `${task}\n\nТекст документа:\n${text}`
          }
        ],
        max_tokens: 2000,
        temperature: 0.3
      });

      const result = response.choices[0]?.message?.content || '';
      console.log('✅ Foundation Models: сложный анализ завершен');
      return result;
    } catch (error) {
      console.error('❌ Foundation Models: ошибка сложного анализа:', error);
      return '';
    }
  }

  /**
   * Прямой вызов chat completion
   */
  async chatCompletion(messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[], options?: {
    model?: string;
    max_tokens?: number;
    temperature?: number;
  }): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    return await this.client.chat.completions.create({
      model: options?.model || this.defaultModel,
      messages,
      max_tokens: options?.max_tokens || 1000,
      temperature: options?.temperature || 0.7
    });
  }

  /**
   * Получает информацию о статусе клиента
   */
  getStatus(): {
    apiKey: string;
    baseUrl: string;
    defaultModel: string;
  } {
    return {
      apiKey: this.client.apiKey ? 'установлен' : 'не установлен',
      baseUrl: this.client.baseURL || 'неизвестно',
      defaultModel: this.defaultModel
    };
  }
}