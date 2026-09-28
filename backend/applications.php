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

function limitApplications(PDO $pdo, string $hash): void
{
    // Atomic shared counter: concurrent PHP workers cannot bypass the limit.
    $stmt = $pdo->prepare('INSERT INTO api_rate_limits (key, hits, expires_at)
        VALUES (:key, 1, NOW() + INTERVAL \'15 minutes\')
        ON CONFLICT (key) DO UPDATE SET
          hits = CASE WHEN api_rate_limits.expires_at <= NOW() THEN 1 ELSE api_rate_limits.hits + 1 END,
          expires_at = CASE WHEN api_rate_limits.expires_at <= NOW() THEN NOW() + INTERVAL \'15 minutes\' ELSE api_rate_limits.expires_at END
        RETURNING hits, GREATEST(1, CEIL(EXTRACT(EPOCH FROM expires_at - NOW()))) AS retry');
    $stmt->execute(['key' => $hash]);
    $result = $stmt->fetch();
    $pdo->exec('DELETE FROM api_rate_limits WHERE expires_at < NOW()');
    if ((int) $result['hits'] > 5) {
        header('Retry-After: ' . (int) $result['retry']);
        jsonResponse(['ok' => false, 'message' => 'Слишком много заявок. Попробуйте позднее.'], 429);
    }
}
