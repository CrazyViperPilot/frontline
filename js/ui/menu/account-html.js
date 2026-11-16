// Konto-Bereich (docs/prd/konto.md): das HTML der Anzeige. Abgemeldet: Hinweis, Knöpfe und Formular (Anmelden, Registrieren,
// Passwort vergessen, neues Passwort); angemeldet: Konto-Art, „Meine Spiele“ (Statistik), „Konto“ (Detailbereich), Abmelden.
// Reine Textfunktionen ohne Zustand. Export: accountHtml (das Verhalten steht in account.js und account-flow.js).
import { statsHtml } from '../stats.js';
import { esc } from './common.js';

const NICK_MAX = 32; // wie api/auth.php (FL_NICK_MAX), seit KO4
const ACC_TABS = [
  ['login', 'Anmelden'],
  ['register', 'Registrieren'],
  ['forgot', 'Passwort vergessen'],
];
const fmtDay = (ms) => new Date(ms).toLocaleDateString('de-DE');

/** Konto-Art für die Anzeige: free → Kostenlos, premium → Premium (bis Datum; premiumUntil ist in Sekunden). */
function planLabel(u) {
  if (u.plan === 'premium') return u.premiumUntil ? `Premium (bis ${fmtDay(u.premiumUntil * 1000)})` : 'Premium';
  if (!u.plan || u.plan === 'free') return 'Kostenlos';
  return esc(u.plan);
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
export function accountHtml(st, { compact = false, hint = '', locked = null, stats = false, details = false } = {}) {
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
