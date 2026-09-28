<?php
declare(strict_types=1);

const PROJECT_ROOT = __DIR__ . '/..';
date_default_timezone_set('UTC');
ini_set('display_errors', '0');

// Environment variables take precedence; .env stays outside the document root.
if (is_file(PROJECT_ROOT . '/.env')) {
    foreach (file(PROJECT_ROOT . '/.env', FILE_IGNORE_NEW_LINES) as $line) {
        $line = trim(ltrim($line, "\xEF\xBB\xBF"));
        if ($line === '' || str_starts_with($line, '#')) continue;
        if (!preg_match('/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/', $line, $match)) continue;
        $value = trim($match[2]);
        if (strlen($value) >= 2 && (($value[0] === '"' && str_ends_with($value, '"')) || ($value[0] === "'" && str_ends_with($value, "'")))) {
            $value = substr($value, 1, -1);
        } else {
            $value = preg_replace('/\s+#.*$/', '', $value);
        }
        if (getenv($match[1]) === false) putenv($match[1] . '=' . $value);
    }
}

function env(string $key, string $default = ''): string
{
    $value = getenv($key);
    return $value === false ? $default : $value;
}

function db(): PDO
{
    static $pdo;
    if ($pdo instanceof PDO) return $pdo;
    if (!in_array('mysql', PDO::getAvailableDrivers(), true)) throw new RuntimeException('Enable pdo_mysql in php.ini.');
    $host = env('DB_HOST', '127.0.0.1');
    $port = env('DB_PORT', '3306');
    $name = env('DB_DATABASE');
    if ($name === '' || !ctype_digit($port) || (int) $port < 1 || (int) $port > 65535) throw new RuntimeException('Invalid MySQL database settings.');
    foreach ([$host, $name] as $value) {
        if (preg_match('/[;\x00\r\n]/', $value)) throw new RuntimeException('Invalid MySQL DSN value.');
    }
    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::ATTR_TIMEOUT => 15,
        PDO::MYSQL_ATTR_FOUND_ROWS => true,
        PDO::MYSQL_ATTR_MULTI_STATEMENTS => false,
    ];
    $mode = env('DB_SSL_MODE', 'disable');
    if (!in_array($mode, ['disable', 'require', 'verify'], true)) throw new RuntimeException('Invalid DB_SSL_MODE.');
    if ($mode !== 'disable') {
        if (!extension_loaded('openssl')) throw new RuntimeException('Enable openssl in php.ini for MySQL TLS.');
        $ca = env('DB_SSL_CA');
        if ($mode === 'verify' && $ca === '') throw new RuntimeException('DB_SSL_CA is required in verify mode.');
        if ($ca !== '') {
            if (!preg_match('~^(?:[A-Za-z]:[\\\\/]|/)~', $ca)) $ca = PROJECT_ROOT . '/' . $ca;
            $ca = realpath($ca);
            if ($ca === false) throw new RuntimeException('MySQL CA certificate not found.');
            $options[PDO::MYSQL_ATTR_SSL_CA] = $ca;
        } else {
            $options[PDO::MYSQL_ATTR_SSL_CA] = null;
        }
        $options[PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT] = $mode === 'verify';
        $options[PDO::MYSQL_ATTR_SSL_CIPHER] = 'DEFAULT';
    }
    $connection = new PDO('mysql:host=' . $host . ';port=' . $port . ';dbname=' . $name . ';charset=utf8mb4', env('DB_USERNAME'), env('DB_PASSWORD'), $options);
    $connection->exec("SET time_zone = '+00:00'");
    if ($mode !== 'disable') {
        $ssl = $connection->query("SHOW SESSION STATUS LIKE 'Ssl_cipher'")->fetch();
        if (empty($ssl['Value'])) throw new RuntimeException('MySQL TLS connection is required.');
    }
    $pdo = $connection;
    return $pdo;
}

function uuid(): string
{
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
    $hex = bin2hex($bytes);
    return substr($hex, 0, 8) . '-' . substr($hex, 8, 4) . '-' . substr($hex, 12, 4) . '-' . substr($hex, 16, 4) . '-' . substr($hex, 20);
}

function jsonResponse(array $data, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    exit;
}

function jsonInput(): array
{
    if (strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0])) !== 'application/json') {
        jsonResponse(['ok' => false, 'message' => 'Ожидается application/json.'], 415);
    }
    $body = file_get_contents('php://input', false, null, 0, 32769);
    if (strlen($body) > 32768) jsonResponse(['ok' => false, 'message' => 'Слишком большой запрос.'], 413);
    try {
        $input = json_decode($body, false, 64, JSON_THROW_ON_ERROR);
    } catch (JsonException $error) {
        jsonResponse(['ok' => false, 'message' => 'Некорректный JSON.'], 400);
    }
    if (!$input instanceof stdClass) jsonResponse(['ok' => false, 'message' => 'Ожидается объект JSON.'], 400);
    return (array) $input;
}

function requireAdmin(): void
{
    $token = env('ADMIN_TOKEN');
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    $provided = preg_replace('/^Bearer\s+/i', '', $header);
    if ($token === '' || !preg_match('/^Bearer\s+/i', $header) || !hash_equals($token, $provided)) {
        jsonResponse(['ok' => false, 'message' => 'Требуется авторизация.'], 401);
    }
}

function pagination(string $key, int $default, int $min, int $max): int
{
    $value = $_GET[$key] ?? null;
    $number = is_scalar($value) && is_numeric($value) ? (float) $value : 0;
    if (!is_finite($number) || $number == 0) return $default;
    return (int) max($min, min($max, $number));
}

function apiRows(array $rows): array
{
    foreach ($rows as &$row) {
        foreach (['publishedAt', 'fetchedAt', 'createdAt', 'updatedAt'] as $key) {
            if (isset($row[$key])) $row[$key] = (new DateTimeImmutable($row[$key]))->format('Y-m-d\TH:i:s.v\Z');
        }
        if (isset($row['branchId'])) $row['branchId'] = (int) $row['branchId'];
    }
    return $rows;
}
