<?php
// Frontline Spielstand-API (seit SP1 MySQL 8 per PDO): beliebig viele Stände, je mit id (UUID, vom Client erzeugt).
// Zugang in api/config.php (nicht im Repo; der Deploy schreibt sie aus den Secrets DB_*). Die Tabelle legt sich selbst an.
// Gemeinsamer Code (CORS, JSON-Fehler, Datenbankzugang) liegt in api/lib/.
//
//   GET  save.php             → {"saves": [meta, …]}            neueste zuerst, ohne data
//   GET  save.php?id=…        → {"meta": {…}, "data": "<base64 gzip>"}
//   POST save.php {"action":"save","meta":{…},"data":"<base64 gzip>"}  → legt an oder ersetzt (upsert nach id); createdAt bleibt
//   POST save.php {"action":"rename","id":"…","name":"…"}
//   POST save.php {"action":"delete","id":"…"}
// meta: id, name (1–60 Zeichen), version, format, createdAt, updatedAt (ms seit 1970), gameTime, points [blau, rot], winPoints,
//       difficulty, ended (bool), size (Bytes des gepackten Stands, vom Server gesetzt).
// Fehler: JSON {"error": "…"} mit HTTP-Code (400 Anfrage, 404 nicht gefunden, 413 zu groß, 500 Server/Datenbank).
// Das Spiel (frontline.phpexpert.de, gleiche Herkunft) schreibt; Browser anderer Seiten dürfen nicht schreiben.

require_once __DIR__ . '/lib/http.php';
require_once __DIR__ . '/lib/db.php';

const FL_MAX_BYTES = 12 * 1024 * 1024; // gepackter Stand, normal < 1 MB
const FL_UUID = '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i';
// Spalten der Liste (ohne data); Reihenfolge wie in meta_out()
const FL_META_COLS = 'id, name, version, format, created_at, updated_at, game_time, points_blue, points_red, win_points, difficulty, ended, size';

fl_cors();
fl_exception_handler('Serverfehler beim Spielstand');
fl_check_origin();

// Verbindung und Tabelle (Fehler der Datenbank gehen ins Protokoll, nicht an den Browser).
$pdo = fl_db([
    'CREATE TABLE IF NOT EXISTS saves (
            id CHAR(36) NOT NULL PRIMARY KEY,
            name VARCHAR(60) NOT NULL,
            version VARCHAR(16) NOT NULL,
            format INT NOT NULL,
            created_at BIGINT NOT NULL,
            updated_at BIGINT NOT NULL,
            game_time DOUBLE NOT NULL,
            points_blue INT NOT NULL,
            points_red INT NOT NULL,
            win_points INT NOT NULL,
            difficulty VARCHAR(16) NOT NULL,
            ended TINYINT NOT NULL DEFAULT 0,
            size INT NOT NULL,
            data MEDIUMBLOB NOT NULL,
            INDEX idx_updated (updated_at)
        ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
]);

// Eine Zeile der Liste als Meta-Objekt (camelCase, wie der Client sie schickt).
function meta_out(array $r) {
    return [
        'id' => $r['id'], 'name' => $r['name'], 'version' => $r['version'], 'format' => (int) $r['format'],
        'createdAt' => (int) $r['created_at'], 'updatedAt' => (int) $r['updated_at'], 'gameTime' => (float) $r['game_time'],
        'points' => [(int) $r['points_blue'], (int) $r['points_red']], 'winPoints' => (int) $r['win_points'],
        'difficulty' => $r['difficulty'], 'ended' => (bool) $r['ended'], 'size' => (int) $r['size'],
    ];
}

function check_id($id) {
    if (!is_string($id) || !preg_match(FL_UUID, $id)) fail(400, 'id ungültig (UUID erwartet)');
    return strtolower($id);
}

function check_name($name) {
    if (!is_string($name) || !mb_check_encoding($name, 'UTF-8')) fail(400, 'name ungültig');
    $name = trim($name);
    $len = mb_strlen($name, 'UTF-8');
    if ($len < 1 || $len > 60) fail(400, 'name muss 1 bis 60 Zeichen haben');
    return $name;
}

function need_num($m, $k) {
    if (!isset($m[$k]) || !is_numeric($m[$k])) fail(400, "meta.$k fehlt oder ist keine Zahl");
    return $m[$k] + 0;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (isset($_GET['id'])) {
        $id = check_id($_GET['id']);
        $st = $pdo->prepare('SELECT ' . FL_META_COLS . ', data FROM saves WHERE id = :id');
        $st->execute([':id' => $id]);
        $row = $st->fetch(PDO::FETCH_ASSOC);
        if (!$row) fail(404, 'Stand nicht gefunden');
        out(['meta' => meta_out($row), 'data' => base64_encode($row['data'])]);
    }
    $st = $pdo->query('SELECT ' . FL_META_COLS . ' FROM saves ORDER BY updated_at DESC');
    $list = [];
    foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $row) $list[] = meta_out($row);
    out(['saves' => $list]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail(405, 'Methode nicht erlaubt');

$body = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($body) || !isset($body['action']) || !is_string($body['action'])) fail(400, 'Ungültige Anfrage');

if ($body['action'] === 'delete') {
    $st = $pdo->prepare('DELETE FROM saves WHERE id = :id');
    $st->execute([':id' => check_id(isset($body['id']) ? $body['id'] : null)]);
    out(['ok' => true, 'deleted' => $st->rowCount()]);
}

if ($body['action'] === 'rename') {
    $id = check_id(isset($body['id']) ? $body['id'] : null);
    $name = check_name(isset($body['name']) ? $body['name'] : null);
    $st = $pdo->prepare('UPDATE saves SET name = :name WHERE id = :id');
    $st->execute([':name' => $name, ':id' => $id]);
    if ($st->rowCount() === 0) fail(404, 'Stand nicht gefunden');
    out(['ok' => true, 'id' => $id, 'name' => $name]);
}

if ($body['action'] !== 'save') fail(400, 'Unbekannte Aktion');

$meta = isset($body['meta']) ? $body['meta'] : null;
$data = isset($body['data']) ? $body['data'] : null;
if (!is_array($meta) || !is_string($data)) fail(400, 'meta oder data fehlt');

$id = check_id(isset($meta['id']) ? $meta['id'] : null);
$name = check_name(isset($meta['name']) ? $meta['name'] : null);
$version = isset($meta['version']) ? $meta['version'] : null;
if (!is_string($version) || $version === '' || strlen($version) > 16) fail(400, 'meta.version ungültig (1 bis 16 Zeichen)');
$difficulty = isset($meta['difficulty']) && is_string($meta['difficulty']) ? substr($meta['difficulty'], 0, 16) : 'normal';
if (!isset($meta['points']) || !is_array($meta['points']) || count($meta['points']) !== 2) fail(400, 'meta.points fehlt');
$points = [(int) need_num($meta['points'], 0), (int) need_num($meta['points'], 1)];

$bytes = base64_decode($data, true);
if ($bytes === false || strlen($bytes) < 20 || strlen($bytes) > FL_MAX_BYTES) fail(413, 'Stand ungültig oder zu groß');
if (substr($bytes, 0, 2) !== "\x1f\x8b") fail(400, 'Stand ist nicht gepackt (gzip)');

// Upsert nach id. created_at fehlt in der Update-Liste: beim ersten Speichern gesetzt, danach unverändert.
$st = $pdo->prepare(
    'INSERT INTO saves (id, name, version, format, created_at, updated_at, game_time, points_blue, points_red, win_points,
                        difficulty, ended, size, data)
     VALUES (:id, :name, :version, :format, :created_at, :updated_at, :game_time, :pb, :pr, :win_points,
             :difficulty, :ended, :size, :data)
     ON DUPLICATE KEY UPDATE
        name = VALUES(name), version = VALUES(version), format = VALUES(format), updated_at = VALUES(updated_at),
        game_time = VALUES(game_time), points_blue = VALUES(points_blue), points_red = VALUES(points_red),
        win_points = VALUES(win_points), difficulty = VALUES(difficulty), ended = VALUES(ended),
        size = VALUES(size), data = VALUES(data)'
);
$st->bindValue(':id', $id);
$st->bindValue(':name', $name);
$st->bindValue(':version', $version);
$st->bindValue(':format', (int) need_num($meta, 'format'), PDO::PARAM_INT);
$st->bindValue(':created_at', (int) need_num($meta, 'createdAt'), PDO::PARAM_INT);
$st->bindValue(':updated_at', (int) need_num($meta, 'updatedAt'), PDO::PARAM_INT);
$st->bindValue(':game_time', (float) need_num($meta, 'gameTime'));
$st->bindValue(':pb', $points[0], PDO::PARAM_INT);
$st->bindValue(':pr', $points[1], PDO::PARAM_INT);
$st->bindValue(':win_points', (int) need_num($meta, 'winPoints'), PDO::PARAM_INT);
$st->bindValue(':difficulty', $difficulty);
$st->bindValue(':ended', !empty($meta['ended']) ? 1 : 0, PDO::PARAM_INT);
$st->bindValue(':size', strlen($bytes), PDO::PARAM_INT);
$st->bindValue(':data', $bytes, PDO::PARAM_LOB);
$st->execute();

// Den gespeicherten Stand zurückgeben (mit dem tatsächlichen createdAt).
$st = $pdo->prepare('SELECT ' . FL_META_COLS . ' FROM saves WHERE id = :id');
$st->execute([':id' => $id]);
out(['ok' => true, 'meta' => meta_out($st->fetch(PDO::FETCH_ASSOC))]);
