// Startmenü: Kasse (Geld von Runde zu Runde, nur am Konto) und Spielstände (Schnellknopf „Fortsetzen“, Liste mit Laden,
// Umbenennen, Löschen). Zeichnet nur in das schon gesetzte Startmenü-HTML; die Daten kommen über `resume` (ui/saves.js).
// Exporte: createWallet (show, setKnown), createSaves (changed, saveAct, listBox, loadQuick, loadSaves).
import { BALANCE } from '../../data/balance.js';
import { NAME_MAX, accountWallet, resetWallet } from '../saves.js';
import { matchPending, matchReady, matchSync } from '../match.js';
import { DIFFS, esc, fmtTime, hideOverlay } from './common.js';
import { accMsg } from './account-flow.js';

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

/**
 * Kasse (KA1): nur am Konto. Vor der Anmeldeprüfung (known) bleibt die Zeile leer, damit Angemeldete nicht den Gast-Hinweis sehen.
 * Liefert { show(note), setKnown(), reset() }; reset() setzt die Kasse zurück (Knopf „zurücksetzen“) und zeigt danach den Stand.
 */
export function createWallet(root) {
  let walletKnown = false;
  const show = (note = '') => {
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
  const reset = () => {
    resetWallet().then(
      () => matchSync().then(() => show()),
      (err) => show(accMsg(err)),
    );
  };
  return { show, reset, setKnown: () => { walletKnown = true; } };
}

/**
 * Schnellknopf „Fortsetzen“ (neuester nicht beendeter Stand) und die Liste der Spielstände (SP3).
 * Liefert { changed, saveAct, listBox, loadQuick, loadSaves }; die Aufrufer laden beides einmal selbst (loadQuick, loadSaves).
 */
export function createSaves(root, resume) {
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
  return { changed, saveAct, listBox, loadQuick, loadSaves };
}
