// Mauern als Mauern (Paket „Mauern“, PRD zone-gelaende „Zäune und Mauern“, ressourcen-bau „Mauer, Tor“): hohe Mauern (Gebäude Mauer
// und Tor, Props Betonmauer und Hesco mit blocksFire) halten Direktfeuer auf. Was zwischen Schütze und Ziel steht, findet fireBlocker;
// Steilfeuer (Waffen mit shell), Luftfahrzeuge (als Schütze oder Ziel) und Schützen in Häusern und Türmen gehen darüber. Schaden
// gegen die Schadensklasse wall: eigener Wert der Waffe (wall), sonst Splash voll mit struct, Direktfeuer nur BALANCE.combat.wallOther
// davon (Handwaffen kratzen nur). Kein Zufall, nur lesen; Schaden verteilen combat.js und props.js.
import { BALANCE } from '../data/balance.js';
import { PROPS } from '../data/props.js';
import { propIndex, propRules } from './props.js';

const TILE = BALANCE.map.tile;

/** Schaden einer Schadenstabelle gegen die Schadensklasse wall; splash: Explosion (Granate, Bombe, Prop) statt Direktfeuer. */
export function wallDamage(table, splash = false) {
  if (!table) return 0;
  if (table.wall !== undefined) return table.wall;
  return (table.struct || 0) * (splash ? 1 : BALANCE.combat.wallOther);
}

/** Steht der Schütze erhöht oder in der Luft, oder ist das Ziel in der Luft (dann geht der Schuss über jede Mauer)? */
function over(s, t) {
  if (s.kind !== 'unit' || s.def.air || s.house) return true; // Gebäude (Türme, Bunker) und Besatzer schießen von oben
  if (t.kind === 'unit' && t.def.air && !t.parked) return true;
  return !!t.house; // Besatzer eines Hauses sitzen oben am Fenster
}

/** Gibt es überhaupt hohe Mauern (je Spielschritt gemerkt, damit die Zielsuche ohne Mauern nichts kostet)? */
const wallsMemo = new WeakMap(); // Spiel → { t, v, n, any } (abgeleitet, nicht im Spielstand)
function anyWalls(game) {
  const memo = wallsMemo.get(game);
  if (memo && memo.t === game.time && memo.v === game.propVersion && memo.n === game.buildings.length) return memo.any;
  let any = game.buildings.some((b) => b.alive && b.def.blocksFire);
  if (!any) any = (game.map.props ?? []).some((p) => PROPS.kinds[p.kind]?.blocksFire);
  wallsMemo.set(game, { t: game.time, v: game.propVersion, n: game.buildings.length, any });
  return any;
}

/**
 * Erste hohe Mauer auf der Linie vom Schützen s zum Ziel t (Direktfeuer), oder null. Ergebnis { b } (Gebäude Mauer/Tor) oder
 * { prop } (Index in game.map.props); team: Besitzer (−1 = niemand). Die Zellen von Schütze und Ziel zählen nicht, das Ziel selbst
 * (eine Mauer als Ziel) auch nicht. Offene Tore und Trümmer halten nichts auf.
 */
export function fireBlocker(game, s, t) {
  if (over(s, t) || !anyWalls(game)) return null;
  const grid = game.grid;
  const c0 = Math.floor(s.x / TILE);
  const r0 = Math.floor(s.y / TILE);
  const c1 = Math.floor(t.x / TILE);
  const r1 = Math.floor(t.y / TILE);
  if (c0 === c1 && r0 === r1) return null;
  const props = game.map.props;
  const cells = props?.length ? propIndex(props, grid.cols, grid.rows).cells : null;
  // Bresenham über die Zellen zwischen den beiden (ohne Anfang und Ende)
  let c = c0;
  let r = r0;
  const dc = Math.abs(c1 - c0);
  const sc = c0 < c1 ? 1 : -1;
  const dr = -Math.abs(r1 - r0);
  const sr = r0 < r1 ? 1 : -1;
  let err = dc + dr;
  for (;;) {
    const e2 = 2 * err;
    if (e2 >= dr) {
      err += dr;
      c += sc;
    }
    if (e2 <= dc) {
      err += dc;
      r += sr;
    }
    if (c === c1 && r === r1) return null;
    if (c < 0 || r < 0 || c >= grid.cols || r >= grid.rows) return null;
    const i = r * grid.cols + c;
    const id = grid.struct[i];
    if (id && id !== t.id) {
      const b = game.entities.get(id);
      if (b && b.alive && b.def?.blocksFire && b.built !== false) return { b, team: b.team };
    }
    const list = cells?.get(i);
    if (list) {
      for (const k of list) {
        const R = propRules(props[k], game.propSt[k]);
        if (R?.blocksFire) return { prop: k, team: props[k].team ?? -1 };
      }
    }
  }
}
