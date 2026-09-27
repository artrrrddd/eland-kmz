import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { XMLParser } from 'fast-xml-parser';
import { z } from 'zod';
import {
  pool,
  getSafeDatabaseInfo,
} from './database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const port = Number(process.env.PORT || 3000);

const rssUrl =
  process.env.KAMAZ_RSS_URL ||
  'http://www.kamaz.ru/press/releases/rss/';

const rssRefreshMinutes = Number(
  process.env.RSS_REFRESH_MINUTES || 30,
);

const rssRefreshMs =
  Math.max(
    Number.isFinite(rssRefreshMinutes)
      ? rssRefreshMinutes
      : 30,
    5,
  ) * 60_000;

function formatDatabaseError(error) {
  return {
    name: error.name,
    code: error.code,
    message: error.message,
    detail: error.detail,
    hint: error.hint,
    errors: error.errors?.map((item) => ({
      name: item.name,
      code: item.code,
      message: item.message,
      address: item.address,
      port: item.port,
      syscall: item.syscall,
    })),
  };
}

async function checkDatabase() {
  console.log('[PostgreSQL] Настройки:', getSafeDatabaseInfo());

  try {
    await pool.query('SELECT 1');
    await pool.query('SELECT id FROM applications LIMIT 0');
    await pool.query('SELECT id FROM news LIMIT 0');

    console.log('[PostgreSQL] Подключение установлено.');
  } catch (error) {
    console.error(
      '[PostgreSQL] Не удалось подключиться:',
      formatDatabaseError(error),
    );

    if (error.code === '42P01') {
      console.error(
        '[PostgreSQL] Таблицы ещё не созданы. Выполните npm run db:migrate.',
      );
    }

    throw error;
  }
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
});

function rssValue(value) {
  if (
    typeof value === 'string' ||
    typeof value === 'number'
  ) {
    return String(value);
  }

  if (value && typeof value === 'object') {
    return String(value['#text'] || '');
  }

  return '';
}

function plainText(value) {
  return rssValue(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

async function refreshKamazNews() {
  const response = await fetch(rssUrl, {
    redirect: 'follow',
    signal: AbortSignal.timeout(15_000),
    headers: {
      'User-Agent': 'Eland-KAMAZ-Dealer-News/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(
      `RSS КАМАЗ вернул HTTP ${response.status}`,
    );
  }

  const xml = await response.text();
  const parsed = xmlParser.parse(xml);

  const rawItems =
    parsed?.rss?.channel?.item ??
    parsed?.feed?.entry ??
    [];

  const items = Array.isArray(rawItems)
    ? rawItems
    : [rawItems];

  const fetchedAt = new Date();

  const operations = items
    .map((item) => {
      const title = plainText(item.title);

      const link = rssValue(
        item.link?.['@_href'] || item.link,
      );

      const guid = rssValue(item.guid) || link;

      const dateValue = rssValue(
        item.pubDate ||
        item.published ||
        item.updated,
      );

      const publishedAt = new Date(dateValue);

      if (
        !title ||
        !link ||
        !guid ||
        Number.isNaN(publishedAt.getTime())
      ) {
        return null;
      }

      return [
        crypto.randomUUID(),
        guid,
        title,
        link,
        plainText(
          item.description ||
          item.summary ||
          item.content,
        ).slice(0, 500),
        publishedAt,
        fetchedAt,
        'ПАО «КАМАЗ»',
      ];
    })
    .filter(Boolean);

  for (const values of operations) {
    await pool.query(
      `
        INSERT INTO news (
          id,
          "rssKey",
          title,
          link,
          description,
          "publishedAt",
          "fetchedAt",
          "createdAt",
          source
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8)
        ON CONFLICT ("rssKey")
        DO UPDATE SET
          title = EXCLUDED.title,
          link = EXCLUDED.link,
          description = EXCLUDED.description,
          "publishedAt" = EXCLUDED."publishedAt",
          "fetchedAt" = EXCLUDED."fetchedAt",
          source = EXCLUDED.source
      `,
      values,
    );
  }

  console.log(
    `[RSS КАМАЗ] Обновлено новостей: ${operations.length}`,
  );

  return operations.length;
}

const applicationSchema = z
  .object({
    type: z.enum([
      'question',
      'callback',
      'test_drive',
      'service',
      'commercial_offer',
    ]),

    name: z
      .string()
      .trim()
      .min(2)
      .max(100),

    phone: z
      .string()
      .trim()
      .min(10)
      .max(30)
      .refine(
        (value) =>
          value.replace(/\D/g, '').length >= 10,
        'Укажите корректный номер телефона',
      ),

    model: z
      .string()
      .trim()
      .max(100)
      .optional()
      .default(''),

    vehicle: z
      .string()
      .trim()
      .max(100)
      .optional()
      .default(''),

    message: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .default(''),

    branchId: z.coerce
      .number()
      .int()
      .min(0)
      .max(2)
      .default(0),

    consent: z.literal(true),

    website: z
      .string()
      .max(0)
      .optional()
      .default(''),
  })
  .superRefine((data, context) => {
    if (
      data.type === 'service' &&
      !data.vehicle
    ) {
      context.addIssue({
        code: 'custom',
        path: ['vehicle'],
        message: 'Укажите VIN или госномер',
      });
    }

    if (
      ['test_drive', 'commercial_offer'].includes(
        data.type,
      ) &&
      !data.model
    ) {
      context.addIssue({
        code: 'custom',
        path: ['model'],
        message: 'Выберите модель',
      });
    }
  });

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(
  express.json({
    limit: '32kb',
  }),
);

const createLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    ok: false,
    message:
      'Слишком много заявок. Попробуйте позднее.',
  },
});

app.get(
  '/api/health',
  async (_request, response, next) => {
    try {
      await pool.query('SELECT 1');

      response.json({
        ok: true,
        database: 'connected',
      });
    } catch (error) {
      next(error);
    }
  },
);

app.get(
  '/api/news',
  async (request, response, next) => {
    try {
      const requestedLimit = Math.trunc(
        Number(request.query.limit),
      );

      const limit = Math.min(
        Math.max(requestedLimit || 6, 1),
        20,
      );

      const { rows: items } = await pool.query(
        `
          SELECT
            id,
            title,
            link,
            description,
            "publishedAt",
            "fetchedAt",
            "createdAt",
            source
          FROM news
          ORDER BY "publishedAt" DESC, id
          LIMIT $1
        `,
        [limit],
      );

      response.set(
        'Cache-Control',
        'public, max-age=300, stale-while-revalidate=3600',
      );

      response.json({
        ok: true,
        news: items,
      });
    } catch (error) {
      next(error);
    }
  },
);

app.post(
  '/api/applications',
  createLimiter,
  async (request, response, next) => {
    const parsed = applicationSchema.safeParse(
      request.body,
    );

    if (!parsed.success) {
      return response.status(400).json({
        ok: false,
        message: 'Проверьте заполнение формы.',
        fields:
          z.flattenError(parsed.error).fieldErrors,
      });
    }

    try {
      const data = parsed.data;
      const now = new Date();
      const id = crypto.randomUUID();

      const ipHash = crypto
        .createHash('sha256')
        .update(
          `${request.ip || 'unknown'}:${
            process.env.IP_HASH_SALT ||
            'development'
          }`,
        )
        .digest('hex');

      await pool.query(
        `
          INSERT INTO applications (
            id,
            type,
            name,
            phone,
            "phoneNormalized",
            model,
            vehicle,
            message,
            "branchId",
            status,
            "managerId",
            consent,
            "createdAt",
            "updatedAt",
            "ipHash"
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            'new',
            NULL,
            TRUE,
            $10,
            $10,
            $11
          )
        `,
        [
          id,
          data.type,
          data.name,
          data.phone,
          data.phone.replace(/\D/g, ''),
          data.model || null,
          data.vehicle || null,
          data.message || null,
          data.branchId,
          now,
          ipHash,
        ],
      );

      return response.status(201).json({
        ok: true,
        applicationId: id,
      });
    } catch (error) {
      return next(error);
    }
  },
);

function requireAdmin(
  request,
  response,
  next,
) {
  const token = process.env.ADMIN_TOKEN;

  const provided = request
    .get('authorization')
    ?.replace(/^Bearer\s+/i, '');

  if (
    !token ||
    !provided ||
    Buffer.byteLength(provided) !==
      Buffer.byteLength(token)
  ) {
    return response.status(401).json({
      ok: false,
      message: 'Требуется авторизация.',
    });
  }

  const valid = crypto.timingSafeEqual(
    Buffer.from(provided),
    Buffer.from(token),
  );

  if (!valid) {
    return response.status(401).json({
      ok: false,
      message: 'Требуется авторизация.',
    });
  }

  return next();
}

app.get(
  '/api/applications',
  requireAdmin,
  async (request, response, next) => {
    try {
      const requestedLimit = Math.trunc(
        Number(request.query.limit),
      );

      const requestedOffset = Math.trunc(
        Number(request.query.offset),
      );

      const limit = Math.min(
        Math.max(requestedLimit || 50, 1),
        100,
      );

      const offset = Math.min(
        Math.max(requestedOffset || 0, 0),
        2_147_483_647,
      );

      const { rows: items } = await pool.query(
        `
          SELECT
            id,
            type,
            name,
            phone,
            model,
            vehicle,
            message,
            "branchId",
            status,
            "managerId",
            "createdAt",
            "updatedAt"
          FROM applications
          ORDER BY "createdAt" DESC, id
          LIMIT $1
          OFFSET $2
        `,
        [limit, offset],
      );

      response.json({
        ok: true,
        applications: items,
      });
    } catch (error) {
      next(error);
    }
  },
);

app.patch(
  '/api/applications/:id',
  requireAdmin,
  async (request, response, next) => {
    const parsedStatus = z
      .enum([
        'new',
        'processing',
        'completed',
        'rejected',
      ])
      .safeParse(request.body?.status);

    if (!parsedStatus.success) {
      return response.status(400).json({
        ok: false,
        message: 'Некорректный статус.',
      });
    }

    const parsedId = z
      .string()
      .uuid()
      .safeParse(request.params.id);

    if (!parsedId.success) {
      return response.status(400).json({
        ok: false,
        message: 'Некорректный ID заявки.',
      });
    }

    try {
      const result = await pool.query(
        `
          UPDATE applications
          SET
            status = $1,
            "updatedAt" = $2
          WHERE id = $3
        `,
        [
          parsedStatus.data,
          new Date(),
          parsedId.data,
        ],
      );

      if (!result.rowCount) {
        return response.status(404).json({
          ok: false,
          message: 'Заявка не найдена.',
        });
      }

      return response.json({
        ok: true,
      });
    } catch (error) {
      return next(error);
    }
  },
);

const distDir = path.join(rootDir, 'dist');

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));

  app.get(
    /^(?!\/api\/).*/,
    (_request, response) => {
      response.sendFile(
        path.join(distDir, 'index.html'),
      );
    },
  );
}

app.use(
  (error, _request, response, _next) => {
    console.error('[API]', {
      name: error.name,
      code: error.code,
      message: error.message,
      detail: error.detail,
    });

    response.status(500).json({
      ok: false,
      message: 'Внутренняя ошибка сервера.',
    });
  },
);

let server;
let rssTimer;

async function start() {
  await checkDatabase();

  server = app.listen(port, () => {
    console.log(
      `[API] Сервер запущен: http://localhost:${port}`,
    );
  });

  refreshKamazNews().catch((error) => {
    console.error(
      '[RSS КАМАЗ] Не удалось обновить новости:',
      error.message,
    );
  });

  rssTimer = setInterval(() => {
    refreshKamazNews().catch((error) => {
      console.error(
        '[RSS КАМАЗ] Не удалось обновить новости:',
        error.message,
      );
    });
  }, rssRefreshMs);

  rssTimer.unref();
}

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  console.log(`[API] Получен ${signal}. Остановка...`);

  if (rssTimer) {
    clearInterval(rssTimer);
  }

  if (server) {
    await new Promise((resolve) => {
      server.close(resolve);
    });
  }

  await pool.end();
  process.exit(0);
}

process.on('SIGINT', () => {
  shutdown('SIGINT').catch(console.error);
});

process.on('SIGTERM', () => {
  shutdown('SIGTERM').catch(console.error);
});

try {
  await start();
} catch (error) {
  console.error(
    '[API] Запуск остановлен:',
    formatDatabaseError(error),
  );

  await pool.end();
  process.exit(1);
}
