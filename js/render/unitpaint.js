// Einheiten gemalt (seit v5.27, Daniels Wunsch „eine Gruppe nach der anderen“): Soldaten, Fahrzeuge, Hubschrauber, F-16, Su-27, F-22 und U-2
// als kleine 3D-Modelle aus Körpern (Kasten, Prismen, Zylinder, Kugeln). Ein Mini-Renderer malt sie mit dem Licht der Gebäude
// (links oben, wie `lit` in isokit.js) einmal je Variante in ein Bild (spritecache.js) und kopiert es danach nur noch.
// Iso: Wanne in 16 Richtungen, Turm getrennt in 16 Richtungen (folgt dem Ziel), Soldaten in 8 Richtungen mit Gehbewegung.
// 2D: dasselbe Modell genau von oben, Wanne und Turm frei gedreht, Schatten als Umriss. Rotoren und Nachbrenner laufen live.
// Teams: Blau graublau, Rot rotbraun, Grün olivgrün, Gelb ockergrau, dazu Teamfarbe an Weste, Wimpel und Markierungen. Nur Darstellung, keine Spielregel.
//
// Aufbau (seit dem Paket „Einheiten-Maler teilen“): Diese Datei ist der Einstieg. Sie setzt die Register MODELS und INFANTRY
// aus den Familien unter units/ zusammen, malt die Modelle (Iso, 2D, Schatten, Wracks, Rotoren, Nachbrenner) und exportiert
// alles, was andere Dateien von hier importieren. Die Modelle liegen in:
//   units/shapes.js    Farben, Grundkörper (box, prX/prY/prZ, loft, cyl, ball, on, fine), Fahrzeug-Bauteile (Ketten, Räder …)
//   units/painter.js   Mini-Renderer: paintSolids (Licht, Reihenfolge), boundsOf (Umriss)
//   units/armor.js     tank, ifv, flak, sam, gepard (Kettenfahrzeuge: Panzer, Schützenpanzer, Flugabwehr)
//   units/heavy.js     pzh, mlrs, recovery, bridgelayer (schwere Kettenfahrzeuge: Artillerie, Berge-, Brückenlegepanzer)
//   units/wheeled.js   truck, scout, jammer, fobTruck, engineer, excavator (Rad- und Baufahrzeuge)
//   units/rotor.js     littlebird, drone, fpv, gunship, transporter (Hubschrauber und Drohnen)
//   units/airparts.js  Flugzeug-Bausteine: hull, ring, slab, inset, remap
//   units/jets.js      f16, su27;  units/f22.js  f22;  units/u2.js  u2 (dazu oval, arch, U2_GLOW)
//   units/planes.js    a10, c130 (große Flugzeuge)
//   units/soldier.js   soldier: alle Infanterie-Arten (INFANTRY bildet Einheitentyp → o.kind ab)
// Neue Einheit: Modellfunktion in die passende Familie (bei neuer Art eine neue Datei unter units/, höchstens 20 KB, in sw.js
// und units/CLAUDE.md eintragen), exportieren, hier importieren und in MODELS bzw. INFANTRY eintragen. Rezept: docs/rezept-einheiten.md.

import { K, TAU, TEAM_PAINT, DISPLAY, SHOWROOM, NEUTRAL, solid, box, prX, prY, prZ, loft, cyl, ball, on, fine } from './units/shapes.js';
import { paintSolids, boundsOf } from './units/painter.js';
import { tank, ifv, flak, sam, gepard } from './units/armor.js';
import { pzh, mlrs, recovery, bridgelayer } from './units/heavy.js';
import { truck, scout, jammer, fobTruck, engineer, excavator } from './units/wheeled.js';
import { littlebird, drone, fpv, gunship, transporter } from './units/rotor.js';
import { f16, su27 } from './units/jets.js';
import { F22_MISSILES, f22 } from './units/f22.js';
import { u2 } from './units/u2.js';
import { a10, c130 } from './units/planes.js';
import { soldier } from './units/soldier.js';
import { sprite, blit, spriteDpr, peek } from './spritecache.js';
import { jetAlt, jetGrounded } from '../game/aircraft.js';
import { setIsoAt } from './iso.js';
import { mix } from './color.js';
import { UNITS } from '../data/units.js';
import { camoOf } from './units/camo.js';

const ISO_SCALE = 1.35; // Iso: Modelle etwas größer als ihre Grundfläche (wie bisher), damit man sie gut erkennt
const VEH_SECT = 16; // Richtungen der Fahrzeuge, Hubschrauber und Jets in Iso
const INF_SECT = 8; // Richtungen der Soldaten in Iso

const MODELS = { tank, ifv, flak, sam, gepard, pzh, mlrs, truck, scout, fobTruck, engineer, excavator, bridgelayer, littlebird, drone, fpv, gunship, transporter, recovery, jammer, f16, f22, su27, u2, a10, c130 };
const INFANTRY = { rifleman: 'rifleman', medic: 'medic', at: 'at', manpads: 'manpads', flamer: 'flamer', mortarteam: 'mortar', sniper: 'sniper', sapper: 'sapper', commander: 'commander' };
// Bildschlüssel je Team (für die Zwischenspeicher in spritecache.js): je Lackierung ein eigener Buchstabe, sodass kein Bild zwei Teams teilt
const TEAM_KEYS = ['b', 'r', 'g', 'y'];
/** Bildschlüssel: Teams 0 … 3, Ausstellungsstück 's', alles andere (neutral, Tiere, Wracks) 'n'. */
const keyOf = (team) => (team === SHOWROOM ? 's' : TEAM_KEYS[team] ?? 'n');

const paintOf = (team) => (team === SHOWROOM ? DISPLAY : TEAM_PAINT[team] ?? NEUTRAL);
const SIZE = { tank: 1.12, pzh: 1.08, recovery: 1.12, bridgelayer: 1.12, fpv: 2 }; // schwere Fahrzeuge etwas größer, damit sie sich vom Schützenpanzer abheben; fpv (Kamikazedrohne) doppelt, sonst nur ein Punkt

/** Modell um k vergrößern (Körper, Turmdrehpunkt, Grundfläche, Rotoren, Heckrotor). */
function scaleModel(m, k) {
  for (const so of [...m.S, ...(m.turret?.S ?? [])]) {
    so.faces = so.faces.map((f) => f.map((p) => p.map((v) => v * k)));
    so.c = so.c.map((v) => v * k);
  }
  if (m.turret) m.turret.x *= k;
  if (m.foot) m.foot = m.foot.map((v) => v * k);
  for (const r of m.rotors ?? []) {
    r.x *= k;
    r.y = (r.y ?? 0) * k;
    r.z *= k;
    r.r *= k;
  }
  if (m.tail) {
    m.tail.x *= k;
    m.tail.z *= k;
    m.tail.r *= k;
  }
}

/**
 * Materialfoto (materials.js) der Fahrzeuge: alle Körper in Teamfarbe (Wanne, Turm, Aufbauten, Rumpf) bekommen abgenutzten Lack
 * (Bodenfahrzeuge) bzw. leichte Patina (Luftfahrzeuge); Ketten, Glas, Lampen, Markierungen und Kleinteile bleiben glatt.
 */
function wear(m, P, air) {
  const team = new Set([P.body, P.dark, P.light, P.camo, P.air]);
  const mat = air ? 'paint' : 'armor';
  for (const S of [m.S, m.turret?.S ?? []]) for (const so of S) if (!so.fine && so.alpha === undefined && so.mat === undefined && team.has(so.col)) so.mat = mat;
}

const models = new Map(); // Schlüssel → Modell (Körper und Maße); klein, bleibt
function modelOf(type, team, o = {}) {
  const key = `${type}|${team}|${o.frame ?? ''}|${o.missiles ?? ''}|${o.gear ? 1 : 0}|${o.camo ?? ''}${o.prone ? 'p' : ''}`;
  let m = models.get(key);
  if (m) return m;
  const P = paintOf(team);
  m = INFANTRY[type] ? soldier(P, { kind: INFANTRY[type], frame: o.frame ?? 0, prone: o.prone, camo: o.camo }) : MODELS[type]?.(P, o);
  if (!m) return null;
  if (SIZE[type]) scaleModel(m, SIZE[type]);
  if (!INFANTRY[type]) wear(m, P, UNITS[type]?.air);
  models.set(key, m);
  return m;
}

// ---------- Bilder ----------

/** Bild holen; fehlt es (Zeitbudget), ein vorhandenes Nachbarbild nehmen (andere Richtung), sonst false. */
function getSprite(key, scale, bounds, paint, alts) {
  const e = sprite(key, scale, bounds, paint);
  if (e !== false) return e;
  for (const k of alts) {
    const a = peek(k, scale);
    if (a) return a;
  }
  return false;
}

const sectorOf = (a, n) => ((Math.round((a / TAU) * n) % n) + n) % n;
const ROT = [
  [1, 0, 0, 1],
  [0, -1, 1, 0],
  [-1, 0, 0, -1],
  [0, 1, -1, 0],
]; // wie camera.js: gedrehte Achsen (u, v) aus Welt (x, y)
/** Blickwinkel im gedrehten Iso-Bild (Drehung der Kamera abgezogen). */
function viewAngle(cam, a) {
  const [ra, rb, rc, rd] = ROT[cam.rot | 0] ?? ROT[0];
  const c = Math.cos(a);
  const s = Math.sin(a);
  return Math.atan2(rc * c + rd * s, ra * c + rb * s);
}

function nearKeys(make, sec, n) {
  const out = [];
  for (let d = 1; d <= n / 2; d++) out.push(make((sec + d) % n), make((sec - d + n) % n));
  return out;
}

/** Zustand, der das Bild ändert: Gehbewegung, Raketen und Fahrwerk der F-16, Su-27 und F-22, Fahrwerk der U-2. */
function lookOf(u, now) {
  if (u.def?.prone) return { frame: !u.prone && (u.speedNow ?? 0) > 3 ? 1 + (Math.floor(now / 140 + u.id * 0.37) % 4) : 0, prone: !!u.prone, camo: camoOf(u) }; // Scharfschütze: Tarnung, liegend
  if (INFANTRY[u.type]) return { frame: (u.speedNow ?? 0) > 3 ? 1 + (Math.floor(now / 140 + u.id * 0.37) % 4) : 0 };
  if (u.type === 'f16' || u.type === 'su27') {
    // missiles = Luft-Luft-Raketen + 10 × Luft-Boden-Raketen (je 0 … 2), seit v5.41; die Su-27 wie die F-16 (gleiche Waffen)
    let aim = 0;
    let agm = 0;
    for (const w of u.weapons ?? []) {
      if (w.spec?.id === 'agm' || w.id === 'agm') agm += Math.min(2, w.rounds | 0);
      else aim += Math.min(2, w.rounds | 0);
    }
    return { missiles: Math.min(2, aim) + 10 * Math.min(2, agm), gear: jetGrounded(u) };
  }
  if (u.type === 'f22') {
    // Raketen innen: nur am Boden (Schächte offen) je Vorrat ein Bild, im Flug eines (Schächte zu): 8 Bilder je Team und Richtung
    if (!jetGrounded(u)) return { gear: false };
    let n = 0;
    for (const w of u.weapons ?? []) n += w.rounds | 0;
    return { missiles: Math.min(F22_MISSILES, n), gear: true };
  }
  if (u.type === 'u2' || u.type === 'a10' || u.type === 'c130') return { gear: jetGrounded(u) }; // keine Waffen: nur Boden (Fahrwerk, Stützräder, hängende Flügel) oder Flug
  return {};
}

// ---------- Iso ----------

/**
 * Einheit in Iso an Bildpunkt p (Boden), lift = Höhe über dem Boden. aim = Weltwinkel zum Ziel (Turm, Soldat) oder null.
 * Liefert false, wenn es kein Modell oder noch kein Bild gibt (dann zeichnet der Renderer den Ersatz).
 */
export function drawUnitIso(ctx, cam, u, p, aim = null, lift = 0, now = 0) {
  const look = lookOf(u, now);
  const m = modelOf(u.type, u.team, look);
  if (!m) return false;
  const z = cam.zoom;
  const dpr = spriteDpr();
  const f = z * ISO_SCALE;
  const n = m.inf ? INF_SECT : VEH_SECT;
  const face = m.inf && aim !== null && aim !== undefined ? aim : u.angle ?? 0;
  const va = viewAngle(cam, face);
  const sec = sectorOf(va, n);
  const tk = keyOf(u.team);
  const base = `ui|${u.type}|${tk}|${look.frame ?? ''}|${look.missiles ?? ''}|${look.gear ? 1 : 0}|${look.camo ?? ''}${look.prone ? 'p' : ''}`;
  const make = (k) => `${base}|${k}`;
  const yaw = (k) => (k / n) * TAU;
  const e = getSprite(make(sec), f * dpr, boundsOf(m, m.S, yaw(sec), true), (c, s) => paintSolids(c, m.S, yaw(sec), { iso: true, s }), nearKeys(make, sec, n));
  if (!e) return false;
  const y = p.y - lift * z;
  const burn = m.nozzle && !u.parked && (u.jet?.phase === 'roll' || jetAlt(u) > 0.05);
  const away = Math.cos(yaw(sec)) + Math.sin(yaw(sec)) > 0; // Düse zeigt vom Betrachter weg: Flamme liegt hinter dem Rumpf
  if (burn && away) drawFlameIso(ctx, m, p.x, y, f, yaw(sec), now);
  blit(ctx, e, p.x, y, f);
  if (m.turret) {
    const ta = aim === null || aim === undefined ? va : viewAngle(cam, aim);
    const ts = sectorOf(ta, VEH_SECT);
    const hy = yaw(sec);
    const px = m.turret.x * Math.cos(hy);
    const py = m.turret.x * Math.sin(hy);
    const tx = p.x + (px - py) * K * f;
    const ty = y + (px + py) * K * 0.5 * f;
    const tkey = (k) => `ut|${u.type}|${tk}|${k}`;
    const te = getSprite(tkey(ts), f * dpr, boundsOf(m.turret, m.turret.S, yaw(ts), true), (c, s) => paintSolids(c, m.turret.S, yaw(ts), { iso: true, s }), nearKeys(tkey, ts, VEH_SECT));
    if (te) blit(ctx, te, tx, ty, f);
  }
  if (m.rotors) drawRotorsIso(ctx, m, u, p.x, y, f, yaw(sec), now);
  if (burn && !away) drawFlameIso(ctx, m, p.x, y, f, yaw(sec), now);
  return true;
}

/** Rotoren live: Scheibe (Unschärfe) und Blätter, im Iso-Bild als Ellipse. */
function drawRotorsIso(ctx, m, u, x, y, f, hy, now) {
  const spin = (now / 45 + u.id * 1.7) % TAU;
  const P = (a, b, h) => [x + (a - b) * K * f, y + ((a + b) * K * 0.5 - h) * f];
  const c = Math.cos(hy);
  const s = Math.sin(hy);
  ctx.save();
  for (const [i, r] of m.rotors.entries()) {
    const ry = r.y ?? 0; // seitlicher Versatz (Modellachse), Standard 0 = Mittelachse
    const cx = r.x * c - ry * s;
    const cy = r.x * s + ry * c;
    const [hx, hz] = P(cx, cy, r.z);
    ctx.fillStyle = 'rgba(28,30,32,0.16)';
    ctx.beginPath();
    ctx.ellipse(hx, hz, r.r * f, r.r * 0.5 * f, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(30,32,34,0.75)';
    ctx.lineWidth = Math.max(1, 0.9 * f);
    ctx.lineCap = 'round';
    ctx.beginPath();
    const sp = spin * (i % 2 ? -1 : 1);
    for (let k = 0; k < r.n; k++) {
      const a = sp + (k / r.n) * TAU;
      const [bx, by] = P(cx + Math.cos(a) * r.r, cy + Math.sin(a) * r.r, r.z);
      ctx.moveTo(hx, hz);
      ctx.lineTo(bx, by);
    }
    ctx.stroke();
  }
  if (m.tail) {
    const tx = m.tail.x * c;
    const ty = m.tail.x * s;
    const [qx, qy] = P(tx, ty, m.tail.z);
    ctx.fillStyle = 'rgba(28,30,32,0.28)';
    ctx.beginPath();
    ctx.ellipse(qx, qy, m.tail.r * f * Math.abs(c) * 0.8 + 0.6 * f, m.tail.r * f, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

// Nachbrenner: äußere Flamme und heller Kern (halbe Breite, Anteil der Länge, Farbe). Je Düse eine Flamme: nozzle.ys = Querlagen
// der Düsen (F-16 eine in der Mitte, F-22 zwei), sy/sz = Breite/Höhe der Flamme (rechteckige Düsen der F-22 flacher), len = Anteil der
// Länge und flame = eigene Farben (U-2: schwacher Abgasschein statt Nachbrenner).
const NOZZLE_YS = [0];
const FLAME = [
  [1.5, 1, 'rgba(255,140,40,0.6)'],
  [0.8, 0.6, 'rgba(255,228,160,0.9)'],
];

/** Nachbrenner in Iso als Kegel (zwei gekreuzte Dreiecke) hinter der Düse. */
function drawFlameIso(ctx, m, x, y, f, hy, now) {
  const c = Math.cos(hy);
  const s = Math.sin(hy);
  const P = (a, b, h) => {
    const rx = a * c - b * s;
    const ry = a * s + b * c;
    return [x + (rx - ry) * K * f, y + ((rx + ry) * K * 0.5 - h) * f];
  };
  const { x: nx, z: nz, ys = NOZZLE_YS, sy = 1, sz = 1, len: lk = 1, flame = FLAME } = m.nozzle;
  const len = (6.5 + Math.sin(now / 40) * 0.9) * lk;
  ctx.save();
  for (const [w, l, col] of flame) {
    ctx.fillStyle = col;
    ctx.beginPath();
    for (const oy of ys) {
      const tip = P(nx - len * l, oy, nz);
      for (const [a, b] of [[P(nx, oy - w * sy, nz), P(nx, oy + w * sy, nz)], [P(nx, oy, nz - w * sz), P(nx, oy, nz + w * sz)]]) {
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.lineTo(tip[0], tip[1]);
        ctx.closePath();
      }
    }
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Schatten in Iso: Umriss des Modells von oben, flach auf den Boden gelegt (Bodenpunkt p, auch unter fliegenden Einheiten).
 * Setzt danach den einfachen Bildschirm-Transform (dpr) zurück. false = kein Modell oder Bild (dann Ellipse).
 */
export function drawUnitShadowIso(ctx, cam, u, p, dpr, now = 0) {
  const look = lookOf(u, now);
  const m = modelOf(u.type, u.team, { ...look, frame: 0 });
  if (!m) return false;
  const tk = keyOf(u.team);
  const key = `uo|${u.type}|${tk}|${look.missiles ?? ''}|${look.gear ? 1 : 0}|sh`;
  const e = sprite(key, cam.zoom * ISO_SCALE * spriteDpr(), boundsOf(m, m.S, 0, false), (c, s) => paintSolids(c, m.S, 0, { iso: false, s, shadow: true }));
  if (!e) return false;
  const air = !!u.def?.air && !jetGrounded(u) && !u.parked;
  setIsoAt(ctx, cam, dpr, p.x, p.y, u.x, u.y, ISO_SCALE);
  ctx.translate(u.x, u.y);
  ctx.rotate(m.inf ? 0 : u.angle ?? 0);
  ctx.globalAlpha = air ? 0.2 : m.inf ? 0.26 : 0.32;
  blit(ctx, e, 0, 0, 1);
  ctx.globalAlpha = 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return true;
}

// ---------- 2D von oben ----------

/**
 * Einheit von oben (2D), Weltkoordinaten (Transform des Renderers). aim = Weltwinkel zum Ziel oder null. alt = Flughöhe 0 … 1
 * (Schatten rückt ab). Liefert false ohne Modell oder Bild (dann zeichnet sprites.js den Ersatz).
 */
export function drawUnitTop(ctx, u, zoom, aim = null, now = 0) {
  const look = lookOf(u, now);
  const m = modelOf(u.type, u.team, { ...look, frame: 0 });
  if (!m) return false;
  const tk = keyOf(u.team);
  const base = `uo|${u.type}|${tk}|${look.missiles ?? ''}|${look.gear ? 1 : 0}|${look.camo ?? ''}${look.prone ? 'p' : ''}`;
  const sc = zoom * spriteDpr();
  const hull = u.angle ?? 0;
  const face = m.inf && aim !== null && aim !== undefined ? aim : hull;
  const e = sprite(base, sc, boundsOf(m, m.S, 0, false), (c, s) => paintSolids(c, m.S, 0, { iso: false, s }));
  if (!e) return false;
  const sh = sprite(`${base}|sh`, sc, boundsOf(m, m.S, 0, false), (c, s) => paintSolids(c, m.S, 0, { iso: false, s, shadow: true }));
  const air = !!u.def?.air;
  const alt = u.def?.jet ? jetAlt(u) : air ? 1 : 0;
  const off = m.inf ? 1.2 : air ? 4 + 14 * alt : 2.6;
  const k = u.def?.jet ? 0.86 + 0.14 * alt : 1;
  ctx.save();
  ctx.translate(u.x, u.y);
  if (sh) {
    ctx.save();
    ctx.translate(off, off * 1.2);
    ctx.rotate(face);
    ctx.scale(k, k);
    ctx.globalAlpha = air ? 0.22 : 0.3;
    blit(ctx, sh, 0, 0, 1);
    ctx.restore();
  }
  ctx.rotate(face);
  ctx.scale(k, k);
  blit(ctx, e, 0, 0, 1);
  if (m.turret) {
    const te = sprite(`${base}|t`, sc, boundsOf(m.turret, m.turret.S, 0, false), (c, s) => paintSolids(c, m.turret.S, 0, { iso: false, s }));
    if (te) {
      ctx.translate(m.turret.x, 0);
      ctx.rotate(aim === null || aim === undefined ? 0 : aim - hull);
      blit(ctx, te, 0, 0, 1);
    }
  }
  ctx.restore();
  if (m.rotors) drawRotorsTop(ctx, m, u, face, k, now, zoom);
  if (m.nozzle && !u.parked && (u.jet?.phase === 'roll' || alt > 0.05)) {
    ctx.save();
    ctx.translate(u.x, u.y);
    ctx.rotate(face);
    ctx.scale(k, k);
    const { x: nx, ys = NOZZLE_YS, sy = 1, len: lk = 1, flame = FLAME } = m.nozzle;
    const len = (7 + Math.sin(now / 40) * 0.8) * lk;
    for (const [w, l, col] of flame) {
      ctx.fillStyle = col;
      ctx.beginPath();
      for (const oy of ys) {
        ctx.moveTo(nx, oy - w * sy);
        ctx.lineTo(nx - len * l, oy);
        ctx.lineTo(nx, oy + w * sy);
        ctx.closePath();
      }
      ctx.fill();
    }
    ctx.restore();
  }
  return true;
}

function drawRotorsTop(ctx, m, u, face, k, now, zoom) {
  const spin = (now / 45 + u.id * 1.7) % TAU;
  ctx.save();
  ctx.translate(u.x, u.y);
  ctx.rotate(face);
  ctx.scale(k, k);
  for (const [i, r] of m.rotors.entries()) {
    const ry = r.y ?? 0; // seitlicher Versatz, Standard 0
    ctx.fillStyle = 'rgba(28,30,32,0.14)';
    ctx.beginPath();
    ctx.arc(r.x, ry, r.r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(32,34,36,0.8)';
    ctx.lineWidth = Math.max(1 / zoom, 1);
    ctx.lineCap = 'round';
    ctx.beginPath();
    const sp = spin * (i % 2 ? -1 : 1);
    for (let j = 0; j < r.n; j++) {
      const a = sp + (j / r.n) * TAU;
      ctx.moveTo(r.x, ry);
      ctx.lineTo(r.x + Math.cos(a) * r.r, ry + Math.sin(a) * r.r);
    }
    ctx.stroke();
  }
  ctx.restore();
}

// ---------- Wracks ----------

/** Wrack in Iso: verkohltes Modell (Wanne und Turm) am Boden. false = kein Modell. */
export function drawWreckIso(ctx, cam, w, p) {
  const wk = wreckOf(w.type);
  if (!wk) return false;
  const f = cam.zoom * ISO_SCALE;
  const sec = sectorOf(viewAngle(cam, w.angle ?? 0), VEH_SECT);
  const yaw = (sec / VEH_SECT) * TAU;
  const key = (k) => `uw|${w.type}|${k}`;
  const e = getSprite(key(sec), f * spriteDpr(), boundsOf(wk, wk.solids, yaw, true), (c, s) => paintSolids(c, wk.solids, yaw, { iso: true, s, charred: true }), nearKeys(key, sec, VEH_SECT));
  if (!e) return false;
  blit(ctx, e, p.x, p.y, f);
  return true;
}

/**
 * Wrack von oben (2D, seit v5.34): dasselbe verkohlte Modell wie in Iso, gedreht wie das Fahrzeug beim Abschuss, mit Schatten.
 * a = Deckkraft (Verblassen). false = kein Modell (dann die einfache Form aus fx.js).
 */
export function drawWreckTop(ctx, w, zoom, a = 1) {
  const wk = wreckOf(w.type);
  if (!wk) return false;
  const sc = zoom * spriteDpr();
  const bnd = boundsOf(wk, wk.solids, 0, false);
  const e = sprite(`uwo|${w.type}`, sc, bnd, (c, s) => paintSolids(c, wk.solids, 0, { iso: false, s, charred: true }));
  if (!e) return false;
  const sh = sprite(`uwo|${w.type}|sh`, sc, bnd, (c, s) => paintSolids(c, wk.solids, 0, { iso: false, s, shadow: true }));
  const ang = w.angle ?? 0;
  ctx.save();
  ctx.translate(w.x, w.y);
  if (sh) {
    ctx.save();
    ctx.translate(1.6, 2);
    ctx.rotate(ang);
    ctx.globalAlpha = 0.3 * a;
    blit(ctx, sh, 0, 0, 1);
    ctx.restore();
  }
  ctx.rotate(ang);
  ctx.globalAlpha = a;
  blit(ctx, e, 0, 0, 1);
  ctx.restore();
  return true;
}

const shifted = new WeakMap();
function shift(so, dx) {
  let s = shifted.get(so);
  if (s) return s;
  s = { ...so, faces: so.faces.map((fc) => fc.map(([x, y, z]) => [x + dx, y, z])), c: [so.c[0] + dx, so.c[1], so.c[2]], on: undefined };
  shifted.set(so, s);
  if (so.on) s.on = shift(so.on, dx); // Aufsatz bleibt beim (verschobenen) Träger im Turm
  return s;
}
const wrecks = new Map(); // Art → { solids: Wanne und verschobener Turm, bnd } oder null (kein Fahrzeug)
function wreckOf(type) {
  if (wrecks.has(type)) return wrecks.get(type);
  const m = modelOf(type, 0, { missiles: 0, gear: true });
  const wk = !m || m.inf ? null : { solids: m.turret ? [...m.S, ...m.turret.S.map((so) => shift(so, m.turret.x))] : m.S };
  wrecks.set(type, wk);
  return wk;
}

/** Für Tests: alle Modelle bauen lassen (Körper, Maße), ohne zu malen. */
export function unitModelTypes() {
  return [...Object.keys(MODELS), ...Object.keys(INFANTRY)];
}
export { modelOf as unitModel, lookOf as unitLook };

/** Malwerkzeug für andere gemalte Modelle (Tiere und Felsen in nature.js, seit v5.28): Körper, Renderer, Bildgrenzen, Richtungen. */
export const PAINT = { solid, box, cyl, ball, loft, prX, prY, prZ, on, fine, paintSolids, boundsOf, getSprite, viewAngle, nearKeys, sectorOf, mix };
export { paintOf, keyOf as teamKey };
export { SHOWROOM };
