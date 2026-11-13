// Kasse am Konto (KA1, docs/prd/konto.md „Kasse am Konto“): Client-Logik von js/ui/saves.js ohne Browser. Gast: keine Kasse.
// Angemeldet: Kasse aus dem Konto, Anzeige nach Meldungen (noteWallet), Zurücksetzen, Sitzung abgelaufen (401).
// Den Stand am Partieende meldet seit dem Match-Start js/ui/match.js (test/match.test.js). Die Server-Seite wurde von Hand
// gegen MariaDB geprüft (docs/prd/konto.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { setAccount, accountWallet, noteWallet, resetWallet, setRemoteEnabled, listSaves } from '../js/ui/saves.js';
import { BALANCE } from '../js/data/balance.js';

const USER = { email: 'anna@example.test', plan: 'free', premiumUntil: null, createdAt: 1, wallet: 1500 };

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

const accountCalls = (calls) => calls.filter((c) => c.url.endsWith('/api/auth.php'));

test('Gast: keine Kasse am Konto, Meldungen bleiben aus, „zurücksetzen“ geht nicht', async () => {
  const env = setup(() => ({ body: { saves: [] } }));
  try {
    setAccount(null);
    assert.equal(accountWallet(), null, 'ohne Anmeldung keine Kasse (das Spiel nimmt den Startbetrag)');
    noteWallet(2400);
    assert.equal(accountWallet(), null, 'ohne Konto wird nichts angezeigt oder vorgemerkt');
    await assert.rejects(resetWallet(), /Nicht angemeldet/);
    assert.equal(accountCalls(env.calls).length, 0);
  } finally {
    env.restore();
  }
});

test('Anmelden: die Kasse kommt aus dem Konto', async () => {
  const env = setup(() => ({ body: { saves: [] } }));
  try {
    setAccount(USER);
    assert.equal(accountWallet(), 1500, 'Kasse aus dem Konto');
    assert.equal(env.store.has('frontline-kasse-ausstehend'), false, 'der alte Vormerk-Schlüssel ist weg');
  } finally {
    env.restore();
  }
});

test('noteWallet: ganzzahlig, höchstens walletMax, nie negativ; ohne Zahl nichts', () => {
  const env = setup(() => ({ body: { saves: [] } }));
  try {
    setAccount(USER);
    noteWallet(1800.7);
    assert.equal(accountWallet(), 1800);
    noteWallet(999999);
    assert.equal(accountWallet(), BALANCE.walletMax);
    noteWallet(-40);
    assert.equal(accountWallet(), 0);
    noteWallet(Number.NaN);
    assert.equal(accountWallet(), 0, 'NaN ändert nichts');
  } finally {
    env.restore();
  }
});

test('zurücksetzen: Startbetrag über die Konto-Aktion, auch wenn das Konto mehr hatte', async () => {
  const env = setup((url, body) => {
    if (!url.endsWith('/api/auth.php')) return { body: { saves: [] } };
    if (body.action === 'walletreset') return { body: { ok: true, wallet: BALANCE.startRes.money } };
    return { body: { ok: true } };
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

test('Sitzung abgelaufen (401 vom Webspace): Kasse weg, Webspace aus', async () => {
  const env = setup(() => ({ status: 401, body: { error: 'Nicht angemeldet' } }));
  try {
    setAccount(USER);
    assert.equal(accountWallet(), 1500);
    await listSaves();
    assert.equal(accountWallet(), null, 'ohne Sitzung zeigt das Spiel den Gast-Startbetrag');
  } finally {
    env.restore();
  }
});

test('Die Aktion wallet gibt es nicht mehr: die Kasse wird nicht mehr direkt gemeldet', async () => {
  const env = setup((url) => (url.endsWith('/api/auth.php') ? { body: { ok: true } } : { body: { saves: [] } }));
  try {
    setAccount(USER);
    noteWallet(2000);
    await listSaves();
    assert.equal(accountCalls(env.calls).some((c) => c.body?.action === 'wallet'), false);
  } finally {
    env.restore();
  }
});
