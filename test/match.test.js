// Signierter Match-Start, Client-Logik (MS1, docs/prd/konto.md „Signierter Match-Start“), ohne Browser: js/ui/match.js mit
// einem gefälschten fetch und Speicher. Gast und ohne Token: ungewertet. Angemeldet: Vorrat holen, Token verbrauchen, Endstand
// melden, ohne Netz vormerken, 409/400/403 verwerfen, 401 behalten, fremdes Konto und veraltete Kasse ausschließen.
// Die Server-Seite (api/match.php) wurde gegen MariaDB und php -S geprüft (docs/prd/konto.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { setAccount, accountWallet, setRemoteEnabled } from '../js/ui/saves.js';
import { matchStart, matchReady, matchPending, matchSync, finishMatch } from '../js/ui/match.js';
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

test('gewertete Partie: Start mit w0, Token verbraucht, Endstand gemeldet, Kasse übernommen, neuer Vorrat', async () => {
  const srv = server(800);
  const env = setup(srv.reply);
  try {
    setAccount(USER);
    await matchSync();
    const m = matchStart();
    assert.ok(m, 'Token da');
    assert.equal(m.w0, 800, 'Startgeld ist die Kasse zum Ausgeben');
    assert.equal(matchReady(), 2, 'der Token ist verbraucht');
    assert.notEqual(matchStart().token, m.token, 'ein zweiter Start nimmt einen anderen Token');
    await finishMatch(m.token, 1234.7);
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
    assert.equal(matchStart(), null, 'die beiden anderen passen nicht');
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
