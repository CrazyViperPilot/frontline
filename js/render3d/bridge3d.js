// 3D-Brücken und Furtstangen (Plan „3D mit three.js“, Paket „Brücken 3D“): die Brücken der Flüsse (render/bridge.js) und die Furtstangen als
// Geometrie statt als gemalter Streifen im Durchlauf „Boden“.
// - Eine Brücke = ein Netz in Brückenkoordinaten (u entlang der Achse von b.x1, b.y1, v quer, z über dem Wasserspiegel), je Brücke gebaut
//   und beim Wechsel des Zustands (zerstört, Wiederaufbau in Stufen, Schaden in Stufen, Jahreszeit, Geländehöhe an den Widerlagern) neu.
//   Die Maße kommen aus bridge.js (BRIDGE, BRIDGE_PARTS): Pfeiler (zwei runde Stützen mit Querträger), Überbau mit Gesims, Fahrbahn wie die
//   Stadtstraßen (Asphalt, Gehwegplatten, Bordstein, Rinne bzw. Schneewall, gestrichelte Mittellinie, Fugen), Geländer mit zwei Holmen,
//   Laternen; Eisenbahnbrücke mit Schotter, Schwellen, Schienen; zerstört: Stützenstümpfe, Brückenköpfe mit Bewehrung, Trümmer, im
//   Wiederaufbau Holzgerüst mit Bohlen.
// - Die Fahrbahn liegt eben auf b.deckH (so stehen die Einheiten darauf, game.groundHeight); Widerlager gehen bis ins Gelände. Keine Rampe:
//   die Einheit sitzt an den Enden schon auf der Fahrbahnhöhe (wie gemalt).
// - Furtstangen: eine Geometrie (Pfahl mit rot-weißen Bändern und Kappe), je Stange eine Instanz.
// - Licht wie Props und Einheiten (props3d.js: VS, FS). Alles wirft Schatten (Ebene CAST); die gemalten Schatten der Brücke und die
//   Kräuselringe am Fuß der Furtstangen bleiben nur, wenn keine Schattenkarte da ist (Schatten) bzw. fallen weg (Ringe der Furtstangen).
import * as THREE from '../vendor/three/three.module.min.js';
import { solidsToGeometry } from './solids3d.js';
import { HEIGHT_SCALE } from './camera3d.js';
import { CAST } from './sun3d.js';
import { VS, FS } from './props3d.js';
import { box, prZ, cyl, solid } from '../render/units/shapes.js';
import { BRIDGE, BRIDGE_PARTS } from '../render/bridge.js';
import { STREET } from '../render/ways.js';
import { ROAD } from '../render/citylayer.js';
import { RELIEF } from '../game/relief.js';
import { makeRng } from '../core/rng.js';

const { DECK, HALF, SLAB, RAIL_H, STUB, LANE, TRACK, SLEEPER_GAP, CAP_H, COL_R, LAMP_H, POST_GAP, POST_H, KERB_W, GUTTER_W, COL } = BRIDGE;
const { piers, lamps, debris, progressOf, dashes } = BRIDGE_PARTS;

const STEPS = 16; // Wiederaufbau in so vielen Stufen (je Stufe ein neues Netz)
const POST_R = 1.7; // Halbmesser einer Furtstange (gemalt 3,2 px breit)
const CAP_POSTS = 512; // Furtstangen je Bild; darüber malt der Renderer sie wie bisher
const TIE = '#2b2c28'; // Fugen (dunkel, auf Asphalt)
const MARK = '#dcdbd0'; // Mittellinie (gemalt: ROAD.mark mit 0,88 Deckkraft auf Asphalt)
const SNOW = '#eef1f3'; // Schneewall statt der Rinne
const WET = '#5f6058'; // nasser Fuß der Stützen
const PATCH = '#2e2a25'; // Brandfleck
const LAMP_GLOW = '#fff4cf';

/** Fläche ohne Dicke (nur Oberseite) in Höhe z; (u0, u1) × (v0, v1). */
const slab2 = (u0, u1, v0, v1, z, col) => solid([[[u0, v0, z], [u1, v0, z], [u1, v1, z], [u0, v1, z]]], col, [(u0 + u1) / 2, (v0 + v1) / 2, z - 1]);
/** Vieleck (Brandfleck) ohne Dicke. */
const disc = (u, v, r, a, z, col) => {
  const n = 8;
  const pts = Array.from({ length: n }, (_, i) => [u + Math.cos(a + (i / n) * Math.PI * 2) * r, v + Math.sin(a + (i / n) * Math.PI * 2) * r * 0.8, z]);
  return solid([pts], col, [u, v, z - 1]);
};
/** Drehbarer Quader um (u, v), Länge w entlang a, Breite d, von z0 bis z1 (Trümmer). */
const rotBox = (u, v, w, d, a, z0, z1, col) => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const plan = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([x, y]) => [u + x * c - y * s, v + x * s + y * c]);
  return prZ(plan, z0, z1, col);
};

/** Farben der Fahrbahn je Jahreszeit (wie ways.js STREET). */
const streetOf = (season) => STREET[season] ?? STREET.summer;

/**
 * Körper einer Brücke in Brückenkoordinaten. o: lift (Höhe der Fahrbahn über dem Wasser), ground [g0, g1] (Gelände an den beiden
 * Widerlagern über dem Wasser, null ohne), prog (0 bis STEPS, Wiederaufbau), patches (Zahl der Brandflecken).
 */
export function bridgeSolids(b, season, o) {
  const lift = o.lift;
  const L = b.len;
  const [w0, w1] = b.span;
  const rail = !!b.src?.rail;
  const col = streetOf(season);
  const S = [];
  const snow = season === 'winter';
  const gap = w1 - w0 - 2 * STUB;
  const p = o.prog / STEPS;
  const colTop = Math.max(0, lift - SLAB - CAP_H);
  const list = piers(b);
  // Pfeiler: zwei runde Stützen mit nassem Fuß und Querträger (zerstört: Stümpfe mit Bewehrung)
  list.forEach((u, i) => {
    for (const s of [-1, 1]) {
      const v = s * HALF * 0.55;
      const h = b.broken ? Math.min(colTop, 5 + ((i * 7 + (s > 0 ? 3 : 0)) % 6)) : colTop;
      if (h < 1) continue;
      S.push(cyl([u, v, 0], [u, v, h], COL_R, COL_R, 10, b.broken ? COL.stump : COL.pier));
      S.push(cyl([u, v, 0], [u, v, Math.min(h, 2.4)], COL_R + 0.15, COL_R + 0.15, 10, WET));
      if (b.broken) {
        for (let k = 0; k < 3; k++) {
          const seed = i + (s > 0 ? 5 : 0);
          const lean = (((seed + k * 3) % 5) - 2) * 0.9;
          S.push(cyl([u + (k - 1) * 2.2, v, h], [u + (k - 1) * 2.2 + lean, v, h + 3 + ((seed + k) % 3)], 0.4, 0.4, 4, COL.rebar));
        }
      }
    }
    if (!b.broken) S.push(box(u - 5, u + 5, -(DECK + 6) / 2, (DECK + 6) / 2, colTop, colTop + Math.min(CAP_H, lift - SLAB), COL.pier));
  });
  // Widerlager: Betonwand vom Gelände bis unter die Fahrbahn
  if (o.ground) {
    [[0, 1, o.ground[0]], [L, -1, o.ground[1]]].forEach(([u, dir, ground]) => {
      const h = lift - SLAB - ground;
      if (h > 1) S.push(box(Math.min(u, u + dir * 10), Math.max(u, u + dir * 10), -(DECK - 2) / 2, (DECK - 2) / 2, ground, lift - SLAB, COL.pier));
    });
  }
  // Fahrbahnstück: Träger, Gesims, Belag, Geländer, Laternen
  const deck = (u0, u1, joints) => {
    if (u1 - u0 < 2) return;
    S.push(box(u0, u1, -(DECK - 6) / 2, (DECK - 6) / 2, lift - SLAB, lift - 2, COL.girder));
    S.push(box(u0, u1, -HALF, HALF, lift - 2, lift - 0.25, COL.cornice, { top: { col: COL.concrete } }));
    if (rail) {
      S.push(slab2(u0, u1, -LANE, LANE, lift, snow ? '#d9dcdc' : COL.ballast));
      for (let u = u0 + 2; u < u1 - 2; u += SLEEPER_GAP) S.push(slab2(u, u + 2.4, -TRACK - 5, TRACK + 5, lift + 0.1, COL.sleeper));
      for (const s of [-1, 1]) S.push(box(u0, u1, s * TRACK - 0.9, s * TRACK + 0.9, lift + 0.1, lift + 1, COL.steel));
    } else {
      // Streifen quer zur Fahrbahn ohne Überlappung: Gehweg, Bordstein, Rinne (Winter: Schneewall), Asphalt
      const k0 = -LANE + ROAD.kerb;
      const gw = snow ? 3.2 : GUTTER_W;
      const gutter = snow ? SNOW : '#3a3c37';
      for (const s of [-1, 1]) {
        const at = (a, c) => (s < 0 ? [a, c] : [-c, -a]);
        const strip = (a, c, colr) => S.push(slab2(u0, u1, ...at(a, c), lift, colr));
        strip(-LANE, k0 - KERB_W, col.pavers);
        strip(k0 - KERB_W, k0, COL.curb);
        strip(k0, k0 + gw, gutter);
      }
      S.push(slab2(u0, u1, -LANE + ROAD.kerb + gw, LANE - ROAD.kerb - gw, lift, col.asphalt));
      for (const [a, e] of dashes(u0, u1)) S.push(slab2(a, e, -ROAD.line / 2, ROAD.line / 2, lift + 0.12, MARK));
      for (const u of joints) if (u > u0 + 1 && u < u1 - 1) S.push(slab2(u - 0.7, u + 0.7, -LANE, LANE, lift + 0.12, TIE));
    }
    for (const s of [-1, 1]) {
      const v = s * (HALF - 1.4);
      for (let u = u0 + 3; u <= u1 - 2; u += POST_GAP) S.push(box(u - 0.6, u + 0.6, v - 0.6, v + 0.6, lift, lift + RAIL_H, COL.post));
      S.push(box(u0, u1, v - 0.4, v + 0.4, lift + RAIL_H * 0.5 - 0.4, lift + RAIL_H * 0.5 + 0.4, COL.railMid));
      S.push(box(u0, u1, v - 0.75, v + 0.75, lift + RAIL_H - 1.5, lift + RAIL_H, COL.rail));
    }
    if (!rail) {
      for (const [u, s] of lamps(b)) {
        if (u <= u0 + 2 || u >= u1 - 2) continue;
        const v0 = s * (HALF - 3.2);
        const v1 = s * (LANE - 3);
        S.push(cyl([u, v0, lift], [u, v0, lift + LAMP_H], 0.7, 0.7, 4, COL.lampPole));
        S.push(cyl([u, v0, lift + LAMP_H], [u, v1, lift + LAMP_H - 0.6], 0.6, 0.6, 4, COL.lampPole));
        S.push(box(u - 2.6, u + 2.6, v1 - 1.6, v1 + 1.6, lift + LAMP_H - 1.7, lift + LAMP_H - 0.5, COL.lampHead));
        S.push(box(u - 1.8, u + 1.8, v1 - 1, v1 + 1, lift + LAMP_H - 1.9, lift + LAMP_H - 1.7, LAMP_GLOW));
      }
    }
  };
  if (!b.broken) {
    deck(0, L, [2.5, ...list, L - 2.5]);
    if (o.patches) {
      const rng = makeRng(Math.abs(b.id) * 7919);
      for (let i = 0; i < o.patches; i++) {
        const u = w0 + rng.next() * (w1 - w0);
        const v = (rng.next() - 0.5) * (DECK - 16);
        const r = 5 + rng.next() * 7;
        S.push(disc(u, v, r, i, lift + 0.2, PATCH));
      }
    }
  } else {
    for (const d of debris(b)) S.push(rotBox(d.u, d.v, d.s, (d.s * 2) / 3, d.a, 0, 4, d.c));
    if (p > 0) {
      // Gerüst: Holzstützen vom Wasser bis unter die Fahrbahn, darauf Bohlen bis zum Fortschritt
      const reach = gap * p / 2;
      for (let u = 0; u <= reach; u += 24) {
        for (const uu of [w0 + STUB + u, w1 - STUB - u]) for (const s of [-1, 1]) S.push(cyl([uu, s * HALF * 0.7, 0], [uu, s * HALF * 0.7, lift - SLAB], 1.2, 1.2, 4, COL.timber));
      }
      for (const [u0, u1] of [[w0 + STUB, w0 + STUB + reach], [w1 - STUB - reach, w1 - STUB]]) {
        if (u1 - u0 >= 2) S.push(box(u0, u1, -(DECK - 12) / 2, (DECK - 12) / 2, lift - 3, lift, COL.timber));
      }
    }
    deck(0, w0 + STUB, [2.5]);
    deck(w1 - STUB, L, [L - 2.5]);
    for (const [u, dir] of [[w0 + STUB, 1], [w1 - STUB, -1]]) {
      for (let i = 0; i < 7; i++) {
        const v = -HALF + 6 + ((DECK - 12) * i) / 6;
        const h = lift - SLAB * (i % 2 ? 0.35 : 0.7);
        S.push(cyl([u, v, h], [u + dir * (5 + (i % 3) * 2), v + (i % 2 ? 1.6 : -1.6), h - 1.5 - (i % 3)], 0.45, 0.45, 4, COL.rebar));
      }
    }
  }
  return S;
}

/** Furtstange: Pfahl mit nassem Fuß, Holz, rot-weißen Bändern und dunkler Kappe, Fuß bei z = 0. */
export function postSolids() {
  const seg = (h0, h1, c, o) => cyl([0, 0, h0 * POST_H], [0, 0, h1 * POST_H], POST_R, POST_R, 8, c, o);
  return [
    seg(0, 0.18, '#3e3122'),
    seg(0.18, 0.42, '#5b4630'),
    seg(0.42, 0.58, '#f2efe6'),
    seg(0.58, 0.74, '#c8402f'),
    seg(0.74, 0.9, '#f2efe6'),
    seg(0.9, 1, '#c8402f', { top: { col: '#2f2a24' } }),
  ];
}

/** Zustand einer Brücke, der das Netz bestimmt (Schlüssel) und was es dazu braucht. */
export function bridgeState(b, season, relief) {
  const water = relief ? RELIEF.water : 0;
  const lift = (relief ? b.deckH : 10) - water;
  let ground = null;
  if (relief) {
    // Gelände an den Widerlagern (tiefster Punkt quer zur Fahrbahn, etwas eingegraben)
    const ax = Math.cos(b.angle);
    const ay = Math.sin(b.angle);
    ground = [0, b.len].map((u, i) => {
      const uu = u + (i ? -5 : 5);
      let low = Infinity;
      for (const v of [-HALF, 0, HALF]) low = Math.min(low, relief.displayAt(b.x1 + uu * ax - v * ay, b.y1 + uu * ay + v * ax));
      return Math.round(low - water - 4);
    });
  }
  const prog = Math.round(progressOf(b) * STEPS);
  const dmg = b.broken ? 0 : 1 - b.hp / b.maxHp;
  const patches = dmg > 0.05 ? Math.ceil(dmg * 8) : 0;
  const key = [season, Math.round(lift * 10), b.len, b.span.join(','), b.broken ? 1 : 0, prog, patches, b.src?.rail ? 1 : 0, ground?.join(',') ?? '-', b.id].join('|');
  return { key, water, o: { lift, ground, prog, patches } };
}

export class Bridge3D {
  constructor() {
    this.uLight = { value: new THREE.Vector3(0, 0, 1) };
    this.mat = new THREE.ShaderMaterial({ uniforms: { uLight: this.uLight, uS: { value: HEIGHT_SCALE }, uAlpha: { value: 1 } }, vertexShader: VS, fragmentShader: FS, vertexColors: true });
    this.mat.shadowSide = THREE.DoubleSide;
    this.group = new THREE.Group();
    this.group.name = 'bridges';
    this.entries = new Map(); // Brücke → { key, mesh, seen }
    this.posts = null; // InstancedMesh der Furtstangen
    this.nPosts = 0;
    this.nBridges = 0;
    this.m4 = new THREE.Matrix4();
  }

  /** Bildanfang: Sonne (Welt, z oben). */
  begin(light) {
    this.uLight.value.set(light[0], light[1], light[2]).normalize();
    for (const e of this.entries.values()) e.seen = false;
    this.nPosts = 0;
    this.nBridges = 0;
  }

  mesh(geo, cap) {
    const mesh = new THREE.InstancedMesh(geo, this.mat, cap);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    mesh.layers.enable(CAST);
    mesh.count = 0;
    mesh.visible = false;
    this.group.add(mesh);
    return mesh;
  }

  /** Brücke b zeigen (Netz bei geändertem Zustand neu bauen). relief null: flacher Boden (Höhe 10 wie gemalt). */
  bridge(b, season, relief) {
    const st = bridgeState(b, season, relief);
    let e = this.entries.get(b);
    if (!e) this.entries.set(b, (e = { key: '', mesh: null, seen: false }));
    if (e.key !== st.key) {
      const old = e.mesh;
      e.mesh = this.mesh(solidsToGeometry(bridgeSolids(b, season, st.o)), 1);
      e.key = st.key;
      if (old) {
        this.group.remove(old);
        old.geometry.dispose();
        old.dispose();
      }
    }
    e.seen = true;
    e.water = st.water;
    const m = this.m4.makeRotationZ(b.angle);
    m.setPosition(b.x1, b.y1, st.water);
    e.mesh.setMatrixAt(0, m);
    e.mesh.instanceMatrix.needsUpdate = true;
    e.mesh.count = 1;
    e.mesh.visible = true;
    this.nBridges++;
    return true;
  }

  /** Furtstange am Weltpunkt p auf Wasserhöhe h. false = zu viele. */
  ford(p, h = RELIEF.water) {
    if (this.nPosts >= CAP_POSTS) return false;
    if (!this.posts) this.posts = this.mesh(solidsToGeometry(postSolids()), CAP_POSTS);
    const m = this.m4.makeTranslation(p.x, p.y, h);
    this.posts.setMatrixAt(this.nPosts++, m);
    return true;
  }

  /** Bildende: nicht gezeigte Brücken verstecken, Zahl der Furtstangen setzen. */
  end() {
    for (const e of this.entries.values()) if (!e.seen && e.mesh) e.mesh.visible = false;
    if (this.posts) {
      this.posts.count = this.nPosts;
      this.posts.visible = this.nPosts > 0;
      this.posts.instanceMatrix.clearUpdateRanges();
      this.posts.instanceMatrix.addUpdateRange(0, this.nPosts * 16);
      this.posts.instanceMatrix.needsUpdate = true;
    }
  }

  /** Im Bild: Zahl der Brücken und Furtstangen, sichtbare Netze (= Draw-Calls ohne Schattenkarte), Dreiecke. */
  stats() {
    let calls = 0;
    let tris = 0;
    for (const e of this.entries.values()) {
      if (!e.seen || !e.mesh) continue;
      calls++;
      tris += e.mesh.geometry.getAttribute('position').count / 3;
    }
    if (this.posts?.visible) {
      calls++;
      tris += (this.posts.geometry.getAttribute('position').count / 3) * this.nPosts;
    }
    return { bridges: this.nBridges, posts: this.nPosts, calls, tris: Math.round(tris) };
  }

  dispose() {
    for (const e of this.entries.values()) {
      e.mesh?.geometry.dispose();
      e.mesh?.dispose();
    }
    this.posts?.geometry.dispose();
    this.posts?.dispose();
    this.mat.dispose();
  }
}
