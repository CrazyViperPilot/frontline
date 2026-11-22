// Mauern als Mauern (Paket „Mauern“, js/game/walls.js): hohe Mauern halten Direktfeuer auf, Panzer und Panzerabwehr schießen sie in
// etwa 20 Schuss auf (Tore etwa 10), Steilfeuer fliegt darüber.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/game/game.js';
import { BUILDINGS } from '../js/data/buildings.js';
import { PROPS } from '../js/data/props.js';
import { UNITS } from '../js/data/units.js';
import { addProp } from '../js/game/props.js';
import { fireBlocker } from '../js/game/walls.js';
import { run } from './util.js';

const T = 32; // Kachel (BALANCE.map.tile)

/** Freies, flaches Rechteck (w × h Kacheln) nahe der Kartenmitte: linke obere Kachel. */
function freeSpot(g, w, h) {
  const gr = g.grid;
  const c0 = Math.floor(gr.cols / 2);
  const r0 = Math.floor(gr.rows / 2) + 40;
  for (let d = 0; d < 80; d++) {
    for (const [c, r] of [[c0 + d, r0], [c0 - d, r0], [c0, r0 + d], [c0, r0 - d]]) {
      let ok = true;
      for (let y = r; ok && y < r + h; y++) for (let x = c; ok && x < c + w; x++) ok = gr.passable(x, y) && !gr.prop?.[y * gr.cols + x];
      if (ok) return { c, r };
    }
  }
  throw new Error('kein freier Platz');
}

/** Schütze (Team 0) links, Ziel (Team 1) rechts, dazwischen optional eine Mauerreihe aus Prop `kind` (5 Kacheln senkrecht). */
function duel(shooter, target, kind, seed = 3) {
  const g = new Game({ seed });
  const { c, r } = freeSpot(g, 12, 5);
  const y = (r + 2.5) * T;
  if (kind) for (let k = 0; k < 5; k++) addProp(g, { kind, x: (c + 6.5) * T, y: (r + k + 0.5) * T });
  const s = g.spawnUnit(shooter, 0, (c + 2.5) * T, y);
  const t = g.spawnUnit(target, 1, (c + 10.5) * T, y);
  for (const u of g.units) if (u !== s && u !== t) u.alive = false; // nur die beiden
  g.cleanup();
  return { g, s, t, wallX: (c + 6.5) * T, row: r };
}

test('Schütze schießt nicht durch Hesco und Betonmauer, ohne Mauer trifft er', () => {
  for (const kind of [null, 'hesco', 'wall_concrete']) {
    const { g, s, t } = duel('rifleman', 'rifleman', kind);
    t.order = { type: 'hold' };
    s.order = { type: 'hold' };
    const hp = t.hp;
    run(g, 20);
    if (kind) {
      assert.equal(t.hp, hp, `${kind}: kein Schaden hinter der Mauer`);
      assert.ok(fireBlocker(g, s, t), `${kind}: Mauer liegt in der Feuerlinie`);
    } else assert.ok(t.hp < hp, 'ohne Mauer: Treffer');
  }
});

test('[langsam] Kampfpanzer schießt Hesco in etwa 20 Schuss auf, dann trifft er das Ziel', () => {
  // Hesco verdeckt die Sicht nicht (die Betonmauer schon: dahinter sieht der Panzer gar nichts)
  const { g, s, t } = duel('tank', 'rifleman', 'hesco');
  s.order = { type: 'hold' };
  t.order = { type: 'hold' };
  const wall = UNITS.tank.weapons.find((w) => w.id === 'cannon').damage.wall;
  for (const kind of ['hesco', 'wall_concrete']) {
    const shots = PROPS.kinds[kind].hp / wall;
    assert.ok(shots >= 18 && shots <= 22, `${kind}: Schuss je Mauerstück ${shots}`);
  }
  const hp = t.hp;
  const hesco = () => g.map.props.map((p, i) => (p.kind === 'hesco' ? g.propHp[i] : null)).filter((v) => v !== null);
  run(g, 30);
  assert.equal(t.hp, hp, 'die ersten Schüsse treffen die Mauer');
  assert.ok(hesco().some((v) => v < PROPS.kinds.hesco.hp), 'Mauer beschädigt');
  run(g, 140); // 20 Schuss × 6 s Nachladen
  assert.ok(hesco().some((v) => v <= 0), 'Mauerstück zerstört');
  run(g, 20);
  assert.ok(t.hp < hp, 'danach trifft der Panzer das Ziel');
});

test('Tor ist die Schwachstelle: etwa 10 Schuss von Panzer oder Panzerabwehr; Mauer und Tor halten Direktfeuer auf', () => {
  for (const unit of ['tank', 'at']) {
    const w = UNITS[unit].weapons[0].damage.wall;
    const gate = BUILDINGS.gate.hp / w;
    const wall = BUILDINGS.wall.hp / w;
    assert.ok(gate >= 8 && gate <= 12, `${unit}: Tor ${gate} Schuss`);
    assert.ok(wall >= 18 && wall <= 22, `${unit}: Mauer ${wall} Schuss`);
  }
  assert.ok(BUILDINGS.wall.blocksFire && BUILDINGS.gate.blocksFire);
  // Torkachel einer Betonmauer nimmt doppelten Schaden
  assert.equal(PROPS.kinds.wall_concrete.gateMul, 2);
});

test('Mauer aus dem Baumenü hält Gewehrfeuer auf', () => {
  const g = new Game({ seed: 3 });
  const { c, r } = freeSpot(g, 12, 5);
  for (let k = 0; k < 5; k++) g.spawnBuilding('wall', 0, c + 6, r + k);
  const y = (r + 2.5) * T;
  const s = g.spawnUnit('rifleman', 1, (c + 2.5) * T, y);
  const t = g.spawnUnit('rifleman', 0, (c + 10.5) * T, y);
  s.order = { type: 'hold' };
  t.order = { type: 'hold' };
  const hp = t.hp;
  run(g, 20);
  assert.equal(t.hp, hp, 'kein Schaden durch die Mauer');
});

test('Steilfeuer (Mörsertrupp) fliegt über die Mauer', () => {
  const { g, s, t } = duel('mortarteam', 'rifleman', 'hesco');
  s.order = { type: 'hold' };
  t.order = { type: 'hold' };
  const hp = t.hp;
  run(g, 40);
  assert.ok(t.hp < hp || !t.alive, 'Mörser trifft hinter der Mauer');
});
