// Feldstellungen (Paket „Deckung“, PRD docs/prd/zone-gelaende.md „Feldstellungen“): Infanterie und Baufahrzeuge errichten Props mit
// Deckung (Sandsack-Stellung, Sandsackwall, Hesco-Barriere, Betonsperre) überall auf der Karte. Befehl
// { type: 'fieldwork', ids, kind, x, y, rot?, x2?, y2? }: Einzelstück an (x, y), Kachel-Arten als Linie bis (x2, y2).
// Der Bauer läuft hin (PROPS.field.reach), arbeitet time s und zahlt erst dann das Baumaterial: aus der eigenen Ladung, sonst aus dem
// FOB-Lager im Bauradius, sonst aus einem eigenen LKW in Reichweite. Das fertige Prop kommt über addProp (props.js) auf die Karte und
// gehört dem Team (p.team, p.built: eigene Kettenfahrzeuge walzen es nicht, die KI findet ihre Stellungen). Auftrag: u.order = { type: 'fieldwork', kind, x, y, rot, t, more }.
// Werte: PROPS.field (js/data/props.js). Kein DOM, kein Zufall.
import { PROPS } from '../data/props.js';
import { BALANCE } from '../data/balance.js';
import { lineCells } from './grid.js';
import { driveTo, setIdle } from './movement.js';
import { addProp, propCells, propIndex, stateOf, PROP_STATE, normRot } from './props.js';

const F = PROPS.field;
const TILE = BALANCE.map.tile;
const fail = (reason) => ({ ok: false, reason });

/** Darf Einheitenart def die Feldstellung kind bauen? ('fort': Infanterie und Baufahrzeug, 'all': nur Baufahrzeug) */
export function canFieldwork(def, kind) {
  const w = F.kinds[kind]?.who;
  if (!w || !def.builder) return false;
  return w === 'fort' ? def.builder === 'fort' || def.builder === 'all' : def.builder === 'all';
}

/** Rasterzellen eines geplanten Props (Kacheln: die Zelle unter dem Punkt). */
const cellsOf = (game, p) => propCells(p, game.grid.cols, game.grid.rows);

/** Wen das Prop aufhält, als Prüfung je Einheit (Luft und Besatzer nie). */
function blocksUnit(K, u) {
  if (u.def.air || u.house) return false;
  if (K.blocks === 'all') return true;
  return K.blocks === (u.def.armor === 'inf' ? 'inf' : 'veh');
}

/**
 * Darf Prop p ({ kind, x, y, rot }) für `team` hierhin? Liefert null oder den Grund. Frei heißt: auf der Karte, kein Gelände, kein
 * Gebäude, kein anderes Prop, keine Brücke oder Furt und keine gegnerische Einheit auf den Zellen.
 */
export function fieldSpotWhy(game, team, p) {
  const g = game.grid;
  const cells = cellsOf(game, p);
  if (!cells.length) return 'Außerhalb der Karte';
  const { cells: taken } = propIndex(game.map.props ?? [], g.cols, g.rows);
  for (const i of cells) {
    if (g.terrain[i]) return 'Gelände blockiert';
    if (g.struct[i]) return 'Fläche bereits belegt';
    if (g.prop?.[i] || taken.get(i)?.some((j) => stateOf(game.propSt[j]) !== PROP_STATE.gone)) return 'Zaun, Mauer oder andere Deko im Weg';
    if (g.ford?.[i] || g.deck?.[i]) return 'Nicht auf Brücken und in Furten';
  }
  const set = new Set(cells);
  for (const u of game.units) {
    if (u.alive && u.team !== team && !u.def.air && set.has(g.idx(g.toCell(u.x), g.toCell(u.y)))) return 'Gegnerische Einheit im Weg';
  }
  return null;
}

/** Wer zahlt bm Baumaterial für Bauer u an (x, y)? { from: 'carried'|'fob'|'truck', e } oder null. */
function payerOf(game, u, x, y, bm) {
  if ((u.cargo?.bm ?? 0) >= bm) return { from: 'carried', e: u };
  const cost = { bm };
  const f = game.payerFor(u.team, x, y, cost);
  if (f) return { from: 'fob', e: f };
  const tr = game.truckPayer(u.team, x, y, cost);
  return tr ? { from: 'truck', e: tr } : null;
}

const NO_BM = 'Zu wenig Baumaterial (eigene Ladung, FOB-Lager im Bauradius oder LKW in Reichweite)';

/** Geplante Props eines Befehls: Einzelstück oder (Kacheln) Linie von (x, y) bis (x2, y2). */
function plannedProps(game, cmd) {
  const K = PROPS.kinds[cmd.kind];
  const rot = Number.isInteger(cmd.rot) ? normRot(cmd.rot) : 0;
  if (!K.line) return [{ kind: cmd.kind, x: cmd.x, y: cmd.y, rot }];
  const g = game.grid;
  const c0 = g.toCell(cmd.x);
  const r0 = g.toCell(cmd.y);
  const has2 = Number.isFinite(cmd.x2) && Number.isFinite(cmd.y2);
  const c1 = has2 ? g.toCell(cmd.x2) : c0;
  const r1 = has2 ? g.toCell(cmd.y2) : r0;
  if (Math.max(Math.abs(c1 - c0), Math.abs(r1 - r0)) + 1 > F.lineMax) return null;
  const along = Math.abs(c1 - c0) >= Math.abs(r1 - r0) ? 0 : 2; // Kacheln quer (rot 2), wenn die Linie senkrecht läuft
  return lineCells(c0, r0, c1, r1).map(([c, r]) => ({ kind: cmd.kind, x: g.center(c), y: g.center(r), rot: along }));
}

/**
 * { type: 'fieldwork', ids, kind, x, y, rot?, x2?, y2? }: die gewählten Bauer, die diese Art bauen dürfen, errichten die Feldstellung.
 * Linien (Kacheln) verteilen sich reihum auf die Bauer, ein Einzelstück baut der nächste. Antwort { ok, count } (Zahl der Props).
 */
export function cmdFieldwork(game, team, cmd) {
  const K = PROPS.kinds[cmd.kind];
  const FK = F.kinds[cmd.kind];
  if (!K || !FK) return fail('Diese Feldstellung gibt es nicht');
  const all = game.ownUnits(team, cmd.ids).filter((u) => !u.house && !u.def.air);
  const list = all.filter((u) => canFieldwork(u.def, cmd.kind));
  if (!list.length) return fail(FK.who === 'all' ? 'Nur Baufahrzeuge bauen das' : 'Nur Infanterie und Baufahrzeuge bauen Feldstellungen');
  const plan = plannedProps(game, cmd);
  if (!plan) return fail(`Linie zu lang (höchstens ${F.lineMax} Kacheln)`);
  let reason = 'Kein Platz';
  const ok = plan.filter((p) => {
    const why = fieldSpotWhy(game, team, p);
    if (why) reason = why;
    return !why;
  });
  if (!ok.length) return fail(reason);
  const near = (p) => list.slice().sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y) || a.id - b.id);
  // Bezahlbar? Je Prop muss ein Bauer (Ladung) oder ein Lager in der Nähe zahlen können; geprüft wird nur das erste
  if (!list.some((u) => payerOf(game, u, ok[0].x, ok[0].y, FK.bm))) return fail(NO_BM);
  const workers = ok.length === 1 ? [near(ok[0])[0]] : list;
  const jobs = workers.map(() => []);
  ok.forEach((p, k) => jobs[k % workers.length].push(p));
  workers.forEach((u, k) => {
    const [first, ...more] = jobs[k];
    if (!first) return;
    u.order = { type: 'fieldwork', kind: first.kind, x: first.x, y: first.y, rot: first.rot, t: 0, more };
    u.targetId = null;
    u.path = [];
    u.pathIndex = 0;
  });
  return { ok: true, count: ok.length };
}

/** Nächster Auftrag aus der Reihe (more) oder untätig. */
function nextJob(u) {
  const o = u.order;
  const n = o.more?.shift();
  if (!n) {
    setIdle(u);
    return;
  }
  u.order = { type: 'fieldwork', kind: n.kind, x: n.x, y: n.y, rot: n.rot, t: 0, more: o.more };
  u.path = [];
  u.pathIndex = 0;
}

/** Ein Schritt: Bauer laufen hin, arbeiten und setzen das fertige Prop (nach der Bewegung aufrufen). */
export function updateFieldwork(game, dt) {
  for (const u of game.units) {
    if (!u.alive || u.order.type !== 'fieldwork') continue;
    if (u.house) {
      setIdle(u);
      continue;
    }
    const o = u.order;
    const K = PROPS.kinds[o.kind];
    const FK = F.kinds[o.kind];
    if (!K || !FK) {
      setIdle(u);
      continue;
    }
    const r = driveTo(game, u, o.x, o.y, F.reach, dt);
    if (r !== 'arrived') {
      const end = u.path.length > 0 && u.pathIndex >= u.path.length;
      if (r === 'stuck' || (end && Math.hypot(u.x - o.x, u.y - o.y) > F.reach + TILE)) {
        game.message(u.team, `${u.def.name} kommt an die Stelle nicht heran`, u.x, u.y);
        nextJob(u);
      }
      continue;
    }
    const p = { kind: o.kind, x: o.x, y: o.y, rot: o.rot ?? 0, team: u.team, built: true };
    const why = fieldSpotWhy(game, u.team, p);
    if (why) {
      game.message(u.team, `${K.name}: ${why}`, o.x, o.y);
      nextJob(u);
      continue;
    }
    o.t = Math.min(FK.time, (o.t ?? 0) + dt);
    if (o.t < FK.time) continue;
    // Fertig: eigene Einheiten auf den Zellen, die das Prop aufhalten würde, müssen erst heraus (der Bauer wartet)
    const g = game.grid;
    const set = new Set(cellsOf(game, p));
    if (game.units.some((v) => v.alive && blocksUnit(K, v) && set.has(g.idx(g.toCell(v.x), g.toCell(v.y))))) continue;
    const pay = payerOf(game, u, o.x, o.y, FK.bm);
    if (!pay) {
      game.message(u.team, NO_BM, o.x, o.y);
      setIdle(u);
      continue;
    }
    if (pay.from === 'fob') pay.e.store.bm -= FK.bm;
    else pay.e.cargo.bm -= FK.bm;
    addProp(game, p);
    nextJob(u);
  }
}

/** Feldstellungen von `team` (Indizes in map.props), heil, optional nur Art kind. */
export function teamProps(game, team, kind = null) {
  const props = game.map.props ?? [];
  const out = [];
  for (let i = 0; i < props.length; i++) {
    if (props[i].built && props[i].team === team && (!kind || props[i].kind === kind) && stateOf(game.propSt[i]) === PROP_STATE.ok) out.push(i);
  }
  return out;
}
