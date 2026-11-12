<?php
// Datenbankzugang der Schnittstellen in api/: Zugang aus api/config.php (vom Deploy aus den Secrets DB_* geschrieben, nicht im Repo).
// Nur per require_once aus api/*.php geladen (zieht lib/http.php nach).

require_once __DIR__ . '/http.php';

// Zugang aus api/config.php. null, wenn die Datei fehlt; sonst das Array aus der Datei (leer, wenn es keines ist).
function fl_config() {
    $file = dirname(__DIR__) . '/config.php';
    if (!is_file($file)) return null;
    $cfg = require $file;
    return is_array($cfg) ? $cfg : [];
}

// Verbindung (PDO mit Ausnahmen, echte Prepared Statements) und Tabellen aus $schema (CREATE TABLE IF NOT EXISTS, idempotent).
// Fehler: mit $soft = true null (Grund ins Protokoll), sonst Antwort 500 mit JSON-Fehler.
function fl_db(array $schema = [], $soft = false) {
    $cfg = fl_config();
    if ($cfg === null) {
        return fl_db_error($soft, 'Datenbank nicht eingerichtet: api/config.php fehlt (der Deploy schreibt sie aus den Secrets DB_*)');
    }
    foreach (['host', 'port', 'name', 'user', 'password'] as $k) {
        if (!array_key_exists($k, $cfg)) return fl_db_error($soft, "api/config.php unvollständig: '$k' fehlt");
    }
    try {
        $pdo = new PDO(
            'mysql:host=' . $cfg['host'] . ';port=' . (int) $cfg['port'] . ';dbname=' . $cfg['name'] . ';charset=utf8mb4',
            (string) $cfg['user'],
            (string) $cfg['password'],
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::MYSQL_ATTR_FOUND_ROWS => true, // rowCount() = gefundene Zeilen (Umbenennen ohne Änderung zählt als Treffer)
            ]
        );
        foreach ($schema as $sql) $pdo->exec($sql);
    } catch (PDOException $e) {
        fl_log($e->getMessage());
        return fl_db_error($soft, 'Datenbank nicht erreichbar');
    }
    return $pdo;
}

function fl_db_error($soft, $message) {
    if ($soft) return null;
    fail(500, $message);
}
