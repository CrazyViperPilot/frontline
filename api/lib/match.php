<?php
// Signierter Match-Start (MS1, Regeln: docs/prd/konto.md „Signierter Match-Start“). Gemeinsam für api/match.php: Tabellen,
// Geheimnis des Servers (Tabelle meta, nicht in config.php), Signatur der Tokens. Nur per require_once aus api/*.php geladen.
//
// Ein Token ist „<base64url(JSON)>.<hex HMAC-SHA256 über den ersten Teil>“ mit der Nutzlast {uid, jti, iat, w0}: w0 ist die
// Kasse des Kontos zum Ausgabezeitpunkt. Die Datenbank (match_tokens) hält je Token, ob es schon gewertet ist.

// Tabellen des Match-Starts (legen sich selbst an, idempotent, wie FL_SCHEMA in konto.php).
// matches (seit v5.158): je gewerteter Partie eine Zeile für die Spielstatistik (Profil und Admin-Übersicht, docs/prd/konto.md).
// Eine Zeile entsteht nur bei finish, in derselben Transaktion wie die Kasse. jti ist eindeutig: eine Partie zählt nur einmal.
const FL_MATCH_SCHEMA = [
    'CREATE TABLE IF NOT EXISTS meta (
            k VARCHAR(32) NOT NULL PRIMARY KEY,
            v TEXT NOT NULL
        ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
    'CREATE TABLE IF NOT EXISTS match_tokens (
            jti CHAR(32) NOT NULL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            w0 BIGINT NOT NULL,
            issued_at BIGINT NOT NULL,
            used_at BIGINT NULL,
            INDEX idx_match_user (user_id)
        ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
    'CREATE TABLE IF NOT EXISTS matches (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            user_id BIGINT NOT NULL,
            jti CHAR(32) NOT NULL,
            started_at BIGINT NOT NULL,
            finished_at BIGINT NOT NULL,
            wallet_before BIGINT NOT NULL,
            wallet_after BIGINT NOT NULL,
            earned BIGINT NOT NULL,
            result VARCHAR(8) NULL,
            duration INT NULL,
            difficulty VARCHAR(8) NULL,
            seed BIGINT NULL,
            points_own INT NULL,
            points_enemy INT NULL,
            kills INT NULL,
            UNIQUE KEY uq_matches_jti (jti),
            INDEX idx_matches_user (user_id, finished_at),
            INDEX idx_matches_finished (finished_at)
        ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
];

const FL_MATCH_TOKENS = 3;     // Tokens auf Vorrat je Konto (gültig mit der aktuellen Kasse)
const FL_MATCH_TOKEN_DAYS = 7; // Ein Token gilt so lange ab Ausgabe; danach wird es aus der Tabelle gelöscht
const FL_MATCH_RECENT = 50;    // Partien in der Liste der Spielstatistik (action stats)
const FL_MATCH_SECONDS_MAX = 86400; // Obergrenze der Spielzeit einer Partie in Sekunden (Partie-Info, nur zur Anzeige)

// Partie-Infos, die der Client bei finish mitschickt (Feld game, nur zur Statistik): nur bekannte Felder, Typ und Bereich
// geprüft. Ungültige oder fehlende Werte werden null, nie ein Fehler: der Endstand (die Kasse) zählt trotzdem.
// Liefert ein Array mit den Schlüsseln result, duration, difficulty, seed, points_own, points_enemy, kills.
function match_game_info($body) {
    $g = isset($body['game']) && is_array($body['game']) ? $body['game'] : [];
    $whole = function ($v) { // Ganze Zahl; eine endliche Dezimalzahl (Spielzeit in Sekunden) wird gerundet
        if (is_float($v) && is_finite($v)) return (int) round($v);
        return is_int($v) ? $v : null;
    };
    $int = function ($key, $min, $max) use ($g, $whole) {
        $v = $whole($g[$key] ?? null);
        return $v !== null && $v >= $min && $v <= $max ? $v : null;
    };
    $points = isset($g['points']) && is_array($g['points']) && count($g['points']) === 2 ? $g['points'] : [null, null];
    $pts = function ($v) use ($whole) {
        $v = $whole($v);
        return $v !== null && $v >= 0 && $v <= 100000 ? $v : null;
    };
    $result = $g['result'] ?? null;
    $difficulty = $g['difficulty'] ?? null;
    return [
        'result' => in_array($result, ['win', 'loss'], true) ? $result : null,
        'duration' => $int('duration', 0, FL_MATCH_SECONDS_MAX),
        'difficulty' => in_array($difficulty, ['easy', 'normal', 'hard'], true) ? $difficulty : null,
        'seed' => $int('seed', 0, 9007199254740991),
        'points_own' => $pts($points[0]),
        'points_enemy' => $pts($points[1]),
        'kills' => $int('kills', 0, 1000000),
    ];
}

// Geheimnis des Servers: liegt in der Tabelle meta (Schlüssel match_secret), wird beim ersten Bedarf zufällig erzeugt und
// dann wiederverwendet. Übersteht Deploys, weil es nicht in der Quelle und nicht in config.php steht.
function fl_secret(PDO $pdo) {
    static $secret = null;
    if ($secret !== null) return $secret;
    $st = $pdo->prepare("SELECT v FROM meta WHERE k = 'match_secret'");
    $st->execute();
    $v = $st->fetchColumn();
    if ($v === false) {
        // INSERT IGNORE: lief eine gleichzeitige Anfrage schneller, gilt deren Wert (danach wird neu gelesen).
        $pdo->prepare("INSERT IGNORE INTO meta (k, v) VALUES ('match_secret', :v)")->execute([':v' => bin2hex(random_bytes(32))]);
        $st->execute();
        $v = $st->fetchColumn();
    }
    if (!is_string($v) || strlen($v) < 32) fail(500, 'Serverfehler beim Match-Start');
    $secret = $v;
    return $secret;
}

// Token aus der Nutzlast (Array) und dem Geheimnis.
function fl_sign(array $payload, $secret) {
    $body = fl_b64url_encode(json_encode($payload, JSON_UNESCAPED_SLASHES));
    return $body . '.' . hash_hmac('sha256', $body, $secret);
}

// Nutzlast eines Tokens, wenn Format und Signatur stimmen; sonst null. Die Signatur wird vor dem Dekodieren geprüft.
function fl_verify($token, $secret) {
    if (!is_string($token) || strlen($token) > 512) return null;
    $dot = strrpos($token, '.');
    if ($dot === false) return null;
    $body = substr($token, 0, $dot);
    $sig = substr($token, $dot + 1);
    if (!hash_equals(hash_hmac('sha256', $body, $secret), $sig)) return null;
    $json = fl_b64url_decode($body);
    if ($json === false) return null;
    $payload = json_decode($json, true);
    return is_array($payload) && fl_payload_ok($payload) ? $payload : null;
}

// Felder der Nutzlast nach Typ und Format prüfen (die Signatur allein genügt nicht, wenn sich ein Feld ändern ließe).
function fl_payload_ok(array $p) {
    return isset($p['uid'], $p['jti'], $p['iat'], $p['w0'])
        && is_int($p['uid']) && is_int($p['iat']) && is_int($p['w0'])
        && is_string($p['jti']) && preg_match('/^[0-9a-f]{32}$/', $p['jti']) === 1;
}

function fl_b64url_encode($raw) {
    return rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
}

function fl_b64url_decode($s) {
    $b = strtr($s, '-_', '+/');
    $pad = strlen($b) % 4;
    if ($pad !== 0) $b .= str_repeat('=', 4 - $pad);
    return base64_decode($b, true);
}
