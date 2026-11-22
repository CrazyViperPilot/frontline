<?php
// Besucherstatistik (Regeln: docs/prd/statistik.md): nimmt Ereignisse und Rückmeldungen aus js/ui/telemetry.js an.
// Anfrage immer POST mit JSON (Content-Type egal, auch navigator.sendBeacon mit text/plain):
//   {"e":[{k,a,g?,d?}],"v":"v5.…","s":sid,"p":pid|null,"pg":"game"|"editor"}  → 204 (immer, auch bei Drossel oder Bot)
//   {"action":"feedback","text":"…","thumb":1|-1|null,"v","dur","mode","place","p"} → {"ok":true} bzw. 400/429
//   {"action":"link","p":pid}     → {"pid":"…"}: Spieler-ID am angemeldeten Konto (nur mit Einwilligung; Sitzung aus fl_session)
//   {"action":"optout","p":pid}   → 204: Widerruf, alles zur Spieler-ID wird gelöscht
// Grenzen: FL_TRACK_BODY_MAX Byte je Anfrage (413), FL_TRACK_BATCH_MAX Ereignisse, FL_TRACK_DAY_MAX je Tages-Hash und Tag.
// Die IP geht nur in den Tages-Hash ein (api/lib/track.php) und wird nie gespeichert.

require_once __DIR__ . '/lib/http.php';
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/track.php';

fl_cors('POST, OPTIONS', true);
fl_exception_handler('Serverfehler der Statistik');
fl_check_origin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail(405, 'Methode nicht erlaubt');
$len = isset($_SERVER['CONTENT_LENGTH']) ? (int) $_SERVER['CONTENT_LENGTH'] : 0;
if ($len > FL_TRACK_BODY_MAX) fail(413, 'Anfrage zu groß');
$raw = (string) file_get_contents('php://input', false, null, 0, FL_TRACK_BODY_MAX + 1);
if (strlen($raw) > FL_TRACK_BODY_MAX) fail(413, 'Anfrage zu groß');
$body = json_decode($raw, true);
if (!is_array($body)) fail(400, 'Ungültige Anfrage');

$action = isset($body['action']) && is_string($body['action']) ? $body['action'] : 'events';
$pdo = track_db();
$who = track_who($pdo);

switch ($action) {
    case 'events':
        $batch = track_clean_batch($body);
        if ($batch === null) fail(400, 'Ungültige Anfrage');
        if ($who !== null && $batch['events'] && track_allow($pdo, $who['visitor'], count($batch['events']))) {
            track_store($pdo, $who, $batch);
        }
        http_response_code(204);
        exit;
    case 'feedback':
        if ($who === null) fail(403, 'Nicht erlaubt');
        $fb = track_clean_feedback($body);
        if ($fb === null) fail(400, 'Bitte einen Text schreiben oder einen Daumen wählen.');
        // Eigener Zähler für Rückmeldungen: Tages-Hash mit Vorsilbe „fb“ (gleiche Länge, eigene Zeile in tr_limits)
        if (!track_allow($pdo, 'fb' . substr($who['visitor'], 2), 1, FL_TRACK_FEEDBACK_DAY)) {
            fail(429, 'Heute sind schon genug Rückmeldungen angekommen. Danke!');
        }
        $pdo->prepare('INSERT INTO tr_feedback (created_at, text, thumb, version, duration, mode, place, pid, device, browser)
            VALUES (:t, :x, :th, :v, :d, :m, :pl, :p, :dev, :br)')->execute([
            ':t' => time(), ':x' => $fb['text'], ':th' => $fb['thumb'], ':v' => $fb['version'], ':d' => $fb['duration'],
            ':m' => $fb['mode'], ':pl' => $fb['place'], ':p' => $fb['pid'], ':dev' => $who['device'], ':br' => $who['browser'],
        ]);
        out(['ok' => true]);
    case 'link':
        track_link($pdo, $body);
    case 'optout':
        track_forget($pdo, $body['p'] ?? null);
        http_response_code(204);
        exit;
    default:
        fail(400, 'Unbekannte Aktion');
}

// Spieler-ID ans Konto hängen (nur mit Einwilligung, die der Browser mit p belegt): Hat das Konto schon eine, gilt die
// (über Geräte hinweg dieselbe), sonst wird p gespeichert. Ohne Sitzung 401. Antwort {pid}.
function track_link(PDO $pdo, array $body) {
    require_once __DIR__ . '/lib/konto.php';
    $pid = track_pid($body['p'] ?? null);
    if ($pid === null) fail(400, 'Ungültige Spieler-ID');
    foreach (FL_SCHEMA as $sql) $pdo->exec($sql); // Konten-Tabellen (idempotent), dann Spalte users.stat_id
    $user = current_user($pdo);
    if ($user === null) fail(401, 'Nicht angemeldet');
    $have = isset($user['stat_id']) ? track_pid($user['stat_id']) : null;
    if ($have !== null) out(['pid' => $have]);
    $pdo->prepare('UPDATE users SET stat_id = :p WHERE id = :id AND stat_id IS NULL')->execute([':p' => $pid, ':id' => (int) $user['id']]);
    $st = $pdo->prepare('SELECT stat_id FROM users WHERE id = :id');
    $st->execute([':id' => (int) $user['id']]);
    out(['pid' => track_pid($st->fetchColumn()) ?? $pid]);
}
