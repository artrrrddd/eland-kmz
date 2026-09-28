<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
require __DIR__ . '/bootstrap.php';

try {
    $command = $argv[1] ?? '';
    if (!in_array($command, ['db:check', 'db:migrate', 'news:refresh'], true)) throw new RuntimeException('Usage: php backend/console.php db:check|db:migrate|news:refresh');
    $pdo = db();
    if ($command === 'db:check') {
        $row = $pdo->query("SELECT current_database() AS database, current_user AS user,
            current_setting('server_version') AS version,
            (SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()) AS ssl,
            to_regclass('public.applications') IS NOT NULL AS applications_ready,
            to_regclass('public.news') IS NOT NULL AS news_ready,
            to_regclass('public.api_rate_limits') IS NOT NULL AS rate_limits_ready")->fetch();
        echo json_encode($row, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR) . PHP_EOL;
    } elseif ($command === 'db:migrate') {
        $pdo->beginTransaction();
        try {
            $pdo->query('SELECT pg_advisory_xact_lock(73109421)');
            $pdo->exec(file_get_contents(__DIR__ . '/schema.sql'));
            $pdo->commit();
        } catch (Throwable $error) {
            $pdo->rollBack();
            throw $error;
        }
        echo "PostgreSQL schema ready.\n";
    } else {
        require __DIR__ . '/news.php';
        echo 'Updated news: ' . refreshNews($pdo) . PHP_EOL;
    }
} catch (Throwable $error) {
    // CLI is private; diagnostic messages must never be returned by HTTP endpoints.
    fwrite(STDERR, '[CLI] ' . $error->getMessage() . PHP_EOL);
    exit(1);
}
