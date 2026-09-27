import dotenv from 'dotenv';
import fs from 'node:fs';
import dns from 'node:dns';
import net from 'node:net';
import path from 'node:path';
import tls from 'node:tls';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;
const rootDir = fileURLToPath(new URL('../', import.meta.url));
dotenv.config({ path: path.join(rootDir, '.env'), quiet: true });

dns.setDefaultResultOrder('ipv4first');

if (typeof net.setDefaultAutoSelectFamily === 'function') {
  net.setDefaultAutoSelectFamily(false);
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('Не задана переменная DATABASE_URL в .env');
}

let parsedUrl;

try {
  parsedUrl = new URL(databaseUrl);
} catch {
  throw new Error('DATABASE_URL содержит некорректный URL');
}

if (!['postgres:', 'postgresql:'].includes(parsedUrl.protocol)) {
  throw new Error('DATABASE_URL должен начинаться с postgresql://');
}

for (const parameter of [
  'sslmode',
  'sslrootcert',
  'sslcert',
  'sslkey',
]) {
  if (parsedUrl.searchParams.has(parameter)) {
    throw new Error(
      `Уберите ${parameter} из DATABASE_URL. TLS настраивается через PGSSLMODE и PGSSLROOTCERT.`,
    );
  }
}

const sslMode = process.env.PGSSLMODE || 'verify-full';

if (!['verify-full', 'verify-ca', 'disable'].includes(sslMode)) {
  throw new Error(
    'PGSSLMODE должен иметь значение verify-full, verify-ca или disable',
  );
}

function createSslConfig() {
  if (sslMode === 'disable') {
    return false;
  }

  const certificatePath = process.env.PGSSLROOTCERT;

  if (!certificatePath) {
    throw new Error(
      'Для TLS-подключения необходимо задать PGSSLROOTCERT в .env',
    );
  }

  const absoluteCertificatePath = path.resolve(rootDir, certificatePath);

  if (!fs.existsSync(absoluteCertificatePath)) {
    throw new Error(
      `Сертификат PostgreSQL не найден: ${absoluteCertificatePath}`,
    );
  }

  const ca = fs.readFileSync(absoluteCertificatePath, 'utf8').trim();

  if (!ca.startsWith('-----BEGIN CERTIFICATE-----')) {
    throw new Error(
      'Файл PGSSLROOTCERT не похож на PEM-сертификат',
    );
  }

  if (sslMode === 'verify-ca') {
    return {
      ca,
      rejectUnauthorized: true,
      checkServerIdentity: () => undefined,
    };
  }

  return {
    ca,
    rejectUnauthorized: true,
    checkServerIdentity: (_hostname, certificate) =>
      tls.checkServerIdentity(parsedUrl.hostname, certificate),
  };
}

export const pool = new Pool({
  connectionString: parsedUrl.toString(),
  ssl: createSslConfig(),
  max: 10,
  connectionTimeoutMillis: 15_000,
  idleTimeoutMillis: 30_000,
  statement_timeout: 15_000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 5_000,
});

pool.on('error', (error) => {
  console.error('[PostgreSQL pool]', {
    name: error.name,
    code: error.code,
    message: error.message,
    errors: error.errors?.map((item) => ({
      code: item.code,
      message: item.message,
      address: item.address,
      port: item.port,
      syscall: item.syscall,
    })),
  });
});

export function getSafeDatabaseInfo() {
  return {
    host: parsedUrl.hostname,
    port: parsedUrl.port || '5432',
    database: decodeURIComponent(parsedUrl.pathname.slice(1)),
    user: decodeURIComponent(parsedUrl.username),
    passwordPresent: Boolean(parsedUrl.password),
    sslMode,
  };
}
