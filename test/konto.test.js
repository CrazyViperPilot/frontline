// Konto-Bereich (KO4, docs/prd/konto.md „Konto-Bereich“): Nickname, Premium-Historie, Selbst-Deaktivierung und der Link
// „?deactivated=“ im Client, ohne Browser und ohne Server (fetch-Attrappe). Die Schnittstelle selbst prüft api/auth.php
// gegen MariaDB von Hand (siehe docs/prd/konto.md, Abschnitt „Tests“).
import test from 'node:test';
import assert from 'node:assert/strict';
import { showPause, takeAccountLink, wireAccount } from '../js/ui/menu.js';
import { premiumHistory, requestDeactivate, setAccount, setNickname, setRemoteEnabled } from '../js/ui/saves.js';

const USER = {
  email: 'anna@example.test', nickname: 'Anna', plan: 'premium', premiumUntil: 2000000000, createdAt: 1700000000, wallet: 1500, active: true,
};

/** fetch und Speicher nachbauen. reply(action, body) liefert die Antwort-Daten oder { error, status } für einen Fehler. */
function setup(reply = () => ({})) {
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
    const out = reply(body?.action, body) ?? {};
    if (out.error) return { ok: false, status: out.status ?? 400, json: async () => ({ error: out.error }) };
    return { ok: true, status: 200, json: async () => out };
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

/** Ein Element, das wireAccount braucht. */
function fakeBox() {
  return { innerHTML: '', isConnected: true, onclick: null, onsubmit: null, oninput: null };
}
const press = (box, act) => box.onclick({ target: { closest: (sel) => (sel === '[data-acc]' ? { dataset: { acc: act } } : null) } });
const send = (box, kind, values) =>
  box.onsubmit({
    target: {
      matches: (sel) => sel === '[data-acc-form]',
      dataset: { accForm: kind },
      elements: { namedItem: (n) => (n in values ? { value: values[n] } : null) },
    },
    preventDefault() {},
  });
const settle = () => new Promise((r) => setTimeout(r, 5));
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('Schnittstelle: setNickname schickt action und Nickname, liefert das Konto aus der Antwort', async () => {
  const f = setup((action) => (action === 'setnickname' ? { ok: true, user: { ...USER, nickname: 'Zoë' } } : {}));
  try {
    const user = await setNickname('  Zoë  ');
    assert.deepEqual(f.calls[0].body, { action: 'setnickname', nickname: '  Zoë  ' });
    assert.match(f.calls[0].url, /\/api\/auth\.php$/);
    assert.equal(user.nickname, 'Zoë');
    await setNickname(null);
    assert.equal(f.calls[1].body.nickname, '', 'null wird als leerer Nickname gesendet');
  } finally {
    f.restore();
  }
});

test('Schnittstelle: premiumHistory liefert die Liste (leer, wenn es keine gibt), requestDeactivate die Antwort', async () => {
  const hist = [{ plan: 'premium', premiumUntil: 2000000000, note: 'Probe', createdAt: 1700000100, changedBy: 'admin' }];
  const f = setup((action) => (action === 'premiumHistory' ? { history: hist } : { ok: true, message: 'Mail ist unterwegs' }));
  try {
    assert.deepEqual(await premiumHistory(), hist);
    assert.deepEqual(f.calls[0].body, { action: 'premiumHistory' });
    const d = await requestDeactivate();
    assert.deepEqual(f.calls[1].body, { action: 'deactivate' });
    assert.equal(d.message, 'Mail ist unterwegs');
  } finally {
    f.restore();
  }
  const g = setup(() => ({}));
  try {
    assert.deepEqual(await premiumHistory(), [], 'fehlt die Liste, ist sie leer');
  } finally {
    g.restore();
  }
});

test('Anfrage ohne Anmeldung: Fehler mit HTTP-Code (401) wird geworfen', async () => {
  const f = setup(() => ({ error: 'Nicht angemeldet', status: 401 }));
  try {
    await assert.rejects(requestDeactivate(), (err) => err.status === 401 && err.message === 'Nicht angemeldet');
  } finally {
    f.restore();
  }
});

test('Rücksprung „?deactivated=“: 1 und 0 gelesen, Parameter aus der Adresse entfernt, andere bleiben', () => {
  const realLoc = globalThis.location;
  const realHist = globalThis.history;
  const seen = [];
  globalThis.history = { state: null, replaceState: (_s, _t, url) => seen.push(url) };
  try {
    globalThis.location = { search: '?deactivated=1&debug=1', pathname: '/frontline/', hash: '#x' };
    assert.deepEqual(takeAccountLink(), { verified: null, reset: null, deactivated: true });
    assert.equal(seen.at(-1), '/frontline/?debug=1#x');
    globalThis.location = { search: '?deactivated=0', pathname: '/frontline/', hash: '' };
    assert.deepEqual(takeAccountLink(), { verified: null, reset: null, deactivated: false });
    assert.equal(seen.at(-1), '/frontline/');
    globalThis.location = { search: '?verified=1', pathname: '/frontline/', hash: '' };
    assert.deepEqual(takeAccountLink(), { verified: true, reset: null, deactivated: null });
    globalThis.location = { search: '', pathname: '/frontline/', hash: '' };
    assert.deepEqual(takeAccountLink(), { verified: null, reset: null, deactivated: null });
  } finally {
    globalThis.location = realLoc;
    globalThis.history = realHist;
  }
});

test('Startmenü (details): Knopf „Konto“ öffnet den Bereich mit E-Mail, Nickname, Konto-Art und Historie', async () => {
  const hist = [
    { plan: 'premium', premiumUntil: 2000000000, note: 'Probemonat', createdAt: 1700000100, changedBy: 'admin' },
    { plan: 'free', premiumUntil: null, note: null, createdAt: 1700000000, changedBy: 'admin' },
  ];
  const f = setup((action) => (action === 'premiumHistory' ? { history: hist } : {}));
  try {
    const box = fakeBox();
    wireAccount(box, { stats: true, details: true, init: { user: USER }, load: false });
    assert.match(box.innerHTML, /data-acc="konto"/);
    assert.match(box.innerHTML, /data-acc="stats"/);
    assert.doesNotMatch(box.innerHTML, /Premium-Historie/, 'zu, bis der Knopf gedrückt ist');
    press(box, 'konto');
    await settle();
    const t = text(box.innerHTML);
    assert.match(t, /E-Mail anna@example\.test/);
    assert.match(t, /Konto-Art Premium \(bis /);
    assert.match(t, /Erstellt am \d/);
    assert.match(box.innerHTML, /data-acc-form="nick"/);
    assert.match(box.innerHTML, /value="Anna"/);
    assert.match(t, /Probemonat/);
    assert.match(t, /Kostenlos/);
    assert.equal(f.calls.filter((c) => c.body.action === 'premiumHistory').length, 1);
    press(box, 'konto');
    assert.doesNotMatch(box.innerHTML, /data-acc-form="nick"/, 'zweiter Druck schließt');
  } finally {
    f.restore();
  }
});

test('Premium-Historie leer: Hinweis „Noch keine“; Fehler wird gezeigt', async () => {
  const f = setup((action) => (action === 'premiumHistory' ? { history: [] } : {}));
  try {
    const box = fakeBox();
    wireAccount(box, { details: true, init: { user: USER }, load: false });
    press(box, 'konto');
    await settle();
    assert.match(box.innerHTML, /Noch keine Änderung der Konto-Art/);
  } finally {
    f.restore();
  }
  const g = setup((action) => (action === 'premiumHistory' ? { error: 'Nicht angemeldet', status: 401 } : {}));
  try {
    const box = fakeBox();
    wireAccount(box, { details: true, init: { user: USER }, load: false });
    press(box, 'konto');
    await settle();
    assert.match(box.innerHTML, /Nicht angemeldet/);
  } finally {
    g.restore();
  }
});

test('Nickname speichern: Wert geht an setnickname, danach Hinweis und neuer Stand; Fehler bleibt im Bereich', async () => {
  const f = setup((action, body) => {
    if (action !== 'setnickname') return {};
    if (body.nickname.length > 32) return { error: 'Der Nickname darf höchstens 32 Zeichen lang sein.' };
    return { ok: true, user: { ...USER, nickname: body.nickname.trim() || null } };
  });
  try {
    const box = fakeBox();
    wireAccount(box, { details: true, init: { user: USER }, load: false });
    press(box, 'konto');
    await settle();
    send(box, 'nick', { nickname: '  Neu <Name>  ' });
    await settle();
    assert.equal(f.calls.at(-1).body.action, 'setnickname');
    assert.match(box.innerHTML, /Nickname gespeichert/);
    assert.match(box.innerHTML, /value="Neu &lt;Name&gt;"/, 'Nickname wird escaped angezeigt');
    send(box, 'nick', { nickname: '' });
    await settle();
    assert.match(box.innerHTML, /Nickname entfernt/);
    send(box, 'nick', { nickname: 'x'.repeat(40) });
    await settle();
    assert.match(box.innerHTML, /höchstens 32 Zeichen/);
  } finally {
    f.restore();
  }
});

test('Nickname-Eingabe bleibt beim Neuzeichnen erhalten (oninput merkt den Wert)', async () => {
  const f = setup((action) => (action === 'premiumHistory' ? { history: [] } : {}));
  try {
    const box = fakeBox();
    wireAccount(box, { details: true, init: { user: USER }, load: false });
    press(box, 'konto');
    box.oninput({ target: { name: 'nickname', value: 'Tippe gerade' } });
    press(box, 'konto');
    press(box, 'konto');
    await settle();
    assert.match(box.innerHTML, /value="Tippe gerade"/);
  } finally {
    f.restore();
  }
});

test('Konto löschen: Rückfrage zuerst, kein Versand; „Mail schicken“ schickt deactivate und zeigt den Hinweis', async () => {
  const f = setup((action) => (action === 'deactivate' ? { ok: true, message: 'Wir haben dir eine Bestätigungsmail geschickt. Nach dem Klick wird dein Konto deaktiviert; endgültig löschen kann nur der Admin. Der Link ist 48 Stunden gültig.' } : {}));
  try {
    const box = fakeBox();
    wireAccount(box, { details: true, init: { user: USER }, load: false });
    press(box, 'konto');
    press(box, 'deactivate');
    assert.match(box.innerHTML, /data-acc="deactivate-go"/);
    assert.match(text(box.innerHTML), /nicht gelöscht/);
    assert.equal(f.calls.length, 1, 'nur das Laden der Historie, noch kein Versand');
    press(box, 'deactivate-cancel');
    assert.doesNotMatch(box.innerHTML, /deactivate-go/);
    press(box, 'deactivate');
    press(box, 'deactivate-go');
    await settle();
    assert.equal(f.calls.at(-1).body.action, 'deactivate');
    assert.match(box.innerHTML, /Wir haben dir eine Bestätigungsmail geschickt/);
    assert.doesNotMatch(box.innerHTML, /deactivate-go/, 'Rückfrage ist danach zu');
  } finally {
    f.restore();
  }
});

test('Pausenmenü: kein Knopf „Konto“ (nur das Startmenü hat den Detailbereich)', () => {
  const root = { innerHTML: '', dataset: {}, hidden: true, querySelector: () => null, querySelectorAll: () => [] };
  showPause(root, () => {}, () => {}, null, null, null, { rated: false });
  assert.doesNotMatch(root.innerHTML, /data-acc="konto"/);
  const box = fakeBox();
  wireAccount(box, { compact: true, init: { user: USER }, load: false });
  assert.doesNotMatch(box.innerHTML, /data-acc="konto"/);
});

// Schnittstelle (Verdrahtung ohne Server): die Aktionen, die Sperre bei active = 0, der Link und die Historie stehen im Code.
// Das Verhalten selbst prüft die Hand-Probe gegen MariaDB (docs/prd/konto.md, „Tests“).
test('Schnittstelle: Aktionen, Link deactivate, active = 0 sperrt, Historie je Admin-Änderung', async () => {
  const { readFileSync } = await import('node:fs');
  const { spawnSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const root = fileURLToPath(new URL('..', import.meta.url));
  const auth = readFileSync(root + 'api/auth.php', 'utf8');
  const lib = readFileSync(root + 'api/lib/konto.php', 'utf8');
  const admin = readFileSync(root + 'api/admin.php', 'utf8');
  for (const action of ['setnickname', 'premiumHistory', 'deactivate']) {
    assert.match(auth, new RegExp(`case '${action}':`), `Aktion ${action} in auth.php`);
  }
  assert.match(auth, /GET-Link|isset\(\$_GET\['deactivate'\]\)/);
  assert.match(auth, /'deactivate', FL_DEACTIVATE_HOURS \* 3600/);
  assert.match(auth, /Konto ist deaktiviert, bitte wende dich an den Admin/);
  assert.match(lib, /u\.blocked = 0 AND u\.active = 1/, 'selbst deaktivierte Konten zählen nicht als angemeldet');
  assert.match(lib, /'verify','reset','deactivate'/);
  assert.match(lib, /CREATE TABLE IF NOT EXISTS premium_history/);
  assert.match(admin, /case 'activate': admin_activate\(\$pdo, \$body\); break;/);
  assert.match(admin, /fl_premium_record\(\$pdo, \$id, \$plan, \$until, \$note !== '' \? \$note : null, 'admin'\)/);
  assert.match(admin, /DELETE FROM premium_history WHERE user_id = :id/);
  const php = spawnSync('php', ['-l', root + 'api/auth.php'], { encoding: 'utf8' });
  if (php.error) return; // ohne PHP-Kommandozeile nur die Textprüfung oben
  assert.equal(php.status, 0, php.stdout + php.stderr);
});
