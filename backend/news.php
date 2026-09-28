<?php
declare(strict_types=1);

function newsText(string $value): string
{
    return trim(preg_replace('/\s+/u', ' ', html_entity_decode(strip_tags($value), ENT_QUOTES | ENT_HTML5, 'UTF-8')));
}

function parseNews(string $xml): array
{
    if (stripos($xml, '<!DOCTYPE') !== false || stripos($xml, '<!ENTITY') !== false) throw new RuntimeException('RSS entities are not allowed.');
    $previous = libxml_use_internal_errors(true);
    try {
        $feed = simplexml_load_string($xml, SimpleXMLElement::class, LIBXML_NONET | LIBXML_NOCDATA);
        if ($feed === false) throw new RuntimeException('Invalid RSS XML.');
        $items = $feed->xpath('/*[local-name()="rss"]/*[local-name()="channel"]/*[local-name()="item"] | /*[local-name()="feed"]/*[local-name()="entry"]');
        $result = [];
        foreach ($items as $item) {
            $get = static function (string $name) use ($item): string {
                $nodes = $item->xpath('./*[local-name()="' . $name . '"]');
                return isset($nodes[0]) ? (string) $nodes[0] : '';
            };
            $link = '';
            foreach ($item->xpath('./*[local-name()="link"]') as $node) {
                if (isset($node['href'])) {
                    if ((string) $node['rel'] !== '' && (string) $node['rel'] !== 'alternate') continue;
                    $link = (string) $node['href'];
                } else $link = (string) $node;
                if ($link !== '') break;
            }
            $title = newsText($get('title'));
            $guid = $get('guid') ?: $link;
            $date = $get('pubDate') ?: ($get('published') ?: $get('updated'));
            if ($title === '' || $guid === '' || !filter_var($link, FILTER_VALIDATE_URL) || !in_array(strtolower(parse_url($link, PHP_URL_SCHEME) ?? ''), ['http', 'https'], true) || $date === '') continue;
            try { $published = new DateTimeImmutable($date); } catch (Exception $error) { continue; }
            $result[] = ['key' => $guid, 'title' => $title, 'link' => $link,
                'description' => mb_substr(newsText($get('description') ?: ($get('summary') ?: $get('content'))), 0, 500, 'UTF-8'),
                'published' => $published->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s.v')];
        }
        return $result;
    } finally {
        libxml_clear_errors();
        libxml_use_internal_errors($previous);
    }
}

function refreshNews(PDO $pdo): int
{
    $curl = curl_init(env('KAMAZ_RSS_URL', 'http://www.kamaz.ru/press/releases/rss/'));
    $xml = '';
    curl_setopt_array($curl, [CURLOPT_FOLLOWLOCATION => true, CURLOPT_MAXREDIRS => 5,
        CURLOPT_TIMEOUT => 15, CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
        CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
        CURLOPT_USERAGENT => 'Eland-KAMAZ-Dealer-News/1.0',
        CURLOPT_WRITEFUNCTION => static function ($handle, string $chunk) use (&$xml): int {
            if (strlen($xml) + strlen($chunk) > 5 * 1024 * 1024) return 0;
            $xml .= $chunk;
            return strlen($chunk);
        },
    ]);
    if (PHP_OS_FAMILY === 'Windows' && defined('CURLSSLOPT_NATIVE_CA')) {
        curl_setopt($curl, CURLOPT_SSL_OPTIONS, CURLSSLOPT_NATIVE_CA);
    }
    $ok = curl_exec($curl);
    $status = curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $error = curl_error($curl);
    curl_close($curl);
    if ($ok === false || $status < 200 || $status >= 300) throw new RuntimeException('RSS download failed, HTTP ' . $status . ($error !== '' ? ': ' . $error : ''));
    return storeNews($pdo, parseNews($xml));
}

function storeNews(PDO $pdo, array $items): int
{
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('INSERT INTO news (id, `rssKey`, `rssKeyHash`, title, link, description, `publishedAt`, `fetchedAt`, `createdAt`, source)
            VALUES (:id, :key, :keyHash, :title, :link, :description, :published, NOW(3), NOW(3), :source)
            ON DUPLICATE KEY UPDATE title = :newTitle, link = :newLink,
            description = :newDescription, `publishedAt` = :newPublished, `fetchedAt` = NOW(3), source = :newSource');
        foreach ($items as $item) $stmt->execute(['id' => uuid(), 'source' => 'ПАО «КАМАЗ»',
            'keyHash' => hash('sha256', $item['key']), 'newTitle' => $item['title'], 'newLink' => $item['link'],
            'newDescription' => $item['description'], 'newPublished' => $item['published'], 'newSource' => 'ПАО «КАМАЗ»'] + $item);
        $pdo->commit();
    } catch (Throwable $error) {
        $pdo->rollBack();
        throw $error;
    }
    return count($items);
}
