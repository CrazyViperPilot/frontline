// 3D-Boden (Plan „3D mit three.js“, Paket „3D-Boden“): Höhennetz aus relief.fine als BufferGeometry mit dem Boden-Shader von
// render/ground.js (Gras, Fels, Ufer, Wasser, Schnee; FS_GROUND unverändert) als ShaderMaterial, dazu der Erdschnitt am
// Kartenrand. Das Bodenbild (buildTerrain(map, 'gl'), ohne Gebäude und Bäume) ist die Textur. Liegt in Weltkoordinaten (x, y, Höhe)
// unter der Wurzelgruppe (camera3d.js), steht also im selben Tiefenpuffer wie spätere 3D-Objekte.
// Sichtbare Höhe wie relief.displayAt: Seen als ebene Wasserfläche. Gelände-Änderungen (Editor) laden nur die geänderten Zeilen.
// Licht vorerst wie im Shader (Lichtvektor aus Renderer.lightVec); three-Licht und Schattenempfang: Paket „Licht und Schatten“.
// Wasser (Paket „Wasser 3D“): eigenes Mesh über Seen und Fluss (FS_WATER unten), Begründung dort.
import * as THREE from '../vendor/three/three.module.min.js';
import { BALANCE } from '../data/balance.js';
import { RELIEF, FINE_N } from '../game/relief.js';
import { FS_GROUND, SKIRT_BOTTOM, NOISE_N, noiseTexture } from '../render/ground.js';
import { groundDetail, DETAIL_N } from '../render/groundtex.js';
import { HEIGHT_SCALE } from './camera3d.js';
import { wetGround } from './weather3d.js';

const W = BALANCE.map.width;
const STEP = RELIEF.step;

// Lage kommt als position (x, y, sichtbare Höhe), aH = (Höhe für die Farbe, Neigung x, Neigung y) wie in ground.js
const VS = `
attribute vec3 aH;
varying vec2 vPos;
varying float vH;
varying vec2 vG;
void main() {
  vPos = position.xy;
  vH = aH.x;
  vG = aH.yz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// Wasser (Paket „Wasser 3D“): eigenes Mesh statt nur der Farbe in FS_GROUND. Es teilt Lage und Höhen (position, aH) mit dem Bodennetz,
// hat aber nur die Dreiecke mit einer Ecke unter dem Wasserspiegel (wenige Prozent des Netzes). Gleiche Ecken wie der Boden: die
// Uferlinie liegt genau dort, wo FS_GROUND sein Wasser malt (vH < uWater), ohne Spalt; der Tiefentest gegen das Bodennetz (mit
// polygonOffset zum Betrachter hin) verdeckt Wasser hinter Hügeln, ohne an gleich hohen Flächen zu flimmern. FS_GROUND bleibt unverändert;
// der 3D-Boden verwirft nur Punkte unter tiefem Wasser (FS_GROUND3D), am Rand blendet das Wasser über 0,6 px Tiefe weich über sein Ufer.
// Eigener Shader, weil das Wasser Blickrichtung (Spiegelung des Himmels, Fresnel) und Sonnenglanz braucht, die der Boden nicht kennt.
// Grund = Geländehöhe unter dem Spiegel (vH): tiefer ist dunkler. Schatten fallen über den Schattenfänger (sun3d.js, dasselbe Netz) auch
// aufs Wasser; Kriegsnebel und Lichtstimmung (drawMood, also auch Nacht) liegen wie auf dem Boden darüber.
// Farben und Stärken sind Darstellung (wie in FS_GROUND), keine Spielwerte.
const FS_WATER = `
precision highp float;
uniform sampler2D uNoise;
uniform vec3 uLight;
uniform vec3 uEye; // zum Betrachter (Welt, z oben)
uniform vec3 uSky; // Himmel, der sich spiegelt
uniform vec3 uSun; // Farbe des Sonnenglanzes (0 = keiner)
uniform float uTime;
uniform float uWater;
uniform float uSnow;
varying vec2 vPos;
varying float vH;
varying vec2 vG;
float nz(vec2 p, float s) { return texture2D(uNoise, p / (256.0 * s)).a; }
void main() {
  float dpt = uWater - vH; // Wassertiefe über dem Grund
  if (dpt <= 0.0) discard;
  float n2 = nz(vPos + 91.0, 1.1); // wie FS_GROUND (Eisrand)
  float deep = smoothstep(0.0, 48.0, dpt);
  // Grund: Farben wie FS_GROUND, über tiefem Grund deutlich dunkler, im Flachen grünlich hell (man sieht den Grund)
  vec3 w = mix(vec3(0.30, 0.50, 0.50), vec3(0.10, 0.22, 0.31), smoothstep(0.0, 50.0, dpt));
  w *= 1.0 - 0.38 * deep * deep;
  w = mix(w, vec3(0.36, 0.52, 0.44), (1.0 - smoothstep(0.0, 7.0, dpt)) * 0.25);
  // Wellen: zwei ziehende Lagen Rauschen wie FS_GROUND, ihre Neigung gibt die Normale für Spiegelung und Glanz
  vec2 q = vPos + 9.0 * vec2(sin(vPos.y / 37.0 + uTime * 0.7), sin(vPos.x / 41.0 + uTime * 0.6));
  vec2 qa = q + vec2(uTime * 24.0, uTime * 11.0);
  vec2 qb = q - vec2(uTime * 20.0, -uTime * 8.0) + 53.0;
  float ra = nz(qa, 2.6);
  float rb = nz(qb, 1.6);
  float rip = ra + rb;
  // Neigung der Wellen je 3 Welt-px aus den Bildschirm-Ableitungen (Kettenregel über vPos), ohne weitere Texturzugriffe
  vec2 ax = dFdx(vPos);
  vec2 ay = dFdy(vPos);
  float det = ax.x * ay.y - ax.y * ay.x;
  vec2 dr = abs(det) > 1e-6 ? 3.0 * vec2(ay.y * dFdx(rip) - ax.y * dFdy(rip), ax.x * dFdy(rip) - ay.x * dFdx(rip)) / det : vec2(0.0);
  float calm = smoothstep(0.0, 3.0, dpt); // am Ufer flacher
  vec3 n = normalize(vec3(-dr * 1.4 * calm, 1.0));
  w += vec3(0.06, 0.08, 0.08) * smoothstep(1.1, 1.55, rip);
  w += vec3(0.05, 0.06, 0.06) * (1.0 - smoothstep(0.0, 14.0, dpt)); // heller Saum im flachen Wasser
  // Spiegelung des Himmels: Fresnel (flacher Blick spiegelt mehr), mit den Wellen unruhig
  float ct = clamp(dot(n, uEye), 0.0, 1.0);
  float fr = 0.08 + 0.6 * pow(1.0 - ct, 3.0);
  vec3 col = mix(w, uSky, fr * (0.25 + 0.5 * deep));
  // Sonnenglanz: breiter Schimmer und Funkeln auf den Wellenkämmen
  vec3 rl = reflect(-uLight, n);
  float sp = max(dot(rl, uEye), 0.0);
  col += uSun * (0.10 * pow(sp, 10.0) + 0.75 * pow(sp, 160.0)) * calm;
  // Uferschaum: Wellen laufen aufs Ufer zu (Phase über die Tiefe), dazu ziehende Flocken
  float near = 1.0 - smoothstep(0.0, 4.5 + 3.0 * n2, dpt);
  if (near > 0.0) {
    float wave = 0.5 + 0.5 * sin(dpt * 1.6 - uTime * 1.8 + nz(vPos + 300.0, 6.0) * 12.0);
    float flake = nz(vPos * 1.3 + vec2(uTime * 6.0, -uTime * 4.0), 0.9);
    float foam = near * smoothstep(0.55, 0.85, wave * 0.55 + flake * 0.6);
    col = mix(col, vec3(0.88, 0.92, 0.91), foam * 0.75);
  }
  col = mix(col, vec3(0.78, 0.84, 0.82), (1.0 - smoothstep(0.0, 2.2, dpt)) * 0.55); // heller Rand wie FS_GROUND
  // Winter wie FS_GROUND: kälteres Wasser, am Ufer ein Eisrand (matt, mit feinen Rissen, ohne Schaum und Glanz)
  col = mix(col, col * vec3(0.82, 0.95, 1.08), uSnow);
  float ice = uSnow * (1.0 - smoothstep(3.0, 12.0 + 6.0 * n2, dpt)); // etwas breiter als gemalt (dort hellt der Saum mit auf)
  if (ice > 0.0) {
    float crack = (1.0 - smoothstep(0.0, 0.035, abs(nz(vPos + 777.0, 3.5) - 0.5))) * 0.08;
    vec3 iceCol = vec3(0.80, 0.87, 0.92) * (1.0 - crack) + uSky * 0.06;
    col = mix(col, iceCol, ice * 0.9);
  }
  gl_FragColor = vec4(col, smoothstep(0.0, 0.6, dpt));
}`;

// Boden-Shader für die Ansicht 3D: FS_GROUND unverändert, nur vorn eine Zeile: mit 3D-Wasser (uWater3d = 1) verwirft er Punkte, die das
// Wasser ohnehin deckend übermalt (tiefer als 0,6 px unter dem Spiegel), statt dort Gras, Fels und Wasser umsonst zu rechnen.
const FS_GROUND3D = wetGround( // nasser Boden bei Regen (weather3d.js)
  FS_GROUND.replace('uniform float uSkirt;', 'uniform float uSkirt;\nuniform float uWater3d;').replace(
    'void main() {',
    'void main() {\n  if (uWater3d > 0.5 && uSkirt < 0.5 && vH < uWater - 0.6) discard;',
  ),
);

/** Himmel und Sonnenglanz je Lichtstimmung (render/mood.js; ohne Stimmung wie „day“); Nacht: dunkel wie der Boden, kein Glanz. */
const SKY = {
  day: { sky: [0.62, 0.74, 0.82], sun: [1.0, 0.97, 0.88] },
  morning: { sky: [0.70, 0.72, 0.76], sun: [1.0, 0.86, 0.64] },
  evening: { sky: [0.74, 0.66, 0.62], sun: [1.0, 0.72, 0.46] },
  night: { sky: [0.16, 0.20, 0.30], sun: [0.0, 0.0, 0.0] },
};
const SKY_WINTER = [0.72, 0.77, 0.82]; // bedeckter Winterhimmel (Tag), Glanz halb so stark

/** Kachelbare Datentextur (RGBA, Zweierpotenz) mit Mipmaps und Wiederholung. */
function repeatTex(data, n, aniso) {
  const t = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = aniso;
  t.needsUpdate = true;
  return t;
}

export class Ground3D {
  /** gl: THREE.WebGLRenderer (für die anisotrope Filterung). */
  constructor(gl) {
    const aniso = Math.min(4, gl.capabilities.getMaxAnisotropy());
    this.maxAniso = Math.min(8, gl.capabilities.getMaxAnisotropy());
    const shared = {
      uTex: { value: null },
      uNoise: { value: repeatTex(noiseTexture(), NOISE_N, 1) },
      uDetail: { value: repeatTex(groundDetail(), DETAIL_N, aniso) },
      uLight: { value: new THREE.Vector3(0, 0, 1) },
      uTime: { value: 0 },
      uWater: { value: RELIEF.water },
      uSnow: { value: 0 },
      uWater3d: { value: 1 }, // 1 = 3D-Wasser deckt, Boden darunter verwerfen (FS_GROUND3D)
      uWet: { value: 0 }, // Nässe 0 … 1 (weather3d.js wetGround); Blick, Himmel und Sonne teilt das Wasser (uEye, uSky, uSun)
      uEye: { value: new THREE.Vector3(0, 0, 1) },
      uSky: { value: new THREE.Vector3() },
      uSun: { value: new THREE.Vector3() },
    };
    const mat = (skirt) =>
      new THREE.ShaderMaterial({ uniforms: { ...shared, uSkirt: { value: skirt } }, vertexShader: VS, fragmentShader: FS_GROUND3D, side: THREE.DoubleSide }); // wie ground.js: ohne Weglassen von Rückseiten
    this.uniforms = shared; // gemeinsame Objekte: Werte gelten für Netz und Rand
    this.group = new THREE.Group();
    this.group.name = 'boden';
    this.mesh = new THREE.Mesh(this.buildGrid(), mat(0));
    this.skirt = new THREE.Mesh(this.buildSkirt(), mat(1));
    this.water = new THREE.Mesh(this.buildWater(), this.waterMaterial(shared));
    this.water.name = 'wasser';
    this.water.renderOrder = 1; // nach dem Boden (durchsichtig am Rand)
    for (const m of [this.mesh, this.skirt, this.water]) {
      m.frustumCulled = false; // Lage ändert sich mit dem Gelände; der Ausschnitt ist ohnehin fast immer auf der Karte
      m.matrixAutoUpdate = false;
      this.group.add(m);
    }
    this.relief = null;
    this.version = -1;
    this.texSrc = null;
  }

  /** Gitter FINE_N × FINE_N (Abstand STEP) mit Dreiecken wie ground.js; Höhen setzt uploadRelief. */
  buildGrid() {
    const n = FINE_N;
    const pos = new Float32Array(n * n * 3);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        pos[(j * n + i) * 3] = i * STEP;
        pos[(j * n + i) * 3 + 1] = j * STEP;
      }
    }
    const idx = new Uint32Array((n - 1) * (n - 1) * 6);
    let k = 0;
    for (let j = 0; j < n - 1; j++) {
      for (let i = 0; i < n - 1; i++) {
        const a = j * n + i;
        idx.set([a, a + 1, a + n, a + 1, a + n + 1, a + n], k);
        k += 6;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aH', new THREE.BufferAttribute(new Float32Array(n * n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    return geo;
  }

  /** Wassernetz: dieselben Ecken wie das Bodennetz (geteilte Attribute), eigene Dreiecksliste (waterIndex). */
  buildWater() {
    const g = this.mesh.geometry;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', g.attributes.position);
    geo.setAttribute('aH', g.attributes.aH);
    this.waterCap = 0;
    geo.setDrawRange(0, 0);
    return geo;
  }

  /** Wasser-Material: durchsichtig am Rand, Tiefentest gegen den Boden, zum Betrachter versetzt (kein Flimmern an der Uferlinie). */
  waterMaterial(shared) {
    const m = new THREE.ShaderMaterial({
      uniforms: { uNoise: shared.uNoise, uLight: shared.uLight, uTime: shared.uTime, uWater: shared.uWater, uSnow: shared.uSnow, uEye: shared.uEye, uSky: shared.uSky, uSun: shared.uSun },
      vertexShader: VS,
      fragmentShader: FS_WATER,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -4,
    });
    this.waterU = m.uniforms;
    return m;
  }

  /**
   * Dreiecke des Wassers: jedes Dreieck des Bodennetzes (gleiche Teilung wie buildGrid) mit einer Ecke unter dem Wasserspiegel.
   * Der Puffer wächst nur (Editor: neue Seen), sonst wird er überschrieben und der Zeichenbereich gekürzt.
   */
  waterIndex(F) {
    const n = FINE_N;
    const water = RELIEF.water;
    const geo = this.water.geometry;
    let idx = geo.index?.array ?? null;
    let k = 0;
    for (let pass = 0; pass < 2; pass++) {
      k = 0;
      for (let j = 0; j < n - 1; j++) {
        for (let i = 0; i < n - 1; i++) {
          const a = j * n + i;
          const wa = F[a] < water;
          const wb = F[a + 1] < water;
          const wc = F[a + n] < water;
          const wd = F[a + n + 1] < water;
          if (wa || wb || wc) {
            if (idx && k + 3 <= idx.length) idx.set([a, a + 1, a + n], k);
            k += 3;
          }
          if (wb || wd || wc) {
            if (idx && k + 3 <= idx.length) idx.set([a + 1, a + n + 1, a + n], k);
            k += 3;
          }
        }
      }
      if (idx && k <= idx.length) break;
      idx = new Uint32Array(Math.max(6 * 1024, Math.ceil(k * 1.5))); // zu klein: größer anlegen, zweiter Durchgang füllt ihn
      geo.setIndex(new THREE.BufferAttribute(idx, 1));
    }
    const I = geo.index;
    I.clearUpdateRanges();
    I.addUpdateRange(0, Math.max(1, k));
    I.needsUpdate = true;
    geo.setDrawRange(0, k);
    this.waterTris = k / 3;
  }

  /** Erdschnitt: vier Seiten, je Feinpunkt oben (sichtbare Geländehöhe) und unten (SKIRT_BOTTOM); Normale nach außen in aH.yz. */
  buildSkirt() {
    const n = FINE_N;
    this.sides = [(t) => [t * STEP, 0, 0, -1], (t) => [W, t * STEP, 1, 0], (t) => [W - t * STEP, W, 0, 1], (t) => [0, W - t * STEP, -1, 0]];
    const pos = new Float32Array(4 * n * 2 * 3);
    const idx = [];
    let v = 0;
    for (const side of this.sides) {
      for (let t = 0; t < n; t++) {
        const [x, y] = side(t);
        pos.set([x, y, 0, x, y, SKIRT_BOTTOM], v * 3);
        if (t < n - 1) idx.push(v, v + 2, v + 1, v + 1, v + 2, v + 3);
        v += 2;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aH', new THREE.BufferAttribute(new Float32Array(4 * n * 2 * 3), 3));
    geo.setIndex(idx);
    return geo;
  }

  /**
   * Höhen und Neigungen aus relief.fine übernehmen. Dasselbe Gelände mit relief.rows (Editor): nur diese Zeilen samt Rand.
   * relief.rows teilt sich der 3D-Boden mit ground.js (Nebel); wer es zuerst liest, löscht es, der andere lädt dann alles.
   */
  uploadRelief(relief) {
    const n = FINE_N;
    const F = relief.fine;
    const geo = this.mesh.geometry;
    const P = geo.attributes.position;
    const A = geo.attributes.aH;
    const part = relief === this.relief && relief.rows;
    const r0 = part ? Math.max(0, relief.rows[0] - 1) : 0;
    const r1 = part ? Math.min(n - 1, relief.rows[1] + 1) : n - 1;
    const water = RELIEF.water;
    for (let j = r0; j <= r1; j++) {
      const jm = Math.max(0, j - 1) * n;
      const jp = Math.min(n - 1, j + 1) * n;
      for (let i = 0; i < n; i++) {
        const k = j * n + i;
        const im = Math.max(0, i - 1);
        const ip = Math.min(n - 1, i + 1);
        P.array[k * 3 + 2] = Math.max(F[k], water);
        A.array[k * 3] = F[k];
        A.array[k * 3 + 1] = (F[j * n + ip] - F[j * n + im]) / ((ip - im) * STEP);
        A.array[k * 3 + 2] = (F[jp + i] - F[jm + i]) / (((jp - jm) / n) * STEP);
      }
    }
    for (const a of [P, A]) {
      a.clearUpdateRanges();
      a.addUpdateRange(r0 * n * 3, (r1 - r0 + 1) * n * 3);
      a.needsUpdate = true;
    }
    relief.rows = null;
    this.waterIndex(F);
    const SP = this.skirt.geometry.attributes.position;
    const SA = this.skirt.geometry.attributes.aH;
    let v = 0;
    for (const side of this.sides) {
      for (let t = 0; t < n; t++) {
        const [x, y, nx, ny] = side(t);
        const h = Math.max(water, relief.heightAt(x, y));
        SP.array[v * 3 + 2] = h;
        SA.array.set([h, nx, ny, SKIRT_BOTTOM, nx, ny], v * 3);
        v += 2;
      }
    }
    SP.needsUpdate = true;
    SA.needsUpdate = true;
    this.relief = relief;
    this.version = relief.version;
  }

  /** Bodenbild (Canvas) als Textur: ohne Farbraum-Umrechnung (wie ground.js), nicht gespiegelt, Mipmaps, anisotrop. */
  setTexture(src) {
    const old = this.uniforms.uTex.value;
    const t = new THREE.CanvasTexture(src);
    t.flipY = false;
    t.colorSpace = THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.anisotropy = this.maxAniso;
    this.uniforms.uTex.value = t;
    old?.dispose();
    this.texSrc = src;
  }

  /**
   * Vor dem Zeichnen: Gelände, Bodenbild, Licht (Weltvektor, z oben), Zeit (s) und Winter (Schnee 0/1) abgleichen; für das Wasser
   * die three-Kamera (Blickrichtung) und die Lichtstimmung (render/mood.js, null = ohne).
   */
  update(relief, tex, light, time, snow, cam3 = null, mood = null, wet = 0) {
    if (relief !== this.relief || relief.version !== this.version) this.uploadRelief(relief);
    if (tex !== this.texSrc) this.setTexture(tex);
    const u = this.uniforms;
    u.uLight.value.set(light[0], light[1], light[2]);
    u.uTime.value = time;
    u.uSnow.value = snow;
    u.uWet.value = wet;
    u.uWater3d.value = this.water.visible ? 1 : 0; // ausgeblendet (Prüfskript „vorher“): Boden malt sein Wasser selbst
    if (cam3) {
      // zum Betrachter: z-Achse der Kamera, aus three (X = x, Y = Höhe · HEIGHT_SCALE, Z = y) zurück in Weltachsen
      const e = cam3.matrixWorld.elements;
      this.waterU.uEye.value.set(e[8], e[10], e[9] / HEIGHT_SCALE).normalize();
    }
    const look = SKY[mood] ?? SKY.day;
    const winter = snow > 0 && mood !== 'night';
    this.waterU.uSky.value.fromArray(winter ? SKY_WINTER : look.sky);
    this.waterU.uSun.value.fromArray(look.sun).multiplyScalar(winter ? 0.5 : 1);
  }

  /** Zählung fürs Prüfskript: Dreiecke des Wassers (0 = kein Wasser im Netz). */
  waterStats() {
    return { tris: this.waterTris ?? 0, visible: this.water.visible };
  }

  dispose() {
    for (const m of [this.mesh, this.skirt, this.water]) { // geteilte Attribute gibt three nur einmal frei
      m.geometry.dispose();
      m.material.dispose();
    }
    this.uniforms.uTex.value?.dispose();
    this.uniforms.uNoise.value.dispose();
    this.uniforms.uDetail.value.dispose();
  }
}
