// Проверяет подключение без изменения данных и без требования готовой схемы.
let pool;

try {
  const database = await import('./database.js');
  pool = database.pool;
  console.log('[PostgreSQL] Настройки:', database.getSafeDatabaseInfo());
  const { rows } = await pool.query(`
    SELECT current_database() AS database, current_user AS "user",
      current_setting('server_version') AS version,
      (SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()) AS ssl,
      to_regclass('public.applications') IS NOT NULL AS "applicationsReady",
      to_regclass('public.news') IS NOT NULL AS "newsReady"
  `);
  console.log('[PostgreSQL] Подключение установлено:', rows[0]);
  if (!rows[0].applicationsReady || !rows[0].newsReady) {
    console.log('[PostgreSQL] Для создания таблиц выполните npm run db:migrate.');
  }
} catch (error) {
  console.error('[PostgreSQL] Проверка не пройдена:', {
    code: error.code,
    message: error.message,
  });
  process.exitCode = 1;
} finally {
  await pool?.end();
}
