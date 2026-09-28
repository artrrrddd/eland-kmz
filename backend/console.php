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
        $row = $pdo->query('SELECT DATABASE() AS `database`, CURRENT_USER() AS `user`, VERSION() AS version')->fetch();
        $ssl = $pdo->query("SHOW SESSION STATUS LIKE 'Ssl_cipher'")->fetch();
        $row['ssl'] = !empty($ssl['Value']);
        $stmt = $pdo->prepare('SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :table');
        foreach (['applications', 'news', 'api_rate_limits'] as $table) {
            $stmt->execute(['table' => $table]);
            $row[$table . '_ready'] = (bool) $stmt->fetchColumn();
        }
        echo json_encode($row, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR) . PHP_EOL;
    } elseif ($command === 'db:migrate') {
        $lock = 'kamaz:migrate:' . substr(hash('sha256', env('DB_DATABASE')), 0, 32);
        $stmt = $pdo->prepare('SELECT GET_LOCK(?, 15)');
        $stmt->execute([$lock]);
        if ((int) $stmt->fetchColumn() !== 1) throw new RuntimeException('Could not acquire migration lock.');
        try {
            // MySQL DDL commits implicitly. Each CREATE is repeatable after a partial failure.
            foreach (explode(';', file_get_contents(__DIR__ . '/schema.sql')) as $sql) {
                if (trim($sql) !== '') $pdo->exec($sql);
            }
        } finally {
            $stmt = $pdo->prepare('SELECT RELEASE_LOCK(?)');
            $stmt->execute([$lock]);
        }
        echo "MySQL schema ready.\n";
    } else {
        require __DIR__ . '/news.php';
        echo 'Updated news: ' . refreshNews($pdo) . PHP_EOL;
    }
} catch (Throwable $error) {
    fwrite(STDERR, '[CLI] ' . $error->getMessage() . PHP_EOL);
    exit(1);
}
