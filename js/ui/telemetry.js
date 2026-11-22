// Besucherstatistik im Browser (Regeln: docs/prd/statistik.md, Server: api/track.php). Kein Teil der Simulation, liest nur.
// Ereignisse sammeln und gebündelt senden (fetch mit keepalive, beim Verlassen navigator.sendBeacon), Herzschlag einer laufenden
// Partie, JavaScript-Fehler (gedrosselt), Rückmeldungen, Einwilligung und Spieler-ID.
//
// Datenschutz: Ohne Einwilligung wird auf dem Gerät nichts für die Statistik gespeichert; die Warteschlange liegt nur im Speicher.
// Gespeichert wird dann nur die Antwort auf die Frage (CONSENT_KEY), damit sie nicht immer wieder kommt. Mit Einwilligung:
// Spieler-ID (crypto.randomUUID) und Warteschlange in localStorage. Geräteeigenschaften (Bildschirm, Sprache) liest das Modul nie.
// Exporte: createTelemetry (testbar, alles eingespeist), installTelemetry (Browser), getTelemetry, CONSENT_KEY, PID_KEY, QUEUE_KEY, QUEUE_MAX.
import { GAME_VERSION } from '../version.js';

export const CONSENT_KEY = 'frontline-statistik'; // 'yes' | 'no'; fehlt = noch nicht gefragt
export const PID_KEY = 'frontline-statistik-id'; // Spieler-ID, nur mit Einwilligung
export const QUEUE_KEY = 'frontline-statistik-warteschlange'; // Warteschlange, nur mit Einwilligung
export const QUEUE_MAX = 200; // Ereignisse in der Warteschlange; darüber fallen die ältesten weg
const BATCH_MAX = 50; // Ereignisse je Anfrage (Grenze des Servers)
const BODY_MAX = 15000; // Byte je Anfrage (Server: 16384)
const FLUSH_MS = 15000; // Takt des Sendens
const TICK_MS = 5000; // Takt der Spielzeitmessung
const BEAT_S = 60; // Herzschlag je 60 s gespielter Zeit (sichtbar, nicht pausiert)
const ERRORS_MAX = 5; // Fehlermeldungen je Seitenaufruf
const TRACK_URL = `${new URL('../../api/', import.meta.url).href}track.php`;

const hex = (bytes, rnd) => Array.from(rnd(bytes), (b) => b.toString(16).padStart(2, '0')).join('');

/** Speicher, der nie wirft (localStorage kann fehlen oder gesperrt sein). */
function safeStorage(s) {
  return {
    get(k) {
      try {
        return s?.getItem(k) ?? null;
      } catch {
        return null;
      }
    },
    set(k, v) {
      try {
        s?.setItem(k, v);
      } catch {
        /* ohne Speicher: gilt nur für diesen Aufruf */
      }
    },
    remove(k) {
      try {
        s?.removeItem(k);
      } catch {
        /* nichts */
      }
    },
  };
}

/**
 * Statistik-Objekt. opts: page ('game' | 'editor'), enabled (false: nichts wird gesendet, Tests und lokale Entwicklung),
 * storage (localStorage-artig), now() → ms, request(url, body) → Promise<{ ok, status, data }>, beacon(url, text) → bool,
 * visible() → bool, randomBytes(n) → Uint8Array, uuid() → Spieler-ID, version.
 */
export function createTelemetry(opts = {}) {
  const page = opts.page ?? 'game';
  const enabled = !!opts.enabled;
  const store = safeStorage(opts.storage);
  const now = opts.now ?? (() => Date.now());
  const request = opts.request ?? (async () => ({ ok: false, status: 0 }));
  const beacon = opts.beacon ?? (() => false);
  const visible = opts.visible ?? (() => true);
  const rnd = opts.randomBytes ?? ((n) => crypto.getRandomValues(new Uint8Array(n)));
  const uuid = opts.uuid ?? (() => crypto.randomUUID());
  const version = opts.version ?? GAME_VERSION;
  const sid = hex(8, rnd); // Seitenaufruf, nur im Speicher

  const consent = () => {
    const v = store.get(CONSENT_KEY);
    return v === 'yes' || v === 'no' ? v : null;
  };
  const pid = () => (consent() === 'yes' ? store.get(PID_KEY) : null);

  let queue = [];
  if (consent() === 'yes') {
    try {
      const q = JSON.parse(store.get(QUEUE_KEY) ?? '[]');
      if (Array.isArray(q)) queue = q.filter((e) => e && typeof e.k === 'string' && Number.isFinite(e.at)).slice(-QUEUE_MAX);
    } catch {
      queue = [];
    }
  }
  const persist = () => {
    if (consent() === 'yes') store.set(QUEUE_KEY, JSON.stringify(queue));
  };

  let sending = false;
  let game = null; // laufende Partie: { gid, info, active (s), beats, probe, last }
  let lastGame = null; // { mode, dur } der letzten Partie (für Rückmeldungen nach dem Ende)
  const errorsSeen = new Set();

  function track(kind, data = null, gid = null) {
    if (!enabled) return;
    const e = { k: kind, at: now() };
    if (gid) e.g = gid;
    if (data) e.d = data;
    queue.push(e);
    if (queue.length > QUEUE_MAX) queue.splice(0, queue.length - QUEUE_MAX);
    persist();
  }

  /** Nächstes Bündel: höchstens BATCH_MAX Ereignisse und BODY_MAX Byte. Liefert { events, text } oder null. */
  function nextBatch() {
    if (!queue.length) return null;
    const events = [];
    const t = now();
    const body = { v: version, s: sid, p: pid(), pg: page, e: [] };
    for (const e of queue.slice(0, BATCH_MAX)) {
      const out = { k: e.k, a: Math.max(0, Math.round((t - e.at) / 1000)) };
      if (e.g) out.g = e.g;
      if (e.d) out.d = e.d;
      body.e.push(out);
      if (JSON.stringify(body).length > BODY_MAX) {
        body.e.pop();
        break;
      }
      events.push(e);
    }
    if (!events.length) {
      queue.shift(); // ein einzelnes zu großes Ereignis: verwerfen
      persist();
      return null;
    }
    return { events, text: JSON.stringify(body) };
  }

  const drop = (events) => {
    const sent = new Set(events);
    queue = queue.filter((e) => !sent.has(e));
    persist();
  };

  /** Senden. beaconMode: beim Verlassen der Seite (sendBeacon, ohne Antwort). Fehlschlag: Ereignisse bleiben in der Warteschlange. */
  async function flush(beaconMode = false) {
    if (!enabled) return;
    if (beaconMode) {
      for (let i = 0; i < 4; i++) {
        const b = nextBatch();
        if (!b || !beacon(TRACK_URL, b.text)) break;
        drop(b.events);
      }
      return;
    }
    if (sending) return;
    sending = true;
    try {
      for (let i = 0; i < 4; i++) {
        const b = nextBatch();
        if (!b) break;
        const res = await request(TRACK_URL, b.text, true).catch(() => ({ ok: false, status: 0 }));
        if (res.ok || res.status === 400 || res.status === 413) drop(b.events); // angenommen oder nie annehmbar
        else break; // offline oder Serverfehler: später erneut
      }
    } finally {
      sending = false;
    }
  }

  /** Partie beginnt. info: Daten des Start-Ereignisses; probe() → { paused, minute } der laufenden Partie. */
  function gameStart(info, probe) {
    if (game) gameEnd('quit');
    game = { gid: hex(8, rnd), info, active: 0, beats: 0, probe, last: now() };
    track('start', info, game.gid);
  }

  /** Takt (alle TICK_MS): gespielte Zeit zählt nur bei sichtbarem Tab und nicht pausiert; je 60 s ein Herzschlag. */
  function tick() {
    if (!game) return;
    const t = now();
    const dt = Math.min((t - game.last) / 1000, (TICK_MS / 1000) * 2); // Schlaf des Geräts zählt nicht
    game.last = t;
    const p = game.probe?.() ?? {};
    if (!visible() || p.paused) return;
    game.active += Math.max(0, dt);
    while (game.active >= (game.beats + 1) * BEAT_S) {
      game.beats++;
      track('beat', { m: Math.floor(p.minute ?? 0) }, game.gid);
    }
  }

  /** Partie endet: r = 'win' | 'loss' | 'quit' | 'close'. Ohne laufende Partie wirkungslos (kein doppeltes Ende). */
  function gameEnd(r) {
    if (!game) return;
    tick(); // Zeit seit dem letzten Takt mitnehmen (pausiert oder versteckt zählt sie nicht)
    const g = game;
    game = null;
    const minute = Math.floor(g.probe?.()?.minute ?? 0);
    lastGame = { mode: g.info?.mode ?? null, dur: Math.round(g.active) };
    track('end', { r, dur: Math.round(g.active), m: minute }, g.gid);
    flush();
  }

  /** JavaScript-Fehler: jede Meldung einmal, höchstens ERRORS_MAX je Seitenaufruf. file nur als Pfad. */
  function reportError(msg, file = '', line = 0) {
    const m = String(msg ?? '').slice(0, 300);
    if (!m || errorsSeen.has(m) || errorsSeen.size >= ERRORS_MAX) return;
    errorsSeen.add(m);
    let f = String(file ?? '');
    try {
      if (f) f = new URL(f).pathname;
    } catch {
      /* schon ein Pfad */
    }
    track('error', { msg: m, file: f.slice(0, 200), line: Number.isFinite(line) ? line : 0 });
  }

  /** Rückmeldung senden (auch ohne Einwilligung: der Spieler schickt sie selbst). Wirft mit Meldung bei Fehlern. */
  async function feedback({ text, thumb = null, place = null }) {
    const g = game ? { mode: game.info?.mode ?? null, dur: Math.round(game.active) } : lastGame;
    const body = { action: 'feedback', text: String(text ?? '').slice(0, 1000), thumb, v: version, dur: g?.dur ?? null, mode: g?.mode ?? null, place, p: pid() };
    const res = await request(TRACK_URL, JSON.stringify(body), false).catch(() => ({ ok: false, status: 0 }));
    if (!res.ok) throw new Error(res.data?.error ?? (res.status ? `Fehler ${res.status}` : 'Keine Verbindung zum Server. Bitte später erneut versuchen.'));
  }

  /** Einwilligung setzen. Ja: neue Spieler-ID, Warteschlange auf dem Gerät. Nein: Widerruf an den Server, ID und Warteschlange weg. */
  function setConsent(yes) {
    const old = store.get(PID_KEY);
    if (yes) {
      store.set(CONSENT_KEY, 'yes');
      if (!old) store.set(PID_KEY, uuid());
      persist();
      linkAccount();
    } else {
      store.set(CONSENT_KEY, 'no');
      store.remove(PID_KEY);
      store.remove(QUEUE_KEY);
      if (old && enabled) request(TRACK_URL, JSON.stringify({ action: 'optout', p: old }), false).catch(() => {});
    }
  }

  /** Angemeldetes Konto mit Einwilligung: dieselbe Spieler-ID auf allen Geräten (Server hält sie am Konto). */
  async function linkAccount() {
    const p = pid();
    if (!enabled || !p) return;
    const res = await request(TRACK_URL, JSON.stringify({ action: 'link', p }), false).catch(() => null);
    const got = res?.ok ? res.data?.pid : null;
    if (typeof got === 'string' && /^[0-9a-f-]{36}$/.test(got) && got !== p && consent() === 'yes') store.set(PID_KEY, got);
  }

  return {
    enabled,
    page,
    track,
    flush,
    tick,
    gameStart,
    gameEnd,
    reportError,
    feedback,
    setConsent,
    linkAccount,
    consent,
    pid,
    get queue() {
      return queue;
    },
    get running() {
      return !!game;
    },
  };
}

let instance = null;

/** Das Statistik-Objekt der Seite. Ohne installTelemetry (Tests, Node) eines, das nichts sendet. */
export function getTelemetry() {
  if (!instance) instance = createTelemetry({ enabled: false, storage: globalThis.localStorage });
  return instance;
}

/** Erfassung ist aus bei ?debug=1, lokaler Entwicklung, file: und automatisierten Browsern; ?statistik=1 schaltet sie zum Prüfen ein. */
function allowed() {
  const q = new URLSearchParams(location.search);
  if (q.get('statistik') === '1') return true;
  if (q.get('statistik') === '0' || q.get('debug') === '1') return false;
  if (navigator.webdriver) return false;
  return location.protocol === 'https:' && !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
}

/** POST an api/track.php. keepalive: darf das Schließen der Seite überleben. */
async function browserRequest(url, text, keepalive) {
  const res = await fetch(url, {
    method: 'POST',
    body: text,
    headers: { 'Content-Type': 'text/plain' }, // kein Preflight
    credentials: 'same-origin',
    cache: 'no-store',
    keepalive,
  });
  let data = null;
  if (res.status !== 204) data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

/**
 * Im Browser einrichten (js/main.js für 'game', js/editor/editor.js für 'editor'): Takt, Senden beim Verlassen, Fehler.
 * Der Seitenaufruf des Spiels zählt der Server selbst (index.php); der Editor meldet ihn hier.
 */
export function installTelemetry(page) {
  if (instance?.installed) return instance;
  const t = createTelemetry({
    page,
    enabled: allowed(),
    storage: globalThis.localStorage,
    request: browserRequest,
    beacon: (url, text) => navigator.sendBeacon?.(url, new Blob([text], { type: 'text/plain' })) ?? false,
    visible: () => document.visibilityState === 'visible',
  });
  t.installed = true;
  instance = t;
  if (!t.enabled) return t;
  if (page === 'editor') t.track('view');
  setInterval(() => t.tick(), TICK_MS);
  setInterval(() => t.flush(), FLUSH_MS);
  window.addEventListener('online', () => t.flush());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') t.flush(true);
  });
  window.addEventListener('pagehide', () => {
    t.gameEnd('close');
    t.flush(true);
  });
  window.addEventListener('error', (e) => t.reportError(e.message, e.filename, e.lineno));
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    t.reportError(r instanceof Error ? `${r.name}: ${r.message}` : `Unbehandelt: ${String(r)}`, r?.fileName ?? '', r?.lineNumber ?? 0);
  });
  setTimeout(() => t.flush(), 3000); // erste Ereignisse bald senden
  return t;
}
