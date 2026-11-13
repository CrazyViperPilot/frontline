// Spielstände speichern und fortsetzen (seit SP2: beliebig viele Stände, je mit id). Lokal in IndexedDB (Store `saves`,
// läuft offline) und zusätzlich auf Daniels Webspace (PHP `api/save.php` in diesem Repo, MySQL, phpexpert.de/frontline).
// Die Liste ist die Vereinigung beider Seiten; je id gewinnt der neuere `updatedAt`. Ohne Netz bleibt es beim Gerät;
// `syncUp()` schickt neuere lokale Stände später nach. Gelöscht wird auf beiden Seiten; ist der Webspace dabei nicht
// erreichbar, merkt sich das Gerät die Löschung (localStorage) und holt sie bei der nächsten Synchronisierung nach.
// Seit KO2 gehören die Stände auf dem Webspace einem Konto: ohne Anmeldung (Antwort 401) arbeitet das Spiel nur auf dem
// Gerät, ohne Fehlermeldungen. `setRemoteEnabled(true)` (nach dem Anmelden, KO3) schaltet den Webspace wieder ein und
// schickt die lokalen Stände ins Konto (`syncUp`). Seit KA1 gehört auch die Kasse (Geld von Runde zu Runde) dem Konto,
// siehe unten „Kasse am Konto“; ihren Stand am Partieende meldet seit dem Match-Start ui/match.js (api/match.php).
import { toB64, fromB64 } from '../core/snapshot.js';
import { BALANCE } from '../data/balance.js';

// Basis der Spiel-Adresse (Wurzel dieses Repos, z. B. https://phpexpert.de/frontline/): die API liegt daneben unter api/.
const DEPLOY_BASE = new URL('../../', import.meta.url);
export const REMOTE_URL = new URL('api/save.php', DEPLOY_BASE).href;
export const NAME_MAX = 60;
const DB = 'frontline-save';
const DB_VERSION = 2; // 1: ein Stand unter `current` im Store `save`; 2: Store `saves` nach id
const STORE = 'saves';
const OLD_STORE = 'save';
const OLD_KEY = 'current';
const TOMB_KEY = 'frontline-spielstand-loeschen'; // ids, die auf dem Webspace noch gelöscht werden müssen
const RENAME_KEY = 'frontline-spielstand-umbenannt'; // { id: name }: Umbenennungen, die der Webspace noch nicht bestätigt hat
const TIMEOUT = 15000;
export const ACCOUNT_URL = new URL('api/auth.php', DEPLOY_BASE).href; // Konten (KO1), Sitzung über das Cookie fl_session
export const MATCH_URL = new URL('api/match.php', DEPLOY_BASE).href; // Match-Start (MS1, ui/match.js), gleiche Sitzung
let remoteOn = true; // false: nicht angemeldet (401 vom Webspace oder setRemoteEnabled(false)); dann kein Webspace-Zugriff

/**
 * Meta: { id, name, version (Spielversion), format (SAVE_FORMAT), createdAt, updatedAt (ms seit 1970), gameTime,
 *         points: [blau, rot], winPoints, difficulty, ended (bool), size (Bytes gepackt) }.
 * Rec (lokal und beim Laden): { meta, bytes (gzip) }. Liste (listSaves): { meta, source: 'lokal' | 'Webspace', inLocal, inRemote }.
 */

// ---- Datenbank lokal ----------------------------------------------------------------------------------------------

function openDb() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, DB_VERSION);
    r.onupgradeneeded = (e) => upgrade(r.result, r.transaction, e.oldVersion);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

/** Version 1 → 2: der bisherige Einzelstand wird einmal als „Alter Spielstand“ übernommen, danach fällt der alte Store weg. */
function upgrade(db, tx, oldVersion) {
  if (oldVersion >= DB_VERSION) return;
  const store = db.createObjectStore(STORE);
  if (!db.objectStoreNames.contains(OLD_STORE)) return;
  const req = tx.objectStore(OLD_STORE).get(OLD_KEY);
  req.onsuccess = () => {
    try {
      if (req.result) {
        const rec = fromLegacy(req.result);
        store.put(rec, rec.meta.id);
      }
    } catch {
      /* unlesbarer Altstand: verworfen, der Start darf nicht scheitern */
    }
    db.deleteObjectStore(OLD_STORE);
  };
}

async function idb(mode, fn) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req?.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

const readAllLocal = () => idb('readonly', (s) => s.getAll()).then((r) => r ?? []);
const readLocal = (id) => idb('readonly', (s) => s.get(id)).then((r) => r ?? null);
const writeLocal = (rec) => idb('readwrite', (s) => s.put(rec, rec.meta.id));
const deleteLocal = (id) => idb('readwrite', (s) => s.delete(id));

/** Löschungen, die der Webspace noch nicht bestätigt hat. */
function loadTombs() {
  try {
    const list = JSON.parse(localStorage.getItem(TOMB_KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function saveTombs(list) {
  try {
    localStorage.setItem(TOMB_KEY, JSON.stringify([...new Set(list)]));
  } catch {
    /* kein Speicher: die Löschung gilt dann nur für diese Sitzung */
  }
}

/** Umbenennungen, die der Webspace noch nicht bestätigt hat ({ id: name }). */
function loadRenames() {
  try {
    const o = JSON.parse(localStorage.getItem(RENAME_KEY) ?? '{}');
    if (!o || typeof o !== 'object' || Array.isArray(o)) return {};
    return Object.fromEntries(Object.entries(o).filter(([, v]) => typeof v === 'string'));
  } catch {
    return {};
  }
}

function saveRenames(o) {
  try {
    localStorage.setItem(RENAME_KEY, JSON.stringify(o));
  } catch {
    /* kein Speicher: der Name gilt dann nur auf diesem Gerät für diese Sitzung */
  }
}

/** Den vorgemerkten Namen auf eine Meta-Zeile legen (das updatedAt bleibt unberührt). */
function withPendingName(meta) {
  const name = loadRenames()[meta.id];
  return name ? { ...meta, name } : meta;
}

// ---- Webspace ------------------------------------------------------------------------------------------------------

/** Fehler „nicht angemeldet“ (wie vom Webspace mit 401), ohne Netzzugriff. */
function signedOutError() {
  const err = new Error('Nicht angemeldet');
  err.status = 401;
  return err;
}

async function remote(method, query = '', body = null) {
  if (!remoteOn) throw signedOutError();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(REMOTE_URL + query, {
      method,
      body: body ? JSON.stringify(body) : undefined,
      headers: body ? { 'Content-Type': 'text/plain' } : undefined, // kein Preflight nötig
      signal: ctrl.signal,
      cache: 'no-store',
      credentials: 'include', // Sitzungs-Cookie fl_session (Konto)
    });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401) remoteOn = false; // nicht angemeldet: ab jetzt nur das Gerät, bis setRemoteEnabled(true)
      const err = new Error(data.error ?? `Serverfehler ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

const remoteList = async () => (await remote('GET')).saves ?? [];
const remoteGet = async (id) => {
  const d = await remote('GET', `?id=${encodeURIComponent(id)}`);
  return { meta: d.meta, bytes: fromB64(d.data) };
};
const remotePush = (rec) => remote('POST', '', { action: 'save', meta: rec.meta, data: toB64(rec.bytes) });
const remoteRename = (id, name) => remote('POST', '', { action: 'rename', id, name });
const remoteDelete = (id) => remote('POST', '', { action: 'delete', id }); // idempotent: unbekannte id ist kein Fehler

// ---- Reine Logik (ohne Browser, geprüft in test/saves.test.js) ------------------------------------------------------

/** Vereinigung lokal + Webspace: je id gewinnt der neuere updatedAt (bei Gleichstand das Gerät); Löschungen fallen weg. */
export function mergeSaves(localMetas, remoteMetas, tombs = []) {
  const gone = new Set(tombs);
  const map = new Map();
  for (const m of localMetas) {
    if (!gone.has(m.id)) map.set(m.id, { meta: m, source: 'lokal', inLocal: true, inRemote: false });
  }
  for (const m of remoteMetas) {
    if (gone.has(m.id)) continue;
    const e = map.get(m.id);
    if (!e) {
      map.set(m.id, { meta: m, source: 'Webspace', inLocal: false, inRemote: true });
    } else {
      e.inRemote = true;
      if (m.updatedAt > e.meta.updatedAt) {
        e.meta = m;
        e.source = 'Webspace';
      }
    }
  }
  return [...map.values()].sort((a, b) => b.meta.updatedAt - a.meta.updatedAt);
}

/** ids, die beim Abgleich zum Webspace hochzuschicken sind: lokal neuer oder dort unbekannt (Löschungen ausgenommen). */
export function syncPush(localMetas, remoteMetas, tombs = []) {
  const gone = new Set(tombs);
  const remoteById = new Map(remoteMetas.map((m) => [m.id, m]));
  return localMetas
    .filter((m) => !gone.has(m.id) && (!remoteById.has(m.id) || m.updatedAt > remoteById.get(m.id).updatedAt))
    .map((m) => m.id);
}

/** Standardname „Partie TT.MM.JJJJ HH:MM“ (Ortszeit). */
export function defaultName(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `Partie ${p(date.getDate())}.${p(date.getMonth() + 1)}.${date.getFullYear()} ${p(date.getHours())}:${p(date.getMinutes())}`;
}

/** Name der Kopie „<Name> (Kopie)“, auf NAME_MAX Zeichen gekürzt. */
export function copyName(name) {
  const suffix = ' (Kopie)';
  const base = [...String(name ?? '').trim()].slice(0, NAME_MAX - suffix.length).join('');
  return `${base}${suffix}`.trim();
}

/** Name prüfen wie der Server: getrimmt, 1 bis 60 Zeichen. Wirft bei Verstoß. */
export function cleanName(name) {
  const t = String(name ?? '').trim();
  const len = [...t].length;
  if (len < 1 || len > NAME_MAX) throw new Error(`Name muss 1 bis ${NAME_MAX} Zeichen haben`);
  return t;
}

/** Neue UUID (v4) für einen Stand. Ohne crypto.randomUUID (etwa ohne HTTPS) über getRandomValues oder Math.random. */
export function newSaveId(c = globalThis.crypto) {
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  const b = new Uint8Array(16);
  if (typeof c?.getRandomValues === 'function') c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Alter Einzelstand (Version 1: meta.savedAt) als neuer Stand. Die Spielversion ist unbekannt. */
export function fromLegacy(old, id = newSaveId()) {
  const m = old.meta ?? {};
  const at = Number.isFinite(m.savedAt) ? m.savedAt : Date.now();
  const meta = {
    id,
    name: 'Alter Spielstand',
    version: 'unbekannt',
    format: Number.isFinite(m.format) ? m.format : 0,
    createdAt: at,
    updatedAt: at,
    gameTime: m.gameTime,
    points: m.points,
    winPoints: m.winPoints,
    difficulty: m.difficulty ?? 'normal',
    ended: false,
    size: m.size ?? old.bytes.length,
  };
  return { meta, bytes: old.bytes };
}

// ---- Öffentliche Schnittstelle --------------------------------------------------------------------------------------

let chain = Promise.resolve(); // Schreibvorgänge nacheinander
function queue(fn) {
  const job = chain.then(fn);
  chain = job.catch(() => {});
  return job;
}

/**
 * Webspace ein- oder ausschalten (KO3 ruft es nach Anmelden und Abmelden). Ein Wechsel auf „an“ schickt die lokalen
 * Stände ins Konto (`syncUp`). Liefert das Ergebnis von syncUp (Zahl der hochgeschickten Stände, 0 ohne Netz).
 * Standard: an. Eine Antwort 401 vom Webspace schaltet es selbst aus.
 */
export function setRemoteEnabled(on) {
  const was = remoteOn;
  remoteOn = !!on;
  return remoteOn && !was ? syncUp().catch(() => 0) : Promise.resolve(0);
}

/** Ist der Webspace eingeschaltet (angemeldet oder noch nicht geprüft)? */
export function remoteEnabled() {
  return remoteOn;
}

/**
 * Anfrage an eine API-Adresse (Cookie wird mitgeschickt), z. B. ACCOUNT_URL mit { action: 'me' }. Liefert die JSON-Antwort;
 * Netzfehler und Fehler mit HTTP-Code werfen (err.status, err.message = Satz aus der API).
 */
export async function apiRequest(url, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'text/plain' }, // kein Preflight nötig
      signal: ctrl.signal,
      cache: 'no-store',
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.error ?? `Serverfehler ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

/** Anfrage an api/auth.php (Konto). */
export function accountRequest(body) {
  return apiRequest(ACCOUNT_URL, body);
}

/**
 * Wer ist angemeldet? Fragt api/auth.php „me“ und stellt den Webspace entsprechend ein (setAccount).
 * Liefert { email, plan, premiumUntil, createdAt, wallet } oder null (nicht angemeldet). Netzfehler werfen.
 */
export async function accountUser() {
  const d = await accountRequest({ action: 'me' });
  const user = d.user ?? null;
  setAccount(user);
  return user;
}

// ---- Kasse am Konto (KA1, docs/prd/konto.md „Kasse am Konto“) -------------------------------------------------------
// Die Kasse (Geld von Runde zu Runde) gibt es nur am Konto: Gäste starten jede Partie mit dem Startbetrag, ohne Wertung.
// Angemeldet zeigt das Spiel die Kasse aus dem Konto (Anmeldung, Antworten des Servers). Den Stand am Partieende meldet
// seit dem Match-Start ui/match.js (api/match.php, finish), nur für gewertete Partien.
let walletEmail = null; // Konto der Kasse (null: nicht angemeldet)
let walletCache = null; // Kasse dieses Kontos in Geld, null ohne Anmeldung

/** Anmeldestand übernehmen (Kasse aus dem Konto). Der alte Vormerk-Schlüssel der Kasse (KA1) ist mit dem Match-Start überholt. */
function noteUser(user) {
  try {
    localStorage.removeItem('frontline-kasse-ausstehend');
  } catch {
    /* ohne Speicher: nichts zu räumen */
  }
  if (!user) {
    walletEmail = null;
    walletCache = null;
    return;
  }
  walletEmail = user.email;
  walletCache = Number.isFinite(user.wallet) ? user.wallet : BALANCE.startRes.money;
}

/** E-Mail des angemeldeten Kontos (null ohne Anmeldung). */
export function accountEmail() {
  return walletEmail;
}

/** Kassenstand, den ein Vorgang gemeldet hat (Wertung, Vorrat): ganzzahlig, 0 bis walletMax; nur angemeldet. */
export function noteWallet(value) {
  const v = Math.floor(Number(value));
  if (walletEmail === null || !Number.isFinite(v)) return;
  walletCache = Math.max(0, Math.min(BALANCE.walletMax, v));
}

/**
 * Anmelden (user aus auth.php) oder Abmelden (null): merkt die Kasse und schaltet den Webspace ein oder aus (setRemoteEnabled).
 * Liefert das Ergebnis von setRemoteEnabled (wartbar).
 */
export function setAccount(user) {
  noteUser(user);
  return setRemoteEnabled(user !== null);
}

/** Kasse des angemeldeten Kontos in Geld; null für Gäste (und solange die Anmeldung noch nicht feststeht). */
export function accountWallet() {
  return remoteOn ? walletCache : null;
}

/** „zurücksetzen“ im Startmenü: die Kasse des Kontos auf den Startbetrag setzen. Wirft, wenn es nicht klappt (Netz, Anmeldung). */
export function resetWallet() {
  return queue(async () => {
    if (walletEmail === null) throw new Error('Nicht angemeldet');
    const d = await accountRequest({ action: 'walletreset' });
    walletCache = Number.isFinite(d.wallet) ? d.wallet : walletCache;
    return walletCache;
  });
}

/**
 * Alle Stände (lokal und Webspace), neueste zuerst. Ist der Webspace nicht erreichbar, bleibt es bei den lokalen
 * (inRemote: false). Liefert [{ meta, source, inLocal, inRemote }]; source ist die Quelle der angezeigten Fassung.
 */
export async function listSaves() {
  const local = await readAllLocal().catch(() => []);
  let remoteMetas = [];
  try {
    remoteMetas = await remoteList();
  } catch {
    /* offline oder Fehler: nur das Gerät */
  }
  return mergeSaves(
    local.map((r) => r.meta),
    remoteMetas,
    loadTombs(),
  ).map((e) => ({ ...e, meta: withPendingName(e.meta) }));
}

/**
 * Einen Stand laden: der neuere von Gerät und Webspace (ein neuerer Webspace-Stand wird lokal übernommen).
 * Liefert { meta, bytes } oder null (unbekannt oder gelöscht).
 */
export async function loadSave(id) {
  if (loadTombs().includes(id)) return null;
  const local = await readLocal(id).catch(() => null);
  let rm = null;
  try {
    rm = await remoteGet(id);
  } catch {
    /* nicht auf dem Webspace oder offline: der lokale Stand */
  }
  if (rm && (!local || rm.meta.updatedAt > local.meta.updatedAt)) {
    await queue(() => writeLocal(rm)).catch(() => {});
    return { ...rm, meta: withPendingName(rm.meta) };
  }
  return local && { ...local, meta: withPendingName(local.meta) };
}

/**
 * Speichert einen Stand (rec = { meta, bytes }) lokal und auf dem Webspace. Liefert 'beide' oder 'lokal'
 * (Webspace nicht erreichbar oder Fehler: wird nur gemeldet, nicht geworfen). Lokal ist der Stand dann sicher.
 */
export function storeSave(rec) {
  return queue(async () => {
    await writeLocal(rec);
    try {
      await remotePush(rec);
      return 'beide';
    } catch (err) {
      if (remoteOn) console.warn('Spielstand nur auf dem Gerät gespeichert:', err?.message ?? err); // nicht angemeldet: still
      return 'lokal';
    }
  });
}

/**
 * Umbenennen (Name 1 bis 60 Zeichen). Der Zeitstempel (updatedAt) bleibt überall unverändert: ein veralteter Stand darf
 * keinen neueren überschreiben. Gelingt das Umbenennen auf dem Webspace nicht, merkt sich das Gerät den Namen
 * (RENAME_KEY) und schickt ihn beim nächsten syncUp nach. Liefert 'beide' | 'lokal'. Wirft, wenn der Stand weder
 * lokal noch auf dem Webspace existiert.
 */
export function renameSave(id, name) {
  const clean = cleanName(name);
  return queue(async () => {
    const rec = await readLocal(id).catch(() => null);
    let remoteOk = true;
    try {
      await remoteRename(id, clean);
    } catch (err) {
      remoteOk = false;
      if (!rec) throw new Error(err?.status === 404 ? 'Stand nicht gefunden' : `Umbenennen fehlgeschlagen: ${err.message ?? err}`);
    }
    if (rec) {
      rec.meta.name = clean;
      await writeLocal(rec);
    }
    const pending = loadRenames();
    if (remoteOk) delete pending[id];
    else if (remoteOn) pending[id] = clean; // nicht angemeldet (remoteOn false): nichts vormerken
    saveRenames(pending);
    return remoteOk ? 'beide' : 'lokal';
  });
}

/** Löscht einen Stand lokal und auf dem Webspace; ist dieser nicht erreichbar, wird die Löschung vorgemerkt (syncUp). */
export function deleteSave(id) {
  return queue(async () => {
    await deleteLocal(id).catch(() => {});
    const pending = loadRenames();
    if (id in pending) {
      delete pending[id];
      saveRenames(pending);
    }
    try {
      await remoteDelete(id);
    } catch {
      if (remoteOn) saveTombs([...loadTombs(), id]); // nicht angemeldet: der Webspace hat den Stand nie (für dieses Gerät)
    }
  });
}

/**
 * Abgleich nach dem Start oder nach Offline-Spielen: Löschungen nachholen, neuere lokale Stände hochschicken.
 * Liefert die Zahl der hochgeschickten Stände (0, wenn der Webspace nicht erreichbar ist).
 */
export function syncUp() {
  return queue(async () => {
    let remoteMetas;
    try {
      remoteMetas = await remoteList();
    } catch {
      return 0;
    }
    for (const [id, name] of Object.entries(loadRenames())) {
      try {
        await remoteRename(id, name);
      } catch (err) {
        if (err?.status !== 404) continue; // beim nächsten Mal; 404: der Stand ist dort nicht (mehr)
      }
      const pending = loadRenames();
      delete pending[id];
      saveRenames(pending);
    }
    const tombs = loadTombs();
    for (const id of tombs) {
      try {
        await remoteDelete(id);
        saveTombs(loadTombs().filter((x) => x !== id));
      } catch {
        /* beim nächsten Mal */
      }
    }
    const local = await readAllLocal();
    const ids = syncPush(
      local.map((r) => r.meta),
      remoteMetas,
      tombs,
    );
    let sent = 0;
    for (const id of ids) {
      const rec = local.find((r) => r.meta.id === id);
      try {
        await remotePush(rec);
        sent++;
      } catch {
        /* beim nächsten Mal */
      }
    }
    return sent;
  });
}

/** Eine Zeile für die Anzeige: Spielzeit, Punkte, Schwierigkeit, Spielversion, Zeitpunkt und Quelle. */
export function describe(meta, source) {
  const t = Math.floor(meta.gameTime);
  const mm = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  const when = new Date(meta.updatedAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
  return `Spielzeit ${mm} · Punkte ${meta.points[0]} : ${meta.points[1]} von ${meta.winPoints} · ${meta.difficulty} · ${meta.version} · gespeichert ${when} (${source})`;
}
