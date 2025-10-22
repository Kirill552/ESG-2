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
   * Извлекает короткое имя модели для отображения в логах
   * Например: "zai-org/GLM-4.6" → "GLM-4.6"
   */
  private getModelName(): string {
    // Если есть слэш, берем часть после слэша
    const parts = this.defaultModel.split('/');
    return parts[parts.length - 1] || this.defaultModel;
  }

  /**
   * Исправляет ошибки OCR в тексте
   */
  async fixOcrErrors(ocrText: string): Promise<string> {
    const modelName = this.getModelName();
    console.log(`🔧 ${modelName}: исправление ошибок OCR...`);

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
      console.log(`✅ ${modelName}: OCR ошибки исправлены`);
      return fixedText;
    } catch (error) {
      console.error(`❌ ${modelName}: ошибка исправления OCR:`, error);
      return ocrText;
    }
  }

  /**
   * Извлекает энергетические данные из текста согласно Приказу 371
   */
  async extractEnergyData(text: string): Promise<ExtractionResult> {
    const modelName = this.getModelName();
    console.log(`📊 ${modelName}: извлечение данных по Приказу Минприроды 371...`);

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

        console.log(`✅ ${modelName}: данные извлечены по Приказу 371`);
        return { extractedData, confidence };
      }

      return { extractedData: {}, confidence: 0.1 };
    } catch (error) {
      console.error(`❌ ${modelName}: ошибка извлечения данных:`, error);
      return { extractedData: {}, confidence: 0 };
    }
  }

  /**
   * Классифицирует тип документа
   */
  async classifyDocument(text: string): Promise<ClassificationResult> {
    const modelName = this.getModelName();
    console.log(`🏷️ ${modelName}: классификация документа...`);

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

      console.log(`✅ ${modelName}: документ классифицирован`);
      return { documentType, confidence };
    } catch (error) {
      console.error(`❌ ${modelName}: ошибка классификации:`, error);
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
    const modelName = this.getModelName();
    console.log(`🏷️ ${modelName}: определение категории ESG документа...`);

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

      console.log(`✅ ${modelName}: категория определена - ${category} (${confidence})`);
      return { category, confidence };
    } catch (error) {
      console.error(`❌ ${modelName}: ошибка определения категории:`, error);
      return { category: 'Прочее', confidence: 0 };
    }
  }

  /**
   * Классифицирует категорию документа используя Function Calling для максимальной точности
   * Использует Tool Calling API для структурированного ответа
   */
  async classifyDocumentCategoryWithTools(text: string, fileName?: string): Promise<{
    category: 'PRODUCTION' | 'SUPPLIERS' | 'WASTE' | 'TRANSPORT' | 'ENERGY' | 'OTHER';
    subcategory?: string;
    confidence: number;
    reasoning: string;
  }> {
    const modelName = this.getModelName();
    console.log(`🎯 ${modelName}: классификация с Function Calling...`);

    try {
      const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [{
        type: "function" as const,
        function: {
          name: "classify_document_category",
          description: "Определить категорию документа для отчетности 296-ФЗ по содержанию и имени файла",
          parameters: {
            type: "object",
            properties: {
              category: {
                type: "string",
                enum: ["PRODUCTION", "SUPPLIERS", "WASTE", "TRANSPORT", "ENERGY", "OTHER"],
                description: "Категория выбросов согласно 296-ФЗ: PRODUCTION (производство), SUPPLIERS (поставщики), WASTE (отходы), TRANSPORT (транспорт), ENERGY (энергия), OTHER (прочее)"
              },
              subcategory: {
                type: "string",
                description: "Уточнение категории (опционально): например 'Природный газ', 'Электроэнергия', 'Автотранспорт'"
              },
              confidence: {
                type: "number",
                minimum: 0,
                maximum: 1,
                description: "Уверенность в классификации от 0 до 1"
              },
              reasoning: {
                type: "string",
                description: "Краткое обоснование выбора категории на русском языке"
              }
            },
            required: ["category", "confidence", "reasoning"]
          }
        }
      }];

      const response = await this.client.chat.completions.create({
        model: this.defaultModel,
        messages: [
          {
            role: 'system',
            content: `Ты эксперт по классификации документов для отчётности по выбросам парниковых газов согласно 296-ФЗ.

ВАЖНО: ОБЯЗАТЕЛЬНО используй доступную функцию classify_document_category для структурированного ответа!

Категории документов:

1. PRODUCTION (Производство):
   * Признаки: производственный процесс, завод, фабрика, цех, промышленное предприятие
   * Содержит: выпуск продукции, объем производства, технологический процесс, производственные мощности
   * Ключевые слова: изготовление, выплавка, выпуск, производство товаров, технологическая линия
   * Примеры: отчет о производстве, акт выполненных работ на производстве, данные о промышленных выбросах
   * Если найдено 3+ признака производственного документа → PRODUCTION

2. SUPPLIERS (Поставщики):
   * Признаки: закупка, поставка, счет на оплату, накладная от поставщика, договор поставки
   * Содержит: наименование товара, количество, цена, поставщик, покупатель, реквизиты сторон
   * Ключевые слова: счет-фактура, товарная накладная (НЕ транспортная!), ТОРГ-12, поставлено, приобретено, закупка топлива, закупка сырья, закупка материалов
   * Примеры: счет за топливо от АЗС, накладная на поставку угля, договор на закупку газа
   * Если найдено 3+ признака документа от поставщика → SUPPLIERS

3. WASTE (Отходы):
   * Признаки: утилизация, переработка, вывоз отходов, полигон, мусор, отработанные материалы
   * Содержит: вид отходов, класс опасности, масса/объем отходов, способ утилизации, организация-переработчик
   * Ключевые слова: ТБО (твердые бытовые отходы), производственные отходы, лом, металлолом, макулатура, утилизация, переработка, захоронение, мусоровывоз
   * Примеры: акт приема-передачи отходов, договор на вывоз мусора, справка об утилизации
   * Если найдено 3+ признака документа об отходах → WASTE

4. TRANSPORT (Транспорт):
   * Признаки: товарно-транспортная накладная, ТТН, путевой лист, акт оказания транспортных услуг, перевозка груза
   * Содержит: маршрут (откуда-куда), автомобиль (марка/модель), государственный номер, водитель (ФИО), груз, расстояние, дата перевозки
   * Ключевые слова: перевозка, транспортировка, доставка грузов, автомобильная перевозка, водитель, госномер, маршрут следования, пункт отправления, пункт назначения
   * Примеры: ТТН №123, путевой лист водителя, акт выполненных перевозок
   * Если найдено 3+ признака транспортного документа → TRANSPORT

5. ENERGY (Энергия):
   * Признаки: потребление энергоресурсов, счет за коммунальные услуги, электроснабжение, теплоснабжение, газоснабжение
   * Содержит: показания счетчиков, расход энергии, тариф, начислено, объем потребления, период расчета
   * Ключевые слова: электроэнергия, кВт·ч, тепловая энергия, Гкал, природный газ, м³, газоснабжение, энергоснабжение, ресурсоснабжающая организация
   * Примеры: счет за электричество, акт об отпуске тепла, данные счетчика газа
   * Если найдено 3+ признака документа об энергопотреблении → ENERGY

6. OTHER (Прочее):
   * Используй только если документ НЕ подходит ни под одну категорию выше
   * Примеры: административные документы, договоры без привязки к ресурсам, общая корреспонденция

ПРАВИЛО ПРИОРИТЕТА:
- Если документ одновременно похож на SUPPLIERS и TRANSPORT → выбирай по наличию МАРШРУТА и АВТОМОБИЛЯ (если есть → TRANSPORT)
- Если документ содержит закупку топлива БЕЗ перевозки → SUPPLIERS
- Если документ содержит перевозку С указанием маршрута → TRANSPORT

Анализируй текст документа и его имя файла для точного определения категории.`
          },
          {
            role: 'user',
            content: `Определи категорию документа:

Имя файла: ${fileName || 'не указано'}

Содержимое (первые 1500 символов):
${text.substring(0, 1500)}...`
          }
        ],
        tools,
        max_tokens: 500,
        temperature: 0.2
      });

      const message = response.choices[0]?.message;

      // Проверяем использование tool
      if (message?.tool_calls && message.tool_calls.length > 0) {
        const toolCall = message.tool_calls[0];
        const args = JSON.parse(toolCall.function.arguments);

        console.log(`✅ ${modelName} Function Calling результат:`, {
          category: args.category,
          confidence: args.confidence,
          reasoning: args.reasoning?.substring(0, 100)
        });

        return {
          category: args.category,
          subcategory: args.subcategory,
          confidence: args.confidence || 0.7,
          reasoning: args.reasoning || 'Категория определена автоматически'
        };
      }

      // Fallback: если модель не использовала tool
      console.warn(`⚠️ ${modelName} не использовала Function Calling, fallback на обычную категоризацию`);
      const fallback = await this.classifyDocumentCategory(text);

      const categoryMapping: Record<string, 'PRODUCTION' | 'SUPPLIERS' | 'WASTE' | 'TRANSPORT' | 'ENERGY' | 'OTHER'> = {
        'Производство': 'PRODUCTION',
        'Поставщики': 'SUPPLIERS',
        'Отходы': 'WASTE',
        'Транспорт': 'TRANSPORT',
        'Энергия': 'ENERGY',
        'Прочее': 'OTHER'
      };

      return {
        category: categoryMapping[fallback.category],
        confidence: fallback.confidence,
        reasoning: 'Категория определена без использования Function Calling'
      };

    } catch (error) {
      console.error(`❌ ${modelName} Function Calling ошибка:`, error);

      // Полный fallback на старый метод
      try {
        const fallback = await this.classifyDocumentCategory(text);
        const categoryMapping: Record<string, 'PRODUCTION' | 'SUPPLIERS' | 'WASTE' | 'TRANSPORT' | 'ENERGY' | 'OTHER'> = {
          'Производство': 'PRODUCTION',
          'Поставщики': 'SUPPLIERS',
          'Отходы': 'WASTE',
          'Транспорт': 'TRANSPORT',
          'Энергия': 'ENERGY',
          'Прочее': 'OTHER'
        };

        return {
          category: categoryMapping[fallback.category],
          confidence: fallback.confidence * 0.8, // Снижаем confidence из-за fallback
          reasoning: 'Категория определена через резервный метод из-за ошибки Function Calling'
        };
      } catch {
        return {
          category: 'OTHER',
          confidence: 0,
          reasoning: 'Не удалось определить категорию'
        };
      }
    }
  }

  /**
   * Сложный анализ документа
   */
  async complexAnalysis(text: string, task: string): Promise<string> {
    const modelName = this.getModelName();
    console.log(`🧠 ${modelName}: сложный анализ документа...`);

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
      console.log(`✅ ${modelName}: сложный анализ завершен`);
      return result;
    } catch (error) {
      console.error(`❌ ${modelName}: ошибка сложного анализа:`, error);
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
   * Извлекает данные из транспортного документа (ТТН, акт перевозки, путевой лист)
   * Задача 10.2 из OCR-REPORTS.md
   */
  async extractTransportDocumentData(text: string): Promise<{
    vehicle: {
      model: string;
      licensePlate: string;
      modelConfidence: number;
    };
    route: {
      from: string;
      to: string;
      fromCity: string;
      toCity: string;
    };
    cargo?: {
      weight: number;
      unit: string;
    };
    confidence: number;
  }> {
    const modelName = this.getModelName();
    console.log(`🚗 ${modelName}: извлечение данных из транспортного документа...`);

    try {
      const response = await this.client.chat.completions.create({
        model: this.defaultModel,
        messages: [
          {
            role: 'system',
            content: `Ты эксперт по извлечению данных из российских транспортных документов (ТТН, акты перевозки, путевые листы).

ВАЖНО: ОБЯЗАТЕЛЬНО отвечай ТОЛЬКО валидным JSON! Никакого дополнительного текста!

ПРИМЕРЫ УСПЕШНОГО ИЗВЛЕЧЕНИЯ:

ПРИМЕР 1 - АКТ ПЕРЕВОЗКИ:
Текст: "Тягач Газель Т 223 НМ 196 RUS, маршрут г. Екатеринбург → г. Москва, Хорошевское шоссе, 27"
Ответ:
{
  "vehicle": {
    "model": "Газель",
    "licensePlate": "Т 223 НМ 196 RUS",
    "modelConfidence": 0.9
  },
  "route": {
    "from": "г. Екатеринбург",
    "to": "г. Москва, Хорошевское шоссе, 27",
    "fromCity": "Екатеринбург",
    "toCity": "Москва"
  },
  "cargo": null
}

ПРИМЕР 2 - ТТН С ПОЛНЫМИ ДАННЫМИ:
Текст: "Автомобиль Мерседес Р395АУ40, маршрут: 391523 Рязанская обл., село Мосолово → 140100 Московская обл., город Раменское. Масса брутто: 5 т."
Ответ:
{
  "vehicle": {
    "model": "Мерседес",
    "licensePlate": "Р395АУ40",
    "modelConfidence": 0.95
  },
  "route": {
    "from": "391523 Рязанская обл., село Мосолово",
    "to": "140100 Московская обл., город Раменское",
    "fromCity": "Мосолово",
    "toCity": "Раменское"
  },
  "cargo": {
    "weight": 5,
    "unit": "т"
  }
}

ПРАВИЛА ИЗВЛЕЧЕНИЯ:
1. Автомобиль: ищи марку (Газель, КАМАЗ, Мерседес, Фура, МАЗ, ЗИЛ, и т.д.)
2. Госномер: полный номер с регионом (например "Т 223 НМ 196 RUS" или "Р395АУ40")
3. Маршрут: ищи слова "маршрут", "от", "до", "откуда", "куда", стрелки "→"
4. Города: извлекай только название города/населенного пункта (без области/края)
5. Груз: ищи "масса", "вес", "тонн", "кг", "т"

ВАЖНО - ФОРМАТ ОТВЕТА:
- ВСЕГДА возвращай ТОЛЬКО чистый JSON без markdown, без кодовых блоков, без пояснений!
- Если поле ОБЯЗАТЕЛЬНО (vehicle.model, vehicle.licensePlate, route.fromCity, route.toCity), но не найдено → верни пустую строку ""
- Если поле ОПЦИОНАЛЬНО (cargo) и не найдено → верни null
- modelConfidence: 0.9+ если марка явно указана, 0.7+ если есть синонимы/сокращения, 0.5+ если угадал по контексту

ПРИМЕР ОТВЕТА ДЛЯ НЕПОЛНЫХ ДАННЫХ:
{
  "vehicle": {"model": "Газель", "licensePlate": "", "modelConfidence": 0.8},
  "route": {"from": "г. Москва", "to": "", "fromCity": "Москва", "toCity": ""},
  "cargo": null
}`
          },
          {
            role: 'user',
            content: `Проанализируй транспортный документ и извлеки:

ОБЯЗАТЕЛЬНО для расчета выбросов:
- Марка и модель автомобиля
- Государственный номер (полностью)
- Маршрут: откуда → куда (названия городов отдельно)

ОПЦИОНАЛЬНО:
- Вес груза (число + единицы измерения)

Текст для анализа:\n\n${text}`
          }
        ],
        max_tokens: 1000,
        temperature: 0.2
      });

      const content = response.choices[0]?.message?.content || '{}';

      // Извлекаем JSON из ответа
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);

        // Оценка уверенности на основе полноты данных
        let confidence = 0.5;
        if (data.vehicle?.model && data.vehicle?.licensePlate) confidence += 0.2;
        if (data.route?.fromCity && data.route?.toCity) confidence += 0.2;
        if (data.cargo?.weight) confidence += 0.1;

        console.log(`✅ ${modelName}: данные транспортного документа извлечены`);
        return {
          vehicle: data.vehicle || { model: '', licensePlate: '', modelConfidence: 0 },
          route: data.route || { from: '', to: '', fromCity: '', toCity: '' },
          cargo: data.cargo,
          confidence
        };
      }

      return {
        vehicle: { model: '', licensePlate: '', modelConfidence: 0 },
        route: { from: '', to: '', fromCity: '', toCity: '' },
        confidence: 0.1
      };
    } catch (error) {
      console.error(`❌ ${modelName}: ошибка извлечения данных транспорта:`, error);
      return {
        vehicle: { model: '', licensePlate: '', modelConfidence: 0 },
        route: { from: '', to: '', fromCity: '', toCity: '' },
        confidence: 0
      };
    }
  }

  /**
   * Определяет тип топлива автомобиля по марке/модели
   * Задача 10.3 из OCR-REPORTS.md
   */
  async determineFuelType(
    vehicleModel: string,
    licensePlate?: string
  ): Promise<{
    fuelType: 'gasoline' | 'diesel' | 'unknown';
    confidence: number;
    reasoning: string;
    year?: number;
    engineType?: string;
  }> {
    const modelName = this.getModelName();
    console.log(`🔍 ${modelName}: определение типа топлива для "${vehicleModel}"...`);

    try {
      const response = await this.client.chat.completions.create({
        model: this.defaultModel,
        messages: [
          {
            role: 'system',
            content: `Ты эксперт по российским и европейским автомобилям и грузовому транспорту.
Определяй тип топлива автомобиля на основе марки и модели.

ВАЖНО: ОБЯЗАТЕЛЬНО отвечай ТОЛЬКО валидным JSON! Никакого дополнительного текста!

ПРАВИЛА ОПРЕДЕЛЕНИЯ:
1. ГРУЗОВИКИ и ФУРЫ (1.5+ тонн) → почти всегда дизель (confidence: 0.85+)
2. ЛЕГКИЕ КОММЕРЧЕСКИЕ (<1.5 тонн) → чаще дизель, реже бензин (confidence: 0.7+)
3. ЛЕГКОВЫЕ → зависит от марки/модели (confidence: 0.8+)

ПРИМЕРЫ ГРУЗОВЫХ:
- Мерседес (без уточнения) → дизель 0.9 (большинство Mercedes грузовиков на дизеле)
- Мерседес Спринтер → дизель 0.9
- Мерседес Актрос → дизель 1.0 (только дизель)
- КАМАЗ (любая модель) → дизель 1.0 (только дизель)
- МАЗ → дизель 1.0
- ЗИЛ-130 → бензин 0.9 (старые грузовики)
- Фура / Грузовик / Тягач → дизель 0.85 (по умолчанию)

ПРИМЕРЫ ЛЕГКИХ КОММЕРЧЕСКИХ:
- ГАЗель 3302 (до 2018) → бензин 0.8 (УМЗ-4216)
- ГАЗель Next (после 2013) → дизель 0.8 (Cummins ISF 2.8)
- ГАЗель (без уточнения) → бензин 0.7 (старые модели чаще бензин)
- Volkswagen Transporter → дизель 0.85
- Ford Transit → дизель 0.85

ПРИМЕРЫ ЛЕГКОВЫХ:
- Лада Веста → бензин 0.95
- Toyota Camry → бензин 0.9
- Volkswagen Passat → дизель 0.7 (в РФ чаще дизель)

Отвечай JSON:
{
  "fuelType": "gasoline"|"diesel"|"unknown",
  "confidence": число от 0 до 1,
  "reasoning": "краткое объяснение на русском",
  "year": примерный год (опционально),
  "engineType": "тип двигателя" (опционально)
}

ВАЖНО:
- Если уверен на 70%+ → указывай fuelType
- Если уверен меньше 70% → верни "unknown" с низким confidence
- Для "Мерседес" без уточнений → дизель (0.9), т.к. в РФ Мерседесы грузовые чаще дизельные`
          },
          {
            role: 'user',
            content: `Определи тип топлива автомобиля:
Модель: ${vehicleModel}
${licensePlate ? `Государственный номер: ${licensePlate}` : ''}`
          }
        ],
        max_tokens: 500,
        temperature: 0.2
      });

      const content = response.choices[0]?.message?.content || '{}';

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);

        console.log(`✅ ${modelName}: тип топлива определен - ${result.fuelType} (${result.confidence})`);
        return {
          fuelType: result.fuelType || 'unknown',
          confidence: result.confidence || 0.5,
          reasoning: result.reasoning || 'Тип топлива определен по модели',
          year: result.year,
          engineType: result.engineType
        };
      }

      return {
        fuelType: 'unknown',
        confidence: 0.3,
        reasoning: 'Не удалось определить тип топлива'
      };
    } catch (error) {
      console.error(`❌ ${modelName}: ошибка определения типа топлива:`, error);
      return {
        fuelType: 'unknown',
        confidence: 0,
        reasoning: 'Ошибка при определении типа топлива'
      };
    }
  }

  /**
   * Рассчитывает расстояние между городами РФ по федеральным трассам
   * Задача 10.4 из OCR-REPORTS.md
   */
  async calculateRouteDistance(
    fromCity: string,
    toCity: string
  ): Promise<{
    distance: number;
    distanceSource: 'ai' | 'cache' | 'user' | 'starline';
    confidence: number;
    reasoning?: string;
  }> {
    const modelName = this.getModelName();
    console.log(`🗺️ ${modelName}: расчет расстояния ${fromCity} → ${toCity}...`);

    // Сначала пробуем StarLine Maps API (более точно для РФ)
    try {
      const { starLineMapsService } = await import('./starline-maps-service');
      const starlineResult = await starLineMapsService.calculateRoute(fromCity, toCity, 'auto');

      if (starlineResult && starlineResult.distance > 0) {
        console.log(`✅ StarLine Maps: ${starlineResult.distance.toFixed(1)} км (приоритет!)`);
        return {
          distance: Math.round(starlineResult.distance),
          distanceSource: 'starline',
          confidence: starlineResult.confidence,
          reasoning: `Точное расстояние по автодорогам РФ (StarLine Maps)`
        };
      }
    } catch (error) {
      console.warn('⚠️ StarLine Maps недоступен, используем GLM:', error);
    }

    // Fallback на GLM (менее точно, но работает)
    try {
      const response = await this.client.chat.completions.create({
        model: this.defaultModel,
        messages: [
          {
            role: 'system',
            content: `Ты эксперт по географии России и автодорогам.
Определяй расстояние по федеральным трассам между городами РФ.

ВАЖНО: ОБЯЗАТЕЛЬНО отвечай ТОЛЬКО валидным JSON! Никакого дополнительного текста!

ТРЕБОВАНИЯ:
- Расстояние по автодороге (не по прямой!)
- Ответ ТОЛЬКО число в километрах
- Если города не существуют или не уверен → верни null

ПРИМЕРЫ:
- Москва → Санкт-Петербург: 703
- Екатеринбург → Москва: 1781
- Новосибирск → Владивосток: 3323
- Казань → Москва: 797
- Челябинск → Екатеринбург: 213

Допустимая погрешность: ±50 км (1-3%)

Отвечай JSON:
{
  "distance": число в км или null,
  "confidence": от 0 до 1,
  "reasoning": "объяснение"
}`
          },
          {
            role: 'user',
            content: `Определи расстояние по автодороге между городами:
Откуда: ${fromCity}
Куда: ${toCity}`
          }
        ],
        max_tokens: 300,
        temperature: 0.1
      });

      const content = response.choices[0]?.message?.content || '{}';

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);

        if (result.distance && result.distance > 0) {
          console.log(`✅ ${modelName}: расстояние рассчитано - ${result.distance} км`);
          return {
            distance: result.distance,
            distanceSource: 'ai',
            confidence: result.confidence || 0.8,
            reasoning: result.reasoning
          };
        }
      }

      // Если не удалось извлечь число
      console.warn(`⚠️ ${modelName}: не удалось рассчитать расстояние`);
      return {
        distance: 0,
        distanceSource: 'ai',
        confidence: 0,
        reasoning: 'Не удалось определить расстояние между городами'
      };
    } catch (error) {
      console.error(`❌ ${modelName}: ошибка расчета расстояния:`, error);
      return {
        distance: 0,
        distanceSource: 'ai',
        confidence: 0,
        reasoning: 'Ошибка при расчете расстояния'
      };
    }
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