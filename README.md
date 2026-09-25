# КАМАЗ Дилер

React-интерфейс, Express API и MongoDB для заявок и новостей ПАО «КАМАЗ».

## Первый запуск

```powershell
npm install
Copy-Item .env.example .env
npm run build
npm start
```

Создайте кластер и пользователя MongoDB Atlas, скопируйте строку подключения в
`MONGODB_URI`, затем замените `ADMIN_TOKEN` и `IP_HASH_SALT` длинными случайными
строками. Файл `.env` не включается в сборку и Git.

После запуска сайт и API доступны на `http://localhost:3000`. Для разработки
запустите frontend и backend одной командой:

```powershell
npm run dev
```

Vite откроется на `http://localhost:5173` и перенаправит запросы `/api` на
Express-сервер. Отдельно процессы можно запускать командами `npm run dev:client`
и `npm run dev:server`.

## Где хранятся заявки

Заявки сохраняются в базе `kamaz`, коллекции `applications` в MongoDB. Имя базы
можно изменить переменной `MONGODB_DATABASE`. Посмотреть документы можно через
MongoDB Atlas Data Explorer или через защищённый API проекта.

Получить последние заявки можно защищённым запросом:

```powershell
$headers = @{ Authorization = "Bearer значение-ADMIN_TOKEN" }
Invoke-RestMethod http://localhost:3000/api/applications -Headers $headers
```

Изменить статус заявки:

```powershell
$headers = @{ Authorization = "Bearer значение-ADMIN_TOKEN" }
$body = @{ status = "processing" } | ConvertTo-Json
Invoke-RestMethod http://localhost:3000/api/applications/ID -Method Patch -Headers $headers -ContentType "application/json" -Body $body
```

Допустимые статусы: `new`, `processing`, `completed`, `rejected`.

## Новости КАМАЗ

Express загружает официальный RSS `http://www.kamaz.ru/press/releases/rss/` при
запуске и затем обновляет его каждые 30 минут. Записи сохраняются без дублей в
базе `kamaz`, коллекции `news`, а React получает их через `GET /api/news`.

Адрес ленты и период обновления можно изменить в `.env`:

```dotenv
KAMAZ_RSS_URL=http://www.kamaz.ru/press/releases/rss/
RSS_REFRESH_MINUTES=30
```

Если источник временно недоступен, сайт продолжит показывать последние новости,
которые уже сохранены в MongoDB.
