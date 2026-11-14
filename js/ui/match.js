// Signierter Match-Start (MS1, MS2, docs/prd/konto.md „Signierter Match-Start“). Gewertet wird nur eine Partie, die der Server
// begonnen hat: Der Server gibt Tokens auf Vorrat aus (bis 3, je mit der Kasse von damals, w0). Eine gewertete Partie startet
// mit einem Token (Startgeld = w0) und meldet am Ende ihren Endstand (finish). Das Token bleibt beim Start im Vorrat und wird
// erst mit dem Endstand verbraucht (MS2): eine abgebrochene Partie verbraucht keins. Der Spielstand merkt sich das Token
// (meta.match, nur lokal). Ohne Token (Gast, kein Vorrat) läuft die Partie ungewertet. Ohne Netz bleibt der Endstand auf dem
// Gerät vorgemerkt (frontline-match-ausstehend) und geht beim nächsten Abgleich. Der Server rechnet die Partie nicht nach;
// er prüft Echtheit, Einmaligkeit und die Start-Kasse. Seit v5.158 schickt das Partieende zusätzlich Partie-Infos mit (game, nur
// für die Spielstatistik, gameInfo) und holt die Statistik (matchStats). Kein DOM; geprüft in test/match.test.js.
import { apiRequest, MATCH_URL, accountEmail, accountWallet, noteWallet } from './saves.js';
import { BALANCE } from '../data/balance.js';
import { modeOf } from '../game/modes.js';

const VORRAT_KEY = 'frontline-match-vorrat'; // { email, tokens: [{ token, w0, iat }] }: ungenutzte Tokens des Kontos
const AUSSTEHEND_KEY = 'frontline-match-ausstehend'; // [{ email, token, wallet, game? }]: Endstände, die der Server noch nicht bestätigt hat
const DAY = 86400;

function load(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? 'null');
    return v ?? fallback;
  } catch {
    return fallback; // ohne Speicher oder fremder Inhalt
  }
}

function save(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ohne Speicher: gilt nur für diese Sitzung */
  }
}

function loadVorrat() {
  const v = load(VORRAT_KEY, null);
  return v && typeof v.email === 'string' && Array.isArray(v.tokens) ? v : null;
}

function loadAusstehend() {
  const list = load(AUSSTEHEND_KEY, []);
  if (!Array.isArray(list)) return [];
  return list.filter((e) => e && typeof e.email === 'string' && typeof e.token === 'string' && Number.isFinite(e.wallet));
}

/** Gültig für die Kasse, die das Konto jetzt hat: gleiche Kasse wie beim Ausgeben und nicht abgelaufen (Frist aus BALANCE.match). */
function usable(t, kasse, now) {
  return t && typeof t.token === 'string' && t.w0 === kasse && Number.isFinite(t.iat) && now - t.iat < BALANCE.match.tokenDays * DAY;
}

/** Vorrat des angemeldeten Kontos, der jetzt verwendbar ist; leer ohne Konto. */
function vorratNow() {
  const email = accountEmail();
  const kasse = accountWallet();
  if (email === null || kasse === null) return [];
  const v = loadVorrat();
  if (!v || v.email !== email) return [];
  const now = Math.floor(Date.now() / 1000);
  return v.tokens.filter((t) => usable(t, kasse, now));
}

/**
 * Gewertete Partie beginnen: liefert { token, w0 } eines verwendbaren Tokens aus dem Vorrat; w0 ist das Startgeld. Das Token
 * bleibt im Vorrat: verbraucht wird es erst mit dem Endstand (finishMatch). Ohne Konto oder ohne verwendbares Token: null
 * (die Partie ist dann ungewertet). Braucht kein Netz.
 */
export function matchStart() {
  const t = vorratNow()[0];
  return t ? { token: t.token, w0: t.w0 } : null;
}

/**
 * Eine gespeicherte gewertete Partie fortsetzen (meta.match des Standes, { token, w0 }): liefert { token, w0 }, wenn das Token
 * noch im Vorrat und verwendbar ist (gleiche Kasse, nicht abgelaufen; also nicht verbraucht). Sonst null: die Partie läuft
 * dann ungewertet weiter (anderes Gerät, schon gewertet, veraltete Kasse). Braucht kein Netz.
 */
export function matchResume(m) {
  if (!m || typeof m.token !== 'string') return null;
  const t = vorratNow().find((x) => x.token === m.token);
  return t ? { token: t.token, w0: t.w0 } : null;
}

/** Wie viele gewertete Partien sofort möglich sind (Anzeige im Startmenü). Ein laufendes Spiel zählt sein Token noch mit. */
export function matchReady() {
  return vorratNow().length;
}

/** Wie viele Endstände noch auf die Verbindung warten (für das Konto, das angemeldet ist). */
export function matchPending() {
  const email = accountEmail();
  return email === null ? 0 : loadAusstehend().filter((e) => e.email === email).length;
}

// Alle Vorgänge laufen nacheinander (Vorrat holen, Endstände schicken), damit sich Meldungen nicht überholen.
let chain = Promise.resolve();
function queue(fn) {
  const job = chain.then(fn);
  chain = job.catch(() => {});
  return job;
}

/** Vorgemerkte Endstände der Reihe nach schicken. Gehört einer zu einem anderen Konto, fällt er weg; abgelehnte (409, 400, 403) auch. */
async function flushInner() {
  for (;;) {
    const email = accountEmail();
    const list = loadAusstehend();
    if (email === null || list.length === 0) return; // abgemeldet: bleibt vorgemerkt
    const job = list[0];
    if (job.email !== email) {
      save(AUSSTEHEND_KEY, list.slice(1));
      continue;
    }
    try {
      const body = { action: 'finish', token: job.token, wallet: job.wallet };
      if (job.game) body.game = job.game; // Partie-Infos für die Statistik (seit v5.158)
      const d = await apiRequest(MATCH_URL, body);
      if (Number.isFinite(d.wallet)) noteWallet(d.wallet);
      save(AUSSTEHEND_KEY, loadAusstehend().slice(1));
    } catch (err) {
      if (err?.status === 401) return; // nicht angemeldet: bleibt vorgemerkt bis zur nächsten Anmeldung
      if (err?.status === 400 || err?.status === 403 || err?.status === 409) {
        save(AUSSTEHEND_KEY, loadAusstehend().slice(1)); // Token verbraucht, abgelaufen oder veraltet: nicht wiederholen
        continue;
      }
      return; // Netz oder Server: beim nächsten Mal
    }
  }
}

/** Vorrat vom Server holen, wenn keine Meldung mehr wartet (sonst kennt der Server die Kasse noch nicht). */
async function refillInner() {
  const email = accountEmail();
  if (email === null || matchPending() > 0) return 0;
  const d = await apiRequest(MATCH_URL, { action: 'tokens' });
  const now = Math.floor(Date.now() / 1000);
  const tokens = Array.isArray(d.tokens) ? d.tokens.filter((t) => t && typeof t.token === 'string') : [];
  save(VORRAT_KEY, { email, tokens });
  if (Number.isFinite(d.wallet)) noteWallet(d.wallet);
  return tokens.filter((t) => now - t.iat < BALANCE.match.tokenDays * DAY).length;
}

/**
 * Vorrat auffüllen und vorgemerkte Endstände schicken: beim Anmelden, beim Öffnen des Startmenüs, nach „zurücksetzen“.
 * Liefert die Zahl der verwendbaren Tokens (0 ohne Konto oder ohne Netz). Wirft nie.
 */
export function matchSync() {
  return queue(async () => {
    await flushInner();
    try {
      await refillInner();
    } catch {
      /* ohne Netz: der Vorrat bleibt, wie er ist */
    }
    return matchReady();
  }).catch(() => 0);
}

/**
 * Partie-Infos für die Statistik aus dem Endstand (game: die Partie, human: Team des Spielers). Ergebnis (win, loss), Spielzeit
 * in Sekunden, Schwierigkeit, Karte (Seed), Punkte und Abschüsse des Spielers. Nur Anzeige: der Server prüft die Werte nach.
 */
export function gameInfo(game, difficulty, human = 0) {
  const me = game.teams[human];
  const foe = game.teams[1 - human];
  return {
    result: game.winner === null ? null : game.winner === human ? 'win' : 'loss',
    duration: game.time,
    difficulty,
    seed: game.seed,
    points: [modeOf(game).score(me), modeOf(game).score(foe)], // Punkte bzw. Tickets (eigene, erster Gegner)
    kills: me.stats?.kills,
  };
}

/** Nur die bekannten Felder, Zahlen ganzzahlig; was fehlt oder nicht passt, wird null (der Server verwirft es ebenfalls). */
function tidyGame(g) {
  const num = (v) => (Number.isFinite(v) ? Math.round(v) : null);
  return {
    result: g.result === 'win' || g.result === 'loss' ? g.result : null,
    duration: num(g.duration),
    difficulty: typeof g.difficulty === 'string' ? g.difficulty : null,
    seed: num(g.seed),
    points: Array.isArray(g.points) ? g.points.map(num) : [null, null],
    kills: num(g.kills),
  };
}

/**
 * Gewertete Partie beenden: meldet den Endstand zum Token. Der Server setzt die Kasse. Ohne Netz bleibt die Meldung vorgemerkt.
 * Verbraucht ist das Token damit: es fällt sofort aus dem Vorrat (auch ohne Netz, die Meldung steht in frontline-match-ausstehend),
 * und die Antwort des Servers ändert daran nichts mehr. Die neue Kasse macht Tokens mit anderer Kasse veraltet. game (optional,
 * gameInfo) reist mit der Meldung zur Statistik; fehlt es, bleibt die Meldung wie bisher. Wirft nie.
 */
export function finishMatch(token, wallet, game = null) {
  const email = accountEmail();
  const w = Math.max(0, Math.min(BALANCE.walletMax, Math.floor(Number(wallet))));
  if (email === null || typeof token !== 'string' || !Number.isFinite(w)) return Promise.resolve();
  const entry = { email, token, wallet: w };
  if (game) entry.game = tidyGame(game);
  return queue(async () => {
    save(AUSSTEHEND_KEY, [...loadAusstehend(), entry]);
    noteWallet(w); // die Anzeige zeigt den Stand sofort; der Server bestätigt ihn gleich (flushInner)
    const v = loadVorrat();
    if (v && v.email === email) save(VORRAT_KEY, { email, tokens: v.tokens.filter((t) => t && t.token !== token && t.w0 === w) });
    await flushInner();
    try {
      await refillInner();
    } catch {
      /* ohne Netz: beim nächsten Abgleich */
    }
  }).catch(() => {});
}

/** Spielstatistik des Kontos (api/match.php „stats“): Kennzahlen und die letzten Partien. Wirft bei Netz- oder Anmeldefehler. */
export function matchStats() {
  return apiRequest(MATCH_URL, { action: 'stats' });
}
