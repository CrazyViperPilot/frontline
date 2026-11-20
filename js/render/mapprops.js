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
import { propIndex, forgetPropIndex, PROP_STATE, GATE, GATE_OPEN, stateOf } from '../game/props.js';
import { fenceModel, isFenceKind, LINE_DIRS } from './fences.js';
import { milModel, isMilSingle } from './milprops.js';
import { indModel, isIndSingle } from './indprops.js';
import { civModel, isCivSingle, DELEGATE } from './civprops.js';

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
const EIGHTHS = 8; // Drehungen eines Einzelstücks (rot × 45°) und Bildrichtungen in Iso
const NEUTRAL_FLAG = '#e8e6dc';

// ---------- Aussehen ----------

const lookCache = new WeakMap(); // map.props → Map(Zustandsliste oder 'none' → { v, list })

/**
 * Aussehen aller sichtbaren Props: [{ i, x, y, kind, mask, along, gate, rubble, v (Farbe), d (Einzelheiten) }]. st: Zustand je Prop (game.propSt) oder null
 * (Editor: alle heil), version: game.propVersion. Kacheln verbinden sich mit Kacheln in den vier Nachbarzellen; heile nur mit
 * heilen, Trümmer mit allem, was noch steht oder liegt. Weg (überfahren) fehlt ganz.
 */
export function propLooksOf(props, st = null, version = 0) {
  if (!props?.length) return EMPTY;
  let byState = lookCache.get(props);
  if (!byState) lookCache.set(props, (byState = new Map()));
  const hit = byState.get(st ?? 'none');
  if (hit && hit.v === version) return hit.list;
  const { cells } = propIndex(props, COLS, ROWS);
  const state = (i) => (st ? stateOf(st[i]) : PROP_STATE.ok);
  const gateOf = (p, i) => (!p.gate ? 0 : st ? (st[i] & GATE_OPEN ? GATE.open : GATE.closed) : p.gate === GATE.open ? GATE.open : GATE.closed); // Bild: offen oder zu
  const list = [];
  props.forEach((p, i) => {
    const s = state(i);
    if (s === PROP_STATE.gone) return;
    const K = PROPS.kinds[p.kind];
    if (!K) return;
    const c = Math.floor(p.x / TILE);
    const r = Math.floor(p.y / TILE);
    let mask = 0;
    if (K.line && K.connect !== false) {
      LINE_DIRS.forEach(([dc, dr], q) => {
        const nc = c + dc;
        const nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) return;
        for (const j of cells.get(nr * COLS + nc) ?? EMPTY) {
          const sj = state(j);
          const Kj = PROPS.kinds[props[j].kind];
          if (!Kj?.line || Kj.connect === false || sj === PROP_STATE.gone || (s === PROP_STATE.ok && sj !== PROP_STATE.ok)) continue;
          mask |= 1 << q;
        }
      });
    }
    const along = (p.rot ?? 0) % 4 >= 2 ? 'y' : 'x'; // Drehung in Achteln: 2 und 6 = quer
    // v: Farbe je Gebiet (eine Zaunlinie sieht gleich aus), d: Einzelheiten je Kachel (Steine, fehlende Latte)
    const v = hashXY(Math.floor(p.x / AREA), Math.floor(p.y / AREA)) % VARIANTS;
    // Einzelstücke: Drehung a (Bogenmaß, Achtel), Fahne (flag) mit eingestellter Farbe team
    list.push({
      i, x: p.x, y: p.y, kind: p.kind, mask, along, gate: gateOf(p, i), rubble: s === PROP_STATE.rubble, v, d: hashXY(p.x, p.y) % DETAILS,
      single: !K.line, a: K.line ? 0 : ((p.rot ?? 0) * TAU) / EIGHTHS, flag: !!K.flag, team: p.team ?? -1, stack: p.stack ?? 1,
    });
  });
  byState.set(st ?? 'none', { v: version, list });
  return list;
}

/** Zwischengespeichertes Aussehen und Zellindex einer Prop-Liste verwerfen (Editor: Liste wurde geändert). */
export function forgetPropLooks(props) {
  if (!props) return;
  lookCache.delete(props);
  forgetPropIndex(props);
}

/**
 * Aussehen der Props einer Partie für `team`: der Zustand, den das Team zuletzt gesehen hat (Nebel, game.propSeen); ohne Team oder mit
 * all = true der wirkliche Zustand (Editor, Zuschauer).
 */
export function propLooks(g, team = -1, all = false) {
  const seen = !all && team >= 0 ? g.propSeen?.[team] : null;
  if (seen) return propLooksOf(g.map.props, seen, -1 - g.propSeenV[team]);
  return propLooksOf(g.map.props, g.propSt ?? null, g.propVersion ?? 0);
}

// ---------- Modelle und Schatten ----------

const models = new Map(); // Schlüssel → { S }

function lookKey(o, season, flag) {
  return `${o.kind}|${o.mask}|${o.along}|${o.gate}|${o.rubble ? 1 : 0}|${o.v}|${o.d}|${o.stack}|${season === 'winter' ? 'w' : 's'}|${flag ?? ''}`;
}

function modelOf(o, season, flag = null) {
  const key = lookKey(o, season, flag);
  let m = models.get(key);
  if (!m) {
    const w = season === 'winter';
    let S = [];
    if (isFenceKind(o.kind)) S = fenceModel(o.kind, o.mask, o.along, o.gate, o.rubble, o.v, o.d, w, season);
    else if (isMilSingle(o.kind)) S = milModel(o.kind, o.v, o.d, w, o.rubble, flag, o.gate === GATE.open);
    else if (isIndSingle(o.kind)) S = indModel(o.kind, o.v, o.d, w, o.rubble, o.stack);
    else if (isCivSingle(o.kind)) S = civModel(o.kind, o.v, o.d, season, o.rubble);
    m = { S, key };
    models.set(key, m);
  }
  return m;
}

/**
 * Farbe der Fahne eines Props: in der Eroberung der Besitzer der nächsten Flagge (höchstens PROPS.flagReach px), sonst die im Editor
 * eingestellte Teamfarbe, sonst weiß. null, wenn die Art keine Fahne hat.
 */
export function propFlagColor(g, o) {
  if (!o.flag) return null;
  const flags = g?.conquest?.flags;
  if (flags?.length) {
    let best = null;
    let bd = PROPS.flagReach;
    for (const f of flags) {
      const dd = Math.hypot(f.x - o.x, f.y - o.y);
      if (dd <= bd) {
        bd = dd;
        best = f;
      }
    }
    if (best && best.owner >= 0) return BALANCE.teamColors[best.owner] ?? NEUTRAL_FLAG;
    if (best) return NEUTRAL_FLAG;
  }
  return o.team >= 0 ? (BALANCE.teamColors[o.team] ?? NEUTRAL_FLAG) : NEUTRAL_FLAG;
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

/**
 * Blickrichtung: Kacheln stehen an den Achsen der Karte (4 Bilder je Drehung der Kamera), Einzelstücke sind um o.a gedreht
 * (8 Richtungen).
 */
function viewYaw(cam, o) {
  const n = o.single ? EIGHTHS : 4;
  const sec = sectorOf(viewAngle(cam, o.single ? o.a : 0), n);
  return { sec: `${n}.${sec}`, yaw: (sec / n) * TAU };
}

/** Prop in Iso (Fuß am Weltpunkt). flag: Farbe der Fahne (propFlagColor). Ohne Bild (Budget dieses Bilds) direkt gemalt. */
export function drawPropIso(ctx, cam, o, season = 'summer', flag = null) {
  const del = DELEGATE[o.kind]; // Auto, Bank, Ballen, Busch, Fels: vorhandener Maler (civprops.js)
  if (del) return del.iso(ctx, cam, o, season) !== false;
  const m = modelOf(o, season, flag);
  if (!m.S.length) return true;
  const { sec, yaw } = viewYaw(cam, o);
  const f = cam.zoom;
  const e = sprite(`mp|${m.key}|${sec}`, f * spriteDpr(), boundsOf(m, m.S, yaw, true), (cx, s) => paintSolids(cx, m.S, yaw, { iso: true, s }));
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
export function drawPropShadowIso(ctx, cam, o, season = 'summer', dpr = 1) {
  const del = DELEGATE[o.kind];
  if (del) {
    del.shadow(ctx, cam, o, dpr);
    return;
  }
  const m = modelOf(o, season, o.flag ? NEUTRAL_FLAG : null);
  if (!m.S.length) return;
  const { sec, yaw } = viewYaw(cam, o);
  const f = cam.zoom;
  const e = sprite(`mps|${m.key}|${sec}`, f * spriteDpr(), shadowBounds(m, yaw, true, 0, SHADOW_ISO), (cx, s) => paintShadow(cx, m.S, yaw, s, true, 0, SHADOW_ISO));
  if (!e) return;
  const p = cam.worldToScreen(o.x, o.y);
  ctx.globalAlpha = SHADOW_A;
  blit(ctx, e, p.x, p.y, f);
  ctx.globalAlpha = 1;
}

// ---------- 2D von oben ----------

/**
 * 2D (Weltkoordinaten): erst alle Schatten, dann alle Props, damit kein Schatten über einem Nachbarn liegt. flagOf(o): Farbe der
 * Fahne (propFlagColor) oder fehlt (weiß).
 */
export function drawPropsTop(ctx, looks, inRect, zoom = 1, season = 'summer', flagOf = null) {
  const sc = zoom * spriteDpr();
  const shown = looks.filter((o) => inRect(o.x, o.y, o.single ? TILE * 2 : TILE));
  // Einzelstücke: Schatten je Drehung (der Schatten fällt immer nach rechts unten), Bild gedreht
  const ang = (o) => (o.single ? o.a : 0);
  ctx.globalAlpha = SHADOW_A;
  for (const o of shown) {
    if (DELEGATE[o.kind]) continue; // zeichnen ihren Schatten selbst
    const m = modelOf(o, season, o.flag ? NEUTRAL_FLAG : null);
    if (!m.S.length) continue;
    const a = ang(o);
    const e = sprite(`mpts|${m.key}|${Math.round(a * 100)}`, sc, shadowBounds(m, a, false, SHADOW_TOP, SHADOW_TOP), (cx, s) => paintShadow(cx, m.S, a, s, false, SHADOW_TOP, SHADOW_TOP));
    if (e) blit(ctx, e, o.x, o.y, 1);
  }
  ctx.globalAlpha = 1;
  for (const o of shown) {
    if (DELEGATE[o.kind]) {
      DELEGATE[o.kind].top(ctx, o, zoom, season);
      continue;
    }
    const m = modelOf(o, season, o.flag ? (flagOf?.(o) ?? NEUTRAL_FLAG) : null);
    if (!m.S.length) continue;
    const a = ang(o);
    const e = sprite(`mpt|${m.key}|${Math.round(a * 100)}`, sc, boundsOf(m, m.S, a, false), (cx, s) => paintSolids(cx, m.S, a, { iso: false, s }));
    if (e) blit(ctx, e, o.x, o.y, 1);
    else {
      ctx.save();
      ctx.translate(o.x, o.y);
      paintSolids(ctx, m.S, a, { iso: false, s: 1 });
      ctx.restore();
    }
  }
}

// ---------- Minimap ----------

const MINI_COL = { fence: 'rgba(52,44,34,0.85)', mil: 'rgba(70,72,48,0.9)', ind: 'rgba(60,64,70,0.9)', civ: 'rgba(48,56,40,0.75)', war: 'rgba(40,34,30,0.8)' };

/**
 * Minimap (Weltkoordinaten, Transformation gesetzt): Kacheln als Zellen, Einzelstücke als Rechteck ihrer Grundfläche, mindestens
 * minPx Welt-Pixel groß (sonst unsichtbar klein). Trümmer blasser; was nichts aufhält (Bank, Schild …), fehlt.
 */
export function drawPropsMini(ctx, looks, minPx) {
  const byCol = new Map();
  for (const o of looks) {
    const K = PROPS.kinds[o.kind];
    if (!K || (K.blocks === 'none' && !K.cover)) continue;
    const col = o.rubble ? 'rgba(60,56,50,0.4)' : (MINI_COL[K.group] ?? MINI_COL.fence); // Trümmer blass
    let list = byCol.get(col);
    if (!list) byCol.set(col, (list = []));
    list.push(o);
  }
  for (const [col, list] of byCol) {
    ctx.fillStyle = col;
    ctx.beginPath();
    for (const o of list) {
      const K = PROPS.kinds[o.kind];
      const w = Math.max(minPx, K.line ? TILE : Math.max(...K.size));
      ctx.rect(o.x - w / 2, o.y - w / 2, w, w);
    }
    ctx.fill();
  }
}
