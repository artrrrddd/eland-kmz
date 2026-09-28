<?php
declare(strict_types=1);
// Router for the local PHP development server only.
$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/');
if ($path === '/api' || str_starts_with($path, '/api/')) {
    require __DIR__ . '/api.php';
    exit;
}
if (preg_match('~(?:^|/)\.|\\\\~', $path)) {
    http_response_code(404);
    exit;
}
$root = realpath($_SERVER['DOCUMENT_ROOT']);
$file = realpath($root . $path);
if ($file && str_starts_with($file, $root . DIRECTORY_SEPARATOR) && is_file($file)) return false;
if (is_file($root . '/index.html')) {
    header('Content-Type: text/html; charset=utf-8');
    readfile($root . '/index.html');
} else {
    http_response_code(404);
}
