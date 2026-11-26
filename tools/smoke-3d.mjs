// Browser-Prüfung der 3D-Ansicht (Plan docs/plan-3d.md), drei Teile; Fotos nach .smoke/3d/, Exit-Code 1 bei Fehlern:
// 1. Kamera (Paket „3D-Gerüst“): ?three=1&cubes=1&iso=1 zeigt Prüfwürfel (render3d/testscene.js) auf dem 3D-Gelände; ihre Bildlage
//    aus three (Vector3.project) muss in allen 4 Drehungen und bei Zoom 0,35, 1 und 1,6 unter 1 px von camera.worldToScreen liegen.
// 2. Iso gegen 3D (Pakete „3D-Boden“, „Billboard-Brücke“): je Seed (3, 7), Jahreszeit (Sommer, Winter), Drehung und Zoom dasselbe Bild
//    einmal klassisch (Iso) und einmal mit three (3D), Fotos …-iso.png / …-3d.png und Anteil abweichender Pixel (Kanal > 40).
//    Fehler, wenn mehr als MAX_DIFF % der Pixel abweichen.
// 3. Speicher (Billboard-Brücke): --minutes lang (Standard 1) zoomen und schieben in 3D; Atlasseiten, Leerungen, Sprite-Pixel und
//    JS-Speicher am Anfang und Ende. Fehler, wenn mehr als 4 Atlasseiten entstehen.
// 4. Messung (Paket „Licht und Schatten“): Seed 3, Spiel angehalten, 200 Einheiten um die Hauptstadt; Zeit je Iso-Durchlauf (ms, Mittel
//    über --frames Bilder) für Iso und 3D mit jeder Schattenstufe. Software-WebGL im Container: nur zum Vergleich, nicht absolut.
// 5. Schatten (Paket „Licht und Schatten“): Fotos je Stufe (Aus, Mittel, Hoch) und Drehung neben Iso, Panzer am Hang, Nacht;
//    Prüfungen: Schattenkarte beim Verschieben gleich groß und auf dem Texel-Raster, Stufenwechsel ohne Neustart (keine Fehler),
//    im Bild mit Schattenkarte keine gemalten Einheitenschatten, unter dem Panzer am Hang dunkler als daneben.
//
// Aufruf (im Repo-Wurzelordner):  node tools/smoke-3d.mjs [--out .smoke/3d] [--scale 2] [--minutes 5] [--frames 8]
//                                 [--only kamera|vergleich|speicher|messung|schatten]
import { openGame } from './smoke.mjs';

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
};
const out = arg('out', '.smoke/3d');
const scale = Number(arg('scale', 2));
const minutes = Number(arg('minutes', 1));
const only = arg('only', null);
const frames = Number(arg('frames', 8));
const ZOOMS = [0.35, 1, 1.6];
const LIMIT = 1; // px
const MAX_DIFF = 3; // % abweichender Pixel zwischen Iso und 3D (Kantenfilterung, bewegte Fahnen, HUD-Uhr)
let fail = 0;
const errors = [];

/** Ansicht setzen: Drehung, Zoom, Mitte auf der eigenen Hauptstadt (sonst Kartenmitte) mit Versatz. */
const view = (g, rot, zoom, dx = 0, dy = 0) =>
  g.run(
    ({ rot, zoom, dx, dy }) => {
      const s = window.__frontline.session();
      const cam = s.camera;
      cam.rot = rot;
      cam.zoom = zoom;
      const hq = s.game.buildings.find((b) => b.main && b.team === 0);
      cam.centerOn((hq?.x ?? cam.mapW / 2) + dx, (hq?.y ?? cam.mapH / 2) + dy);
    },
    { rot, zoom, dx, dy },
  );

async function camera() {
  const g = await openGame({ seed: 3, query: 'three=1&cubes=1&iso=1', scale, out });
  try {
    const has3D = await g.run(() => typeof window.__frontline.session().renderer.probe === 'function');
    if (!has3D) throw new Error('kein Renderer3D (WebGL fehlt oder three.js nicht geladen)');
    console.log('Kamera: Drehung  Zoom   größte Abweichung (px)  Würfel');
    for (let rot = 0; rot < 4; rot++) {
      for (const zoom of ZOOMS) {
        await view(g, rot, zoom);
        await g.page.waitForTimeout(400);
        const res = await g.run(() => window.__frontline.session().renderer.probe());
        if (!res.length) throw new Error('keine Prüfwürfel');
        const worst = res.reduce((a, b) => (b.d > a.d ? b : a));
        if (worst.d >= LIMIT || !Number.isFinite(worst.d)) fail++;
        console.log(`        ${rot}        ${zoom.toFixed(2).padEnd(5)}  ${worst.d.toFixed(4).padEnd(22)}  ${res.length} (größte: ${worst.name})`);
        await g.shot(`kamera-rot${rot}-zoom${zoom}`);
      }
    }
    await g.run(() => {
      const s = window.__frontline.session();
      s.camera.rot = 0;
      s.camera.zoom = 1.6;
      s.camera.centerOn(s.camera.mapW - 80, s.camera.mapH - 80);
    });
    await g.page.waitForTimeout(400);
    await g.shot('kamera-ecke'); // Würfel am Hang, Kreuz = camera.worldToScreen am Fuß
  } finally {
    errors.push(...g.errors);
    await g.close();
  }
}

/** Ein Bild klassisch und eines mit three (derselbe Renderer, nur camera.three), Fotos und Anteil abweichender Pixel. */
async function pair(g, name) {
  const shot = async (three) => {
    await g.run((three) => {
      const s = window.__frontline.session();
      s.camera.three = three;
      for (let i = 0; i < 4; i++) s.renderer.render(s.controller.view); // Sprites fertig malen (Zeitbudget je Bild)
    }, three);
    await g.page.waitForTimeout(250);
    await g.shot(`${name}-${three ? '3d' : 'iso'}`);
  };
  await shot(false);
  await shot(true);
  // Vergleich ohne Fotos: beide Bilder direkt hintereinander in dieselbe Leinwand
  return g.run(() => {
    const s = window.__frontline.session();
    const c = s.renderer.canvas;
    const grab = (three) => {
      s.camera.three = three;
      for (let i = 0; i < 4; i++) s.renderer.render(s.controller.view);
      return c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    };
    const a = grab(false);
    const b = grab(true);
    let n = 0;
    for (let i = 0; i < a.length; i += 4) {
      if (Math.abs(a[i] - b[i]) > 40 || Math.abs(a[i + 1] - b[i + 1]) > 40 || Math.abs(a[i + 2] - b[i + 2]) > 40) n++;
    }
    return (100 * n) / (a.length / 4);
  });
}

async function compare() {
  console.log('Vergleich Iso/3D: Seed  Jahreszeit  Drehung  Zoom  abweichende Pixel');
  for (const seed of [3, 7]) {
    for (const season of ['summer', 'winter']) {
      const wx = season === 'winter' ? 'snow' : 'clear';
      const g = await openGame({ seed, query: `iso=1&three=1&weather=${season}&wx=${wx}`, scale: 1, out });
      try {
        await g.run(() => (window.__frontline.session().loop.paused = true));
        for (const [rot, zoom] of [[0, 1], [1, 0.6], [2, 1.6], [3, 0.35]]) {
          await view(g, rot, zoom, 150, 100);
          const d = await pair(g, `s${seed}-${season}-rot${rot}-zoom${zoom}`);
          if (d > MAX_DIFF) fail++;
          console.log(`                  ${seed}     ${season.padEnd(10)}  ${rot}        ${String(zoom).padEnd(4)}  ${d.toFixed(2)} %${d > MAX_DIFF ? '  ZU VIEL' : ''}`);
        }
      } finally {
        errors.push(...g.errors);
        await g.close();
      }
    }
  }
}

async function memory() {
  const g = await openGame({ seed: 3, query: 'iso=1&three=1', scale: 1, out });
  try {
    const stat = () =>
      g.run(() => {
        const s = window.__frontline.session();
        return { ...s.renderer.billboards.stats(), heap: Math.round((performance.memory?.usedJSHeapSize ?? 0) / 1e6) };
      });
    const a = await stat();
    const t0 = Date.now();
    let k = 0;
    while (Date.now() - t0 < minutes * 60000) {
      const zoom = 0.35 + ((Math.sin(k * 0.7) + 1) / 2) * 1.25;
      await view(g, k % 4, zoom, Math.sin(k * 0.3) * 1500, Math.cos(k * 0.2) * 1500);
      await g.page.waitForTimeout(300);
      k++;
    }
    const b = await stat();
    console.log(`Speicher (${minutes} min, ${k} Ansichten): Atlasseiten ${a.pages} → ${b.pages}, Leerungen ${b.resets}, JS ${a.heap} → ${b.heap} MB`);
    if (b.pages > 4) fail++;
    await g.shot('speicher-ende');
  } finally {
    errors.push(...g.errors);
    await g.close();
  }
}

/** 200 Einheiten (Panzer, Schützenpanzer, Soldaten, Hubschrauber) in einem Feld um (x, y), Team 0 und 1 gemischt. */
const spawnArmy = (g, dx = 0, dy = 0) =>
  g.run(
    ({ dx, dy }) => {
      const s = window.__frontline.session();
      const hq = s.game.buildings.find((b) => b.main && b.team === 0);
      const types = ['tank', 'ifv', 'rifleman', 'rifleman', 'truck', 'tank', 'at', 'gunship'];
      for (let i = 0; i < 200; i++) {
        const t = types[i % types.length];
        if (!s.game.spawnUnit(t, i % 2, hq.x + dx + ((i % 20) - 10) * 34, hq.y + dy + 260 + Math.floor(i / 20) * 34)) continue;
      }
    },
    { dx, dy },
  );

/** Zeit je Durchlauf (ms) über n Bilder: renderer.perf summiert lap je Name. */
const timePasses = (g, n) =>
  g.run((n) => {
    const s = window.__frontline.session();
    const r = s.renderer;
    const sum = {};
    const old = r.perf;
    r.perf = {
      lap(name, t) {
        const now = performance.now();
        sum[name] = (sum[name] ?? 0) + now - t;
        return now;
      },
      addRender() {},
    };
    for (let i = 0; i < 2; i++) r.render(s.controller.view); // warm (Shader, Sprites)
    for (const k of Object.keys(sum)) delete sum[k];
    const t0 = performance.now();
    for (let i = 0; i < n; i++) r.render(s.controller.view);
    const total = (performance.now() - t0) / n;
    r.perf = old;
    const out = { Bild: total };
    for (const [k, v] of Object.entries(sum)) out[k] = v / n;
    return out;
  }, n);

async function measure() {
  const g = await openGame({ seed: 3, query: 'iso=1&three=1', scale: 1, out });
  try {
    await g.run(() => (window.__frontline.session().loop.paused = true));
    await spawnArmy(g);
    await view(g, 0, 1, 0, 420);
    const modes = [['Iso', false, null], ['3D Aus', true, 'off'], ['3D Mittel', true, 'mid'], ['3D Hoch', true, 'high']];
    const rows = [];
    for (const [label, three, level] of modes) {
      await g.run(({ three, level }) => {
        const s = window.__frontline.session();
        s.camera.three = three;
        if (level) s.renderer.setShadows?.(level);
      }, { three, level });
      rows.push([label, await timePasses(g, frames)]);
      await g.shot(`messung-${label.replace(' ', '-').toLowerCase()}`);
    }
    const names = ['Bild', 'Gelände', 'Boden', 'Schatten', 'Objekte', 'Flieger', 'Nebel', 'Wetter', 'Balken'];
    console.log(`Messung (Seed 3, 200 Einheiten, ${frames} Bilder, ms je Bild; Software-WebGL):`);
    console.log(`  ${'Durchlauf'.padEnd(10)}${rows.map(([l]) => l.padStart(11)).join('')}`);
    for (const n of names) console.log(`  ${n.padEnd(10)}${rows.map(([, r]) => (r[n] === undefined ? '–' : r[n].toFixed(1)).padStart(11)).join('')}`);
    return rows;
  } finally {
    errors.push(...g.errors);
    await g.close();
  }
}

/** Steilste befahrbare Stelle (Feinraster) im Umkreis r um (x, y): für den Panzer am Hang. */
const slopeSpot = (g, r) =>
  g.run((r) => {
    const s = window.__frontline.session();
    const rel = s.game.relief;
    const hq = s.game.buildings.find((b) => b.main && b.team === 0);
    let best = null;
    for (let y = hq.y - r; y <= hq.y + r; y += 32) {
      for (let x = hq.x - r; x <= hq.x + r; x += 32) {
        if (x < 200 || y < 200 || x > s.camera.mapW - 200 || y > s.camera.mapH - 200) continue;
        const h = rel.heightAt(x, y);
        if (h <= 10) continue;
        const k = Math.hypot(rel.heightAt(x + 32, y) - rel.heightAt(x - 32, y), rel.heightAt(x, y + 32) - rel.heightAt(x, y - 32)) / 64;
        if (k < 0.3 && (!best || k > best.k)) best = { x, y, k }; // steil, aber befahrbar (Fels ab RELIEF.rock)
      }
    }
    return best;
  }, r);

async function shadows() {
  const g = await openGame({ seed: 7, query: 'iso=1&three=1&shadows=high', scale: 1, out });
  try {
    const spot = await g.run(() => {
      const s = window.__frontline.session();
      s.loop.paused = true;
      s.renderer.revealAll = true;
      const hq = s.game.buildings.find((b) => b.main && b.team === 0);
      const x = hq.x + 380;
      const y = hq.y + 380;
      const add = (t, team, dx, dy, a) => {
        const u = s.game.spawnUnit(t, team, x + dx, y + dy);
        if (u) u.angle = a;
        return u;
      };
      add('tank', 0, 0, 0, 0.4);
      add('ifv', 1, -90, 40, 2.2);
      add('truck', 0, 60, -80, 1.2);
      for (let i = 0; i < 6; i++) add('rifleman', i % 2, 70 + (i % 3) * 16, 40 + Math.floor(i / 3) * 18, 3);
      add('gunship', 0, -40, -70, 0.8);
      return { x, y };
    });
    // 1. Fotos je Drehung: Iso und 3D in jeder Stufe
    for (let rot = 0; rot < 4; rot++) {
      for (const [label, three, level] of [['iso', false, 'off'], ['aus', true, 'off'], ['mittel', true, 'mid'], ['hoch', true, 'high']]) {
        await g.run(({ rot, three, level, spot }) => {
          const s = window.__frontline.session();
          s.camera.three = three;
          s.renderer.setShadows(level);
          s.camera.rot = rot;
          s.camera.zoom = 2;
          s.camera.centerOn(spot.x, spot.y);
          for (let i = 0; i < 4; i++) s.renderer.render(s.controller.view);
        }, { rot, three, level, spot });
        await g.shot(`schatten-rot${rot}-${label}`);
      }
    }
    // 2. Panzer am Hang, mit und ohne Schatten; Helligkeit im Schatten gegen daneben
    const hill = await slopeSpot(g, 2400);
    if (!hill) throw new Error('kein Hang in der Nähe der Hauptstadt');
    const dark = await g.run((hill) => {
      const s = window.__frontline.session();
      const u = s.game.spawnUnit('tank', 0, hill.x, hill.y);
      if (!u) return null;
      u.angle = 0.9;
      s.camera.rot = 0;
      s.camera.zoom = 2.4;
      s.camera.three = true;
      s.camera.centerOn(u.x, u.y); // spawnUnit kann auf einen freien Platz ausweichen
      const r = s.renderer;
      const c = r.canvas;
      const grab = (level) => {
        r.setShadows(level);
        for (let i = 0; i < 3; i++) r.render(s.controller.view);
        return c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      };
      // Schattenrichtung im Bild: Fußpunkt gegen Punkt eine Panzerhöhe weiter von der Sonne weg
      const L = r.lightVec();
      const len = 14 / Math.tan(Math.asin(L[2]));
      const p0 = s.camera.worldToScreen(u.x, u.y);
      const p1 = s.camera.worldToScreen(u.x - L[0] / Math.hypot(L[0], L[1]) * len, u.y - L[1] / Math.hypot(L[0], L[1]) * len);
      const lum = (d, x, y) => {
        let sum = 0;
        let n = 0;
        for (let j = -3; j <= 3; j++) {
          for (let i = -3; i <= 3; i++) {
            const k = (Math.round(y * r.dpr + j) * c.width + Math.round(x * r.dpr + i)) * 4;
            sum += d[k] + d[k + 1] + d[k + 2];
            n++;
          }
        }
        return sum / n / 3;
      };
      const off = grab('off');
      const on = grab('high');
      const q = { x: p1.x + (p1.x - p0.x) * 0.4, y: p1.y + (p1.y - p0.y) * 0.4 }; // hinter dem Panzer im Schatten
      const k = Math.hypot(s.game.relief.heightAt(u.x + 32, u.y) - s.game.relief.heightAt(u.x - 32, u.y), s.game.relief.heightAt(u.x, u.y + 32) - s.game.relief.heightAt(u.x, u.y - 32)) / 64;
      return { off: lum(off, q.x, q.y), on: lum(on, q.x, q.y), slope: k };
    }, hill);
    if (!dark) throw new Error('Panzer am Hang nicht gesetzt');
    await g.shot('schatten-hang-hoch');
    await g.run(() => {
      const s = window.__frontline.session();
      s.renderer.setShadows('off');
      for (let i = 0; i < 3; i++) s.renderer.render(s.controller.view);
    });
    await g.shot('schatten-hang-aus');
    const ok = dark.on < dark.off * 0.9;
    if (!ok) fail++;
    console.log(`Schatten am Hang (Neigung ${dark.slope.toFixed(2)}): Helligkeit hinter dem Panzer Aus ${dark.off.toFixed(0)}, Hoch ${dark.on.toFixed(0)}${ok ? '' : '  ZU HELL'}`);
    // 3. Verschieben: Größe der Schattenkarte gleich, Mitte auf dem Texel-Raster
    const pan = await g.run((spot) => {
      const s = window.__frontline.session();
      const r = s.renderer;
      r.setShadows('mid');
      s.camera.rot = 1;
      s.camera.zoom = 1;
      const seen = [];
      for (let i = 0; i < 12; i++) {
        s.camera.centerOn(spot.x + i * 13.7, spot.y - i * 7.3);
        r.render(s.controller.view);
        const f = r.sun.info;
        seen.push({ w: f.w, h: f.h, gr: Math.abs(f.cr / (f.w / 1024) - Math.round(f.cr / (f.w / 1024))), gu: Math.abs(f.cu / (f.h / 1024) - Math.round(f.cu / (f.h / 1024))) });
      }
      return seen;
    }, spot);
    const same = pan.every((p) => p.w === pan[0].w && p.h === pan[0].h);
    const grid = pan.every((p) => p.gr < 1e-3 && p.gu < 1e-3);
    if (!same || !grid) fail++;
    console.log(`Verschieben (12 Schritte): Karte ${pan[0].w}×${pan[0].h} Welt-px ${same ? 'gleich' : 'ÄNDERT SICH'}, Texel-Raster ${grid ? 'eingehalten' : 'VERLETZT'}`);
    // 4. Nacht: Dunkelheit bleibt drawMood, Schatten schwächer
    await g.run((spot) => {
      const s = window.__frontline.session();
      s.renderer.mood = 'night';
      s.renderer.setShadows('high');
      s.camera.rot = 0;
      s.camera.zoom = 2;
      s.camera.centerOn(spot.x, spot.y);
      for (let i = 0; i < 3; i++) s.renderer.render(s.controller.view);
    }, spot);
    await g.shot('schatten-nacht-hoch');
  } finally {
    errors.push(...g.errors);
    await g.close();
  }
}

try {
  if (!only || only === 'kamera') await camera();
  if (!only || only === 'vergleich') await compare();
  if (!only || only === 'speicher') await memory();
  if (!only || only === 'messung') await measure();
  if (!only || only === 'schatten') await shadows();
} catch (e) {
  console.error(`Abbruch: ${e.message}`);
  fail++;
}
if (errors.length) console.error(`Browserfehler:\n${errors.join('\n')}`);
if (fail || errors.length) {
  console.error(`smoke-3d: ${fail} Prüfungen fehlgeschlagen, ${errors.length} Browserfehler`);
  process.exit(1);
}
console.log(`smoke-3d: alles in Ordnung, keine Browserfehler; Fotos in ${out}/`);
