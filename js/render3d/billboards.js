// Billboard-Brücke (Plan „3D mit three.js“, Paket „Billboard-Brücke“): alles, was noch nicht als 3D-Modell steht (Gebäude, Props,
// Bäume, Einheiten …), kommt als Bild aus spritecache.js in die three-Szene. Abgriff: setBlitSink fängt jedes blit() des Durchlaufs
// „Objekte“ ab; das Bild wandert einmal in einen Atlas (Texturseiten), das Zielrechteck wird mit der ctx-Transformation in
// Gerätepixel umgerechnet (auch schräg, z. B. Bodenbilder mit Iso-Matrix) und bekommt die Tiefe des Fußpunkts seines Objekts.
// Alle Vierecke eines Bildes sind eine Geometrie, ein Draw-Call; die Reihenfolge der Ecken ist die Malreihenfolge von heute, so dass
// sich Billboards untereinander genau wie bisher überdecken. Gegen echte 3D-Körper entscheidet der Tiefenpuffer (Fußpunkt-Tiefe).
// Speicher: höchstens PAGES Seiten zu PAGE²; ist alles voll, wird der Atlas geleert und füllt sich im nächsten Bild neu (kein Wachstum).
// Bilder größer als eine Seite malt blit weiter selbst in 2D.
import * as THREE from '../vendor/three/three.module.min.js';

const PAGE = 2048; // Kantenlänge einer Atlasseite (Gerätepixel)
const PAGES = 4; // höchstens so viele Seiten (je 16 MB Grafikspeicher)
const PAD = 1; // Rand je Bild im Atlas (kein Übersprechen beim Filtern)
const MAX_QUADS = 20000; // Vierecke je Bild; darüber malt blit selbst

const VS = `
attribute float aPage;
attribute float aAlpha;
varying vec2 vUv;
varying float vPage;
varying float vAlpha;
void main() {
  vUv = uv;
  vPage = aPage;
  vAlpha = aAlpha;
  gl_Position = vec4(position, 1.0); // Lage schon in Clip-Koordinaten (Bildpunkt und Tiefe des Fußpunkts)
}`;

const FS = `
uniform sampler2D uP0;
uniform sampler2D uP1;
uniform sampler2D uP2;
uniform sampler2D uP3;
varying vec2 vUv;
varying float vPage;
varying float vAlpha;
void main() {
  vec4 c = vPage < 0.5 ? texture2D(uP0, vUv) : vPage < 1.5 ? texture2D(uP1, vUv) : vPage < 2.5 ? texture2D(uP2, vUv) : texture2D(uP3, vUv);
  if (c.a * vAlpha < 0.004) discard;
  gl_FragColor = c * vAlpha; // Atlas vormultipliert, Mischung ONE, ONE_MINUS_SRC_ALPHA
}`;

let zeros = null; // gemeinsamer leerer Inhalt der Seiten (nur zum Anlegen)

export class Billboards {
  constructor(gl) {
    this.gl = gl;
    this.pages = [];
    this.slots = new WeakMap(); // Bild (Canvas) → { page, u0, v0, u1, v1 }
    this.shelf = null; // Fülllage der aktuellen Seite { page, x, y, h }
    this.proxy = new THREE.Texture(); // Quelle für copyTextureToTexture (nie selbst hochgeladen)
    this.resets = 0; // wie oft der Atlas voll war (Messung)
    const uniforms = {};
    for (let i = 0; i < PAGES; i++) uniforms[`uP${i}`] = { value: null };
    this.material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VS,
      fragmentShader: FS,
      transparent: true,
      premultipliedAlpha: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide, // Ecken im Bild im Uhrzeigersinn: ohne Weglassen von Rückseiten
    });
    this.pos = new Float32Array(MAX_QUADS * 4 * 3);
    this.uv = new Float32Array(MAX_QUADS * 4 * 2);
    this.page = new Float32Array(MAX_QUADS * 4);
    this.alpha = new Float32Array(MAX_QUADS * 4);
    const idx = new Uint32Array(MAX_QUADS * 6);
    for (let q = 0; q < MAX_QUADS; q++) idx.set([q * 4, q * 4 + 1, q * 4 + 2, q * 4, q * 4 + 2, q * 4 + 3], q * 6);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aPage', new THREE.BufferAttribute(this.page, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10; // nach den 3D-Körpern (undurchsichtig), damit deren Tiefe schon steht
    this.n = 0; // Vierecke in diesem Bild
    this.depth = 0; // Clip-Tiefe des aktuellen Objekts (begin/item)
    this.cw = 1; // Leinwandgröße in Gerätepixeln
    this.ch = 1;
  }

  /** Neue Seite anlegen (leer, vormultipliert, ohne Spiegelung, ohne Mipmaps). */
  addPage() {
    zeros ??= new Uint8Array(PAGE * PAGE * 4);
    const t = new THREE.DataTexture(zeros, PAGE, PAGE, THREE.RGBAFormat);
    t.premultiplyAlpha = true;
    t.flipY = false;
    t.magFilter = t.minFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
    t.colorSpace = THREE.NoColorSpace;
    t.needsUpdate = true;
    this.gl.initTexture(t);
    this.material.uniforms[`uP${this.pages.length}`].value = t;
    this.pages.push(t);
    return this.pages.length - 1;
  }

  /** Atlas leeren: alle Plätze frei, Seiten bleiben angelegt (Inhalte werden überschrieben). */
  reset() {
    this.slots = new WeakMap();
    this.shelf = null;
    this.resets++;
  }

  /** Platz für ein Bild w × h (Regal-Packung); null, wenn es nicht auf eine Seite passt. */
  place(w, h) {
    const W = w + PAD * 2;
    const H = h + PAD * 2;
    if (W > PAGE || H > PAGE) return null;
    let s = this.shelf;
    if (s && s.x + W > PAGE) s = { page: s.page, x: 0, y: s.y + s.h, h: 0 }; // neue Reihe
    if (!s || s.y + H > PAGE) {
      const page = s ? s.page + 1 : 0;
      if (page >= PAGES) return 'full';
      if (page >= this.pages.length) this.addPage();
      s = { page, x: 0, y: 0, h: 0 };
    }
    const at = { page: s.page, x: s.x + PAD, y: s.y + PAD };
    s.x += W;
    s.h = Math.max(s.h, H);
    this.shelf = s;
    return at;
  }

  /** Atlasplatz eines Bildes (einmal hochladen); null, wenn es nicht passt. */
  slotOf(img) {
    let sl = this.slots.get(img);
    if (sl) return sl;
    let at = this.place(img.width, img.height);
    if (at === 'full') {
      this.reset();
      this.full = true; // in diesem Bild nicht noch einmal: Vierecke davor zeigen schon auf alte Plätze
      return null;
    }
    if (!at) return null;
    this.proxy.image = img;
    this.gl.copyTextureToTexture(this.proxy, this.pages[at.page], null, new THREE.Vector2(at.x, at.y));
    sl = { page: at.page, u0: at.x / PAGE, v0: at.y / PAGE, u1: (at.x + img.width) / PAGE, v1: (at.y + img.height) / PAGE };
    this.slots.set(img, sl);
    return sl;
  }

  /** Bildanfang: Leinwand in Gerätepixeln, noch keine Vierecke. */
  begin(cw, ch) {
    this.cw = cw;
    this.ch = ch;
    this.n = 0;
    this.full = false;
  }

  /** Tiefe (Clip-z, −1 nah … 1 fern) für die folgenden Bilder: Fußpunkt des Objekts, das gerade gemalt wird. */
  item(depth) {
    this.depth = depth;
  }

  /** Abgriff für blit (setBlitSink): Viereck aufnehmen; false = blit malt selbst (zu groß, Atlas voll, zu viele Vierecke). */
  take(ctx, img, x, y, w, h) {
    if (this.full || this.n >= MAX_QUADS || !img.width) return false;
    const sl = this.slotOf(img);
    if (!sl) return false;
    const m = ctx.getTransform();
    const sx = 2 / this.cw;
    const sy = 2 / this.ch;
    const q = this.n++;
    const P = this.pos;
    const corner = (i, px, py) => {
      const dx = m.a * px + m.c * py + m.e;
      const dy = m.b * px + m.d * py + m.f;
      P[(q * 4 + i) * 3] = dx * sx - 1;
      P[(q * 4 + i) * 3 + 1] = 1 - dy * sy;
      P[(q * 4 + i) * 3 + 2] = this.depth;
    };
    corner(0, x, y);
    corner(1, x + w, y);
    corner(2, x + w, y + h);
    corner(3, x, y + h);
    this.uv.set([sl.u0, sl.v0, sl.u1, sl.v0, sl.u1, sl.v1, sl.u0, sl.v1], q * 8);
    this.page.fill(sl.page, q * 4, q * 4 + 4);
    this.alpha.fill(ctx.globalAlpha, q * 4, q * 4 + 4);
    return true;
  }

  /** Bildende: Puffer für die n Vierecke hochladen. */
  end() {
    const g = this.mesh.geometry;
    const n = this.n;
    for (const [name, k] of [['position', 3], ['uv', 2], ['aPage', 1], ['aAlpha', 1]]) {
      const a = g.attributes[name];
      a.clearUpdateRanges();
      a.addUpdateRange(0, n * 4 * k);
      a.needsUpdate = true;
    }
    g.setDrawRange(0, n * 6);
    this.mesh.visible = n > 0;
  }

  /** Messung: Seiten, Vierecke, Leerungen. */
  stats() {
    return { pages: this.pages.length, quads: this.n, resets: this.resets };
  }

  dispose() {
    for (const t of this.pages) t.dispose();
    this.material.dispose();
    this.mesh.geometry.dispose();
  }
}
