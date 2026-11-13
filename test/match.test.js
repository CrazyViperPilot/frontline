// Signierter Match-Start, Client-Logik (MS1, MS2, docs/prd/konto.md „Signierter Match-Start“), ohne Browser: js/ui/match.js mit
// einem gefälschten fetch und Speicher. Gast und ohne Token: ungewertet. Angemeldet: Vorrat holen, Start verbraucht nichts
// (MS2), der Endstand verbraucht das Token, ohne Netz vormerken, 409/400/403 verwerfen, 401 behalten, fremdes Konto und
// veraltete Kasse ausschließen, gespeicherte Partie mit Token fortsetzen (matchResume).
// Seit v5.158: Partie-Infos am Endstand (game, gameInfo) und die Spielstatistik (matchStats).
// Die Server-Seite (api/match.php) wurde gegen MariaDB und php -S geprüft (docs/prd/konto.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { setAccount, accountWallet, setRemoteEnabled } from '../js/ui/saves.js';
import { matchStart, matchResume, matchReady, matchPending, matchSync, finishMatch, gameInfo, matchStats } from '../js/ui/match.js';
import { BALANCE } from '../js/data/balance.js';

const VORRAT = 'frontline-match-vorrat';
const AUSSTEHEND = 'frontline-match-ausstehend';
const USER = { email: 'anna@example.test', plan: 'free', premiumUntil: null, createdAt: 1, wallet: 800 };
const now = () => Math.floor(Date.now() / 1000);

/** Browser-Speicher und fetch nachbauen. reply(url, body) liefert { status, body } oder einen Error (Netz). */
function setup(reply) {
  const store = new Map();
  const realLS = globalThis.localStorage;
  const realFetch = globalThis.fetch;
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    const body = opts?.body ? JSON.parse(opts.body) : null;
    calls.push({ url: String(url), body });
    const r = await reply(String(url), body);
    if (r instanceof Error) throw r;
    return { ok: r.status === undefined || r.status < 400, status: r.status ?? 200, json: async () => r.body };
  };
  return {
    calls,
    store,
    restore() {
      globalThis.localStorage = realLS;
      globalThis.fetch = realFetch;
      setAccount(null);
      setRemoteEnabled(true);
    },
  };
}

const matchCalls = (calls) => calls.filter((c) => c.url.endsWith('/api/match.php'));
const finishCalls = (calls) => matchCalls(calls).filter((c) => c.body.action === 'finish');
const tok = (name, w0, iat = now()) => ({ token: `tok-${name}`, w0, iat });

/** Server nachbauen: Tokens (drei, mit der Kasse wallet), Endstände werden angenommen und setzen die Kasse. */
function server(wallet = 800) {
  const state = { wallet, n: 0, online: true };
  state.reply = (url, body) => {
    if (!state.online) return new TypeError('Failed to fetch');
    if (url.endsWith('/api/auth.php')) return { body: { ok: true, wallet: body.value } };
    if (body.action === 'tokens') {
      const tokens = [0, 1, 2].map(() => {
        state.n++;
        return tok(`${state.n}`, state.wallet);
      });
      return { body: { tokens, wallet: state.wallet } };
    }
    state.wallet = body.wallet;
    return { body: { ok: true, wallet: body.wallet } };
  };
  return state;
}

test('Gast: ungewertet, kein Netz, nichts wird gemeldet', async () => {
  const env = setup(() => ({ body: {} }));
  try {
    setAccount(null);
    assert.equal(matchStart(), null, 'ohne Konto kein Token');
    assert.equal(matchReady(), 0);
    await finishMatch('tok-x', 2000);
    assert.equal(env.calls.length, 0, 'keine Anfrage');
    assert.equal(env.store.has(AUSSTEHEND), false, 'nichts vorgemerkt');
    assert.equal(await matchSync(), 0);
    assert.equal(env.calls.length, 0);
  } finally {
    env.restore();
  }
});

test('angemeldet ohne Vorrat: ungewertet, bis der Vorrat geholt ist', async () => {
  const srv = server(800);
  const env = setup(srv.reply);
  try {
    setAccount(USER);
    assert.equal(matchStart(), null, 'noch kein Vorrat');
    assert.equal(await matchSync(), 3, 'drei Tokens geholt');
    assert.equal(matchReady(), 3);
    assert.equal(accountWallet(), 800);
    assert.equal(matchCalls(env.calls)[0].body.action, 'tokens');
  } finally {
    env.restore();
  }
});

test('gewertete Partie: Start mit w0, Endstand verbraucht den Token, Kasse übernommen, neuer Vorrat', async () => {
  const srv = server(800);
  const env = setup(srv.reply);
  try {
    setAccount(USER);
    await matchSync();
    const m = matchStart();
    assert.ok(m, 'Token da');
    assert.equal(m.w0, 800, 'Startgeld ist die Kasse zum Ausgeben');
    assert.equal(matchReady(), 3, 'der Start verbraucht noch nichts');
    assert.deepEqual(matchStart(), m, 'ein zweiter Start (nach einem Abbruch) nimmt denselben Token');
    await finishMatch(m.token, 1234.7);
    assert.equal(JSON.parse(env.store.get(VORRAT)).tokens.some((t) => t.token === m.token), false, 'der Token ist aus dem Vorrat weg');
    assert.deepEqual(finishCalls(env.calls).map((c) => c.body), [{ action: 'finish', token: m.token, wallet: 1234 }], 'ganzzahlig gemeldet');
    assert.equal(accountWallet(), 1234, 'die Kasse zeigt den Stand des Servers');
    assert.equal(srv.wallet, 1234);
    assert.equal(matchPending(), 0, 'bestätigt: nichts vorgemerkt');
    assert.equal(matchCalls(env.calls).at(-1).body.action, 'tokens', 'danach frischer Vorrat mit der neuen Kasse');
    assert.equal(matchReady(), 3);
  } finally {
    env.restore();
  }
});

test('Abbruch verbraucht kein Token: Start ohne Endstand lässt den Vorrat unverändert', async () => {
  const srv = server(800);
  const env = setup(srv.reply);
  try {
    setAccount(USER);
    await matchSync();
    const before = env.store.get(VORRAT);
    const m = matchStart();
    assert.ok(m);
    // Abbruch: kein finishMatch. Ein neuer Start nimmt denselben Token, der Vorrat ist byteweise gleich.
    assert.deepEqual(matchStart(), m);
    assert.equal(env.store.get(VORRAT), before, 'Vorrat unverändert');
    assert.equal(matchReady(), 3);
    assert.equal(finishCalls(env.calls).length, 0, 'nichts gemeldet');
    assert.equal(matchPending(), 0);
  } finally {
    env.restore();
  }
});

test('finish verbraucht den Token auch ohne Netz und wenn die Kasse gleich bleibt', async () => {
  const srv = server(800);
  const env = setup(srv.reply);
  try {
    setAccount(USER);
    await matchSync();
    const m = matchStart();
    srv.online = false;
    await finishMatch(m.token, 800); // Kasse unverändert: die anderen beiden Tokens (w0 800) bleiben
    const left = JSON.parse(env.store.get(VORRAT)).tokens.map((t) => t.token);
    assert.equal(left.includes(m.token), false, 'der verbrauchte Token ist weg');
    assert.equal(matchReady(), 2, 'die beiden anderen bleiben nutzbar');
    assert.notDeepEqual(matchStart(), m, 'der nächste Start nimmt einen anderen Token');
    assert.equal(matchPending(), 1, 'die Meldung wartet auf das Netz');
  } finally {
    env.restore();
  }
});

test('matchResume: gespeicherter Token noch im Vorrat = gewertet; verbraucht, fremd oder ohne Konto = null', async () => {
  const srv = server(800);
  const env = setup(srv.reply);
  try {
    setAccount(USER);
    await matchSync();
    const m = matchStart();
    assert.deepEqual(matchResume(m), m, 'der Token ist noch da');
    assert.equal(matchResume({ token: 'tok-fremd', w0: 800 }), null, 'unbekannter Token');
    assert.equal(matchResume(undefined), null, 'Stand ohne match');
    assert.equal(matchResume({ w0: 800 }), null, 'ohne Token');
    await finishMatch(m.token, 900);
    assert.equal(matchResume(m), null, 'nach der Wertung verbraucht');
    setAccount(null);
    assert.equal(matchResume(m), null, 'ohne Konto');
  } finally {
    env.restore();
  }
});

test('matchResume: ein Token aus einer anderen Kasse ist veraltet', async () => {
  const env = setup(() => ({ body: {} }));
  try {
    setAccount({ ...USER, wallet: 1500 });
    env.store.set(VORRAT, JSON.stringify({ email: USER.email, tokens: [tok('alt', 800)] }));
    assert.equal(matchResume({ token: 'tok-alt', w0: 800 }), null);
    assert.equal(matchReady(), 0);
  } finally {
    env.restore();
  }
});

test('eine Wertung entwertet den Vorrat mit alter Kasse, auch ohne Netz', async () => {
  const srv = server(800);
  const env = setup(srv.reply);
  try {
    setAccount(USER);
    await matchSync();
    srv.online = false;
    await finishMatch('tok-fremd', 1500);
    assert.equal(matchReady(), 0, 'alle Tokens stehen auf 800, die Kasse ist 1500');
    const left = JSON.parse(env.store.get(VORRAT)).tokens;
    assert.deepEqual(left, [], 'aus dem gespeicherten Vorrat gestrichen');
  } finally {
    env.restore();
  }
});

test('ohne Netz: der Endstand bleibt vorgemerkt, die Anzeige zeigt ihn, Abgleich schickt ihn nach', async () => {
  const srv = server(800);
  const env = setup(srv.reply);
  try {
    setAccount(USER);
    await matchSync();
    srv.online = false;
    const m = matchStart();
    await finishMatch(m.token, 2000);
    assert.equal(accountWallet(), 2000, 'das Spiel zeigt den neuen Stand schon');
    assert.equal(matchPending(), 1, 'ein Endstand wartet');
    assert.equal(matchReady(), 0);
    assert.equal(matchStart(), null, 'offline keine gewertete Partie mehr, bis der Server die Kasse kennt');
    assert.deepEqual(JSON.parse(env.store.get(AUSSTEHEND)), [{ email: USER.email, token: m.token, wallet: 2000 }]);

    srv.online = true;
    const ready = await matchSync();
    assert.equal(srv.wallet, 2000, 'der Server bekommt den vorgemerkten Stand');
    assert.equal(matchPending(), 0);
    assert.equal(ready, 3, 'danach ein frischer Vorrat mit der Kasse 2000');
    assert.equal(accountWallet(), 2000);
  } finally {
    env.restore();
  }
});

test('mehrere vorgemerkte Endstände gehen in der Reihenfolge hinaus', async () => {
  const srv = server(800);
  const env = setup(srv.reply);
  try {
    setAccount(USER);
    env.store.set(AUSSTEHEND, JSON.stringify([
      { email: USER.email, token: 'tok-erst', wallet: 900 },
      { email: USER.email, token: 'tok-zweit', wallet: 1000 },
    ]));
    assert.equal(matchPending(), 2);
    await matchSync();
    assert.deepEqual(finishCalls(env.calls).map((c) => c.body.token), ['tok-erst', 'tok-zweit']);
    assert.equal(matchPending(), 0);
  } finally {
    env.restore();
  }
});

test('409 (schon gewertet oder Kasse geändert) verwirft den Eintrag, ohne Wiederholung', async () => {
  const srv = server(800);
  const env = setup((url, body) => (body?.action === 'finish'
    ? { status: 409, body: { error: 'Diese Partie ist schon gewertet.' } }
    : srv.reply(url, body)));
  try {
    setAccount(USER);
    await matchSync();
    const m = matchStart();
    await finishMatch(m.token, 1500);
    assert.equal(matchPending(), 0, 'verworfen');
    assert.equal(finishCalls(env.calls).length, 1, 'einmal gesendet, nicht wiederholt');
    assert.equal(accountWallet(), 800, 'die Kasse kommt danach vom Server (Abgleich)');
  } finally {
    env.restore();
  }
});

test('400 und 403 verwerfen den Eintrag; 401 (nicht angemeldet) behält ihn bis zur nächsten Anmeldung', async () => {
  const srv = server(800);
  let status = 400;
  const env = setup((url, body) => (body?.action === 'finish' ? { status, body: { error: 'x' } } : srv.reply(url, body)));
  try {
    setAccount(USER);
    await finishMatch('tok-a', 900);
    assert.equal(matchPending(), 0, '400: Token abgelaufen oder ungültig, verworfen');
    status = 403;
    await finishMatch('tok-b', 900);
    assert.equal(matchPending(), 0, '403: fremdes Konto, verworfen');
    status = 401;
    await finishMatch('tok-c', 950);
    assert.equal(matchPending(), 1, '401: vorgemerkt bis zur nächsten Anmeldung');
  } finally {
    env.restore();
  }
});

test('vorgemerkter Endstand eines anderen Kontos fällt weg', async () => {
  const srv = server(300);
  const env = setup((url, body) => srv.reply(url, body));
  try {
    setAccount(USER);
    srv.online = false;
    await finishMatch('tok-alt', 2222);
    assert.equal(matchPending(), 1);
    const before = env.calls.length;
    setAccount({ email: 'bernd@example.test', plan: 'free', premiumUntil: null, createdAt: 1, wallet: 300 });
    srv.online = true;
    await matchSync();
    assert.equal(matchPending(), 0, 'fremder Endstand verworfen');
    assert.equal(finishCalls(env.calls.slice(before)).length, 0, 'und nach dem Konto-Wechsel nie gesendet');
    assert.equal(accountWallet(), 300);
  } finally {
    env.restore();
  }
});

test('Token mit veralteter Kasse oder abgelaufener Frist wird nicht gestartet', async () => {
  const env = setup(() => ({ body: {} }));
  try {
    setAccount({ ...USER, wallet: 1500 });
    env.store.set(VORRAT, JSON.stringify({
      email: USER.email,
      tokens: [tok('alt', 800), tok('abgelaufen', 1500, now() - 8 * 86400), tok('ok', 1500)],
    }));
    assert.equal(matchStart()?.token, 'tok-ok', 'nur der Token mit der aktuellen Kasse und in der Frist');
    assert.equal(matchStart()?.token, 'tok-ok', 'der Start verbraucht nichts, der Token bleibt');
    assert.equal(matchReady(), 1, 'die beiden anderen passen nicht');
    assert.equal(BALANCE.match.tokenDays, 7);
  } finally {
    env.restore();
  }
});

test('Vorrat eines anderen Kontos wird nicht benutzt', async () => {
  const env = setup(() => ({ body: {} }));
  try {
    setAccount(USER);
    env.store.set(VORRAT, JSON.stringify({ email: 'bernd@example.test', tokens: [tok('fremd', 800)] }));
    assert.equal(matchStart(), null);
    assert.equal(matchReady(), 0);
  } finally {
    env.restore();
  }
});

test('Netz weg beim Vorrat holen: der bisherige Vorrat bleibt nutzbar', async () => {
  const srv = server(800);
  const env = setup(srv.reply);
  try {
    setAccount(USER);
    await matchSync();
    srv.online = false;
    assert.equal(await matchSync(), 3, 'ohne Netz: die drei Tokens bleiben');
    assert.ok(matchStart(), 'eine gewertete Partie geht auch offline');
  } finally {
    env.restore();
  }
});

test('Abmelden: kein Start mehr, der Vorrat bleibt für die nächste Anmeldung', async () => {
  const srv = server(800);
  const env = setup(srv.reply);
  try {
    setAccount(USER);
    await matchSync();
    setAccount(null);
    assert.equal(matchStart(), null);
    setAccount(USER);
    assert.equal(matchReady(), 3, 'der Vorrat des Kontos ist noch da');
  } finally {
    env.restore();
  }
});

test('gameInfo: Ergebnis, Spielzeit, Schwierigkeit, Karte, Punkte und Abschüsse des Spielers', () => {
  const game = { winner: 0, time: 912.4, seed: 4711, teams: [{ points: 100, stats: { kills: 77 } }, { points: 40, stats: { kills: 3 } }] };
  assert.deepEqual(gameInfo(game, 'hard'), { result: 'win', duration: 912.4, difficulty: 'hard', seed: 4711, points: [100, 40], kills: 77 });
  assert.equal(gameInfo({ ...game, winner: 1 }, 'easy').result, 'loss', 'Gegner gewinnt');
  assert.equal(gameInfo({ ...game, winner: null }, 'easy').result, null, 'noch kein Sieger');
});

test('finish mit Partie-Infos: game geht mit, ganzzahlig und nur mit bekannten Feldern', async () => {
  const srv = server(800);
  const env = setup(srv.reply);
  try {
    setAccount(USER);
    await matchSync();
    const m = matchStart();
    await finishMatch(m.token, 1100, { result: 'win', duration: 912.4, difficulty: 'hard', seed: 4711, points: [100, 40], kills: 77, evil: 'x' });
    assert.deepEqual(finishCalls(env.calls)[0].body, {
      action: 'finish', token: m.token, wallet: 1100,
      game: { result: 'win', duration: 912, difficulty: 'hard', seed: 4711, points: [100, 40], kills: 77 },
    });
  } finally {
    env.restore();
  }
});

test('finish mit fehlenden oder ungültigen Partie-Infos: Felder werden null, die Kasse zählt trotzdem', async () => {
  const srv = server(800);
  const env = setup(srv.reply);
  try {
    setAccount(USER);
    await matchSync();
    const m = matchStart();
    await finishMatch(m.token, 900, { result: 'draw', duration: NaN, difficulty: 7, seed: Infinity, points: 'x', kills: null });
    assert.deepEqual(finishCalls(env.calls)[0].body.game, {
      result: null, duration: null, difficulty: null, seed: null, points: [null, null], kills: null,
    });
    assert.equal(accountWallet(), 900, 'der Endstand ist trotzdem gewertet');
  } finally {
    env.restore();
  }
});

test('Ohne Netz: Partie-Infos stehen in der Vormerkung und gehen beim Abgleich mit', async () => {
  const srv = server(800);
  const env = setup(srv.reply);
  try {
    setAccount(USER);
    await matchSync();
    const m = matchStart();
    srv.online = false;
    const info = { result: 'loss', duration: 60, difficulty: 'easy', seed: 1, points: [1, 2], kills: 0 };
    await finishMatch(m.token, 1000, info);
    assert.equal(JSON.parse(env.store.get(AUSSTEHEND))[0].game.result, 'loss');
    srv.online = true;
    await matchSync();
    assert.deepEqual(finishCalls(env.calls).at(-1).body.game, info);
    assert.equal(matchPending(), 0);
  } finally {
    env.restore();
  }
});

test('matchStats: holt die Statistik mit action stats; Fehler (401) bleiben als Fehler mit Status', async () => {
  const stats = { wallet: 1100, walletMax: 5000, games: 1, wins: 1, losses: 0, totalEarned: 300, avgEarned: 300, bestEarned: 300, worstEarned: 300, totalPlaySeconds: 912, recent: [] };
  let answer = { body: stats };
  const env = setup((url, body) => (body.action === 'stats' ? answer : { body: {} }));
  try {
    setAccount(USER);
    assert.deepEqual(await matchStats(), stats);
    assert.deepEqual(matchCalls(env.calls).at(-1).body, { action: 'stats' });
    answer = { status: 401, body: { error: 'Nicht angemeldet' } };
    await assert.rejects(matchStats(), { status: 401, message: 'Nicht angemeldet' });
  } finally {
    env.restore();
  }
});
