// HUD, Stadt-Infofeld: Stadtgebäude (Stufe, Zustand, Arbeitsplätze, Leistung, Ausbildung, Fliegerhorst, Pflege, Warnungen) sowie die
// Textblöcke Einfuhr, Güterbahnhof und Straßentransport. Methoden der Klasse Hud (core.js), eingehängt über Object.assign (cityInfoMethods).
import { UNITS } from '../../data/units.js';
import { CITY } from '../../data/city.js';
import { WORKS, SUPPLIER_KINDS, WORKPLACE_KINDS, KINDS } from '../../data/citykinds.js';
import { GOOD_SHORT, IMPORTS } from '../../data/goods.js';
import { growLinked } from '../../game/city/cells.js';
import { careOf } from '../../game/city/care.js';
import { transportInfo, transportOf, supplyOf } from '../../game/transport.js';
import { standRoute, runwaysOf, runwayBusy, freeSpace } from '../../game/aircraft.js';
import { padBusy } from '../../game/helipad.js';
import { alertText } from '../status.js';
import { CITY_TIP } from '../citypanel.js';
import { esc, bar, hpColor, fmtDe, fmtRate } from './common.js';

const line = (t) => `<div class="small">${esc(t)}</div>`;

export const cityInfoMethods = {
  /** Stadtgebäude (seit v4.94 antippbar): Stufe, Zustand, Wohn- oder Arbeitsplätze, Leistung, Warnungen (Straße, Strom, Flucht). */
  cityInfo(b) {
    const g = this.game;
    const c = g.city[b.team];
    const i = b.cityCell;
    const k = KINDS[c.kind[i] - 1];
    const lv = c.level[i];
    const s = c.stats;
    const f = b.hp / b.def.hp;
    let h =
      `<div class="title">${esc(b.def.name)} <small class="muted">Stufe ${lv} von ${CITY.maxLevel}</small></div>${bar(f, 'hp', hpColor(f))}` +
      `<div class="muted small">${Math.ceil(b.hp)} / ${b.def.hp} HP</div>`;
    const made = WORKS.includes(k) ? CITY.chain[k].to : null; // Ware des Werks (Register: Werke, Kette CITY.chain)
    if (k === 'res') h += line(`Wohnplätze ${CITY.housing[lv]} · Stadt: ${Math.floor(s.pop)} / ${s.housing} Einwohner`);
    else if (k === 'com') h += line(`Arbeitsplätze ${CITY.jobsCom[lv]} · zahlt Steuern, macht die Stadt zufriedener`);
    else if (k === 'market') h += line(`Arbeitsplätze ${CITY.jobsCom[lv]} · Handel: Knopf „Handel“ oder Geldanzeige oben antippen`);
    else if (made) {
      h += line(`Arbeitsplätze ${CITY.jobs[lv]} · Stadt gesamt +${fmtRate(s[made])} ${GOOD_SHORT[made]}/s`);
      // Ausgangslager (seit v5.69): LKW holen die Ware hier ab
      if (CITY.pickup.kinds.includes(k)) h += line(`Abholbereit: ${Math.floor(c.out?.[i] ?? 0)} / ${CITY.pickup.cap} ${GOOD_SHORT[made]} (LKW: Rechtsklick)`);
      h += this.importText(c, i, k, lv, s);
    }
    else if (k === 'station') {
      h += line(`Arbeitsplätze ${CITY.jobs[lv]} · führt bis ${CITY.import.station[lv]} Rohwaren je s ein (mal Besetzung und Strom)`);
      h += this.stationText(g, c, i, lv);
    }
    else if (k === 'power') h += line(`Liefert bis ${CITY.power.supply[lv]} Strom · Stadt ${Math.round(s.powerSupply)} / ${Math.round(s.powerUse)}`);
    else if (k === 'uni') h += line(`Plätze ${CITY.jobsUni[lv]}`);
    else if (k === 'dc') h += line(`Arbeitsplätze ${CITY.jobsDc[lv]}`);
    else if (b.produces) h += this.trainInfo(g, c, b, k, lv);
    h += this.airInfo(g, c, b, k, lv);
    h += this.transportText(g, c, i, k, s);
    const care = careOf(g, b);
    if (care) h += this.careInfo(c, lv, care);
    if (CITY_TIP[k] && k !== 'market' && !b.produces && !care) h += `<div class="muted small">${esc(CITY_TIP[k])}</div>`;
    return h + this.cityWarnings(c, i, k, s);
  },

  /** Ausbildungsgebäude der Stadt: Typen, Fortschritt, Heliport- und Stellplatz-Zeilen. */
  trainInfo(g, c, b, k, lv) {
    let h = line(`Bildet aus: ${b.produces.map((u) => UNITS[u].short || UNITS[u].name).join(', ')} · ${b.trainSlots} gleichzeitig (Stufe ${lv})`);
    // Fortschritt gleich unter „Bildet aus“, nicht am Ende: lange Infofelder (Stellplatz) waren unten abgeschnitten
    h += this.queueInfo(b);
    if (k === 'heliport') h += this.heliportInfo(g, c, b);
    if (k === 'stand') h += this.standInfo(g, c, b, lv);
    h += '<div class="muted small">Zahlt direkt aus der Stadt: Geld, Stahl, Einwohner</div>';
    return h;
  },

  /** Heliport als Landeplatz (seit v5.51): Hubschrauber, Luftraum, Kerosin und Munition in der Nähe. */
  heliportInfo(g, c, b) {
    let h = '';
    const heli = g.units.find((u) => u.alive && u.heli?.home === b.id);
    const ph = { landed: 'gelandet', takeoff: 'startet', landing: 'landet', air: 'in der Luft' };
    h += line(heli ? `${heli.def.name}: ${ph[heli.heli.phase] ?? ''}` : `Frei${b.queue?.length ? ' · Hubschrauber in Bau' : ''} · ein Hubschrauber je Heliport`);
    const busy = padBusy(g, b);
    if (busy > 0) h += line(`Luftraum belegt (${Math.ceil(busy)} s)`);
    const R = CITY.air.supplyRadius * c.cell;
    const near = (kind, r = R) => [...c.ents].some(([j, e]) => e.alive && KINDS[c.kind[j] - 1] === kind && c.level[j] && Math.hypot(e.x - b.x, e.y - b.y) <= r);
    if (near('atc', CITY.air.atcRadius * c.cell)) h += line(`Tower in der Nähe: Luftraum nach Start oder Landung ${CITY.air.heli.sepAtc} statt ${CITY.air.heli.sep} s gesperrt`);
    if (!near('ktank')) h += '<div class="warn small">Kein Kerosintank in der Nähe: der Hubschrauber tankt hier nicht</div>';
    if (!near('mdepot')) h += '<div class="warn small">Kein Munitionslager in der Nähe: der Hubschrauber lädt hier nicht nach</div>';
    return h;
  },

  /** Stellplatz (seit v5.35): Schutz, Flugzeug, Weg zur Bahn, Kerosin und Munition in der Nähe. */
  standInfo(g, c, b, lv) {
    let h = '';
    const jets = g.units.filter((u) => u.alive && u.jet?.home === b.id);
    const prot = CITY.air.standName[lv] ?? '';
    h += line(`${prot} · Schaden am Flugzeug ${Math.round(CITY.air.shelter[lv] * 100)} %`);
    const up = CITY.air.upgrade[lv + 1];
    if (up) h += line(`Ausbauen (U) zu ${CITY.air.standName[lv + 1]}: ${up.money} Geld, ${up.bm} BM${up.steel ? `, ${up.steel} Stahl` : ''} · dann Schaden ${Math.round(CITY.air.shelter[lv + 1] * 100)} %`);
    // je Platz ein Flugzeug (CITY.air.standJets): alle nennen, dazu die freien Plätze
    const parts = jets.map((jet) => {
      // Alarmrotte: Alarmstart bzw. Alarmflug statt des Zustands, am Stellplatz dazu „in Bereitschaft“ oder „Bereitschaft aus“
      const st = jet.jet.qra ? alertText(jet) : jet.parked ? (jet.jet.ready ? 'startbereit' : 'wird betankt und munitioniert') : 'unterwegs';
      const qra = jet.parked && !jet.jet.qra ? alertText(jet) : '';
      return `${jet.def.name}: ${st}${qra ? `, ${qra}` : ''}`;
    });
    if (b.queue?.length) parts.push(`${b.queue.length} in Bau`);
    h += line(parts.length ? parts.join(' · ') : 'Frei');
    h += line(`${Math.max(0, freeSpace(g, b))} von ${CITY.air.standJets} Plätzen frei`);
    const r = standRoute(g, b);
    h += r ? line(`Bahn ${r.rw.len} Felder lang${r.rw.atc ? ' · mit Tower' : ''} · ${r.cells.length} Felder Rollweg`) : '<div class="warn small">Kein Weg über Straße oder Rollfeld zu einer gültigen Start-/Landebahn</div>';
    const R = CITY.air.supplyRadius * c.cell;
    const near = (kind) => [...c.ents].some(([j, e]) => e.alive && KINDS[c.kind[j] - 1] === kind && c.level[j] && Math.hypot(e.x - b.x, e.y - b.y) <= R);
    if (!near('ktank')) h += '<div class="warn small">Kein Kerosintank in der Nähe: das Flugzeug tankt nicht</div>';
    if (!near('mdepot')) h += '<div class="warn small">Kein Munitionslager in der Nähe: das Flugzeug lädt nicht nach</div>';
    return h;
  },

  /** Tower (Bahnen im Umkreis, seit v5.35), Kerosintank und Munitionslager; für andere Arten leer. */
  airInfo(g, c, b, k, lv) {
    let h = '';
    if (k === 'atc') {
      // Tower (seit v5.35): Bahnen in seinem Umkreis
      const rws = runwaysOf(g, b.team).filter((rw) => rw.valid && Math.hypot(rw.cx - b.x, rw.cy - b.y) <= CITY.air.atcRadius * c.cell + (rw.len * c.cell) / 2);
      h += line(rws.length ? `Lotst ${rws.length} Bahn${rws.length > 1 ? 'en' : ''}: nach Start oder Landung ${CITY.air.sepAtc} statt ${CITY.air.sep} s gesperrt${rws.some((rw) => runwayBusy(g, b.team, rw) > 0) ? ' · gerade belegt' : ''}` : `Keine Bahn im Umkreis von ${CITY.air.atcRadius} Feldern`);
    } else if (k === 'ktank' || k === 'mdepot') {
      const A = k === 'ktank' ? CITY.air.tank : CITY.air.depot;
      h += line(`${k === 'ktank' ? 'Kerosin' : 'Munition'} ${Math.floor(b.stock ?? 0)} / ${A.cap[lv]} · befüllt bis ${A.fill[lv]}/s über die Straße · gibt bis ${A.rate[lv]}/s an Flugzeuge im Umkreis von ${CITY.air.supplyRadius} Feldern`);
    } else if (k === 'warehouse') {
      // Lagerhalle (Paket „Lagerhalle“): Lager je Sorte, Zulauf über die Straße, Nachfüllen im Umkreis
      const W = CITY.warehouse;
      const st = b.store ?? { bm: 0, mun: 0, fuel: 0 };
      h += line(`Lager: BM ${Math.floor(st.bm)} · MUN ${Math.floor(st.mun)} · TS ${Math.floor(st.fuel)} (je Sorte bis ${W.cap[lv]})`);
      const inn = b.inRate ? b.inRate.bm + b.inRate.mun + b.inRate.fuel : 0;
      h += line(`Zulauf gerade ${fmtRate(inn)}/s über die Straße aus dem Lager der Hauptstadt (so viel, wie die Straße frei hat, höchstens ${W.fillMax[lv]}/s; dort bleiben ${W.keep} je Sorte) · LKW laden hier, Einheiten im Umkreis von ${W.radius} px füllen nach`);
      if (!transportOf(g, c).store?.get(b.cityCell)) h += '<div class="warn small">Kein Straßenweg zum Lager der Hauptstadt: die Lagerhalle füllt sich nicht</div>';
    }
    return h;
  },

  /** Heilen und Reparieren (seit v5.01): Zeile und Stahlwarnung. */
  careInfo(c, lv, care) {
    let h = '';
    const what = { inf: 'Heilt Soldaten', ground: 'Repariert Bodenfahrzeuge', air: 'Repariert Hubschrauber' }[care.units];
    const pct = Math.round(care.rate * (CITY.care.levelMul[lv] ?? 1) * 1000) / 10;
    h += line(`${what} im Umkreis von ${care.radius} Feldern · ${pct.toLocaleString('de-DE')} % HP/s${care.units === 'inf' ? '' : ' · kostet Stahl'}`);
    if (care.units !== 'inf' && c.metal < 1) h += '<div class="warn small">Kein Stahl im Stadtlager: repariert nicht</div>';
    return h;
  },

  /** Warnungen am Ende: kein Anschluss, Strommangel, geflohene Bewohner. */
  cityWarnings(c, i, k, s) {
    let h = '';
    if (!growLinked(c, i)) h += '<div class="warn small">Kein Anschluss (Straße, beim Stellplatz die Bahn): wächst nicht weiter</div>';
    if (s.powerRatio < 1 && CITY.power.use[k] && k !== 'res' && k !== 'com') h += `<div class="warn small">Strommangel: arbeitet mit ${Math.round(s.powerRatio * 100)} %</div>`;
    if (k === 'res' && c.flee[i] > 0) h += `<div class="warn small">Bewohner geflohen (Beschuss), Rückkehr frühestens in ${Math.ceil(c.flee[i])} s</div>`;
    return h;
  },


  /**
   * Einfuhr eines Werks (Paket „Import“, nur lesen): je Rohware, was je s ankommt und was bei voller Besetzung ankäme, dazu das Geld je s
   * und eine Warnung, wenn das Geld die Einfuhr bremst. Ankunft = Ausstoß des Werks je s (c.workOut) × Bedarf je Einheit (CITY.chain);
   * voll = Arbeitsplätze × Ertrag je Arbeiter (CITY.yield), beides ohne Strom und Stau.
   */
  importText(c, i, k, lv, s) {
    const L = CITY.chain[k];
    const Y = CITY.yield[L.to];
    const out = c.workOut?.[i] ?? 0;
    const full = CITY.jobs[lv] * Y;
    const needs = Object.entries(L.need);
    const parts = needs.map(([gd, n]) => `${IMPORTS[gd].name} ${fmtDe(fmtRate(out * n))}/s von ${fmtDe(fmtRate(full * n))}/s`);
    const cost = needs.reduce((a, [gd, n]) => a + out * n * CITY.import.price[gd], 0);
    let h = `<div class="small">Einfuhr: ${parts.join(' · ')}${cost > 0.005 ? ` · −${fmtDe(fmtRate(cost))} Geld/s` : ''}</div>`;
    if (s?.importScale < 0.999 && cost > 0.005) h += `<div class="warn small">Geld reicht nur für ${Math.round(s.importScale * 100)} % der Einfuhr: das Werk arbeitet langsamer</div>`;
    return h;
  },


  /** Güterbahnhof (Paket „Import“, nur lesen): Durchsatz je s, also die Rohwaren aller Werke, die über ihn kommen, gegen die Obergrenze der Stufe. */
  stationText(g, c, i, lv) {
    const tr = transportOf(g, c);
    let used = 0;
    for (const [w, im] of tr.imports) {
      if (im?.from !== i) continue;
      const need = Object.values(CITY.chain[KINDS[c.kind[w] - 1]]?.need ?? {});
      used += (c.workOut?.[w] ?? 0) * need.reduce((a, n) => a + n, 0);
    }
    const cap = CITY.import.station[lv] ?? 0;
    let h = `<div class="small">Durchsatz ${fmtDe(fmtRate(used))} / ${cap} Rohwaren je s (Obergrenze der Stufe; Besetzung und Strom senken sie)</div>`;
    if (cap > 0 && used >= cap * 0.95) h += '<div class="warn small">Durchsatz voll: die Werke bekommen nur anteilig Rohwaren</div>';
    return h;
  },


  /**
   * Straßentransport eines Stadtgebäudes (seit v5.20, AP5, nur lesen): Lieferziel und Weg, Stau der Pendler, Waren der Gewerbe.
   * Liefert HTML-Zeilen; Warnungen rot über die Klasse „warn“.
   */
  transportText(g, c, i, k, s) {
    const line = (t) => `<div class="small">${esc(t)}</div>`;
    const warn = (t) => `<div class="warn small">${esc(t)}</div>`;
    const pct = (v) => `${Math.round(v * 100)} %`;
    let h = '';
    if (SUPPLIER_KINDS.includes(k)) {
      const T = transportInfo(g, c, i);
      if (T.to) h += line(`Liefert an: ${T.to} (${T.dist} ${T.dist === 1 ? 'Feld' : 'Felder'}) · Weg ${pct(T.eff)}`);
      else h += warn('Kein Straßenweg zum Lager: die Ware geht verloren');
      // Einfuhr (Paket „Import“): woher die Rohwaren kommen
      if (T.importFrom) h += line(`Rohwaren von: ${T.importFrom} (${T.importDist === 0 ? 'direkt angrenzend' : `${T.importDist} ${T.importDist === 1 ? 'Feld' : 'Felder'}`}) · Weg ${pct(T.importEff)}`);
      else if (T.importFrom === null) h += warn('Kein Import: Straße bis zum Kartenrand oder Güterbahnhof fehlt');
    }
    if (k === 'station') {
      const T = transportInfo(g, c, i);
      if (!T.linked) h += warn('Kein Gleis bis zum Kartenrand: führt nichts ein');
    }
    if (WORKPLACE_KINDS.includes(k)) {
      const T = transportInfo(g, c, i);
      if (T.noHome) h += warn('Keine Wohnung über die Straße erreichbar: keine Arbeiter');
      else if (Math.round(T.commuteEff * 100) < 100) h += line(`Pendler: Stau ${pct(T.commuteEff)}`);
    }
    if (CITY.produces[k]) {
      // Ausbildung über das Straßennetz (Paket „Straßen“, Teil 2): Versorgungsgrad nach Weglänge × Stau
      const S = supplyOf(g, c, i);
      if (!S.path) h += warn('Kein Straßenweg zum Lager der Hauptstadt: Ausbildung steht');
      else {
        h += line(`Versorgung ${pct(S.rate)} · Weg ${S.hall ? 'zur Lagerhalle' : 'zum Lager'} ${S.dist} ${S.dist === 1 ? 'Feld' : 'Felder'} (Entfernung ${pct(S.v)}, Stau ${pct(S.eff)})`);
        if (S.rate < 1) h += `<div class="muted small">Ausbildung läuft mit ${pct(S.rate)} des Tempos</div>`;
      }
    }
    if (k === 'com' || k === 'market') {
      h += line(`Waren: ${pct(s.shopSupply ?? 1)} versorgt (Baumaterial über die Straße)`);
      if (transportOf(g, c).shop.get(i) === null) h += warn('Kein Straßenweg zum Lager: keine Waren');
    }
    return h;
  },
};
