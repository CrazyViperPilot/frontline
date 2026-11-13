// Konto im Pausenmenü (seit v5.157, docs/prd/konto.md „Konto im Pausenmenü“): Anzeige je Stand, Anmelden und Abmelden über
// wireAccount (js/ui/menu.js, gemeinsam mit dem Startmenü), ohne Browser. Gewertete Partie: nur Anzeige, kein Wechsel.
import test from 'node:test';
import assert from 'node:assert/strict';
import { showPause, wireAccount } from '../js/ui/menu.js';
import { setAccount, setRemoteEnabled } from '../js/ui/saves.js';

const USER = { email: 'anna@example.test', plan: 'free', premiumUntil: null, createdAt: 1, wallet: 1500 };

/** Browser-Speicher und fetch nachbauen: auth.php antwortet mit USER (login, me) oder leer (logout), sonst leere Stände. */
function setup() {
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
    const isAccount = String(url).endsWith('auth.php');
    const data = !isAccount ? { saves: [] } : body?.action === 'logout' ? {} : { user: USER };
    return { ok: true, status: 200, json: async () => data };
  };
  return {
    calls,
    restore() {
      globalThis.localStorage = realLS;
      globalThis.fetch = realFetch;
      setAccount(null);
      setRemoteEnabled(true);
    },
  };
}

/** Ein Element, das wireAccount braucht: innerHTML, isConnected und die Ereignisfelder. */
function fakeBox() {
  return { innerHTML: '', isConnected: true, onclick: null, onsubmit: null };
}
/** Klick auf einen Knopf im Konto-Bereich (data-acc). */
const press = (box, act) => box.onclick({ target: { closest: (sel) => (sel === '[data-acc]' ? { dataset: { acc: act } } : null) } });
/** Formular absenden (data-acc-form), Felder aus values. */
const send = (box, kind, values) =>
  box.onsubmit({
    target: {
      matches: (sel) => sel === '[data-acc-form]',
      dataset: { accForm: kind },
      elements: { namedItem: (n) => (n in values ? { value: values[n] } : null) },
    },
    preventDefault() {},
  });
/** Warten, bis die Anfragen durch sind (fetch-Attrappe antwortet sofort). */
const settle = () => new Promise((r) => setTimeout(r, 5));
const buttons = (html) => [...html.matchAll(/data-acc="([a-z]+)"/g)].map((m) => m[1]);

test('Pausenmenü ohne Konto-Angabe: kein Konto-Abschnitt (Tests und alte Aufrufe)', () => {
  const root = { innerHTML: '', dataset: {}, hidden: true, querySelector: () => null, querySelectorAll: () => [] };
  showPause(root, () => {}, () => {});
  assert.doesNotMatch(root.innerHTML, /data-account/);
  assert.doesNotMatch(root.innerHTML, /Anmelden|Registrieren/);
});

test('Pausenmenü mit Konto-Angabe: der Abschnitt steht im Menü', () => {
  const root = { innerHTML: '', dataset: {}, hidden: true, querySelector: () => null, querySelectorAll: () => [] };
  showPause(root, () => {}, () => {}, null, null, null, { rated: false });
  assert.match(root.innerHTML, /<section class="account" data-account/);
});

test('abgemeldet im Pausenmenü: nur Anmelden und Registrieren, kein Passwort-vergessen-Knopf', () => {
  const env = setup();
  try {
    const box = fakeBox();
    wireAccount(box, { compact: true, load: false, init: { user: null }, hint: 'Hinweis' });
    assert.deepEqual(buttons(box.innerHTML), ['login', 'register']);
    assert.match(box.innerHTML, /Hinweis/);
    assert.doesNotMatch(box.innerHTML, /Passwort vergessen|forgot/);
    assert.equal(env.calls.length, 0, 'load: false fragt den Server nicht ab');
  } finally {
    env.restore();
  }
});

test('angemeldet im Pausenmenü: „Angemeldet als“ mit E-Mail und Abmelden, ohne Konto-Art', () => {
  const env = setup();
  try {
    const box = fakeBox();
    wireAccount(box, { compact: true, load: false, init: { user: { email: USER.email } } });
    assert.match(box.innerHTML, /Angemeldet als <b>anna@example\.test<\/b>/);
    assert.doesNotMatch(box.innerHTML, /Konto: /);
    assert.deepEqual(buttons(box.innerHTML), ['logout']);
  } finally {
    env.restore();
  }
});

test('gewertete Partie: nur die Anzeige, kein Knopf zum Abmelden oder Anmelden', () => {
  const env = setup();
  try {
    const box = fakeBox();
    wireAccount(box, { compact: true, load: false, init: { user: { email: USER.email } }, locked: 'Gewertete Partie: An- und Abmelden erst nach dem Endstand.' });
    assert.match(box.innerHTML, /Angemeldet als <b>anna@example\.test<\/b>/);
    assert.match(box.innerHTML, /erst nach dem Endstand/);
    assert.deepEqual(buttons(box.innerHTML), []);
    assert.doesNotMatch(box.innerHTML, /<form/);
  } finally {
    env.restore();
  }
});

test('im Pausenmenü anmelden: die Anzeige wechselt, der Webspace geht an, onSynced läuft danach', async () => {
  const env = setup();
  try {
    const box = fakeBox();
    let changed = null;
    let synced = 0;
    wireAccount(box, {
      compact: true,
      load: false,
      init: { user: null },
      onChanged: (u) => { changed = u; },
      onSynced: () => { synced += 1; },
    });
    press(box, 'login');
    assert.match(box.innerHTML, /data-acc-form="login"/, 'Knopf Anmelden öffnet das Formular');
    send(box, 'login', { email: USER.email, password: 'geheim123' });
    await settle();
    assert.equal(changed?.email, USER.email, 'onChanged bekommt den Konto-Benutzer');
    assert.match(box.innerHTML, /Angemeldet als <b>anna@example\.test<\/b>/);
    assert.equal(synced, 1, 'Webspace-Abgleich abgeschlossen, onSynced einmal');
    assert.ok(env.calls.some((c) => c.body?.action === 'login'));
  } finally {
    env.restore();
  }
});

test('im Pausenmenü abmelden: Anzeige wieder abgemeldet, Abmelden geht an den Server', async () => {
  const env = setup();
  try {
    const box = fakeBox();
    wireAccount(box, { compact: true, load: false, init: { user: { email: USER.email } } });
    press(box, 'logout');
    await settle();
    assert.deepEqual(buttons(box.innerHTML), ['login', 'register']);
    assert.ok(env.calls.some((c) => c.body?.action === 'logout'));
  } finally {
    env.restore();
  }
});
