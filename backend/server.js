import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { XMLParser } from 'fast-xml-parser';
import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 3000);
const mongoUri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DATABASE || 'kamaz';
const rssUrl = process.env.KAMAZ_RSS_URL || 'http://www.kamaz.ru/press/releases/rss/';
const rssRefreshMs = Math.max(Number(process.env.RSS_REFRESH_MINUTES || 30), 5) * 60_000;

if (!mongoUri) {
  console.error('Не задана переменная окружения MONGODB_URI.');
  process.exit(1);
}

const client = new MongoClient(mongoUri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
  serverSelectionTimeoutMS: 10_000,
});

await client.connect();
await client.db('admin').command({ ping: 1 });

const database = client.db(databaseName);
const applications = database.collection('applications');
const news = database.collection('news');
await Promise.all([
  applications.createIndex({ createdAt: -1 }),
  applications.createIndex({ status: 1, createdAt: -1 }),
  applications.createIndex({ phoneNormalized: 1 }),
  news.createIndex({ rssKey: 1 }, { unique: true }),
  news.createIndex({ publishedAt: -1 }),
]);

const xmlParser = new XMLParser({ ignoreAttributes: false, trimValues: true });

function rssValue(value) {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (value && typeof value === 'object') return String(value['#text'] || '');
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
    headers: { 'User-Agent': 'Eland-KAMAZ-Dealer-News/1.0' },
  });
  if (!response.ok) throw new Error(`RSS КАМАЗ вернул HTTP ${response.status}`);
  const parsed = xmlParser.parse(await response.text());
  const rawItems = parsed?.rss?.channel?.item ?? parsed?.feed?.entry ?? [];
  const items = Array.isArray(rawItems) ? rawItems : [rawItems];
  const fetchedAt = new Date();
  const operations = items.map((item) => {
    const title = plainText(item.title);
    const link = rssValue(item.link?.['@_href'] || item.link);
    const guid = rssValue(item.guid) || link;
    const dateValue = rssValue(item.pubDate || item.published || item.updated);
    const publishedAt = new Date(dateValue);
    if (!title || !link || !guid || Number.isNaN(publishedAt.getTime())) return null;
    return {
      updateOne: {
        filter: { rssKey: guid },
        update: {
          $set: {
            title,
            link,
            description: plainText(item.description || item.summary || item.content).slice(0, 500),
            publishedAt,
            fetchedAt,
            source: 'ПАО «КАМАЗ»',
          },
          $setOnInsert: { rssKey: guid, createdAt: fetchedAt },
        },
        upsert: true,
      },
    };
  }).filter(Boolean);
  if (operations.length) await news.bulkWrite(operations, { ordered: false });
  console.log(`RSS КАМАЗ: обновлено ${operations.length} новостей`);
  return operations.length;
}

const applicationSchema = z.object({
  type: z.enum(['question', 'callback', 'test_drive', 'service', 'commercial_offer']),
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(10).max(30).refine(
    (value) => value.replace(/\D/g, '').length >= 10,
    'Укажите корректный номер телефона',
  ),
  model: z.string().trim().max(100).optional().default(''),
  vehicle: z.string().trim().max(100).optional().default(''),
  message: z.string().trim().max(2000).optional().default(''),
  branchId: z.coerce.number().int().min(0).max(2).default(0),
  consent: z.literal(true),
  website: z.string().max(0).optional().default(''),
}).superRefine((data, context) => {
  if (data.type === 'service' && !data.vehicle) {
    context.addIssue({ code: 'custom', path: ['vehicle'], message: 'Укажите VIN или госномер' });
  }
  if (['test_drive', 'commercial_offer'].includes(data.type) && !data.model) {
    context.addIssue({ code: 'custom', path: ['model'], message: 'Выберите модель' });
  }
});

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '32kb' }));

const createLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { ok: false, message: 'Слишком много заявок. Попробуйте позднее.' },
});

app.get('/api/health', async (_request, response, next) => {
  try {
    await database.command({ ping: 1 });
    response.json({ ok: true, database: 'connected' });
  } catch (error) { next(error); }
});

app.get('/api/news', async (request, response, next) => {
  try {
    const limit = Math.min(Math.max(Number(request.query.limit) || 6, 1), 20);
    const items = await news.find({}, { projection: { rssKey: 0 } })
      .sort({ publishedAt: -1 }).limit(limit).toArray();
    response.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
    response.json({
      ok: true,
      news: items.map(({ _id, ...item }) => ({ id: _id.toString(), ...item })),
    });
  } catch (error) { next(error); }
});

app.post('/api/applications', createLimiter, async (request, response, next) => {
  const parsed = applicationSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({
      ok: false,
      message: 'Проверьте заполнение формы.',
      fields: z.flattenError(parsed.error).fieldErrors,
    });
  }

  try {
    const data = parsed.data;
    const now = new Date();
    const ipHash = crypto.createHash('sha256')
      .update(`${request.ip || 'unknown'}:${process.env.IP_HASH_SALT || 'development'}`)
      .digest('hex');
    const result = await applications.insertOne({
      type: data.type,
      name: data.name,
      phone: data.phone,
      phoneNormalized: data.phone.replace(/\D/g, ''),
      model: data.model || null,
      vehicle: data.vehicle || null,
      message: data.message || null,
      branchId: data.branchId,
      status: 'new',
      managerId: null,
      consent: true,
      createdAt: now,
      updatedAt: now,
      ipHash,
    });
    return response.status(201).json({ ok: true, applicationId: result.insertedId.toString() });
  } catch (error) { return next(error); }
});

function requireAdmin(request, response, next) {
  const token = process.env.ADMIN_TOKEN;
  const provided = request.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token || !provided || provided.length !== token.length ||
      !crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(token))) {
    return response.status(401).json({ ok: false, message: 'Требуется авторизация.' });
  }
  return next();
}

app.get('/api/applications', requireAdmin, async (request, response, next) => {
  try {
    const limit = Math.min(Math.max(Number(request.query.limit) || 50, 1), 100);
    const offset = Math.max(Number(request.query.offset) || 0, 0);
    const items = await applications.find(
      {},
      { projection: { ipHash: 0, phoneNormalized: 0, consent: 0 } },
    ).sort({ createdAt: -1 }).skip(offset).limit(limit).toArray();
    response.json({
      ok: true,
      applications: items.map(({ _id, ...item }) => ({ id: _id.toString(), ...item })),
    });
  } catch (error) { next(error); }
});

app.patch('/api/applications/:id', requireAdmin, async (request, response, next) => {
  const status = z.enum(['new', 'processing', 'completed', 'rejected']).safeParse(request.body?.status);
  if (!status.success) return response.status(400).json({ ok: false, message: 'Некорректный статус.' });
  if (!ObjectId.isValid(request.params.id)) {
    return response.status(400).json({ ok: false, message: 'Некорректный ID заявки.' });
  }
  try {
    const result = await applications.updateOne(
      { _id: new ObjectId(request.params.id) },
      { $set: { status: status.data, updatedAt: new Date() } },
    );
    if (!result.matchedCount) return response.status(404).json({ ok: false, message: 'Заявка не найдена.' });
    return response.json({ ok: true });
  } catch (error) { return next(error); }
});

const distDir = path.join(rootDir, 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^(?!\/api\/).*/, (_request, response) => response.sendFile(path.join(distDir, 'index.html')));
}

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ ok: false, message: 'Внутренняя ошибка сервера.' });
});

const server = app.listen(port, () => {
  console.log(`Server: http://localhost:${port}`);
  console.log(`MongoDB database: ${databaseName}`);
});

refreshKamazNews().catch((error) => console.error('Не удалось обновить RSS КАМАЗ:', error.message));
const rssTimer = setInterval(() => {
  refreshKamazNews().catch((error) => console.error('Не удалось обновить RSS КАМАЗ:', error.message));
}, rssRefreshMs);
rssTimer.unref();

function shutdown() {
  clearInterval(rssTimer);
  server.close(async () => {
    await client.close();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
