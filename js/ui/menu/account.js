// Konto-Bereich (KO3, docs/prd/konto.md) für Start- und Pausenmenü: Rücksprung-Link aus den Mails und `wireAccount`, das den
// Bereich zeichnet und verdrahtet. HTML in account-html.js, Abläufe (Formulare, Knöpfe, Statistik) in account-flow.js.
// Exporte: takeAccountLink, initFromLink (Anfangszustand aus dem Link), wireAccount.
import { accountUser } from '../saves.js';
import { accountHtml } from './account-html.js';
import { makeClick, makeRun, makeSubmit, makeToggles } from './account-flow.js';

const TOKEN_RE = /^[0-9a-f]{64}$/; // Link-Token aus der Mail (64 Hex-Zeichen, wie fl_is_token)

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

/** Anfangszustand für wireAccount aus dem Rücksprung-Link (takeAccountLink): Hinweis, Formular, Token. */
export function initFromLink(link) {
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
  return init;
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
  const toggles = makeToggles(acc, draw);
  const run = makeRun(acc, draw);
  const submit = makeSubmit(acc, draw, run, accountChanged, onSynced);
  const click = makeClick(acc, draw, run, toggles, accountChanged);
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
