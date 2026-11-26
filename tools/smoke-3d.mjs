// Browser-Prüfung der 3D-Ansicht (Plan docs/plan-3d.md), drei Teile; Fotos nach .smoke/3d/, Exit-Code 1 bei Fehlern:
// 1. Kamera (Paket „3D-Gerüst“): ?three=1&cubes=1&iso=1 zeigt Prüfwürfel (render3d/testscene.js) auf dem 3D-Gelände; ihre Bildlage
//    aus three (Vector3.project) muss in allen 4 Drehungen und bei Zoom 0,35, 1 und 1,6 unter 1 px von camera.worldToScreen liegen.
// 2. Iso gegen 3D (Pakete „3D-Boden“, „Billboard-Brücke“): je Seed (3, 7), Jahreszeit (Sommer, Winter), Drehung und Zoom dasselbe Bild
//    einmal klassisch (Iso) und einmal mit three (3D), Fotos …-iso.png / …-3d.png und Anteil abweichender Pixel (Kanal > 40).
//    Fehler, wenn mehr als MAX_DIFF % der Pixel abweichen.
// 3. Speicher (Billboard-Brücke): --minutes lang (Standard 1) zoomen und schieben in 3D; Atlasseiten, Leerungen, Sprite-Pixel und
//    JS-Speicher am Anfang und Ende. Fehler, wenn mehr als 4 Atlasseiten entstehen.
//
// Aufruf (im Repo-Wurzelordner):  node tools/smoke-3d.mjs [--out .smoke/3d] [--scale 2] [--minutes 5] [--only kamera|vergleich|speicher]
import { openGame } from './smoke.mjs';

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
};
const out = arg('out', '.smoke/3d');
const scale = Number(arg('scale', 2));
const minutes = Number(arg('minutes', 1));
const only = arg('only', null);
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

try {
  if (!only || only === 'kamera') await camera();
  if (!only || only === 'vergleich') await compare();
  if (!only || only === 'speicher') await memory();
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
