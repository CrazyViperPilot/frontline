// Kasse am Konto (KA1, docs/prd/konto.md): Client-Logik von js/ui/saves.js ohne Browser. Gast: Startbetrag, nichts wird
// gemeldet. Angemeldet: Kasse aus dem Konto, Meldung am Partieende, Bremse des Servers, vorgemerkter Stand ohne Netz,
// Zurücksetzen. Die Server-Seite (api/auth.php, api/admin.php) wurde von Hand gegen MariaDB geprüft (docs/prd/konto.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { setAccount, accountWallet, saveWallet, resetWallet, setRemoteEnabled } from '../js/ui/saves.js';
import { BALANCE } from '../js/data/balance.js';

const PENDING = 'frontline-kasse-ausstehend';
const USER = { email: 'anna@example.test', plan: 'free', premiumUntil: null, createdAt: 1, wallet: 1500 };

/** Browser-Speicher und fetch nachbauen. reply(url, body) liefert { status, body } oder Error (Netz), auch als Promise. */
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

const accountCalls = (calls) => calls.filter((c) => c.url.endsWith('/api/auth.php'));

test('Gast: keine Kasse am Konto, Partieende meldet nichts, „zurücksetzen“ geht nicht', async () => {
  const env = setup(() => ({ body: { saves: [] } }));
  try {
    setAccount(null);
    assert.equal(accountWallet(), null, 'ohne Anmeldung keine Kasse (das Spiel nimmt den Startbetrag)');
    await saveWallet(2400);
    assert.equal(env.calls.length, 0, 'kein Netz, kein Sparschwein');
    assert.equal(env.store.has(PENDING), false, 'auch nichts vorgemerkt');
    assert.equal(accountWallet(), null);
    await assert.rejects(resetWallet(), /Nicht angemeldet/);
    assert.equal(accountCalls(env.calls).length, 0);
  } finally {
    env.restore();
  }
});

test('Anmelden: die Kasse kommt aus dem Konto; Partieende meldet den Stand', async () => {
  const env = setup((url, body) => (url.endsWith('/api/auth.php')
    ? { body: { ok: true, wallet: body.value } }
    : { body: { saves: [] } }));
  try {
    setAccount(USER);
    assert.equal(accountWallet(), 1500, 'Kasse aus dem Konto');
    await saveWallet(1800.7);
    const ac = accountCalls(env.calls);
    assert.equal(ac.length, 1, 'eine Meldung ans Konto');
    assert.deepEqual(ac[0].body, { action: 'wallet', value: 1800 }, 'ganzzahlig gemeldet');
    assert.equal(accountWallet(), 1800);
    assert.equal(env.store.has(PENDING), false, 'bestätigt: nichts mehr vorgemerkt');
  } finally {
    env.restore();
  }
});

test('Der Browser übernimmt den Stand, den der Server zurückmeldet', async () => {
  const env = setup((url) => (url.endsWith('/api/auth.php') ? { body: { ok: true, wallet: 1500 } } : { body: { saves: [] } }));
  try {
    setAccount(USER);
    await saveWallet(900); // der Server meldet seinen Stand (hier 1500) zurück
    assert.equal(accountWallet(), 1500);
  } finally {
    env.restore();
  }
});

test('Grenzen: Kasse höchstens walletMax, nie negativ, ohne Zahl nichts gemeldet', async () => {
  const env = setup((url, body) => (url.endsWith('/api/auth.php') ? { body: { ok: true, wallet: body.value } } : { body: { saves: [] } }));
  try {
    setAccount(USER);
    await saveWallet(999999);
    assert.equal(accountWallet(), BALANCE.walletMax);
    await saveWallet(-40);
    assert.equal(accountWallet(), 0);
    const before = env.calls.length;
    await saveWallet(Number.NaN);
    assert.equal(env.calls.length, before, 'NaN wird nicht gemeldet');
  } finally {
    env.restore();
  }
});

test('ohne Netz: der Stand bleibt vorgemerkt und gewinnt bei der nächsten Anmeldung', async () => {
  let online = false;
  const env = setup((url, body) => {
    if (!url.endsWith('/api/auth.php')) return { body: { saves: [] } };
    if (!online) return new TypeError('Failed to fetch');
    return { body: { ok: true, wallet: body?.value ?? 900 } };
  });
  try {
    setAccount(USER);
    await saveWallet(2000); // Netz weg
    assert.equal(accountWallet(), 2000, 'das Spiel zeigt den neuen Stand schon');
    assert.deepEqual(JSON.parse(env.store.get(PENDING)), { value: 2000, email: USER.email }, 'vorgemerkt auf dem Gerät');

    online = true;
    const syncedAt = env.calls.length;
    setAccount({ ...USER, wallet: 900 }); // neue Anmeldung: der Server kennt noch 900, der Gerätestand ist neuer
    assert.equal(accountWallet(), 2000, 'der vorgemerkte Stand gewinnt');
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    const sent = accountCalls(env.calls.slice(syncedAt)).filter((c) => c.body.action === 'wallet');
    assert.equal(sent.length >= 1 && sent[0].body.value, 2000, 'beim Anmelden nachgeschickt');
    assert.equal(env.store.has(PENDING), false, 'bestätigt: Vormerkung gelöscht');
    assert.equal(accountWallet(), 2000);
  } finally {
    env.restore();
  }
});

test('vorgemerkter Stand eines anderen Kontos wird verworfen', async () => {
  const env = setup((url) => (url.endsWith('/api/auth.php') ? new TypeError('Failed to fetch') : { body: { saves: [] } }));
  try {
    setAccount(USER);
    await saveWallet(2222);
    assert.ok(env.store.has(PENDING));
    setAccount({ email: 'bernd@example.test', plan: 'free', premiumUntil: null, createdAt: 1, wallet: 300 });
    assert.equal(accountWallet(), 300, 'die Kasse des anderen Kontos');
    assert.equal(env.store.has(PENDING), false, 'fremder Stand fällt weg');
  } finally {
    env.restore();
  }
});

test('zurücksetzen: Startbetrag über die Konto-Aktion, auch wenn das Konto mehr hatte', async () => {
  const env = setup((url, body) => {
    if (!url.endsWith('/api/auth.php')) return { body: { saves: [] } };
    if (body.action === 'walletreset') return { body: { ok: true, wallet: BALANCE.startRes.money } };
    return { body: { ok: true, wallet: body.value } };
  });
  try {
    setAccount({ ...USER, wallet: 4000 });
    assert.equal(accountWallet(), 4000);
    const w = await resetWallet();
    assert.equal(w, BALANCE.startRes.money);
    assert.equal(accountWallet(), BALANCE.startRes.money);
    assert.equal(accountCalls(env.calls).at(-1).body.action, 'walletreset');
  } finally {
    env.restore();
  }
});

test('Sitzung abgelaufen (401): Kasse weg, Webspace aus, Stand bleibt für die nächste Anmeldung', async () => {
  const env = setup((url, body) => {
    if (!url.endsWith('/api/auth.php')) return { body: { saves: [] } };
    return body.action === 'wallet' ? { status: 401, body: { error: 'Nicht angemeldet' } } : { body: { ok: true } };
  });
  try {
    setAccount(USER);
    await saveWallet(1700);
    assert.equal(accountWallet(), null, 'ohne Sitzung zeigt das Spiel den Gast-Startbetrag');
    assert.deepEqual(JSON.parse(env.store.get(PENDING)), { value: 1700, email: USER.email });
  } finally {
    env.restore();
  }
});

test('zwei Meldungen, während die erste noch läuft: die neuere bleibt vorgemerkt und geht als Nächstes', async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  let first = true;
  const env = setup(async (url, body) => {
    if (!url.endsWith('/api/auth.php')) return { body: { saves: [] } };
    if (body.action === 'wallet' && first) {
      first = false;
      await gate;
    }
    return { body: { ok: true, wallet: body.value } };
  });
  try {
    setAccount(USER);
    const p1 = saveWallet(1800); // läuft (wartet auf das Gate)
    await new Promise((r) => setTimeout(r, 0)); // die erste Meldung ist jetzt unterwegs
    const p2 = saveWallet(2000); // neuerer Stand, während die erste Meldung unterwegs ist
    release();
    await p1;
    await p2;
    const sent = accountCalls(env.calls).filter((c) => c.body.action === 'wallet').map((c) => c.body.value);
    assert.deepEqual(sent, [1800, 2000], 'beide Stände kommen an, der neuere zuletzt');
    assert.equal(accountWallet(), 2000);
    assert.equal(env.store.has(PENDING), false, 'am Ende nichts mehr vorgemerkt');
  } finally {
    env.restore();
  }
});
