// 3D-Einheiten (Plan „3D mit three.js“, Paket „3D-Einheiten“): Fahrzeuge, Soldaten und Luftfahrzeuge als three-Meshes aus denselben
// Körperlisten wie die gemalten Bilder (unitpaint.js unitModel, Umsetzung solids3d.js). Je Modellvariante (Typ, Team, Haltung,
// Raketen, Fahrwerk, Tarnung) eine Geometrie, je Einheit ein Mesh aus einem Vorrat; Wanne und Turm getrennt (der Turm folgt dem Ziel),
// Drehung stufenlos (u.angle statt 16 Richtungen). Rotoren und Nachbrenner malt weiter unitpaint.js (drawUnitIso mit body = false).
// Licht wie der Maler (units/painter.js): Helligkeit 0,56 + 0,44 · max(0, n · L), am Boden etwas dunkler, Farben in sRGB ohne
// Umrechnung. Lichtrichtung seit „Licht und Schatten“ die Sonne (Renderer.lightVec, wie Boden und Schattenkarte, sun3d.js), damit
// helle Seite und Schatten zusammenpassen. Fahrzeuge und Luftfahrzeuge werfen Schatten (Ebene CAST); Soldaten nicht: in der
// Schattenkarte (1 bis 3 Welt-px je Texel) sind sie zu dünn, sie behalten den gemalten Fußschatten (show liefert dann 'painted'). Größe wie in Iso (ISO_SCALE 1,35).
import * as THREE from '../vendor/three/three.module.min.js';
import { unitModel, unitLook } from '../render/unitpaint.js';
import { modelGeometry } from './solids3d.js';
import { HEIGHT_SCALE } from './camera3d.js';
import { CAST } from './sun3d.js';

const ISO_SCALE = 1.35; // wie unitpaint.js: Modelle in Iso etwas größer als ihre Grundfläche
const KEEP_FRAMES = 120; // so viele Bilder ungenutzt: Mesh fällt aus dem Vorrat

const VS = `
uniform float uS;
varying vec3 vN;
varying vec3 vCol;
varying float vZ;
void main() {
  // Normale: Modell → three mit modelMatrix (Wurzel X = x, Y = S·z, Z = y, Drehung, Maßstab), zurück in Spielachsen (x, y, z)
  vec3 r = mat3(modelMatrix) * normal;
  vN = normalize(vec3(r.x, r.z, r.y / uS));
  vCol = color;
  vZ = position.z;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
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
  float k = (0.56 + 0.44 * d) * ao;
  gl_FragColor = vec4(min(toSrgb(vCol) * k, vec3(1.0)), uAlpha);
}`;

const keyOfLook = (u, look) => `${u.type}|${u.team}|${look.frame ?? ''}|${look.missiles ?? ''}|${look.gear ? 1 : 0}|${look.camo ?? ''}${look.prone ? 'p' : ''}`;

export class Units3D {
  constructor() {
    this.uLight = { value: new THREE.Vector3(0, 0, 1) };
    this.material = new THREE.ShaderMaterial({
      uniforms: { uLight: this.uLight, uS: { value: HEIGHT_SCALE }, uAlpha: { value: 1 } },
      vertexShader: VS,
      fragmentShader: FS,
      vertexColors: true,
    });
    this.material.shadowSide = THREE.DoubleSide; // auch dünne, einseitige Teile (Bleche, Rotorblätter) werfen Schatten
    this.group = new THREE.Group();
    this.group.name = 'einheiten';
    this.pool = new Map(); // Einheit-id → { hull, turret, key, seen }
    this.frame = 0;
    this.count = 0; // Einheiten in 3D in diesem Bild
  }

  /** Bildanfang: Lichtrichtung (Welt, z oben, zur Sonne: Renderer.lightVec). */
  begin(light) {
    this.uLight.value.set(light[0], light[1], light[2]).normalize();
    this.frame++;
    this.count = 0;
  }

  /**
   * Einheit u in die Szene: Bodenhöhe h (Welt-px), lift über dem Boden, aim = Weltwinkel zum Ziel oder null, now (ms) für die Haltung.
   * false = kein Modell (dann malt der Renderer wie bisher), 'painted' = Mesh ohne eigenen Schatten (Soldaten), sonst true.
   */
  show(u, h, lift, aim, now) {
    const look = unitLook(u, now);
    const m = unitModel(u.type, u.team, look);
    if (!m) return false;
    const key = keyOfLook(u, look);
    let e = this.pool.get(u.id);
    if (!e) {
      const hull = new THREE.Mesh(undefined, this.material);
      hull.matrixAutoUpdate = true;
      hull.frustumCulled = false;
      this.group.add(hull);
      e = { hull, turret: null, key: '' };
      this.pool.set(u.id, e);
    }
    if (e.key !== key) {
      e.hull.geometry = modelGeometry(`u|${key}`, m.S);
      if (m.turret) {
        if (!e.turret) {
          e.turret = new THREE.Mesh(undefined, this.material);
          e.turret.frustumCulled = false;
          e.hull.add(e.turret);
        }
        e.turret.geometry = modelGeometry(`t|${key}`, m.turret.S);
        e.turret.position.set(m.turret.x, 0, 0);
        e.turret.visible = true;
      } else if (e.turret) e.turret.visible = false;
      e.key = key;
      for (const o of [e.hull, e.turret]) {
        if (!o) continue;
        o.castShadow = !m.inf;
        if (m.inf) o.layers.disable(CAST);
        else o.layers.enable(CAST);
      }
    }
    // Soldaten blicken zum Ziel, Fahrzeuge in Fahrtrichtung (wie drawUnitIso)
    const face = m.inf && aim !== null && aim !== undefined ? aim : u.angle ?? 0;
    e.hull.position.set(u.x, u.y, h + lift);
    e.hull.rotation.set(0, 0, face);
    e.hull.scale.setScalar(ISO_SCALE);
    if (e.turret?.visible) e.turret.rotation.set(0, 0, (aim ?? face) - face);
    e.hull.visible = true;
    e.seen = this.frame;
    this.count++;
    return m.inf ? 'painted' : true;
  }

  /** Bildende: nicht gezeigte Einheiten verstecken, lange ungenutzte aus dem Vorrat nehmen (Geometrien bleiben im Zwischenspeicher). */
  end() {
    for (const [id, e] of this.pool) {
      if (e.seen === this.frame) continue;
      e.hull.visible = false;
      if (this.frame - (e.seen ?? 0) > KEEP_FRAMES) {
        this.group.remove(e.hull);
        this.pool.delete(id);
      }
    }
  }

  dispose() {
    this.material.dispose();
  }
}
