<?php
declare(strict_types=1);

function validateApplication(array $input): array
{
    $data = [];
    $errors = [];
    foreach (['type' => 30, 'name' => 100, 'phone' => 30, 'model' => 100, 'vehicle' => 100, 'message' => 2000, 'website' => 0] as $key => $max) {
        $value = array_key_exists($key, $input) ? $input[$key] : '';
        if (!is_string($value)) {
            $errors[$key] = ['Ожидается строка.'];
            $value = '';
        }
        $data[$key] = $key === 'website' ? $value : trim($value);
        if (mb_strlen($data[$key], 'UTF-8') > $max) $errors[$key] = ['Слишком длинное значение.'];
    }
    if (!in_array($data['type'], ['question', 'callback', 'test_drive', 'service', 'commercial_offer'], true)) $errors['type'] = ['Некорректный тип заявки.'];
    if (mb_strlen($data['name'], 'UTF-8') < 2) $errors['name'] = ['Укажите имя (от 2 символов).'];
    if (strlen(preg_replace('/\D/', '', $data['phone'])) < 10) $errors['phone'] = ['Укажите корректный номер телефона.'];
    $branch = $input['branchId'] ?? 0;
    if ((!is_string($branch) && !is_int($branch) && !is_float($branch)) || !is_numeric($branch) || (float) $branch != (int) $branch || $branch < 0 || $branch > 2) {
        $errors['branchId'] = ['Некорректный филиал.'];
    }
    $data['branchId'] = isset($errors['branchId']) ? 0 : (int) $branch;
    if (($input['consent'] ?? false) !== true) $errors['consent'] = ['Необходимо согласие.'];
    if ($data['type'] === 'service' && $data['vehicle'] === '') $errors['vehicle'] = ['Укажите VIN или госномер.'];
    if (in_array($data['type'], ['test_drive', 'commercial_offer'], true) && $data['model'] === '') $errors['model'] = ['Выберите модель.'];
    return [$data, $errors];
}

function applicationIpHash(): string
{
    $salt = env('IP_HASH_SALT');
    if ($salt === '') throw new RuntimeException('IP_HASH_SALT is required.');
    // Do not trust client-supplied X-Forwarded-For. Configure the host's real-IP module if needed.
    return hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? 'unknown') . ':' . $salt);
}

function consumeApplicationLimit(PDO $pdo, string $hash): array
{
    // Keep the upsert and read under the same InnoDB row lock.
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('INSERT INTO api_rate_limits (`key`, hits, expires_at)
            VALUES (:key, 1, NOW(3) + INTERVAL 15 MINUTE)
            ON DUPLICATE KEY UPDATE
              hits = IF(expires_at <= NOW(3), 1, hits + 1),
              expires_at = IF(expires_at <= NOW(3), NOW(3) + INTERVAL 15 MINUTE, expires_at)');
        $stmt->execute(['key' => $hash]);
        $stmt = $pdo->prepare('SELECT hits, GREATEST(1, CEIL(TIMESTAMPDIFF(MICROSECOND, NOW(3), expires_at) / 1000000)) AS retry
            FROM api_rate_limits WHERE `key` = :key FOR UPDATE');
        $stmt->execute(['key' => $hash]);
        $result = $stmt->fetch();
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
    $pdo->exec('DELETE FROM api_rate_limits WHERE expires_at < NOW(3) LIMIT 1000');
    return $result;
}

function limitApplications(PDO $pdo, string $hash): void
{
    $result = consumeApplicationLimit($pdo, $hash);
    if ((int) $result['hits'] > 5) {
        header('Retry-After: ' . (int) $result['retry']);
        jsonResponse(['ok' => false, 'message' => 'Слишком много заявок. Попробуйте позднее.'], 429);
    }
}
