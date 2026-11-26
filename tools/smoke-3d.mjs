// Browser-Prüfung des 3D-Gerüsts (Plan docs/plan-3d.md): öffnet das Spiel mit ?three=1&cubes=1&iso=1 und vergleicht für jeden
// Prüfwürfel (render3d/testscene.js) die Bildlage aus three (Vector3.project) mit camera.worldToScreen, in allen 4 Drehungen und
// bei Zoom 0,35, 1 und 1,6. Fehler, wenn eine Abweichung 1 px erreicht oder der Browser Fehler meldet. Fotos nach .smoke/3d/.
//
// Aufruf (im Repo-Wurzelordner):  node tools/smoke-3d.mjs [--seed 3] [--out .smoke/3d] [--scale 2]
import { openGame } from './smoke.mjs';

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
};
const seed = Number(arg('seed', 3));
const out = arg('out', '.smoke/3d');
const scale = Number(arg('scale', 2));
const ZOOMS = [0.35, 1, 1.6];
const LIMIT = 1; // px

const g = await openGame({ seed, query: 'three=1&cubes=1&iso=1', scale, out });
let fail = 0;
try {
  const has3D = await g.run(() => typeof window.__frontline.session().renderer.probe === 'function');
  if (!has3D) throw new Error('kein Renderer3D (WebGL fehlt oder three.js nicht geladen)');
  console.log('Drehung  Zoom   größte Abweichung (px)  Würfel');
  for (let rot = 0; rot < 4; rot++) {
    for (const zoom of ZOOMS) {
      // Ansicht setzen, auf die Hauptstadt (sonst Kartenmitte) richten, zwei Bilder abwarten, dann messen
      await g.run(
        ({ rot, zoom }) => {
          const s = window.__frontline.session();
          const cam = s.camera;
          cam.rot = rot;
          cam.zoom = zoom;
          const hq = s.game.buildings.find((b) => b.main && b.team === 0);
          cam.centerOn(hq?.x ?? cam.mapW / 2, hq?.y ?? cam.mapH / 2);
        },
        { rot, zoom },
      );
      await g.page.waitForTimeout(400);
      const res = await g.run(() => window.__frontline.session().renderer.probe());
      if (!res.length) throw new Error('keine Prüfwürfel');
      const worst = res.reduce((a, b) => (b.d > a.d ? b : a));
      if (worst.d >= LIMIT || !Number.isFinite(worst.d)) fail++;
      console.log(`${rot}        ${zoom.toFixed(2).padEnd(5)}  ${worst.d.toFixed(4).padEnd(22)}  ${res.length} (größte: ${worst.name})`);
      await g.shot(`rot${rot}-zoom${zoom}`);
    }
  }
  // Ganze Karte bei kleinstem Zoom: alle Eckwürfel im Bild
  await g.run(() => {
    const s = window.__frontline.session();
    s.camera.rot = 0;
    s.camera.zoom = 0.35;
    s.camera.centerOn(s.camera.mapW / 2, s.camera.mapH / 2);
  });
  await g.page.waitForTimeout(400);
  await g.shot('karte');
  // Nah an einer Kartenecke (Würfel am Hang, Kreuz = camera.worldToScreen muss am Fuß sitzen)
  await g.run(() => {
    const s = window.__frontline.session();
    s.camera.zoom = 1.6;
    s.camera.centerOn(s.camera.mapW - 80, s.camera.mapH - 80);
  });
  await g.page.waitForTimeout(400);
  await g.shot('ecke');
} catch (e) {
  console.error(`Abbruch: ${e.message}`);
  fail++;
} finally {
  if (g.errors.length) console.error(`Browserfehler:\n${g.errors.join('\n')}`);
  await g.close();
}
if (fail || g.errors.length) {
  console.error(`smoke-3d: ${fail} Ansichten über ${LIMIT} px bzw. abgebrochen, ${g.errors.length} Browserfehler`);
  process.exit(1);
}
console.log(`smoke-3d: alle Abweichungen unter ${LIMIT} px, keine Browserfehler; Fotos in ${out}/`);
