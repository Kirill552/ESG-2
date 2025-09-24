# 📦 Финальная структура ESG-2 Backend

## ✅ Полностью перенесено

### 🔐 Авторизация и безопасность
```
backend/lib/
├── auth-options.ts           # NextAuth конфигурация
├── webauthn.ts              # Passkeys/Face ID поддержка  
├── rate-limiter.ts          # Rate limiting + защита от ботов
├── email-service.ts         # Универсальная отправка email
└── rusender.ts              # RUSENDER интеграция
```

### 🤖 OCR и обработка документов
```
backend/lib/
├── multi-level-ocr-service.ts       # 🔥 Главный OCR оркестратор
├── yandex-vision-service.ts         # Yandex Vision API
├── yandex-iam-token-manager.ts      # IAM токены
├── ocr.ts                          # Tesseract fallback
├── foundation-models-client.ts      # Cloud.ru Foundation Models
├── enhanced-extraction-service.ts   # Извлечение ESG данных
├── intelligent-file-processor.ts    # Умная обработка файлов
├── simplified-ocr-service.ts        # Упрощенный OCR
├── contextual-analysis-service.ts   # Контекстный анализ
└── parsers/                        # 10 структурных парсеров
    ├── base-parser.ts
    ├── csv-parser.ts
    ├── excel-parser.ts
    ├── pdf-parser.ts
    └── ... остальные
```

### 📊 Отчеты и генерация
```
backend/lib/
├── enhanced-report-generator.ts     # Генерация отчетов 296-ФЗ
├── format-detector.ts              # Детектор форматов
├── synonym-dictionary.ts           # ЭСГ словарь
├── russian-document-patterns.ts    # Российские паттерны
└── supported-file-types.ts         # Поддерживаемые форматы
```

### ⚙️ Очереди и система
```
backend/lib/
├── queue.ts                        # PostgreSQL очереди (pg-boss)
├── logger.ts                       # Базовое логирование
├── structured-logger.ts            # Структурированные логи
├── prisma.ts                       # База данных клиент
├── s3.ts                          # Yandex Object Storage
├── text-utils.ts                  # Утилиты для текста
└── utils.ts                       # Общие утилиты

backend/workers/
└── ocr-worker.ts                   # OCR background worker
```

### 🏗️ API маршруты (полный набор)
```
backend/app/api/
├── auth/                           # Авторизация
│   ├── [...nextauth]/             # NextAuth provider
│   ├── check-user/                # Проверка пользователей
│   ├── clear-session/             # Очистка сессий
│   ├── magic-link/                # Magic links
│   └── webauthn/                  # Passkeys API
├── ocr/                           # OCR обработка
│   ├── route.ts                   # Основной OCR API
│   └── ...                       # Дополнительные эндпоинты
├── reports/                       # Отчеты
│   ├── [id]/view/                 # Просмотр отчетов
│   ├── [id]/download/             # Скачивание PDF
│   └── ...                       # Управление отчетами
├── documents/                     # Документы
│   ├── [documentId]/data/         # OCR результаты
│   └── ...                       # Управление документами
└── queue/                         # Мониторинг очередей
    ├── health/                    # Health checks
    └── ...                       # Статистика очередей
```

### 🗄️ База данных и типы
```
backend/prisma/
├── schema.prisma                   # Полная Prisma схема
└── migrations/                     # Все миграции

backend/types/
├── auth.ts                        # Типы авторизации
├── ocr.ts                         # OCR типы
├── reports.ts                     # Типы отчетов
└── ...                           # Остальные типы
```

## 🚀 Что готово для создания нового проекта

### ✅ Полная backend функциональность:
- **Многоуровневая OCR система** (Yandex + Tesseract + Foundation Models)
- **Российская авторизация** (VK ID + Magic Links + Passkeys)
- **Генерация отчетов** (296-ФЗ + CBAM)
- **PostgreSQL очереди** с мониторингом
- **152-ФЗ compliance** (шифрование + rate limiting)
- **Структурированное логирование**
- **Полный API** для фронтенда

### ✅ Готово к запуску:
- **Prisma схема БД** с миграциями
- **TypeScript типы** для всех компонентов  
- **10+ парсеров документов** (CSV, Excel, PDF, Office, etc.)
- **Workers система** для background обработки
- **Health checks** и мониторинг

## 🔧 Следующие шаги для нового проекта

### 1. Создать корневые файлы:
```bash
# В корне ESG-2/
package.json           # Зависимости проекта
next.config.js         # Next.js конфигурация
tailwind.config.js     # Стилизация
tsconfig.json          # TypeScript конфигурация
.env.example           # Переменные окружения
.gitignore             # Git исключения
```

### 2. Настроить зависимости:
```json
{
  "dependencies": {
    "next": "15.0.0",
    "react": "^18.0.0",
    "next-auth": "^4.24.0",
    "prisma": "^5.0.0",
    "@prisma/client": "^5.0.0",
    "pg-boss": "^10.0.0",
    "tesseract.js": "^6.0.1",
    "@aws-sdk/client-s3": "^3.540.0",
    "exceljs": "^4.4.0",
    "pdf-parse": "^1.1.1",
    "sharp": "^0.33.0"
  }
}
```

### 3. Конфигурация ENV:
```bash
# Database
DATABASE_URL=postgresql://user:pass@176.108.253.195:5432/db

# NextAuth  
AUTH_SECRET=your_secret
NEXT_PUBLIC_VKID_APP_ID=54017823

# OCR
YANDEX_FOLDER_ID=your_folder_id
ENABLE_YANDEX_VISION=true

# Email
RUSENDER_API_KEY=your_key

# Queue
QUEUE_STORAGE_TYPE=postgres

# 152-ФЗ
FERNET_SECRET=your_fernet_key
```

### 4. Запуск:
```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev
```

## 📋 Архитектурные решения

### ✅ Упрощения в ESG-2:
- ❌ **Убрана сложная тарифная система** — заменена на ручное управление доступами
- ❌ **Убраны автоплатежи** — упрощенная админка
- ❌ **Убрана сложная аналитика** — фокус на базовые отчеты
- ✅ **Сохранена вся OCR логика** — без изменений
- ✅ **Сохранена безопасность** — 152-ФЗ compliance
- ✅ **Сохранены российские интеграции** — VK ID, RUSENDER, Yandex

### 🎯 Основные преимущества:
1. **Полная автономность** — можно развернуть отдельно
2. **Все ключевые функции** — OCR, отчеты, авторизация
3. **Российские стандарты** — 296-ФЗ, 152-ФЗ
4. **Production ready** — очереди, логирование, мониторинг
5. **Легкая настройка** — упрощенная админка вместо тарифов

---

**Итог:** ESG-2/backend содержит **100% необходимого кода** для создания полноценного MVP системы ESG отчетности. Остается только добавить фронтенд и конфигурационные файлы.