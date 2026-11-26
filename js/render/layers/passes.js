// Durchläufe des Renderers als Listen (Paket „Renderer-Durchläufe“): je Ansicht eine feste Reihenfolge von Einträgen
// { name, run(r, f), when?(f) }. name ist der Name der Ebene in der Messanzeige (ui/perfmeter.js, F3); run zeichnet mit dem
// Renderer r und den Werten des Bildes f (layers/core.js frameOf); when (wahlfrei) schaltet einen ganzen Durchlauf ab, z. B. bei der
// Detailstufe (f.lodFx, f.lodUnit). Detailstufen einzelner Objekte (kleine Effekte, Einheit als Symbol) bleiben in den Durchläufen.
// runPasses misst jeden Eintrag an genau einer Stelle und nur, wenn die Messanzeige an ist (r.perf).
// Importiert core.js nicht (kein Zyklus); core.js hängt die Methoden ein, auf die run über r zugreift.
import { drawCityBadges } from '../citylayer.js';

/** 2D von oben: Boden, Objekte, Effekte, Nebel, Wetter (Bildschirmkoordinaten), Balken, Bildschirmanzeigen. */
export const TOP_PASSES = [
  { name: 'Boden', run: (r, f) => r.topGround(f) },
  { name: 'Objekte', run: (r, f) => r.topObjects(f) },
  { name: 'Leitungen', run: (r, f) => r.drawPowerWires(f) },
  { name: 'Effekte', run: (r, f) => r.topEffects(f) },
  { name: 'Nebel', run: (r, f) => r.topFog(f) },
  { name: 'Wetter', run: (r, f) => r.drawSky(f) }, // Regen, Schnee und Nebel über der Welt, in Bildschirmkoordinaten
  {
    name: 'Balken',
    run: (r, f) => {
      r.worldTransform(f); // nach dem Wetter wieder die Welt-Transformation
      r.topBars(f);
    },
  },
  { name: 'Anzeigen', run: (r, f) => r.topScreen(f) },
];

/** Iso: Boden, Bodenmarken, Objekte nach Tiefe (Sortierung, Schatten, Zeichnen), Schilder, Flieger, Effekte, Nebel, Wetter, Balken, Anzeigen. */
export const ISO_PASSES = [
  { name: 'Boden', run: (r, f) => r.isoGround(f) },
  { name: 'Markierungen', run: (r, f) => r.isoMarks(f) },
  {
    name: 'Sortierung',
    run: (r, f) => {
      const { items, air } = r.isoItems(f);
      f.items = items; // für Schatten und Objekte
      f.air = air; // Flieger: über allen Gebäuden
    },
  },
  { name: 'Schatten', run: (r, f) => r.isoShadows(f, f.items) },
  { name: 'Objekte', run: (r, f) => r.isoObjects(f, f.items) },
  { name: 'Leitungen', run: (r, f) => r.drawPowerWires(f) }, // Hochspannungsleitungen über allen Objekten (feste Karten)
  {
    name: 'Schilder', // Stadt: Schilder über den Dächern (über allen Gebäuden)
    run: (r, f) => {
      f.ctx.setTransform(f.dpr, 0, 0, f.dpr, 0, 0);
      drawCityBadges(r, f.ctx, f.team, f.known, f.inRect, true);
    },
  },
  {
    name: 'Flieger',
    run: (r, f) => {
      for (const u of f.air) r.drawUnitIsoAt(f, u);
    },
  },
  { name: 'Effekte', run: (r, f) => r.isoEffects(f) },
  { name: 'Nebel', run: (r, f) => r.isoFog(f) },
  { name: 'Wetter', run: (r, f) => r.drawSky(f) },
  { name: 'Balken', run: (r, f) => r.isoBars(f) },
  { name: 'Anzeigen', run: (r, f) => r.isoScreen(f) },
];

/**
 * Durchläufe der Reihe nach: Einträge mit when(f) === false überspringen; mit Messanzeige die Zeit je Eintrag (eine Messstelle).
 * skip (wahlfrei): Set mit Namen von Durchläufen, die ein anderer Zeichner übernimmt (Plan „3D mit three.js“, render3d/renderer3d.js).
 */
export function runPasses(r, passes, f, skip = null) {
  const pf = r.perf; // Messanzeige: je Ebene (sonst ohne Kosten)
  let t = pf ? performance.now() : 0;
  for (const p of passes) {
    if (p.when && !p.when(f)) continue;
    if (skip?.has(p.name)) continue;
    p.run(r, f);
    if (pf) t = pf.lap(p.name, t);
  }
}
