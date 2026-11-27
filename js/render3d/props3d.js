// 3D-Props (Plan „3D mit three.js“, Paket „Props 3D“): Zäune, Mauern, Militär-, Industrie-, Raffinerie- und Zivilprops der Karte
// (mapprops.js), geparkte Autos, Parkbänke, Heuballen und Versorgungskisten (props.js) als InstancedMesh.
// - Die Modelle sind schon Körperlisten (Maße, Farben, Schnee je Jahreszeit); der Körper-Wandler (solids3d.js) macht daraus Geometrie.
//   Je Form (Art, Verbindung, Tor, Trümmer, Farb- und Detailvariante, Lagen, Jahreszeit) eine Geometrie; Formen mit gleichem Inhalt
//   (Prüfsumme der Ecken) teilen sich eine, also auch einen Draw-Call. Je Form ein InstancedMesh.
// - Zäune und Mauern: Die Kachel ist schon durchgehende Geometrie (mapprops.js fenceModel: die Arme reichen bis zur Zellkante und
//   verbinden sich nach den vier Nachbarn wie gemalt), je Kachel eine Instanz. Verschmelzen ganzer Linien zu einem Netz ergäbe nur
//   Draw-Calls gespart, aber jede Zerstörung (propVersion) baute die Linie neu und die Kacheln stehen je auf eigener Geländehöhe.
// - Fahnentuch (Zelt, Funkmast, Kontrollpunkt): Körper mit FLAG_MARK; die Ecken bekommen aTeam = 1, der Shader nimmt dort die Farbe
//   der Instanz (instanceColor, propFlagColor). Eine Geometrie für alle Teams.
// - Durchscheinende Körper (Maschendraht, Glas, Tarnnetz) je Deckkraft eine eigene Geometrie ohne Schatten.
// - Flächen mit vary (Schotter, Stein) bekommen je Fläche eine leicht andere Farbe wie gemalt. Materialfotos (mat) fehlen, die
//   Flächenfarben bleiben.
// - Licht wie die Einheiten (units3d.js): 0,56 + 0,44 · max(0, n · L), bodennah etwas dunkler. Alles wirft Schatten (Ebene CAST), außer
//   durchscheinenden Körpern. Höhe, Drehung, Maßstab je Instanz.
import * as THREE from '../vendor/three/three.module.min.js';
import { solidsToGeometry } from './solids3d.js';
import { HEIGHT_SCALE } from './camera3d.js';
import { CAST } from './sun3d.js';
import { FLAG_MARK } from '../render/mapprops.js';
import { crateSolids3d } from '../render/props.js';

const CAP = 512; // Instanzen je Form und Bild; darüber malt der Renderer wie bisher
const CAP_CAR = 2048;

const VS = `
uniform float uS;
varying vec3 vN;
varying vec3 vCol;
varying float vZ;
#ifdef TEAM
attribute float aTeam;
#endif
void main() {
  mat4 m = modelMatrix * instanceMatrix;
  vec3 r = mat3(m) * normal;
  vN = normalize(vec3(r.x, r.z, r.y / uS));
  vCol = color;
#ifdef TEAM
  #ifdef USE_INSTANCING_COLOR
  vCol = mix(color, instanceColor, aTeam);
  #endif
#endif
  vZ = position.z;
  gl_Position = projectionMatrix * viewMatrix * m * vec4(position, 1.0);
}`;

const FS = `
uniform vec3 uLight;
uniform float uAlpha;
varying vec3 vN;
varying vec3 vCol;
varying float vZ;
vec3 toSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
void main() {
  float d = max(0.0, dot(normalize(vN), uLight));
  float ao = vZ < 7.0 ? 0.8 + 0.2 * max(0.0, vZ) / 7.0 : 1.0; // bodennahe Flächen etwas dunkler
  gl_FragColor = vec4(min(toSrgb(vCol) * (0.56 + 0.44 * d) * ao, vec3(1.0)), uAlpha);
}`;

// ---------- Geometrie ----------

const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const hexOf = (c) => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;

/** Körper mit vary: je Fläche eigene Farbe (wie painter.js: k = 1 + vary · (Zufall − 0,5)), sonst unverändert. */
function toned(so) {
  if (!so.vary) return so;
  const base = hexRgb(so.col);
  const fcol = so.faces.map((_, fi) => {
    const k = 1 + so.vary * (((Math.imul(fi + 1, 2654435761) >>> 0) % 1000) / 1000 - 0.5);
    return hexOf((so.fcol?.[fi] ? hexRgb(so.fcol[fi]) : base).map((v) => v * k));
  });
  return { ...so, fcol };
}

/** Zwei Geometrien (position, normal, color) zu einer mit aTeam: 0 für a, 1 für b. */
function withTeam(a, b) {
  const g = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'color']) {
    const x = a.getAttribute(name).array;
    const y = b.getAttribute(name).array;
    const arr = new Float32Array(x.length + y.length);
    arr.set(x);
    arr.set(y, x.length);
    g.setAttribute(name, new THREE.Float32BufferAttribute(arr, 3));
  }
  const team = new Float32Array(a.getAttribute('position').count + b.getAttribute('position').count);
  team.fill(1, a.getAttribute('position').count);
  g.setAttribute('aTeam', new THREE.Float32BufferAttribute(team, 1));
  g.computeBoundingBox();
  a.dispose();
  b.dispose();
  return g;
}

/** Prüfsumme der Ecken (Lage, Farbe, Team): gleiche Form, gleicher Wert. */
function hashOf(g) {
  let h = 2166136261 >>> 0;
  for (const name of ['position', 'color', 'aTeam']) {
    const at = g.getAttribute(name);
    if (!at) continue;
    const u = new Uint32Array(at.array.buffer, at.array.byteOffset, at.array.length);
    for (let i = 0; i < u.length; i++) h = Math.imul(h ^ u[i], 16777619) >>> 0;
  }
  return `${g.getAttribute('position').count}.${h.toString(36)}`;
}

const canon = new Map(); // Prüfsumme → Geometrie (gemeinsam für alle gleichen Formen)
const forms = new Map(); // Formschlüssel → [{ geo, hash, alpha, team }]

/**
 * Teilformen eines Körpersatzes: undurchsichtige Körper (mit Fahnentuch als Team-Ecken), je Deckkraft die durchscheinenden. charred:
 * verbrannt (ausgebranntes Auto).
 */
export function formsOf(key, S, charred = false) {
  const k = `${key}|${charred ? 1 : 0}`;
  let list = forms.get(k);
  if (list) return list;
  list = [];
  const opaque = [];
  const cloth = [];
  const glass = new Map();
  for (const so of S) {
    if (so.only === 'top') continue;
    if (so.alpha !== undefined) {
      if (!glass.has(so.alpha)) glass.set(so.alpha, []);
      glass.get(so.alpha).push(toned(so));
    } else if (!charred && so.col === FLAG_MARK) cloth.push(so);
    else opaque.push(toned(so));
  }
  const add = (geo, alpha, team) => {
    if (!geo.getAttribute('position').count) return geo.dispose();
    const hash = hashOf(geo);
    const same = canon.get(hash);
    if (same) geo.dispose();
    else canon.set(hash, geo);
    list.push({ geo: same ?? geo, hash, alpha, team });
  };
  if (opaque.length || cloth.length) {
    const body = solidsToGeometry(opaque, { charred });
    add(cloth.length ? withTeam(body, solidsToGeometry(cloth)) : body, 1, cloth.length > 0);
  }
  for (const [a, g] of glass) add(solidsToGeometry(g, { charred }), a, false);
  forms.set(k, list);
  return list;
}

// ---------- Props im Bild ----------

export class Props3D {
  constructor() {
    this.uLight = { value: new THREE.Vector3(0, 0, 1) };
    const uniforms = (alpha) => ({ uLight: this.uLight, uS: { value: HEIGHT_SCALE }, uAlpha: { value: alpha } });
    const make = (alpha, team) => {
      const m = new THREE.ShaderMaterial({ uniforms: uniforms(alpha), vertexShader: VS, fragmentShader: FS, vertexColors: true, defines: team ? { TEAM: '' } : {} });
      m.shadowSide = THREE.DoubleSide; // dünne, einseitige Teile (Latten, Blech) werfen Schatten
      if (alpha < 1) {
        m.transparent = true;
        m.depthWrite = false;
      }
      return m;
    };
    this.mats = new Map([['o', make(1, false)], ['t', make(1, true)]]);
    this.makeMat = make;
    this.group = new THREE.Group();
    this.group.name = 'props';
    this.sets = new Map(); // Schlüssel → { mesh, n, cap, team, art }
    this.counts = {};
    this.colors = new Map(); // Hexfarbe → [r, g, b] linear
  }

  /** Bildanfang: Sonne (Welt, z oben). */
  begin(light) {
    this.uLight.value.set(light[0], light[1], light[2]).normalize();
    for (const s of this.sets.values()) s.n = 0;
    this.counts = {};
  }

  matOf(alpha, team) {
    const k = alpha < 1 ? `a${alpha}` : team ? 't' : 'o';
    let m = this.mats.get(k);
    if (!m) this.mats.set(k, (m = this.makeMat(alpha, false)));
    return m;
  }

  setOf(f, cap) {
    const key = `${f.hash}|${f.alpha}|${f.team ? 1 : 0}`;
    let s = this.sets.get(key);
    if (s) return s;
    const mesh = new THREE.InstancedMesh(f.geo, this.matOf(f.alpha, f.team), cap);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (f.team) {
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
      mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    }
    mesh.frustumCulled = false;
    mesh.count = 0;
    mesh.visible = false;
    if (f.alpha >= 1) {
      mesh.castShadow = true;
      mesh.layers.enable(CAST);
    }
    this.group.add(mesh);
    s = { mesh, n: 0, cap, team: f.team };
    this.sets.set(key, s);
    return s;
  }

  rgbOfFlag(hex) {
    let c = this.colors.get(hex);
    if (!c) {
      const col = new THREE.Color().set(hex);
      this.colors.set(hex, (c = [col.r, col.g, col.b]));
    }
    return c;
  }

  /**
   * Modell m ({ key, S, yaw, k = 1, charred }) am Weltpunkt (x, y) auf Höhe h, um yaw gedreht, Maßstab k; flag: Farbe des Fahnentuchs
   * (Hex) oder null; art: Zähler im Prüfteil. false = ein Satz ist voll (dann malt der Renderer das Bild).
   */
  add(m, x, y, h, flag = null, art = 'prop') {
    const list = formsOf(m.key, m.S, !!m.charred);
    const cap = art === 'car' ? CAP_CAR : CAP;
    const sets = list.map((f) => this.setOf(f, cap));
    if (sets.some((s) => s.n >= s.cap)) return false;
    const yaw = m.yaw ?? 0;
    const k = m.k ?? 1;
    const c = Math.cos(yaw) * k;
    const sn = Math.sin(yaw) * k;
    sets.forEach((s, i) => {
      const a = s.mesh.instanceMatrix.array;
      const o = s.n * 16;
      a[o] = c;
      a[o + 1] = sn;
      a[o + 2] = 0;
      a[o + 3] = 0;
      a[o + 4] = -sn;
      a[o + 5] = c;
      a[o + 6] = 0;
      a[o + 7] = 0;
      a[o + 8] = 0;
      a[o + 9] = 0;
      a[o + 10] = k;
      a[o + 11] = 0;
      a[o + 12] = x;
      a[o + 13] = y;
      a[o + 14] = h;
      a[o + 15] = 1;
      if (s.team) s.mesh.instanceColor.array.set(this.rgbOfFlag(flag ?? '#e8e6dc'), s.n * 3);
      s.n++;
      s.art = art;
    });
    this.counts[art] = (this.counts[art] ?? 0) + 1;
    return true;
  }

  /** Versorgungskiste (Kantenlänge s Welt-px) am Weltpunkt, base über der Geländehöhe h (auf dem Rücken eines Trägers). */
  crate(x, y, s, base, h) {
    return this.add({ key: 'crate', S: crateSolids3d(), yaw: 0, k: s / 16 }, x, y, h + base, null, 'crate');
  }

  /** Bildende: Zahl der Instanzen je Satz setzen, leere verstecken. */
  end() {
    for (const s of this.sets.values()) {
      const m = s.mesh;
      m.count = s.n;
      m.visible = s.n > 0;
      if (!s.n) continue;
      m.instanceMatrix.clearUpdateRanges();
      m.instanceMatrix.addUpdateRange(0, s.n * 16);
      m.instanceMatrix.needsUpdate = true;
      if (s.team) {
        m.instanceColor.clearUpdateRanges();
        m.instanceColor.addUpdateRange(0, s.n * 3);
        m.instanceColor.needsUpdate = true;
      }
    }
  }

  /** Props im Bild je Art und sichtbare Sätze (= Draw-Calls ohne Schattenkarte), Dreiecke. */
  stats() {
    const out = { ...this.counts, total: 0, calls: 0, tris: 0 };
    for (const v of Object.values(this.counts)) out.total += v;
    for (const s of this.sets.values()) {
      if (!s.n) continue;
      out.calls++;
      out.tris += (s.mesh.geometry.getAttribute('position').count / 3) * s.n;
    }
    return out;
  }

  dispose() {
    for (const s of this.sets.values()) s.mesh.dispose();
    for (const m of this.mats.values()) m.dispose();
  }
}
