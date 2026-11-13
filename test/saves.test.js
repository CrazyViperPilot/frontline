// Spielstände (SP2): reine Logik von js/ui/saves.js ohne Browser. Abgleich Gerät/Webspace, Namen, Ids, Übernahme des alten Stands.
// Seit MS2: das Match-Token (meta.match) bleibt lokal und geht nie zum Webspace.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeSaves, syncPush, defaultName, cleanName, copyName, newSaveId, fromLegacy, describe, NAME_MAX,
  listSaves, setRemoteEnabled, remoteEnabled, accountUser, remoteMeta, storeSave, loadSave, syncUp,
} from '../js/ui/saves.js';

const UUID4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const meta = (id, updatedAt, extra = {}) => ({ id, name: `Stand ${id}`, version: 'v5.143', format: 5, createdAt: 1, updatedAt, gameTime: 60, points: [0, 0], winPoints: 100, difficulty: 'normal', ended: false, size: 10, ...extra });

test('Namen: „Partie TT.MM.JJJJ HH:MM“ aus dem Datum (Ortszeit, zweistellig)', () => {
  assert.equal(defaultName(new Date(2026, 10, 12, 9, 5)), 'Partie 12.11.2026 09:05');
  assert.equal(defaultName(new Date(2027, 0, 1, 23, 59)), 'Partie 01.01.2027 23:59');
});

test('Namen prüfen: getrimmt, 1 bis 60 Zeichen (Zeichen, nicht Bytes)', () => {
  assert.equal(cleanName('  Nordfront  '), 'Nordfront');
  assert.throws(() => cleanName('   '), /1 bis 60/);
  assert.throws(() => cleanName(''), /1 bis 60/);
  assert.throws(() => cleanName(undefined), /1 bis 60/);
  assert.equal(cleanName('ä'.repeat(NAME_MAX)), 'ä'.repeat(NAME_MAX));
  assert.throws(() => cleanName('ä'.repeat(NAME_MAX + 1)), /1 bis 60/);
  assert.equal(cleanName('😀'.repeat(NAME_MAX)).length, NAME_MAX * 2); // Emojis zählen je als ein Zeichen
  assert.throws(() => cleanName('😀'.repeat(NAME_MAX + 1)), /1 bis 60/);
});

test('Ids: UUID v4, auch ohne crypto.randomUUID', () => {
  assert.match(newSaveId(), UUID4);
  assert.notEqual(newSaveId(), newSaveId());
  const zeros = { getRandomValues: (b) => b.fill(0) };
  assert.equal(newSaveId(zeros), '00000000-0000-4000-8000-000000000000');
  assert.match(newSaveId({}), UUID4); // ganz ohne Zufallsquelle: Math.random
  assert.equal(newSaveId({ randomUUID: () => 'abc' }), 'abc');
});

test('Abgleich: je id gewinnt der neuere updatedAt, Quelle und Herkunft sind markiert', () => {
  const local = [meta('a', 10), meta('b', 50)];
  const remote = [meta('a', 20, { name: 'vom Webspace' }), meta('c', 30)];
  const list = mergeSaves(local, remote);
  assert.deepEqual(list.map((e) => e.meta.id), ['b', 'c', 'a'], 'neueste zuerst');
  const a = list.find((e) => e.meta.id === 'a');
  assert.equal(a.meta.name, 'vom Webspace');
  assert.equal(a.source, 'Webspace');
  assert.equal(a.inLocal, true);
  assert.equal(a.inRemote, true);
  const b = list.find((e) => e.meta.id === 'b');
  assert.deepEqual([b.source, b.inLocal, b.inRemote], ['lokal', true, false]);
  const c = list.find((e) => e.meta.id === 'c');
  assert.deepEqual([c.source, c.inLocal, c.inRemote], ['Webspace', false, true]);
});

test('Abgleich: der lokale Stand gewinnt bei gleichem updatedAt; offline bleibt es beim Gerät', () => {
  const list = mergeSaves([meta('a', 10, { name: 'lokal' })], [meta('a', 10, { name: 'fern' })]);
  assert.equal(list[0].meta.name, 'lokal');
  assert.equal(list[0].source, 'lokal');
  assert.deepEqual(mergeSaves([meta('a', 10)], []).map((e) => [e.inLocal, e.inRemote]), [[true, false]]);
});

test('Abgleich: vorgemerkte Löschungen fallen aus der Liste, lokal wie auf dem Webspace', () => {
  const list = mergeSaves([meta('a', 10), meta('b', 20)], [meta('a', 10), meta('x', 5)], ['a', 'x']);
  assert.deepEqual(list.map((e) => e.meta.id), ['b']);
});

test('Hochschicken: nur lokal neuere oder dort unbekannte Stände, keine gelöschten', () => {
  const local = [meta('a', 10), meta('b', 50), meta('c', 5), meta('d', 9)];
  const remote = [meta('a', 10), meta('b', 20), meta('gone', 1)];
  assert.deepEqual(syncPush(local, remote, ['d']).sort(), ['b', 'c']);
  assert.deepEqual(syncPush(local, [], []).sort(), ['a', 'b', 'c', 'd']);
});

test('Alter Einzelstand wird als „Alter Spielstand“ übernommen', () => {
  const bytes = new Uint8Array([0x1f, 0x8b, 1, 2]);
  const rec = fromLegacy({ meta: { savedAt: 1234, format: 5, gameTime: 99, points: [3, 4], winPoints: 100, difficulty: 'schwer', size: 4 }, bytes }, 'id-1');
  assert.equal(rec.meta.id, 'id-1');
  assert.equal(rec.meta.name, 'Alter Spielstand');
  assert.equal(rec.meta.createdAt, 1234);
  assert.equal(rec.meta.updatedAt, 1234);
  assert.equal(rec.meta.ended, false);
  assert.equal(rec.meta.difficulty, 'schwer');
  assert.equal(rec.bytes, bytes);
  const fresh = fromLegacy({ bytes });
  assert.match(fresh.meta.id, UUID4, 'ohne id wird eine neue vergeben');
});

test('Anzeige: Spielzeit, Punkte, Version und Quelle', () => {
  const t = describe(meta('a', 0, { gameTime: 65.4, points: [12, 7] }), 'Webspace');
  assert.match(t, /^Spielzeit 01:05 · Punkte 12 : 7 von 100 · normal · v5\.143 · gespeichert /);
  assert.match(t, /\(Webspace\)$/);
});

test('Kopie: „<Name> (Kopie)“, auf NAME_MAX Zeichen gekürzt', () => {
  assert.equal(copyName('Nordfront'), 'Nordfront (Kopie)');
  assert.equal(copyName('  Nordfront  '), 'Nordfront (Kopie)');
  assert.equal(copyName(''), '(Kopie)');
  const long = copyName('ä'.repeat(NAME_MAX));
  assert.equal([...long].length, NAME_MAX, 'Zeichen, nicht Bytes');
  assert.ok(long.endsWith(' (Kopie)'));
  assert.doesNotThrow(() => cleanName(long));
});

/** fetch-Attrappe für die Tests: zeichnet jeden Aufruf auf und antwortet mit `reply(url)`. */
function fakeFetch(reply) {
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, opts });
    const r = reply(url);
    return { ok: r.status === undefined || r.status < 400, status: r.status ?? 200, json: async () => r.body };
  };
  return calls;
}

test('Webspace ohne Anmeldung (401): nur das Gerät, ohne Fehler, ohne weitere Aufrufe', async () => {
  const realFetch = globalThis.fetch;
  try {
    const calls = fakeFetch(() => ({ status: 401, body: { error: 'Nicht angemeldet' } }));
    assert.equal(remoteEnabled(), true, 'Standard: an, bis der Webspace etwas anderes sagt');
    assert.deepEqual(await listSaves(), [], 'ohne Gerät- und Webspace-Stände leer, kein Fehler');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].opts.credentials, 'include', 'Sitzungs-Cookie geht mit');
    assert.equal(remoteEnabled(), false, '401 schaltet den Webspace aus');
    await listSaves();
    await listSaves();
    assert.equal(calls.length, 1, 'ohne Anmeldung kein weiterer Webspace-Aufruf');
    assert.equal(await setRemoteEnabled(false), 0, 'ausschalten ist ohne Aufruf');
    assert.equal(calls.length, 1);
  } finally {
    globalThis.fetch = realFetch;
    setRemoteEnabled(true);
  }
});

test('Anmelden: setRemoteEnabled(true) schaltet den Webspace ein und stößt syncUp an', async () => {
  const realFetch = globalThis.fetch;
  try {
    const calls = fakeFetch(() => ({ status: 401, body: { error: 'Nicht angemeldet' } }));
    await listSaves(); // schaltet aus
    assert.equal(remoteEnabled(), false);
    const sent = await setRemoteEnabled(true); // syncUp: Liste holen, 401 wieder: 0 hochgeschickt, kein Fehler
    assert.equal(sent, 0);
    assert.equal(calls.length, 2, 'der Abgleich versucht den Webspace einmal');
    assert.equal(remoteEnabled(), false, 'wieder 401: wieder aus');
  } finally {
    globalThis.fetch = realFetch;
    setRemoteEnabled(true);
  }
});

test('Konto abfragen: accountUser stellt den Webspace nach der Antwort von auth.php ein', async () => {
  const realFetch = globalThis.fetch;
  try {
    const calls = fakeFetch((url) => (url.endsWith('/api/auth.php')
      ? { body: { user: null } }
      : { body: { saves: [] } }));
    setRemoteEnabled(false);
    assert.equal(await accountUser(), null);
    assert.equal(remoteEnabled(), false);
    assert.match(calls[0].url, /\/api\/auth\.php$/);
    assert.equal(calls[0].opts.credentials, 'include');
    assert.equal(JSON.parse(calls[0].opts.body).action, 'me');

    fakeFetch(() => ({ body: { user: { email: 'anna@example.test', plan: 'free', premiumUntil: null, createdAt: 1 } } }));
    const user = await accountUser();
    assert.equal(user.email, 'anna@example.test');
    assert.equal(remoteEnabled(), true);
  } finally {
    globalThis.fetch = realFetch;
    setRemoteEnabled(true);
  }
});

/** IndexedDB-Attrappe mit dem, was ui/saves.js braucht: eine Datenbank, Store `saves`, get/put/getAll/delete (Werte werden kopiert). */
function fakeIndexedDb() {
  const dbs = new Map();
  const storeOf = (data) => ({
    get: (k) => ({ result: data.has(k) ? structuredClone(data.get(k)) : undefined }),
    put: (v, k) => {
      data.set(k, structuredClone(v));
      return { result: k };
    },
    getAll: () => ({ result: [...data.values()].map((v) => structuredClone(v)) }),
    delete: (k) => {
      data.delete(k);
      return { result: undefined };
    },
  });
  globalThis.indexedDB = {
    open(name) {
      const req = { result: null, onsuccess: null, onerror: null, onupgradeneeded: null };
      setTimeout(() => {
        const existed = dbs.has(name);
        if (!existed) dbs.set(name, new Map());
        const stores = dbs.get(name);
        req.result = {
          objectStoreNames: { contains: (n) => stores.has(n) },
          createObjectStore: (n) => {
            stores.set(n, new Map());
            return storeOf(stores.get(n));
          },
          deleteObjectStore: (n) => stores.delete(n),
          transaction: (n) => {
            const tx = { objectStore: () => storeOf(stores.get(n)), oncomplete: null, onerror: null, onabort: null };
            setTimeout(() => tx.oncomplete?.(), 0);
            return tx;
          },
          close() {},
        };
        req.onupgradeneeded?.({ oldVersion: existed ? 2 : 0 }); // bestehende Datenbank: schon Version 2, nichts zu tun
        req.onsuccess?.({});
      }, 0);
      return req;
    },
  };
}

test('Match-Token: remoteMeta lässt es weg, der Rest bleibt', () => {
  const m = meta('a', 5, { match: { token: 'tok-geheim', w0: 800 } });
  const r = remoteMeta(m);
  assert.equal('match' in r, false);
  assert.deepEqual(r, meta('a', 5));
  assert.equal(remoteMeta(meta('b', 1)).id, 'b', 'ohne match unverändert');
  assert.equal(m.match.token, 'tok-geheim', 'das Original bleibt, wie es war');
});

test('Match-Token: lokal im Stand, aber nie im Upload (Speichern und Abgleich)', async () => {
  const realFetch = globalThis.fetch;
  fakeIndexedDb();
  const calls = [];
  let online = true;
  globalThis.fetch = async (url, opts) => {
    calls.push({ url: String(url), opts });
    const isPost = opts?.method === 'POST';
    if (!online) throw new TypeError('Failed to fetch');
    if (!isPost && String(url).includes('?id=')) return { ok: false, status: 404, json: async () => ({ error: 'nicht gefunden' }) };
    return { ok: true, status: 200, json: async () => (isPost ? { ok: true } : { saves: [] }) };
  };
  try {
    setRemoteEnabled(true);
    const rec = { meta: meta('m1', 100, { match: { token: 'tok-geheim', w0: 800 } }), bytes: new Uint8Array([1, 2, 3]) };
    assert.equal(await storeSave(rec), 'beide');
    const posts = calls.filter((c) => c.opts?.method === 'POST');
    assert.equal(posts.length, 1);
    const sent = JSON.parse(posts[0].opts.body);
    assert.equal(sent.meta.id, 'm1');
    assert.equal('match' in sent.meta, false, 'kein match im Upload');
    assert.equal(posts[0].opts.body.includes('tok-geheim'), false, 'das Token steht nirgends im Upload');

    const local = await loadSave('m1');
    assert.deepEqual(local.meta.match, { token: 'tok-geheim', w0: 800 }, 'lokal bleibt es erhalten');

    // ohne Netz gespeichert, beim Abgleich nachgeschickt: auch dann ohne match
    online = false;
    const rec2 = { meta: meta('m2', 200, { match: { token: 'tok-zwei', w0: 800 } }), bytes: new Uint8Array([4]) };
    assert.equal(await storeSave(rec2), 'lokal');
    online = true;
    calls.length = 0;
    assert.equal(await syncUp(), 2, 'beide Stände kommen hoch');
    for (const c of calls.filter((x) => x.opts?.method === 'POST')) {
      assert.equal(c.opts.body.includes('"match"'), false);
      assert.equal(c.opts.body.includes('tok-'), false);
    }
    assert.deepEqual((await loadSave('m2')).meta.match, { token: 'tok-zwei', w0: 800 });
  } finally {
    globalThis.fetch = realFetch;
    delete globalThis.indexedDB;
    setRemoteEnabled(true);
  }
});
