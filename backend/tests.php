<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
require __DIR__ . '/applications.php';
require __DIR__ . '/news.php';
function check(bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
}
$base = ['type' => 'callback', 'name' => 'Иван', 'phone' => '+7 (999) 123-45-67', 'consent' => true];
check(validateApplication($base)[1] === [], 'Valid Cyrillic application');
foreach (['question', 'callback', 'test_drive', 'service', 'commercial_offer'] as $type) {
    check(validateApplication(array_replace($base, ['type' => $type, 'model' => 'КАМАЗ', 'vehicle' => 'VIN']))[1] === [], $type);
}
foreach ([['consent' => 'true'], ['website' => 'spam'], ['phone' => '123'], ['name' => []], ['branchId' => []], ['branchId' => 1.5], ['branchId' => 3], ['type' => 'service'], ['type' => 'test_drive'], ['type' => 'commercial_offer']] as $invalid) {
    check(validateApplication(array_replace($base, $invalid))[1] !== [], 'Invalid form rejected: ' . json_encode($invalid));
}
check(validateApplication(array_replace($base, ['name' => str_repeat('Я', 100)]))[1] === [], 'Unicode length');
$rss = '<rss><channel><item><title><![CDATA[Новость &amp; КАМАЗ]]></title><link>https://example.com/news</link><guid>one</guid><description><![CDATA[<p>Текст</p>]]></description><pubDate>Fri, 25 Sep 2026 12:00:00 +0300</pubDate></item></channel></rss>';
$items = parseNews($rss);
check(count($items) === 1 && $items[0]['title'] === 'Новость & КАМАЗ' && $items[0]['description'] === 'Текст', 'RSS CDATA');
$atom = '<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Atom</title><link rel="self" href="https://example.com/feed"/><link href="https://example.com/article"/><updated>2026-09-25T12:00:00Z</updated><summary>Text</summary></entry></feed>';
check(parseNews($atom)[0]['link'] === 'https://example.com/article', 'Namespaced Atom alternate link');
check(parseNews(str_replace('https://example.com/news', 'javascript:alert(1)', $rss)) === [], 'Unsafe link rejected');
try { parseNews('<!DOCTYPE rss [<!ENTITY x SYSTEM "file:///etc/passwd">]><rss/>'); throw new LogicException('XXE accepted'); } catch (RuntimeException $error) { }
check(preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/', uuid()) === 1, 'UUID v4');
echo "Validation, RSS/Atom, XXE and UUID tests passed.\n";
