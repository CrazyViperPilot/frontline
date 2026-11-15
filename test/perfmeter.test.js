// Messanzeige (ui/perfmeter.js, Paket „Messanzeige“): die Auswertung rechnet ohne DOM. Geprüft werden Mittel und Höchstwerte
// im 2-s-Fenster, Reihenfolge der Ebenen, Eingabeverzögerung über die letzten 10 Eingaben und der Haken der Schleife (core/loop.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { PerfMeter, formatPanel, fmtMs, WINDOW_MS, INPUT_KEEP } from '../js/ui/perfmeter.js';
import { createLoop } from '../js/core/loop.js';

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`);

test('Bildzeit: Mittel und langsamstes Bild aus den Abständen', () => {
  const pm = new PerfMeter();
  for (const now of [1000, 1016, 1033, 1050]) pm.endFrame({ now, simMs: 2, steps: 1, renderMs: 0 });
  const s = pm.summary();
  assert.equal(s.frames, 4);
  close(s.gap.mean, 50 / 3); // drei Abstände: 16, 17, 17
  assert.equal(s.gap.max, 17);
  close(s.fps, 1000 / (50 / 3));
});

test('Fenster: Bilder älter als 2 s fallen weg (Auswertung und Speicher)', () => {
  const pm = new PerfMeter();
  for (const now of [0, 500, 1000, 1500]) {
    pm.add('Alt', 10);
    pm.endFrame({ now });
  }
  for (const now of [5000, 5500]) {
    pm.add('Neu', 4);
    pm.endFrame({ now });
  }
  const s = pm.summary(5500);
  assert.equal(s.frames, 2);
  assert.deepEqual(s.layers.map((l) => l.name), ['Neu']);
  close(s.layers[0].mean, 4);
  assert.equal(pm.frames.length, 2, 'alte Bilder werden auch aus dem Speicher genommen');
  assert.equal(WINDOW_MS, 2000);
});

test('Simulation: Mittel und Höchstwert je Bild, Schritte je Bild', () => {
  const pm = new PerfMeter();
  pm.addSim(2, 1);
  pm.endFrame({ now: 100, simMs: 0, steps: 0 }); // addSim im Bild zählt mit, simMs/steps kommen dazu
  pm.endFrame({ now: 116, simMs: 6, steps: 3 });
  const s = pm.summary();
  close(s.sim.mean, (2 + 6) / 2);
  assert.equal(s.sim.max, 6);
  close(s.steps.mean, (1 + 3) / 2);
});

test('Ebenen: nach Größe sortiert, Rest bis zur Bildschleife als „Minimap, HUD“', () => {
  const pm = new PerfMeter();
  pm.add('Boden', 3);
  pm.add('Objekte', 9);
  pm.add('Objekte', 1); // mehrfach addiert: 10
  pm.addRender(13);
  pm.endFrame({ now: 100, renderMs: 20 }); // Renderer 13 ms, Bild 20 ms: 7 ms Rest
  const s = pm.summary();
  assert.deepEqual(s.layers.map((l) => l.name), ['Objekte', 'Minimap, HUD', 'Boden']);
  close(s.layers[0].mean, 10);
  close(s.layers[1].mean, 7);
  close(s.render.mean, 13);
});

test('Ebenen: Mittel über alle Bilder des Fensters (fehlende Ebene zählt als 0)', () => {
  const pm = new PerfMeter();
  pm.add('A', 4);
  pm.endFrame({ now: 100 });
  pm.endFrame({ now: 116 }); // ohne A
  const s = pm.summary();
  assert.equal(s.frames, 2);
  close(s.layers[0].mean, 2);
});

test('Eingabe: Zeit bis zum Bildbeginn, Mittel und Höchstwert der letzten 10', () => {
  const pm = new PerfMeter();
  for (let i = 0; i < 12; i++) pm.input(1000 + i); // Eingaben nach und nach, alle vor dem Bild bei 1100
  pm.endFrame({ now: 1100 });
  const s = pm.summary(1100);
  assert.equal(s.input.n, INPUT_KEEP);
  // Verzögerungen 100 … 89 ms; behalten werden die letzten 10 (98 … 89)
  close(s.input.mean, (98 + 89) / 2);
  assert.equal(s.input.max, 98);
  assert.equal(pm.pending.length, 0);
});

test('Eingabe: ein Zeitstempel nach dem Bildbeginn zählt als 0, nicht negativ', () => {
  const pm = new PerfMeter();
  pm.input(500);
  pm.endFrame({ now: 400 });
  assert.equal(pm.summary(400).input.max, 0);
});

test('Eingabe: wartende Eingaben ohne Bild werden begrenzt', () => {
  const pm = new PerfMeter();
  for (let i = 0; i < 200; i++) pm.input(i);
  assert.ok(pm.pending.length <= 50);
});

test('leere Auswertung ohne Bilder: Nullen und keine Ebenen', () => {
  const s = new PerfMeter().summary();
  assert.equal(s.frames, 0);
  assert.equal(s.fps, 0);
  assert.deepEqual(s.layers, []);
  assert.equal(s.input.n, 0);
});

test('Zahlen mit deutschem Komma; fehlende Werte als Strich', () => {
  assert.equal(fmtMs(16.666), '16,7');
  assert.equal(fmtMs(NaN), '–');
});

test('Textfeld: Zeilen für Bilder, Simulation, Ebenen, Eingabe und Partie', () => {
  const pm = new PerfMeter();
  pm.add('Boden', 5);
  pm.endFrame({ now: 100, renderMs: 5 });
  pm.endFrame({ now: 117, renderMs: 5 });
  const text = formatPanel(pm.summary(117), { view: 'Iso', units: 812, buildings: 40, dpr: 2, canvas: '1600×900' });
  assert.match(text, /^Bilder \d+ \/s, je Bild 17,0 ms/m);
  assert.match(text, /^Simulation /m);
  assert.match(text, /^Zeichnen /m);
  assert.match(text, /^ {2}Boden {2,}2,5$/m); // 5 ms im ersten von zwei Bildern
  assert.match(text, /^ {2}Minimap, HUD {2,}5,0$/m); // Rest bis zur Schleife: 5 ms je Bild
  assert.match(text, /^Eingabe noch keine$/m);
  assert.match(text, /^Iso: 812 Einheiten, 40 Gebäude$/m);
  assert.match(text, /F3 schaltet/);
});

test('Schleife: ohne Haken keine Messung, mit Haken Simulations- und Bildzeit je Bild', () => {
  const realRaf = globalThis.requestAnimationFrame;
  const realCaf = globalThis.cancelAnimationFrame;
  let queued = null;
  globalThis.requestAnimationFrame = (fn) => {
    queued = fn;
    return 1;
  };
  globalThis.cancelAnimationFrame = () => {
    queued = null;
  };
  try {
    for (const hook of [null, []]) {
      let updates = 0;
      let renders = 0;
      const frames = [];
      const loop = createLoop({
        update: () => updates++,
        render: () => renders++,
        tickRate: 20,
        onFrame: hook ? (f) => frames.push(f) : null,
      });
      loop.start();
      queued(1000); // erstes Bild: keine Zeit vergangen
      queued(1100); // 0,1 s bei 20 Schritten je s: zwei Schritte
      assert.equal(updates, 2);
      assert.equal(renders, 2);
      if (hook) {
        assert.equal(frames.length, 2);
        assert.equal(frames[0].steps, 0);
        assert.equal(frames[1].steps, 2);
        assert.equal(frames[1].now, 1100);
        assert.ok(frames[1].simMs >= 0 && frames[1].renderMs >= 0);
      } else assert.equal(loop.onFrame, null);
      loop.stop();
    }
  } finally {
    globalThis.requestAnimationFrame = realRaf;
    globalThis.cancelAnimationFrame = realCaf;
  }
});
