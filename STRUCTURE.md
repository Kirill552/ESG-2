# 📦 Структура ESG-Лайт (Backend + Vite SPA)

Документ описывает, какие модули уже перенесены в репозиторий и как ориентироваться в текущей структуре. Backend сохранён полностью, поверх него появился независимый фронтенд на Vite (`web/`).

## ✅ Backend (папка `backend/`)

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

### ✅ Полная backend функциональность
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

## ✅ Frontend (папка `web/`)

### Основные каталоги
```
web/src/
├── App.tsx                      # Точка входа
├── components/
│   ├── Dashboard.tsx            # Главная панель
│   ├── Documents.tsx            # Список документов
│   ├── FileUpload.tsx           # Модальное окно загрузки
│   ├── Reports.tsx              # Управление отчетами
│   ├── Settings.tsx             # Настройки организации
│   ├── ui/                      # shadcn/ui компоненты-обёртки
│   └── figma/                   # Подгрузка ассетов из дизайна
├── components/Analytics.tsx     # Визуализация данных
├── components/AuthForm.tsx      # Экран авторизации
└── styles/globals.css           # Tailwind стили
```

### Что уже сделано во `web/`
- Vite 5 конфигурация (`vite.config.ts`, `tsconfig.app.json`).
- Подключены shadcn/ui, lucide-react, motion, sonner.
- Макеты ключевых пользовательских потоков со стейтом-плейсхолдером.
- Tailwind CSS 4 + @tailwindcss/vite (новая конфигурация 2025).

### Что осталось связать с backend
- Реальные запросы к `/api/auth/*` (NextAuth) и хранение сессии.
- Интеграция загрузки документов (`/api/documents`) и очередей.
- Получение данных для дашборда, отчетов и аналитики.
- Настройки компаний и ролей через существующие API.
(Подробнее — в файле `связка.md`.)

## 🗂️ Корень репозитория

```
ESG-Лайт/
├── package.json                 # Скрипты для backend (npm run backend:*)
├── web/package.json             # Скрипты фронтенда (npm run dev/build)
├── .github/instructions/        # Регламент разработки
├── docs/                        # Дизайн-система, нормативные документы
├── design.md, задачи.md         # Планирование
└── README.md, STRUCTURE.md      # Текущая документация
```

Ключевые конфигурации уже присутствуют:
- `backend/next.config.js`, `backend/tsconfig.json`, `backend/tailwind.config.ts` — для сервера.
- `web/vite.config.ts`, `web/tsconfig.app.json`, `web/tailwind.config.ts` — для SPA.
- `.env.example` расположен в `backend/` (см. README backend для списка переменных).

## 📋 Архитектурные решения и упрощения

### ✅ Упрощения в ESG-Лайт:
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

**Итог:** Репозиторий содержит production-ready backend и готовый Vite SPA. Осталось связать фронтенд с API и довести интеграцию до рабочего состояния MVP.