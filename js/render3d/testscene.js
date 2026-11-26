// Prüfszene des 3D-Gerüsts (Plan „3D mit three.js“): Würfel an bekannten Weltpunkten (Ecken der Karte, Mitte, eigene Hauptstadt),
// jeder mit dem Fuß auf der Geländehöhe (relief.displayAt). tools/smoke-3d.mjs vergleicht ihre Bildlage mit camera.worldToScreen.
// Nur mit ?three=1&cubes=1 sichtbar; fällt weg, sobald echte Inhalte (Boden, Einheiten) in three stehen.
import * as THREE from '../vendor/three/three.module.min.js';

const PAD = 80; // Abstand der Eckwürfel vom Kartenrand (Welt-px)
const SIZE = 24; // Kantenlänge (Welt-px)

/** Prüfpunkte { name, x, y, color } für die Karte von game; Hauptstadt = Gebäude mit main des Teams team, falls vorhanden. */
export function probePoints(game, team) {
  const W = game.map.width;
  const H = game.map.height;
  const pts = [
    { name: 'Ecke oben', x: PAD, y: PAD, color: 0xe04040 },
    { name: 'Ecke rechts', x: W - PAD, y: PAD, color: 0xe0c040 },
    { name: 'Ecke unten', x: W - PAD, y: H - PAD, color: 0x40c040 },
    { name: 'Ecke links', x: PAD, y: H - PAD, color: 0x4080e0 },
    { name: 'Mitte', x: W / 2, y: H / 2, color: 0xffffff },
  ];
  const hq = game.buildings.find((b) => b.main && b.team === team);
  if (hq) pts.push({ name: 'Hauptstadt', x: hq.x, y: hq.y, color: 0xc040c0 });
  return pts;
}

/** Würfelgruppe in Weltkoordinaten (Kind der Wurzelgruppe); heightAt(x, y) liefert die Geländehöhe (0 ohne Relief). */
export function buildTestCubes(points, heightAt) {
  const g = new THREE.Group();
  g.name = 'prüfwürfel';
  const geo = new THREE.BoxGeometry(SIZE, SIZE, SIZE).translate(0, 0, SIZE / 2); // Fuß auf h = 0 (z = Höhe)
  for (const p of points) {
    p.h = heightAt(p.x, p.y);
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: p.color }));
    m.position.set(p.x, p.y, p.h);
    g.add(m);
  }
  return g;
}
