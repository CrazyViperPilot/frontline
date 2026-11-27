// Kamera (js/render/camera.js): In 2D darf der Kartenrand bis an die Leisten des HUD rücken (insetTop, insetBottom), damit der Streifen
// hinter Minimap, Infofeld und Befehlskarte bzw. hinter der Kopfleiste erreichbar bleibt (dort bauen, antippen).
import test from 'node:test';
import assert from 'node:assert/strict';
import { Camera } from '../js/render/camera.js';

const W = 4000;
const H = 3000;

function cam(insetTop, insetBottom, zoom = 1) {
  const c = new Camera(W, H);
  c.resize(1180, 820);
  c.zoom = zoom;
  c.insetTop = insetTop;
  c.insetBottom = insetBottom;
  return c;
}

test('2D: ganz nach unten geschoben liegt der untere Kartenrand genau über der Leiste unten', () => {
  for (const zoom of [0.5, 1, 1.6]) {
    const c = cam(68, 202, zoom);
    c.pan(0, -1e6); // Inhalt nach oben: Kamera ganz nach unten
    const edge = c.worldToScreen(c.x, H).y;
    assert.ok(Math.abs(edge - (c.viewH - 202)) < 0.01, `Zoom ${zoom}: Rand bei ${edge}`);
    c.pan(0, 1e6); // ganz nach oben: oberer Rand unter der Kopfleiste
    assert.ok(Math.abs(c.worldToScreen(c.x, 0).y - 68) < 0.01, `Zoom ${zoom}: oberer Rand`);
  }
});

test('2D: ohne Leisten wie bisher (Rand am Bildschirmrand); links und rechts unverändert', () => {
  const c = cam(0, 0);
  c.pan(-1e6, -1e6);
  assert.ok(Math.abs(c.worldToScreen(W, H).y - c.viewH) < 0.01);
  assert.ok(Math.abs(c.worldToScreen(W, H).x - c.viewW) < 0.01);
});

test('2D: Karte kleiner als die freie Fläche steht in deren Mitte', () => {
  const c = cam(68, 202, 0.1); // Karte 300 px hoch, freie Fläche 550 px
  c.clamp();
  const top = c.worldToScreen(0, 0).y;
  const bottom = c.worldToScreen(0, H).y;
  assert.ok(Math.abs(top - 68 - (c.viewH - 202 - bottom)) < 0.01, `oben ${top}, unten ${bottom}`);
});
