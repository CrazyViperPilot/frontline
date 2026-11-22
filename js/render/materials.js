// Materialfotos (Paket „Materialfotos“): Putz, Ziegel, Beton, Dachziegel, Wellblech, Holz, Kies und Lack als Graustufen-Detailkarten
// (CC0, textures/CLAUDE.md). Sie färben nichts: Eine Fläche wird wie bisher in ihrer Farbe gemalt, danach legt texture() das Foto
// mit „overlay“ darüber, so bleiben Farbe, Licht und Schnee erhalten und die Fläche bekommt Körnung, Fugen und Verwitterung.
// Bis die Bilder geladen sind (und in Node) bleibt alles ohne Foto; nach dem Laden malt spritecache.js die Bilder neu.
// Welches Material eine Wand bekommt, rät wallMat() aus ihrer Farbe; Maler, die es besser wissen, setzen es mit withMat(). Nur Bild.
import { clearSprites } from './spritecache.js';

const TEX_PX = 256; // Bildpunkte je Fotokachel
const MIN_AREA = 90; // Flächen unter so vielen Gerätepixeln (Hüllrechteck) bleiben ohne Foto (Kleinkram, ferne Ansicht)

/** Material: Datei, Weltpixel je Kachel, Deckkraft des Fotos. */
export const MATS = {
  plaster: { url: new URL('../../textures/plaster.jpg', import.meta.url), tile: 96, alpha: 0.4 },
  brick: { url: new URL('../../textures/brick.jpg', import.meta.url), tile: 80, alpha: 0.55 },
  concrete: { url: new URL('../../textures/concrete.jpg', import.meta.url), tile: 110, alpha: 0.3 },
  tile: { url: new URL('../../textures/tile.jpg', import.meta.url), tile: 44, alpha: 0.45 },
  metal: { url: new URL('../../textures/metal.jpg', import.meta.url), tile: 80, alpha: 0.45 },
  wood: { url: new URL('../../textures/wood.jpg', import.meta.url), tile: 30, alpha: 0.45 },
  gravel: { url: new URL('../../textures/gravel.jpg', import.meta.url), tile: 48, alpha: 0.32 },
  paint: { url: new URL('../../textures/paint.jpg', import.meta.url), tile: 60, alpha: 0.25 },
  rock: { url: new URL('../../textures/rock.jpg', import.meta.url), tile: 30, alpha: 0.5 }, // Felsen: Granit mit Adern (ganzer Stein)
  armor: { url: new URL('../../textures/armor.jpg', import.meta.url), tile: 26, alpha: 0.36 }, // Fahrzeuge: Lackabplatzer, Schlieren
};

const img = {}; // Material → geladenes Bild
let pending = 0;
if (typeof Image !== 'undefined' && typeof document !== 'undefined') {
  for (const [name, m] of Object.entries(MATS)) {
    const im = new Image();
    pending++;
    im.onload = () => {
      img[name] = im;
      if (--pending === 0) clearSprites(); // einmal neu malen, wenn alle da sind
    };
    im.onerror = () => {
      if (--pending === 0) clearSprites();
    };
    im.src = m.url.href;
  }
}

/** Sind die Fotos geladen (sonst malt texture() nichts)? */
export const materialsReady = () => pending === 0 && Object.keys(img).length > 0;

const patterns = new WeakMap(); // Zeichenkontext → Map(Material → CanvasPattern)
function patternOf(ctx, name) {
  let m = patterns.get(ctx);
  if (!m) patterns.set(ctx, (m = new Map()));
  if (!m.has(name)) m.set(name, ctx.createPattern(img[name], 'repeat'));
  return m.get(name);
}

let forced; // undefined: raten; null: kein Foto; sonst Material

/** fn mit festem Wandmaterial malen (null: ohne Foto), z. B. Holzkisten, Container, Autos. */
export function withMat(mat, fn) {
  const was = forced;
  forced = mat;
  try {
    return fn();
  } finally {
    forced = was;
  }
}

const hsl = (hex) => {
  const v = parseInt(hex.slice(1), 16);
  const r = ((v >> 16) & 255) / 255;
  const g = ((v >> 8) & 255) / 255;
  const b = (v & 255) / 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  const d = mx - mn;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
};

const guess = new Map();
/** Material einer Wand aus ihrer Farbe: rötlich-braun Ziegel, hell Putz, sonst Beton; withMat() geht vor. */
export function wallMat(color) {
  if (forced !== undefined) return forced;
  if (typeof color !== 'string' || color[0] !== '#' || color.length !== 7) return null;
  let m = guess.get(color);
  if (!m) {
    const [h, s, l] = hsl(color);
    m = (h < 32 || h > 345) && s > 0.28 && l < 0.6 && l > 0.18 ? 'brick' : l > 0.6 ? 'plaster' : 'concrete';
    guess.set(color, m);
  }
  return m;
}

let forcedRoof; // wie forced, nur für Dächer (withRoof)

/** fn mit festem Dachmaterial malen (null: ohne Foto), z. B. Blechdächer von Hallen. */
export function withRoof(mat, fn) {
  const was = forcedRoof;
  forcedRoof = mat;
  try {
    return fn();
  } finally {
    forcedRoof = was;
  }
}

/** Material eines geneigten Dachs: Dachziegel (dunkle wirken wie Schiefer), sonst def; withRoof() geht vor. */
export function roofMat(color, def = 'tile') {
  if (forcedRoof !== undefined) return forcedRoof;
  if (forced === null) return null;
  return def;
}

/** Material eines Flachdachs: Kies bei grauen Farben, sonst keins (Rasen, Plätze …); withRoof() geht vor. */
export function flatMat(color) {
  if (forcedRoof !== undefined) return forcedRoof === 'tile' ? 'gravel' : forcedRoof;
  if (forced === null) return null;
  if (typeof color !== 'string' || color[0] !== '#' || color.length !== 7) return null;
  const [, s, l] = hsl(color);
  return s < 0.16 && l > 0.25 && l < 0.75 ? 'gravel' : null;
}

/**
 * Foto des Materials mat auf die Fläche pts (Bildschirmpunkte, schon in der Flächenfarbe gemalt). O, X, Y: Bildschirmpunkte des
 * Ursprungs und je eine Welteinheit entlang der Bildachsen (X nach rechts im Foto, Y nach unten im Foto).
 */
export function texture(g, pts, mat, O, X, Y) {
  const im = mat && img[mat];
  if (!im) return;
  const { ctx } = g;
  if (!ctx.createPattern || typeof DOMMatrix === 'undefined') return;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of pts) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  const t = ctx.getTransform ? ctx.getTransform() : null;
  const dev = t ? Math.hypot(t.a, t.b) * Math.hypot(t.c, t.d) : 1; // Gerätepixel² je Einheit²
  if ((x1 - x0) * (y1 - y0) * dev < MIN_AREA) return;
  const pat = patternOf(ctx, mat);
  if (!pat) return;
  const m = MATS[mat];
  const sc = m.tile / TEX_PX;
  pat.setTransform(new DOMMatrix([(X[0] - O[0]) * sc, (X[1] - O[1]) * sc, (Y[0] - O[0]) * sc, (Y[1] - O[1]) * sc, O[0], O[1]]));
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = m.alpha;
  ctx.fillStyle = pat;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Foto über mehrere Flächen auf einmal (polys: Listen von Bildschirmpunkten), z. B. die Silhouette eines Felsens; ohne Mindestgröße. */
export function texturePolys(ctx, polys, mat, O, X, Y) {
  const im = mat && img[mat];
  if (!im || !polys.length || !ctx.createPattern || typeof DOMMatrix === 'undefined') return;
  const pat = patternOf(ctx, mat);
  if (!pat) return;
  const sc = MATS[mat].tile / TEX_PX;
  pat.setTransform(new DOMMatrix([(X[0] - O[0]) * sc, (X[1] - O[1]) * sc, (Y[0] - O[0]) * sc, (Y[1] - O[1]) * sc, O[0], O[1]]));
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha *= MATS[mat].alpha;
  ctx.fillStyle = pat;
  ctx.beginPath();
  for (const pts of polys) {
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
  }
  ctx.fill('nonzero');
  ctx.restore();
}

/** Foto auf eine Iso-Wand: Fläche 's' (Ebene v = plane, Achse u) oder 'e' (Ebene u = plane, Achse v); Fugen waagrecht. */
export function texWall(g, pts, face, plane, mat) {
  if (!mat || !img[mat]) return;
  const { P } = g;
  if (face === 's') texture(g, pts, mat, P(0, plane, 0), P(1, plane, 0), P(0, plane, -1));
  else texture(g, pts, mat, P(plane, 0, 0), P(plane, 1, 0), P(plane, 0, -1));
}

/** Foto auf eine waagrechte Iso-Fläche in Höhe h. */
export function texFlat(g, pts, h, mat) {
  if (!mat || !img[mat]) return;
  const { P } = g;
  texture(g, pts, mat, P(0, 0, h), P(1, 0, h), P(0, 1, h));
}

/**
 * Foto auf eine schräge Iso-Fläche (Dach): a und b sind zwei Weltpunkte [u, v, h] entlang des Firsts (Bild-x), c ein Weltpunkt an
 * der Traufe unter a (Bild-y läuft den Hang hinab), damit die Ziegelreihen dem First folgen.
 */
export function texSlope(g, pts, mat, a, b, c) {
  if (!mat || !img[mat]) return;
  const { P } = g;
  const la = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) || 1;
  const lc = Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]) || 1;
  const O = P(...a);
  const B = P(...b);
  const C = P(...c);
  texture(g, pts, mat, O, [O[0] + (B[0] - O[0]) / la, O[1] + (B[1] - O[1]) / la], [O[0] + (C[0] - O[0]) / lc, O[1] + (C[1] - O[1]) / lc]);
}

/** Foto auf eine Fläche der 2D-Ansicht (Kontext schon in Welteinheiten skaliert). */
export function texTop(ctx, pts, mat) {
  texture({ ctx }, pts, mat, [0, 0], [1, 0], [0, 1]);
}
