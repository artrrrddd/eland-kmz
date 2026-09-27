# КАМАЗ Дилер

React, Express API и PostgreSQL для заявок и RSS-новостей КАМАЗ. Требуется Node.js 22.5+.

## Настройка Рег.облака

Если `.env` отсутствует, скопируйте `.env.example`. Уже заполненный `.env` не перезаписывайте.

- `DATABASE_URL` — строка PostgreSQL из панели Рег.облака, без команды `psql`. Для проекта используется база `db1`. Спецсимволы в пароле нужно URL-кодировать.
- `PGSSLROOTCERT` — путь к корневому сертификату из вкладки «Подключение». В Windows используйте прямые слэши: `certs/reg-cloud-ca.crt`.
- `PGSSLMODE=verify-full` — TLS с проверкой CA и имени/IP сервера, по умолчанию. Если сертификат не содержит публичный IP, используйте доступное имя хоста из панели, соответствующее сертификату. Также поддерживается `verify-ca`: проверяет CA, но не имя сервера. `disable` предназначен для локальной БД без TLS.
- `ADMIN_TOKEN` и `IP_HASH_SALT` — длинные случайные значения.

Параметры TLS задавайте этими переменными, а не параметрами `sslmode`/`sslrootcert` в URL.
MongoDB больше не используется; `MONGODB_URI` и `MONGODB_DATABASE` можно удалить из `.env`.
Секреты не включаются в frontend-сборку и Git.

Документация: [Рег.облако](https://help.reg.ru/support/servery-vps/oblachnyye-bazy-dannykh/postgresql/), [TLS node-postgres](https://node-postgres.com/features/ssl).

Кластер: `79.174.89.250:15529`, база `db1`, пользователь `user1`. Корневой сертификат сохранён в `certs/reg-cloud-ca.crt`. `.env` и относительный путь сертификата загружаются от корня проекта независимо от папки запуска.

`npm run db:check` проверяет авторизацию, TLS и наличие таблиц без изменения данных. Ошибка `28P01` означает неверный пароль: сохраните новый пароль пользователя в панели и обновите `DATABASE_URL` (например, `@` кодируется как `%40`).

## Запуск

После проверки параметров подключения:

```powershell
npm install
npm run db:check
npm run db:migrate
npm run dev
```

`db:migrate` создаёт таблицы и индексы в транзакции, допускает повторный запуск и не удаляет данные. Несовместимая старая схема автоматически не преобразуется.
Backend сам не создаёт таблицы. Предполагается пустая PostgreSQL, перенос MongoDB не выполняется.

Frontend: `http://localhost:5173`, backend: `http://localhost:3000`.
Vite перенаправляет `/api` на backend. Проверка БД: `GET /api/health`.

Для собранного сайта:

```powershell
npm run build
npm start
```

Node.js раздаёт сайт и API на одном порту. Для размещения нужен постоянный Node.js-процесс, например VPS или App Platform; статического хостинга недостаточно. На сервере задайте переменные окружения и путь к загруженному сертификату. Если настроены ограничения сети Рег.облака, разрешите IP backend.

## Заявки

Таблица `applications`, новые идентификаторы UUID. Формат API сохранён, включая `applicationId`, `branchId`, `createdAt`.

```powershell
$headers = @{ Authorization = "Bearer значение-ADMIN_TOKEN" }
Invoke-RestMethod http://localhost:3000/api/applications -Headers $headers
$body = @{ status = "processing" } | ConvertTo-Json
Invoke-RestMethod http://localhost:3000/api/applications/ID -Method Patch -Headers $headers -ContentType "application/json" -Body $body
```

Допустимые статусы: `new`, `processing`, `completed`, `rejected`. Чтение заявок и изменение статуса требуют `ADMIN_TOKEN`.

## Новости

При запуске и каждые 30 минут backend загружает RSS КАМАЗ в таблицу `news`. Повторные загрузки обновляют записи по уникальному `rssKey` без дублей. Интерфейс получает новости через `GET /api/news`.
Если RSS недоступен, остаются ранее сохранённые новости. Адрес и период задаются в `KAMAZ_RSS_URL` и `RSS_REFRESH_MINUTES`.
