// Gemeinsame Hilfen der Spiel-Tests (game-*.test.js); keine eigenen Tests.
import assert from 'node:assert/strict';
import { Game } from '../js/game/game.js';
import { BALANCE } from '../js/data/balance.js';
import { nearestPassable } from '../js/game/movement.js';

BALANCE.slotCap = 1000; // diese Tests prüfen nicht das Einheitenlimit (siehe economy.test.js)
export const DT = 0.05;
export const mk = (opts) => new Game({ ...opts });
export const TILE = BALANCE.map.tile;

export function run(game, seconds) {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) game.update(DT);
}

export const cellOf = (v) => Math.floor(v / TILE);
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

export function fobOf(game, t) {
  return game.buildings.find((b) => b.alive && b.team === t && b.type === 'fob' && b.built);
}

export function unitsOf(game, t, type = null) {
  return game.units.filter((u) => u.alive && u.team === t && (!type || u.type === type));
}

/** Erste zulässige Mitte für `type` auf Ringen um (x0, y0) zwischen rMin und rMax. */
export function findSpot(game, team, type, x0, y0, rMin = 0, rMax = 400) {
  for (let r = rMin; r <= rMax; r += 32) {
    for (let a = 0; a < 16; a++) {
      const x = x0 + Math.cos((a * Math.PI) / 8) * r;
      const y = y0 + Math.sin((a * Math.PI) / 8) * r;
      const p = game.canPlace(team, type, x, y);
      if (p.ok) return { x: p.x, y: p.y };
    }
  }
  return null;
}

/** Baut sofort (ohne Kosten) eine fertige FOB an eine zulässige Stelle im Ring um (x0, y0). */
export function fobAt(game, team, x0, y0, rMin = 950, rMax = 1300) {
  const s = findSpot(game, team, 'fob', x0, y0, rMin, rMax);
  assert.ok(s, 'freie FOB-Stelle');
  const p = game.canPlace(team, 'fob', s.x, s.y);
  return game.spawnBuilding('fob', team, p.cx, p.cy, { built: true });
}

/** Vordere FOB im Ring um die Hauptstadt mit festem Lager (je Sorte `stock`): das Lager der Hauptstadt füllen die Werke der Stadt. */
export function frontFob(game, team = 0, stock = 0) {
  const m = base(game, team);
  const f = fobAt(game, team, m.x, m.y);
  f.store.bm = f.store.mun = f.store.fuel = stock;
  return f;
}

/** Ein Baufahrzeug direkt am Gebäuderand, damit es ohne Anfahrt mitbaut. */
export function engineerBeside(game, b, team = b.team) {
  const p = nearestPassable(game.grid, b.x, b.y + (b.h * TILE) / 2 + 20, team) || { x: b.x, y: b.y };
  return game.spawnUnit('engineer', team, p.x, p.y);
}

/** Start-Baufahrzeug und Start-Schützen einer Seite aus dem Spiel nehmen (Munition 0), damit nur der Test handelt. */
export function silence(game, team) {
  for (const u of game.units) {
    if (u.team !== team) continue;
    u.ammo = 0;
    if (u.type === 'engineer') u.alive = false;
  }
}

export function base(g, team = 0) {
  return g.buildings.find((b) => b.team === team && b.type === 'fob');
}
