<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/applications.php';

try {
    header('Cache-Control: no-store');
    $path = rtrim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/', '/');
    $method = $_SERVER['REQUEST_METHOD'];
    $routes = ['/api/health' => ['GET'], '/api/news' => ['GET'], '/api/applications' => ['GET', 'POST']];
    $isApplication = preg_match('~^/api/applications/([^/]+)$~', $path, $match) === 1;
    $allowed = $isApplication ? ['PATCH'] : ($routes[$path] ?? []);
    if (!$allowed) jsonResponse(['ok' => false, 'message' => 'Маршрут не найден.'], 404);
    if (!in_array($method, $allowed, true)) {
        header('Allow: ' . implode(', ', $allowed));
        jsonResponse(['ok' => false, 'message' => 'Метод не поддерживается.'], 405);
    }
    if ($path === '/api/health') {
        db()->query('SELECT 1');
        jsonResponse(['ok' => true, 'database' => 'connected']);
    }
    if ($path === '/api/news') {
        $limit = pagination('limit', 6, 1, 20);
        $rows = db()->query('SELECT id, title, link, description, `publishedAt`, `fetchedAt`, `createdAt`, source FROM news ORDER BY `publishedAt` DESC, id LIMIT ' . $limit)->fetchAll();
        header('Cache-Control: public, max-age=300, stale-while-revalidate=3600');
        jsonResponse(['ok' => true, 'news' => apiRows($rows)]);
    }
    if ($path === '/api/applications' && $method === 'POST') {
        $input = jsonInput();
        $hash = applicationIpHash();
        $pdo = db();
        limitApplications($pdo, $hash);
        [$data, $errors] = validateApplication($input);
        if ($errors) jsonResponse(['ok' => false, 'message' => 'Проверьте заполнение формы.', 'fields' => $errors], 400);
        $id = uuid();
        $stmt = $pdo->prepare('INSERT INTO applications
            (id, type, name, phone, `phoneNormalized`, model, vehicle, message, `branchId`, status, `managerId`, consent, `createdAt`, `updatedAt`, `ipHash`)
            VALUES (:id, :type, :name, :phone, :normalized, :model, :vehicle, :message, :branch, \'new\', NULL, TRUE, NOW(3), NOW(3), :hash)');
        $stmt->execute(['id' => $id, 'type' => $data['type'], 'name' => $data['name'], 'phone' => $data['phone'],
            'normalized' => preg_replace('/\D/', '', $data['phone']), 'model' => $data['model'] ?: null,
            'vehicle' => $data['vehicle'] ?: null, 'message' => $data['message'] ?: null, 'branch' => $data['branchId'], 'hash' => $hash]);
        jsonResponse(['ok' => true, 'applicationId' => $id], 201);
    }
    requireAdmin();
    if ($method === 'GET') {
        $limit = pagination('limit', 50, 1, 100);
        $offset = pagination('offset', 0, 0, 2147483647);
        $rows = db()->query('SELECT id, type, name, phone, model, vehicle, message, `branchId`, status, `managerId`, `createdAt`, `updatedAt` FROM applications ORDER BY `createdAt` DESC, id LIMIT ' . $limit . ' OFFSET ' . $offset)->fetchAll();
        jsonResponse(['ok' => true, 'applications' => apiRows($rows)]);
    }
    $input = jsonInput();
    if (!in_array($input['status'] ?? null, ['new', 'processing', 'completed', 'rejected'], true)) jsonResponse(['ok' => false, 'message' => 'Некорректный статус.'], 400);
    if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $match[1])) jsonResponse(['ok' => false, 'message' => 'Некорректный ID заявки.'], 400);
    $stmt = db()->prepare('UPDATE applications SET status = :status, `updatedAt` = NOW(3) WHERE id = :id');
    $stmt->execute(['status' => $input['status'], 'id' => strtolower($match[1])]);
    if (!$stmt->rowCount()) jsonResponse(['ok' => false, 'message' => 'Заявка не найдена.'], 404);
    jsonResponse(['ok' => true]);
} catch (Throwable $error) {
    error_log('[API] ' . get_class($error) . ' code=' . $error->getCode());
    jsonResponse(['ok' => false, 'message' => 'Внутренняя ошибка сервера.'], 500);
}
