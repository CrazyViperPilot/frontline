// Browser-Prüfung „Effekte 3D“ (Plan docs/plan-3d.md, js/render3d/fx3d.js); eigene Datei neben smoke-3d.mjs.
// 1. Schauplatz: Seed 3, Spiel angehalten, an der eigenen Hauptstadt Explosionen in mehreren Phasen (klein, Treffer, Gebäude),
//    Leuchtspur, Flak, Kanonen- und Raketengeschoss, Mündungsfeuer, Abfangen, Mörsergranate im Bogen, brennende Hauptstadt,
//    brennender Panzer, Nebelwand; Fotos alt (Iso) | neu (3D) je Drehung, Nacht, Winter und Zoom 0,5/1,6 nach <out>/effekte/.
//    Fehler, wenn in 3D keine Teilchen entstehen oder ein Teilchenwert nicht endlich ist.
// 2. Verdeckung: Explosion hinter einem Stadthaus (vom Betrachter aus); im 3D-Bild muss das Haus den Feuerball teilweise verdecken
//    (Pixel an der Hausmitte gleichen dem Bild ohne Explosion), Foto verdeckt-*.png.
// 3. Last: 50 Explosionen gleichzeitig im Bild; Zeit des Durchlaufs „Effekte“ (ms, Mittel über --frames Bilder) Iso gegen 3D, Teilchen
//    und Draw-Calls. Software-WebGL im Container: nur zum Vergleich.
// Aufruf (Repo-Wurzel): node tools/smoke-fx3d.mjs [--out .smoke/3d] [--scale 2] [--frames 8]
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { openGame } from './smoke.mjs';

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
};
const out = arg('out', '.smoke/3d');
const scale = Number(arg('scale', 2));
const frames = Number(arg('frames', 8));
let fail = 0;

/** Bilder a, b (PNG) nebeneinander mit Beschriftung „alt (Iso)“, „neu (3D)“ als eine Datei. */
async function sideBySide(g, file, a, b) {
  const url = await g.run(
    async ({ a, b }) => {
      const load = (s) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = `data:image/png;base64,${s}`; });
      const [ia, ib] = await Promise.all([load(a), load(b)]);
      const c = document.createElement('canvas');
      const gap = 8;
      c.width = ia.width + gap + ib.width;
      c.height = Math.max(ia.height, ib.height);
      const x = c.getContext('2d');
      x.fillStyle = '#111';
      x.fillRect(0, 0, c.width, c.height);
      x.drawImage(ia, 0, 0);
      x.drawImage(ib, ia.width + gap, 0);
      x.font = `bold ${Math.round(c.height / 28)}px sans-serif`;
      for (const [t, px] of [['alt (Iso)', 10], ['neu (3D)', ia.width + gap + 10]]) {
        x.fillStyle = 'rgba(0,0,0,.6)';
        x.fillRect(px - 4, c.height - c.height / 18 - 8, x.measureText(t).width + 8, c.height / 18 + 4);
        x.fillStyle = '#fff';
        x.fillText(t, px, c.height - 14);
      }
      return c.toDataURL('image/png');
    },
    { a: a.toString('base64'), b: b.toString('base64') },
  );
  await writeFile(file, Buffer.from(url.split(',')[1], 'base64'));
}

/** Iso und 3D fotografieren (je 4 Bilder fertig gemalt) und nebeneinander speichern. */
async function pair(g, file) {
  const shots = [];
  for (const three of [false, true]) {
    await g.run((three) => {
      const s = window.__frontline.session();
      s.camera.three = three;
      for (let i = 0; i < 4; i++) s.renderer.render(s.controller.view);
    }, three);
    await g.page.waitForTimeout(200);
    shots.push(await g.page.screenshot());
  }
  await sideBySide(g, file, shots[0], shots[1]);
}

const look = (g, x, y, rot = 0, zoom = 1) =>
  g.run(({ x, y, rot, zoom }) => {
    const c = window.__frontline.session().camera;
    c.rot = rot;
    c.zoom = zoom;
    c.centerOn(x, y);
  }, { x, y, rot, zoom });

/** Schauplatz an der eigenen Hauptstadt anlegen (Spiel angehalten); liefert den Blickpunkt. */
const stage = (g) =>
  g.run(async () => {
    const { createShell } = await import('/js/game/entities.js');
    const s = window.__frontline.session();
    const game = s.game;
    s.loop.paused = true;
    s.renderer.revealAll = true;
    const hq = game.buildings.find((b) => b.main && b.team === 0);
    const cx = hq.x + 260;
    const cy = hq.y + 40;
    const fx = (type, x, y, k, extra = {}) => {
      const life = { explosion: 0.9, tracer: 0.25, shell: 0.3, muzzle: 0.12, intercept: 0.5 }[type];
      game.effects.push({ type, x, y, x2: extra.x2, y2: extra.y2, team: 0, snd: extra.snd, t: k * life, life });
    };
    fx('explosion', cx - 120, cy - 60, 0.08);
    fx('explosion', cx - 40, cy - 70, 0.3, { snd: 'hit' });
    fx('explosion', cx + 60, cy - 50, 0.22);
    fx('explosion', cx + 170, cy - 40, 0.45, { snd: 'building' });
    fx('explosion', cx + 260, cy - 60, 0.7);
    fx('tracer', cx - 200, cy + 60, 0.55, { x2: cx - 20, y2: cy + 20 });
    fx('tracer', cx - 200, cy + 100, 0.4, { x2: cx + 40, y2: cy + 70, snd: 'flak' });
    fx('shell', cx - 220, cy + 140, 0.5, { x2: cx + 60, y2: cy + 120, snd: 'cannon' });
    fx('shell', cx - 220, cy + 180, 0.6, { x2: cx + 120, y2: cy + 150, snd: 'rocket' });
    fx('muzzle', cx - 200, cy + 60, 0.2, { x2: cx - 20, y2: cy + 20 });
    fx('muzzle', cx - 220, cy + 140, 0.1, { x2: cx + 60, y2: cy + 120 });
    fx('intercept', cx + 120, cy + 80, 0.25);
    const sh = createShell(game.newId(), 0, cx - 300, cy + 220, cx + 200, cy + 260, { shellSpeed: 200 });
    sh.t = sh.duration * 0.45;
    sh.alive = true;
    game.projectiles.push(sh);
    hq.hp = hq.maxHp * 0.15; // Rauch und Feuer über der Hauptstadt
    const tank = game.spawnUnit('tank', 0, cx + 80, cy + 200);
    tank.hp = tank.maxHp * 0.1; // brennender Panzer
    game.smokes = game.smokes ?? [];
    game.smokes.push({ x: cx + 300, y: cy + 180, r: 70, team: 0, t0: game.time - 2, until: game.time + 20 });
    return { x: cx, y: cy + 40 };
  });

/** Teilchen und Endlichkeit des letzten 3D-Bildes. */
const fxStats = (g) =>
  g.run(() => {
    const s = window.__frontline.session();
    const r = s.renderer;
    s.camera.three = true;
    r.render(s.controller.view);
    const fx = r.fx3d;
    let bad = 0;
    for (const a of fx.attrs) for (let i = 0; i < fx.count * a.itemSize; i++) if (!Number.isFinite(a.array[i])) bad++;
    return { n: fx.count, groups: fx.groups.length, bad };
  });

async function scene() {
  const dir = join(out, 'effekte');
  await mkdir(dir, { recursive: true });
  for (const season of ['summer', 'winter']) {
    const g = await openGame({ seed: 3, query: `iso=1&three=1&shadows=high&weather=${season}&wx=clear`, scale, out });
    try {
      const p = await stage(g);
      const st = await fxStats(g);
      console.log(`Effekte ${season}: ${st.n} Teilchen in ${st.groups} Gruppen, ${st.bad} ungültige Werte`);
      if (!st.n || st.bad) fail++;
      if (season === 'summer') {
        for (let rot = 0; rot < 4; rot++) {
          await look(g, p.x, p.y, rot, 1);
          await pair(g, join(dir, `drehung${rot}.png`));
        }
        for (const zoom of [0.5, 1.6]) {
          await look(g, p.x, p.y, 0, zoom);
          await pair(g, join(dir, `zoom${zoom}.png`));
        }
        await look(g, p.x, p.y, 0, 1);
        await g.run(() => (window.__frontline.session().renderer.mood = 'night'));
        await pair(g, join(dir, 'nacht.png'));
        await g.run(() => (window.__frontline.session().renderer.mood = null));
        await occlusion(g, dir);
        await load(g);
      } else {
        await look(g, p.x, p.y, 0, 1);
        await pair(g, join(dir, 'winter.png'));
      }
      for (const e of g.errors) console.log('  Browserfehler:', e);
      if (g.errors.length) fail++;
    } finally {
      await g.close();
    }
  }
}

/**
 * Explosion hinter einem Gebäude, das in 3D als Mesh steht (nächstes Haus der Karte an der Hauptstadt): im Fenster um den Feuerball
 * ändern sich in 3D deutlich weniger Pixel als in Iso, wo der Feuerball obenauf gemalt wird.
 */
async function occlusion(g, dir) {
  const r = await g.run(() => {
    const s = window.__frontline.session();
    const game = s.game;
    const cam = s.camera;
    const r = s.renderer;
    const keep = game.effects.slice();
    const hq = game.buildings.find((b) => b.main && b.team === 0);
    const hs = (game.houses ?? []).filter((h) => h.alive && !h.ruined).sort((a, b) => Math.hypot(a.x - hq.x, a.y - hq.y) - Math.hypot(b.x - hq.x, b.y - hq.y));
    const h = hs[0];
    if (!h) return null;
    cam.rot = 0;
    cam.zoom = 1.6;
    cam.centerOn(h.x, h.y);
    const [dx, dy] = cam.depthDir(); // zum Betrachter
    const back = Math.min(h.pw, h.ph) * 0.3; // hinter der Mitte, noch unter dem Dach
    const ex = h.x - dx * back;
    const ey = h.y - dy * back;
    const boom = () => ({ type: 'explosion', x: ex, y: ey, team: 0, t: 0.2, life: 0.9 });
    const c = r.canvas;
    const k = r.dpr;
    const p = cam.worldToScreen(ex, ey);
    const R = 40; // Fenster ±R CSS-px um den Feuerball
    const x0 = Math.round((p.x - R) * k);
    const y0 = Math.round((p.y - 20 - R) * k);
    const grab = (three, withFx) => {
      game.effects.length = 0;
      if (withFx) game.effects.push(boom());
      cam.three = three;
      for (let i = 0; i < 3; i++) r.render(s.controller.view);
      return c.getContext('2d').getImageData(x0, y0, Math.round(2 * R * k), Math.round(2 * R * k)).data;
    };
    const changed = (three) => {
      const a = grab(three, false);
      const b = grab(three, true);
      let n = 0;
      for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 60) n++;
      return n;
    };
    const res = { iso: changed(false), d3: changed(true) };
    game.effects.length = 0;
    game.effects.push(boom(), ...keep);
    return res;
  });
  if (!r) {
    console.log('Verdeckung: kein Haus gefunden (übersprungen)');
    return;
  }
  console.log(`Verdeckung: Explosion hinter einem Haus ändert im Fenster ${r.iso} Pixel in Iso (obenauf gemalt), ${r.d3} in 3D (Haus davor)`);
  if (!(r.iso > 50 && r.d3 < r.iso * 0.6)) fail++;
  await pair(g, join(dir, 'verdeckt.png'));
}

/** 50 Explosionen im Bild: Zeit des Durchlaufs „Effekte“ in Iso und 3D. */
async function load(g) {
  const res = await g.run((n) => {
    const s = window.__frontline.session();
    const game = s.game;
    const r = s.renderer;
    const cam = s.camera;
    cam.zoom = 0.8;
    const c = cam.screenToWorld?.(cam.viewW / 2, cam.viewH / 2) ?? { x: cam.x, y: cam.y };
    game.effects.length = 0;
    for (let i = 0; i < 50; i++) {
      const a = i * 2.4;
      const d = 30 + 9 * i;
      game.effects.push({ type: 'explosion', x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d * 0.7, team: 0, snd: i % 3 ? undefined : 'building', t: ((i % 10) / 10) * 0.9, life: 0.9 });
    }
    const time = (three) => {
      cam.three = three;
      let sum = 0;
      const old = r.perf;
      r.perf = { lap(name, t) { const now = performance.now(); if (name === 'Effekte') sum += now - t; return now; }, addRender() {} };
      for (let i = 0; i < 2; i++) r.render(s.controller.view);
      sum = 0;
      for (let i = 0; i < n; i++) r.render(s.controller.view);
      r.perf = old;
      return sum / n;
    };
    const iso = time(false);
    const d3 = time(true);
    const n50 = r.fx3d.count;
    // Wachsen über die Anfangsgröße (150 Explosionen) nach Bildern mit wenigen Teilchen: alle müssen gezeichnet werden
    const gl = r.gl;
    const orig = gl.render.bind(gl);
    let tris = -1;
    gl.render = (scene, cam3) => {
      orig(scene, cam3);
      if (scene === r.fxScene) tris = gl.info.render.triangles;
    };
    const keep = game.effects.slice();
    for (let i = 50; i < 150; i++) {
      const a = i * 2.4;
      const d = 30 + 4 * i;
      game.effects.push({ type: 'explosion', x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d * 0.7, team: 0, t: ((i % 10) / 10) * 0.9, life: 0.9 });
    }
    r.render(s.controller.view);
    const big = { n: r.fx3d.count, tris, cap: r.fx3d.cap };
    gl.render = orig;
    game.effects.length = 0;
    game.effects.push(...keep);
    return { iso, d3, n: n50, big };
  }, frames);
  console.log(`Last (50 Explosionen): Durchlauf „Effekte“ Iso ${res.iso.toFixed(1)} ms, 3D ${res.d3.toFixed(1)} ms, ${res.n} Teilchen in einem Draw-Call`);
  console.log(`Wachsen (150 Explosionen): ${res.big.n} Teilchen, ${res.big.tris} Dreiecke gezeichnet (soll ${2 * res.big.n}), Platz ${res.big.cap}`);
  if (res.big.tris !== 2 * res.big.n) fail++;
  await pair(g, join(out, 'effekte', 'last.png'));
}

await scene();
console.log(fail ? `FEHLER: ${fail}` : 'Effekte 3D: alles grün');
process.exit(fail ? 1 : 0);
