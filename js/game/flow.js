// Ressourcenfluss (PRD §15 „Ressourcenanzeige“, seit v5.07): baut aus der Stadt eines Teams den Graphen der Flussanzeige
// (js/ui/flowpanel.js, Knopf „Ressourcen“). Links die Einfuhr der Rohwaren (seit Paket „Import“: Menge und Geld je s), dann die Werke
// aus CITY.chain, rechts die Lager mit Erzeugung und Verbrauch. Markiert Engpässe und nennt sie in Worten. Die Kette kommt nur aus
// CITY.chain, die Zahlen aus c.stats (updateCity), den Lagern und der LKW-Ladung. Liest nur. Kein DOM.
// Neue Rohwaren, Werke oder Waren: CITY.chain und die Felder cap/inp/gross/raw in updateCity pflegen; test/flow.test.js prüft das.
// Namen, Kürzel, Lager und Hinweise der Waren kommen seit v5.59 aus dem Warenregister js/data/goods.js (Rohwaren: IMPORTS).
import { CITY } from '../data/city.js';
import { BALANCE } from '../data/balance.js';
import { GOODS, GOOD_NAME, GOOD_SHORT, STORED_GOODS, CITY_STORE_GOODS, IMPORTS } from '../data/goods.js';
import { KIND_NAME, KINDS } from '../data/citykinds.js';

export { GOOD_NAME };
const WORKS_SHORT = { bm: 'BM-Werk' };
/** Waren mit Lager (BM, MUN, TS in den Lagern der Hauptstadt, Stahl und Kerosin im Stadtlager). */
export const FLOW_GOODS = STORED_GOODS;
const WORKS = Object.keys(CITY.chain);
const FL = CITY.flow; // Fenster, Schwellen und Gewichte der Anzeige (js/data/city.js)

/** Aufbau des Graphen (nur aus CITY.chain): Knoten mit Spalte und Reihe, Kanten. Einmal berechnet. */
let LAYOUT = null;
export function flowLayout() {
  if (LAYOUT) return LAYOUT;
  const nodes = {}; // id → { id, type: 'raw'|'works'|'store', key, col, row, ins: [id], outs: [id] }
  const add = (id, type, key, col) => (nodes[id] ??= { id, type, key, col, row: 0, ins: [], outs: [] });
  const links = [];
  const link = (a, b) => {
    links.push({ from: a, to: b });
    nodes[a].outs.push(b);
    nodes[b].ins.push(a);
  };
  let r = 0;
  // Rohwaren in der Reihenfolge ihres ersten Werks (CITY.chain), dann je Werk die Kanten Rohware → Werk → Lager
  for (const w of WORKS) {
    for (const f of Object.keys(CITY.chain[w].need)) {
      if (!IMPORTS[f]) throw new Error(`CITY.chain.${w}: ${f} ist keine Rohware (IMPORTS)`);
      if (!nodes[`raw:${f}`]) add(`raw:${f}`, 'raw', f, 0).row = r++;
    }
  }
  for (const w of WORKS) {
    const L = CITY.chain[w];
    const src = Object.keys(L.need).map((f) => `raw:${f}`);
    const wn = add(`works:${w}`, 'works', w, 1);
    for (const id of src) link(id, wn.id);
    link(wn.id, add(`store:${L.to}`, 'store', L.to, 2).id);
  }
  // Lager, aus denen kein Werk mehr nimmt, stehen ganz rechts
  const cols = 1 + Math.max(...Object.values(nodes).map((n) => n.col));
  for (const n of Object.values(nodes)) if (n.type === 'store' && n.outs.length === 0) n.col = cols - 1;
  // Reihen: Mitte der Zulieferer, in jeder Spalte mindestens eine Reihe Abstand
  for (let c = 1; c < cols; c++) {
    const list = Object.values(nodes).filter((n) => n.col === c);
    for (const n of list) n.row = n.ins.reduce((a, id) => a + nodes[id].row, 0) / Math.max(1, n.ins.length);
    list.sort((a, b) => a.row - b.row);
    for (let i = 1; i < list.length; i++) list[i].row = Math.max(list[i].row, list[i - 1].row + 1);
  }
  const rows = 1 + Math.max(...Object.values(nodes).map((n) => n.row));
  LAYOUT = { nodes, links, cols, rows };
  return LAYOUT;
}

/** Bestand je Ware: alle eigenen Lager (ohne unendliche Hauptstadt), Ausgangslager der Werke (seit v5.69), Ladung der LKW, Stahl und Kerosin im Stadtlager. */
export function teamStock(game, team) {
  const c = game.city?.[team];
  const st = { bm: 0, mun: 0, fuel: 0, metal: c?.metal ?? 0, kero: c?.kero ?? 0 };
  for (const b of game.buildings) {
    if (b.team !== team || !b.alive || !b.store) continue;
    for (const k of ['bm', 'mun', 'fuel']) st[k] += b.store[k] ?? 0;
  }
  for (const u of game.units) {
    if (u.team !== team || !u.alive || !(u.def?.cargoCap > 0)) continue;
    for (const k of ['bm', 'mun', 'fuel']) st[k] += u.cargo?.[k] ?? 0;
  }
  // Ausgangslager der Werke (CITY.pickup, seit v5.69) zählen wie das Lager, aus dem LKW holen (c.made zählt die Einlagerung mit)
  if (c?.out) for (const i of c.list) if (c.out[i]) st[CITY.chain[KINDS[c.kind[i] - 1]].to] += c.out[i];
  return st;
}

/**
 * Misst Erzeugung und Verbrauch je Ware über die letzten `window` s Spielzeit: Verbrauch = was ins Lager kam (c.made)
 * + Handel (c.traded) − Zunahme des Bestands. Zählt alles, was die Lager verlässt: Bauen, Nachladen, Tanken, Ausbildung,
 * Reparatur, Verluste. `sample` jedes Bild aufrufen (nimmt höchstens alle `step` s eine Probe).
 */
export class FlowMeter {
  constructor(window = FL.window, step = 1) {
    this.window = window;
    this.step = step;
    this.samples = [];
  }

  sample(game, team) {
    const c = game.city?.[team];
    if (!c) return;
    const last = this.samples[this.samples.length - 1];
    if (last && game.time < last.t) this.samples = []; // anderer Spielstand geladen
    else if (last && game.time - last.t < this.step) return;
    this.samples.push({ t: game.time, made: { ...(c.made ?? {}) }, traded: { ...(c.traded ?? {}) }, stock: teamStock(game, team) });
    while (this.samples.length > 2 && game.time - this.samples[1].t >= this.window) this.samples.shift();
  }

  /** Je Ware { made, traded, use, net, span } in 1/s, oder null, solange weniger als 5 s gemessen sind. */
  rates() {
    const a = this.samples[0];
    const b = this.samples[this.samples.length - 1];
    if (!a || !b || b.t - a.t < FL.minSpan) return null;
    const dt = b.t - a.t;
    const out = {};
    for (const g of FLOW_GOODS) {
      const made = ((b.made[g] ?? 0) - (a.made[g] ?? 0)) / dt;
      const traded = ((b.traded[g] ?? 0) - (a.traded[g] ?? 0)) / dt;
      const net = (b.stock[g] - a.stock[g]) / dt;
      out[g] = { made, traded, use: Math.max(0, made + traded - net), net, span: dt };
    }
    return out;
  }
}

const pct = (v) => `${Math.round(v * 100)} %`;
export const fmtFlow = (v) => (v >= 10 ? Math.round(v).toLocaleString('de-DE') : v.toLocaleString('de-DE', { minimumFractionDigits: v < 1 ? 2 : 1, maximumFractionDigits: v < 1 ? 2 : 1 }));
const EPS = 0.005;

/**
 * Graph der Flussanzeige für `team` (null ohne Stadt). `rates` = FlowMeter.rates() (oder null).
 * Knoten: { id, type, key, col, row, name, icon, count, rate, cap, out, stock, made, use, net, full, status, note }
 * mit status 'ok' | 'warn' | 'bad' | 'off'. Kanten: { from, to, good, rate }. Dazu factors (Arbeiter, Strom, Stimmung),
 * money (Steuern/s), importCost (Einfuhr, Geld/s, Paket „Import“) und issues: Engpässe, wichtigste zuerst ({ sev, text, tip }).
 */
export function resourceFlow(game, team, rates = null) {
  const c = game.city?.[team];
  if (!c) return null;
  const s = c.stats;
  const { nodes: LN, links: LL, cols, rows } = flowLayout();
  const nodes = {};
  for (const n of Object.values(LN)) nodes[n.id] = { ...n, status: 'ok', note: '' };
  const issues = [];
  const issue = (sev, text, tip = '') => issues.push({ sev, text, tip });
  const links = LL.map((l) => ({ ...l, good: null, rate: 0 }));
  const linkOf = (a, b) => links.find((l) => l.from === a && l.to === b);

  // Einfuhr (Paket „Import“): angekommene Rohware je s und ihr Preis je s
  for (const n of Object.values(nodes)) {
    if (n.type !== 'raw') continue;
    n.name = IMPORTS[n.key].name;
    n.unit = IMPORTS[n.key].short;
    n.rate = s.raw?.[n.key] ?? 0;
    n.cost = s.importCostBy?.[n.key] ?? 0; // Geld je s
    n.note = n.rate > EPS ? `${fmtFlow(n.cost)} Geld/s` : 'keine Einfuhr';
    n.status = n.rate > EPS ? 'ok' : 'off';
  }
  // Werke (in der Reihenfolge von CITY.chain)
  for (const w of WORKS) {
    const L = CITY.chain[w];
    const n = nodes[`works:${w}`];
    n.name = WORKS_SHORT[w] ?? KIND_NAME[w] ?? w;
    n.good = L.to;
    n.count = s.n?.[w] ?? 0;
    n.cap = s.cap?.[L.to] ?? 0;
    n.inp = s.inp?.[L.to] ?? 0;
    n.out = s.gross?.[L.to] ?? 0;
    for (const [g, need] of Object.entries(L.need)) {
      const l = linkOf(`raw:${g}`, n.id);
      l.rate = n.inp * need; // angekommene Rohware für dieses Werk je s
      l.good = g;
    }
    const lo = linkOf(n.id, `store:${L.to}`);
    lo.rate = n.out;
    lo.good = L.to;
    if (n.count === 0) {
      n.status = 'off';
      n.note = 'nicht gebaut';
      continue;
    }
    if (n.cap <= EPS) {
      n.status = 'bad';
      n.note = 'steht: Arbeiter, Strom';
      issue(FL.stopWeight, `${n.name} steht: keine Arbeiter oder kein Strom.`, 'Wohnen oder ein Kraftwerk bauen.');
      continue;
    }
    n.util = Math.min(1, n.out / n.cap);
    const what = Object.keys(L.need).map((g) => IMPORTS[g].name).join(' und ');
    if (n.inp < n.cap * FL.inputShort) {
      // Einfuhr ist der Engpass: kein Einfuhrpunkt, kein Geld, Stau oder Güterbahnhof voll (oder das Lager ist voll, dann fordert es nichts an)
      n.status = 'warn';
      n.note = `wartet · Auslastung ${pct(n.util)}`;
      const here = CITY_STORE_GOODS.includes(L.to) ? c[L.to] : game.mainFob(team)?.store?.[L.to] ?? 0;
      const capOf = CITY_STORE_GOODS.includes(L.to) ? BALANCE.logistics.storeCap : BALANCE.logistics.capitalCap;
      if (here >= capOf - 1) n.note = 'Lager voll · fordert nichts an';
      else issue(1 + (1 - n.util), `${n.name} nur ${pct(n.util)} ausgelastet: zu wenig ${what}.`, 'Straße zum Kartenrand oder Güterbahnhof mit Gleis bauen, Stau auflösen, Geld für die Einfuhr bereithalten.');
    } else n.note = `Auslastung ${pct(n.util)}`;
  }
  if ((s.importNone ?? 0) > 0) issue(FL.importNoneWeight, `${s.importNone} ${s.importNone === 1 ? 'Werk erreicht' : 'Werke erreichen'} keinen Einfuhrpunkt: keine Rohwaren.`, 'Straße zum Kartenrand legen oder einen Güterbahnhof mit Gleis bis zum Kartenrand und Straße zum Werk bauen.');
  if ((s.importScale ?? 1) < 0.999) issue(FL.importMoneyWeight, `Geld reicht nur für ${pct(s.importScale)} der Einfuhr: Werke arbeiten langsamer.`, 'Steuern erhöhen (Wohnen, Gewerbe), Überschuss am Markt verkaufen oder weniger Werke betreiben.');
  // Lager: Bestand, gemessene Erzeugung und Verbrauch
  const main = game.mainFob(team);
  const cap = BALANCE.logistics.storeCap;
  const stock = teamStock(game, team);
  // Ausgangslager der Werke je Ware (CITY.pickup, seit v5.70): „davon an Werken“ am Lagerknoten
  const atWorks = {};
  if (c.out) {
    for (const i of c.list) {
      if (!c.out[i]) continue;
      const w = CITY.chain[KINDS[c.kind[i] - 1]].to;
      atWorks[w] = (atWorks[w] ?? 0) + c.out[i];
    }
  }
  for (const n of Object.values(nodes)) {
    if (n.type !== 'store') continue;
    const g = n.key;
    const inCity = CITY_STORE_GOODS.includes(g);
    n.name = GOOD_NAME[g] ?? g;
    n.unit = GOOD_SHORT[g] ?? g;
    n.where = inCity ? 'Stadtlager' : 'alle Lager';
    n.stock = stock[g];
    n.atWorks = atWorks[g] ?? 0;
    const here = inCity ? c[g] : main?.store?.[g] ?? 0;
    n.full = here >= (inCity ? cap : BALANCE.logistics.capitalCap ?? cap) - 1; // Stadtlager bzw. Lager der Hauptstadt (seit v5.06 größer)
    n.rate = s.gross?.[g] ?? 0;
    const r = rates?.[g];
    n.made = r ? r.made : null;
    n.use = r ? r.use : null;
    n.net = r ? r.net : null;
    if (n.full) {
      n.status = 'warn';
      n.note = 'Hauptlager voll';
      if (n.rate > EPS) issue(FL.fullWeight, `${n.name}: Lager der Hauptstadt voll, Erzeugung verfällt.`, GOODS[g]?.full ?? 'Mit LKW zu den FOBs fahren oder am Markt verkaufen.');
    } else if (r && r.net < -EPS) {
      const eta = n.stock / -r.net;
      n.status = eta < FL.soon ? 'bad' : 'warn';
      n.note = `leer in ${eta < 60 ? '< 1' : Math.round(eta / 60)} min`;
      if (eta < FL.soon) issue(FL.sinkWeight - eta / FL.soon, `${n.name} sinkt um ${fmtFlow(-r.net)}/s: leer in ${eta < 60 ? 'unter 1' : `etwa ${Math.round(eta / 60)}`} min.`, `Verbrauch ${fmtFlow(r.use)}/s, Erzeugung ${fmtFlow(r.made)}/s${Math.abs(r.traded) > EPS ? `, Markt ${r.traded > 0 ? '+' : '−'}${fmtFlow(Math.abs(r.traded))}/s` : ''}: mehr erzeugen.`);
    } else if (r) n.note = r.net > EPS ? 'steigt' : 'gleich';
    else n.note = 'misst …';
  }

  // Arbeiter, Strom und Zufriedenheit wirken auf jedes Werk
  const fill = s.fill ?? 1;
  const power = s.powerRatio ?? 1;
  const mood = s.mood ?? 1;
  if (s.jobs > 0 && fill < FL.fillOk) issue(fill < FL.fillBad ? FL.fillBadWeight - fill : FL.fillWeight - fill, `Nur ${pct(fill)} der Arbeitsplätze besetzt: alle Werke arbeiten langsamer.`, 'Wohnen bauen.');
  if (power < 0.999) issue(power < FL.powerBad ? FL.powerBadWeight - power : FL.powerWeight - power, `Strom reicht nur für ${pct(power)}: Werke und Güterbahnhof laufen langsamer.`, 'Kraftwerk bauen oder ausbauen.');
  // Gewerbe bauen nur, wenn die Läden die Zufriedenheit kaum tragen (Läden-Anteil unter 50 %, seit v5.20)
  const shopLow = (s.shop ?? 1) < 0.5;
  if ((s.happy ?? 1) < 0.5) issue(FL.moodWeight, `Zufriedenheit niedrig (${pct(s.happy)}): Erträge × ${mood.toFixed(2).replace('.', ',')}.`, shopLow ? 'Gewerbe bauen, Stadt schützen, Strom sichern.' : 'Stadt schützen, Strom sichern.');
  // Gewerbe braucht Baumaterial, über die Straße vom Lager (seit v5.20, AP3b): wenig versorgt = Steuer und Zufriedenheit fallen
  const sup = s.shopSupply ?? 1;
  if (sup < 0.5 && (s.jobsCom ?? 0) > 0) issue(1 + (0.5 - sup), `Gewerbe ohne Waren (Straße zum Lager, Baumaterial): nur ${pct(sup)} versorgt.`, 'Gewerbe per Straße an das Lager der Hauptstadt anschließen und Baumaterial nachproduzieren.');
  // Straßentransport (seit v5.20, AP5): Stau auf den Straßen (kleinster Stau-Faktor) und Waren, die gar keinen Weg haben
  const jam = s.jam ?? 1;
  if (jam < FL.jamOk) issue(1 + (1 - jam), `Stau auf den Straßen (${pct(jam)}): Waren und Pendler kommen langsamer.`, `Eine zweite Straße zum Ziel legen oder eine Straße direkt daneben bauen (mehrspurig: Kapazität × Spuren, bis ${CITY.transport.maxLanes}; Straßen tragen ${CITY.transport.cap}/s je Spur, Stadtstraßen ${CITY.transport.mapCap}/s).`);
  const lost = s.lost ?? 0;
  if (lost > EPS) issue(FL.lostWeight, `Waren ohne Straßenweg: ${fmtFlow(lost)}/s gehen verloren.`, 'Werk per Straße an das Lager der Hauptstadt anschließen.');
  issues.sort((a, b) => b.sev - a.sev);

  // Linien ohne Fluss bekommen trotzdem eine Ware (Farbe)
  for (const l of links) l.good ??= nodes[l.from].key;
  return { nodes, links, cols, rows, issues, factors: { fill, power, happy: s.happy ?? 1, mood }, money: s.money ?? 0, importCost: s.importCost ?? 0, pop: s.pop ?? 0 };
}
