// Minimap isometrisch (Paket „Minimap isometrisch“, js/render/minimap.js): in der Iso-Ansicht wie die Kamera ausgerichtet.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Minimap } from '../js/render/minimap.js';
import { Camera } from '../js/render/camera.js';
import { BALANCE } from '../js/data/balance.js';

const W = BALANCE.map.width;
const H = BALANCE.map.height;

/** Minimap ohne Canvas (nur die Rechnung): Box w × h CSS-Pixel. */
function mini(camera, w, h) {
  const m = Object.create(Minimap.prototype);
  Object.assign(m, { camera, cssW: w, cssH: h });
  return m;
}

const apply = ([a, b, c, d, e, f], x, y) => ({ x: a * x + c * y + e, y: b * x + d * y + f });

test('Minimap 2D: genordet über die ganze Box, toWorld ist die Umkehrung', () => {
  const cam = new Camera(W, H);
  cam.iso = false;
  const m = mini(cam, 178, 178);
  const p = apply(m.view(), W / 4, H / 2);
  assert.ok(Math.abs(p.x - 178 / 4) < 1e-9 && Math.abs(p.y - 89) < 1e-9);
  const w = m.toWorld(p.x, p.y);
  assert.ok(Math.abs(w.x - W / 4) < 1e-6 && Math.abs(w.y - H / 2) < 1e-6);
});

test('Minimap isometrisch: in allen vier Drehungen zeigen Bildschirm und Minimap gleich (rechts = rechts, unten = unten), Raute in der Box', () => {
  for (let rot = 0; rot < 4; rot++) {
    const cam = new Camera(W, H);
    cam.iso = true;
    cam.rot = rot;
    cam.viewW = 1280;
    cam.viewH = 720;
    cam.x = W / 2;
    cam.y = H / 2;
    const m = mini(cam, 228, 114);
    const M = m.view();
    // zwei Weltpunkte: Richtung auf dem Bildschirm = Richtung auf der Minimap (gleiche Richtung, positiver Faktor)
    for (const [dx, dy] of [[500, 0], [0, 500], [300, -200]]) {
      const s0 = cam.worldToScreenFlat(W / 2, H / 2);
      const s1 = cam.worldToScreenFlat(W / 2 + dx, H / 2 + dy);
      const m0 = apply(M, W / 2, H / 2);
      const m1 = apply(M, W / 2 + dx, H / 2 + dy);
      const sv = [s1.x - s0.x, s1.y - s0.y];
      const mv = [m1.x - m0.x, m1.y - m0.y];
      const cross = sv[0] * mv[1] - sv[1] * mv[0];
      const dot = sv[0] * mv[0] + sv[1] * mv[1];
      assert.ok(Math.abs(cross) < 1e-6 * Math.hypot(...sv) * Math.hypot(...mv) && dot > 0, `Drehung ${rot}: Richtung (${dx}, ${dy}) gleich`);
    }
    // alle Kartenecken liegen in der Box, die Raute füllt sie in einer Richtung ganz
    const pts = [[0, 0], [W, 0], [W, H], [0, H]].map(([x, y]) => apply(M, x, y));
    for (const p of pts) assert.ok(p.x >= -1e-6 && p.x <= 228 + 1e-6 && p.y >= -1e-6 && p.y <= 114 + 1e-6, `Drehung ${rot}: Ecke in der Box`);
    const wx = Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x));
    const hy = Math.max(...pts.map((p) => p.y)) - Math.min(...pts.map((p) => p.y));
    assert.ok(Math.abs(wx - 228) < 1e-6 || Math.abs(hy - 114) < 1e-6, 'eingepasst');
    // Tippen: toWorld trifft den Weltpunkt unter dem Finger
    const p = apply(M, 3000, 7000);
    const w = m.toWorld(p.x, p.y);
    assert.ok(Math.abs(w.x - 3000) < 1e-6 && Math.abs(w.y - 7000) < 1e-6, `Drehung ${rot}: toWorld`);
  }
});
