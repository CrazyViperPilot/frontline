<?php
// Signierter Match-Start (MS1, Regeln: docs/prd/konto.md „Signierter Match-Start“). Aktion im JSON-Feld action, Antwort immer JSON:
//   POST match.php {"action":"tokens"}                            → {"tokens":[{"token","w0","iat"}],"wallet":Zahl}
//        füllt den Vorrat des Kontos auf bis zu 3 gültige Tokens auf (gültig = mit der aktuellen Kasse, unverbraucht, nicht abgelaufen)
//   POST match.php {"action":"finish","token":"…","wallet":Zahl,"game":{…}?} → {"ok":true,"wallet":Zahl}
//        wertet eine gestartete Partie: setzt die Kasse auf den Endstand (begrenzt, siehe unten) und legt eine Zeile in matches an.
//        game (optional, nur für die Statistik): result "win"|"loss", duration (Sekunden), difficulty "easy"|"normal"|"hard",
//        seed, points [eigene, feindliche], kills. Ungültige Felder werden null, sie lassen die Wertung nicht scheitern.
//   POST match.php {"action":"stats"}                              → Spielstatistik des Kontos (games, wins, totalEarned, recent …)
// Nur mit Sitzung (Cookie fl_session). Fehler: {"error": "…"} mit HTTP-Code: 400 Anfrage oder Token ungültig/abgelaufen/unbekannt,
// 401 nicht angemeldet, 403 Token gehört zu einem anderen Konto, 405 Methode, 409 schon gewertet oder Kasse hat sich geändert,
// 500 Server oder Datenbank. Der Server rechnet die Partie nicht nach: er prüft Echtheit, Einmaligkeit und Start-Kasse.

require_once __DIR__ . '/lib/http.php';
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/konto.php';
require_once __DIR__ . '/lib/match.php';

fl_cors('POST, OPTIONS', true);
fl_exception_handler('Serverfehler beim Match-Start');
fl_check_origin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail(405, 'Methode nicht erlaubt');

$body = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($body) || !isset($body['action']) || !is_string($body['action'])) fail(400, 'Ungültige Anfrage');

$pdo = fl_db(array_merge(FL_SCHEMA, FL_MATCH_SCHEMA));
switch ($body['action']) {
    case 'tokens': match_tokens_action($pdo); break;
    case 'finish': match_finish_action($pdo, $body); break;
    case 'stats': match_stats_action($pdo); break;
    default: fail(400, 'Unbekannte Aktion');
}

// Angemeldetes Konto (Cookie → Sitzung), sonst 401.
function match_user(PDO $pdo) {
    $user = current_user($pdo);
    if ($user === null) fail(401, 'Nicht angemeldet');
    return $user;
}

// Kasse des Kontos, für die Dauer der Transaktion gesperrt: Ausgabe und Wertung desselben Kontos laufen nacheinander.
function match_lock_wallet(PDO $pdo, $uid) {
    $st = $pdo->prepare('SELECT wallet FROM users WHERE id = :id FOR UPDATE');
    $st->execute([':id' => $uid]);
    return (int) $st->fetchColumn();
}

// Ein Eintrag für die Antwort: Token (neu signiert aus den Daten der Zeile), Startkasse, Ausgabezeit.
function match_entry($uid, $jti, $w0, $iat, $secret) {
    return [
        'token' => fl_sign(['uid' => $uid, 'jti' => $jti, 'iat' => $iat, 'w0' => $w0], $secret),
        'w0' => $w0,
        'iat' => $iat,
    ];
}

// Vorrat auffüllen: Tokens, die noch gültig sind (unverbraucht, mit der aktuellen Kasse, nicht abgelaufen), zuerst; dann neue.
// Abgelaufene Zeilen fallen weg. Gültige Tokens aus einer älteren Kasse bleiben in der Tabelle, werden aber nicht mehr ausgegeben.
function match_tokens_action(PDO $pdo) {
    $user = match_user($pdo);
    $uid = (int) $user['id'];
    $now = time();
    $old = $now - FL_MATCH_TOKEN_DAYS * 86400;
    $secret = fl_secret($pdo);
    $pdo->beginTransaction();
    try {
        $wallet = match_lock_wallet($pdo, $uid);
        $pdo->prepare('DELETE FROM match_tokens WHERE issued_at < :old')->execute([':old' => $old]);
        $st = $pdo->prepare('SELECT jti, w0, issued_at FROM match_tokens WHERE user_id = :u AND used_at IS NULL AND w0 = :w AND issued_at >= :old ORDER BY issued_at, jti');
        $st->execute([':u' => $uid, ':w' => $wallet, ':old' => $old]);
        $list = [];
        foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $list[] = match_entry($uid, $r['jti'], (int) $r['w0'], (int) $r['issued_at'], $secret);
        }
        $ins = $pdo->prepare('INSERT INTO match_tokens (jti, user_id, w0, issued_at) VALUES (:j, :u, :w, :t)');
        while (count($list) < FL_MATCH_TOKENS) {
            $jti = bin2hex(random_bytes(16));
            $ins->execute([':j' => $jti, ':u' => $uid, ':w' => $wallet, ':t' => $now]);
            $list[] = match_entry($uid, $jti, $wallet, $now, $secret);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
    usort($list, fn($a, $b) => [$a['iat'], $a['token']] <=> [$b['iat'], $b['token']]); // feste Reihenfolge in jeder Antwort
    out(['tokens' => array_slice($list, 0, FL_MATCH_TOKENS), 'wallet' => $wallet]);
}

// Partie werten: Token echt (Signatur), zum angemeldeten Konto, unverbraucht, mit der Kasse von damals (w0) gleich der
// heutigen Kasse. Neue Kasse = Endstand, begrenzt auf 0 bis FL_WALLET_MAX und auf w0 + FL_MATCH_MAX_GAIN.
function match_finish_action(PDO $pdo, array $body) {
    $user = match_user($pdo);
    $uid = (int) $user['id'];
    $token = array_key_exists('token', $body) ? $body['token'] : null;
    $value = array_key_exists('wallet', $body) ? $body['wallet'] : null;
    if (!is_string($token) || $token === '') fail(400, 'Token fehlt');
    if (!is_numeric($value)) fail(400, 'Kasse ungültig');
    $payload = fl_verify($token, fl_secret($pdo));
    if ($payload === null) fail(400, 'Token ungültig');
    if ((int) $payload['uid'] !== $uid) fail(403, 'Der Token gehört zu einem anderen Konto.');
    $want = (int) max(0.0, min((float) FL_WALLET_MAX, floor((float) $value)));
    $now = time();
    $pdo->beginTransaction();
    try {
        $cur = match_lock_wallet($pdo, $uid);
        $st = $pdo->prepare('SELECT w0, used_at, issued_at FROM match_tokens WHERE jti = :j AND user_id = :u FOR UPDATE');
        $st->execute([':j' => $payload['jti'], ':u' => $uid]);
        $row = $st->fetch(PDO::FETCH_ASSOC);
        $err = null;
        if ($row === false) $err = [400, 'Token unbekannt oder abgelaufen.'];
        elseif ($row['used_at'] !== null) $err = [409, 'Diese Partie ist schon gewertet.'];
        elseif ((int) $row['issued_at'] < $now - FL_MATCH_TOKEN_DAYS * 86400) $err = [400, 'Der Token ist abgelaufen.'];
        elseif ((int) $row['w0'] !== $cur) $err = [409, 'Die Kasse hat sich geändert: Diese Partie zählt nicht (veraltetes Gerät).'];
        if ($err !== null) {
            $pdo->rollBack();
            fail($err[0], $err[1]);
        }
        $new = max(0, min($want, $cur + FL_MATCH_MAX_GAIN));
        $pdo->prepare('UPDATE match_tokens SET used_at = :now WHERE jti = :j')->execute([':now' => $now, ':j' => $payload['jti']]);
        $pdo->prepare('UPDATE users SET wallet = :w WHERE id = :id')->execute([':w' => $new, ':id' => $uid]);
        $info = match_game_info($body);
        $pdo->prepare('INSERT INTO matches (user_id, jti, started_at, finished_at, wallet_before, wallet_after, earned, result, duration,
                difficulty, seed, points_own, points_enemy, kills)
            VALUES (:u, :j, :s, :f, :wb, :wa, :e, :r, :d, :df, :sd, :po, :pe, :k)')->execute([
            ':u' => $uid, ':j' => $payload['jti'], ':s' => (int) $row['issued_at'], ':f' => $now,
            ':wb' => $cur, ':wa' => $new, ':e' => $new - $cur,
            ':r' => $info['result'], ':d' => $info['duration'], ':df' => $info['difficulty'], ':sd' => $info['seed'],
            ':po' => $info['points_own'], ':pe' => $info['points_enemy'], ':k' => $info['kills'],
        ]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
    out(['ok' => true, 'wallet' => $new]);
}

// Spielstatistik des Kontos (seit v5.158): Zahlen über alle gewerteten Partien und die letzten FL_MATCH_RECENT in neuer Reihenfolge.
// Nur gewertete Partien (mit Token) stehen in matches; ungewertete Partien zählt der Server nicht. wins/losses zählen nur
// Partien, deren Ergebnis bekannt ist (game.result). earned = Kasse nach der Partie minus Kasse vor der Partie (darf negativ sein).
function match_stats_action(PDO $pdo) {
    $user = match_user($pdo);
    $uid = (int) $user['id'];
    $st = $pdo->prepare("SELECT COUNT(*) AS games, SUM(result = 'win') AS wins, SUM(result = 'loss') AS losses,
            COALESCE(SUM(earned), 0) AS total, AVG(earned) AS avg_earned, MAX(earned) AS best, MIN(earned) AS worst,
            COALESCE(SUM(duration), 0) AS seconds
        FROM matches WHERE user_id = :u");
    $st->execute([':u' => $uid]);
    $sum = $st->fetch(PDO::FETCH_ASSOC);
    $st = $pdo->prepare('SELECT finished_at, result, duration, difficulty, wallet_before, wallet_after, earned, points_own, points_enemy, kills
        FROM matches WHERE user_id = :u ORDER BY finished_at DESC, id DESC LIMIT ' . FL_MATCH_RECENT);
    $st->execute([':u' => $uid]);
    $recent = [];
    foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $r) {
        $recent[] = [
            'finishedAt' => (int) $r['finished_at'],
            'result' => $r['result'],
            'duration' => $r['duration'] === null ? null : (int) $r['duration'],
            'difficulty' => $r['difficulty'],
            'walletBefore' => (int) $r['wallet_before'],
            'walletAfter' => (int) $r['wallet_after'],
            'earned' => (int) $r['earned'],
            'pointsOwn' => $r['points_own'] === null ? null : (int) $r['points_own'],
            'pointsEnemy' => $r['points_enemy'] === null ? null : (int) $r['points_enemy'],
            'kills' => $r['kills'] === null ? null : (int) $r['kills'],
        ];
    }
    out([
        'wallet' => (int) $user['wallet'],
        'walletMax' => FL_WALLET_MAX,
        'games' => (int) $sum['games'],
        'wins' => (int) $sum['wins'],
        'losses' => (int) $sum['losses'],
        'totalEarned' => (int) $sum['total'],
        'avgEarned' => $sum['avg_earned'] === null ? null : round((float) $sum['avg_earned'], 1),
        'bestEarned' => $sum['best'] === null ? null : (int) $sum['best'],
        'worstEarned' => $sum['worst'] === null ? null : (int) $sum['worst'],
        'totalPlaySeconds' => (int) $sum['seconds'],
        'recent' => $recent,
    ]);
}
