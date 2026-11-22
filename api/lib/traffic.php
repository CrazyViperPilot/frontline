<?php
// Auswertung der Besucherstatistik für das Admin-Panel (Reiter „Statistik“, Regeln: docs/prd/statistik.md).
// Die Datenbank liefert nur Zeilen (traffic_rows, traffic_player_days); alles Rechnen machen reine Funktionen ohne Datenbank
// (test/trackphp.test.js). Nur per require_once geladen (api/admin.php, api/lib/track.php beim Aufräumen).

const FL_TRAFFIC_GONE = 180;   // s ohne Ereignis: eine Partie ohne Ende gilt als „Tab geschlossen“
const FL_TRAFFIC_PLAYED = 300; // s Spielzeit für die Stufe „5 min gespielt“ im Trichter

// ---- Datenbank --------------------------------------------------------------------------------------------

// Rohereignisse der Tage $from bis $to (Y-m-d, beide eingeschlossen), älteste zuerst; data als Array.
function traffic_rows(PDO $pdo, $from, $to) {
    $st = $pdo->prepare('SELECT day, ts, kind, visitor, pid, sid, gid, page, version, device, browser, data
        FROM tr_events WHERE day >= :f AND day <= :t ORDER BY ts, id');
    $st->execute([':f' => $from, ':t' => $to]);
    $rows = [];
    while (($r = $st->fetch(PDO::FETCH_ASSOC)) !== false) {
        $r['ts'] = (int) $r['ts'];
        $r['data'] = $r['data'] === null ? [] : (json_decode($r['data'], true) ?: []);
        $rows[] = $r;
    }
    return $rows;
}

// Alle Tage der Spieler mit Einwilligung (für die Wiederkehr; die Tabelle ist klein: eine Zeile je Spieler und Tag).
function traffic_player_days(PDO $pdo) {
    return $pdo->query('SELECT pid, day FROM tr_player_days')->fetchAll(PDO::FETCH_ASSOC);
}

// ---- Reine Funktionen -------------------------------------------------------------------------------------

function traffic_median(array $v) {
    if (!$v) return null;
    sort($v);
    $n = count($v);
    $mid = intdiv($n, 2);
    return $n % 2 ? $v[$mid] : ($v[$mid - 1] + $v[$mid]) / 2;
}

// Spielzeit in Klassen: <2, 2–10, 10–30, >30 Minuten. Liefert [[label, n], …] in fester Reihenfolge.
function traffic_buckets(array $seconds) {
    $out = ['<2 min' => 0, '2–10 min' => 0, '10–30 min' => 0, '>30 min' => 0];
    foreach ($seconds as $s) {
        if ($s < 120) $out['<2 min']++;
        elseif ($s < 600) $out['2–10 min']++;
        elseif ($s <= 1800) $out['10–30 min']++;
        else $out['>30 min']++;
    }
    $list = [];
    foreach ($out as $k => $n) $list[] = ['k' => $k, 'n' => $n];
    return $list;
}

// Spielminute in Klassen (für „wann wird abgebrochen“).
function traffic_minute_bucket($m) {
    $m = (int) $m;
    if ($m < 2) return '0–2';
    if ($m < 5) return '2–5';
    if ($m < 10) return '5–10';
    if ($m < 20) return '10–20';
    if ($m < 40) return '20–40';
    return '40+';
}

// Partien aus den Ereignissen: je (sid, gid) eine Partie, nur mit Start-Ereignis. status: win, loss, quit, close (auch ohne Ende
// und länger als FL_TRAFFIC_GONE still) oder running. playSec = größere von Ende-Dauer und 60 s je Herzschlag.
function traffic_games(array $rows, $now) {
    $g = [];
    foreach ($rows as $r) {
        if ($r['gid'] === null || $r['gid'] === '') continue;
        if (!in_array($r['kind'], ['start', 'beat', 'end'], true)) continue;
        $key = $r['sid'] . '|' . $r['gid'];
        if (!isset($g[$key])) {
            $g[$key] = ['start' => null, 'day' => $r['day'], 'visitor' => $r['visitor'], 'pid' => $r['pid'], 'version' => $r['version'],
                'beats' => 0, 'minute' => 0, 'end' => null, 'dur' => 0, 'last' => $r['ts']];
        }
        $x = &$g[$key];
        $x['last'] = max($x['last'], $r['ts']);
        $d = $r['data'];
        if ($r['kind'] === 'start') {
            $x['start'] = $d;
            $x['day'] = $r['day'];
            $x['visitor'] = $r['visitor'];
            $x['pid'] = $r['pid'];
        } elseif ($r['kind'] === 'beat') {
            $x['beats']++;
            if (isset($d['m'])) $x['minute'] = max($x['minute'], (int) $d['m']);
        } elseif ($r['kind'] === 'end' && $x['end'] === null) {
            $x['end'] = $d['r'] ?? 'quit';
            $x['dur'] = (int) ($d['dur'] ?? 0);
            if (isset($d['m'])) $x['minute'] = max($x['minute'], (int) $d['m']);
        }
        unset($x);
    }
    $out = [];
    foreach ($g as $x) {
        if ($x['start'] === null) continue;
        $status = $x['end'] ?? ($now - $x['last'] > FL_TRAFFIC_GONE ? 'close' : 'running');
        $x['status'] = $status;
        $x['playSec'] = max($x['dur'], $x['beats'] * 60);
        $out[] = $x;
    }
    return $out;
}

// Tagessumme (für tr_daily und die Tageszeilen): Aufrufe, Besucher, Partien nach Ausgang, Spielzeit.
function traffic_summary(array $rows, $day, $now = null) {
    $now = $now ?? time();
    $s = ['day' => $day, 'views' => 0, 'editorViews' => 0, 'visitors' => 0, 'starts' => 0, 'finished' => 0, 'wins' => 0, 'losses' => 0,
        'quits' => 0, 'closes' => 0, 'playSec' => 0, 'players' => 0];
    $vis = [];
    $pids = [];
    foreach ($rows as $r) {
        if ($r['day'] !== $day) continue;
        $vis[$r['visitor']] = true;
        if ($r['pid'] !== null) $pids[$r['pid']] = true;
        if ($r['kind'] === 'view') $s[$r['page'] === 'editor' ? 'editorViews' : 'views']++;
    }
    $s['visitors'] = count($vis);
    $s['players'] = count($pids);
    foreach (traffic_games($rows, $now) as $x) {
        if ($x['day'] !== $day) continue;
        $s['starts']++;
        $s['playSec'] += $x['playSec'];
        if ($x['status'] === 'win') { $s['wins']++; $s['finished']++; }
        elseif ($x['status'] === 'loss') { $s['losses']++; $s['finished']++; }
        elseif ($x['status'] === 'quit') $s['quits']++;
        elseif ($x['status'] === 'close') $s['closes']++;
    }
    return $s;
}

// Wiederkehr der Spieler mit Einwilligung, deren erster Tag in [$from, $to] liegt. Dn: wieder aktiv an Tag n oder später nach dem
// ersten Tag. Mitgezählt werden nur Spieler, bei denen Tag n schon erreicht ist (erster Tag + n ≤ heute).
function traffic_retention(array $playerDays, $from, $to, $today) {
    $days = [];
    foreach ($playerDays as $r) $days[$r['pid']][] = $r['day'];
    $res = ['cohort' => 0];
    foreach ([1, 7, 30] as $n) $res['d' . $n] = ['of' => 0, 'back' => 0];
    foreach ($days as $list) {
        sort($list);
        $first = $list[0];
        if ($first < $from || $first > $to) continue;
        $res['cohort']++;
        $last = end($list);
        foreach ([1, 7, 30] as $n) {
            $target = date('Y-m-d', strtotime($first . ' +' . $n . ' days'));
            if ($target > $today) continue;
            $res['d' . $n]['of']++;
            if ($last >= $target) $res['d' . $n]['back']++;
        }
    }
    return $res;
}

// Zählung [[k, n], …], größte zuerst.
function traffic_count(array $values) {
    $c = [];
    foreach ($values as $v) {
        if ($v === null || $v === '') $v = '–';
        $k = is_bool($v) ? ($v ? 'an' : 'aus') : (string) $v;
        $c[$k] = ($c[$k] ?? 0) + 1;
    }
    arsort($c);
    $out = [];
    foreach ($c as $k => $n) $out[] = ['k' => (string) $k, 'n' => $n];
    return $out;
}

// Gesamtbericht für den Reiter „Statistik“: Tage $from bis $to. $rows aus traffic_rows, $playerDays aus traffic_player_days.
function traffic_report(array $rows, array $playerDays, $from, $to, $now = null) {
    $now = $now ?? time();
    $today = date('Y-m-d', $now);

    // Tageszeilen, auch Tage ohne Ereignis
    $perDay = [];
    for ($d = $from; $d <= $to; $d = date('Y-m-d', strtotime($d . ' +1 day'))) $perDay[$d] = null;
    $byDay = [];
    foreach ($rows as $r) $byDay[$r['day']][] = $r;
    $games = traffic_games($rows, $now);
    $gamesByDay = [];
    foreach ($games as $x) $gamesByDay[$x['day']][] = $x;
    foreach (array_keys($perDay) as $d) {
        $perDay[$d] = traffic_summary($byDay[$d] ?? [], $d, $now);
        // Partien eines Tages kommen aus allen Zeilen (Herzschlag und Ende können am nächsten Tag liegen)
        $perDay[$d]['starts'] = 0;
        foreach (['finished', 'wins', 'losses', 'quits', 'closes', 'playSec'] as $k) $perDay[$d][$k] = 0;
        foreach ($gamesByDay[$d] ?? [] as $x) {
            $p = &$perDay[$d];
            $p['starts']++;
            $p['playSec'] += $x['playSec'];
            if ($x['status'] === 'win' || $x['status'] === 'loss') { $p['finished']++; $p[$x['status'] === 'win' ? 'wins' : 'losses']++; }
            elseif ($x['status'] === 'quit') $p['quits']++;
            elseif ($x['status'] === 'close') $p['closes']++;
            unset($p);
        }
    }

    // Besucher-Tage: je (Tag, Tages-Hash) die Stufen des Trichters, Gerät, Browser, Version, Einwilligung
    $vd = [];
    foreach ($rows as $r) {
        $k = $r['day'] . '|' . $r['visitor'];
        if (!isset($vd[$k])) $vd[$k] = ['view' => false, 'menu' => false, 'start' => false, 'played' => false, 'finished' => false,
            'pid' => false, 'device' => $r['device'], 'browser' => $r['browser'], 'version' => null, 'playSec' => 0, 'games' => 0];
        $v = &$vd[$k];
        if ($r['kind'] === 'view' && $r['page'] === 'game') $v['view'] = true;
        if ($r['kind'] === 'menu') $v['menu'] = true;
        if ($r['pid'] !== null) $v['pid'] = true;
        if ($v['version'] === null && $r['version'] !== null) $v['version'] = $r['version'];
        unset($v);
    }
    foreach ($games as $x) {
        $k = $x['day'] . '|' . $x['visitor'];
        if (!isset($vd[$k])) continue;
        $vd[$k]['start'] = true;
        $vd[$k]['games']++;
        $vd[$k]['playSec'] += $x['playSec'];
        if ($x['playSec'] >= FL_TRAFFIC_PLAYED) $vd[$k]['played'] = true;
        if ($x['status'] === 'win' || $x['status'] === 'loss') $vd[$k]['finished'] = true;
    }
    $step = fn($key) => count(array_filter($vd, fn($v) => $v[$key]));
    $funnel = [
        ['k' => 'Seite aufgerufen', 'n' => $step('view')],
        ['k' => 'Startmenü', 'n' => $step('menu')],
        ['k' => 'Partie gestartet', 'n' => $step('start')],
        ['k' => '5 min gespielt', 'n' => $step('played')],
        ['k' => 'Partie beendet', 'n' => $step('finished')],
    ];

    // Spielzeit
    $gameSecs = array_map(fn($x) => $x['playSec'], $games);
    $vdSecs = array_values(array_map(fn($v) => $v['playSec'], array_filter($vd, fn($v) => $v['games'] > 0)));
    $perPlayer = [];
    foreach ($games as $x) if ($x['pid'] !== null) $perPlayer[$x['pid']] = ($perPlayer[$x['pid']] ?? 0) + $x['playSec'];
    $playerSecs = array_values($perPlayer);
    $gamesPerPlayer = [];
    foreach ($games as $x) if ($x['pid'] !== null) $gamesPerPlayer[$x['pid']] = ($gamesPerPlayer[$x['pid']] ?? 0) + 1;

    // Ausgänge
    $count = fn($st) => count(array_filter($games, fn($x) => $x['status'] === $st));
    $wins = $count('win');
    $losses = $count('loss');
    $quits = $count('quit');
    $closes = $count('close');
    $ended = $wins + $losses + $quits + $closes;
    $abortMinutes = [];
    foreach ($games as $x) if ($x['status'] === 'quit' || $x['status'] === 'close') $abortMinutes[] = traffic_minute_bucket($x['minute']);
    $order = ['0–2', '2–5', '5–10', '10–20', '20–40', '40+'];
    $abortList = [];
    $ac = array_count_values($abortMinutes);
    foreach ($order as $k) $abortList[] = ['k' => $k, 'n' => $ac[$k] ?? 0];

    // Beliebtheit aus den Start-Ereignissen
    $starts = array_map(fn($x) => $x['start'], $games);
    $diffs = [];
    foreach ($starts as $s) foreach ($s['diffs'] ?? [] as $d) $diffs[] = $d;
    $switches = [];
    foreach (['research' => 'Forschung', 'river' => 'Fluss', 'build' => 'Baugebiet', 'rated' => 'gewertet', 'resumed' => 'fortgesetzt'] as $key => $label) {
        $on = count(array_filter($starts, fn($s) => ($s[$key] ?? null) === true));
        $off = count(array_filter($starts, fn($s) => ($s[$key] ?? null) === false));
        $switches[] = ['k' => $label, 'on' => $on, 'off' => $off];
    }

    $visitorDays = count($vd);
    $totalPlay = array_sum($gameSecs);
    return [
        'from' => $from,
        'to' => $to,
        'perDay' => array_values($perDay),
        'totals' => [
            'views' => array_sum(array_column($perDay, 'views')),
            'editorViews' => array_sum(array_column($perDay, 'editorViews')),
            'visitors' => $visitorDays,
            'starts' => count($games),
            'finished' => $wins + $losses,
            'wins' => $wins,
            'losses' => $losses,
            'quits' => $quits,
            'closes' => $closes,
            'abortRate' => $ended > 0 ? round(($quits + $closes) / $ended, 3) : null,
            'playSec' => $totalPlay,
            'consentShare' => $visitorDays > 0 ? round($step('pid') / $visitorDays, 3) : null,
            'players' => count($perPlayer),
        ],
        'funnel' => $funnel,
        'playtime' => [
            'medianGame' => traffic_median($gameSecs),
            'avgVisitorDay' => $vdSecs ? round(array_sum($vdSecs) / count($vdSecs)) : null,
            'medianVisitorDay' => traffic_median($vdSecs),
            'medianPlayer' => traffic_median($playerSecs),
            'avgGamesPerPlayer' => $gamesPerPlayer ? round(array_sum($gamesPerPlayer) / count($gamesPerPlayer), 1) : null,
            'games' => traffic_buckets($gameSecs),
            'visitorDays' => traffic_buckets($vdSecs),
            'players' => traffic_buckets($playerSecs),
        ],
        'retention' => traffic_retention($playerDays, $from, $to, $today),
        'popular' => [
            'modes' => traffic_count(array_map(fn($s) => $s['mode'] ?? null, $starts)),
            'opponents' => traffic_count(array_map(fn($s) => $s['opp'] ?? null, $starts)),
            'difficulty' => traffic_count($diffs),
            'maps' => traffic_count(array_map(fn($s) => $s['map'] ?? null, $starts)),
            'weather' => traffic_count(array_map(fn($s) => $s['weather'] ?? null, $starts)),
            'switches' => $switches,
        ],
        'abortMinute' => $abortList,
        'devices' => traffic_count(array_map(fn($v) => $v['device'], $vd)),
        'browsers' => traffic_count(array_map(fn($v) => $v['browser'], $vd)),
        'versions' => traffic_count(array_map(fn($v) => $v['version'], $vd)),
    ];
}
