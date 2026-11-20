// Befehle zum Bauen (aus game.js ausgelagert): Bauplatz prüfen (canPlace), Gebäude und Baustellen setzen, Mauer- und Torlinien,
// Tor aus zwei Hälften, Platz für aufgebaute FOBs, Abriss. Handler wie in den Fachmodulen: cmdX(game, team, cmd). Kein DOM.
import { BALANCE } from '../../data/balance.js';
import { BUILDINGS } from '../../data/buildings.js';
import { lineCells } from '../grid.js';
import { canBuild, orderBuild, orderBuildSeq } from '../construction.js';

const TILE = BALANCE.map.tile;
export const STOCK_KEYS = ['bm', 'mun', 'fuel']; // Lagersorten (team.res.* sind Summen über FOB-Lager)
const WALL_TYPES = new Set(['wall', 'gate']);
const NO_GATE_ROOM = 'Kein Platz für ein Tor (2 Felder)';
const NO_CARRIED = 'Zu wenig getragenes Baumaterial (Soldaten laden es in einer FOB)';
const fail = (reason) => ({ ok: false, reason });
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
/** Hat das Lager (Gebäude-store oder LKW-cargo) die Kosten (Sorten bm/mun/fuel) ganz? */
export const covers = (stock, cost) => STOCK_KEYS.every((k) => stock[k] >= (cost[k] || 0));

/** Bezahlt die Sorten aus dem Lager (Gebäude → store, LKW → cargo). Geld zahlt das Team separat. */
function takeStock(e, cost) {
  const stock = e.kind === 'building' ? e.store : e.cargo;
  for (const k of STOCK_KEYS) stock[k] -= cost[k] || 0;
}

/** Tragen alle diese Bauer nur Baumaterial (Soldaten)? Dann zahlen sie Mauern und Tore aus ihrer Ladung. */
const paysCarried = (list) => list.length > 0 && list.every((u) => u.def.builder === 'fort');
const carriedBm = (list) => list.reduce((n, u) => n + u.cargo.bm, 0);
function takeCarried(list, bm) {
  let left = bm;
  for (const u of list) {
    const t = Math.min(u.cargo.bm, left);
    u.cargo.bm -= t;
    left -= t;
    if (left <= 1e-9) break;
  }
}


/**
 * Prüft, ob Gebäude `type` mit Mitte (x, y) gebaut werden darf.
 * Liefert { ok, reason, cx, cy, x, y, payer } (x, y = Mitte des Fußabdrucks).
 * payer = { kind: 'fob'|'truck', id } – wer die Sorten zahlt (null bei FOBs).
 * Mauer/Tor außerhalb eines FOB-Radius: eigener LKW mit Ladung ≤ truckSupplyRange.
 * carried: Soldaten zahlen aus ihrem getragenen Baumaterial (nur Mauer/Tor, nur im Bauradius einer FOB; kein Lager zahlt).
 */
export function canPlace(game, team, type, x, y, { carried = false } = {}) {
  const def = BUILDINGS[type];
  const g = game.grid;
  if (!def) return { ok: false, reason: 'Unbekanntes Gebäude' };

  const px = x;
  const py = y;
  const cx = g.toCell(px) - Math.floor(def.w / 2);
  const cy = g.toCell(py) - Math.floor(def.h / 2);
  const mx = (cx + def.w / 2) * TILE;
  const my = (cy + def.h / 2) * TILE;
  const bad = (reason) => ({ ok: false, reason, cx, cy, x: mx, y: my, payer: null });
  if (def.unique && game.buildings.some((b) => b.alive && b.team === team && b.type === type)) return bad(`Nur ein ${def.name} je Team`);

  for (let r = cy; r < cy + def.h; r++) {
    for (let c = cx; c < cx + def.w; c++) {
      if (!g.inBounds(c, r)) return bad('Außerhalb der Karte');
      const i = g.idx(c, r);
      if (g.terrain[i]) return bad('Gelände blockiert');
      if (g.prop?.[i]) return bad('Zaun, Mauer oder Hindernis im Weg'); // Props (game/props.js)
      if (g.struct[i]) return bad('Fläche bereits belegt');
      if (g.ford?.[i] || g.deck?.[i]) return bad('Nicht auf Brücken und in Furten');
    }
  }

  const x0 = cx * TILE;
  const y0 = cy * TILE;
  const x1 = x0 + def.w * TILE;
  const y1 = y0 + def.h * TILE;
  for (const u of game.units) {
    if (u.alive && u.team !== team && u.x >= x0 && u.x < x1 && u.y >= y0 && u.y < y1) {
      return bad('Gegnerische Einheit im Weg');
    }
  }

  const p = placePayer(game, team, type, mx, my, carried);
  if (p.reason) return bad(p.reason);
  return { ok: true, reason: null, cx, cy, x: mx, y: my, payer: p.payer };
}

/**
 * Wer zahlt einen Bau mit Mitte (mx, my) (Teil von canPlace): { payer } oder { reason }. FOB: Abstände und Höchstzahl, kein Zahler;
 * im Bauradius einer FOB zahlt deren Lager (getragenes Baumaterial: niemand); Mauer/Tor außerhalb: ein eigener LKW in Reichweite.
 */
function placePayer(game, team, type, mx, my, carried) {
  const def = BUILDINGS[type];
  if (type === 'fob') {
    let count = 0;
    for (const b of game.buildings) {
      if (!b.alive || b.team !== team || b.type !== 'fob') continue;
      count++;
      if (dist(b.x, b.y, mx, my) < BALANCE.fob.minDistOwn) return { reason: 'Zu nah an einer eigenen FOB' };
    }
    if (count >= BALANCE.fob.max) return { reason: `Höchstens ${BALANCE.fob.max} FOBs möglich` };
    for (const b of game.buildings) {
      if (b.alive && b.team !== team && dist(b.x, b.y, mx, my) < BALANCE.fob.minDistEnemy) return { reason: 'Zu nah an einem gegnerischen Gebäude' };
    }
    return { payer: null };
  }
  if (game.fobsInRadius(team, mx, my).length) {
    if (carried) return { payer: null };
    const f = game.payerFor(team, mx, my, def.cost);
    return f ? { payer: { kind: 'fob', id: f.id } } : { reason: game.stockReason(team, mx, my, def.cost) };
  }
  if (WALL_TYPES.has(type) && !carried) {
    const tr = game.truckPayer(team, mx, my, def.cost);
    if (tr) return { payer: { kind: 'truck', id: tr.id } };
  }
  return { reason: 'Außerhalb des Bauradius einer eigenen FOB' };
}

/**
 * Bauer aus `ids` für Gebäude `type`. Ohne ids: leer (idle Bauer helfen automatisch).
 * Mit ids, aber ohne passendes Baurecht: Fehlergrund.
 */
function pickBuilders(game, team, ids, type) {
  if (!ids || !ids.length) return { list: [], reason: null };
  const list = game.ownUnits(team, ids).filter((u) => canBuild(u.def, type));
  if (list.length) return { list, reason: null };
  return {
    list,
    reason: WALL_TYPES.has(type) ? 'Nur Infanterie und Baufahrzeuge bauen Mauern und Tore' : 'Nur Baufahrzeuge bauen das',
  };
}

/** `{ type: 'build', ids, siteId }`: Bauer an eine bestehende eigene Baustelle schicken. */
function cmdJoinSite(game, team, cmd) {
  const site = game.getEntity(cmd.siteId);
  if (!site || site.kind !== 'building' || site.team !== team || site.built) return fail('Keine eigene Baustelle');
  const pick = pickBuilders(game, team, cmd.ids, site.type);
  if (pick.reason) return fail(pick.reason);
  if (!pick.list.length) return fail('Keine Bauer gewählt');
  for (const u of pick.list) orderBuild(u, site);
  return { ok: true, count: pick.list.length };
}

/**
 * { type: 'build', ids?, building, x, y }: Gebäude als Baustelle (bezahlt aus dem Lager am Bauort).
 * ids = Bauer, die sofort hinfahren; ohne ids helfen idle Bauer automatisch.
 */
export function cmdBuild(game, team, cmd) {
  if (cmd.siteId) return cmdJoinSite(game, team, cmd);
  const def = BUILDINGS[cmd.building];
  if (!def || def.buildable === false) return fail('Dieses Gebäude kann nicht gebaut werden');
  const pick = pickBuilders(game, team, cmd.ids, cmd.building);
  if (pick.reason) return fail(pick.reason);
  const carried = paysCarried(pick.list);
  if (cmd.building === 'gate') {
    const c = game.grid.toCell(cmd.x);
    const r = game.grid.toCell(cmd.y);
    const res = placeGate(game, team, pick, carried, c, r, cmd.axis === 'x' || cmd.axis === 'y' ? cmd.axis : gateAxis(game, team, c, r), true);
    if (!res.ok) return fail(res.reason);
    orderBuildSeq(pick.list, res.sites);
    return { ok: true, id: res.sites[0].id, ids: res.sites.map((b) => b.id) };
  }
  const p = canPlace(game, team, cmd.building, cmd.x, cmd.y, { carried });
  if (!p.ok) return fail(p.reason);
  if (!game.canAfford(team, def.cost)) return fail(game.missingMoney());
  if (carried && carriedBm(pick.list) < (def.cost.bm || 0)) return fail(NO_CARRIED);
  game.pay(team, def.cost);
  const payer = p.payer ? game.getEntity(p.payer.id) : null;
  if (payer) takeStock(payer, def.cost);
  else if (carried) takeCarried(pick.list, def.cost.bm || 0);
  const b = game.spawnBuilding(cmd.building, team, p.cx, p.cy, { built: false, payerId: payer ? payer.id : null });
  for (const u of pick.list) orderBuild(u, b);
  return { ok: true, id: b.id };
}

// ---- Tor aus zwei Hälften ------------------------------------------------------

/** Richtung eines Tors um Zelle (c, r) ohne Vorgabe: 'y', wenn nur oben/unten Mauer liegt, sonst 'x' (auch ohne Nachbarn). */
function gateAxis(game, team, c, r) {
  const wall = (cc, rr) => game.buildings.some((b) => b.alive && b.team === team && (b.type === 'wall' || b.type === 'gate') && b.cx === cc && b.cy === rr);
  return !wall(c - 1, r) && !wall(c + 1, r) && (wall(c, r - 1) || wall(c, r + 1)) ? 'y' : 'x';
}

/**
 * Plätze für ein Tor (2 Felder) um die Zelle (c, r) entlang `axis`: erst (c, c+1), mit `flex` danach (c−1, c).
 * Liefert { ok, a, b } (canPlace-Ergebnisse der Hälften 0 und 1) oder { ok: false, reason, cells } (cells = die zwei Zellen für die Vorschau).
 */
function gateSpots(game, team, c, r, axis, carried, flex) {
  const g = game.grid;
  const dx = axis === 'y' ? 0 : 1;
  const dy = 1 - dx;
  const at = (k) => canPlace(game, team, 'gate', g.center(c + k * dx), g.center(r + k * dy), { carried });
  const anchor = at(0);
  const cells = [{ cx: c, cy: r }, { cx: c + dx, cy: r + dy }];
  if (!anchor.ok) return { ok: false, reason: anchor.reason, cells };
  const next = at(1);
  if (next.ok) return { ok: true, a: anchor, b: next };
  const prev = flex ? at(-1) : null;
  if (prev?.ok) return { ok: true, a: prev, b: anchor };
  const payerLike = /^(FOB|Außerhalb des Bau|Kein FOB|Zu wenig)/.test(next.reason || '');
  return { ok: false, reason: payerLike ? next.reason : NO_GATE_ROOM, cells };
}

/** Vorschau eines Tors an Punkt (x, y): { ok, reason, cells: [{ cx, cy, ok }] } (Platz und Zahler, ohne Kasse). */
export function gatePreview(game, team, x, y, { carried = false } = {}) {
  const g = game.grid;
  const c = g.toCell(x);
  const r = g.toCell(y);
  const sp = gateSpots(game, team, c, r, gateAxis(game, team, c, r), carried, true);
  if (sp.ok) return { ok: true, reason: null, cells: [{ cx: sp.a.cx, cy: sp.a.cy, ok: true }, { cx: sp.b.cx, cy: sp.b.cy, ok: true }] };
  return { ok: false, reason: sp.reason, cells: sp.cells.map((q) => ({ ...q, ok: false })) };
}

/** Ein Tor (zwei Hälften nebeneinander) setzen und zweimal bezahlen. Liefert { ok, sites } oder { ok: false, reason }. */
function placeGate(game, team, pick, carried, c, r, axis, flex) {
  const def = BUILDINGS.gate;
  const sp = gateSpots(game, team, c, r, axis, carried, flex);
  if (!sp.ok) return sp;
  const cost2 = {};
  for (const k of Object.keys(def.cost)) cost2[k] = def.cost[k] * 2;
  if (!game.canAfford(team, cost2)) return { ok: false, reason: game.missingMoney() };
  if (carried && carriedBm(pick.list) < (cost2.bm || 0)) return { ok: false, reason: NO_CARRIED };
  if (sp.a.payer && sp.b.payer && sp.a.payer.id === sp.b.payer.id) {
    const e = game.getEntity(sp.a.payer.id);
    if (!covers(e.kind === 'building' ? e.store : e.cargo, cost2)) return { ok: false, reason: game.stockReason(team, sp.a.x, sp.a.y, cost2) };
  }
  const sites = [];
  [sp.a, sp.b].forEach((p, leaf) => {
    game.pay(team, def.cost);
    const payer = p.payer ? game.getEntity(p.payer.id) : null;
    if (payer) takeStock(payer, def.cost);
    else if (carried) takeCarried(pick.list, def.cost.bm || 0);
    sites.push(game.spawnBuilding('gate', team, p.cx, p.cy, { built: false, payerId: payer ? payer.id : null, leaf, axis }));
  });
  return { ok: true, sites };
}

/** Torlinie: je zwei Zellen ein Tor (Richtung = längere Seite der Linie); ein einzelner Punkt wählt Richtung und freie Seite selbst. */
function cmdBuildGateLine(game, team, pick, carried, c0, r0, c1, r1) {
  const g = game.grid;
  const axis = Math.abs(c1 - c0) >= Math.abs(r1 - r0) ? 'x' : 'y';
  const n = (axis === 'x' ? Math.abs(c1 - c0) : Math.abs(r1 - r0)) + 1;
  const sites = [];
  let reason = 'Keine Zelle baubar';
  if (n === 1) {
    const res = placeGate(game, team, pick, carried, c0, r0, gateAxis(game, team, c0, r0), true);
    if (res.ok) sites.push(...res.sites);
    else reason = res.reason;
  } else {
    const step = (axis === 'x' ? c1 > c0 : r1 > r0) ? 1 : -1;
    for (let i = 0; i + 1 < n; i += 2) {
      // erste Zelle des Paars in Zugrichtung; Hälfte 0 liegt immer bei der kleineren Zelle
      const k = step > 0 ? i : i + 1;
      const c = axis === 'x' ? c0 + step * k : c0;
      const r = axis === 'x' ? r0 : r0 + step * k;
      const res = placeGate(game, team, pick, carried, c, r, axis, false);
      if (res.ok) sites.push(...res.sites);
      else {
        reason = res.reason;
        if (reason === game.missingMoney() || reason === NO_CARRIED) break;
      }
    }
  }
  if (!sites.length) return fail(reason);
  if (pick.list.length) orderBuildSeq(pick.list, sites);
  return { ok: true, count: sites.length };
}

/** { type: 'buildWall', building: 'wall'|'gate', ids?, x1, y1, x2, y2 }: Linie, Zelle für Zelle bezahlt (Tor: je 2 Zellen ein Tor, 2 × Kosten). */
export function cmdBuildWall(game, team, cmd) {
  if (cmd.building !== 'wall' && cmd.building !== 'gate') return fail('Nur Mauer oder Tor als Linie');
  const def = BUILDINGS[cmd.building];
  const pick = pickBuilders(game, team, cmd.ids, cmd.building);
  if (pick.reason) return fail(pick.reason);
  const g = game.grid;
  const c0 = g.toCell(cmd.x1);
  const r0 = g.toCell(cmd.y1);
  const c1 = g.toCell(cmd.x2);
  const r1 = g.toCell(cmd.y2);
  // Länge vor dem Aufzählen prüfen: weit entfernte (oder ungültige) Punkte erzeugten sonst Milliarden Zellen (Speicher voll)
  if (Math.max(Math.abs(c1 - c0), Math.abs(r1 - r0)) + 1 > BALANCE.construction.wallMax) return fail(`Mauerzug zu lang (höchstens ${BALANCE.construction.wallMax} Zellen)`);
  const cells = lineCells(c0, r0, c1, r1);
  if (cells.length > BALANCE.construction.wallMax) return fail(`Mauerzug zu lang (höchstens ${BALANCE.construction.wallMax} Zellen)`);
  const sites = [];
  const carried = paysCarried(pick.list);
  let lastReason = 'Keine Zelle baubar';
  if (cmd.building === 'gate') return cmdBuildGateLine(game, team, pick, carried, c0, r0, c1, r1);
  for (const [c, r] of cells) {
    const p = canPlace(game, team, cmd.building, g.center(c), g.center(r), { carried });
    if (!p.ok) {
      lastReason = p.reason;
      continue;
    }
    if (!game.canAfford(team, def.cost)) {
      lastReason = game.missingMoney();
      break;
    }
    if (carried && carriedBm(pick.list) < (def.cost.bm || 0)) {
      lastReason = NO_CARRIED;
      break;
    }
    game.pay(team, def.cost);
    const payer = p.payer ? game.getEntity(p.payer.id) : null;
    if (payer) takeStock(payer, def.cost);
    else if (carried) takeCarried(pick.list, def.cost.bm || 0);
    sites.push(game.spawnBuilding(cmd.building, team, p.cx, p.cy, { built: false, payerId: payer ? payer.id : null }));
  }
  if (sites.length === 0) return fail(lastReason);
  if (pick.list.length) orderBuildSeq(pick.list, sites);
  return { ok: true, count: sites.length };
}

/** Platz für ein aufgebautes Gebäude: (x, y) selbst, sonst die nächste zulässige Stelle in Ringen bis fob.deploySnap px. */
export function deploySpot(game, team, type, x, y) {
  const first = canPlace(game, team, type, x, y);
  if (first.ok) return first;
  for (let r = TILE; r <= BALANCE.fob.deploySnap; r += TILE) {
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      const p = canPlace(game, team, type, x + Math.cos(a) * r, y + Math.sin(a) * r);
      if (p.ok) return p;
    }
  }
  return first;
}

/**
 * Abriss: Gebäude erstatten 25 % Baumaterial an den Zahler (fertige), Baustellen 100 %.
 * Ein abgerissenes FOB-Lager geht an die nächste andere eigene FOB (FOBs erstatten kein Material).
 */
export function cmdDemolish(game, team, cmd) {
  const b = game.getEntity(cmd.buildingId);
  if (!b || b.kind !== 'building' || b.team !== team) return fail('Kein eigenes Gebäude gewählt');
  if (b.main) return fail('Die Hauptstadt kann nicht abgerissen werden');
  if (b.type === 'city') {
    // Stadtgebäude reißt der Stadtbefehl ab (wie der Knopf „Abreißen“ im Spiel), sie haben kein Lager
    const c = game.city?.[team];
    if (!c) return fail('Kein eigenes Gebäude gewählt');
    const col = b.cityCell % c.cols;
    const row = Math.floor(b.cityCell / c.cols);
    return game.issue(team, { type: 'city', kind: 'erase', c0: col, r0: row, c1: col, r1: row, demolish: true });
  }
  const factor = b.built ? BALANCE.demolishRefund : 1;
  const stock = { bm: b.store?.bm ?? 0, mun: b.store?.mun ?? 0, fuel: b.store?.fuel ?? 0 };
  b.demolished = true;
  b.alive = false; // vor den Erstattungen, damit die FOB selbst nicht als Ziel gilt
  b.hp = 0;
  game.grid.release(b); // Fläche sofort frei (cleanup gibt sie nur idempotent erneut frei)
  if (b.type === 'fob') {
    // FOBs werden nicht von einem Lager bezahlt: nur das eigene Lager geht an die nächste FOB
    game.refundStock(team, null, stock, 1, b.x, b.y);
  } else {
    game.refund(team, b.def.cost, factor);
    game.refundStock(team, b.payerId, b.def.cost, factor, b.x, b.y);
  }
  return { ok: true };
}
