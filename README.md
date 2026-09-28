# КАМАЗ Дилер

React + PHP API + PostgreSQL. Node.js нужен только на компьютере разработчика для Vite и сборки React. На хостинге постоянный Node.js-процесс не нужен.

## Требования

- PHP 8.2+ с расширениями PDO/pdo_pgsql, mbstring, curl, SimpleXML.
- PostgreSQL (локальный либо внешний, например Рег.облако).
- Apache 2.4 с mod_rewrite и разрешёнными .htaccess, либо совместимый LiteSpeed.
- Cron для обновления новостей. Хостинг должен разрешать исходящие подключения к вашей PostgreSQL и RSS.

## Конфигурация

Скопируйте `.env.example` в `.env`, если файла ещё нет. Существующий `.env` сохранён.

- `DATABASE_URL`: `postgresql://USER:PASSWORD@HOST:PORT/DATABASE`. Спецсимволы логина и пароля URL-кодируйте. Параметры TLS в URL не добавляйте.
- `PGSSLMODE`: `verify-full` (по умолчанию), `verify-ca` или `disable` для локальной БД без TLS.
- `PGSSLROOTCERT`: путь к CA-сертификату относительно корня проекта либо абсолютный путь. Для TLS обязателен. В Windows используйте прямые слэши.
- `ADMIN_TOKEN`, `IP_HASH_SALT`: длинные случайные секреты. Не используйте префикс `VITE_` для секретов.
- `KAMAZ_RSS_URL`: источник RSS. Интервал обновления теперь задаётся расписанием cron, а не `RSS_REFRESH_MINUTES`.

Переменные окружения имеют приоритет над `.env`. Поддерживаются простые строки KEY=value, значения в одинарных/двойных кавычках; подстановка переменных не выполняется.

TLS сохраняет прежнюю проверку сертификата. Для `verify-full` имя/IP сервера должно соответствовать сертификату. Подробнее: [PDO PostgreSQL](https://www.php.net/manual/en/ref.pdo-pgsql.connection.php).

## Локальная разработка

Npm-команды автоматически используют переносимый PHP из `tmp/php-runtime/php.exe` в Windows, если он доступен. Иначе используется `php` из PATH. Можно явно выбрать исполняемый файл через переменную `PHP_BINARY`. Переносимый PHP не хранится в Git; на новом компьютере установите PHP и включите перечисленные расширения в php.ini.

В Windows библиотека PostgreSQL может не открыть CA по пути с кириллицей. В таком случае разместите сертификат, например, в `C:/certs/reg-cloud-ca.crt` и укажите этот абсолютный путь в `PGSSLROOTCERT`.

```sh
npm install
npm run db:check
npm run db:migrate
npm run news:refresh
npm run dev
```

React: http://localhost:5173, PHP API: http://localhost:3000. Vite проксирует `/api` без изменения frontend.

```sh
npm run test:backend
npm run build
npm start
```

`npm start` предназначен только для локальной проверки собранного сайта. Встроенный [PHP-сервер](https://www.php.net/manual/en/features.commandline.webserver.php) не используется для публичного хостинга. `npm run preview` показывает только frontend без PHP API.

## Размещение на shared-хостинге

Соберите frontend локально: `npm run build`. Пример структуры на сервере:

```text
/home/account/kamaz/
  .env
  backend/
    bootstrap.php
    applications.php
    api.php
    news.php
    console.php
    schema.sql
  certs/
    reg-cloud-ca.crt
  public_html/            <- корень сайта в панели хостинга
    .htaccess
    index.html
    assets/
    api/
      index.php
```

1. Загрузите содержимое `dist/` (включая скрытый `.htaccess`) в `public_html/`.
2. Папки `backend/`, `certs/` и `.env` разместите на уровень выше `public_html/`. Входной `api/index.php` ожидает именно эту структуру. Не загружайте весь репозиторий в публичный корень.
3. Заполните `.env`, включите PHP-расширения в панели. Разрешите IP хостинга в настройках внешней PostgreSQL, если там используется список разрешённых адресов.
4. Из приватного корня проекта выполните `php backend/console.php db:check` и `php backend/console.php db:migrate`. Если SSH отсутствует, импортируйте `backend/schema.sql` через панель управления PostgreSQL. Скрипты миграции не публикуются как HTTP endpoints.
5. Выполните `php backend/console.php news:refresh` и добавьте cron каждые 30 минут:

```cron
*/30 * * * * /usr/bin/php /home/account/kamaz/backend/console.php news:refresh >> /home/account/kamaz/news-cron.log 2>&1
```

Уточните путь к PHP у хостинга. Для первого импорта без SSH можно временно запустить ту же команду через планировщик панели.

6. Проверьте `/api/health`, `/api/news` и отправку формы. `/api/health` проверяет соединение; наличие таблиц проверяет `db:check`.

Для хостинга с фиксированным `public_html` приватные файлы размещаются в его родительском каталоге. Если это запрещено, потребуется адаптация пути в `api/index.php` к доступной приватной папке. Сайт рассчитан на корень домена, не подпапку.

## API и данные

Существующие таблицы и данные `applications` и `news` сохранены. Миграция повторяемая, выполняется в транзакции и добавляет таблицу `api_rate_limits`; выполните её и для существующей БД. Старую несовместимую схему скрипт автоматически не преобразует.

| Метод | URL | Назначение |
| --- | --- | --- |
| GET | `/api/health` | Проверка подключения |
| GET | `/api/news?limit=6` | Новости, максимум 20 |
| POST | `/api/applications` | Создание заявки |
| GET | `/api/applications?limit=50&offset=0` | Список заявок, Bearer ADMIN_TOKEN |
| PATCH | `/api/applications/UUID` | Изменение статуса, Bearer ADMIN_TOKEN |

POST/PATCH принимают JSON до 32 КБ. Заявка возвращает `{ "ok": true, "applicationId": "UUID" }` с HTTP 201. Ошибки формы — HTTP 400, `message` и `fields`. Сохранены типы заявок, согласие, honeypot, проверка телефона, обязательные модель/VIN в соответствующих формах. Статусы: `new`, `processing`, `completed`, `rejected`.

Лимит — 5 попыток отправки формы за 15 минут с одного IP; HTTP 429 содержит Retry-After. Счётчики общие для PHP workers и хранятся в PostgreSQL, просроченные удаляются при запросах. IP хранится только в виде хеша с солью. Используется REMOTE_ADDR; если перед хостингом стоит CDN/proxy, настройте восстановление реального IP доверенным модулем веб-сервера. Произвольный X-Forwarded-For не принимается.

RSS/Atom обновляется через cron с upsert по rssKey. При ошибке загрузки сохраняются старые новости. Публичный API читает только базу, не запускает импорт при запросе посетителя.
