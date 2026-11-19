<?php
// Frontline Spielstand-API (seit SP1 MySQL 8 per PDO, seit KO2 an Konten gebunden): beliebig viele Stände, je mit id (UUID, vom Client erzeugt).
// Zugang in api/config.php (nicht im Repo; der Deploy schreibt sie aus den Secrets DB_*). Die Tabelle legt sich selbst an.
// Gemeinsamer Code (CORS, JSON-Fehler, Datenbankzugang, Konten) liegt in api/lib/.
//
// Seit KO2 nur mit Anmeldung: jede Anfrage braucht das Sitzungs-Cookie fl_session (siehe api/auth.php). Ohne gültige Sitzung 401.
// Jeder Stand gehört einem Konto (Spalte user_id). Liste, Laden, Speichern, Umbenennen und Löschen sehen nur die eigenen Stände.
// Stände ohne user_id (vor KO2) bleiben unsichtbar.
//
//   GET  save.php             → {"saves": [meta, …]}            neueste zuerst, ohne data
//   GET  save.php?id=…        → {"meta": {…}, "data": "<base64 gzip>"}
//   POST save.php {"action":"save","meta":{…},"data":"<base64 gzip>"}  → legt an oder ersetzt (upsert nach id); createdAt bleibt
//   POST save.php {"action":"rename","id":"…","name":"…"}
//   POST save.php {"action":"delete","id":"…"}
// meta: id, name (1–60 Zeichen), version, format, createdAt, updatedAt (ms seit 1970), gameTime, points [blau, rot], winPoints,
//       difficulty, ended (bool), size (Bytes des gepackten Stands, vom Server gesetzt).
// Fehler: JSON {"error": "…"} mit HTTP-Code (400 Anfrage, 401 nicht angemeldet, 403 Stand gehört einem anderen Konto,
//         404 nicht gefunden, 413 zu groß, 500 Server/Datenbank).
// Das Spiel (phpexpert.de/frontline, gleiche Herkunft) schreibt; Browser anderer Seiten dürfen nicht schreiben.

require_once __DIR__ . '/lib/http.php';
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/konto.php';

const FL_MAX_BYTES = 4 * 1024 * 1024;  // gepackter Stand, normal < 1 MB
const FL_MAX_SAVES = 100;              // Stände je Konto (gegen Volllaufen der Datenbank)
const FL_UUID = '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i';
// Spalten der Liste (ohne data); Reihenfolge wie in meta_out()
const FL_META_COLS = 'id, name, version, format, created_at, updated_at, game_time, points_blue, points_red, win_points, difficulty, ended, size';

fl_cors('GET, POST, OPTIONS', true); // Cookies über die Herkunftsgrenze (localhost-Entwicklung)
fl_exception_handler('Serverfehler beim Spielstand');
fl_check_origin();

// Verbindung, Konten-Tabellen und Stände (Fehler der Datenbank gehen ins Protokoll, nicht an den Browser).
$pdo = fl_db(array_merge(FL_SCHEMA, [
    'CREATE TABLE IF NOT EXISTS saves (
            id CHAR(36) NOT NULL PRIMARY KEY,
            user_id BIGINT NULL,
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
            INDEX idx_updated (updated_at),
            INDEX idx_saves_user (user_id, updated_at)
        ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
]));
fl_saves_upgrade($pdo);

// Ohne gültige Sitzung kein Zugriff auf Stände.
$user = current_user($pdo);
if ($user === null) fail(401, 'Nicht angemeldet');
$uid = (int) $user['id'];

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

// Nachrüsten für Tabellen aus SP3 (ohne Konten): Spalte user_id und Index, nur wenn sie fehlen (idempotent).
// Die Abfragen gehen über information_schema (MySQL 8 und MariaDB).
function fl_saves_upgrade(PDO $pdo) {
    $has = function ($sql, $param) use ($pdo) {
        $st = $pdo->prepare($sql);
        $st->execute([':n' => $param]);
        return (int) $st->fetchColumn() > 0;
    };
    if (!$has("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'saves' AND COLUMN_NAME = :n", 'user_id')) {
        fl_saves_alter($pdo, 'ALTER TABLE saves ADD COLUMN user_id BIGINT NULL');
    }
    if (!$has("SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'saves' AND INDEX_NAME = :n", 'idx_saves_user')) {
        fl_saves_alter($pdo, 'ALTER TABLE saves ADD INDEX idx_saves_user (user_id, updated_at)');
    }
}

function fl_saves_alter(PDO $pdo, $sql) {
    try {
        $pdo->exec($sql);
    } catch (PDOException $e) {
        // 1060 Spalte und 1061 Index gibt es schon (zwei Anfragen gleichzeitig): dann ist alles in Ordnung
        if (!in_array((int) ($e->errorInfo[1] ?? 0), [1060, 1061], true)) throw $e;
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (isset($_GET['id'])) {
        $id = check_id($_GET['id']);
        $st = $pdo->prepare('SELECT ' . FL_META_COLS . ', data FROM saves WHERE id = :id AND user_id = :u');
        $st->execute([':id' => $id, ':u' => $uid]);
        $row = $st->fetch(PDO::FETCH_ASSOC);
        if (!$row) fail(404, 'Stand nicht gefunden');
        out(['meta' => meta_out($row), 'data' => base64_encode($row['data'])]);
    }
    $st = $pdo->prepare('SELECT ' . FL_META_COLS . ' FROM saves WHERE user_id = :u ORDER BY updated_at DESC');
    $st->execute([':u' => $uid]);
    $list = [];
    foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $row) $list[] = meta_out($row);
    out(['saves' => $list]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail(405, 'Methode nicht erlaubt');

$body = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($body) || !isset($body['action']) || !is_string($body['action'])) fail(400, 'Ungültige Anfrage');

if ($body['action'] === 'delete') {
    // Fremde oder unbekannte id: nichts gelöscht, keine Fehlermeldung (idempotent, wie bisher).
    $st = $pdo->prepare('DELETE FROM saves WHERE id = :id AND user_id = :u');
    $st->execute([':id' => check_id(isset($body['id']) ? $body['id'] : null), ':u' => $uid]);
    out(['ok' => true, 'deleted' => $st->rowCount()]);
}

if ($body['action'] === 'rename') {
    $id = check_id(isset($body['id']) ? $body['id'] : null);
    $name = check_name(isset($body['name']) ? $body['name'] : null);
    $st = $pdo->prepare('UPDATE saves SET name = :name WHERE id = :id AND user_id = :u');
    $st->execute([':name' => $name, ':id' => $id, ':u' => $uid]);
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

$format = (int) need_num($meta, 'format');
$createdAt = (int) need_num($meta, 'createdAt');
$updatedAt = (int) need_num($meta, 'updatedAt');
$gameTime = (float) need_num($meta, 'gameTime');
$winPoints = (int) need_num($meta, 'winPoints');
$ended = !empty($meta['ended']) ? 1 : 0;
$size = strlen($bytes);

// Upsert nach id, im Abgleich mit dem Konto: gehört die id einem anderen Konto (oder keinem), wird nichts überschrieben (403).
// Die Zeile wird mit FOR UPDATE gesperrt, damit zwei gleichzeitige Anfragen nicht aneinander vorbeikommen.
// created_at wird nur beim ersten Speichern gesetzt und danach nicht mehr geändert.
$pdo->beginTransaction();
$st = $pdo->prepare('SELECT user_id FROM saves WHERE id = :id FOR UPDATE');
$st->execute([':id' => $id]);
$owner = $st->fetch(PDO::FETCH_ASSOC);
$foreign = $owner !== false && ($owner['user_id'] === null || (int) $owner['user_id'] !== $uid);
if ($foreign) {
    $pdo->rollBack();
    fail(403, 'Dieser Stand gehört nicht zu diesem Konto');
}
try {
    if ($owner === false) {
        $st = $pdo->prepare('SELECT COUNT(*) FROM saves WHERE user_id = :u');
        $st->execute([':u' => $uid]);
        if ((int) $st->fetchColumn() >= FL_MAX_SAVES) {
            $pdo->rollBack();
            fail(413, 'Zu viele Spielstände auf dem Server (höchstens ' . FL_MAX_SAVES . '). Bitte alte Stände löschen.');
        }
        $st = $pdo->prepare(
            'INSERT INTO saves (id, user_id, name, version, format, created_at, updated_at, game_time, points_blue, points_red,
                                win_points, difficulty, ended, size, data)
             VALUES (:id, :u, :name, :version, :format, :created_at, :updated_at, :game_time, :pb, :pr,
                     :win_points, :difficulty, :ended, :size, :data)'
        );
        $st->bindValue(':created_at', $createdAt, PDO::PARAM_INT);
    } else {
        $st = $pdo->prepare(
            'UPDATE saves SET name = :name, version = :version, format = :format, updated_at = :updated_at,
                              game_time = :game_time, points_blue = :pb, points_red = :pr, win_points = :win_points,
                              difficulty = :difficulty, ended = :ended, size = :size, data = :data
             WHERE id = :id AND user_id = :u'
        );
    }
    $st->bindValue(':id', $id);
    $st->bindValue(':u', $uid, PDO::PARAM_INT);
    $st->bindValue(':name', $name);
    $st->bindValue(':version', $version);
    $st->bindValue(':format', $format, PDO::PARAM_INT);
    $st->bindValue(':updated_at', $updatedAt, PDO::PARAM_INT);
    $st->bindValue(':game_time', $gameTime);
    $st->bindValue(':pb', $points[0], PDO::PARAM_INT);
    $st->bindValue(':pr', $points[1], PDO::PARAM_INT);
    $st->bindValue(':win_points', $winPoints, PDO::PARAM_INT);
    $st->bindValue(':difficulty', $difficulty);
    $st->bindValue(':ended', $ended, PDO::PARAM_INT);
    $st->bindValue(':size', $size, PDO::PARAM_INT);
    $st->bindValue(':data', $bytes, PDO::PARAM_LOB);
    $st->execute();
    $pdo->commit();
} catch (PDOException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    if ($e->getCode() === '23000') fail(403, 'Dieser Stand gehört nicht zu diesem Konto'); // gleichzeitig von anderem Konto angelegt
    throw $e;
}

// Den gespeicherten Stand zurückgeben (mit dem tatsächlichen createdAt).
$st = $pdo->prepare('SELECT ' . FL_META_COLS . ' FROM saves WHERE id = :id AND user_id = :u');
$st->execute([':id' => $id, ':u' => $uid]);
out(['ok' => true, 'meta' => meta_out($st->fetch(PDO::FETCH_ASSOC))]);
