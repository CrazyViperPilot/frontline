// Einheiten-Modelle, Familie große Flugzeuge: a10, c130. Einstieg: ../unitpaint.js.
import { WHEEL, METAL, GUN, GLASS, box, prX, prZ, cyl, ball, on, fine } from './shapes.js';
import { hull } from './airparts.js';
import { oval, arch, U2_GLOW } from './u2.js';
import { mix } from '../color.js';

/**
 * A-10 „Thunderbolt II“ (Paket „A-10“): Erdkampfflugzeug mit einer Bordkanone. Gerader, breiter Tiefdecker-Flügel ohne Pfeilung
 * (Außenlasten fest unter den Flügeln gemalt), zwei große runde Triebwerksgondeln hoch hinten am Rumpf, gerades Höhenleitwerk
 * mit zwei Seitenleitwerken an den Enden, stumpfe Nase mit herausragender Kanonenmündung, Kanzel weit vorn.
 * Am Boden (o.gear): Bugrad und Hauptfahrwerk unter dem Flügel. Zustand nur Fahrwerk (lookOf), die Lasten sind fest.
 * Abgasschein wie bei der U-2 (U2_GLOW), zwei Düsen unter den Gondeln.
 */
function a10(P, o) {
  const S = [];
  const body = mix(P.air, '#7d858a', 0.45); // matter Grauton, etwas dunkler als die F-16
  const dark = mix(body, '#000000', 0.25);
  const GUNDARK = '#16181a';
  const BOMB = '#6f735f'; // olivgraue Außenlast
  // Rumpf: hinten schlank, vorn dick, Nase stumpf
  S.push(cyl([-16.5, 0, 4.4], [5, 0, 4.2], 1.9, 2.5, 10, body));
  S.push(cyl([5, 0, 4.2], [14.8, 0, 4.1], 2.5, 2.4, 10, body));
  S.push(cyl([14.8, 0, 4.1], [15.8, 0, 3.9], 2.4, 2.0, 10, body)); // stumpfe Nase
  S.push(cyl([15.2, 0, 3.7], [19.2, 0, 3.7], 0.5, 0.42, 6, GUN)); // Kanonenmündung ragt aus der Nase
  S.push(fine(cyl([18.4, 0, 3.7], [19.2, 0, 3.7], 0.62, 0.5, 6, dark))); // Mündungsbremse
  // Kanzel weit vorn: Haube mit Lichtreflex
  S.push(ball([10.4, 0, 5.2], 3.4, 1.85, 1.5, GLASS, { n: 10, m: 5, half: true }));
  // Flügel: gerade, breit, Tiefdecker (am Rumpfboden); Außenlasten fest unter dem Flügel
  for (const side of [-1, 1]) {
    S.push(prZ([[3.4, 0], [2.6, side * 19.6], [-3.6, side * 19.6], [-4.6, 0]], 2.4, 2.9, body)); // Flügel
    S.push(fine(box(-3.4, 2.4, side * 19.6 - 0.25, side * 19.6 + 0.25, 2.9, 3.0, P.mark, { noLine: true }))); // Flügelspitze in Teamfarbe
    for (const yp of [7.5, 13.5]) {
      S.push(cyl([-0.8, side * yp, 2.4], [-0.8, side * yp, 2.0], 0.3, 0.3, 4, METAL)); // Pylon
      S.push(cyl([-2.6, side * yp, 1.6], [4, side * yp, 1.6], 0.9, 0.9, 8, BOMB)); // Bombe unter dem Flügel
    }
    // Triebwerksgondel hoch hinten, mit dunkler Einlauflippe vorn
    S.push(cyl([-2.4, side * 3.9, 5], [-13.2, side * 3.9, 5], 2, 1.7, 10, body));
    S.push(cyl([-2.2, side * 3.9, 5], [-2.4, side * 3.9, 5], 1.5, 1.5, 10, GUNDARK));
    // Seitenleitwerk am Ende des geraden Höhenleitwerks, leicht nach außen geneigt
    const fy = side * 9.2;
    const fin = prX([[-10.6, 7.5], [-14.4, 10.4], [-16.6, 10.4], [-16.6, 7.5]], fy - 0.35, fy + 0.35, body);
    S.push(fin);
    S.push(fine(on(fin, prX([[-14.2, 9.6], [-14.7, 10.4], [-16.6, 10.4], [-16.4, 9.6]], fy - 0.38, fy + 0.38, P.mark, { noLine: true }))));
  }
  // Gerades Höhenleitwerk (über den Gondeln) zwischen den Seitenleitwerken
  S.push(prZ([[-10.8, -9.6], [-16.6, -9.6], [-16.6, 9.6], [-10.8, 9.6]], 7.1, 7.5, body));
  if (o.gear) {
    for (const [x, y] of [[9.5, 0], [-1.2, -5.4], [-1.2, 5.4]]) {
      S.push(cyl([x, y, 2.3], [x, y, 0.9], 0.25, 0.25, 4, METAL));
      S.push(cyl([x, y - 0.35, 0.8], [x, y + 0.35, 0.8], 0.8, 0.8, 8, WHEEL));
    }
  }
  return { S, nozzle: { x: -13.2, z: 5, ys: [-3.9, 3.9], sy: 0.6, sz: 0.6, len: 0.6, flame: U2_GLOW }, foot: [-17, 16, -19.6, 19.6] };
}

/**
 * C-130 „Hercules“ (Paket „C-130“): Transportflugzeug, unbewaffnet, ohne Nachbrenner. Dicker runder Rumpf, vorn abgerundete Nase mit
 * Cockpitfenstern, hinten nach oben gezogen (die Mitte der Rumpfringe steigt) mit dunkler Laderampe unten. Schulterdecker: gerader,
 * langer Flügel oben am Rumpf, vier Propeller-Triebwerksgondeln unter dem Flügel (flache Scheiben und Naben, ohne Animation), hohes
 * Seitenleitwerk mit Teamfarbe an der Spitze, gerades Höhenleitwerk weit hinten. Seitliche Fahrwerksverkleidungen unten am Rumpf (immer);
 * am Boden (o.gear): Haupträder in den Verkleidungen und Bugrad. Maße: Länge ≈ 65, Spannweite ≈ 89, Höhe ≈ 25 (≈ 2,2 px je Meter).
 */
function c130(P, o) {
  const S = [];
  const body = mix(P.air, '#9aa3a8', 0.5); // helles Grau, etwas heller als die A-10
  const dark = mix(body, '#000000', 0.3);
  const PROP = mix('#5b6168', '#dfe4e7', 0.5); // Propellerscheibe: heller als früher (Mischung mit Hellgrau), damit sie nicht wie Räder wirkt
  const RAMP = '#4a4e52'; // Laderampe
  // Rumpf: Ringe [x, Halbbreite, Halbhöhe, Mitte z]; hinten steigt die Mitte nach oben
  const RING = [
    [28.4, 2.2, 2.7, 7.4],
    [25.2, 3.2, 3.35, 7.4],
    [17, 3.45, 3.5, 7.4],
    [4, 3.48, 3.52, 7.4],
    [-9, 3.42, 3.45, 7.5],
    [-17, 3.2, 3.3, 8.2],
    [-24, 2.7, 2.9, 9.6],
    [-30, 1.9, 2.4, 11.4],
    [-33.2, 1.0, 1.5, 12.2],
  ];
  S.push(...hull([[[31.5, 0, 7.4]], ...RING.map(([x, w, h, z]) => oval(x, w, h, z)), [[-33.9, 0, 12.2]]], body, { smooth: true }));
  // Cockpitfenster: getönter Band oben vorn an der Nase
  S.push(...hull([arch(29, 1.2, 1, 8.75), arch(26, 2.7, 1.95, 8.8)], GLASS, { smooth: true }));
  // Laderampe unten am Heck: dunkle, nach hinten abfallende Klappe
  S.push(prX([[-33.6, 10.6], [-27.4, 9], [-27.4, 8.2], [-33.6, 9.6]], -1.7, 1.7, RAMP));

  for (const side of [-1, 1]) {
    // Flügel: gerade und lang, oben am Rumpf (Schulterdecker), Spitze in Teamfarbe
    S.push(prZ([[6, 0], [3.2, side * 44.5], [-2.8, side * 44.5], [-5.5, 0]], 9.4, 10.9, body));
    const [ya, yb] = side > 0 ? [43.4, 44.9] : [-44.9, -43.4];
    S.push(fine(box(-2.5, 2.6, ya, yb, 10.9, 11.2, P.mark, { noLine: true })));
    // Vier Triebwerksgondeln unter dem Flügel mit Propellerscheibe und Spinner vorn
    for (const yp of [15, 31]) {
      const y = side * yp;
      S.push(cyl([9.8, y, 7], [-7, y, 7], 2.5, 2.3, 10, body)); // Gondel
      S.push(cyl([-7, y, 7], [-10, y, 7.3], 2.3, 1.1, 8, body)); // Heckkonus
      S.push(cyl([9.8, y, 7], [12.2, y, 7], 2.1, 0.35, 10, METAL)); // Spinner
      S.push(cyl([10.9, y, 7], [11.2, y, 7], 2.25, 2.25, 12, PROP)); // Propellerscheibe (flach, halber Radius, ohne Animation)
    }
    // Seitliche Fahrwerksverkleidung unten am Rumpf; am Boden das Hauptrad darin
    S.push(cyl([-14.5, side * 3.6, 4.1], [-2, side * 3.6, 4.1], 1.45, 1.45, 8, body));
    if (o.gear) S.push(cyl([-7, side * 3, 2.2], [-7, side * 4.2, 2.2], 2.2, 2.2, 10, WHEEL));
  }

  // Hohes Seitenleitwerk: Vorderkante nach hinten geneigt, gerade Spitze, Teamfarbe als Band an der Spitze
  const fin = prX([[-12.5, 10], [-19.2, 25.5], [-24.6, 25.5], [-29.6, 14], [-29.6, 9], [-12.5, 9]], -0.55, 0.55, body);
  S.push(fin);
  S.push(fine(on(fin, prX([[-18.5, 22.5], [-19.2, 25.5], [-24.6, 25.5], [-25.6, 22.5]], -0.6, 0.6, P.mark, { noLine: true }))));
  // Gerades Höhenleitwerk weit hinten, quer über den Heckkonus
  S.push(prZ([[-19.5, -17.5], [-27.5, -17.5], [-27.5, 17.5], [-19.5, 17.5]], 12, 13, body));

  if (o.gear) S.push(cyl([22, 0, 3.6], [22, 0, 1.2], 0.28, 0.28, 4, METAL), cyl([22, -0.55, 1.2], [22, 0.55, 1.2], 1.2, 1.2, 8, WHEEL)); // Bugfahrwerk
  return { S, foot: [-34, 32, -45, 45] };
}

export { a10, c130 };
