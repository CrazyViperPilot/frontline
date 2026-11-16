// HUD, Befehlskarte: Knöpfe der Auswahl (Ausbildung, Aktionen), Wischschatten auf dem Telefon. Methoden der Klasse Hud (core.js),
// eingehängt über Object.assign (commandMethods).
import { esc } from './common.js';

export const commandMethods = {

  /** Telefon quer: Schatten am linken/rechten Rand, wenn links bzw. rechts noch Knöpfe hinter dem Rand liegen. */
  cmdHints() {
    const el = this.cmdEl;
    const max = el.scrollWidth - el.clientWidth;
    if (this.cmdWrap) {
      this.cmdWrap.dataset.hintL = el.scrollLeft > 4 ? '1' : '0';
      this.cmdWrap.dataset.hintR = el.scrollLeft < max - 4 ? '1' : '0';
    }
  },


  /**
   * Befehlskarte. Neu aufgebaut (innerHTML) wird sie nur, wenn sich Knöpfe, Beschriftung, Kosten oder Tasten ändern. Ändern sich nur
   * Tooltip oder Zustand (z. B. „Fehlt: 99 Geld“, das mit jedem Geldzuwachs wechselt), werden die vorhandenen Knöpfe angepasst: sonst
   * verschwindet der Knopf unter der Maus mehrmals je Sekunde, er flackert und ein Klick geht verloren (seit v5.76).
   */
  updateCommands() {
    const entries = this.controller.commandCard();
    this.entries = entries;
    const tipOf = (e) => (e.enabled ? e.tip : e.reason || e.tip);
    const clsOf = (e) => `cbtn${e.enabled ? '' : ' off'}${e.active ? ' on' : ''}`;
    const html = entries
      .map(
        (e, i) =>
          `<button type="button" class="cbtn" data-i="${i}" data-g="${e.group === 'train' ? 't' : 'a'}">` +
          `<span class="cl">${esc(e.label)}</span>` +
          `${e.cost ? `<span class="cc">${esc(e.cost)}</span>` : ''}` +
          `${e.hotkey ? `<span class="ck">${esc(e.hotkey)}</span>` : ''}</button>`,
      )
      .join('');
    // Telefon quer: Ausbildung in der Wischzeile oben, die übrigen Aktionen darunter (ohne Ausbildung nur eine Zeile)
    this.cmdEl.dataset.rows = entries.some((e) => e.group === 'train') ? '2' : '1';
    const key = [...this.controller.view.selection].join(',');
    if (html !== this.cmdHtml) {
      const x = this.cmdEl.scrollLeft; // Wischposition: bleibt beim Neuaufbau, solange dasselbe Gebäude gewählt ist
      this.cmdHtml = html;
      this.cmdEl.innerHTML = html;
      this.cmdEl.scrollLeft = key === this.cmdKey ? x : 0;
    }
    this.cmdKey = key;
    this.cmdHints();
    const btns = this.cmdEl.children;
    for (let i = 0; i < entries.length && i < btns.length; i++) {
      const el = btns[i];
      const cls = clsOf(entries[i]);
      if (el.className !== cls) el.className = cls;
      const tip = tipOf(entries[i]);
      if (el.dataset.tip !== tip) el.dataset.tip = tip;
    }
  },
};
