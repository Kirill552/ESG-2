# 🚀 Инструкция по локальной разработке с VK ID

## Проблема
VK ID не разрешает использовать `localhost:3000` для callback URLs. Необходимо использовать внешний домен с HTTPS.

## Решение: туннель через ngrok

### 1. Установка ngrok
```bash
# Windows (через Chocolatey)
choco install ngrok

# Или скачайте с https://ngrok.com/download
```

### 2. Создание туннеля
```bash
# Запустите в отдельном терминале
ngrok http 3000
```

Получите URL вида: `https://abc123.ngrok.io`

### 3. Настройка VK ID приложения
1. Откройте [VK ID Business](https://id.vk.ru/business/go)
2. Перейдите в ваше приложение (ID: 54017823)
3. В разделе "Подключение авторизации" → "Доверенный Redirect URL":
   - Добавьте: `https://abc123.ngrok.io/api/auth/vk/callback`
4. В "Базовый домен":
   - Добавьте: `abc123.ngrok.io`

### 4. Обновление конфигурации
В файле `backend/.env`:
```env
# Замените на ваш ngrok URL
NEXTAUTH_URL=https://abc123.ngrok.io
NEXT_PUBLIC_APP_URL=https://abc123.ngrok.io
VKID_REDIRECT_URL=https://abc123.ngrok.io/api/auth/vk/callback
```

### 5. Получение CLIENT_SECRET
1. В настройках VK ID приложения найдите "Сервисный ключ доступа"
2. Скопируйте и вставьте в `.env`:
```env
VKID_CLIENT_SECRET=ваш_реальный_секрет
```

### 6. Запуск разработки
```bash
# Терминал 1: ngrok туннель
ngrok http 3000

# Терминал 2: Next.js приложение (backend + frontend)
cd backend
npm run dev
```

### 7. Тестирование
1. Откройте `https://abc123.ngrok.io` (ваш ngrok URL)
2. Перейдите на страницу авторизации
3. Нажмите на VK ID виджет
4. Проверьте, что авторизация проходит успешно

## Альтернатива: cloudflared

```bash
# Установка
npm install -g cloudflared

# Создание туннеля
cloudflared tunnel --url http://localhost:3000
```

## Отладка

### Проверка logs
```bash
# Backend logs
tail -f backend/logs/app.log

# Или в коде:
console.log('VK ID callback received:', { code, state, signature });
```

### Типичные ошибки
- **Invalid redirect_uri**: Проверьте, что URL в VK ID точно совпадает с `VKID_REDIRECT_URL`
- **Invalid signature**: Убедитесь, что `VKID_CLIENT_SECRET` правильный
- **State mismatch**: Проверьте генерацию и валидацию state параметра

### Проверка запросов
1. Откройте DevTools → Network
2. Посмотрите запрос к `/api/auth/vk/callback`
3. Проверьте параметры: `code`, `state`, `signature`, `device_id`

## Продакшн

Для продакшена настройте:
1. Реальный домен в VK ID приложении
2. SSL сертификат
3. Правильные переменные окружения без ngrok URL