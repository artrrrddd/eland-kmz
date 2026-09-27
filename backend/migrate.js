import fs from 'node:fs/promises';
import { pool, getSafeDatabaseInfo } from './database.js';

function formatDatabaseError(error) {
  return {
    name: error.name,
    code: error.code,
    message: error.message,
    detail: error.detail,
    hint: error.hint,
    errors: error.errors?.map((item) => ({
      code: item.code,
      message: item.message,
      address: item.address,
      port: item.port,
      syscall: item.syscall,
    })),
  };
}

async function migrate() {
  console.log('[Migration] Подключение:', getSafeDatabaseInfo());

  const schemaUrl = new URL('./schema.sql', import.meta.url);
  const sql = await fs.readFile(schemaUrl, 'utf8');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      'SELECT pg_advisory_xact_lock($1)',
      [73109421],
    );

    await client.query(sql);
    await client.query('COMMIT');

    console.log('[Migration] Схема PostgreSQL создана или проверена.');
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error(
        '[Migration] Ошибка отката транзакции:',
        formatDatabaseError(rollbackError),
      );
    }

    throw error;
  } finally {
    client.release();
  }
}

try {
  await migrate();
} catch (error) {
  console.error(
    '[Migration] Миграция не выполнена:',
    formatDatabaseError(error),
  );

  process.exitCode = 1;
} finally {
  await pool.end();
}