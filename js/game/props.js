// Props der Karte (Deko und Gelände, Werte js/data/props.js): Grundfläche, Sperren je Bewegungsklasse im Raster (grid.prop),
// Sichthöhe (grid.propH, Nebel), Deckung, Schaden durch Beschuss (Trümmer) und Überfahren durch Kettenfahrzeuge (danach weg).
// Die Karte hält die Props unverändert (map.props); der Zustand je Prop liegt im Spiel: game.propHp (Trefferpunkte),
// game.propSt (PROP_STATE) und game.propVersion (zählt Änderungen, Nebel und Darstellung). Kein DOM.
import { PROPS } from '../data/props.js';
import { BALANCE } from '../data/balance.js';
import { PROP_INF, PROP_VEH, PROP_CRUSH } from './grid.js';

const TILE = BALANCE.map.tile;
const EIGHTH = Math.PI / 4;
const CV = PROPS.cover;

/** Zustand eines Props im Spiel. */
export const PROP_STATE = { ok: 0, rubble: 1, gone: 2 };
/** Tor einer Kachel (map.props[i].gate). */
export const GATE = { closed: 1, open: 2 };

const NONE = { blocks: 'none', crush: false, cover: 0, coverVeh: 0, sight: 0 };

/** Art eines Props (Eintrag in PROPS.kinds) oder undefined. */
export const propKind = (p) => PROPS.kinds[p.kind];

/** Spielwerte eines Props im Zustand st: Art, Trümmer, offenes Tor (sperrt nichts) oder null (weg). */
export function propRules(p, st = PROP_STATE.ok) {
  const K = PROPS.kinds[p.kind];
  if (!K || st === PROP_STATE.gone) return null;
  if (st === PROP_STATE.rubble) return K.rubble ?? null;
  if (p.gate === GATE.open) return NONE;
  return K;
}

/** Sperr-Bits (grid.prop) von Spielwerten. */
export function blockBits(R) {
  if (!R) return 0;
  const inf = R.blocks === 'all' || R.blocks === 'inf' ? PROP_INF : 0;
  const veh = R.blocks === 'all' || R.blocks === 'veh' ? PROP_VEH | (R.crush ? 0 : PROP_CRUSH) : 0;
  return inf | veh;
}

/**
 * Rasterzellen (Index r × cols + c) unter einem Prop: Kacheln (line) ihre eine Zelle, sonst die Zellen, deren Mitte in der um
 * rot × 45° gedrehten Grundfläche liegt; trifft das keine Zellmitte (kleines Prop), die Zelle unter der Mitte.
 */
export function propCells(p, cols, rows) {
  const K = PROPS.kinds[p.kind];
  const c0 = Math.floor(p.x / TILE);
  const r0 = Math.floor(p.y / TILE);
  const inside = (c, r) => c >= 0 && r >= 0 && c < cols && r < rows;
  if (!K || K.line || !K.size) return inside(c0, r0) ? [r0 * cols + c0] : [];
  const a = (p.rot ?? 0) * EIGHTH;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const hw = K.size[0] / 2;
  const hd = K.size[1] / 2;
  const ext = Math.abs(ca) * hw + Math.abs(sa) * hd; // halbe Ausdehnung in x
  const eyt = Math.abs(sa) * hw + Math.abs(ca) * hd; // in y
  // Teilflächen (foot): nur sie sperren; sonst die ganze Grundfläche
  const parts = K.foot ?? [[-hw, hw, -hd, hd]];
  const out = [];
  for (let r = Math.floor((p.y - eyt) / TILE); r <= Math.floor((p.y + eyt) / TILE); r++) {
    for (let c = Math.floor((p.x - ext) / TILE); c <= Math.floor((p.x + ext) / TILE); c++) {
      if (!inside(c, r)) continue;
      const dx = (c + 0.5) * TILE - p.x;
      const dy = (r + 0.5) * TILE - p.y;
      const u = dx * ca + dy * sa; // in Längsrichtung des Props
      const v = -dx * sa + dy * ca;
      if (parts.some(([u0, u1, v0, v1]) => u >= u0 && u <= u1 && v >= v0 && v <= v1)) out.push(r * cols + c);
    }
  }
  // kleines Prop oder schmale Teilfläche: keine Zellmitte getroffen, dann die Zelle unter jeder Teilfläche
  if (!out.length) {
    for (const [u0, u1, v0, v1] of parts) {
      const u = (u0 + u1) / 2;
      const v = (v0 + v1) / 2;
      const c = Math.floor((p.x + u * ca - v * sa) / TILE);
      const r = Math.floor((p.y + u * sa + v * ca) / TILE);
      if (inside(c, r) && !out.includes(r * cols + c)) out.push(r * cols + c);
    }
  }
  return out;
}

/** Zellindex → Liste der Prop-Indizes, je Prop-Liste einmal berechnet (abgeleitet, nicht im Spielstand). */
const indexes = new WeakMap(); // map.props → { cols, cells: Map, of: Prop-Index → Zellen }

export function propIndex(props, cols, rows) {
  let ix = indexes.get(props);
  if (ix && ix.cols === cols) return ix;
  const cells = new Map();
  const of = props.map((p, i) => {
    const list = propCells(p, cols, rows);
    for (const j of list) {
      let a = cells.get(j);
      if (!a) cells.set(j, (a = []));
      a.push(i);
    }
    return list;
  });
  ix = { cols, cells, of };
  indexes.set(props, ix);
  return ix;
}

/** Zellindex einer Prop-Liste verwerfen, nachdem sie sich geändert hat (Editor; im Spiel ändert sich map.props nie). */
export function forgetPropIndex(props) {
  if (props) indexes.delete(props);
}

/** Sperr-Bits und Sichthöhe einer Zelle aus allen Props darin (st: Zustand je Prop oder null = alle heil). */
function cellRules(props, list, st) {
  let bits = 0;
  let h = 0;
  for (const i of list) {
    const R = propRules(props[i], st ? st[i] : PROP_STATE.ok);
    if (!R) continue;
    bits |= blockBits(R);
    const sh = R.sight * (R === PROPS.kinds[props[i].kind] ? props[i].stack ?? 1 : 1); // gestapelte Container: je Lage höher
    if (sh > h) h = sh;
  }
  return { bits, h };
}

/** Props ins Raster (grid.prop, grid.propH), alle heil: Teil von terrainGrid (mapdata.js). */
export function rasterizeProps(grid, props) {
  if (!props?.length) return;
  const { cells } = propIndex(props, grid.cols, grid.rows);
  for (const [j, list] of cells) {
    const { bits, h } = cellRules(props, list, null);
    if (bits) (grid.prop ??= new Uint8Array(grid.cols * grid.rows))[j] = bits;
    if (h) (grid.propH ??= new Uint8Array(grid.cols * grid.rows))[j] = h;
  }
}

/** Zustand der Props für eine neue Partie (game.propHp, game.propSt, game.propVersion). */
export function createProps(game) {
  const props = game.map.props ?? [];
  game.propHp = new Float32Array(props.length);
  game.propSt = new Uint8Array(props.length);
  props.forEach((p, i) => (game.propHp[i] = (PROPS.kinds[p.kind]?.hp ?? 0) * (p.stack ?? 1))); // gestapelt: je Lage
  game.propVersion = 0;
}

/** Setzt Prop i in den Zustand st und schreibt seine Zellen neu ins Raster. */
export function setPropState(game, i, st) {
  const props = game.map.props;
  if (!props?.[i] || game.propSt[i] === st) return;
  game.propSt[i] = st;
  game.propVersion++;
  const grid = game.grid;
  const { cells, of } = propIndex(props, grid.cols, grid.rows);
  for (const j of of[i]) {
    const { bits, h } = cellRules(props, cells.get(j), game.propSt);
    if (grid.prop || bits) (grid.prop ??= new Uint8Array(grid.cols * grid.rows))[j] = bits;
    if (grid.propH || h) (grid.propH ??= new Uint8Array(grid.cols * grid.rows))[j] = h;
  }
}

/** Schaden an Prop i; bei 0 Trefferpunkten Trümmer (oder weg, wenn die Art keine hat). */
export function damageProp(game, i, amount) {
  if (!(amount > 0) || game.propSt[i] !== PROP_STATE.ok) return;
  const p = game.map.props[i];
  game.propHp[i] -= amount;
  if (game.propHp[i] > 0) return;
  game.propHp[i] = 0;
  const K = PROPS.kinds[p.kind];
  setPropState(game, i, K?.rubble ? PROP_STATE.rubble : PROP_STATE.gone);
  game.addEffect('explosion', p.x, p.y, -1, p.x, p.y, K?.blast ? 'building' : 'hit');
  // Munition, Treibstoff: fliegt in die Luft; den Splash wickelt combat.js im nächsten Schritt ab (wie eine Granate ohne Team)
  if (K?.blast) (game.propBlasts ??= []).push({ alive: true, team: -1, tx: p.x, ty: p.y, splash: K.blast.r, damage: K.blast.damage });
}

/** Steht (x, y) unter einem heilen Tarnnetz (conceal)? Einheiten darunter sind getarnt (game.sees). */
export function concealed(game, x, y) {
  const props = game.map.props;
  if (!props?.length) return false;
  const grid = game.grid;
  const c = Math.floor(x / TILE);
  const r = Math.floor(y / TILE);
  if (c < 0 || r < 0 || c >= grid.cols || r >= grid.rows) return false;
  const list = propIndex(props, grid.cols, grid.rows).cells.get(r * grid.cols + c);
  return !!list?.some((i) => game.propSt[i] === PROP_STATE.ok && PROPS.kinds[props[i].kind]?.conceal);
}

/** Schaden einer Waffe (damage je Panzerklasse) gegen Prop i, mal mul. */
const dmgOf = (p, damage, mul) => (damage?.[PROPS.kinds[p.kind]?.armor] || 0) * mul;

/** Splash um (x, y) mit Radius R (combat.impact): Props darin nehmen Schaden, nach außen linear weniger. */
export function splashProps(game, x, y, R, damage, mul = 1) {
  const props = game.map.props;
  if (!props?.length) return;
  const grid = game.grid;
  const { cells } = propIndex(props, grid.cols, grid.rows);
  const done = new Set();
  const c0 = Math.floor((x - R) / TILE);
  const c1 = Math.floor((x + R) / TILE);
  const r0 = Math.floor((y - R) / TILE);
  const r1 = Math.floor((y + R) / TILE);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (c < 0 || r < 0 || c >= grid.cols || r >= grid.rows) continue;
      const list = cells.get(r * grid.cols + c);
      if (!list) continue;
      const d = Math.hypot(Math.max(0, Math.abs((c + 0.5) * TILE - x) - TILE / 2), Math.max(0, Math.abs((r + 0.5) * TILE - y) - TILE / 2));
      if (d >= R) continue;
      for (const i of list) {
        if (done.has(i)) continue;
        done.add(i);
        damageProp(game, i, dmgOf(props[i], damage, mul * PROPS.splashMul * (1 - d / R)));
      }
    }
  }
}

let coverProp = -1; // Prop der zuletzt gefundenen Deckung (propCover), -1 = keine

/**
 * Deckung des Ziels t gegen einen Schützen bei (sx, sy) (Direktfeuer): größter Deckungswert der Props höchstens PROPS.cover.r px
 * neben t, die in Schussrichtung liegen (Winkel höchstens arc) und näher sind als der Schütze. 0 = keine Deckung.
 * Fliegende Ziele und Besatzer von Häusern haben keine. Das deckende Prop: lastCoverProp().
 */
export function propCover(game, t, sx, sy) {
  coverProp = -1;
  const props = game.map.props;
  if (!props?.length || t.kind !== 'unit' || t.def.air || t.house) return 0;
  const inf = t.def.armor === 'inf';
  const grid = game.grid;
  const { cells } = propIndex(props, grid.cols, grid.rows);
  const fx = sx - t.x;
  const fy = sy - t.y;
  const fd = Math.hypot(fx, fy);
  if (fd < 1) return 0;
  const minCos = Math.cos(CV.arc);
  const reach = CV.r + TILE / 2;
  let best = 0;
  for (let r = Math.floor((t.y - reach) / TILE); r <= Math.floor((t.y + reach) / TILE); r++) {
    for (let c = Math.floor((t.x - reach) / TILE); c <= Math.floor((t.x + reach) / TILE); c++) {
      if (c < 0 || r < 0 || c >= grid.cols || r >= grid.rows) continue;
      const list = cells.get(r * grid.cols + c);
      if (!list) continue;
      const cx = (c + 0.5) * TILE - t.x;
      const cy = (r + 0.5) * TILE - t.y;
      const edge = Math.hypot(Math.max(0, Math.abs(cx) - TILE / 2), Math.max(0, Math.abs(cy) - TILE / 2));
      const cd = Math.hypot(cx, cy);
      if (edge > CV.r || cd >= fd) continue;
      // steht t in der Zelle selbst (überfahrbare Trümmer), deckt sie in jede Richtung
      if (cd > TILE / 2 && (cx * fx + cy * fy) / (cd * fd) < minCos) continue;
      for (const i of list) {
        const R = propRules(props[i], game.propSt[i]);
        const v = R ? (inf ? R.cover : (R.coverVeh ?? 0)) : 0;
        if (v > best) {
          best = v;
          coverProp = i;
        }
      }
    }
  }
  return best;
}

/** Prop der zuletzt von propCover gefundenen Deckung (-1 = keine). */
export const lastCoverProp = () => coverProp;

/** Direktfeuer auf t aus (sx, sy) mit Waffe `damage`: Faktor auf den Schaden; das deckende Prop nimmt seinen Teil ab (PROPS.cover.absorb). */
export function coverHit(game, t, sx, sy, damage) {
  const v = propCover(game, t, sx, sy);
  if (!(v > 0)) return 1;
  const i = coverProp;
  damageProp(game, i, dmgOf(game.map.props[i], damage, v * CV.absorb));
  return 1 - v;
}

/** Kettenfahrzeuge (def.crush) überfahren die Props in ihrer Zelle: überfahrbare sind danach weg. Nach der Bewegung aufrufen. */
export function updateProps(game) {
  const props = game.map.props;
  if (!props?.length) return;
  const grid = game.grid;
  const { cells } = propIndex(props, grid.cols, grid.rows);
  for (const u of game.units) {
    if (!u.alive || !u.def.crush || u.def.air || u.house) continue;
    const c = Math.floor(u.x / TILE);
    const r = Math.floor(u.y / TILE);
    const list = cells.get(r * grid.cols + c);
    if (!list) continue;
    for (const i of list) {
      const R = propRules(props[i], game.propSt[i]);
      if (R && R.crush) setPropState(game, i, PROP_STATE.gone);
    }
  }
}
