// HUD, Infofeld: Auswahl (nichts, Einheit, Gebäude, Mehrfachauswahl), Warteschlange, Nachschub, Forschung, Bohrer, Baustelle und die
// Auswahlliste „Neue Einheiten erscheinen“ der Eroberung. Methoden der Klasse Hud (core.js), eingehängt über Object.assign (infoMethods);
// Stadtgebäude: cityinfo.js.
import { BALANCE } from '../../data/balance.js';
import { UNITS } from '../../data/units.js';
import { BUILDINGS } from '../../data/buildings.js';
import { RESEARCH } from '../../data/research.js';
import { lacksAmmo, isFoe } from '../../game/entities.js';
import { storedCrates } from '../../game/crates.js';
import { heightMult } from '../../game/combat.js';
import { builderState } from '../../game/construction.js';
import { fobLabel, orderText } from '../status.js';
import { COLOR, STORE_CAP, CAPITAL_CAP, presetName, esc, bar, hpColor, fmtDe, gauge, storeRow } from './common.js';

export const infoMethods = {

  updateSelection() {
    const c = this.controller;
    const sel = c.selected();
    const hint = c.hint();
    let html = hint ? `<div class="hint">${esc(hint)}</div>` : '';
    if (!sel.length) {
      html +=
        '<div class="empty">Nichts ausgewählt</div>' +
        '<div class="muted small">Klick wählt, Rahmen für mehrere, Rechtsklick befiehlt. F1 zeigt alle Tasten.</div>';
    } else if (sel.length === 1) {
      html += sel[0].kind === 'unit' ? this.unitInfo(sel[0]) : this.buildingInfo(sel[0]);
    } else {
      html += this.multiInfo(sel);
    }
    if (this.spawnEl.contains(document.activeElement)) return; // Dropdown ist offen: das Feld nicht neu aufbauen
    if (html !== this.selHtml) {
      this.selHtml = html;
      this.selEl.innerHTML = html;
      this.selEl.appendChild(this.spawnEl);
    }
    this.updateSpawnPick(sel);
  },


  /**
   * Eroberung: Auswahlliste „Neue Einheiten erscheinen“ für gewählte eigene Ausbildungsgebäude mit Bodeneinheiten (Kaserne,
   * Fabrikhalle): am Gebäude oder an einer Flagge, die dem Team gerade gehört. Steht ein Gegner im Gebiet der Flagge oder geht sie
   * verloren, erscheinen die Einheiten am Gebäude (Befehl spawnAt).
   */
  updateSpawnPick(sel) {
    const g = this.game;
    const blds = g.conquest ? sel.filter((b) => b.kind === 'building' && b.team === this.team && b.built && b.produces?.some((u) => !UNITS[u].air)) : [];
    this.spawnIds = blds.map((b) => b.id);
    this.spawnEl.hidden = !blds.length;
    if (!blds.length) return;
    const cur = blds[0].spawnFlag ?? null;
    const flags = g.conquest.flags.filter((f) => f.owner === this.team || f.id === cur);
    const key = `${this.spawnIds.join(',')}|${cur}|${flags.map((f) => `${f.id}${f.owner !== this.team ? 'x' : f.contested ? '!' : ''}`).join(',')}`;
    if (key === this.spawnKey) return;
    this.spawnKey = key;
    const opt = (f) => `<option value="${f.id}"${f.id === cur ? ' selected' : ''}>Flagge ${f.letter}${f.name ? ` ${esc(f.name)}` : ''}${f.owner !== this.team ? ' (verloren)' : f.contested ? ' (umkämpft)' : ''}</option>`;
    this.spawnEl.innerHTML =
      `<label class="small">Neue Einheiten erscheinen <select data-spawn><option value=""${cur === null ? ' selected' : ''}>am Gebäude</option>${flags.map(opt).join('')}</select></label>` +
      (flags.length ? '' : '<div class="muted small">Noch keine eigene Flagge</div>');
  },


  /** Einzelne Einheit: HP, Vorrat (Munition/Treibstoff), LKW-Ladung, Auftrag. */
  unitInfo(u) {
    const f = u.hp / u.maxHp;
    let h =
      `<div class="title">${esc(u.def.name)}</div>${bar(f, 'hp', hpColor(f))}` +
      `<div class="muted small">${Math.ceil(u.hp)} / ${u.maxHp} HP · ${esc(orderText(this.game, u))}</div>`;
    if (u.house) h += this.houseInfo(u);
    if (u.crate) h += `<div class="muted small">Trägt eine Versorgungskiste: ${Math.round(BALANCE.crates.carrySpeed * 100)} % Tempo, schießt nicht · K = ablegen</div>`;
    if (this.game.relief && !u.def.air) h += this.heightInfo(u);
    if (u.weapons.length) {
      for (const w of u.weapons) h += gauge(w.spec.name, Math.floor(w.rounds), w.spec.rounds, COLOR.ammo);
      h += `<div class="muted small">Nachladen in der FOB: ${Math.ceil(u.def.ammoMax - u.ammo)} Munition fehlen</div>`;
      if (lacksAmmo(u)) h += `<div class="warn small">Keine Munition – feuert nicht</div>`;
    }
    if (u.def.bmCap) {
      h += gauge('Baumaterial', Math.floor(u.cargo.bm), u.def.bmCap, COLOR.bm);
      h += `<div class="muted small">Baut Mauern, Tore und Feldstellungen aus getragenem Baumaterial (nachladen in einer FOB)</div>`;
    }
    if (u.def.fuelMax) {
      h += gauge('Treibstoff', u.fuel, u.def.fuelMax, COLOR.fuel);
      if (u.fuel <= 0) h += `<div class="warn small">Kein Treibstoff – nur 25 % Tempo</div>`;
    }
    if (u.def.seats) {
      h += gauge('Passagiere', u.passengers.length, u.def.seats, COLOR.cargo);
    }
    if (u.def.cargoCap) {
      const c = u.cargo;
      const sum = c.bm + c.mun + c.fuel;
      h += gauge('Ladung', sum, u.def.cargoCap, COLOR.cargo);
      h +=
        `<div class="muted small">${Math.floor(c.bm)} BM · ${Math.floor(c.mun)} MUN · ${Math.floor(c.fuel)} TS` +
        ` · Ladungsart: ${presetName(u.preset)}</div>`;
    }
    return h;
  },


  /** Besatzer eines Stadthauses: Haus, Plätze, Zustand. */
  houseInfo(u) {
    const h = this.game.getEntity(u.house);
    if (!h) return '';
    const f = h.hp / h.maxHp;
    return (
      `<div class="muted small">Im Gebäude: ${esc(h.def.name)} · ${h.occupants.length} / ${h.def.cap} Plätze · Zustand ${Math.ceil(f * 100)} %</div>` +
      bar(f, 'hp', hpColor(f)) +
      '<div class="muted small">Geschützt, schießt ab der Hauswand · O = aussteigen</div>' +
      this.worksInfo(h)
    );
  },


  /** Ausbauten eines Stadthauses (Sandsäcke, MG-Nest, Stacheldraht) und der laufende Ausbau. */
  worksInfo(h) {
    const W = BALANCE.garrison.works;
    const done = Object.keys(h.works).map((k) => W[k].name);
    let t = done.length ? `<div class="muted small">Ausgebaut: ${esc(done.join(', '))}</div>` : '';
    if (h.building) t += `<div class="muted small">Baut ${esc(W[h.building.work].name)}: noch ${Math.ceil(h.building.left)} s</div>`;
    return t;
  },


  /** Standhöhe; zeigt der Zeiger auf einen sichtbaren Gegner, auch den Höhenvorteil gegen ihn. */
  heightInfo(u) {
    const g = this.game;
    let line = `Standhöhe ${Math.round(g.groundHeight(u) + (u.house ? BALANCE.garrison.floor : 0))}`;
    const t = g.getEntity(this.controller.view.hoverId);
    if (isFoe(u.team, t) && u.weapons.length && g.sees(u.team, t)) {
      const m = heightMult(g, u, t);
      const p = Math.round(Math.abs(m - 1) * 100);
      if (p >= 1) line += m > 1 ? ` · Ziel tiefer: +${p} % Schaden` : ` · Ziel höher: −${p} % Schaden`;
    }
    return `<div class="muted small">${esc(line)}</div>`;
  },


  /** Gebäude: FOB (Lager, Baustelle), Baustelle (Fortschritt, Status), Stadtgebäude, Ausbildung. */
  buildingInfo(b) {
    if (b.type === 'city') return this.cityInfo(b);
    const g = this.game;
    const f = b.hp / b.maxHp;
    const name = b.type === 'fob' ? fobLabel(g, b) : b.def.name;
    let h = `<div class="title">${esc(name)}</div>${bar(f, 'hp', hpColor(f))}`;
    if (!b.built) {
      h += `<div class="muted small">${esc(this.siteStatus(b))}</div>${bar(b.progress, 'prog')}`;
    } else {
      h += '<div class="muted small">Einsatzbereit</div>';
    }
    const crates = b.type === 'fob' ? storedCrates(g, b.team, b.id) : 0;
    if (crates) h += `<div class="muted small">${crates} Versorgungskiste${crates > 1 ? 'n' : ''} eingelagert: +${fmtDe(crates * BALANCE.crates.income)} Geld/s</div>`;
    if (b.type === 'fob') {
      const cap = b.main ? CAPITAL_CAP : STORE_CAP;
      h +=
        (b.main
          ? '<div class="muted small lagerhead">Lager der Hauptstadt (die Werke der Stadt füllen es) · Truppen bilden Kaserne, Fabrikhalle und Heliport aus</div>'
          : '<div class="muted small lagerhead">Lager dieser FOB (LKW füllen es aus der Hauptstadt)</div>') +
        storeRow('BM', b.store.bm, cap, COLOR.bm) +
        storeRow('MUN', b.store.mun, cap, COLOR.mun) +
        storeRow('TS', b.store.fuel, cap, COLOR.fuel);
      if (b.main && (!g.conquest || BALANCE.conquest.reinforce)) h += this.reinforceInfo(b);
      if (b.main && g.research) h += this.researchInfo(b.team);
    }
    if (b.def.weapon && b.def.weapon.shell && b.built) {
      const w = b.def.weapon;
      h += b.fireTarget
        ? `<div class="muted small">Ziel gewählt · Schuss alle ${w.cooldown} s · Reichweite ${w.range} px</div>`
        : `<div class="muted small">Kein Ziel: G oder Rechtsklick wählt eins · Reichweite ${w.range} px</div>`;
      const sup = g.supplierOf(b);
      if (!sup) h += `<div class="warn small">Keine FOB in Reichweite – keine Munition</div>`;
      else if (sup.store.mun < w.ammoPerShot) h += `<div class="warn small">FOB ohne Munition – feuert nicht</div>`;
    }
    if (b.type === 'tower' && b.built) {
      const roof = b.roof ? BUILDINGS.tower.roofs[b.roof].name : b.roofJob ? `${BUILDINGS.tower.roofs[b.roofJob.kind].name} im Bau` : 'frei';
      h += `<div class="muted small">Besatzung ${b.occupants.length}/${b.def.cap} · Dach: ${esc(roof)}</div>`;
      if (b.roof && !b.occupants.length) h += '<div class="warn small">Ohne Besatzung feuert der Aufbau nicht</div>';
    }
    if (b.drill && b.built) h += this.drillInfo(b);
    return h + this.queueInfo(b);
  },


  /** Warteschlange: die ersten trainSlots Aufträge laufen gleichzeitig (Stadt: je Stufe b.trainSlots), je mit eigenem Fortschritt. */
  queueInfo(b) {
    let h = '';
    if (b.queue.length) {
      const slots = Math.min(b.trainSlots ?? BALANCE.trainSlots, b.queue.length);
      let rows = '';
      for (let i = 0; i < slots; i++) {
        const ut = UNITS[b.queue[i].unit];
        const shown = Math.min(ut.buildTime, b.queueTimes[i]).toFixed(0);
        rows += `<div class="small">${esc(ut.name)}: ${shown} / ${ut.buildTime} s</div>${bar(b.queueTimes[i] / ut.buildTime, 'prog')}`;
      }
      const rest = b.queue.slice(slots);
      if (rest.length) rows += `<div class="muted small">Warteschlange: ${rest.map((e) => esc(UNITS[e.unit].name)).join(', ')}</div>`;
      h += `<div class="queue">${rows}</div>`;
    }
    return h;
  },


  /** Hauptstadt: Soldaten-Nachschub (Restzeit bis zum nächsten Schützen oder Ruhezustand). */
  reinforceInfo(b) {
    const g = this.game;
    const R = BALANCE.reinforce;
    const t = g.teams[b.team];
    const soldiers = g.soldierCount(b.team);
    const label = `Soldaten ${soldiers}/${R.soldierMin}, Plätze ${g.slotsUsed(b.team)}/${g.slotCap}`;
    if (soldiers >= R.soldierMin) {
      return `<div class="muted small">Nachschub ruht (${label})</div>`;
    }
    const left = Math.max(0, Math.ceil(R.interval - t.reinforceTimer)); // 0, solange kein Feld frei ist
    return `<div class="muted small">Nachschub: ${esc(UNITS[R.unit].name)} in ${left} s (${label})</div>`;
  },


  /** Hauptstadt mit Forschung: Stufe, erforschte Verbesserungen, laufende Forschung mit Fortschritt. */
  researchInfo(team) {
    const tech = this.game.teams[team].tech;
    const items = RESEARCH.items;
    const n = tech.done.length;
    let h = `<div class="small research">Stufe ${tech.tier} von ${RESEARCH.tiers}${n ? ` · ${n} erforscht` : ''}${tech.queue?.length ? ` · ${tech.queue.length} warten` : ''}</div>`;
    const cur = tech.cur;
    if (cur) {
      const it = items[cur.key];
      h += `<div class="small">Forschung ${esc(it.name)}: ${Math.min(it.time, cur.t).toFixed(0)} / ${it.time} s</div>${bar(cur.t / it.time, 'prog research')}`;
    } else {
      h += '<div class="muted small">U = Forschungsbaum (10 Stufen, Verbesserungen je Einheit)</div>';
    }
    return h;
  },


  /** Bohrer: Phase und Restzeit. */
  drillInfo(b) {
    const g = this.game;
    const d = b.drill;
    const cfg = b.def.drill;
    const left = Math.max(0, Math.ceil((d.state === 'active' ? d.endAt : d.readyAt) - g.time));
    const txt = {
      warmup: `Wärmt auf · bereit in ${left} s`,
      ready: 'Bereit: G aktiviert (braucht Treibstoff in der FOB)',
      active: `Aktiv · noch ${left} s · ${cfg.fuelPerSec} TS/s aus der FOB`,
      cooldown: `Abkühlen · bereit in ${left} s`,
    }[d.state];
    return `<div class="muted small">${esc(txt)}</div>`;
  },


  /** Status einer Baustelle: Baufahrzeug/Bauer, sonst Fortschritt. */
  siteStatus(b) {
    const st = builderState(this.game, b);
    if (st === 'near') return `Im Bau · ${Math.floor(b.progress * 100)} %`;
    if (st === 'assigned') return 'Baufahrzeug unterwegs';
    return b.type === 'wall' || b.type === 'gate' ? 'Wartet auf Infanterie oder Baufahrzeug' : 'Wartet auf Baufahrzeug';
  },


  /** Mehrfachauswahl: Anzahl je Typ, Einheiten ohne Munition/Treibstoff. */
  multiInfo(sel) {
    const units = sel.filter((e) => e.kind === 'unit');
    const blds = sel.length - units.length;
    const counts = new Map();
    for (const e of sel) counts.set(e.def.name, (counts.get(e.def.name) || 0) + 1);
    const title = [units.length ? `${units.length} Einheiten` : '', blds ? `${blds} Gebäude` : ''].filter(Boolean).join(' · ');
    const chips = [...counts].map(([n, c]) => `<span>${c}× ${esc(n)}</span>`).join('');
    const noAmmo = units.filter((u) => lacksAmmo(u)).length;
    const noFuel = units.filter((u) => u.def.fuelMax && u.fuel <= 0).length;
    const warn = [noAmmo ? `${noAmmo} ohne Munition` : '', noFuel ? `${noFuel} ohne Treibstoff` : ''].filter(Boolean);
    const inside = units.filter((u) => u.house).length;
    return (
      `<div class="title">${title}</div><div class="chips">${chips}</div>` +
      (inside ? `<div class="muted small">${inside} im Gebäude · O = aussteigen</div>` : '') +
      (warn.length ? `<div class="warn small">${esc(warn.join(' · '))}</div>` : '')
    );
  },
};
