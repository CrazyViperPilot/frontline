// Ressourcenanzeige (PRD §15 „Ressourcenanzeige“, seit v5.07): Fenster mit dem Fluss der Rohstoffe durch die Kette, geöffnet
// über den Knopf „Wirtschaft“ rechts oben (unter „Forschung“). Links die Einfuhr (Rohwaren/s), dann die Werke, rechts
// die Lager mit Erzeugung und Verbrauch; Linienbreite = Menge je s. Rot = Engpass, gelb = Werk wartet oder Rohstoff verfällt.
// Unten die Engpässe in Worten. Der Graph kommt aus js/game/flow.js (CITY.chain), hier wird er nur gezeichnet. Das Spiel läuft weiter.
import { resourceFlow, FlowMeter, fmtFlow } from '../game/flow.js';
import { IN_KEYS, OUT_KEYS } from '../game/ledger.js';
import { freePop, draftedCount } from '../game/city/query.js';

/** Namen im Reiter „Geld“ (Kassenbuch js/game/ledger.js). */
const IN_NAME = { zone: 'Konfliktzone', hot: 'Hot Zone', flags: 'Flaggen', crates: 'Versorgungskisten', tax: 'Steuern der Stadt', market: 'Markt (Verkauf)', bounty: 'Prämien (Abschüsse, Bauten)', debug: 'Debug' };
const OUT_NAME = { train: 'Ausbildung', build: 'Militärgebäude, Ausbau', city: 'Stadt (Bauen, Ausbau)', research: 'Forschung', import: 'Einfuhr der Rohwaren', market: 'Markt (Kauf)', upkeep: 'Phalanx-Munition' };
const MONEY_WINDOW = 30; // s Spielzeit, über die der Reiter „Geld“ die Raten misst
import { GOOD_COLOR, GOOD_SHORT, IMPORTS } from '../data/goods.js';

const NW = 158; // Breite eines Knotens (SVG-Einheiten; seit v5.30 158 statt 140, damit Namen und Mengen ganz hineinpassen)
const NH = 68; // Höhe (seit v5.70 mit Zeile „davon an Werken“ unter dem Hinweis, 68 statt 56)
const PITCH = 78; // Abstand der Reihen
const GAP = 40; // Mindestabstand zwischen zwei Spalten (Platz für die Linien und ihre Zahlen); die Breite des Graphen folgt aus der Spaltenzahl
const MIN_W = 860; // kleinste Breite des Graphen (wenige Spalten: weiter auseinander)
const TOP = 18; // Platz für die Spaltenköpfe
// Farben: Rohstoffe hier, Waren aus dem Warenregister (js/data/goods.js)
const COLOR = { ...Object.fromEntries(Object.entries(IMPORTS).map(([g, d]) => [g, d.color])), ...GOOD_COLOR }; // Rohwaren (Paket „Import“) und Waren
const UNIT = GOOD_SHORT;
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const int = (v) => Math.floor(v).toLocaleString('de-DE');
/** Text auf die Breite eines Knotens kürzen (… am Ende), damit nichts über den Rand läuft; size = Schriftgröße. */
const fit = (t, size, px = NW - 16) => {
  const max = Math.floor(px / (size * 0.56));
  const s = String(t);
  return s.length > max ? `${s.slice(0, Math.max(1, max - 1)).trimEnd()}…` : s;
};

export class FlowPanel {
  constructor(parent, game, team) {
    this.game = game;
    this.team = team;
    this.open = false;
    this.meter = new FlowMeter(60, 1);
    const root = document.createElement('div');
    root.className = 'flow';
    root.hidden = true;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Wirtschaft');
    root.innerHTML = `
      <div class="fl-head"><b>📊 Wirtschaft</b>
        <div class="fl-tabs" role="tablist"><button type="button" class="fl-tab on" data-fl-tab="res" role="tab">Ressourcen</button><button type="button" class="fl-tab" data-fl-tab="money" role="tab">Geld</button></div>
        <div class="fl-chips" data-fl-chips></div>
        <button type="button" class="btn-sm fl-close" data-fl-close title="Schließen (Esc)" aria-label="Schließen">✕</button></div>
      <div data-fl-res><svg class="fl-graph" data-fl-svg preserveAspectRatio="xMidYMin meet"></svg>
      <ul class="fl-issues" data-fl-issues></ul></div>
      <div class="fl-money" data-fl-money hidden></div>`;
    parent.appendChild(root);
    this.root = root;
    this.svg = root.querySelector('[data-fl-svg]');
    this.tab = 'res';
    this.samples = []; // Kassenbuch je Sekunde Spielzeit: { t, in, out } (Reiter „Geld“)
    root.addEventListener('click', (e) => {
      if (e.target.closest('[data-fl-close]')) this.toggle(false);
      const tab = e.target.closest('[data-fl-tab]');
      if (tab) this.setTab(tab.dataset.flTab);
    });
  }

  toggle(on = !this.open) {
    this.open = on;
    this.root.hidden = !on;
    document.body.classList.toggle('flow-open', on);
    if (on) this.update(true);
  }

  /** Reiter wechseln: 'res' (Fluss der Waren) oder 'money' (Einnahmen und Ausgaben). */
  setTab(tab) {
    this.tab = tab === 'money' ? 'money' : 'res';
    for (const b of this.root.querySelectorAll('[data-fl-tab]')) b.classList.toggle('on', b.dataset.flTab === this.tab);
    this.root.querySelector('[data-fl-res]').hidden = this.tab !== 'res';
    this.root.querySelector('[data-fl-money]').hidden = this.tab !== 'money';
    this.update(true);
  }

  /** Kassenbuch je Sekunde Spielzeit merken (auch geschlossen), MONEY_WINDOW s lang. */
  sampleMoney() {
    const g = this.game;
    const last = this.samples[this.samples.length - 1];
    if (last && g.time - last.t < 1) return;
    const b = g.teams[this.team].book ?? { in: {}, out: {} };
    this.samples.push({ t: g.time, in: { ...b.in }, out: { ...b.out } });
    while (this.samples.length > 2 && this.samples[0].t < g.time - MONEY_WINDOW) this.samples.shift();
  }

  /** Reiter „Geld“: Einnahmen nach Quelle und Ausgaben nach Zweck, je s (letzte MONEY_WINDOW s) und seit Spielbeginn. */
  moneyHtml() {
    const t = this.game.teams[this.team];
    const b = t.book ?? { in: {}, out: {} };
    const a = this.samples[0];
    const z = this.samples[this.samples.length - 1];
    const dt = a && z ? z.t - a.t : 0;
    const rate = (side, k) => (dt > 0 ? ((z[side][k] ?? 0) - (a[side][k] ?? 0)) / dt : 0);
    const fmt = (v) => `${v < -0.005 ? '−' : ''}${fmtFlow(Math.abs(v))}`;
    const rows = (side, keys, names) => {
      let sumR = 0;
      let sumT = 0;
      const tr = keys
        .filter((k) => (b[side][k] ?? 0) !== 0 || rate(side, k) !== 0)
        .map((k) => {
          const r = rate(side, k);
          const tot = b[side][k] ?? 0;
          sumR += r;
          sumT += tot;
          return `<tr><td>${esc(names[k] ?? k)}</td><td>${fmt(r)}/s</td><td>${int(tot)}</td></tr>`;
        })
        .join('');
      return { html: tr || '<tr><td colspan="3" class="muted">noch nichts</td></tr>', sumR, sumT };
    };
    const inn = rows('in', IN_KEYS, IN_NAME);
    const out = rows('out', OUT_KEYS, OUT_NAME);
    const net = inn.sumR - out.sumR;
    const table = (title, r, cls) =>
      `<table class="fl-book ${cls}"><thead><tr><th>${title}</th><th>je s</th><th>seit Start</th></tr></thead><tbody>${r.html}</tbody>` +
      `<tfoot><tr><td>Summe</td><td>${fmt(r.sumR)}/s</td><td>${int(r.sumT)}</td></tr></tfoot></table>`;
    return (
      `<div class="fl-book-top">Kasse <b>${int(t.res.money)}</b> · Bilanz <b class="${net < 0 ? 'neg' : 'pos'}">${net < 0 ? '−' : '+'}${fmtFlow(Math.abs(net))}/s</b>` +
      `<span class="muted"> (gemessen über die letzten ${Math.round(dt)} s)</span></div>` +
      `<div class="fl-book-cols">${table('Einnahmen', inn, 'in')}${table('Ausgaben', out, 'out')}</div>`
    );
  }

  /** Jedes Bild: Messung (auch geschlossen, damit der Verbrauch beim Öffnen schon da ist), Zeichnen nur offen, alle 0,5 s. */
  update(force = false) {
    this.meter.sample(this.game, this.team);
    this.sampleMoney();
    if (!this.open) return;
    const now = performance.now();
    if (!force && now - (this.last || 0) < 500) return;
    this.last = now;
    if (this.tab === 'money') {
      const team = this.game.teams[this.team];
      const inc = team.income?.money ?? 0;
      this.root.querySelector('[data-fl-chips]').innerHTML = `<span class="fl-chip${inc < 0 ? ' bad' : ''}">Geld <b>${inc < 0 ? '−' : '+'}${fmtFlow(Math.abs(inc))} G/s</b></span>`;
      this.root.querySelector('[data-fl-money]').innerHTML = this.moneyHtml();
      return;
    }
    const f = resourceFlow(this.game, this.team, this.meter.rates());
    if (!f) return;
    const F = f.factors;
    const chip = (label, v, bad) => `<span class="fl-chip${bad ? ' bad' : ''}">${label} <b>${v}</b></span>`;
    // Einfuhr (Paket „Import“): Geld je s für alle Rohwaren; rot, wenn das Geld sie bremst (importScale < 1)
    const scale = this.game.city?.[this.team]?.stats?.importScale ?? 1;
    // Paket „Kopfleiste“: Einnahmen gesamt (wie das Geld oben) und die Front-Lager (Summe der vorderen FOBs), die oben nicht mehr stehen
    const team = this.game.teams[this.team];
    const inc = team.income?.money ?? 0;
    // Einwohner (Paket „Wirtschaft: Geld“): gesamt, frei für die Ausbildung, im Dienst (ausgebildete Truppen; die Startarmee zählt nicht)
    const c = this.game.city?.[this.team];
    const pop = c ? Math.floor(c.popF + 1e-6) : 0;
    this.root.querySelector('[data-fl-chips]').innerHTML =
      chip('Geld', `${inc < 0 ? '−' : '+'}${fmtFlow(Math.abs(inc))} G/s`, inc < 0) +
      (c ? chip('Einwohner', `${pop} · frei ${Math.max(0, freePop(this.game, this.team))} · im Dienst ${draftedCount(this.game, this.team)}`, freePop(this.game, this.team) <= 0) : '') +
      chip('Front-Lager', `BM ${Math.floor(team.res.bm)} · MUN ${Math.floor(team.res.mun)} · TS ${Math.floor(team.res.fuel)}`, false) +
      chip('Arbeiter', `${Math.round(F.fill * 100)} %`, F.fill < 0.95) +
      chip('Strom', `${Math.round(F.power * 100)} %`, F.power < 0.999) +
      chip('Zufrieden', `${Math.round(F.happy * 100)} %`, F.happy < 0.5) +
      chip('Steuern', `+${fmtFlow(f.money)} G/s`, false) +
      chip('Einfuhr', `−${fmtFlow(f.importCost)} G/s${scale < 0.999 ? ` · ${Math.round(scale * 100)} %` : ''}`, scale < 0.999);
    this.svg.innerHTML = this.draw(f);
    const list = f.issues.slice(0, 4);
    this.root.querySelector('[data-fl-issues]').innerHTML = list.length
      ? list.map((i) => `<li class="${i.sev >= 1.5 ? 'bad' : 'warn'}">⚠ ${esc(i.text)} <small>${esc(i.tip)}</small></li>`).join('')
      : '<li class="ok">✓ Keine Engpässe: alles fließt.</li>';
  }

  /** Graph als SVG: Spaltenköpfe, Linien (Breite = Menge je s), Knoten. */
  draw(f) {
    const H = TOP + (f.rows - 1) * PITCH + NH + 4;
    const W = Math.max(MIN_W, f.cols * NW + (f.cols - 1) * GAP); // seit v5.30: so breit, dass sich keine Knoten überlappen
    this.svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const step = f.cols > 1 ? (W - NW) / (f.cols - 1) : 0;
    const nodes = Object.values(f.nodes);
    const pos = (n) => ({ x: n.col * step, y: TOP + n.row * PITCH });
    let h = '';
    // Spaltenköpfe
    for (let c = 0; c < f.cols; c++) {
      const here = nodes.filter((n) => n.col === c);
      const works = here.filter((n) => n.type === 'works');
      const later = works.some((n) => n.ins.some((id) => f.nodes[id].type === 'store')); // Werk nimmt aus einem Lager
      const t = c === 0 ? 'Einfuhr' : c === f.cols - 1 ? 'Lager · Verbrauch' : later ? 'Weiterverarbeitung' : works.length ? 'Werke' : here.some((n) => n.type === 'mid') ? 'Zwischenprodukt' : 'Zwischenlager';
      h += `<text class="fl-col" x="${c * step + NW / 2}" y="11">${t}</text>`;
    }
    // Linien: Anschlüsse je Knoten nach Reihe der Gegenseite gestaffelt
    const max = Math.max(0.5, ...f.links.map((l) => l.rate));
    const port = (n, id, side) => {
      const list = side === 'out' ? n.outs : n.ins;
      const sorted = [...list].sort((a, b) => f.nodes[a].row - f.nodes[b].row);
      const i = sorted.indexOf(id);
      return pos(n).y + NH / 2 + (i - (sorted.length - 1) / 2) * 12;
    };
    let labels = '';
    for (const l of f.links) {
      const a = f.nodes[l.from];
      const b = f.nodes[l.to];
      const x1 = pos(a).x + NW;
      const x2 = pos(b).x;
      const y1 = port(a, b.id, 'out');
      const y2 = port(b, a.id, 'in');
      const xm = (x1 + x2) / 2;
      const on = l.rate > 0.005;
      const w = on ? 2 + (12 * l.rate) / max : 1.5;
      h += `<path class="fl-link${on ? '' : ' off'}" d="M${x1} ${y1} C${xm} ${y1} ${xm} ${y2} ${x2} ${y2}" stroke="${COLOR[l.good] ?? '#9aa596'}" stroke-width="${w.toFixed(1)}"/>`;
      if (on) labels += `<text class="fl-rate" x="${x1 + 4}" y="${y1 - w / 2 - 3}">${fmtFlow(l.rate)}</text>`;
    }
    // Knoten
    for (const n of nodes) {
      const { x, y } = pos(n);
      let t1 = n.name;
      let where = '';
      let t2 = '';
      let bar = '';
      if (n.type === 'raw') {
        t2 = `${fmtFlow(n.rate)} ${n.unit}/s`; // Geld je s steht in der Hinweiszeile
      } else if (n.type === 'works') {
        t1 += ` ×${n.count}`;
        t2 = `${fmtFlow(n.out)} / ${fmtFlow(n.cap)} ${UNIT[n.good] ?? n.good}/s`;
        if (n.count > 0) bar = `<rect class="fl-bar" x="10" y="${NH - 6}" width="${((NW - 20) * Math.min(1, n.util ?? 0)).toFixed(1)}" height="3" rx="1.5"/>`;
      } else if (n.type === 'mid') {
        // Zwischenprodukt ohne Lager (heute keins): nur Menge je s
        t2 = `${fmtFlow(n.rate)} ${n.unit}/s`; // „ohne Lager“ steht in der Hinweiszeile
      } else {
        where = n.where;
        t2 = n.made === null ? int(n.stock) : `${int(n.stock)} · +${fmtFlow(n.made)} −${fmtFlow(n.use)}/s`;
      }
      // Lagerknoten mit Ausgangslager der Werke (seit v5.70): Zeile „davon an Werken: N“
      // Lagerknoten: was davon an Werken (Ausgangslager) und in Lagerhallen liegt, und was die Hallen je s an vordere FOBs geben
      const parts = n.type === 'store' ? [n.atWorks > 0.005 ? `Werke ${fmtFlow(n.atWorks)}` : '', n.atHalls > 0.005 ? `Hallen ${fmtFlow(n.atHalls)}` : '', n.toFobs > 0.005 ? `→ FOBs ${fmtFlow(n.toFobs)}/s` : ''].filter(Boolean) : [];
      const full = parts.length ? `davon ${parts.join(' · ')}` : '';
      const atWorks = full ? `<text class="fl-t4" x="11" y="61">${esc(fit(full, 10))}<title>${esc(full)}</title></text>` : '';
      h +=
        `<g class="fl-node ${n.status}" transform="translate(${x.toFixed(1)} ${y})"><rect class="fl-box" width="${NW}" height="${NH}" rx="7"/>` +
        `<rect x="0" y="0" width="5" height="${NH}" rx="2" fill="${COLOR[n.type === 'works' ? n.good : n.key] ?? '#9aa596'}"/>` +
        `<text class="fl-t1" x="11" y="17">${esc(fit(t1, 12, NW - 16 - (where ? Math.min(60, where.length * 5.6 + 4) : 0)))}${where ? `<tspan class="fl-where"> ${esc(where)}</tspan>` : ''}</text>` +
        `<text class="fl-t2" x="11" y="33">${esc(fit(t2, 11))}</text>` +
        `<text class="fl-t3" x="11" y="47">${esc(fit(n.note ?? '', 10))}<title>${esc(n.note ?? '')}</title></text>${atWorks}${bar}</g>`;
    }
    return h + labels;
  }

  destroy() {
    document.body.classList.remove('flow-open');
    this.root.remove();
  }
}
