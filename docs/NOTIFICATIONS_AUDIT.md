# 🔔 Аудит системы уведомлений ESG-Лайт

**Дата**: 2025-09-30
**Статус**: Частично реализовано (UI готов, backend требует доработки)

## 📊 Текущее состояние

### ✅ Что уже реализовано:

#### 1. **UI настроек уведомлений** (Settings.tsx)
- ✅ Вкладка "Уведомления" с полным интерфейсом
- ✅ **Способы доставки**:
  - Email уведомления (переключатель)
  - Push уведомления (переключатель)
- ✅ **Типы уведомлений**:
  - Готовность отчетов
  - Приближение дедлайнов (30, 7, 1 день)
  - Обработка документов
- ✅ Состояние хранится в React state (локально)

#### 2. **База данных** (Prisma schema)
- ✅ Модель `Notification` для хранения уведомлений:
  ```prisma
  model Notification {
    id        String   @id @default(cuid())
    userId    String
    type      String   // document_data_edited, document_correction_submitted, etc.
    title     String
    message   String
    metadata  Json?
    read      Boolean  @default(false)
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt
    user      User     @relation(fields: [userId], references: [id])
  }
  ```

#### 3. **Email инфраструктура**
- ✅ RuSender интеграция (`lib/rusender.ts`)
- ✅ Universal email service (`lib/email-universal.ts`)
- ✅ Magic Link через email (уже работает)
- ✅ Email шаблоны для ценовых уведомлений (`lib/email-service.ts`)
- ✅ Manager notification система (`lib/manager-notification.ts`)

#### 4. **Система ценовых уведомлений** (lib/pricing-notifications.ts)
- ✅ Уведомления о сезонных изменениях цен
- ✅ Email шаблоны (surge_start, surge_end, discount)
- ✅ Интеграция с RuSender

---

## ❌ Что отсутствует:

### 1. **NotificationPreferences модель** (Prisma)
❌ Отсутствует модель для хранения настроек уведомлений пользователя

**Требуется**:
```prisma
model NotificationPreferences {
  id               String   @id @default(cuid())
  userId           String   @unique

  // Каналы доставки
  emailEnabled     Boolean  @default(true)
  pushEnabled      Boolean  @default(false)

  // Типы уведомлений
  reportsEnabled   Boolean  @default(true)
  deadlinesEnabled Boolean  @default(true)
  documentsEnabled Boolean  @default(false)

  // Дополнительные настройки
  deadlineDays     Int[]    @default([30, 7, 1]) // За сколько дней уведомлять
  quietHoursStart  Int?     // Тихие часы (опционально)
  quietHoursEnd    Int?
  timezone         String   @default("Europe/Moscow")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("notification_preferences")
}
```

### 2. **API endpoints для настроек**
❌ `GET /api/settings/notifications` - получение настроек
❌ `PUT /api/settings/notifications` - обновление настроек

**Требуемая функциональность**:
- Получение текущих настроек из БД (или дефолтные)
- Сохранение изменений с валидацией
- Поддержка DEMO режима

### 3. **API endpoints для уведомлений**
❌ `GET /api/notifications` - список уведомлений пользователя
❌ `GET /api/notifications/unread-count` - количество непрочитанных
❌ `PATCH /api/notifications/[id]/read` - отметить прочитанным
❌ `PATCH /api/notifications/mark-all-read` - отметить все прочитанными
❌ `DELETE /api/notifications/[id]` - удалить уведомление

### 4. **Notification Service** (lib/notification-service.ts)
❌ Централизованный сервис для создания уведомлений

**Требуемая функциональность**:
```typescript
class NotificationService {
  // Создание уведомления
  async createNotification(params: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    metadata?: Record<string, any>;
  }): Promise<Notification>

  // Отправка через выбранные каналы
  async sendNotification(
    userId: string,
    notification: Notification
  ): Promise<void>

  // Проверка настроек пользователя
  async shouldSendNotification(
    userId: string,
    type: NotificationType,
    channel: 'email' | 'push'
  ): Promise<boolean>
}
```

### 5. **Интеграция с существующими API**
❌ Уведомления при готовности отчета (`/api/reports/[id]/submit`)
❌ Уведомления при обработке документов (`/api/documents/upload`, worker)
❌ Уведомления о приближающихся дедлайнах (cron job)
❌ Уведомления об ошибках обработки

### 6. **UI компонент списка уведомлений**
❌ Dropdown/Popover с уведомлениями в header
❌ Индикатор непрочитанных (badge с количеством)
❌ Страница со всеми уведомлениями (`/notifications`)

### 7. **Web Push Notifications**
❌ VAPID ключи и настройка Service Worker
❌ Запрос разрешения на уведомления
❌ Отправка push через Web Push API

---

## 🎯 План реализации (приоритеты)

### Фаза 1: Backend базовая функциональность (PAID режим)
1. ✅ Создать миграцию Prisma для `NotificationPreferences`
2. ✅ Реализовать `GET/PUT /api/settings/notifications`
3. ✅ Подключить Settings.tsx к реальному API
4. ✅ Создать `NotificationService` для создания уведомлений в БД
5. ✅ Реализовать `GET /api/notifications` с фильтрацией и пагинацией
6. ✅ Реализовать `PATCH /api/notifications/[id]/read` и bulk операции

### Фаза 2: Email интеграция
7. ✅ Создать email шаблоны для уведомлений:
   - Готовность отчета
   - Приближение дедлайна
   - Ошибка обработки документа
8. ✅ Интегрировать NotificationService с RuSender
9. ✅ Добавить проверку настроек перед отправкой

### Фаза 3: Интеграция в существующие API
10. ✅ Добавить уведомления в `/api/documents/upload` (успех/ошибка)
11. ✅ Добавить уведомления в OCR worker при завершении обработки
12. ✅ Добавить уведомления в `/api/reports/[id]/submit` при готовности отчета
13. ✅ Создать cron job для проверки приближающихся дедлайнов

### Фаза 4: UI компоненты
14. ✅ Создать `NotificationBell.tsx` в header с индикатором
15. ✅ Создать dropdown список последних уведомлений
16. ✅ Создать страницу `/notifications` со всеми уведомлениями
17. ✅ Добавить фильтры: прочитанные/непрочитанные, по типу

### Фаза 5: Web Push (опционально, после базовой реализации)
18. ⏳ Настроить VAPID ключи
19. ⏳ Реализовать Service Worker для push
20. ⏳ Добавить запрос разрешения на push в Settings
21. ⏳ Интегрировать отправку push в NotificationService

---

## 📝 Требования к реализации

### Демо vs PAID режим
- **DEMO режим**: Показывать 3-5 моковых уведомлений, настройки сохраняются только локально
- **PAID режим**: Реальные уведомления из БД, настройки сохраняются в БД, email отправляются через RuSender

### Типы уведомлений
```typescript
enum NotificationType {
  REPORT_READY = 'report_ready',
  REPORT_SUBMITTED = 'report_submitted',
  DEADLINE_30_DAYS = 'deadline_30_days',
  DEADLINE_7_DAYS = 'deadline_7_days',
  DEADLINE_1_DAY = 'deadline_1_day',
  DOCUMENT_PROCESSED = 'document_processed',
  DOCUMENT_ERROR = 'document_error',
  PRICING_SURGE_START = 'pricing_surge_start',
  PRICING_SURGE_END = 'pricing_surge_end',
  TRIAL_REQUEST_STATUS = 'trial_request_status',
}
```

### Email templates структура
- Заголовок с логотипом ESG-Лайт
- Иконка типа уведомления
- Заголовок и описание
- Кнопка действия (перейти к отчету/документу)
- Footer с ссылкой на настройки уведомлений

### Безопасность
- Rate limiting для API уведомлений
- Проверка прав доступа (пользователь может видеть только свои уведомления)
- Санитизация содержимого уведомлений
- Защита от XSS в metadata

---

## 🔧 Технические детали

### API Response formats

**GET /api/notifications**
```typescript
{
  notifications: Array<{
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    metadata?: Record<string, any>;
    read: boolean;
    createdAt: string;
  }>;
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
  };
  unreadCount: number;
}
```

**GET /api/settings/notifications**
```typescript
{
  emailEnabled: boolean;
  pushEnabled: boolean;
  reportsEnabled: boolean;
  deadlinesEnabled: boolean;
  documentsEnabled: boolean;
  deadlineDays: number[];
  quietHoursStart?: number;
  quietHoursEnd?: number;
  timezone: string;
}
```

### Индексы БД (для производительности)
```sql
CREATE INDEX idx_notifications_user_read ON notifications(userId, read);
CREATE INDEX idx_notifications_user_created ON notifications(userId, createdAt DESC);
CREATE INDEX idx_notifications_type ON notifications(type);
```

---

## 🚀 Готовность к внедрению

| Компонент | Статус | Оценка работ |
|-----------|--------|--------------|
| Prisma модель | ❌ | 15 мин |
| API настроек | ❌ | 1 час |
| API уведомлений | ❌ | 2 часа |
| NotificationService | ❌ | 2 часа |
| Email интеграция | ✅ (частично) | 1 час |
| Интеграция в существующие API | ❌ | 3 часа |
| UI компоненты | ❌ | 4 часа |
| Тестирование | ❌ | 2 часа |

**Общая оценка**: 15-16 часов работы для полной реализации системы уведомлений

---

## ✅ Checklist для завершения раздела 7

- [ ] Создать NotificationPreferences модель в Prisma
- [ ] Реализовать API GET/PUT /api/settings/notifications
- [ ] Подключить Settings.tsx к реальному API
- [ ] Создать NotificationService
- [ ] Реализовать API GET /api/notifications
- [ ] Реализовать API PATCH для отметки прочитанных
- [ ] Создать email шаблоны уведомлений
- [ ] Интегрировать уведомления в /api/documents/upload
- [ ] Интегрировать уведомления в OCR worker
- [ ] Интегрировать уведомления в /api/reports/[id]/submit
- [ ] Создать cron job для дедлайнов
- [ ] Создать NotificationBell компонент
- [ ] Создать dropdown список уведомлений
- [ ] Создать страницу /notifications
- [ ] Добавить моковые данные для DEMO режима
- [ ] Написать тесты для NotificationService
- [ ] Написать E2E тесты для UI уведомлений

---

**Вывод**: Система уведомлений имеет хороший фундамент (UI готов, email инфраструктура есть), но требует полной реализации backend части для работы в PAID режиме. Приоритет - Фазы 1-3 для базовой функциональности.