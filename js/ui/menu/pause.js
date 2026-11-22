// Pausenmenü: Weiter, Speichern unter …, Konto (kompakt), Feedback, Bildauflösung, Lautstärke, Vollbild. pauseHtml baut den Dialog,
// makeCopyAct das „Speichern unter …“; showPause verdrahtet beides. Reines DOM, keine Spiellogik. Export: showPause.
import { NAME_MAX, accountEmail } from '../saves.js';
import { matchSync } from '../match.js';
import { show, hideOverlay, markFullscreen, setFullscreen, volRow } from './common.js';
import { writeLowRes } from './prefs.js';
import { wireAccount } from './account.js';
import { feedbackHtml, wireFeedback } from './feedback.js';
import { getTelemetry } from '../telemetry.js';

/** Das HTML des Pausenmenüs; saveAs, account, display und audio wie bei showPause (leer = Abschnitt entfällt). */
function pauseHtml(saveAs, account, display, audio) {
  return `<section class="menu small-menu">
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
      ${feedbackHtml()}
      ${display ? `<div class="field"><span class="flabel" title="Scharf: volle Pixeldichte (höchstens 2×). Leistung: 1× Pixel, schont schwache Geräte; wirkt sofort">Bildauflösung</span>
        <div class="seg"><button type="button" data-lowres="0">Scharf</button><button type="button" data-lowres="1">Leistung</button></div>
      </div>` : ''}
      ${audio ? `<div class="field"><span class="flabel">Geräusche</span>${volRow('sfx', audio.get('sfx'))}</div>
      <div class="field"><span class="flabel">Musik</span>${volRow('music', audio.get('music'))}</div>` : ''}
      <div class="field" data-fsbox hidden>
        <span class="flabel">Vollbild</span>
        <div class="seg"><button type="button" data-fs="1">An</button><button type="button" data-fs="0">Aus</button></div>
      </div>
      <p class="muted small center" data-savestate></p>
    </section>`;
}

/** „Speichern unter …“: Eingabe zeigen, mit Vorschlag; „Speichern“ legt die Kopie an, das Pausenmenü bleibt offen. */
function makeCopyAct(root, saveAs, setName) {
  return (act) => {
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
}

/**
 * Pausenmenü: onResume() bei „Weiter“, onQuit() bei „Zum Startmenü“. `audio` (seit v5.68, optional): { get(kind) → 0–1, set(kind, v) }
 * für die Regler Geräusche und Musik, die sofort wirken (kind 'sfx' | 'music'). `saveAs` (seit SP3, optional): { name() → Name
 * des laufenden Stands oder null, suggest() → Vorschlag für die Kopie, copy(name) → Promise<Text> } für „Speichern unter …“.
 * `account` (seit v5.157, optional): { rated } → Konto-Abschnitt (Anmelden, Registrieren, Abmelden). rated = die laufende Partie ist
 * gewertet: dann nur die Anzeige, An- und Abmelden erst nach dem Endstand (sonst fiele der Endstand weg). Ohne `account` kein Abschnitt.
 * Die laufende Partie bleibt, wie sie begonnen hat; das Konto gilt für künftige Partien.
 * `display` (optional): { get() → true bei Bildauflösung „Leistung“, set(on) } wirkt sofort auf das Bild.
 */
export function showPause(root, onResume, onQuit, onSave = null, audio = null, saveAs = null, account = null, display = null) {
  show(root, 'pause', pauseHtml(saveAs, account, display, audio));
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
  const markLowRes = () => {
    root.querySelectorAll('[data-lowres]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.lowres === '1') === !!display?.get())));
  };
  markLowRes();
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
        getTelemetry().linkAccount(); // Spieler-ID der Statistik ans Konto (nur mit Einwilligung)
      },
    });
  }
  /** „Speichern unter …“: Eingabe zeigen, mit Vorschlag; „Speichern“ legt die Kopie an, das Pausenmenü bleibt offen. */
  const copyAct = makeCopyAct(root, saveAs, setName);
  wireFeedback(root, 'pause'); // Rückmeldung (menu/feedback.js), eigene Klicks
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
    const lr = e.target.closest('[data-lowres]');
    if (lr && display) {
      display.set(lr.dataset.lowres === '1');
      writeLowRes(lr.dataset.lowres === '1');
      return markLowRes();
    }
    const p = e.target.closest('[data-pact]');
    if (p) return copyAct(p.dataset.pact);
    const b = e.target.closest('[data-act]');
    if (!b) return;
    hideOverlay(root);
    if (b.dataset.act === 'resume') onResume();
    else onQuit();
  };
}
