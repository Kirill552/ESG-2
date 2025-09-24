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
   * Извлекает энергетические данные из текста
   */
  async extractEnergyData(text: string): Promise<ExtractionResult> {
    console.log('📊 Foundation Models: извлечение энергетических данных...');
    
    try {
      const response = await this.client.chat.completions.create({
        model: this.defaultModel,
        messages: [
          {
            role: 'system',
            content: `Ты эксперт по извлечению энергетических данных из российских документов. 
            Извлекай данные в JSON формате:
            {
              "electricity": [{"value": число, "unit": "кВт·ч", "period": "период"}],
              "gas": [{"value": число, "unit": "м³", "period": "период"}],
              "fuel": [{"value": число, "unit": "л", "type": "тип топлива"}],
              "transport": [{"value": число, "unit": "км", "type": "тип транспорта"}],
              "heat": [{"value": число, "unit": "Гкал", "period": "период"}]
            }`
          },
          {
            role: 'user',
            content: `Извлеки энергетические данные из этого текста в формате JSON:\n\n${text}`
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
        
        console.log('✅ Foundation Models: данные извлечены');
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