// Freie Kamera (Paket „Freie Kamera“, js/render/camera.js, js/render3d/camera3d.js): stufenlose Drehung und Neigung 30° … 60° nur in der
// Ansicht 3D. Prüft: klassisch und 3D ohne Zusatz rechnen bitgleich wie vorher (ROT, Neigung 30°), Bild ↔ Welt hin und zurück in
// 8 Drehwinkeln und 3 Neigungen, isoMatrix passt zu worldToScreenFlat, Höhen im Bild, Sichtstrahl gegen das Gelände, three-Kamera
// bildet camera.worldToScreen nach.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Camera, ROT, ISO_K, TILT0, TILT_MIN, TILT_MAX } from '../js/render/camera.js';
import { makeWorldRoot, makeIsoCamera, syncIsoCamera, projectWorld } from '../js/render3d/camera3d.js';

const W = 6000;
const H = 6000;
const DEG = Math.PI / 180;
const TILTS = [30 * DEG, 45 * DEG, 60 * DEG];
const YAWS = [0, 45, 90, 135, 180, 225, 270, 315].map((d) => d * DEG + 0.13); // 8 Drehwinkel, nicht genau auf Vierteln

function cam({ three = true, zoom = 1, relief = null } = {}) {
  const c = new Camera(W, H);
  c.resize(1280, 800);
  c.iso = true;
  c.three = three;
  c.zoom = zoom;
  c.x = 3000;
  c.y = 3000;
  c.relief = relief;
  return c;
}

/** Drehung auf den Winkel a (Bogenmaß) und Neigung t setzen. */
function setView(c, a, t) {
  c.rot = 0;
  c.turn = 0;
  c.turnBy(a);
  c.setTilt(t);
  c.x = 3000;
  c.y = 3000;
}

/** Bisherige Formel (vor „Freie Kamera“): Iso mit ROT und Neigung 30°. */
function oldFlat(c, x, y) {
  const dx = x - c.x;
  const dy = y - c.y;
  const [ra, rb, rc, rd] = ROT[c.rot];
  const rx = ra * dx + rb * dy;
  const ry = rc * dx + rd * dy;
  return { x: (rx - ry) * ISO_K * c.zoom + c.viewW / 2, y: (rx + ry) * ISO_K * 0.5 * c.zoom + c.viewH / 2 };
}

const PTS = [[3000, 3000], [3100, 2950], [2800, 3333.5], [3517, 3044], [2701.25, 2600]];

test('Klassisch und 3D ohne Zusatz rechnen bitgleich wie vorher; ohne three wirken turn und tilt nicht', () => {
  for (const three of [false, true]) {
    for (let rot = 0; rot < 4; rot++) {
      const c = cam({ three, zoom: 0.7 });
      c.rot = rot;
      if (!three) {
        c.turn = 0.3; // gespeicherte Werte der Ansicht 3D bleiben ohne three wirkungslos
        c.tilt = 50 * DEG;
      }
      for (const [x, y] of PTS) {
        const a = c.worldToScreenFlat(x, y);
        const b = oldFlat(c, x, y);
        assert.equal(a.x, b.x);
        assert.equal(a.y, b.y);
      }
      assert.equal(c.heightPx(10), 10 * c.zoom);
      assert.deepEqual(c.axes(), ROT[rot]);
    }
  }
});

test('Bild ↔ Welt hin und zurück in 8 Drehwinkeln und 3 Neigungen (Boden), isoMatrix passt dazu', () => {
  for (const a of YAWS) {
    for (const t of TILTS) {
      const c = cam({ zoom: 0.8 });
      setView(c, a, t);
      assert.ok(Math.abs(c.yaw() - (a % (2 * Math.PI))) < 1e-9, `Winkel ${c.yaw()} statt ${a}`);
      assert.ok(Math.abs(c.turn) <= Math.PI / 4 + 1e-12);
      const [ma, mb, mc, md] = c.isoMatrix();
      for (const [x, y] of PTS) {
        const s = c.worldToScreenFlat(x, y);
        const w = c.screenToWorldFlat(s.x, s.y);
        assert.ok(Math.hypot(w.x - x, w.y - y) < 1e-6, `zurück ${w.x},${w.y} statt ${x},${y}`);
        const dx = x - c.x;
        const dy = y - c.y;
        assert.ok(Math.abs(ma * dx + mc * dy + c.viewW / 2 - s.x) < 1e-6);
        assert.ok(Math.abs(mb * dx + md * dy + c.viewH / 2 - s.y) < 1e-6);
      }
      // Bodenstauchung und Höhe im Bild
      assert.ok(Math.abs(c.squash() - Math.sin(t)) < 1e-12);
      assert.ok(Math.abs(c.heightPx(30) - (30 * 0.8 * Math.cos(t)) / Math.cos(TILT0)) < 1e-9);
    }
  }
});

test('Drehen über die Vierteldrehung ist stetig, die Bildmitte bleibt, Neigung bleibt in 30° … 60°', () => {
  const c = cam();
  setView(c, 44.9 * DEG, 40 * DEG);
  const a = c.worldToScreenFlat(3200, 3100);
  c.turnBy(0.2 * DEG); // 45,1°: rot springt auf 1, turn auf −44,9°
  assert.equal(c.rot, 1);
  const b = c.worldToScreenFlat(3200, 3100);
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 1.5, `Sprung ${Math.hypot(a.x - b.x, a.y - b.y)} px`);
  const mid = c.screenToWorldFlat(640, 400);
  c.turnBy(1.3);
  const mid2 = c.screenToWorldFlat(640, 400);
  assert.ok(Math.hypot(mid.x - mid2.x, mid.y - mid2.y) < 1e-6);
  c.setTilt(10 * DEG);
  assert.equal(c.tilt, TILT_MIN);
  c.setTilt(80 * DEG);
  assert.equal(c.tilt, TILT_MAX);
  c.setTilt(30 * DEG);
  assert.equal(c.tilt, TILT0); // genau 30°: wieder die bitgleiche Rechnung
});

/** Gelände: Hügel 90 px hoch, Radius 260, sonst flach; dazu eine Mulde (−15). */
function hill() {
  const at = (x, y) => 90 * Math.exp(-((x - 3150) ** 2 + (y - 3050) ** 2) / 260 ** 2) - 15 * Math.exp(-((x - 2700) ** 2 + (y - 3300) ** 2) / 120 ** 2);
  return { displayAt: at, hi: 90, lo: -15 };
}

test('Sichtstrahl gegen das Gelände: der Klick trifft die vorderste Fläche unter dem Bildpunkt', () => {
  for (const a of YAWS) {
    for (const t of TILTS) {
      const c = cam({ relief: hill() });
      setView(c, a, t);
      for (let i = 0; i < 60; i++) {
        const sx = 200 + ((i * 97) % 900);
        const sy = 150 + ((i * 61) % 500);
        const w = c.screenToWorld(sx, sy);
        const s = c.worldToScreen(w.x, w.y);
        assert.ok(Math.hypot(s.x - sx, s.y - sy) < 0.5, `Drehung ${(a / DEG).toFixed(0)}°, Neigung ${(t / DEG).toFixed(0)}°: ${s.x},${s.y} statt ${sx},${sy}`);
        // vorderste Fläche: zwischen Treffer und Betrachter liegt kein Gelände über dem Strahl
        const p0 = c.screenToWorldFlat(sx, sy);
        const p1 = c.screenToWorldFlat(sx, sy + c.heightPx(1));
        const hw = c.relief.displayAt(w.x, w.y);
        for (let h = hw + 2; h < 95; h += 2) {
          assert.ok(c.relief.displayAt(p0.x + h * (p1.x - p0.x), p0.y + h * (p1.y - p0.y)) < h + 0.5, `verdeckter Treffer bei ${sx},${sy}`);
        }
      }
      // Punkte vorn am Hang und in der Ebene: hin und zurück
      for (const [x, y] of [[2900, 2900], [3400, 3300], [3150, 3050]]) {
        const s = c.worldToScreen(x, y);
        const w = c.screenToWorld(s.x, s.y);
        const hidden = Math.hypot(w.x - x, w.y - y) > 1;
        if (hidden) {
          const back = c.worldToScreen(w.x, w.y); // dann nur, weil davor Gelände liegt: gleiche Bildstelle
          assert.ok(Math.hypot(back.x - s.x, back.y - s.y) < 0.5);
        }
      }
    }
  }
});

test('three-Kamera bildet camera.worldToScreen nach (8 Drehwinkel × 3 Neigungen, mit Höhe)', () => {
  const root = makeWorldRoot();
  const cam3 = makeIsoCamera();
  for (const a of YAWS) {
    for (const t of TILTS) {
      const c = cam({ zoom: 0.9 });
      setView(c, a, t);
      syncIsoCamera(cam3, c);
      for (const [x, y] of PTS) {
        for (const h of [0, 40]) {
          const p = projectWorld(root, cam3, c, x, y, h);
          const q = c.worldToScreenFlat(x, y);
          q.y -= c.heightPx(h);
          assert.ok(Math.hypot(p.x - q.x, p.y - q.y) < 0.01, `Drehung ${(a / DEG).toFixed(0)}°, Neigung ${(t / DEG).toFixed(0)}°, h ${h}: ${p.x},${p.y} statt ${q.x},${q.y}`);
        }
      }
    }
  }
});
