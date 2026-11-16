// Konto-Bereich (docs/prd/konto.md): das Verhalten hinter den Knöpfen und Formularen. Jede make…-Funktion bekommt den gemeinsamen
// Zustand `acc` und die Zeichenfunktion `draw` von wireAccount (account.js) und liefert die Handler; die Abläufe sind unverändert.
// Exporte: accMsg, makeToggles (Statistik, Detailbereich), makeRun (Vorgang mit Sperre), makeSubmit (Formulare), makeClick (Knöpfe).
import { accountRequest, premiumHistory, requestDeactivate, setAccount, setNickname } from '../saves.js';
import { matchStats } from '../match.js';

const ACC_PASS_MIN = 8; // wie api/auth.php (FL_PASS_MIN)
const ACC_OFFLINE = 'Keine Verbindung zum Server. Bitte später erneut versuchen.';

/** Meldung zu einem Fehler: err.status gesetzt → Satz aus api/auth.php, sonst Netzfehler. */
export const accMsg = (err) => (err?.status ? err.message : ACC_OFFLINE);

/** Statistik und Detailbereich ein-/ausklappen: { toggleDetail, toggleStats }. */
export function makeToggles(acc, draw) {
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
  return { toggleDetail, toggleStats };
}

/** Liefert run(job). */
export function makeRun(acc, draw) {
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
  return run;
}

/** Formulare abschicken: liefert submit(kind, form). */
export function makeSubmit(acc, draw, run, accountChanged, onSynced) {
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
  return submit;
}

/** Knöpfe im Konto-Bereich: liefert click(act). */
export function makeClick(acc, draw, run, { toggleDetail, toggleStats }, accountChanged) {
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
  return click;
}
