# 🌿 ESG-Лайт: Платформа углеродной отчетности

## 📋 Описание проекта
**ESG-Лайт** — российская B2B SaaS-платформа, которая автоматизирует подготовку углеродной отчетности. Репозиторий объединяет два независимых приложения:
- **Backend** на Next.js 15+ (папка `backend/`) с REST API, обработкой документов и генерацией отчетов.
- **Frontend** на Vite + React 18 + TypeScript (папка `web/`) с современным интерфейсом, построенным на shadcn/ui и Tailwind CSS.

> Главный пользовательский сценарий: **Загрузил документ → получил готовый отчет**.

## 🏛️ Архитектура
- PostgreSQL + Prisma ORM для хранения данных и очередей.
- Next.js API routes для бизнес-логики, авторизации (NextAuth) и OCR pipeline.
- Витебраузерный SPA на Vite, который обращается к backend через REST API и обеспечивает UX в российской локализации.
- pg-boss и воркеры для фоновой обработки документов.

## 🛠️ Технологический стек

### Backend (`/backend`)
- **Next.js 15+** с TypeScript
- **NextAuth.js**: VK ID, Magic Links, Passkeys
- **PostgreSQL + Prisma ORM**
- **Очереди**: pg-boss
- **OCR**: Yandex Vision, GigaChat, Tesseract
- **Шифрование**: Fernet (соответствие 152-ФЗ)
- **Логирование**: структурированное (Winston)

### Frontend (`/web`)
- **Vite 5** (ESM dev server + Rollup build)
- **React 18 + TypeScript**
- **UI**: shadcn/ui, lucide-react, motion/framer-motion
- **Стили**: Tailwind CSS 4, tailwind-merge
- **Уведомления и состояния**: sonner, zustand
- **E2E**: Playwright (планируется)

### Инфраструктура
- **Хранилище**: S3-совместимое
- **Почта**: RuSender
- **Мониторинг**: кастомные health-checks + metrics exporter
- **Развертывание**: контейнеры (web API, OCR worker, nginx proxy)

## 📁 Структура репозитория

```
ESG-Лайт/
├── README.md                    # Общий обзор проекта
├── STRUCTURE.md                 # Детализация каталогов
├── задачи.md                    # Бэклог задач
├── backend/                     # Next.js API, воркеры и prisma
│   ├── app/api/                 # REST endpoints
│   ├── lib/                     # Сервисы и интеграции
│   ├── workers/                 # OCR и фоновые процессы
│   └── prisma/                  # Схемы и миграции
├── web/                         # Vite + React SPA
│   ├── src/App.tsx              # Точка входа UI
│   ├── src/components/          # Интерфейсные компоненты shadcn/ui
│   ├── src/styles/              # Tailwind globals
│   └── package.json             # Скрипты фронтенда
└── docs/                        # Дополнительные материалы и дизайны
```

## � Локальная разработка

### Предварительная установка
- Node.js 18+
- PostgreSQL (локально или в Docker)
- Настроенные переменные окружения (см. `backend/README.md`)

### Запуск backend
```bash
npm run install:backend        # установить зависимости (однократно)
npm run backend:dev            # Next.js API dev server на http://localhost:3000
npm run worker:dev             # OCR worker
npm run db:studio              # Prisma Studio при необходимости
```

### Запуск frontend
```bash
cd web
npm install                    # зависимости фронтенда (однократно)
npm run dev                    # Vite dev server на http://127.0.0.1:5173
```

> Для проксирования API из SPA настройте `.env.local` (см. `web/README.md`) или используйте reverse proxy (например, nginx).

## 📦 Сборка и продакшн

```bash
# Backend
npm run backend:build
npm run backend:start
npm run worker:start

# Frontend
cd web
npm run build                  # сборка статики в web/dist
npm run preview                # проверка собранного SPA (опционально)
```

Фронтенд статика может размещаться за CDN или nginx, backend — отдельный сервис или контейнер. Между ними рекомендуется HTTPS + авторизация по cookie/headers.

## 🔑 Ключевые возможности
- Авторизация через VK ID, magic link и passkeys.
- Загрузка документов (PDF, DOCX, Excel, CSV, изображения) и очередь OCR.
- Генерация отчетов: 296-ФЗ, EU CBAM, углеродный след.
- Ручное управление доступами (вместо тарифов) через админский интерфейс.
- Полная русская локализация интерфейса и документации.

## � Документация и планы
- `.github/instructions/интсрукции.instructions.md` — общие правила разработки.
- `STRUCTURE.md` — подробности по каталогам и данным.
- `backend/README.md` — детали API и окружения.
- `docs/` — дизайн, нормативные документы и гайдлайны UI.
- `связка.md` (будет добавлен) — чеклисты интеграции фронтенда и backend API.

## 🗺️ Roadmap (обновляется)

### 1. Текущий релиз
- ✅ Backend MVP (авторизация, OCR pipeline, генерация отчетов)
- ✅ Vite SPA с макетами ключевых экранов
- 🔄 Интеграция UI с реальными API (в процессе)

### 2. Ближайшие задачи
- Подключить реальную авторизацию через NextAuth на фронтенде.
- Связать загрузку документов с API `/api/documents` и очередями.
- Подключить dashboards к отчетам и аналитике.
- Подготовить E2E-сценарии Playwright.

### 3. Расширение
- Поддержка дополнительных форматов отчетов и коэффициентов.
- Внешние интеграции (API клиентов, 1С, ERP).
- Расширенный мониторинг и алертинг.

---

**🎯 Цель:** обеспечить устойчивую, соответствующую российским нормам платформу, которая позволяет компаниям быстро формировать углеродную отчетность и масштабировать процессы без лишней сложности.