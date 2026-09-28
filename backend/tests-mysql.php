<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
set_exception_handler(static function (Throwable $error): never {
    fwrite(STDERR, '[MySQL test] ' . $error->getMessage() . PHP_EOL);
    exit(1);
});
require __DIR__ . '/bootstrap.php';
require __DIR__ . '/applications.php';
require __DIR__ . '/news.php';

function verify(bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
}

// Unique fixture keys isolate test rows; finally removes only those rows.
$pdo = db();
$hash = hash('sha256', uuid());
$rssKey = 'integration-test:' . uuid();
$rssHash = hash('sha256', $rssKey);
$id = uuid();
try {
for ($i = 1; $i <= 6; $i++) {
    $result = consumeApplicationLimit($pdo, $hash);
    verify((int) $result['hits'] === $i, 'Rate counter lost an update.');
    verify((int) $result['retry'] > 0 && (int) $result['retry'] <= 900, 'Invalid retry interval.');
}
$stmt = $pdo->prepare('UPDATE api_rate_limits SET expires_at = NOW(3) - INTERVAL 1 SECOND WHERE `key` = ?');
$stmt->execute([$hash]);
verify((int) consumeApplicationLimit($pdo, $hash)['hits'] === 1, 'Expired rate window did not reset.');
$items = parseNews('<rss><channel><item><title>КАМАЗ 🚚</title><link>https://example.com/news</link><guid>fixture</guid><pubDate>Mon, 28 Sep 2026 12:00:00 +0300</pubDate></item></channel></rss>');
$items[0]['key'] = $rssKey;
storeNews($pdo, $items);
$selectNews = $pdo->prepare('SELECT * FROM news WHERE `rssKeyHash` = ?');
$selectNews->execute([$rssHash]);
$original = $selectNews->fetch();
verify($original['publishedAt'] === '2026-09-28 09:00:00.000', 'UTC conversion failed.');
verify($original['title'] === 'КАМАЗ 🚚', 'utf8mb4 round trip failed.');
$items[0]['title'] = 'Updated';
storeNews($pdo, $items);
$selectNews->execute([$rssHash]);
$rows = $selectNews->fetchAll();
verify(count($rows) === 1, 'RSS upsert created duplicates.');
$updated = $rows[0];
verify($updated['id'] === $original['id'] && $updated['title'] === 'Updated', 'RSS identity/update failed.');
verify(apiRows([$updated])[0]['publishedAt'] === '2026-09-28T09:00:00.000Z', 'API timestamp changed.');
$stmt = $pdo->prepare('INSERT INTO applications (id, type, name, phone, `phoneNormalized`, `ipHash`) VALUES (?, ?, ?, ?, ?, ?)');
$stmt->execute([$id, 'callback', 'Иван 🚚', '+79991234567', '79991234567', $hash]);
$stmt = $pdo->prepare('UPDATE applications SET status = ?, `updatedAt` = NOW(3) WHERE id = ?');
$stmt->execute(['processing', $id]);
verify($stmt->rowCount() === 1, 'Status update failed.');
$stmt->execute(['processing', $id]);
verify($stmt->rowCount() === 1, 'Unchanged status must still match the application.');
$stmt->execute(['processing', uuid()]);
verify($stmt->rowCount() === 0, 'Missing application should not match.');
echo "MySQL tests passed: rate window, RSS upsert, UTF-8, UTC and status updates.\n";
} catch (Throwable $error) {
    fwrite(STDERR, '[MySQL test] ' . $error->getMessage() . PHP_EOL);
    $failed = true;
} finally {
    if ($pdo->inTransaction()) $pdo->rollBack();
    foreach ([['applications', 'id', $id], ['news', 'rssKeyHash', $rssHash], ['api_rate_limits', 'key', $hash]] as [$table, $column, $value]) {
        $stmt = $pdo->prepare('DELETE FROM `' . $table . '` WHERE `' . $column . '` = ?');
        $stmt->execute([$value]);
    }
}
if ($failed ?? false) exit(1);
