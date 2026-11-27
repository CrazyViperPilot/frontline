// Effekte 3D (js/render3d/fx3d.js): jede Effektart und jede Rauchquelle ergibt endliche Teilchen mit Deckkraft 0–1 und gültiger Form;
// Explosionen bleiben sparsam (50 gleichzeitig unter 2 000 Teilchen); Gruppen liegen nach dem Sortieren von hinten nach vorn, innerhalb
// einer Gruppe in Malreihenfolge; Wachsen über die Anfangsgröße legt eine neue Geometrie an (three zeichnet sonst nur die alte Zahl);
// das Kopier-Rechteck umfasst alle Teilchen. Läuft in Node ohne DOM. Fotos und Verdeckung im Browser: node tools/smoke-fx3d.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Fx3D, effect3d, shell3d, smoke3d, SOFT, DISC } from '../js/render3d/fx3d.js';
import { makeWorldRoot, makeIsoCamera, syncIsoCamera } from '../js/render3d/camera3d.js';

const CAM = { x: 1000, y: 1000, zoom: 1, rot: 0, viewW: 1280, viewH: 800 };

function setup(rot = 0, zoom = 1) {
  const cam = { ...CAM, rot, zoom };
  const cam3 = makeIsoCamera();
  syncIsoCamera(cam3, cam);
  const root = makeWorldRoot();
  root.updateMatrixWorld();
  const fx = new Fx3D();
  fx.begin(cam3, root, zoom, 2, [0.5, -0.6, 0.62]);
  return { fx, cam };
}

const ground = (x, y) => 20 + 0.01 * (x - 1000) + 0.02 * (y - 1000);

/** Alle Teilchen des letzten Bildes: endlich, Deckkraft (0, 1], Form 0–6, Halbbreiten ≥ 0. */
function valid(fx, name) {
  assert.ok(fx.count > 0, `${name}: keine Teilchen`);
  for (const a of fx.attrs) for (let i = 0; i < fx.count * a.itemSize; i++) assert.ok(Number.isFinite(a.array[i]), `${name}: Wert nicht endlich`);
  const [, , , W, C, K] = fx.attrs;
  for (let i = 0; i < fx.count; i++) {
    const alpha = C.array[i * 4 + 3];
    assert.ok(alpha > 0 && alpha <= 1, `${name}: Deckkraft ${alpha}`);
    const kind = K.array[i * 2];
    assert.ok(kind >= SOFT && kind <= DISC && Number.isInteger(kind), `${name}: Form ${kind}`);
    assert.ok(W.array[i * 4] >= 0 && W.array[i * 4 + 1] >= 0 && W.array[i * 4 + 2] >= 0, `${name}: Breite`);
  }
}

const EFFECTS = [
  { type: 'explosion', life: 0.9 },
  { type: 'explosion', life: 0.9, snd: 'hit' },
  { type: 'explosion', life: 0.9, snd: 'building' },
  { type: 'tracer', life: 0.25, x2: 1150, y2: 1080 },
  { type: 'tracer', life: 0.25, x2: 1150, y2: 1080, snd: 'flak' },
  { type: 'shell', life: 0.3, x2: 1200, y2: 1100, snd: 'cannon' },
  { type: 'shell', life: 0.3, x2: 1200, y2: 1100, snd: 'rocket' },
  { type: 'intercept', life: 0.5 },
  { type: 'muzzle', life: 0.12, x2: 1200, y2: 1100 },
  { type: 'muzzle', life: 0.12, x2: 1000, y2: 1000, snd: 'mortar' },
];

test('jede Effektart in jeder Phase, Drehung und bei zwei Zoomstufen ergibt gültige Teilchen', () => {
  for (const rot of [0, 1, 2, 3]) {
    for (const zoom of [0.35, 1.6]) {
      for (const e of EFFECTS) {
        for (const k of [0, 0.1, 0.3, 0.6, 0.95]) {
          const { fx } = setup(rot, zoom);
          effect3d(fx, { x: 1000, y: 1000, team: 0, t: k * e.life, ...e }, ground);
          fx.end();
          valid(fx, `${e.type}/${e.snd ?? '-'} k=${k} Drehung ${rot} Zoom ${zoom}`);
        }
      }
    }
  }
});

test('Mörsergranate im Bogen, Rauch, Feuer, Staub und Nebelwand ergeben gültige Teilchen; Minen keine', () => {
  for (const f of [0, 0.02, 0.5, 1]) {
    const { fx } = setup();
    shell3d(fx, { sx: 900, sy: 900, tx: 1300, ty: 1150, t: f * 2, duration: 2 }, ground);
    fx.end();
    valid(fx, `Granate ${f}`);
  }
  const sources = [
    { x: 1000, y: 1000, lift: 30, s: 14, k: 0.7, fire: true, seed: 13 },
    { x: 1000, y: 1000, lift: 8, s: 6, k: 0.3, fire: false, seed: -7, unit: true },
    { x: 1000, y: 1000, lift: 4, s: 24, k: 1, fire: false, seed: 11, dust: true },
    { x: 1000, y: 1000, lift: 8, s: 40, k: 0.6, fire: false, seed: 31, screen: true },
  ];
  for (const q of sources) {
    for (const t of [0, 1.3, 77.7]) {
      const { fx } = setup();
      smoke3d(fx, q, t, ground);
      fx.end();
      valid(fx, `Rauchquelle ${JSON.stringify(q)} t=${t}`);
    }
  }
  const { fx } = setup();
  smoke3d(fx, { x: 1000, y: 1000, lift: 0, s: 3, k: 0.5, fire: false, seed: 1, mine: true }, ground);
  fx.end();
  assert.equal(fx.count, 0, 'Minen bleiben gemalt');
});

test('50 Explosionen gleichzeitig bleiben sparsam, ein Mesh', () => {
  const { fx } = setup(0, 0.8);
  for (let i = 0; i < 50; i++) effect3d(fx, { type: 'explosion', x: 900 + (i % 10) * 25, y: 900 + Math.floor(i / 10) * 30, team: 0, t: (i % 10) * 0.08, life: 0.9, snd: i % 3 ? undefined : 'building' }, ground);
  fx.end();
  assert.ok(fx.count < 2000, `${fx.count} Teilchen`);
  assert.ok(fx.mesh.visible);
});

test('Gruppen von hinten nach vorn, Malreihenfolge innerhalb einer Gruppe bleibt', () => {
  for (const rot of [0, 1, 2, 3]) {
    const { fx } = setup(rot);
    // drei Explosionen hintereinander in Blickrichtung; die mittlere zuerst angelegt
    const pts = [[1000, 1000], [1000 + 80, 1000 + 80], [1000 - 80, 1000 - 80]];
    for (const [x, y] of pts) effect3d(fx, { type: 'explosion', x, y, team: 0, t: 0.1, life: 0.9 }, () => 0);
    const zs = fx.groups.map((g) => g.z);
    const sizes = fx.groups.map((g, i) => (i + 1 < fx.groups.length ? fx.groups[i + 1].start : fx.n) - g.start);
    fx.end();
    const order = zs.map((z, i) => i).sort((a, b) => zs[a] - zs[b]);
    const A = fx.attrs[0].array;
    let j = 0;
    for (const gi of order) {
      const [x, y] = pts[gi];
      for (let p = 0; p < sizes[gi]; p++, j++) {
        assert.equal(A[j * 4], x, `Drehung ${rot}: Teilchen ${j} gehört zur Gruppe ${gi}`);
        assert.equal(A[j * 4 + 1], y);
      }
    }
    assert.equal(j, fx.count);
  }
});

test('Wachsen über die Anfangsgröße legt eine neue Geometrie an, alle Teilchen zählen', () => {
  const { fx } = setup();
  const geo0 = fx.geometry;
  const cap0 = fx.cap;
  let i = 0;
  while (fx.n <= cap0) effect3d(fx, { type: 'explosion', x: 900 + (i % 30) * 10, y: 900 + Math.floor(i++ / 30) * 10, team: 0, t: 0.2, life: 0.9 }, ground);
  fx.end();
  assert.ok(fx.cap > cap0);
  assert.notEqual(fx.geometry, geo0, 'neue Geometrie');
  assert.equal(fx.mesh.geometry, fx.geometry);
  assert.equal(fx.count, fx.n);
  ['aA', 'aB', 'aOff', 'aW', 'aCol', 'aKind'].forEach((name, i) => assert.equal(fx.geometry.getAttribute(name), fx.attrs[i], name));
});

test('Kopier-Rechteck umfasst alle Effekte im Bild', () => {
  const { fx, cam } = setup(0, 1);
  const pts = [[700, 800], [1300, 1250], [1000, 1000]];
  for (const [x, y] of pts) effect3d(fx, { type: 'explosion', x, y, team: 0, t: 0.2, life: 0.9 }, () => 0);
  fx.end();
  const r = fx.rect(cam.viewW, cam.viewH, 1);
  assert.ok(r && r.w > 0 && r.h > 0);
  for (const [x, y] of pts) {
    const [vx, vy] = fx.view(x, y, 0);
    const sx = vx + cam.viewW / 2;
    const sy = cam.viewH / 2 - vy;
    assert.ok(sx >= r.x && sx <= r.x + r.w && sy >= r.y && sy <= r.y + r.h, `(${x}, ${y}) außerhalb`);
  }
  const { fx: empty } = setup();
  empty.end();
  assert.equal(empty.rect(1280, 800, 1), null);
});
