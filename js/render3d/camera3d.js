// Iso-Kamera für three.js (Plan „3D mit three.js“, Paket „3D-Gerüst“): bildet die Iso-Projektion von Camera (render/camera.js)
// Pixel für Pixel nach. Camera bleibt die einzige Wahrheit; die three-Kamera wird jedes Bild daraus gesetzt.
//
// Achsen: Kinder der Wurzelgruppe (makeWorldRoot) liegen in Weltkoordinaten (x, y, h) = (Welt x, Welt y, Höhe in Welt-px nach oben).
// Die Wurzelgruppe bildet sie auf three ab: X = x, Y = h · HEIGHT_SCALE (oben), Z = y. Diese Abbildung spiegelt (Determinante < 0);
// three dreht dafür den Umlaufsinn der Dreiecke selbst um (frontFaceCW), Rückseiten bleiben richtig weggelassen.
// Die Kamera ist orthografisch, schaut 30° nach unten und blickt entlang −depthDir (depthDir zeigt zum Betrachter, wie camera.depthDir).
// Höhen werden um 1/cos 30° gestreckt, damit h · zoom Pixel anhebt wie camera.lift (relief.displayAt).
import * as THREE from '../vendor/three/three.module.min.js';
import { ROT } from '../render/camera.js';

const TILT = Math.PI / 6; // Neigung der Iso-Ansicht: Blick 30° unter die Waagrechte (Boden in der Tiefe halb so hoch)
/** Höhenfaktor der Wurzelgruppe: 1/cos 30° ≈ 1,1547, damit eine Höhe h im Bild h · zoom Pixel hebt. */
export const HEIGHT_SCALE = 1 / Math.cos(TILT);
const DIST = 20000; // Abstand der Kamera vom Kartenpunkt der Bildmitte (Welt-px); Tiefenbereich ±DIST um diesen Punkt

/** Wurzelgruppe: Kinder in Weltkoordinaten (x, y, h), siehe Kopf der Datei. */
export function makeWorldRoot() {
  const g = new THREE.Group();
  g.name = 'welt';
  g.matrixAutoUpdate = false;
  g.matrix.set(1, 0, 0, 0, 0, 0, HEIGHT_SCALE, 0, 0, 1, 0, 0, 0, 0, 0, 1);
  g.matrixWorldNeedsUpdate = true;
  return g;
}

/** Orthografische three-Kamera; syncIsoCamera setzt sie jedes Bild. */
export function makeIsoCamera() {
  return new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 2 * DIST);
}

const _r = new THREE.Vector3();
const _u = new THREE.Vector3();
const _b = new THREE.Vector3();
const _m = new THREE.Matrix4();

/**
 * three-Kamera aus Camera setzen: Mitte (x, y) auf Höhe 0, Zoom, Drehung (ROT, 90°-Schritte) und Bildgröße in CSS-Pixeln
 * (viewW, viewH). Die Pixeldichte setzt der WebGLRenderer (setPixelRatio), insetTop/insetBottom wirken nur auf centerOn.
 */
export function syncIsoCamera(cam3, cam) {
  const [ra, rb, rc, rd] = ROT[cam.rot];
  const k = Math.SQRT1_2;
  // Bodenrichtungen in Weltkoordinaten (Einheitsvektoren): rechts im Bild und zum Betrachter (Bild nach unten, depthDir)
  const rx = (ra - rc) * k;
  const ry = (rb - rd) * k;
  const tx = (ra + rc) * k;
  const ty = (rb + rd) * k;
  const c = Math.cos(TILT);
  const s = Math.sin(TILT);
  _r.set(rx, 0, ry); // three: X = x, Z = y
  _b.set(c * tx, s, c * ty); // zum Betrachter: Bodenrichtung zum Betrachter und nach oben
  _u.crossVectors(_b, _r); // rechts × oben = zum Betrachter (rechtshändig)
  _m.makeBasis(_r, _u, _b);
  cam3.quaternion.setFromRotationMatrix(_m);
  cam3.position.set(cam.x + _b.x * DIST, _b.y * DIST, cam.y + _b.z * DIST);
  const hw = cam.viewW / (2 * cam.zoom);
  const hh = cam.viewH / (2 * cam.zoom);
  cam3.left = -hw;
  cam3.right = hw;
  cam3.top = hh;
  cam3.bottom = -hh;
  cam3.near = 1;
  cam3.far = 2 * DIST;
  cam3.updateProjectionMatrix();
  cam3.updateMatrixWorld(true);
}

const _p = new THREE.Vector3();

/** Bildpunkt (CSS-Pixel) eines Weltpunkts (x, y, h) über die three-Kamera; Prüfung gegen camera.worldToScreen. */
export function projectWorld(root, cam3, cam, x, y, h) {
  root.updateMatrixWorld();
  _p.set(x, y, h).applyMatrix4(root.matrixWorld).project(cam3);
  return { x: ((_p.x + 1) / 2) * cam.viewW, y: ((1 - _p.y) / 2) * cam.viewH };
}
