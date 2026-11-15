// Gleise der Stadt und Güterbahnhof (Paket „Import“, Darstellung): Gleisstücke je Zellenform (gerade, Kurve, Ende mit Prellbock,
// Kreuzung, Kartenrand, Anschluss an den Güterbahnhof), Bild des Güterbahnhofs für jede Stufe und jede Seite mit Gleis, und ohne
// Canvas zeichnen die Gleisfunktionen nichts. Nur Darstellung: die Regeln stehen in test/import.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/game/game.js';
import { rebuildList } from '../js/game/city/state.js';
import { KIND_ID } from '../js/data/citykinds.js';
import { cityRailPieces, stationLinks } from '../js/render/citylayer.js';
import { bigPlan, drawBigGround, drawBigTop, stationBit } from '../js/render/bigbuild.js';
import { drawCityRails } from '../js/render/ways.js';

const RL = KIND_ID.rail;
const ST = KIND_ID.station;

/** Stadt von Team 0 mit leerem Raster; Gleise und Güterbahnhof werden direkt gesetzt (nur Zellarten, wie der Spielstand sie hält). */
function city() {
  const g = new Game({ seed: 3, city: true });
  const c = g.city[0];
  const cell = (q, r) => r * c.cols + q;
  const put = (q, r, kind) => (c.kind[cell(q, r)] = kind);
  const clear = () => c.kind.fill(0);
  return { g, c, cell, put, clear, rebuild: () => rebuildList(c) };
}

/** Gleisstücke zählen: Strecken, Scheiben, Prellböcke. */
const count = (g, c) => {
  const list = cityRailPieces(g, 0, () => true);
  return { rails: list.rails.length, discs: list.discs.length, bars: list.bars.length, list };
};

test('Gleis: allein eine Scheibe, Gleisende mit Prellbock, Gerade mit zwei Strecken, Kurve aus Sehnen, Kreuzung mit Scheibe', () => {
  const { g, c, put, clear, rebuild } = city();
  const C = [80, 80];
  // allein
  clear();
  put(...C, RL);
  rebuild();
  let t = count(g, c);
  assert.deepEqual([t.rails, t.discs, t.bars], [0, 1, 0], 'allein: eine Scheibe');
  // drei in einer Reihe: die Enden mit Prellbock, die Mitte gerade zu beiden Seiten
  clear();
  put(79, 80, RL);
  put(80, 80, RL);
  put(81, 80, RL);
  rebuild();
  t = count(g, c);
  assert.deepEqual([t.rails, t.discs, t.bars], [4, 0, 2], 'Reihe: 1 + 2 + 1 Strecken, zwei Prellböcke');
  // Kurve: Mitte mit Nord und Ost, plus Enden
  clear();
  put(80, 80, RL);
  put(80, 79, RL);
  put(81, 80, RL);
  rebuild();
  t = count(g, c);
  const curve = t.list.rails.filter((r) => r.pad === 1.5); // nur die Sehnen der Kurve haben Überstand
  assert.equal(curve.length, 8, 'Kurve: acht Sehnen');
  assert.equal(t.bars, 2, 'die beiden Enden haben Prellböcke');
  // Sehnen liegen auf dem Viertelkreis um die Ecke (rechts oben der Mitte) mit Radius Zellhälfte
  const ox = 81 * 64;
  const oy = 80 * 64;
  for (const r of curve) for (const [x, y] of [[r.x1, r.y1], [r.x2, r.y2]]) assert.ok(Math.abs(Math.hypot(x - ox, y - oy) - 32) < 1e-6, 'Punkt auf dem Radius der Kurve');
  // Kreuzung: vier Seiten, dazu je ein Ende
  clear();
  put(80, 80, RL);
  put(80, 79, RL);
  put(80, 81, RL);
  put(79, 80, RL);
  put(81, 80, RL);
  rebuild();
  t = count(g, c);
  assert.equal(t.discs, 1, 'Kreuzung: eine Scheibe in der Mitte');
  assert.equal(t.bars, 4, 'die vier Enden: Prellböcke');
});

test('Gleis am Kartenrand führt hinaus; Güterbahnhof mit Gleis: die Seite ist offen', () => {
  const { g, c, put, clear, rebuild } = city();
  // Zelle am oberen Kartenrand: Gleis führt nach oben aus dem Raster
  clear();
  put(40, 0, RL);
  rebuild();
  let t = count(g, c);
  assert.equal(t.rails, 1, 'ein Gleis hinaus zum Rand');
  assert.equal(t.bars, 1, 'Gleisende am Rand: Prellbock');
  // Güterbahnhof 3 × 3 (Mitte 40/40), Gleis östlich der Mitte-Ostkante: Seite E offen (Bit 2)
  clear();
  const a = 40 * c.cols + 40;
  for (let r = 39; r <= 41; r++) for (let q = 39; q <= 41; q++) {
    c.kind[r * c.cols + q] = ST;
    c.part[r * c.cols + q] = a + 1;
  }
  put(42, 40, RL);
  rebuild();
  assert.equal(stationLinks(c, a), stationBit(1, 0), 'Gleis an der Ostseite, mittlere Zelle');
  put(40, 38, RL);
  rebuild();
  assert.equal(stationLinks(c, a), stationBit(1, 0) | stationBit(0, 0), 'Gleis im Norden dazu (mittlere Spalte)');
  put(42, 41, RL);
  rebuild();
  assert.equal(stationLinks(c, a), stationBit(1, 0) | stationBit(0, 0) | stationBit(1, 1), 'Ostseite, untere Zelle: eigener Anschluss');
});

test('Güterbahnhof: Bild für jede Stufe und jede Seitenkombination, mit endlichen Zahlen', () => {
  const masks = [0, stationBit(0, 0), stationBit(3, -1) | stationBit(1, 1), stationBit(2, 1) | stationBit(0, -1) | stationBit(3, 0)];
  for (let lv = 1; lv <= 3; lv++) {
    const bodies = [];
    for (const open of masks) {
      const plan = bigPlan('station', lv, 1000, 2000, 192, open);
      assert.ok(plan.ground.length > 10, 'Boden');
      assert.ok(plan.bodies.length >= 3, 'Körper');
      for (const p of [...plan.ground, ...plan.bodies]) {
        for (const k of ['x', 'y', 'x0', 'y0', 'x1', 'y1', 'h', 'base', 'r', 'r1']) if (k in p) assert.ok(Number.isFinite(p[k]), `${k} endlich`);
      }
      bodies.push(plan.bodies.length);
    }
    assert.ok(new Set(bodies).size === 1, 'Körper hängen nicht von den Seiten ab');
  }
  // Stufen werden größer: mehr Körper je Stufe (Waggons, Sheddachhalle, Portalkran)
  const n = (lv) => bigPlan('station', lv, 0, 0, 192, 0).bodies.length;
  assert.ok(n(1) < n(2) && n(2) < n(3), `Stufen wachsen: ${n(1)} < ${n(2)} < ${n(3)}`);
  // Gleis nach Norden: Stichgleis im Bild (Streifen von −96 bis −11 Zellen, Breite 40); ohne Gleis fehlt er
  const hasStub = (open) => bigPlan('station', 1, 0, 0, 192, open).ground.some((p) => p.t === 'rect' && p.x0 === -20 && p.x1 === 20 && p.y0 === -96);
  assert.equal(hasStub(stationBit(0, 0)), true, 'Gleis im Norden in der Mitte: Stichgleis');
  assert.equal(hasStub(stationBit(0, 1)), false, 'Gleis im Norden an der Ecke: Stichgleis bei x = +64, nicht in der Mitte');
  assert.equal(hasStub(0), false, 'ohne Gleis: kein Stichgleis');
});

test('Güterbahnhof malt auf jeder Zeichenfläche ohne Fehler (Boden, Dach, Winter)', () => {
  const calls = [];
  const ctx = new Proxy(
    {},
    {
      get(target, k) {
        if (k in target) return target[k];
        if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
        return (...args) => {
          for (const a of args) if (typeof a === 'number') assert.ok(Number.isFinite(a), `${String(k)}(${args.join(', ')})`);
          calls.push(k);
        };
      },
      set(target, k, v) {
        target[k] = v;
        return true;
      },
    },
  );
  const geo = { begin: () => calls.push('begin'), rect: () => calls.push('rect'), line: () => calls.push('line'), poly: () => calls.push('poly'), fill: () => calls.push('fill'), stroke: () => calls.push('stroke') };
  for (const winter of [false, true]) {
    for (let lv = 1; lv <= 3; lv++) {
      const plan = bigPlan('station', lv, 0, 0, 192, 5);
      drawBigGround(geo, plan, true, winter);
      drawBigTop(ctx, plan, '#3366cc', 0.3, 1.2, false);
    }
  }
  assert.ok(calls.includes('stroke') && calls.includes('fill'), 'Boden und Körper gezeichnet');
});

test('ohne Canvas zeichnen die Gleisfunktionen nichts', () => {
  const list = { rails: [{ x1: 0, y1: 0, x2: 64, y2: 0 }], discs: [{ x: 0, y: 0 }], bars: [] };
  const ren = { camera: { zoom: 1, visibleRect: () => ({ x0: -1e4, y0: -1e4, x1: 1e4, y1: 1e4 }) }, draping: () => false, dpr: 1 };
  assert.equal(drawCityRails(ren, {}, list, 'k', 'summer'), undefined); // ohne Path2D: keine Zeichnung, kein Fehler
});
