// HUD, Meldungen: Einblendung oben (höchstens 5, je 6 s), Klick springt zum Ort. Methoden der Klasse Hud (core.js), eingehängt über
// Object.assign (messageMethods).
import { MSG_LIFE, MSG_MAX, esc } from './common.js';

export const messageMethods = {

  /** Meldung anzeigen (höchstens 5, je 6 s). pos = {x, y} in Welt: Klick springt dorthin. */
  pushMessage(text, pos = null) {
    const now = performance.now();
    if (this.msgs.some((m) => m.text === text && now - m.t < 1500)) return;
    this.msgs.push({ text, pos, t: now });
    if (this.msgs.length > MSG_MAX) this.msgs.splice(0, this.msgs.length - MSG_MAX);
    this.renderMsgs();
  },


  renderMsgs() {
    this.msgEl.innerHTML = this.msgs
      .map((m, i) => `<div class="msg${m.pos ? ' go' : ''}" data-m="${i}">${esc(m.text)}</div>`)
      .join('');
  },


  expire(now) {
    const n = this.msgs.length;
    this.msgs = this.msgs.filter((m) => now - m.t < MSG_LIFE);
    if (this.msgs.length !== n) this.renderMsgs();
  },
};
