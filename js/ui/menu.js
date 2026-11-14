// Overlay-Menüs (docs/verlauf.md §5 ui/menu.js): Start, Pause, Hilfe, Ende. Reines DOM, keine Spiellogik.
// Jedes Menü setzt root.dataset.kind ('start' | 'pause' | 'help' | 'end'), damit die Tastatur weiß, was offen ist.
import { BALANCE } from '../data/balance.js';
import { listMaps, deleteMap, saveMap, normalizeMap, describeMap } from '../game/mapdata.js';
import { WEATHER_SETTINGS } from '../game/weather.js';
import { MOOD_SETTINGS } from '../render/mood.js';
import { SOUND_KEY, loadLevel, saveLevel } from '../audio/sound.js';
import { KEYS } from './helptext.js';
import {
  NAME_MAX, accountEmail, accountRequest, accountUser, accountWallet, premiumHistory, requestDeactivate, resetWallet, setAccount,
  setNickname,
} from './saves.js';
import { matchPending, matchReady, matchStats, matchSync } from './match.js';
import { statsHtml } from './stats.js';

const DIFFS = [
  ['easy', 'Leicht'],
  ['normal', 'Normal'],
  ['hard', 'Schwer'],
];
const POINTS = [25, 50, 100];
const WEATHER_LABELS = { off: 'Aus', random: 'Zufall', summer: 'Sommer', autumn: 'Herbst', winter: 'Winter' };

// Vollbild (wie Katzen-Queens): installiert startet die App per Manifest (`display: fullscreen`) ohne Status- und Navigationsleiste.
// Im Browser-Tab, oder solange Android das geänderte Manifest einer schon installierten App noch nicht übernommen hat,
// schaltet der Schalter im Start- und Pausenmenü die Fullscreen API. Läuft die App schon per Manifest im Vollbild, bleibt er verborgen.
const fsOn = () => !!document.fullscreenElement;
const fsToggleable = () =>
  !!document.documentElement.requestFullscreen && document.fullscreenEnabled !== false &&
  (fsOn() || !matchMedia('(display-mode: fullscreen)').matches);
function setFullscreen(on) {
  if (on === fsOn()) return;
  const p = on ? document.documentElement.requestFullscreen({ navigationUI: 'hide' }) : document.exitFullscreen();
  p?.catch?.(() => {});
}
/** Schalter im offenen Menü an den Vollbild-Zustand anpassen (auch nach Zurück-Geste oder Esc). */
function markFullscreen(root) {
  root.querySelectorAll('[data-fsbox]').forEach((el) => { el.hidden = !fsToggleable(); });
  root.querySelectorAll('[data-fs]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.fs === '1') === fsOn())));
}
if (typeof document !== 'undefined') {
  document.addEventListener('fullscreenchange', () => {
    const root = document.getElementById('overlay');
    if (root && !root.hidden) markFullscreen(root);
  });
}

/** Lautstärke-Regler 0–100 % mit Prozentzahl; kind 'sfx' (Geräusche) oder 'music' (Musik), value 0–1 (seit v5.68). */
const volRow = (kind, value) => {
  const pct = Math.round(value * 100);
  const name = kind === 'music' ? 'Musik' : 'Geräusche';
  return `<div class="vol"><input type="range" min="0" max="100" step="5" value="${pct}" data-vol="${kind}" aria-label="Lautstärke ${name}"><output data-volout="${kind}">${pct} %</output></div>`;
};

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function fmtTime(s) {
  const t = Math.max(0, Math.floor(s));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/** Datum und Uhrzeit auf Deutsch (Ortszeit), z. B. „12.11.26, 09:05“. */
const fmtWhen = (ms) => new Date(ms).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
const DIFF_LABEL = Object.fromEntries(DIFFS);

/** Eine Zeile der Spielstand-Liste (SP3): Name, Fakten, Hinweise und Knöpfe; editing = { id, value?, err? } beim Umbenennen. */
function saveItem(e, editing) {
  const m = e.meta;
  const id = esc(m.id);
  if (editing?.id === m.id) {
    return `<li class="save" data-id="${id}">
      <div class="save-edit">
        <input type="text" maxlength="${NAME_MAX}" value="${esc(editing.value ?? m.name)}" data-rename-input aria-label="Neuer Name">
        <div class="save-acts"><button type="button" data-sact="renamesave">Speichern</button><button type="button" data-sact="cancel">Abbrechen</button></div>
      </div>
      ${editing.err ? `<p class="bad small">${esc(editing.err)}</p>` : ''}
    </li>`;
  }
  const notes = [];
  if (m.ended) notes.push('beendet');
  else if (!e.loadable) notes.push('andere Version, nicht ladbar');
  if (e.inLocal && !e.inRemote) notes.push('nur auf diesem Gerät');
  const canLoad = !m.ended && e.loadable;
  return `<li class="save" data-id="${id}">
    <div class="save-head"><b class="save-name">${esc(m.name)}</b>${notes.map((n) => `<span class="save-note">${n}</span>`).join('')}</div>
    <dl class="save-facts">
      <dt>Version</dt><dd>${esc(m.version)}</dd>
      <dt>Erstellt</dt><dd>${fmtWhen(m.createdAt)}</dd>
      <dt>Gespeichert</dt><dd>${fmtWhen(m.updatedAt)}</dd>
      <dt>Spielzeit</dt><dd>${fmtTime(m.gameTime)}</dd>
      <dt>${m.tickets ? 'Tickets' : 'Punkte'}</dt><dd>${m.points.join(' : ')}${m.tickets ? '' : ` von ${m.winPoints}`}</dd>
      <dt>Schwierigkeit</dt><dd>${esc(DIFF_LABEL[m.difficulty] ?? m.difficulty)}</dd>
    </dl>
    <div class="save-acts">
      ${canLoad ? '<button type="button" data-sact="load">Laden</button>' : ''}
      <button type="button" data-sact="rename">Umbenennen</button>
      <button type="button" data-sact="delete">Löschen</button>
    </div>
  </li>`;
}

function show(root, kind, html) {
  root.innerHTML = html;
  root.dataset.kind = kind;
  root.hidden = false;
}

export function hideOverlay(root) {
  root.onclick = null;
  root.oninput = null;
  root.onkeydown = null;
  root.onsubmit = null;
  root.innerHTML = '';
  delete root.dataset.kind;
  root.hidden = true;
}

const MAPSEL_KEY = 'frontline-kartenwahl';
const RADIO_KEY = 'frontline-radio'; // Startmenü: Sendemast-Sieg an/aus
const MOOD_LABELS = { off: 'Aus', random: 'Zufall', morning: 'Morgen', day: 'Tag', evening: 'Abend', night: 'Nacht' };
const MOOD_KEY = 'frontline-licht'; // Startmenü: Lichtstimmung (nur Optik)
const WEATHER_KEY = 'frontline-wetter'; // Startmenü: Wetter aus, Zufall oder feste Jahreszeit
const RESEARCH_KEY = 'frontline-forschung'; // Startmenü: Forschung an/aus
const RIVER_KEY = 'frontline-fluss'; // Startmenü: Flüsse auf Zufallskarten an/aus
const CONQUEST_KEY = 'frontline-eroberung'; // Startmenü: Modus Eroberung an/aus
const TICKETS_KEY = 'frontline-tickets'; // Startmenü: Start-Tickets der Eroberung
const OPP_KEY = 'frontline-gegner'; // Startmenü: Zahl der Computergegner (1 bis 3, nur Eroberung)
const OPP_DIFF_KEY = 'frontline-ki-'; // + Nummer des Gegners: seine Schwierigkeit
const BUILD_KEY = 'frontline-baugebiet'; // Startmenü: Baugebiet der Stadt an/aus (seit v5.78)
function readMapSel() {
  try {
    return localStorage.getItem(MAPSEL_KEY) || 'random';
  } catch {
    return 'random';
  }
}
/** Ein/Aus-Einstellung des Startmenüs (gemerkt). */
function readFlag(key, dflt) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? dflt : v === '1';
  } catch {
    return dflt;
  }
}
function writeFlag(key, on) {
  try {
    localStorage.setItem(key, on ? '1' : '0');
  } catch {
    /* ohne Speicher: gilt nur für diese Sitzung */
  }
}
/** Gemerkte Auswahl des Startmenüs (eine von `allowed`, sonst dflt). */
function readChoice(key, allowed, dflt) {
  try {
    const v = localStorage.getItem(key);
    return allowed.includes(v) ? v : dflt;
  } catch {
    return dflt;
  }
}
function writeChoice(key, v) {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* ohne Speicher: gilt nur für diese Sitzung */
  }
}
function writeMapSel(v) {
  try {
    localStorage.setItem(MAPSEL_KEY, v);
  } catch {
    /* ohne Speicher: gilt nur für diese Sitzung */
  }
}

// ---- Konto (KO3, docs/prd/konto.md): Bereich im Startmenü -----------------------------------------------------------

const ACC_PASS_MIN = 8; // wie api/auth.php (FL_PASS_MIN)
const NICK_MAX = 32; // wie api/auth.php (FL_NICK_MAX), seit KO4
const TOKEN_RE = /^[0-9a-f]{64}$/; // Link-Token aus der Mail (64 Hex-Zeichen, wie fl_is_token)
const ACC_OFFLINE = 'Keine Verbindung zum Server. Bitte später erneut versuchen.';
const ACC_TABS = [
  ['login', 'Anmelden'],
  ['register', 'Registrieren'],
  ['forgot', 'Passwort vergessen'],
];
const fmtDay = (ms) => new Date(ms).toLocaleDateString('de-DE');

/** Meldung zu einem Fehler: err.status gesetzt → Satz aus api/auth.php, sonst Netzfehler. */
const accMsg = (err) => (err?.status ? err.message : ACC_OFFLINE);

/** Konto-Art für die Anzeige: free → Kostenlos, premium → Premium (bis Datum; premiumUntil ist in Sekunden). */
function planLabel(u) {
  if (u.plan === 'premium') return u.premiumUntil ? `Premium (bis ${fmtDay(u.premiumUntil * 1000)})` : 'Premium';
  if (!u.plan || u.plan === 'free') return 'Kostenlos';
  return esc(u.plan);
}

/**
 * Link-Parameter aus der Adresse (Rücksprung von den Mails): ?verified=1|0, ?reset=<token> und ?deactivated=1|0 (seit KO4).
 * Gelesen wird einmal; danach stehen sie nicht mehr in der Adresszeile (history.replaceState).
 * Liefert { verified: true | false | null, reset: string | null, deactivated: true | false | null }.
 */
export function takeAccountLink() {
  const p = new URLSearchParams(location.search);
  const verified = p.get('verified');
  const reset = p.get('reset');
  const deactivated = p.get('deactivated');
  if (verified === null && reset === null && deactivated === null) return { verified: null, reset: null, deactivated: null };
  p.delete('verified');
  p.delete('reset');
  p.delete('deactivated');
  const query = p.toString();
  try {
    history.replaceState(history.state, '', `${location.pathname}${query ? `?${query}` : ''}${location.hash}`);
  } catch {
    /* ohne History-Zugriff bleibt der Parameter in der Adresse, wirkt dann beim nächsten Laden erneut */
  }
  return {
    verified: verified === null ? null : verified === '1',
    reset,
    deactivated: deactivated === null ? null : deactivated === '1',
  };
}

/** Eingabefeld eines Konto-Formulars; Passwörter ohne Vorbelegung. */
const accField = (name, label, type, auto, value = '') =>
  `<label>${label}<input type="${type}" name="${name}" autocomplete="${auto}" value="${esc(value)}" required></label>`;

/** Formular im Konto-Bereich: login, register, forgot oder reset (neues Passwort aus dem Mail-Link). */
function accountForm(kind, st) {
  const email = accField('email', 'E-Mail', 'email', 'email', st.email);
  const keep = st.keep ?? {}; // Passwörter bleiben bei einer Eingabefehler-Meldung stehen (sonst neu tippen)
  const newPass = accField('password', kind === 'reset' ? 'Neues Passwort (mind. 8 Zeichen)' : 'Passwort (mind. 8 Zeichen)', 'password', 'new-password', keep.password);
  const again = accField('password2', 'Passwort wiederholen', 'password', 'new-password', keep.password2);
  const fields = {
    login: email + accField('password', 'Passwort', 'password', 'current-password'),
    register: email + newPass + again,
    forgot: email,
    reset: `<p class="acc-title">Neues Passwort</p>${newPass}${again}`,
  };
  const go = { login: 'Anmelden', register: 'Registrieren', forgot: 'Link anfordern', reset: 'Neues Passwort speichern' };
  return `<form class="acc-form" data-acc-form="${kind}">${fields[kind]}
    <button type="submit" class="acc-go"${st.busy ? ' disabled' : ''}>${go[kind]}</button></form>`;
}

/**
 * Konto-Bereich (KO3). st: { user (angemeldet oder null), form (null | 'login' | 'register' | 'forgot' | 'reset'), email,
 * note ({ ok, text } oder null), busy, keep ({ password, password2 } nach einer Eingabefehler-Meldung, sonst null) }. Abgemeldet: Hinweis, drei Knöpfe, Formular; angemeldet: Konto-Art und Abmelden.
 * opts (Pausenmenü, seit v5.157): compact (nur Anmelden und Registrieren, Angemeldet als …), hint (Zeile unter der Überschrift),
 * locked (Text statt aller Knöpfe, z. B. während einer gewerteten Partie). stats (seit v5.158, nur Startmenü): Knopf „Meine Spiele“
 * und die Spielstatistik darunter (st.statsOpen, st.stats, st.statsErr). details (seit KO4, nur Startmenü): Knopf „Konto“ und der
 * Detailbereich darunter (st.detailOpen, st.nickDraft, st.history, st.historyErr, st.askDeactivate).
 */
function accountHtml(st, { compact = false, hint = '', locked = null, stats = false, details = false } = {}) {
  const note = st.note ? `<p class="acc-note ${st.note.ok ? 'good' : 'bad'}" role="status">${esc(st.note.text)}</p>` : '';
  const sub = compact && hint ? `<p class="muted small">${esc(hint)}</p>` : '';
  if (locked) {
    return `<span class="flabel">Konto</span>${st.user ? `<p class="acc-line">Angemeldet als <b>${esc(st.user.email)}</b></p>` : ''}
      <p class="muted small">${esc(locked)}</p>`;
  }
  if (st.user) {
    const line = compact
      ? `<p class="acc-line">Angemeldet als <b>${esc(st.user.email)}</b></p>`
      : `<p class="acc-line">Angemeldet als <b>${esc(st.user.email)}</b> · Konto: ${planLabel(st.user)}</p>`;
    const statsBtn = stats ? `<button type="button" data-acc="stats" aria-pressed="${!!st.statsOpen}">Meine Spiele</button>` : '';
    const panel = stats && st.statsOpen ? statsPanel(st) : '';
    const kontoBtn = details ? `<button type="button" data-acc="konto" aria-pressed="${!!st.detailOpen}">Konto</button>` : '';
    const detail = details && st.detailOpen ? detailPanel(st) : '';
    return `<span class="flabel">Konto</span>${sub}
      ${line}
      ${note}
      <div class="stack">${statsBtn}${kontoBtn}${panel}${detail}<button type="button" data-acc="logout"${st.busy ? ' disabled' : ''}>Abmelden</button></div>`;
  }
  if (st.form === 'reset') return `<span class="flabel">Konto</span>${note}${accountForm('reset', st)}`;
  const kinds = compact ? ACC_TABS.filter(([k]) => k !== 'forgot') : ACC_TABS;
  const tabs = kinds.map(([k, l]) => `<button type="button" data-acc="${k}" aria-pressed="${st.form === k}">${l}</button>`).join('');
  const intro = compact ? sub : '<p class="muted small">Spielstände nur auf diesem Gerät. Mit Konto liegen sie auf dem Server.</p>';
  return `<span class="flabel">Konto</span>
    ${intro}
    <div class="seg">${tabs}</div>
    ${note}
    ${st.form ? accountForm(st.form, st) : ''}`;
}

/** Eine Änderung der Konto-Art in der Premium-Historie: Datum · Art · bis · Notiz (seit KO4). */
function histItem(h) {
  const premium = h.plan === 'premium';
  const until = !premium ? '' : h.premiumUntil ? ` · bis ${fmtDay(h.premiumUntil * 1000)}` : ' · unbefristet';
  return `<li class="acc-game">
    <div class="acc-game-top"><span>${esc(fmtDay(h.createdAt * 1000))}</span><span>${esc(premium ? 'Premium' : 'Kostenlos')}${esc(until)}</span></div>
    ${h.note ? `<div class="acc-game-bot muted"><span>${esc(h.note)}</span></div>` : ''}
  </li>`;
}

/**
 * Detailbereich „Konto“ im Startmenü (seit KO4): E-Mail, erstellt am, Konto-Art; Nickname (Formular); Premium-Historie;
 * „Konto löschen“ mit Rückfrage (die Bestätigungsmail deaktiviert das Konto, löschen kann nur der Admin).
 */
function detailPanel(st) {
  const u = st.user;
  const facts = `<dl class="acc-kpis">
    <div class="acc-kpi"><dt>E-Mail</dt><dd>${esc(u.email)}</dd></div>
    <div class="acc-kpi"><dt>Erstellt am</dt><dd>${u.createdAt ? esc(fmtDay(u.createdAt * 1000)) : '–'}</dd></div>
    <div class="acc-kpi"><dt>Konto-Art</dt><dd>${planLabel(u)}</dd></div>
  </dl>`;
  const nick = `<form class="acc-form" data-acc-form="nick">
    <label>Nickname (optional)<input type="text" name="nickname" maxlength="${NICK_MAX}" autocomplete="nickname" value="${esc(st.nickDraft ?? u.nickname ?? '')}"></label>
    <p class="muted small">Bis ${NICK_MAX} Zeichen: Buchstaben, Ziffern, Leerzeichen sowie _ - .</p>
    <button type="submit" class="acc-go"${st.busy ? ' disabled' : ''}>Nickname speichern</button>
  </form>`;
  const hist = st.historyErr ? `<p class="acc-note bad" role="status">${esc(st.historyErr)}</p>`
    : st.history === null || st.history === undefined ? '<p class="muted small" role="status">Lade die Premium-Historie …</p>'
      : st.history.length ? `<ul class="acc-games">${st.history.map(histItem).join('')}</ul>`
        : '<p class="muted small">Noch keine Änderung der Konto-Art.</p>';
  const ask = st.askDeactivate
    ? `<p class="acc-note bad" role="status">Das Konto wird deaktiviert, nicht gelöscht: Danach kannst du dich nicht mehr anmelden.
        Dazu schicken wir dir eine Mail mit einem Bestätigungslink.</p>
      <div class="seg"><button type="button" data-acc="deactivate-go"${st.busy ? ' disabled' : ''}>Mail schicken</button>
        <button type="button" data-acc="deactivate-cancel"${st.busy ? ' disabled' : ''}>Abbrechen</button></div>`
    : `<button type="button" data-acc="deactivate"${st.busy ? ' disabled' : ''}>Konto löschen</button>`;
  return `<div class="acc-detail" data-acc-detail>
    ${facts}
    <p class="acc-title">Nickname</p>
    ${nick}
    <p class="acc-title">Premium-Historie</p>
    ${hist}
    <p class="acc-title">Konto löschen</p>
    <p class="muted small">Das Konto wird nur deaktiviert. Endgültig löschen oder wieder aktivieren kann nur der Admin.</p>
    ${ask}
  </div>`;
}

/** Spielstatistik unter dem Knopf „Meine Spiele“: Meldung, Lade-Hinweis oder die Zahlen (ui/stats.js). */
function statsPanel(st) {
  if (st.statsErr) return `<p class="acc-note bad" role="status">${esc(st.statsErr)}</p>`;
  if (!st.stats) return '<p class="muted small" role="status">Lade deine Spiele …</p>';
  return statsHtml(st.stats);
}

/**
 * Konto-Bereich in `box` (das Element mit [data-account]) für Start- und Pausenmenü (seit v5.157 gemeinsam). Zeichnet den Zustand,
 * behandelt Knöpfe und Formulare (die Ereignisse hängen am Element selbst) und stößt die Folgen an. opts: compact, hint, locked
 * (siehe accountHtml); init ({ user, form, note, token }: Anfangszustand, z. B. Rücksprung von den Mails); load (Anmeldestand
 * beim Öffnen abfragen, Standard an); onChanged(user) nach An- oder Abmelden; onSynced(user) nach dem Anmelden, wenn der
 * Webspace-Abgleich fertig ist. Liefert { ready }: Promise mit dem Anmeldestand (null ohne Anmeldung oder bei Netzfehler).
 */
export function wireAccount(box, { compact = false, hint = '', locked = null, stats = false, details = false, init = {}, load = true, onChanged = null, onSynced = null } = {}) {
  const acc = {
    user: null, form: null, email: '', note: null, busy: false, token: null, keep: null, statsOpen: false, stats: null, statsErr: null,
    detailOpen: false, nickDraft: null, history: null, historyErr: null, askDeactivate: false, ...init,
  };
  const draw = () => {
    if (box.isConnected) box.innerHTML = accountHtml(acc, { compact, hint, locked, stats, details });
  };
  /** Nach An- oder Abmelden: Anzeige neu, dann der Aufrufer (Startmenü: Kasse und Spielstände). Die Statistik schließt sich. */
  const accountChanged = () => {
    acc.statsOpen = false;
    acc.stats = null;
    acc.statsErr = null;
    acc.detailOpen = false;
    acc.history = null;
    acc.historyErr = null;
    acc.askDeactivate = false;
    acc.nickDraft = null;
    draw();
    onChanged?.(acc.user);
  };
  /** Detailbereich „Konto“ (seit KO4): ein Druck öffnet und lädt die Premium-Historie, der zweite schließt. */
  const toggleDetail = async () => {
    acc.detailOpen = !acc.detailOpen;
    acc.askDeactivate = false;
    acc.history = null;
    acc.historyErr = null;
    draw();
    if (!acc.detailOpen) return;
    try {
      acc.history = await premiumHistory();
    } catch (err) {
      acc.historyErr = accMsg(err);
    }
    if (acc.detailOpen) draw();
  };
  /** Spielstatistik (seit v5.158): ein Druck öffnet und lädt die Zahlen frisch vom Server, der zweite schließt. */
  const toggleStats = async () => {
    acc.statsOpen = !acc.statsOpen;
    acc.stats = null;
    acc.statsErr = null;
    draw();
    if (!acc.statsOpen) return;
    try {
      acc.stats = await matchStats();
    } catch (err) {
      acc.statsErr = accMsg(err);
    }
    if (acc.statsOpen) draw();
  };
  /** Gemeinsamer Ablauf eines Konto-Vorgangs: sperren, Anfrage, Fehler als Hinweis im Bereich. */
  const run = async (job) => {
    if (acc.busy) return;
    acc.busy = true;
    acc.note = null;
    acc.keep = null;
    draw();
    try {
      await job();
    } catch (err) {
      acc.note = { ok: false, text: accMsg(err) };
    } finally {
      acc.busy = false;
      draw();
    }
  };
  /** Formular abschicken (Eingaben prüfen, dann die Anfrage). */
  const submit = (kind, f) => {
    if (acc.busy) return;
    const val = (n) => f.elements.namedItem(n)?.value ?? '';
    if (kind === 'nick') { // Nickname im Detailbereich (seit KO4); der Wert vor run() lesen, run() zeichnet neu
      const nickname = val('nickname');
      return run(async () => {
        acc.user = await setNickname(nickname);
        acc.nickDraft = null;
        acc.note = { ok: true, text: acc.user.nickname ? 'Nickname gespeichert.' : 'Nickname entfernt.' };
      });
    }
    if (kind !== 'reset') acc.email = val('email').trim();
    const email = acc.email;
    const pw = val('password');
    if (kind === 'register' || kind === 'reset') {
      const text = [...pw].length < ACC_PASS_MIN
        ? 'Das Passwort muss mindestens 8 Zeichen haben.'
        : pw !== val('password2') ? 'Die beiden Passwörter stimmen nicht überein.' : null;
      if (text) {
        acc.note = { ok: false, text };
        acc.keep = { password: pw, password2: val('password2') };
        return draw();
      }
    }
    return run(async () => {
      if (kind === 'login') {
        const d = await accountRequest({ action: 'login', email, password: pw });
        acc.user = d.user ?? null;
        acc.form = null;
        acc.note = null;
        const synced = setAccount(d.user); // Kasse und Webspace an, lokale Stände ins Konto
        accountChanged();
        await synced;
        onSynced?.(acc.user);
      } else if (kind === 'register') {
        const d = await accountRequest({ action: 'register', email, password: pw });
        acc.note = { ok: true, text: d.message ?? 'Bitte prüfe dein Postfach.' };
      } else if (kind === 'forgot') {
        const d = await accountRequest({ action: 'forgot', email });
        acc.note = { ok: true, text: d.message ?? 'Bitte prüfe dein Postfach.' };
      } else if (kind === 'reset') {
        await accountRequest({ action: 'reset', token: acc.token, password: pw });
        acc.token = null;
        acc.form = 'login';
        acc.note = { ok: true, text: 'Neues Passwort gespeichert. Du kannst dich jetzt anmelden.' };
      }
    });
  };
  /** Knöpfe im Konto-Bereich: Abmelden, oder ein Formular öffnen (zweiter Druck schließt es). */
  const click = (act) => {
    if (act === 'stats') return toggleStats();
    if (act === 'konto') return toggleDetail();
    if (act === 'deactivate' || act === 'deactivate-cancel') { // Rückfrage vor dem Versand (seit KO4)
      acc.askDeactivate = act === 'deactivate';
      return draw();
    }
    if (act === 'deactivate-go') {
      return run(async () => {
        const d = await requestDeactivate();
        acc.askDeactivate = false;
        acc.note = { ok: true, text: d.message ?? 'Wir haben dir eine Bestätigungsmail geschickt.' };
      });
    }
    if (act === 'logout') {
      return run(async () => {
        await accountRequest({ action: 'logout' }); // Netzfehler: bleibt angemeldet, der Hinweis sagt es
        acc.user = null;
        acc.note = { ok: true, text: 'Abgemeldet. Spielstände bleiben auf diesem Gerät.' };
        setAccount(null);
        accountChanged();
      });
    }
    acc.form = acc.form === act ? null : act;
    acc.note = null;
    draw();
  };
  box.onclick = (e) => {
    const b = e.target.closest?.('[data-acc]');
    if (b) click(b.dataset.acc);
  };
  box.onsubmit = (e) => {
    const f = e.target;
    if (!f.matches?.('[data-acc-form]')) return;
    e.preventDefault();
    submit(f.dataset.accForm, f);
  };
  // Nickname-Eingabe merken, damit ein Neuzeichnen (Premium-Historie lädt) sie nicht löscht (seit KO4)
  box.oninput = (e) => {
    if (e.target?.name === 'nickname') acc.nickDraft = e.target.value;
  };
  draw();
  const ready = load
    ? accountUser().then(
      (u) => {
        acc.user = u;
        draw();
        return u;
      },
      () => {
        draw(); // Netzfehler: wie der Anfangszustand, der Gerätebetrieb bleibt
        return acc.user;
      },
    )
    : Promise.resolve(acc.user);
  return { ready };
}

/**
 * Startmenü: onStart({conquest, difficulty, difficulties (je Computergegner), winPoints, mapId, radio, weather, mood, research, river, buildRules}) (city immer true) beim Klick auf Start (mapId 'random' oder Karten-ID,
 * radio = Sendemast-Sieg, weather = 'off' | 'random' | Jahreszeit, research = Forschungsbaum, river = Flüsse auf Zufallskarten).
 * Die Kasse (Geld von Runde zu Runde) kommt aus dem Konto (ui/saves.js, accountWallet); Gäste sehen den Startbetrag und den Hinweis.
 * Gewertete Partien (Tokens, ui/match.js) zeigt die Kasszeile: wie viele bereit sind und ob ein Endstand noch auf Netz wartet.
 */
export function showStartMenu(root, onStart, { resume = null } = {}) {
  // resume: { find(): Promise<{ text, source } | null>, onResume(), onDiscard() } – gespeicherte Partie (Gerät oder Webspace), siehe ui/saves.js
  const D = BALANCE.menuDefaults; // Standards: js/data/balance.js
  // Eroberung: bis zu 3 Computergegner, jeder mit eigener Schwierigkeit (gemerkt); klassisch: ein Gegner
  let conquest = readFlag(CONQUEST_KEY, D.conquest);
  const TIX = BALANCE.conquest.ticketChoices;
  let tickets = Number(readChoice(TICKETS_KEY, TIX.map(String), String(BALANCE.conquest.ticketDefault)));
  let opponents = Number(readChoice(OPP_KEY, ['1', '2', '3'], String(D.opponents)));
  const diffs = [1, 2, 3].map((i) => readChoice(OPP_DIFF_KEY + i, DIFFS.map(([k]) => k), D.difficulty));
  let mapSel = readMapSel(); // 'random' | Karten-ID
  let winPoints = BALANCE.winPoints;
  let radio = readFlag(RADIO_KEY, D.radio);
  let weather = readChoice(WEATHER_KEY, WEATHER_SETTINGS, D.weather);
  let mood = readChoice(MOOD_KEY, MOOD_SETTINGS, 'random');
  let research = readFlag(RESEARCH_KEY, D.research);
  let river = readFlag(RIVER_KEY, D.river);
  let buildRules = readFlag(BUILD_KEY, D.buildRules);
  let sound = readFlag(SOUND_KEY, true); // Ton: gleicher Speicher wie der Schalter im Spiel (audio/sound.js)
  show(
    root,
    'start',
    `<section class="menu start">
      <h1 class="logo">FRONTLINE</h1>
      <section class="account" data-account aria-label="Konto"></section>
      <div class="resume" data-resume hidden></div>
      <section class="saves" data-saves hidden>
        <h3>Spielstände</h3>
        <ul class="save-list" data-savelist></ul>
      </section>
      <p class="tag">Echtzeit-Strategie · Einheiten an die Front bringen, versorgen und die Konfliktzone halten</p>
      <div class="field">
        <span class="flabel" title="Eroberung: 16 Flaggen in der Konfliktzone, Tickets, bis zu 4 Spieler, jeder gegen jeden. Klassisch: Punktebalken, ein Gegner">Modus</span>
        <div class="seg"><button type="button" data-cq="1">Eroberung</button><button type="button" data-cq="0">Klassisch</button></div>
      </div>
      <div class="field" data-oppfield>
        <span class="flabel">Computergegner</span>
        <div class="seg">${[1, 2, 3].map((n) => `<button type="button" data-opp="${n}">${n}</button>`).join('')}</div>
      </div>
      ${[1, 2, 3]
        .map(
          (i) => `<div class="field" data-opprow="${i}">
        <span class="flabel" style="color:${BALANCE.teamColors[i]}">${BALANCE.teamNames[i]}</span>
        <div class="seg">${DIFFS.map(([k, l]) => `<button type="button" data-od="${i}:${k}">${l}</button>`).join('')}</div>
      </div>`,
        )
        .join('')}
      <div class="field" data-tixfield>
        <span class="flabel" title="Eroberung: wer weniger Flaggen hält als der Führende, verliert Tickets; ${TIX[TIX.length - 1]} für lange Partien">Tickets</span>
        <div class="seg">${TIX.map((n) => `<button type="button" data-tix="${n}">${n}</button>`).join('')}</div>
      </div>
      <div class="field" data-ptsfield>
        <span class="flabel">Siegpunkte</span>
        <div class="seg">${POINTS.map((p) => `<button type="button" data-pts="${p}">${p}</button>`).join('')}</div>
      </div>
      <div class="field">
        <span class="flabel" title="Sendemast: bauen und ${Math.round(BALANCE.radio.hold / 60)} min halten gewinnt ebenfalls">Sendemast-Sieg</span>
        <div class="seg"><button type="button" data-radio="1">An</button><button type="button" data-radio="0">Aus</button></div>
      </div>
      <div class="field">
        <span class="flabel" title="Jahreszeit und wechselndes Wetter: Regen, Nebel und Schnee senken die Sicht, Schnee bremst Fahrzeuge">Wetter</span>
        <div class="seg">${WEATHER_SETTINGS.map((k) => `<button type="button" data-weather="${k}">${WEATHER_LABELS[k]}</button>`).join('')}</div>
      </div>
      <div class="field">
        <span class="flabel" title="Lichtstimmung über der Karte: Morgen, Tag, Abend oder Nacht (nur Optik, ändert nichts am Spiel). Zufall wählt passend zur Jahreszeit">Licht</span>
        <div class="seg">${MOOD_SETTINGS.map((k) => `<button type="button" data-mood="${k}">${MOOD_LABELS[k]}</button>`).join('')}</div>
      </div>
      <div class="field">
        <span class="flabel" title="Forschungsbaum in der Hauptstadt: 10 Stufen mit Verbesserungen je Einheit (Reichweite, Panzerung, Tempo, Treibstoff …); alle Einheiten sind auch ohne Forschung frei">Forschung</span>
        <div class="seg"><button type="button" data-research="1">An</button><button type="button" data-research="0">Aus</button></div>
      </div>
      <div class="field">
        <span class="flabel" title="Baugebiet der Stadt: Stadtgebäude nur im eigenen Gebiet (um die Hauptstadt, FOBs und Gebäude), nur auf erkundetem Gelände, nicht nahe sichtbaren Feinden und nicht in der Konfliktzone; Straßen dürfen auch außerhalb liegen. Aus: überall bauen wie bisher">Baugebiet</span>
        <div class="seg"><button type="button" data-build="1">An</button><button type="button" data-build="0">Aus</button></div>
      </div>
      <div class="field">
        <span class="flabel" title="Zufallskarten: je ein Fluss vor jeder Startecke mit drei zerstörbaren Brücken und zwei Furten">Fluss</span>
        <div class="seg"><button type="button" data-river="1">An</button><button type="button" data-river="0">Aus</button></div>
      </div>
      <div class="field">
        <span class="flabel" title="Schüsse, Explosionen, Fahrzeuge, Wetter und Meldungen; selbst erzeugt, ohne Dateien. Im Spiel: Taste F2 oder der Lautsprecher-Knopf oben">Ton</span>
        <div class="seg"><button type="button" data-sound="1">An</button><button type="button" data-sound="0">Aus</button></div>
      </div>
      <div class="field">
        <span class="flabel" title="Lautstärke der Schüsse, Explosionen, Fahrzeuge und Meldungen; wirkt sofort">Geräusche</span>
        ${volRow('sfx', loadLevel('sfx'))}
      </div>
      <div class="field">
        <span class="flabel" title="Hintergrundmusik, selbst erzeugt: ruhig im Frieden, Trommeln und Bass im Gefecht; wirkt sofort">Musik</span>
        ${volRow('music', loadLevel('music'))}
      </div>
      <div class="field" data-fsbox hidden>
        <span class="flabel" title="Ohne Status- und Navigationsleiste spielen. Installiert startet Frontline von selbst im Vollbild">Vollbild</span>
        <div class="seg"><button type="button" data-fs="1">An</button><button type="button" data-fs="0">Aus</button></div>
      </div>
      <div class="field">
        <span class="flabel">Karte</span>
        <div class="seg">
          <button type="button" data-mapmode="random">Zufall</button>
          <button type="button" data-mapmode="saved">Gespeichert</button>
          <button type="button" data-mapmode="new">Neue Karte</button>
        </div>
        <div class="mapbox" data-mapbox></div>
      </div>
      <ol class="howto">
        <li>Du startest mit 2 Kampfpanzern, 3 Schützenpanzern, 29 Soldaten (22 Schützen, 7 Panzerabwehrsoldaten), 3 LKW, Baufahrzeug und deinem Kommandeur (goldener Stern: in seiner Nähe schießen deine Einheiten schneller und Verwundete heilen; fällt er, bekommt der Gegner 5 Punkte). Das Einheitenlimit beträgt 300 Plätze: Soldat 1, Schützenpanzer 3, Kampfpanzer 5, Flakpanzer und SAM-Startrampe 2. Die Hauptstadt bildet keine Einheiten aus: Das machen Kaserne, Fabrikhalle und Heliport der Stadt (nur gegen Geld). Sie heilen bzw. reparieren auch Einheiten in ihrer Nähe; ein Krankenhaus heilt Soldaten im Umkreis von 3 Feldern. Alle Einheiten sind von Anfang an frei. Ist oben Forschung an, verbessert der Forschungsbaum (U) sie in 10 Stufen: mehr Reichweite, Panzerung, Tempo, Treibstoff-Reichweite und mehr.</li>
        <li>LKW (E) bringen Nachschub aus der Hauptstadt zu den vorderen FOBs und versorgen Einheiten in ihrer Nähe.</li>
        <li>FOB-Fahrzeug (B): fahr es an die Front und drück Aufbauen (D), dann steht sofort eine neue FOB mit 20 % Lager (bis zu 10 FOBs, ohne überlappende Bauradien).</li>
        <li>Baufahrzeug (R): Mörser, Flak, Phalanx (Nahbereichsschutz gegen Hubschrauber und Mörsergranaten, Reichweite halber FOB-Radius, 2 min Bauzeit, frisst Munition und Geld), Bohrer und – falls oben an – einen Sendemast: steht er fertig 30 Minuten, ist die Partie gewonnen. Soldaten bauen aus wenig getragenem Baumaterial Mauern und Tore (ein Tor ist 2 Felder breit).</li>
        <li>Ist oben Fluss an, liegt vor jeder Startecke ein Fluss: über drei Brücken oder langsam durch zwei Furten. Brücken lassen sich sprengen (A, dann Brücke anklicken) und von Baufahrzeugen wieder aufbauen.</li>
        <li>Förderung, Werke, Wohnen und Gewerbe liegen an Straßen. Rohstoffe fahren zum nächsten Werk, Produkte zum Lager der Hauptstadt; ohne Straße keine Lieferung. Straßen können voll werden (Stau: gelb, rot), dann kommen Waren und Pendler langsamer. Fahrzeuge, Reparaturen und Munition brauchen Stahl; Gewerbe braucht Baumaterial vom Lager. F-16 tanken Kerosin am Kerosintank des Fliegerhorsts, Hubschrauber gelandet auf ihrem Heliport (ein Hubschrauber je Heliport, Kerosintank und Munitionslager in der Nähe).</li>
        <li>Spielstände: Die Liste oben zeigt alle Partien (Spielzeit, Punkte, Schwierigkeit, Version); je Zeile laden, umbenennen oder löschen. Beendete Partien bleiben zum Ansehen in der Liste.</li>
        <li>Konto (oben, optional): Ohne Konto bleiben Spielstände auf diesem Gerät, und jede Partie startet mit dem Startbetrag und zählt nicht für eine Kasse. Anmelden und Abmelden geht auch im Pausenmenü (P): Die laufende Partie bleibt, wie sie begonnen hat; eine gewertete Partie lässt sich dort erst nach dem Endstand wechseln. Mit Konto (E-Mail und Passwort, Bestätigung per Mail) liegen Spielstände und die Kasse (Geld von Runde zu Runde) auf dem Server und sind nach dem Anmelden auf jedem Gerät da. Eine Partie zählt für die Kasse, wenn der Server sie begonnen hat: Er gibt bis zu 3 Tokens auf Vorrat aus, auch für Partien ohne Netz. Ohne Token läuft die Partie ungewertet. Ein Token wird erst mit dem Endstand verbraucht: Eine abgebrochene Partie kostet keins. Ein gespeicherter Stand bleibt auf diesem Gerät gewertet, solange sein Token im Vorrat ist.</li>
        <li>Eroberung: 16 Flaggen (A bis P) in der Konfliktzone. Wer im Gebiet einer Flagge die meisten Einheiten hat, nimmt sie ein. Wer weniger Flaggen hält als der Führende, verliert Tickets; ohne Tickets scheidet man aus. Fremde Viertel sind gesperrt, bis ihr Besitzer ${Math.round(BALANCE.conquest.lockGrace / 60)} min ohne Flagge ist. Kaserne und Fabrikhalle: im Infofeld wählen, ob neue Einheiten am Gebäude oder an einer eigenen Flagge erscheinen.</li>
        <li>Klassisch: Konfliktzone halten: jede deiner Einheiten dort bringt Geld (0,4/s, in der Hot Zone 0,8/s), alle 30 s ein Punkt. Fällt deine Hauptstadt, ist die Runde verloren.</li>
      </ol>
      <p class="muted small center" data-wallet></p>
      <button type="button" class="primary" data-act="start">Start</button>
      <p class="muted small center">Alle Tasten zeigt F1 im Spiel.</p>
    </section>`,
  );
  // Kasse (KA1): nur am Konto. Vor der Anmeldeprüfung (walletKnown) bleibt die Zeile leer, damit Angemeldete nicht den Gast-Hinweis sehen.
  let walletKnown = false;
  const showWallet = (note = '') => {
    const el = root.querySelector('[data-wallet]');
    if (!el) return;
    const w = accountWallet();
    if (!walletKnown) el.textContent = '';
    else if (w === null) el.textContent = `Ohne Konto startest du jede Partie mit ${BALANCE.startRes.money} Geld, und sie zählt nicht für die Kasse. Mit Konto bleibt dein Geld von Runde zu Runde erhalten.`;
    else {
      const ready = matchReady();
      const pending = matchPending();
      const token = ready > 0 ? `Gewertete Partien bereit: ${ready}` : 'Keine gewertete Partie bereit: die nächste zählt nicht';
      const wait = pending > 0 ? ` · ${pending} Endstand wartet auf Netz` : '';
      el.innerHTML = `Kasse: <b>${w}</b> Geld (bleibt von Runde zu Runde, am Konto) · <button type="button" class="btn-sm" data-act="resetWallet">zurücksetzen</button> · ${token}${wait}${note ? ` <span class="bad">${esc(note)}</span>` : ''}`;
    }
  };
  showWallet();
  // Schnellknopf „Fortsetzen“ (neuester nicht beendeter Stand) und die Liste der Spielstände (SP3)
  let editing = null; // { id, value?, err? } während des Umbenennens
  let list = [];
  const saveBox = root.querySelector('[data-saves]');
  const listBox = root.querySelector('[data-savelist]');
  const drawSaves = () => {
    if (!listBox) return;
    saveBox.hidden = list.length === 0;
    listBox.innerHTML = list.map((e) => saveItem(e, editing)).join('');
  };
  const loadSaves = () => {
    if (!resume?.list) return;
    resume
      .list()
      .then((l) => {
        if (root.dataset.kind !== 'start') return;
        list = l;
        drawSaves();
      })
      .catch(() => {});
  };
  const loadQuick = () => {
    if (!resume) return;
    const box = root.querySelector('[data-resume]');
    resume
      .find()
      .then((info) => {
        if (root.dataset.kind !== 'start') return;
        box.hidden = !info;
        if (!info) return;
        box.innerHTML = `<p><b>Gespeicherte Partie</b><br>${esc(info.text)}</p>
          <div class="stack"><button type="button" class="primary" data-act="resume">Fortsetzen</button>
          <button type="button" class="btn-sm" data-act="discardSave">Spielstand löschen</button></div>`;
      })
      .catch(() => {});
  };
  const changed = () => {
    editing = null;
    loadSaves();
    loadQuick();
  };
  /** Knöpfe der Liste: laden, umbenennen (Eingabefeld), löschen (mit Rückfrage). */
  const saveAct = (b) => {
    const li = b.closest('.save');
    const id = li.dataset.id;
    const entry = list.find((x) => x.meta.id === id);
    if (!entry) return;
    const act = b.dataset.sact;
    if (act === 'load') {
      hideOverlay(root);
      resume.load(id);
    } else if (act === 'rename') {
      editing = { id };
      drawSaves();
      listBox.querySelector('[data-rename-input]')?.select();
    } else if (act === 'cancel') {
      editing = null;
      drawSaves();
    } else if (act === 'renamesave') {
      const value = li.querySelector('[data-rename-input]').value;
      resume
        .rename(id, value)
        .then(() => changed())
        .catch((err) => {
          editing = { id, value, err: err.message ?? String(err) };
          drawSaves();
        });
    } else if (act === 'delete') {
      if (!confirm(`„${entry.meta.name}“ wirklich löschen?`)) return;
      resume
        .remove(id)
        .then(() => changed())
        .catch(() => changed());
    }
  };
  loadQuick();
  loadSaves();
  // Konto (KO3): Anzeige und Formulare in wireAccount; alle Anfragen gehen an api/auth.php (ui/saves.js), der Webspace wird danach eingestellt
  const link = takeAccountLink(); // Rücksprung von den Mails, einmal gelesen
  const init = {};
  if (link.deactivated !== null) { // Bestätigungslink „Konto deaktivieren“ (seit KO4): Konto ist jetzt inaktiv, abgemeldet
    init.note = link.deactivated
      ? { ok: true, text: 'Dein Konto wurde deaktiviert. Anmelden ist nicht mehr möglich; zum Wiederherstellen wende dich an den Admin.' }
      : { ok: false, text: 'Link ungültig oder abgelaufen.' };
  }
  if (link.verified !== null) {
    init.form = 'login';
    init.note = link.verified
      ? { ok: true, text: 'E-Mail bestätigt, du kannst dich jetzt anmelden.' }
      : { ok: false, text: 'Link ungültig oder abgelaufen.' };
  }
  if (link.reset !== null) {
    if (TOKEN_RE.test(link.reset)) {
      init.form = 'reset';
      init.token = link.reset;
      init.note = null;
    } else {
      init.form = 'login';
      init.note = { ok: false, text: 'Link ungültig oder abgelaufen.' };
    }
  }
  const accBox = root.querySelector('[data-account]');
  const account = wireAccount(accBox, {
    stats: true, // Knopf „Meine Spiele“ (seit v5.158; im Pausenmenü nicht)
    details: true, // Knopf „Konto“ mit Nickname, Premium-Historie und Löschen (seit KO4; im Pausenmenü nicht)
    init,
    /** Nach An- oder Abmelden: Kasse-Anzeige und Spielstand-Liste neu. */
    onChanged: () => {
      showWallet();
      changed();
    },
    /** Nach dem Anmelden (Webspace ist abgeglichen): Vorrat für gewertete Partien holen, Liste nachladen. */
    onSynced: () => {
      matchSync().then(() => showWallet());
      changed();
    },
  });
  account.ready.then((u) => {
    if (!accBox?.isConnected) return;
    walletKnown = true;
    showWallet();
    if (u) {
      matchSync().then(() => showWallet()); // Vorrat und wartende Endstände
      changed(); // angemeldet: Stände vom Konto nachladen
    }
  });
  const mark = () => {
    const count = conquest ? opponents : 1;
    root.querySelectorAll('[data-cq]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.cq === '1') === conquest)));
    root.querySelector('[data-oppfield]').hidden = !conquest;
    root.querySelectorAll('[data-opp]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.opp) === opponents)));
    root.querySelectorAll('[data-opprow]').forEach((r) => (r.hidden = Number(r.dataset.opprow) > count));
    root.querySelectorAll('[data-od]').forEach((b) => {
      const [i, k] = b.dataset.od.split(':');
      b.setAttribute('aria-pressed', String(diffs[i - 1] === k));
    });
    // Eroberung: Tickets statt Siegpunkte
    root.querySelector('[data-tixfield]').hidden = !conquest;
    root.querySelector('[data-ptsfield]').hidden = conquest;
    root.querySelectorAll('[data-tix]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.tix) === tickets)));
    root.querySelectorAll('[data-pts]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.pts) === winPoints)));
    root.querySelectorAll('[data-radio]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.radio === '1') === radio)));
    root.querySelectorAll('[data-weather]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.weather === weather)));
    root.querySelectorAll('[data-mood]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mood === mood)));
    root.querySelectorAll('[data-research]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.research === '1') === research)));
    root.querySelectorAll('[data-build]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.build === '1') === buildRules)));
    root.querySelectorAll('[data-river]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.river === '1') === river)));
    root.querySelectorAll('[data-sound]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.sound === '1') === sound)));
    markFullscreen(root);
  };
  const renderMapBox = () => {
    const box = root.querySelector('[data-mapbox]');
    const saved = listMaps();
    if (mapSel !== 'random' && !saved.some((m) => m.id === mapSel)) mapSel = 'random';
    if (mapSel === 'random') {
      box.innerHTML = '<p class="muted small">Bei jedem Start wird eine neue Karte erzeugt. <button type="button" class="btn-sm" data-act="editRandom">im Editor öffnen</button></p>';
    } else {
      box.innerHTML = '';
    }
    root.querySelectorAll('[data-mapmode]').forEach((b) => {
      const m = b.dataset.mapmode;
      b.setAttribute('aria-pressed', String(m === 'saved' ? mapSel !== 'random' : m === 'random' && mapSel === 'random'));
    });
    if (mapSel !== 'random' || root.dataset.showSaved === '1') {
      const opts = saved
        .map((m) => {
          const d = describeMap(m.map);
          return `<option value="${esc(m.id)}"${m.id === mapSel ? ' selected' : ''}>${esc(m.name)} (${d.buildings} Gebäude, ${d.trees} Bäume)</option>`;
        })
        .join('');
      box.innerHTML = saved.length
        ? `<select data-mapsel>${opts}</select>
           <div class="maprow"><button type="button" class="btn-sm" data-act="mapEdit">Bearbeiten</button>
           <button type="button" class="btn-sm" data-act="mapDelete">Löschen</button>
           <label class="btn-sm filebtn">Importieren<input type="file" accept=".json,application/json" data-mapimport hidden></label></div>`
        : `<p class="muted small">Noch keine Karte gespeichert. <label class="btn-sm filebtn">Importieren<input type="file" accept=".json,application/json" data-mapimport hidden></label></p>`;
    }
  };
  mark();
  renderMapBox();
  root.onchange = (e) => {
    if (e.target.matches('[data-mapsel]')) {
      mapSel = e.target.value;
      writeMapSel(mapSel);
    } else if (e.target.matches('[data-mapimport]')) {
      const f = e.target.files?.[0];
      if (!f) return;
      f.text()
        .then((t) => {
          const m = normalizeMap(JSON.parse(t));
          const id = saveMap(m);
          if (!id) throw new Error('Speicher voll');
          mapSel = id;
          writeMapSel(id);
          renderMapBox();
        })
        .catch((err) => {
          const box = root.querySelector('[data-mapbox]');
          box.insertAdjacentHTML('beforeend', `<p class="bad small">Import fehlgeschlagen: ${esc(err.message)}</p>`);
        });
    }
  };
  root.oninput = (e) => {
    const r = e.target.closest?.('[data-vol]');
    if (!r) return;
    const v = Number(r.value) / 100;
    saveLevel(r.dataset.vol, v);
    root.querySelector(`[data-volout="${r.dataset.vol}"]`).textContent = `${r.value} %`;
  };
  root.onkeydown = (e) => {
    if (e.key === 'Enter' && e.target.matches?.('[data-rename-input]')) {
      e.preventDefault();
      listBox.querySelector('[data-sact="renamesave"]')?.click();
    }
  };
  root.onclick = (e) => {
    if (e.target.closest('[data-account]')) return; // Konto-Bereich: wireAccount behandelt seine Knöpfe selbst
    const sb = e.target.closest('[data-sact]');
    if (sb) return saveAct(sb);
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.mapmode === 'random') {
      mapSel = 'random';
      delete root.dataset.showSaved;
      writeMapSel(mapSel);
      renderMapBox();
      return;
    }
    if (b.dataset.mapmode === 'saved') {
      const saved = listMaps();
      if (mapSel === 'random' && saved.length) mapSel = saved[0].id;
      else if (!saved.length) root.dataset.showSaved = '1';
      writeMapSel(mapSel);
      renderMapBox();
      return;
    }
    if (b.dataset.mapmode === 'new') {
      location.href = 'editor.html?new=1';
      return;
    }
    if (b.dataset.act === 'editRandom') {
      location.href = `editor.html?seed=${Math.floor(Math.random() * 1e9) + 1}${river ? '&river=1' : ''}`;
      return;
    }
    if (b.dataset.act === 'mapEdit') {
      location.href = `editor.html?map=${encodeURIComponent(mapSel)}`;
      return;
    }
    if (b.dataset.act === 'mapDelete') {
      if (!window.confirm('Diese Karte löschen?')) return;
      deleteMap(mapSel);
      mapSel = 'random';
      writeMapSel(mapSel);
      renderMapBox();
      return;
    }
    if (b.dataset.cq) {
      conquest = b.dataset.cq === '1';
      writeFlag(CONQUEST_KEY, conquest);
    } else if (b.dataset.opp) {
      opponents = Number(b.dataset.opp);
      writeChoice(OPP_KEY, String(opponents));
    } else if (b.dataset.tix) {
      tickets = Number(b.dataset.tix);
      writeChoice(TICKETS_KEY, String(tickets));
    } else if (b.dataset.od) {
      const [i, k] = b.dataset.od.split(':');
      diffs[i - 1] = k;
      writeChoice(OPP_DIFF_KEY + i, k);
    } else if (b.dataset.pts) winPoints = Number(b.dataset.pts);
    else if (b.dataset.radio) {
      radio = b.dataset.radio === '1';
      writeFlag(RADIO_KEY, radio);
    } else if (b.dataset.mood) {
      mood = b.dataset.mood;
      writeChoice(MOOD_KEY, mood);
    } else if (b.dataset.weather) {
      weather = b.dataset.weather;
      writeChoice(WEATHER_KEY, weather);
    } else if (b.dataset.research) {
      research = b.dataset.research === '1';
      writeFlag(RESEARCH_KEY, research);
    } else if (b.dataset.build) {
      buildRules = b.dataset.build === '1';
      writeFlag(BUILD_KEY, buildRules);
    } else if (b.dataset.river) {
      river = b.dataset.river === '1';
      writeFlag(RIVER_KEY, river);
    } else if (b.dataset.fs) {
      setFullscreen(b.dataset.fs === '1');
    } else if (b.dataset.sound) {
      sound = b.dataset.sound === '1';
      writeFlag(SOUND_KEY, sound);
    }
    else if (b.dataset.act === 'resume') {
      hideOverlay(root);
      resume.onResume();
      return;
    } else if (b.dataset.act === 'discardSave') {
      if (!confirm('Gespeicherte Partie wirklich löschen?')) return;
      const box = root.querySelector('[data-resume]');
      box.hidden = true;
      resume.onDiscard();
    } else if (b.dataset.act === 'resetWallet') {
      resetWallet().then(
        () => matchSync().then(() => showWallet()),
        (err) => showWallet(accMsg(err)),
      );
    } else if (b.dataset.act === 'start') {
      hideOverlay(root);
      // difficulties: Schwierigkeit je Computergegner (Team 1, 2, 3); difficulty: die des ersten (Spielstand-Liste, Statistik)
      onStart({ conquest, tickets, difficulty: diffs[0], difficulties: diffs.slice(0, conquest ? opponents : 1), winPoints, mapId: mapSel, radio, weather, mood, research, river, city: true, buildRules });
      return;
    }
    mark();
  };
}

/**
 * Pausenmenü: onResume() bei „Weiter“, onQuit() bei „Zum Startmenü“. `audio` (seit v5.68, optional): { get(kind) → 0–1, set(kind, v) }
 * für die Regler Geräusche und Musik, die sofort wirken (kind 'sfx' | 'music'). `saveAs` (seit SP3, optional): { name() → Name
 * des laufenden Stands oder null, suggest() → Vorschlag für die Kopie, copy(name) → Promise<Text> } für „Speichern unter …“.
 * `account` (seit v5.157, optional): { rated } → Konto-Abschnitt (Anmelden, Registrieren, Abmelden). rated = die laufende Partie ist
 * gewertet: dann nur die Anzeige, An- und Abmelden erst nach dem Endstand (sonst fiele der Endstand weg). Ohne `account` kein Abschnitt.
 * Die laufende Partie bleibt, wie sie begonnen hat; das Konto gilt für künftige Partien.
 */
export function showPause(root, onResume, onQuit, onSave = null, audio = null, saveAs = null, account = null) {
  show(
    root,
    'pause',
    `<section class="menu small-menu">
      <h2>Pause</h2>
      <div class="stack">
        <button type="button" class="primary" data-act="resume">Weiter (P)</button>
        ${saveAs ? '<button type="button" data-pact="copy">Speichern unter …</button>' : ''}
        <button type="button" data-act="quit">Speichern und zum Startmenü</button>
      </div>
      ${saveAs ? `<p class="small center">Stand: <b data-curname></b></p>
      <div class="copybox" data-copybox hidden>
        <span class="flabel">Name der Kopie</span>
        <input type="text" maxlength="${NAME_MAX}" data-copyname aria-label="Name der Kopie">
        <div class="row2"><button type="button" class="primary" data-pact="copygo">Speichern</button><button type="button" data-pact="copycancel">Abbrechen</button></div>
        <p class="bad small" data-copyerr></p>
      </div>` : ''}
      ${account ? '<section class="account" data-account aria-label="Konto"></section>' : ''}
      ${audio ? `<div class="field"><span class="flabel">Geräusche</span>${volRow('sfx', audio.get('sfx'))}</div>
      <div class="field"><span class="flabel">Musik</span>${volRow('music', audio.get('music'))}</div>` : ''}
      <div class="field" data-fsbox hidden>
        <span class="flabel">Vollbild</span>
        <div class="seg"><button type="button" data-fs="1">An</button><button type="button" data-fs="0">Aus</button></div>
      </div>
      <p class="muted small center" data-savestate></p>
    </section>`,
  );
  const setName = () => {
    const el = root.querySelector('[data-curname]');
    if (el && saveAs) el.textContent = saveAs.name() ?? 'noch kein Stand (ab 20 s Spielzeit)';
  };
  setName();
  onSave?.((t) => {
    const el = root.querySelector('[data-savestate]');
    if (el) el.textContent = t;
  }, setName);
  markFullscreen(root);
  const accBox = root.querySelector('[data-account]');
  if (account && accBox) {
    // Kompakt, ohne Abfrage: der Anmeldestand kommt vom Startmenü (accountEmail); Netz braucht das Pausenmenü nicht
    const rated = !!account.rated;
    const email = accountEmail();
    wireAccount(accBox, {
      compact: true,
      load: false,
      init: { user: email === null ? null : { email } },
      hint: 'Diese Partie bleibt, wie sie begonnen hat. Das Konto gilt für künftige Partien.',
      locked: rated ? 'Gewertete Partie: An- und Abmelden erst nach dem Endstand.' : null,
      onSynced: () => {
        matchSync(); // Vorrat für gewertete Partien nach dem Anmelden holen (wirkt auf künftige Partien)
      },
    });
  }
  /** „Speichern unter …“: Eingabe zeigen, mit Vorschlag; „Speichern“ legt die Kopie an, das Pausenmenü bleibt offen. */
  const copyAct = (act) => {
    const box = root.querySelector('[data-copybox]');
    const input = root.querySelector('[data-copyname]');
    const err = root.querySelector('[data-copyerr]');
    const go = root.querySelector('[data-pact="copygo"]');
    if (!box || root.dataset.kind !== 'pause') return;
    if (act === 'copy') {
      box.hidden = false;
      err.textContent = '';
      input.value = saveAs.suggest();
      input.focus();
      input.select();
    } else if (act === 'copycancel') {
      box.hidden = true;
    } else if (act === 'copygo' && !go.disabled) {
      const name = input.value.trim();
      if (![...name].length || [...name].length > NAME_MAX) {
        err.textContent = `Name muss 1 bis ${NAME_MAX} Zeichen haben`;
        return;
      }
      err.textContent = '';
      go.disabled = true;
      saveAs
        .copy(name)
        .then((t) => {
          if (root.dataset.kind !== 'pause') return;
          box.hidden = true;
          root.querySelector('[data-savestate]').textContent = t;
          setName();
        })
        .catch((e) => {
          if (root.dataset.kind === 'pause') err.textContent = e.message ?? String(e);
        })
        .finally(() => {
          go.disabled = false;
        });
    }
  };
  if (audio) {
    root.oninput = (e) => {
      const r = e.target.closest?.('[data-vol]');
      if (!r) return;
      audio.set(r.dataset.vol, Number(r.value) / 100);
      root.querySelector(`[data-volout="${r.dataset.vol}"]`).textContent = `${r.value} %`;
    };
  }
  root.onkeydown = (e) => {
    if (e.key === 'Enter' && e.target.matches?.('[data-copyname]')) {
      e.preventDefault();
      copyAct('copygo');
    }
  };
  root.onclick = (e) => {
    const f = e.target.closest('[data-fs]');
    if (f) return setFullscreen(f.dataset.fs === '1');
    const p = e.target.closest('[data-pact]');
    if (p) return copyAct(p.dataset.pact);
    const b = e.target.closest('[data-act]');
    if (!b) return;
    hideOverlay(root);
    if (b.dataset.act === 'resume') onResume();
    else onQuit();
  };
}

/** Hilfe mit allen Tasten. Schließen über den Knopf oder Esc (main.js). */
export function showHelp(root) {
  show(
    root,
    'help',
    `<section class="menu help">
      <h2>Tasten und Maus</h2>
      <table class="keys">${KEYS.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>
      <div class="stack"><button type="button" class="primary" data-act="close">Schließen (Esc)</button></div>
    </section>`,
  );
  root.onclick = (e) => {
    if (e.target.closest('[data-act=close]')) hideOverlay(root);
  };
}

/**
 * Endbildschirm. info = { winner, team (eigenes Team), reason ('points' | 'eliminated' | 'radio'),
 * stats: { time, points: [a, b], winPoints, teams? } }. `teams` (seit v5.65): je Team die Zähler aus game.js (newStats),
 * earned und used; fehlt es, bleiben nur Spielzeit und Siegpunkte.
 */
export function showEnd(root, { winner, team, reason, stats }, onRestart) {
  const won = winner === team;
  const who = BALANCE.teamNames[winner];
  let why;
  if (reason === 'tickets') why = won ? 'Alle Gegner sind ausgeschieden.' : `Du bist ausgeschieden. ${who} liegt nach Tickets vorn.`;
  else if (reason === 'points') why = `${who} hat ${stats.winPoints} Siegpunkte erreicht.`;
  else if (reason === 'radio') why = `${who} hat den Sendemast ${Math.round(BALANCE.radio.hold / 60)} Minuten gehalten.`;
  else if (won) why = 'Die Hauptstadt des Gegners ist zerstört.';
  else why = 'Deine Hauptstadt ist zerstört.';
  const rows = [
    ['Einheiten ausgebildet', 'trained'],
    ['Einheiten verloren', 'lost'],
    ['Abschüsse', 'kills'],
    ['Gebäude zerstört', 'buildingsKilled'],
    ['Gebäude verloren', 'buildingsLost'],
    ['Höchste Armeegröße', 'peakUnits'],
    ['Geld aus Prämien', 'earned'],
    ['Munition verbraucht', 'mun'],
    ['Treibstoff verbraucht', 'fuel'],
  ];
  const num = (v) => Math.round(v || 0).toLocaleString('de-DE');
  const val = (t, key) => (key === 'mun' || key === 'fuel' ? num(t.used?.[key]) : num(t[key]));
  const names = BALANCE.teamNames.slice(0, stats.points.length);
  const ptsLabel = stats.tickets ? 'Tickets' : 'Siegpunkte';
  const table = stats.teams
    ? `<table class="keys end-stats">
        <tr class="head"><th></th>${names.map((n, i) => `<td class="${i === team ? 'mine' : ''}">${esc(n)}${i === team ? ' (du)' : ''}</td>`).join('')}</tr>
        <tr><th>Spielzeit</th><td colspan="${names.length}" class="center">${fmtTime(stats.time)}</td></tr>
        <tr><th>${ptsLabel}</th>${names.map((n, i) => `<td class="${i === team ? 'mine' : ''}">${num(stats.points[i])}</td>`).join('')}</tr>
        ${rows
          .map(([label, key]) => `<tr><th>${label}</th>${stats.teams.map((t, i) => `<td class="${i === team ? 'mine' : ''}">${val(t, key)}</td>`).join('')}</tr>`)
          .join('')}
      </table>`
    : `<table class="keys">
        <tr><th>Spielzeit</th><td>${fmtTime(stats.time)}</td></tr>
        <tr><th>${ptsLabel}</th><td>${names.map((n, i) => `${n} ${stats.points[i]}`).join(' : ')}</td></tr>
      </table>`;
  show(
    root,
    'end',
    `<section class="menu end">
      <h2 class="end-title ${won ? 'win' : 'lose'}">${won ? 'Sieg' : 'Niederlage'}</h2>
      <p class="center">${esc(why)}</p>
      ${table}
      <div class="stack"><button type="button" class="primary" data-act="again">Nochmal</button></div>
    </section>`,
  );
  root.onclick = (e) => {
    if (!e.target.closest('[data-act=again]')) return;
    hideOverlay(root);
    onRestart();
  };
}
