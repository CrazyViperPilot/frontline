// HUD, Klasse Hud: Aufbau (Vorlage, Zustand), Klicks, Takt (höchstens alle 200 ms) und Abbau. Die Anzeigen hängen als Methodengruppen an
// (Object.assign, Muster wie js/render/layers/core.js): Kopfleiste (top.js), Infofeld (info.js), Stadt-Infofeld (cityinfo.js),
// Befehlskarte (commands.js), Meldungen (messages.js). Schreibt das DOM nur, wenn sich der HTML-Text geändert hat.
import { BALANCE } from '../../data/balance.js';
import { RES_KEYS, DOM_EVERY } from './common.js';
import { topMethods } from './top.js';
import { infoMethods } from './info.js';
import { cityInfoMethods } from './cityinfo.js';
import { commandMethods } from './commands.js';
import { messageMethods } from './messages.js';

export class Hud {
  /**
   * @param {HTMLElement} root  leerer Container; die HUD-Struktur wird hier erzeugt
   * @param {object} app       optional: { status(), changeSpeed(dir), cycleSpeed(), togglePause(), toggleHelp(), debug }
   */
  constructor(root, game, team, controller, app = {}) {
    this.root = root;
    this.game = game;
    this.team = team;
    this.controller = controller;
    this.app = app;
    this.lastDom = -1e9;
    this.selHtml = '';
    this.cmdHtml = '';
    this.entries = [];
    this.msgs = [];

    root.innerHTML = this.template();
    root.hidden = false;
    const q = (s) => root.querySelector(s);
    this.minimapCanvas = q('.mm canvas');
    this.msgEl = q('[data-msgs]');
    this.selEl = q('[data-sel]');
    this.cmdEl = q('[data-cmd]');
    this.cmdWrap = q('.cmd-wrap');
    this.cmdKey = ''; // gewählte Gebäude/Einheiten: Wischposition bleibt nur bei gleicher Auswahl erhalten
    this.cmdEl.addEventListener('scroll', () => this.cmdHints(), { passive: true });
    this.timeEl = q('[data-time]');
    this.zoneEl = q('[data-zone]');
    this.hotEl = q('[data-hot]');
    this.radioEl = q('[data-radio]');
    this.wxEl = q('[data-wx]');
    this.wxKey = '';
    this.capFill = q('[data-cap]');
    this.speedBtn = q('[data-act=speed]');
    this.pauseBtn = q('[data-act=pause]');
    this.soundBtn = q('[data-act=sound]');
    this.viewBtn = q('[data-act=view]');
    this.researchBtn = q('[data-act=research]');
    this.res = {};
    for (const k of RES_KEYS) {
      this.res[k] = { box: q(`[data-res=${k}]`), val: q(`[data-res=${k}] .val`), rate: q(`[data-res=${k}] .rate`) };
    }
    this.pts = this.game.teams.map((_, t) => ({
      fill: q(`[data-pf="${t}"]`),
      prog: q(`[data-pp="${t}"]`),
      num: q(`[data-pn="${t}"]`),
    }));

    // Telefon quer: Auswahl und Befehle lassen sich einklappen (nur dort sichtbar, siehe css/style.css); der Zustand wird gemerkt
    try { this.folded = localStorage.getItem('frontline-hud-fold') === '1'; } catch { this.folded = false; }
    root.classList.toggle('folded', this.folded);

    // Eroberung: Auswahlliste für den Erscheinungsort neuer Einheiten (bleibt als Element bestehen, damit sie beim Aufklappen nicht zugeht)
    this.spawnEl = document.createElement('div');
    this.spawnEl.className = 'spawn-pick';
    this.spawnEl.hidden = true;
    this.spawnIds = [];
    this.onChange = (e) => {
      if (!e.target.matches?.('[data-spawn]')) return;
      const flag = e.target.value === '' ? null : Number(e.target.value);
      for (const id of this.spawnIds) {
        const r = this.game.issue(this.team, { type: 'spawnAt', buildingId: id, flag });
        if (!r.ok) this.controller.message(r.reason);
      }
      e.target.blur();
    };
    root.addEventListener('change', this.onChange);
    this.onClick = (e) => this.click(e);
    root.addEventListener('click', this.onClick);
  }


  template() {
    const g = this.game;
    const res = RES_KEYS.map(
      (k) =>
        `<div class="res res-${k}" data-res="${k}"${k === 'money' ? ' data-act="market"' : ''}><i class="dot"></i><span class="lbl">${BALANCE.resNames[k]}</span>` +
        `<b class="val">0</b><small class="rate">+0/s</small>${k === 'money' ? '<i class="mk-ico" aria-hidden="true">⚖</i>' : ''}</div>`,
    ).join('');
    const pts = g.teams
      .map((_, t) => t)
      .map(
        (t) =>
          `<div class="pt" style="--c:${BALANCE.teamColors[t]}"><span class="pt-name">${BALANCE.teamNames[t]}</span>` +
          `<div class="pt-track"><i class="pt-fill" data-pf="${t}"></i><i class="pt-prog" data-pp="${t}"></i></div>` +
          `<b class="pt-num" data-pn="${t}">0 / ${g.winPoints}</b></div>`,
      )
      .join('');
    return `
      <div class="fabs">
        <button type="button" class="city-fab" data-act="city" title="Stadt verwalten (Y)">🏙 Stadt</button>
        ${g.research ? '<button type="button" class="city-fab research-fab" data-act="research" title="Forschungsmenü: Stufen und Forschungsbaum (U bei gewählter Hauptstadt)">🔬 Forschung</button>' : ''}
        <button type="button" class="city-fab flow-fab" data-act="flow" title="Wirtschaft: Einnahmen, Front-Lager, Einfuhr, Werke, Lager und Engpässe">📊 Wirtschaft</button>
        <button type="button" class="city-fab builder-fab" data-act="builder" title="Nächstes Baufahrzeug (J)">🚧 Bauer</button>
        <button type="button" class="city-fab strike-fab" data-act="strike" title="Luftschlag (F4): startbereite Jets mit Bodenwaffen auf ein Ziel schicken">✈ Luftschlag</button>
      </div>
      <header class="top">
        <div class="res-row">${res}</div>
        <div class="pts">${pts}</div>
        <div class="zone" data-zone>neutral</div>
        <div class="cap" title="${g.conquest ? 'Eroberung: kein Punktebalken; es zählen Flaggen und Tickets (links).' : 'Punktebalken: füllt sich für das Team mit mehr Spielern in der Konfliktzone (Hot Zone zählt doppelt). Voll = 1 Punkt.'}"><i data-cap></i></div>
        <div class="zone hotz" data-hot title="Hot Zone: kleiner Kreis in der Konfliktzone, zieht zu aktiven Bohrern. Einheiten darin bringen doppeltes Zonengeld${g.conquest ? '' : ' und zählen bei der Punktewertung doppelt'}.">HOT</div>
        <div class="zone radioz" data-radio hidden title="Sendemast: steht er die volle Zeit, gewinnt sein Team. Zerstören setzt die Zeit zurück."></div>
        <div class="clock">
          ${this.app.debug ? '<span class="dbg">DEBUG</span>' : ''}
          ${g.weather?.on ? '<button type="button" class="wx" data-act="weather" data-wx></button>' : ''}
          <span class="time" data-time>00:00</span>
          <button type="button" class="btn-sm" data-act="speed" title="Spielgeschwindigkeit (+ / -)">1×</button>
          <button type="button" class="btn-sm" data-act="pause" title="Pause (P)">Pause</button>
          <button type="button" class="btn-sm" data-act="rotl" title="Isometrische Ansicht nach links drehen (,)">⟲</button>
          <button type="button" class="btn-sm" data-act="view" title="Ansicht umschalten: 2D / isometrisch (V)">2D</button>
          <button type="button" class="btn-sm" data-act="rotr" title="Isometrische Ansicht nach rechts drehen (.)">⟳</button>
          <button type="button" class="btn-sm" data-act="city" title="Stadt verwalten (Y)">Stadt</button>
          <button type="button" class="btn-sm" data-act="sound" title="Ton an/aus (F2)" aria-label="Ton an/aus">🔊</button>
          <button type="button" class="btn-sm" data-act="help" title="Hilfe (F1)">Hilfe</button>
        </div>
      </header>
      <div class="msgs" data-msgs></div>
      <div class="bottom">
        <div class="panel mm"><canvas aria-label="Übersicht"></canvas></div>
        <button type="button" class="fold" data-act="fold" title="Auswahl und Befehle ein-/ausklappen" aria-label="Auswahl und Befehle ein-/ausklappen">▾</button>
        <div class="panel sel" data-sel></div>
        <div class="cmd-wrap"><div class="panel cmd" data-cmd></div></div>
      </div>`;
  }


  setFolded(on) {
    this.folded = on;
    this.root.classList.toggle('folded', on);
    try { localStorage.setItem('frontline-hud-fold', on ? '1' : '0'); } catch { /* ohne Speicher: gilt nur für diese Sitzung */ }
    this.app.onLayout?.();
  }


  /** Von der HUD verdeckte Höhe oben und unten (CSS-Pixel), damit die Kamera Ziele in die freie Mitte legt. */
  insets() {
    const shown = (el) => (el && el.offsetParent !== null ? el.getBoundingClientRect() : null);
    const top = shown(this.root.querySelector('.top'));
    const foldBtn = shown(this.root.querySelector('.fold'));
    // eingeklappt deckt nur die Übersichtskarte eine Ecke ab: kein Versatz nötig
    const panels = foldBtn && this.folded ? [] : [this.cmdEl, this.selEl, this.root.querySelector('.mm')].map(shown).filter(Boolean);
    return { top: top ? top.bottom : 0, bottom: panels.length ? window.innerHeight - Math.min(...panels.map((b) => b.top)) : 0 };
  }


  click(e) {
    const act = e.target.closest('[data-act]');
    if (act) {
      if (act.dataset.act === 'speed') this.app.cycleSpeed?.();
      else if (act.dataset.act === 'pause') this.app.togglePause?.();
      else if (act.dataset.act === 'help') this.app.toggleHelp?.();
      else if (act.dataset.act === 'builder') this.app.nextBuilder?.();
      else if (act.dataset.act === 'strike') this.app.airstrike?.();
      else if (act.dataset.act === 'city') this.app.toggleCity?.();
      else if (act.dataset.act === 'market') this.app.toggleMarket?.();
      else if (act.dataset.act === 'research') this.app.toggleResearch?.();
      else if (act.dataset.act === 'flow') this.app.toggleFlow?.();
      else if (act.dataset.act === 'sound') this.app.toggleSound?.();
      else if (act.dataset.act === 'view') this.app.toggleView?.();
      else if (act.dataset.act === 'rotl') this.app.rotateView?.(-1);
      else if (act.dataset.act === 'rotr') this.app.rotateView?.(1);
      else if (act.dataset.act === 'fold') this.setFolded(!this.folded);
      else if (act.dataset.act === 'weather') this.controller.message(this.weatherText());
      return;
    }
    const cb = e.target.closest('.cbtn');
    if (cb) {
      const en = this.entries[Number(cb.dataset.i)];
      if (en) {
        if (en.enabled) en.action();
        else this.controller.message(en.reason || en.tip);
      }
      this.refresh();
      return;
    }
    const msg = e.target.closest('.msg.go');
    if (msg) {
      const m = this.msgs[Number(msg.dataset.m)];
      if (m && m.pos) this.controller.camera.centerOn(m.pos.x, m.pos.y);
    }
  }


  /** Aktualisiert alle Teile, höchstens alle 200 ms (außer force). */
  update(force = false) {
    const now = performance.now();
    if (!force && now - this.lastDom < DOM_EVERY) return;
    this.lastDom = now;
    this.updateTop();
    this.updateSelection();
    this.updateCommands();
    this.expire(now);
  }


  refresh() {
    this.update(true);
  }


  destroy() {
    this.root.removeEventListener('click', this.onClick);
    this.root.removeEventListener('change', this.onChange);
    this.root.innerHTML = '';
    this.root.hidden = true;
  }
}

Object.assign(Hud.prototype, topMethods, infoMethods, cityInfoMethods, commandMethods, messageMethods);
