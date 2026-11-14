// Befehle für Einheiten und Ausbildungsgebäude (aus game.js ausgelagert): Marsch (auch mit Formation), Angriff, FOB aufbauen,
// Feuer der Mörser und Artillerie auf einen Punkt, Sammelpunkt, Erscheinungsort (Eroberung). Handler: cmdX(game, team, cmd). Kein DOM.
import { BALANCE } from '../../data/balance.js';
import { canAttack, inRange } from '../entities.js';
import { nearestPassable, planPath, setIdle, exitHouse } from '../movement.js';
import { houseCanFire } from '../garrison.js';
import { FORMATIONS, formationSlots } from '../formation.js';
import { rangeMul } from '../research.js';
import { isHighAlt, canHitAltitude } from '../aircraft.js';
import { UNITS } from '../../data/units.js';
import { STOCK_KEYS, deploySpot } from './build.js';

const W = BALANCE.map.width;
const H = BALANCE.map.height;
const fail = (reason) => ({ ok: false, reason });
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

/** Freie Formationspunkte im 24-px-Raster um (x, y), nach Entfernung sortiert. */
function formationSpots(game, team, x, y, n) {
  const step = 24;
  const R = Math.ceil(Math.sqrt(n)) + 4;
  const cand = [];
  for (let j = -R; j <= R; j++) {
    for (let i = -R; i <= R; i++) {
      const dx = i * step;
      const dy = j * step;
      cand.push({ dx, dy, d: Math.hypot(dx, dy) });
    }
  }
  cand.sort((a, b) => a.d - b.d || a.dy - b.dy || a.dx - b.dx);
  const out = [];
  for (const c of cand) {
    if (out.length >= n) break;
    const px = x + c.dx;
    const py = y + c.dy;
    if (game.grid.passable(game.grid.toCell(px), game.grid.toCell(py), team)) out.push({ x: px, y: py });
  }
  while (out.length < n) {
    const p = nearestPassable(game.grid, x, y, team) || { x, y };
    out.push(p);
  }
  return out;
}

/**
 * { type: 'move'|'attackMove', ids, x, y, formation? }: ohne Formation (oder 'loose') je Einheit der nächste freie Rasterpunkt um das
 * Ziel; mit 'line', 'wedge' oder 'column' (ab zwei Bodeneinheiten) Plätze der Formation, die Gruppe fährt geschlossen (formation.js).
 * Liefert die Zielpunkte (slots) für die Wegmarke.
 */
export function cmdMove(game, team, cmd) {
  const units = game.ownUnits(team, cmd.ids);
  if (!units.length) return fail('Keine eigenen Einheiten gewählt');
  if (!Number.isFinite(cmd.x) || !Number.isFinite(cmd.y)) return fail('Kein Ziel auf der Karte');
  const tx = Math.min(Math.max(cmd.x, 0), W);
  const ty = Math.min(Math.max(cmd.y, 0), H);
  const go = (u, x, y, form) => {
    u.targetId = null;
    u.fireTarget = null; // Artillerie: neuer Marsch beendet das Feuer auf den Punkt
    u.order = { type: cmd.type, x, y, targetId: null, ...(form ? { form } : {}) };
    planPath(game, u, x, y);
    if (u.path.length === 0) setIdle(u);
  };
  const kind = FORMATIONS.includes(cmd.formation) ? cmd.formation : 'loose';
  if (kind !== 'loose' && units.filter((u) => !u.def.air).length >= 2) {
    const { slots, speed } = formationSlots(game, team, units, tx, ty, kind);
    const id = ++game.formationSeq;
    game.formations.set(id, { id, speed, ids: slots.filter((p) => !p.u.def.air).map((p) => p.u.id) });
    for (const p of slots) go(p.u, p.x, p.y, p.u.def.air ? 0 : id);
    return { ok: true, count: units.length, formation: kind, slots: slots.map((p) => ({ x: p.x, y: p.y })) };
  }
  units.sort((a, b) => dist(a.x, a.y, tx, ty) - dist(b.x, b.y, tx, ty) || a.id - b.id);
  const spots = formationSpots(game, team, tx, ty, units.length);
  units.forEach((u, i) => go(u, spots[i].x, spots[i].y, 0));
  return { ok: true, count: units.length, formation: 'loose', slots: spots };
}

/** { type: 'attack', ids, targetId }: gegnerische Einheit, Gebäude, besetztes Haus oder eine intakte Brücke (nur auf Befehl). */
export function cmdAttack(game, team, cmd) {
  const t = game.getEntity(cmd.targetId);
  if (!canAttack(team, t)) return fail('Ziel ungültig');
  const armed = game.ownUnits(team, cmd.ids).filter((u) => u.def.range > 0);
  const units = armed.filter((u) => !u.crate); // Kistenträger schießen nicht
  if (!units.length) return fail(armed.length ? 'Kistenträger schießen nicht' : 'Keine bewaffnete Einheit gewählt');
  // Hochfliegende Ziele (U-2 in der Luft) greifen nur Einheiten an, die sie treffen können (F-22); die übrigen bekommen keinen Befehl (seit v5.83)
  const hitters = isHighAlt(t) ? units.filter((u) => canHitAltitude(u, t)) : units;
  if (!hitters.length) return fail(`Die ${t.def.name} fliegt zu hoch: nur die F-22 kann sie abschießen`);
  const aim = t.house ? game.getEntity(t.house) : t;
  for (const u of hitters) {
    // Besatzer bleiben im Haus, solange das Ziel aus den Fenstern erreichbar ist und durch eine Fensterseite liegt (houseCanFire, seit v5.67);
    // sonst gehen sie hinaus und verfolgen es
    const h = u.house ? game.getEntity(u.house) : null;
    if (u.house && !(h && aim && inRange(u, aim, u.def.range * rangeMul(game, u) + h.reach) && houseCanFire(game, u, aim))) exitHouse(game, u, t.x, t.y);
    u.order = { type: 'attack', x: t.x, y: t.y, targetId: t.id };
    u.targetId = t.id;
    u.path = [];
    u.pathIndex = 0;
    u.repathTimer = 0;
  }
  return { ok: true, count: hitters.length };
}

/**
 * { type: 'deploy', ids, x?, y? }: gewählte FOB-Fahrzeuge (UNITS.*.deploys) werden an ihrer Stelle sofort zur fertigen FOB
 * (ohne Bauzeit, Regeln von canPlace: Abstände, Höchstzahl). Blockiert dort etwas (Baum, Haus), nimmt sie die nächste
 * freie Stelle bis BALANCE.fob.deploySnap px entfernt. Mit x, y (KI: geplanter Standort) zählt dieser Punkt statt der
 * Stelle des Fahrzeugs; er darf höchstens deploySnap px vom Fahrzeug entfernt sein. Die FOB startet mit BALANCE.fob.startStock ihres Lagers je Sorte;
 * das Fahrzeug verschwindet (kein Wrack). Liefert { ok, ids } (neue FOBs) oder den Grund des ersten Fehlschlags.
 */
export function cmdDeploy(game, team, cmd) {
  const list = game.ownUnits(team, cmd.ids).filter((u) => u.def.deploys && !u.house);
  if (!list.length) return fail('Kein FOB-Fahrzeug gewählt');
  const ids = [];
  let reason = '';
  for (const u of list) {
    const at = Number.isFinite(cmd.x) && Number.isFinite(cmd.y) ? { x: cmd.x, y: cmd.y } : u;
    const p = dist(at.x, at.y, u.x, u.y) <= BALANCE.fob.deploySnap ? deploySpot(game, team, u.def.deploys, at.x, at.y) : { ok: false, reason: 'Zu weit vom FOB-Fahrzeug' };
    if (!p.ok) {
      reason ||= p.reason;
      continue;
    }
    const f = game.spawnBuilding(u.def.deploys, team, p.cx, p.cy, { built: true });
    for (const k of STOCK_KEYS) f.store[k] = Math.round(BALANCE.logistics.storeCap * BALANCE.fob.startStock);
    setIdle(u);
    u.alive = false; // hp bleibt: cleanup entfernt es ohne Wrack und ohne Abschussprämie
    ids.push(f.id);
    game.message(team, `${f.def.name} aufgebaut`, f.x, f.y);
  }
  if (!ids.length) return fail(reason);
  return { ok: true, ids };
}

/**
 * { type: 'mortarTarget', ids, x, y }: gewählte eigene Mörser feuern auf den Punkt (ohne x/y: Ziel löschen).
 * Nur Mörser in Reichweite (zwischen minRange und range) nehmen das Ziel an.
 */
export function cmdMortarTarget(game, team, cmd) {
  const mortars = [];
  const guns = []; // Artillerie-Einheiten (Panzerhaubitze, seit v5.19)
  for (const id of new Set(Array.isArray(cmd.ids) ? cmd.ids : [])) {
    const b = game.getEntity(id);
    if (b && b.kind === 'building' && b.team === team && b.def.weapon && b.def.weapon.shell) mortars.push(b);
    else if (b && b.kind === 'unit' && b.alive && b.team === team && b.def.indirect) guns.push(b);
  }
  if (!mortars.length && !guns.length) return fail('Kein Mörser und keine Artillerie gewählt');
  if (!Number.isFinite(cmd.x) || !Number.isFinite(cmd.y)) {
    for (const b of [...mortars, ...guns]) b.fireTarget = null;
    return { ok: true, count: mortars.length + guns.length };
  }
  let n = 0;
  let reason = 'Ziel außer Reichweite';
  for (const u of guns) {
    const w = u.weapons.find((x) => x.spec.shell)?.spec;
    const d = dist(u.x, u.y, cmd.x, cmd.y);
    const max = w.range * rangeMul(game, u);
    if (d > max) reason = `Ziel außer Reichweite (max. ${Math.round(max)} px)`;
    else if (d < w.minRange) reason = `Ziel zu nah (min. ${w.minRange} px)`;
    else {
      setIdle(u);
      u.fireTarget = { x: cmd.x, y: cmd.y };
      n++;
    }
  }
  for (const b of mortars) {
    if (!b.built) {
      reason = 'Mörser ist noch im Bau';
      continue;
    }
    const d = dist(b.x, b.y, cmd.x, cmd.y);
    const w = b.def.weapon;
    if (d > w.range) reason = `Ziel außer Reichweite (max. ${w.range} px)`;
    else if (d < w.minRange) reason = `Ziel zu nah (min. ${w.minRange} px)`;
    else {
      b.fireTarget = { x: cmd.x, y: cmd.y };
      n++;
    }
  }
  if (!n) return fail(reason);
  return { ok: true, count: n };
}

/** Eroberung: Erscheinungsort neuer Bodeneinheiten dieses Gebäudes: `flag` = Nummer einer eigenen Flagge, null = am Gebäude. */
export function cmdSpawnAt(game, team, cmd) {
  if (!game.conquest) return fail('Nur im Modus Eroberung');
  const b = game.getEntity(cmd.buildingId);
  if (!b || b.kind !== 'building' || b.team !== team) return fail('Kein eigenes Gebäude gewählt');
  if (!b.produces?.some((t) => !UNITS[t].air)) return fail('Dieses Gebäude bildet keine Bodeneinheiten aus');
  if (cmd.flag === null || cmd.flag === undefined) {
    b.spawnFlag = null;
    return { ok: true };
  }
  const f = game.conquest.flags[cmd.flag];
  if (!f || f.owner !== team) return fail('Diese Flagge gehört dir nicht');
  b.spawnFlag = f.id;
  return { ok: true };
}

export function cmdRally(game, team, cmd) {
  const b = game.getEntity(cmd.buildingId);
  if (!b || b.kind !== 'building' || b.team !== team) return fail('Kein eigenes Gebäude gewählt');
  if (!Number.isFinite(cmd.x) || !Number.isFinite(cmd.y)) return fail('Kein gültiger Sammelpunkt');
  b.rallyX = cmd.x;
  b.rallyY = cmd.y;
  return { ok: true };
}
