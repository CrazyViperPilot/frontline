<?php
// Gemeinsame HTTP-Hilfen der Schnittstellen in api/ (save.php, auth.php): CORS, JSON-Antworten, Fehler, Protokoll.
// Nur per require_once aus api/*.php geladen; api/lib/ ist per .htaccess gesperrt.

// Protokoll: Details (Datenbank, SMTP) nur ins Protokoll, nie an den Browser. Eintrag mit dem Namen des aufrufenden Skripts.
function fl_log($message) {
    $script = isset($_SERVER['SCRIPT_FILENAME']) ? basename((string) $_SERVER['SCRIPT_FILENAME']) : 'api';
    error_log('frontline ' . $script . ': ' . $message);
}

// Herkunft der Anfrage ('' bei Aufruf ohne Herkunft, z. B. Klick auf einen Link aus einer Mail).
function fl_origin() {
    return isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
}

// Erlaubt sind das Spiel auf phpexpert.de/frontline und die lokale Entwicklung (localhost, 127.0.0.1).
function fl_origin_allowed($origin) {
    return $origin === 'https://phpexpert.de' || preg_match('#^http://(localhost|127\.0\.0\.1)(:\d+)?$#', $origin) === 1;
}

// Kopfzeilen jeder Antwort. Die Vorabfrage OPTIONS endet hier mit 204.
// $methods: erlaubte Methoden. $credentials: Cookies über die Herkunftsgrenze (nur auth.php, seit KO1).
function fl_cors($methods = 'GET, POST, OPTIONS', $credentials = false) {
    $origin = fl_origin();
    if (fl_origin_allowed($origin)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
        if ($credentials) header('Access-Control-Allow-Credentials: true');
    }
    header('Access-Control-Allow-Headers: Content-Type');
    header('Access-Control-Allow-Methods: ' . $methods);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
}

// Browser anderer Seiten dürfen nicht schreiben: fremde Herkunft mit 403 abweisen.
function fl_check_origin() {
    $origin = fl_origin();
    if ($origin !== '' && !fl_origin_allowed($origin)) fail(403, 'Herkunft nicht erlaubt');
}

function fail($code, $message) {
    http_response_code($code);
    echo json_encode(['error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

function out($value) {
    echo json_encode($value, JSON_UNESCAPED_UNICODE);
    exit;
}

// Unerwartete Fehler (z. B. Datenbank mitten in einer Anfrage) als JSON mit 500; Details nur ins Protokoll.
function fl_exception_handler($message) {
    set_exception_handler(function ($e) use ($message) {
        fl_log($e->getMessage());
        fail(500, $message);
    });
}
