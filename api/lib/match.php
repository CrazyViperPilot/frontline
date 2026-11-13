<?php
// Signierter Match-Start (MS1, Regeln: docs/prd/konto.md „Signierter Match-Start“). Gemeinsam für api/match.php: Tabellen,
// Geheimnis des Servers (Tabelle meta, nicht in config.php), Signatur der Tokens. Nur per require_once aus api/*.php geladen.
//
// Ein Token ist „<base64url(JSON)>.<hex HMAC-SHA256 über den ersten Teil>“ mit der Nutzlast {uid, jti, iat, w0}: w0 ist die
// Kasse des Kontos zum Ausgabezeitpunkt. Die Datenbank (match_tokens) hält je Token, ob es schon gewertet ist.

// Tabellen des Match-Starts (legen sich selbst an, idempotent, wie FL_SCHEMA in konto.php).
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
];

const FL_MATCH_TOKENS = 3;     // Tokens auf Vorrat je Konto (gültig mit der aktuellen Kasse)
const FL_MATCH_TOKEN_DAYS = 7; // Ein Token gilt so lange ab Ausgabe; danach wird es aus der Tabelle gelöscht

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
