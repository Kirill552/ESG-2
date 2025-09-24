# ESG-2 Backend - Скопированная логика

## 📦 Структура backend модуля

```
ESG-2/backend/
├── lib/                          # Основная бизнес-логика
│   ├── parsers/                  # Структурные парсеры документов
│   │   ├── base-parser.ts        # Базовые типы и утилиты
│   │   ├── csv-parser.ts         # CSV парсер
│   │   ├── excel-parser.ts       # Excel (.xls/.xlsx) парсер
│   │   ├── html-parser.ts        # HTML парсер
│   │   ├── json-parser.ts        # JSON парсер
│   │   ├── office-parser.ts      # Office документы
│   │   ├── pdf-parser.ts         # PDF парсер
│   │   ├── rtf-parser.ts         # RTF парсер
│   │   ├── txt-parser.ts         # Текстовые файлы
│   │   └── index.ts              # Экспорты парсеров
│   │
│   ├── multi-level-ocr-service.ts        # 🔥 Главный OCR оркестратор
│   ├── yandex-vision-service.ts          # Yandex Vision API
│   ├── yandex-iam-token-manager.ts       # IAM токены для Yandex
│   ├── ocr.ts                           # Tesseract OCR fallback
│   ├── s3.ts                            # Yandex Object Storage
│   │
│   ├── foundation-models-client.ts       # Cloud.ru Foundation Models
│   ├── enhanced-extraction-service.ts    # Извлечение ESG данных
│   ├── intelligent-file-processor.ts     # Умная обработка файлов
│   ├── simplified-ocr-service.ts         # Упрощенный OCR
│   ├── contextual-analysis-service.ts    # Контекстный анализ
│   │
│   ├── format-detector.ts               # Детектор форматов файлов
│   ├── synonym-dictionary.ts            # Словарь синонимов для ЭСГ
│   ├── russian-document-patterns.ts     # Паттерны российских документов
│   ├── supported-file-types.ts          # Поддерживаемые форматы
│   ├── text-utils.ts                    # Утилиты для работы с текстом
│   │
│   ├── logger.ts                        # Система логирования
│   ├── structured-logger.ts             # Структурированные логи
│   └── utils.ts                         # Общие утилиты
```

## 🔄 Архитектура OCR системы

### Многоуровневая обработка
1. **Yandex Vision API** (основной) — высокое качество для сканов
2. **Tesseract OCR** (fallback) — локальная обработка
3. **Foundation Models** (постобработка) — интеллектуальная доработка

### Структурные парсеры
- **CSV/Excel**: Извлечение табличных данных об энергопотреблении
- **PDF**: Обработка счетов и справок
- **Office**: Word/PowerPoint документы
- **HTML/JSON**: Веб-данные и API ответы

## 🧠 Foundation Models Integration

### Поддерживаемые модели (Cloud.ru):
- **GigaChat 2-Max** — для сложных текстов
- **Llama-3.3-70B** — универсальная модель 
- **GLM-4.5** — китайская альтернатива
- **GPT-OSS-120B** — open source модель

### Функции ИИ:
- Извлечение численных данных из сканов
- Нормализация единиц измерения  
- Классификация типов документов
- Исправление ошибок OCR

## 📋 Основные сервисы

### EnhancedExtractionService
```typescript
// Извлечение ESG данных из документов
const extractor = new EnhancedExtractionService();
const result = await extractor.extractFromDocument(buffer, filename);
```

### MultiLevelOcrService  
```typescript
// Многоуровневая OCR обработка
const ocr = new MultiLevelOcrService();
const text = await ocr.processFile(buffer, filename);
```

### IntelligentFileProcessor
```typescript
// Умная обработка файлов с определением типа
const processor = new IntelligentFileProcessor();
const data = await processor.processFile(fileBuffer, mimeType);
```

## 🔧 Зависимости

### Основные библиотеки:
```json
{
  "tesseract.js": "^6.0.1",
  "exceljs": "^4.4.0", 
  "@aws-sdk/client-s3": "^3.540.0",
  "pdf-parse": "^1.1.1",
  "sharp": "^0.33.0",
  "node-jose": "^2.2.0"
}
```

### Системные требования:
- **Node.js 18+**
- **Yandex Cloud** аккаунт (Vision API + Object Storage)
- **Cloud.ru** аккаунт (Foundation Models API)

## 🌍 Российская специфика

### Поддержка кириллицы:
- Кодировки: UTF-8, CP1251, CP866
- Российские единицы измерения (кВт·ч, Гкал, м³)
- Паттерны российских документов

### Соответствие стандартам:
- **296-ФЗ** — российские требования к углеродной отчетности
- **CBAM** — европейские стандарты трансграничного углеродного регулирования

## 🚀 Упрощения в ESG-2

В отличие от основного проекта, ESG-2 содержит:
- ✅ Полную OCR логику без изменений
- ✅ Все структурные парсеры
- ✅ Foundation Models интеграцию
- ✅ Российские паттерны документов
- ❌ Сложная система тарификации убрана
- ❌ Авторизация упрощена
- ❌ Платежные интеграции исключены

## 📝 Следующие шаги

1. **Настройка зависимостей** — создать package.json
2. **Конфигурация ENV** — настроить переменные окружения
3. **Тестирование** — проверить работу OCR системы
4. **Интеграция** — подключить к фронтенду
5. **Деплой** — развернуть как отдельный сервис

---

*Скопировано из ESG-Lite MVP 22 сентября 2025*