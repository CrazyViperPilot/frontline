// Props der Karte (Zäune, Mauern …; Spielwerte js/data/props.js, Zustand js/game/props.js) in Iso und 2D: Aussehen je Prop
// (Verbindungen der Kacheln, Zustand heil/Trümmer, Tor, Variante aus der Lage, Jahreszeit), Bild über spritecache.js je Blickrichtung
// und Maßstab einmal gemalt, Schatten als scharfer Umriss in Lichtrichtung (wie Gebäude: Iso nach links unten, 2D nach rechts unten,
// länger je höher). Modelle der Kacheln: fences.js. Nur Darstellung.
import { PAINT } from './unitpaint.js';
import { sprite, blit, spriteDpr } from './spritecache.js';
import { hashXY } from './color.js';
import { ISO_K } from './camera.js';
import { PROPS } from '../data/props.js';
import { BALANCE } from '../data/balance.js';
import { propIndex, forgetPropIndex, PROP_STATE } from '../game/props.js';
import { fenceModel, isFenceKind, LINE_DIRS } from './fences.js';

const { paintSolids, boundsOf, viewAngle, sectorOf } = PAINT;
const TAU = Math.PI * 2;
const TILE = BALANCE.map.tile;
const COLS = BALANCE.map.width / TILE;
const ROWS = BALANCE.map.height / TILE;
const VARIANTS = 3;
const DETAILS = 4; // Einzelheiten je Kachel (Steine der Mauer, Trümmer)
const AREA = 512; // Gebiet gleicher Farbe (px)
const SHADOW_ISO = 0.28; // Iso: Schatten je Höhe nach links unten (wie isokit.shadow der Gebäude)
const SHADOW_TOP = 0.22; // 2D: je Höhe nach rechts unten (wie isokit.shadowTop)
const SHADOW_A = 0.26; // Deckkraft der Schatten (wie Infanterie, unitpaint.js)
const EMPTY = [];

// ---------- Aussehen ----------

const lookCache = new WeakMap(); // map.props → { st, v, list }

/**
 * Aussehen aller sichtbaren Props: [{ i, x, y, kind, mask, along, gate, rubble, v (Farbe), d (Einzelheiten) }]. st: Zustand je Prop (game.propSt) oder null
 * (Editor: alle heil), version: game.propVersion. Kacheln verbinden sich mit Kacheln in den vier Nachbarzellen; heile nur mit
 * heilen, Trümmer mit allem, was noch steht oder liegt. Weg (überfahren) fehlt ganz.
 */
export function propLooksOf(props, st = null, version = 0) {
  if (!props?.length) return EMPTY;
  const hit = lookCache.get(props);
  if (hit && hit.st === st && hit.v === version) return hit.list;
  const { cells } = propIndex(props, COLS, ROWS);
  const state = (i) => (st ? st[i] : PROP_STATE.ok);
  const list = [];
  props.forEach((p, i) => {
    const s = state(i);
    if (s === PROP_STATE.gone) return;
    const K = PROPS.kinds[p.kind];
    if (!K) return;
    const c = Math.floor(p.x / TILE);
    const r = Math.floor(p.y / TILE);
    let mask = 0;
    if (K.line) {
      LINE_DIRS.forEach(([dc, dr], q) => {
        const nc = c + dc;
        const nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) return;
        for (const j of cells.get(nr * COLS + nc) ?? EMPTY) {
          const sj = state(j);
          if (!PROPS.kinds[props[j].kind]?.line || sj === PROP_STATE.gone || (s === PROP_STATE.ok && sj !== PROP_STATE.ok)) continue;
          mask |= 1 << q;
        }
      });
    }
    const along = (p.rot ?? 0) % 4 >= 2 ? 'y' : 'x'; // Drehung in Achteln: 2 und 6 = quer
    // v: Farbe je Gebiet (eine Zaunlinie sieht gleich aus), d: Einzelheiten je Kachel (Steine, fehlende Latte)
    const v = hashXY(Math.floor(p.x / AREA), Math.floor(p.y / AREA)) % VARIANTS;
    list.push({ i, x: p.x, y: p.y, kind: p.kind, mask, along, gate: p.gate ?? 0, rubble: s === PROP_STATE.rubble, v, d: hashXY(p.x, p.y) % DETAILS });
  });
  lookCache.set(props, { st, v: version, list });
  return list;
}

/** Zwischengespeichertes Aussehen und Zellindex einer Prop-Liste verwerfen (Editor: Liste wurde geändert). */
export function forgetPropLooks(props) {
  if (!props) return;
  lookCache.delete(props);
  forgetPropIndex(props);
}

/** Aussehen der Props einer Partie. */
export const propLooks = (g) => propLooksOf(g.map.props, g.propSt ?? null, g.propVersion ?? 0);

// ---------- Modelle und Schatten ----------

const models = new Map(); // Schlüssel → { S }

function lookKey(o, season) {
  return `${o.kind}|${o.mask}|${o.along}|${o.gate}|${o.rubble ? 1 : 0}|${o.v}|${o.d}|${season === 'winter' ? 'w' : 's'}`;
}

function modelOf(o, season) {
  const key = lookKey(o, season);
  let m = models.get(key);
  if (!m) {
    const S = isFenceKind(o.kind) ? fenceModel(o.kind, o.mask, o.along, o.gate, o.rubble, o.v, o.d, season === 'winter') : [];
    m = { S, key };
    models.set(key, m);
  }
  return m;
}

/** Punkt eines Körpers um yaw gedreht und in Lichtrichtung auf den Boden gelegt (kx, ky je Höhe). */
function shadowPoint(p, cs, sn, kx, ky) {
  const x = p[0] * cs - p[1] * sn;
  const y = p[0] * sn + p[1] * cs;
  return [x + kx * p[2], y + ky * p[2]];
}

/** Schattenumriss der Körper, je Fläche schwarz gefüllt (die Deckkraft kommt beim Kopieren dazu). */
function paintShadow(ctx, S, yaw, s, iso, kx, ky) {
  const cs = Math.cos(yaw);
  const sn = Math.sin(yaw);
  ctx.fillStyle = '#000';
  for (const so of S) {
    if (so.fine && s < 1.6) continue; // wie paintSolids
    ctx.globalAlpha = so.alpha ?? 1;
    for (const f of so.faces) {
      ctx.beginPath();
      f.forEach((p, i) => {
        const [x, y] = shadowPoint(p, cs, sn, kx, ky);
        const X = iso ? (x - y) * ISO_K * s : x * s;
        const Y = iso ? (x + y) * ISO_K * 0.5 * s : y * s;
        if (i) ctx.lineTo(X, Y);
        else ctx.moveTo(X, Y);
      });
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function shadowBounds(m, yaw, iso, kx, ky) {
  const memo = (m.sbnd ??= new Map());
  const key = `${iso ? 'i' : 't'}${Math.round(yaw * 1000)}`;
  let b = memo.get(key);
  if (b) return b;
  const cs = Math.cos(yaw);
  const sn = Math.sin(yaw);
  b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const so of m.S) {
    for (const f of so.faces) {
      for (const p of f) {
        const [x, y] = shadowPoint(p, cs, sn, kx, ky);
        const X = iso ? (x - y) * ISO_K : x;
        const Y = iso ? (x + y) * ISO_K * 0.5 : y;
        b[0] = Math.min(b[0], X - 1);
        b[1] = Math.min(b[1], Y - 1);
        b[2] = Math.max(b[2], X + 1);
        b[3] = Math.max(b[3], Y + 1);
      }
    }
  }
  memo.set(key, b);
  return b;
}

// ---------- Iso ----------

/** Blickrichtung der Kamera als Drehung der Modelle (Props stehen an den Achsen der Karte). */
function viewYaw(cam) {
  const sec = sectorOf(viewAngle(cam, 0), 4);
  return { sec, yaw: (sec / 4) * TAU };
}

/** Prop in Iso (Fuß am Weltpunkt der Zellmitte). false = noch kein Bild (Budget dieses Bilds). */
export function drawPropIso(ctx, cam, o, season = 'summer') {
  const m = modelOf(o, season);
  if (!m.S.length) return true;
  const { sec, yaw } = viewYaw(cam);
  const f = cam.zoom;
  const e = sprite(`mp|${m.key}|${sec}`, f * spriteDpr(), boundsOf(m, m.S, yaw, true), (cx, s) => paintSolids(cx, m.S, yaw, { iso: true, s }));
  if (e === false) return false;
  const p = cam.worldToScreen(o.x, o.y);
  if (e) blit(ctx, e, p.x, p.y, f);
  else {
    ctx.save();
    ctx.translate(p.x, p.y);
    paintSolids(ctx, m.S, yaw, { iso: true, s: f });
    ctx.restore();
  }
  return true;
}

/** Iso: Schatten eines Props, scharf begrenzt nach links unten. */
export function drawPropShadowIso(ctx, cam, o, season = 'summer') {
  const m = modelOf(o, season);
  if (!m.S.length) return;
  const { sec, yaw } = viewYaw(cam);
  const f = cam.zoom;
  const e = sprite(`mps|${m.key}|${sec}`, f * spriteDpr(), shadowBounds(m, yaw, true, 0, SHADOW_ISO), (cx, s) => paintShadow(cx, m.S, yaw, s, true, 0, SHADOW_ISO));
  if (!e) return;
  const p = cam.worldToScreen(o.x, o.y);
  ctx.globalAlpha = SHADOW_A;
  blit(ctx, e, p.x, p.y, f);
  ctx.globalAlpha = 1;
}

// ---------- 2D von oben ----------

/** 2D (Weltkoordinaten): erst alle Schatten, dann alle Props, damit kein Schatten über einem Nachbarn liegt. */
export function drawPropsTop(ctx, looks, inRect, zoom = 1, season = 'summer') {
  const sc = zoom * spriteDpr();
  const shown = looks.filter((o) => inRect(o.x, o.y, TILE));
  ctx.globalAlpha = SHADOW_A;
  for (const o of shown) {
    const m = modelOf(o, season);
    if (!m.S.length) continue;
    const e = sprite(`mpts|${m.key}`, sc, shadowBounds(m, 0, false, SHADOW_TOP, SHADOW_TOP), (cx, s) => paintShadow(cx, m.S, 0, s, false, SHADOW_TOP, SHADOW_TOP));
    if (e) blit(ctx, e, o.x, o.y, 1);
  }
  ctx.globalAlpha = 1;
  for (const o of shown) {
    const m = modelOf(o, season);
    if (!m.S.length) continue;
    const e = sprite(`mpt|${m.key}`, sc, boundsOf(m, m.S, 0, false), (cx, s) => paintSolids(cx, m.S, 0, { iso: false, s }));
    if (e) blit(ctx, e, o.x, o.y, 1);
    else if (e === null) {
      ctx.save();
      ctx.translate(o.x, o.y);
      paintSolids(ctx, m.S, 0, { iso: false, s: 1 });
      ctx.restore();
    }
  }
}
