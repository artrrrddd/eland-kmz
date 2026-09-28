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
    $url = parse_url(env('DATABASE_URL'));
    if (!$url || !in_array($url['scheme'] ?? '', ['postgres', 'postgresql'], true) || empty($url['host']) || empty($url['path'])) {
        throw new RuntimeException('Set a valid PostgreSQL DATABASE_URL.');
    }
    if (!empty($url['query'])) throw new RuntimeException('Use PGSSLMODE and PGSSLROOTCERT instead of URL parameters.');
    $mode = env('PGSSLMODE', 'verify-full');
    if (!in_array($mode, ['verify-full', 'verify-ca', 'disable'], true)) throw new RuntimeException('Invalid PGSSLMODE.');
    $params = ['host' => $url['host'], 'port' => (string) ($url['port'] ?? 5432), 'dbname' => rawurldecode(substr($url['path'], 1)), 'sslmode' => $mode, 'connect_timeout' => '15'];
    if ($mode !== 'disable') {
        $cert = env('PGSSLROOTCERT');
        if ($cert === '') throw new RuntimeException('PGSSLROOTCERT is required for TLS.');
        if (!preg_match('~^(?:[A-Za-z]:[\\\\/]|/)~', $cert)) $cert = PROJECT_ROOT . '/' . $cert;
        $cert = realpath($cert);
        if ($cert === false) throw new RuntimeException('PostgreSQL CA certificate not found.');
        $params['sslrootcert'] = str_replace('\\', '/', $cert);
        // libpq on Windows can fail on absolute Unicode paths. A relative path
        // avoids that issue when the certificate is beneath the working directory.
        $cwd = str_replace('\\', '/', getcwd()) . '/';
        if (PHP_OS_FAMILY === 'Windows' && str_starts_with($params['sslrootcert'], $cwd)) {
            $params['sslrootcert'] = substr($params['sslrootcert'], strlen($cwd));
        }
    }
    $dsn = 'pgsql:';
    foreach ($params as $key => $value) {
        if (str_contains($value, ';') || str_contains($value, "\0")) throw new RuntimeException('Invalid DSN value.');
        $dsn .= $key . "='" . str_replace(['\\', "'"], ['\\\\', "\\'"], $value) . "' ";
    }
    $pdo = new PDO($dsn, rawurldecode($url['user'] ?? ''), rawurldecode($url['pass'] ?? ''), [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    $pdo->exec("SET statement_timeout = '15s'");
    $pdo->exec("SET TIME ZONE 'UTC'");
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
