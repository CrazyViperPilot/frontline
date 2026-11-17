// Einheiten-Modell F-22 (Tarnkappenjet, Rumpf aus Ringen). Einstieg: ../unitpaint.js.
import { WHEEL, METAL, WHITE, box, prX, loft, cyl, ball, on, fine } from './shapes.js';
import { hull, ring, slab, inset, remap } from './airparts.js';
import { mix } from '../color.js';

// Rumpf der F-22 als Ringe [x, wb, zb, wc, zc, wt, zt, xb]: Nase mit Kante (chine), schräge Einläufe unter der Kanzel, breiter
// Mittelrumpf mit flachem Boden, hinten die Triebwerke. Die Ringe 9.0 → 6.4 bilden die Einläufe (unten außen), dahinter liegen
// in der unteren Seitenfläche die Seitenschächte (x 6.3 … -0.6).
const F22_RINGS = [
  [17.2, 0.35, 3.1, 1.05, 3.78, 0.3, 4.5],
  [13.8, 0.75, 2.55, 1.95, 3.7, 0.62, 5.05],
  [10.6, 1.0, 2.35, 2.75, 3.65, 0.82, 5.38],
  [9.0, 1.1, 2.3, 3.2, 3.65, 0.88, 5.48, 8.3],
  [6.4, 3.7, 2.3, 4.25, 3.7, 1.1, 5.62],
  [3.0, 3.75, 2.3, 4.55, 3.72, 1.4, 5.7],
  [-2.5, 3.6, 2.3, 4.5, 3.76, 1.85, 5.58],
  [-8.0, 3.2, 2.4, 4.05, 3.8, 2.1, 5.32],
  [-12.0, 2.85, 2.55, 3.55, 3.8, 2.2, 5.05],
  [-14.6, 2.55, 2.75, 3.0, 3.8, 2.05, 4.85],
];
/** Wert eines Ringfelds (Index i in F22_RINGS-Zeilen) bei x, linear zwischen den Ringen. */
function f22At(x, i) {
  const R = F22_RINGS;
  for (let j = 0; j + 1 < R.length; j++) {
    const [xa] = R[j];
    const [xb] = R[j + 1];
    if (x <= xa && x >= xb) return R[j][i] + ((R[j + 1][i] - R[j][i]) * (xa - x)) / (xa - xb);
  }
  return R[x > R[0][0] ? 0 : R.length - 1][i];
}
/** Punkt auf der unteren Seitenfläche (Boden → Kante) rechts bei x, t = 0 unten … 1 an der Kante; side −1 spiegelt nach links. */
const f22Side = (x, t, side) => [x, side * (f22At(x, 1) + (f22At(x, 3) - f22At(x, 1)) * t), f22At(x, 2) + (f22At(x, 4) - f22At(x, 2)) * t];
/** Punkt auf dem flachen Rücken bei x (y quer). */
const f22Top = (x, y) => [x, y, f22At(x, 6) + 0.01];

const F22_MISSILES = 6; // Lenkraketen in den Seitenschächten (UNITS.f22, Waffe 'aim'): je Seite drei Startschienen

/**
 * F-22 (seit dem Paket „F-22“): Tarnkappenjäger mit facettiertem Rumpf, rautenförmigen Flügeln, nach außen geneigten Doppel-
 * Seitenleitwerken, trapezförmigen Höhenleitwerken, schrägen Einläufen, goldener Kanzel ohne Rahmen und zwei rechteckigen Schubvektor-
 * düsen. Waffen innen: im Flug sind die Schächte zu (glatte Unterseite). Am Boden (o.gear) stehen die Schächte offen, die
 * Startschienen sind ausgefahren und tragen o.missiles (0 … 6) Lenkraketen, abwechselnd links und rechts von innen nach außen.
 */
function f22(P, o) {
  const S = [];
  const body = mix(P.air, '#565d64', 0.62); // Tarnanstrich, dunkler als die F-16
  const spot = mix(body, '#262b30', 0.16); // zweiter Grauton (Tarnflecken)
  const dark = mix(body, '#000000', 0.3);
  const NOZ = '#55595d';
  const BLACK = '#15171a';
  const GOLD = '#977c3f'; // goldene Tönung der Kanzel
  const open = !!o.gear; // am Boden: Schächte offen
  const ms = open ? Math.max(0, Math.min(F22_MISSILES, o.missiles ?? F22_MISSILES)) : 0;

  // Rumpf: Spitze, dann die Ringe
  S.push(...hull([[[20.5, 0, 3.85]], ...F22_RINGS.map((r) => ring(...r))], body, { smooth: true })); // Facetten nur über das Licht, ohne Fugen
  const inner = [0, 0, 3.6];
  for (const side of [-1, 1]) {
    // Einlauf: schräge Öffnung unter der Kante, oben vorn, unten hinten (Ringe 9.0 → 6.4)
    const lip = [[8.3, side * 1.1, 2.3], [9.0, side * 3.2, 3.65], [6.4, side * 4.25, 3.7], [6.4, side * 3.7, 2.3]];
    S.push(slab(lip, [7.6, 0, 3.6], BLACK, { k: 0.16 }));
    // Klappen der Seitenschächte, im Flug geschlossen (feine Fugen), am Boden als Öffnung
    const door = [f22Side(6.3, 0.18, side), f22Side(6.3, 0.86, side), f22Side(-0.6, 0.86, side), f22Side(-0.6, 0.18, side)];
    S.push(fine(slab(door, inner, open ? BLACK : mix(body, '#000000', 0.12), { k: open ? 0.04 : 0, only: open ? undefined : 'iso' })));
  }
  // Kanzel: golden getönt, ohne Rahmen, dahinter der Rücken
  const can = ball([9.8, 0, 5.15], 4.7, 1.3, 1.95, GOLD, { n: 12, m: 5, half: true });
  S.push(can);
  S.push(fine(on(can, ball([10.9, 0.3, 6.72], 1.7, 0.38, 0.26, '#dcc98e', { n: 8, m: 3, half: true, noLine: true })))); // Lichtreflex
  S.push(...hull([[[6.2, -1.25, 5.5], [6.2, -0.7, 6.15], [6.2, 0.7, 6.15], [6.2, 1.25, 5.5]], [[-7.5, -1.7, 5.3], [-7.5, -0.6, 5.6], [-7.5, 0.6, 5.6], [-7.5, 1.7, 5.3]]], body, { smooth: true }));

  // Flügel (Raute: Vorderkante 42° gepfeilt, Hinterkante nach vorn gepfeilt) und Höhenleitwerke (parallele Kanten), abgeschrägte Kanten
  const WING = [[3.0, 4.5], [-6.3, 15], [-9.5, 15], [-12.9, 3.6]];
  const STAB = [[-12.6, 2.9], [-17.9, 9.3], [-20.2, 9.3], [-21.5, 4.6], [-20.7, 2.9]];
  for (const side of [-1, 1]) {
    const mir = (pl) => pl.map(([x, y]) => [x, y * side]);
    const w = loft(mir(WING), mir(inset(WING, 0.5)), 3.4, 3.82, body);
    S.push(w);
    const pat = side < 0 ? [[-1.8, 6.6], [-3.2, 9], [-6.6, 9.6], [-6, 7]] : [[-2.4, 7.2], [-4.6, 10.4], [-7.4, 9.8], [-5.8, 6.6]];
    S.push(fine(on(w, slab(pat.map(([x, y]) => [x, y * side, 3.82]), [-5, side * 8, 3], spot, { lift: 0.01, t: 0.04 }))));
    const pat2 = side < 0 ? [[-7.2, 11], [-8, 13.6], [-10.2, 13.2], [-9.6, 10.6]] : [[-8.2, 11.6], [-8.8, 13.8], [-10.4, 13.6], [-10.4, 11]];
    S.push(fine(on(w, slab(pat2.map(([x, y]) => [x, y * side, 3.82]), [-9, side * 12, 3], spot, { lift: 0.01, t: 0.04 }))));
    S.push(loft(mir(STAB), mir(inset(STAB, 0.35)), 3.45, 3.78, body));
    // Ausleger neben den Düsen (Lager der Höhenleitwerke)
    S.push(prX([[-14.2, 3.0], [-14.2, 4.55], [-18.4, 4.15], [-20.2, 3.7], [-19, 3.1]], side < 0 ? -3.3 : 2.45, side < 0 ? -2.45 : 3.3, body));
    // Seitenleitwerk, 28° nach außen geneigt, Spitze in Teamfarbe
    const cs = Math.cos(0.49);
    const sn = Math.sin(0.49);
    const cant = ([x, y, z]) => [x, side * (2.75 + y * cs + z * sn), 4.55 - y * sn + z * cs];
    const fin = remap(prX([[-8.4, -0.3], [-12.3, 6], [-15.5, 6], [-17.4, -0.3]], -0.22, 0.22, body), cant);
    S.push(fin);
    S.push(fine(on(fin, remap(prX([[-11.75, 5.1], [-12.3, 6], [-15.5, 6], [-15.8, 5.1]], -0.28, 0.28, P.mark, { noLine: true }), cant))));
    // Schubvektordüse (zweidimensional, rechteckig) mit dunkler Öffnung
    const yc = side * 1.4;
    const noz = prX([[-14.4, 2.95], [-14.4, 4.75], [-18, 4.28], [-18, 3.3]], yc - 1, yc + 1, NOZ);
    S.push(noz);
    S.push(on(noz, slab([[-18, yc - 0.8, 3.42], [-18, yc + 0.8, 3.42], [-18, yc + 0.8, 4.16], [-18, yc - 0.8, 4.16]], [-16, yc, 3.8], BLACK)));
    S.push(fine(on(noz, box(-18, -17.2, yc - 1, yc + 1, 4.28, 4.36, dark, { noLine: true, only: 'top' })))); // Kante der oberen Klappe
  }
  S.push(prX([[-14.4, 3.05], [-14.4, 4.7], [-16.6, 4.1], [-16.6, 3.5]], -0.42, 0.42, body)); // Kiel zwischen den Düsen
  // Tarnflecken auf dem Rücken
  S.push(fine(slab([f22Top(-3, -1.7), f22Top(-3, 0.3), f22Top(-9, 0.9), f22Top(-9.5, -1.2)], [-6, 0, 3.5], spot)));
  S.push(fine(slab([f22Top(2.2, 0.4), f22Top(2.2, 1.3), f22Top(-1.6, 1.7), f22Top(-1.2, 0.2)], [0, 0, 3.5], spot)));

  if (open) {
    // Startschienen an Armen aus dem Schacht, je Seite drei nach außen und unten gestaffelt; Raketen nach Vorrat
    for (let r = 0; r < 3; r++) {
      for (const side of [-1, 1]) {
        const y = side * (5.0 + 1.05 * r);
        const z = 2.85 - 0.68 * r;
        const xf = 8.8 - 0.45 * r; // Spitze der Rakete: weit vorn, damit man sie auch von oben vor der Flügelkante sieht
        const xr = xf - 7.6;
        for (const xa of [xf - 2.4, xr + 1.6]) S.push(cyl(f22Side(xa, 0.5, side), [xa, y, z + 0.5], 0.14, 0.14, 4, METAL, { only: 'iso' })); // Arme
        S.push(box(xr + 0.9, xf - 1.6, y - 0.13, y + 0.13, z + 0.4, z + 0.58, METAL)); // Schiene
        const slot = r * 2 + (side < 0 ? 0 : 1);
        if (slot >= ms) continue;
        S.push(cyl([xr, y, z], [xf - 1.1, y, z], 0.47, 0.47, 6, WHITE)); // Lenkrakete
        S.push(cyl([xf - 1.1, y, z], [xf, y, z], 0.47, 0.06, 6, '#7d8288')); // Suchkopf
        S.push(fine(box(xr, xr + 1.1, y - 1.05, y + 1.05, z - 0.04, z + 0.04, '#9aa0a6', { noLine: true }))); // Leitwerk
        S.push(fine(box(xr + 3.4, xr + 4.4, y - 0.8, y + 0.8, z - 0.04, z + 0.04, '#9aa0a6', { noLine: true }))); // Flügel
        S.push(fine(box(xr, xr + 1.1, y - 0.04, y + 0.04, z - 0.95, z - 0.4, '#9aa0a6', { noLine: true, only: 'iso' })));
      }
    }
    // Klappen des Hauptschachts hängen unter dem Rumpf
    for (const side of [-1, 1]) S.push(box(-2.6, 6.4, side * 2.05 - 0.1, side * 2.05 + 0.1, 0.95, 2.3, dark, { only: 'iso' }));
    // Fahrwerk: Bugrad und Hauptfahrwerk mit Klappen
    S.push(cyl([12.2, 0, 2.5], [12.2, 0, 0.8], 0.25, 0.25, 4, METAL));
    S.push(cyl([12.2, -0.32, 0.75], [12.2, 0.32, 0.75], 0.75, 0.75, 8, WHEEL));
    for (const side of [-1, 1]) {
      S.push(box(10.8, 13.8, side * 0.62 - 0.07, side * 0.62 + 0.07, 1.45, 2.4, body, { only: 'iso' }));
      S.push(cyl([-3.6, side * 3.1, 2.3], [-3.6, side * 3.1, 0.95], 0.28, 0.28, 4, METAL));
      S.push(cyl([-3.6, side * 3.1 - 0.4, 0.95], [-3.6, side * 3.1 + 0.4, 0.95], 0.95, 0.95, 8, WHEEL));
      S.push(box(-5.2, -2, side * 3.75 - 0.07, side * 3.75 + 0.07, 1.25, 2.3, body, { only: 'iso' }));
    }
  }
  return { S, nozzle: { x: -18, z: 3.79, ys: [-1.4, 1.4], sy: 0.8, sz: 0.5 }, foot: [-21.5, 20.5, -15, 15] };
}

export { F22_MISSILES, f22 };
