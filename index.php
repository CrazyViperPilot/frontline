<?php
// Einstieg des Spiels auf dem Webspace (phpexpert.de/frontline/, .htaccess: DirectoryIndex index.php): zählt den Seitenaufruf
// für die Besucherstatistik (docs/prd/statistik.md) und liefert dann die Spiel-Shell index.html unverändert aus.
// Gezählt wird nur ein echter Seitenaufruf (Sec-Fetch-Dest document bzw. ohne diese Kopfzeile), kein Vorabladen, keine Bots,
// nicht das Vorladen des Service Workers. Ohne Datenbank oder bei jedem Fehler läuft das Spiel trotzdem: die Zählung fällt weg.
// Lokal (python3 -m http.server) wird index.html direkt geladen; dort zählt nichts.

$fl_count = function () {
    // Seite selbst (Ziel document), nicht das Vorladen des Service Workers (Ziel empty); alte Browser ohne Kopfzeile zählen
    $dest = isset($_SERVER['HTTP_SEC_FETCH_DEST']) ? $_SERVER['HTTP_SEC_FETCH_DEST'] : 'document';
    $purpose = (isset($_SERVER['HTTP_SEC_PURPOSE']) ? $_SERVER['HTTP_SEC_PURPOSE'] : '') . (isset($_SERVER['HTTP_PURPOSE']) ? $_SERVER['HTTP_PURPOSE'] : '');
    if ($dest !== 'document' || stripos($purpose, 'prefetch') !== false) return;
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') return;
    require_once __DIR__ . '/api/lib/db.php';
    require_once __DIR__ . '/api/lib/track.php';
    $pdo = track_db(true);
    if ($pdo === null) return;
    $who = track_who($pdo);
    if ($who === null || !track_allow($pdo, $who['visitor'], 1)) return;
    track_store($pdo, $who, ['version' => null, 'sid' => null, 'pid' => null, 'page' => 'game',
        'events' => [['kind' => 'view', 'age' => 0, 'gid' => null, 'data' => []]]]);
};
try {
    $fl_count();
} catch (Throwable $e) {
    error_log('frontline index.php: ' . $e->getMessage());
}

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-cache');
readfile(__DIR__ . '/index.html');
