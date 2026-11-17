// Einheiten-Modelle, Familie Kampfpanzer und Flugabwehr auf Ketten: tank, ifv, flak, sam, gepard. Einstieg: ../unitpaint.js.
import { METAL, GUN, GLASS, OLIVE, WHITE, box, prX, prZ, loft, cyl, on, fine, tracks, lowerHull, camo, camoSides, lights, antenna } from './shapes.js';

// ---------- Modelle: Fahrzeuge ----------
// Ketten unten, darauf die obere Wanne mit schrägem Bug, Türme mit schrägen Seiten (loft) und hellerer Dachplatte.

function tank(P) {
  const S = [];
  for (const side of [-1, 1]) tracks(S, side, -17, 17, 6.2, 10, 4.8, P, { wheels: 7, skirt: [-13, 16.4], fender: 9.2 });
  S.push(lowerHull(-17, 17.8, 6.2, 4.6, P));
  const hull = prX([[-17.2, 4.6], [-17.4, 7.2], [7.5, 7.2], [17.8, 4.6]], -9.2, 9.2, P.body);
  S.push(hull);
  const deck = fine(on(hull, box(-16.9, -9, -6.6, 6.6, 7.2, 7.4, P.dark))); // Motordeck
  S.push(deck);
  for (const x of [-16, -13.8, -11.6]) S.push(fine(on(deck, box(x, x + 1.3, -5.8, 5.8, 7.4, 7.5, METAL, { noLine: true })))); // Lüftergitter
  S.push(fine(on(hull, box(7.6, 9.6, 1.4, 4.2, 7.2, 7.45, METAL)))); // Fahrerluke
  lights(S, hull, 17, 8, 4.9, -17.4, 6.2);
  camoSides(S, hull, 9.2, [[-15, 5, 5.6, 6.9], [-4, 4, 5.4, 7], [3, 3.5, 5.6, 6.8]], P.camo);
  const T = [];
  const tur = loft(
    [[-11.5, -6.6], [2.5, -7.6], [11, -2.4], [11, 2.4], [2.5, 7.6], [-11.5, 6.6]],
    [[-10.8, -5.8], [2, -6.8], [9.6, -2], [9.6, 2], [2, 6.8], [-10.8, 5.8]],
    7.2, 10.4, P.body,
  );
  T.push(tur);
  const roof = on(tur, prZ([[-10, -5], [1.6, -5.9], [8.2, -1.6], [8.2, 1.6], [1.6, 5.9], [-10, 5]], 10.4, 10.6, P.light));
  T.push(roof);
  const bustle = box(-15, -11, -5.8, 5.8, 7.8, 10, P.dark); // Staukorb
  T.push(bustle);
  T.push(fine(on(bustle, box(-14.7, -11.3, -5.4, 5.4, 10, 10.5, OLIVE, { noLine: true }))));
  T.push(box(9.4, 12, -1.9, 1.9, 7.6, 10.2, P.dark)); // Blende
  T.push(cyl([12, 0, 8.9], [33, 0, 8.9], 0.85, 0.72, 8, GUN)); // Rohr 120 mm
  T.push(cyl([12, 0, 8.9], [17, 0, 8.9], 1.05, 1, 8, GUN));
  T.push(cyl([19.5, 0, 8.9], [23, 0, 8.9], 1.3, 1.3, 8, GUN)); // Rauchabsauger
  T.push(fine(on(roof, cyl([-6.8, 3.4, 10.6], [-6.8, 3.4, 11], 1.7, 1.7, 10, P.dark)))); // Luken
  T.push(fine(on(roof, cyl([-6.8, -3.4, 10.6], [-6.8, -3.4, 11], 1.5, 1.5, 10, P.dark))));
  T.push(on(roof, cyl([-3.2, 3.9, 10.6], [-3.2, 3.9, 12.1], 0.95, 0.95, 8, METAL))); // Rundblickoptik
  const peri = on(roof, box(-4.2, -2, 2.9, 4.9, 12.1, 13.3, METAL));
  T.push(peri);
  T.push(fine(on(peri, box(-2, -1.85, 3.2, 4.6, 12.35, 13.05, GLASS, { noLine: true }))));
  const sight = on(roof, box(3.2, 6.2, -5.4, -3.4, 10.6, 11.8, METAL)); // Zieloptik
  T.push(sight);
  T.push(fine(on(sight, box(6.2, 6.35, -5.1, -3.7, 10.9, 11.5, GLASS, { noLine: true }))));
  T.push(on(roof, cyl([-6.4, -3.4, 11.5], [0.5, -3.7, 11.7], 0.28, 0.25, 4, GUN))); // MG
  for (const side of [-1, 1]) for (let i = 0; i < 4; i++) T.push(fine(cyl([-4.5 + i * 1.25, side * 6.1, 9.5], [-4.2 + i * 1.25, side * 7.3, 10.2], 0.4, 0.4, 6, P.dark))); // Nebelwurfbecher
  antenna(T, roof, -9.6, -4.4, 10.6, 20, P);
  camo(T, roof, [[-8, -3.6, 4.5, 2.6], [-1, 1.2, 4, 2.4]], 10.6, P.camo);
  return { S, turret: { x: -2, S: T }, foot: [-17.8, 17.8, -10.5, 10.5] };
}

function ifv(P) {
  const S = [];
  for (const side of [-1, 1]) tracks(S, side, -15, 15, 5.6, 9.2, 4.4, P, { wheels: 6, skirt: [-13.4, 13.6], fender: 8.6 });
  S.push(lowerHull(-15, 15.8, 5.6, 4.2, P));
  const hull = prX([[-15, 4.2], [-15.2, 8.6], [4.5, 8.6], [15.8, 5], [15.6, 4.2]], -8.6, 8.6, P.body);
  S.push(hull);
  S.push(fine(on(hull, box(-15.45, -15.25, -5.6, 5.6, 5, 8.1, P.dark, { only: 'iso' })))); // Heckklappe
  S.push(fine(on(hull, box(1.4, 4.2, -6.6, -3.4, 8.6, 8.85, METAL)))); // Fahrerluke
  S.push(fine(on(hull, box(-14, -6, -7.4, -6.2, 8.6, 9.1, P.dark)))); // Staukasten
  S.push(fine(on(hull, box(-14, -6, 6.2, 7.4, 8.6, 9.1, P.dark))));
  lights(S, hull, 15.4, 7, 5.3, -15.2, 7.2);
  camoSides(S, hull, 8.6, [[-13, 5, 5.6, 7.6], [-2, 4.5, 5.8, 8.2]], P.camo);
  const T = [];
  const tur = loft(
    [[-6.5, -5.2], [3.5, -5.2], [7, -2.8], [7, 2.8], [3.5, 5.2], [-6.5, 5.2]],
    [[-5.8, -4.4], [3, -4.4], [6, -2.2], [6, 2.2], [3, 4.4], [-5.8, 4.4]],
    8.6, 10.8, P.body,
  );
  T.push(tur);
  const roof = on(tur, prZ([[-5.2, -3.8], [2.6, -3.8], [5.2, -1.8], [5.2, 1.8], [2.6, 3.8], [-5.2, 3.8]], 10.8, 11, P.light));
  T.push(roof);
  T.push(cyl([6, 0.8, 9.8], [9.5, 0.8, 9.8], 0.95, 0.95, 8, GUN)); // Waffenblende
  T.push(cyl([9.5, 0.8, 9.8], [21.5, 0.8, 9.8], 0.6, 0.52, 6, GUN)); // 30-mm-Kanone
  T.push(box(-4, 2.5, 5.2, 7.2, 9.3, 11.3, OLIVE)); // Lenkflugkörper
  T.push(fine(box(2.5, 2.65, 5.6, 6.8, 9.7, 10.9, '#3a3d33', { noLine: true })));
  const peri = on(roof, box(-3, 0.4, -4, -1.6, 11, 12.8, METAL)); // Kommandantenoptik
  T.push(peri);
  T.push(fine(on(peri, box(0.4, 0.55, -3.7, -1.9, 11.4, 12.4, GLASS, { noLine: true }))));
  antenna(T, roof, -5, 3.6, 11, 18.5, P);
  camo(T, roof, [[-4.4, -3, 3.5, 2.4], [0.6, 0.8, 2.6, 2]], 11, P.camo);
  return { S, turret: { x: -1, S: T }, foot: [-15.8, 15.8, -9.7, 9.7] };
}

/** Leichtes Kettenfahrzeug (Flak, SAM): Wanne 25 × 16. */
function lightHull(P, S) {
  for (const side of [-1, 1]) tracks(S, side, -12, 12, 4.8, 8, 4, P, { wheels: 4 });
  S.push(lowerHull(-12, 12.8, 4.8, 3.8, P));
  const hull = prX([[-12, 3.8], [-12.2, 6.8], [4, 6.8], [12.8, 4.2], [12.6, 3.8]], -7.6, 7.6, P.body);
  S.push(hull);
  S.push(fine(on(hull, box(-11.8, -7, -5.4, 5.4, 6.8, 7, P.dark)))); // Motordeck
  S.push(fine(on(hull, box(0.8, 3.4, -6.4, -3.8, 6.8, 7, METAL)))); // Fahrerluke
  lights(S, hull, 12.4, 5.8, 4.4, -12.2, 5.6);
  camoSides(S, hull, 7.6, [[-10, 4.5, 4.3, 6.3], [1, 3.5, 4.5, 6.5]], P.camo);
  return hull;
}

function flak(P) {
  const S = [];
  lightHull(P, S);
  const T = [];
  const tur = cyl([0, 0, 6.8], [0, 0, 10.2], 5, 4.6, 12, P.body);
  T.push(tur);
  const top = on(tur, cyl([0, 0, 10.2], [0, 0, 10.45], 4.3, 4.3, 12, P.light));
  T.push(top);
  T.push(on(top, box(-2.2, 1, -1.5, 1.5, 10.45, 11.4, METAL)));
  T.push(on(top, cyl([-3.2, 0, 10.45], [-3.2, 0, 12.2], 0.35, 0.35, 4, METAL))); // Radar
  T.push(on(top, box(-3.8, -2.6, -2.4, 2.4, 12.1, 13.6, '#b9bdb2')));
  for (const side of [-1, 1]) {
    T.push(box(-1, 4, side * 2.6 - 1, side * 2.6 + 1, 8.2, 10.6, P.dark)); // Waffenwiege
    T.push(cyl([3, side * 2.6, 9.4], [16, side * 2.6, 9.4], 0.5, 0.45, 6, GUN));
    T.push(cyl([14.6, side * 2.6, 9.4], [16.2, side * 2.6, 9.4], 0.75, 0.75, 6, GUN));
  }
  T.push(fine(box(-4.6, -2, -5.3, -3.1, 7.6, 9.8, OLIVE))); // Munition
  return { S, turret: { x: -1.5, S: T }, foot: [-12.8, 12.8, -8, 8] };
}

function sam(P) {
  const S = [];
  lightHull(P, S);
  const T = [];
  T.push(cyl([0, 0, 6.8], [0, 0, 8.6], 4, 4, 12, P.dark));
  T.push(box(-1.5, 1.5, -1.2, 1.2, 8.6, 10.6, METAL));
  for (const side of [-1, 1]) {
    // Startbehälter, leicht angestellt
    const pod = prX([[-5, 9.4], [-5, 12.6], [8, 13.6], [8, 10.4]], side < 0 ? -5.4 : 1.6, side < 0 ? -1.6 : 5.4, WHITE);
    T.push(pod);
    for (const y of [side * 2.5, side * 4.5]) for (const z of [11.2, 12.8]) T.push(fine(on(pod, cyl([8, y, z], [8.3, y, z], 0.7, 0.7, 6, '#9a2f2a', { noLine: true })))); // Rohrdeckel
    T.push(fine(on(pod, box(-1, 1, side < 0 ? -5.5 : 5.4, side < 0 ? -5.4 : 5.5, 10.4, 12.6, P.mark, { noLine: true, only: 'iso' }))));
  }
  const eye = box(-3, 0.5, -1, 1, 10.6, 12.6, P.body); // Zielgerät
  T.push(eye);
  T.push(fine(on(eye, box(0.5, 0.7, -0.7, 0.7, 11.2, 12.2, GLASS, { noLine: true }))));
  return { S, turret: { x: -1.5, S: T }, foot: [-12.8, 12.8, -8, 8] };
}

function gepard(P) {
  const S = [];
  for (const side of [-1, 1]) tracks(S, side, -15.5, 15.5, 6, 9.5, 4.8, P, { wheels: 7, skirt: [-12, 14.2], fender: 8.8 });
  S.push(lowerHull(-15.5, 16.4, 6, 4.6, P));
  const hull = prX([[-15.6, 4.6], [-15.8, 7.2], [6.5, 7.2], [16.4, 4.6]], -8.8, 8.8, P.body);
  S.push(hull);
  const deck = fine(on(hull, box(-15.4, -8.5, -6.4, 6.4, 7.2, 7.4, P.dark)));
  S.push(deck);
  for (const x of [-14.6, -12.4]) S.push(fine(on(deck, box(x, x + 1.3, -5.6, 5.6, 7.4, 7.5, METAL, { noLine: true }))));
  S.push(fine(on(hull, box(6.6, 8.6, 1.4, 4.2, 7.2, 7.45, METAL))));
  lights(S, hull, 15.8, 7.4, 4.9, -15.8, 6.2);
  camoSides(S, hull, 8.8, [[-14, 5, 5.6, 6.9], [-2, 4, 5.5, 7]], P.camo);
  const T = [];
  const tur = loft(
    [[-8.5, -6.2], [5.5, -6.2], [8.4, -3.6], [8.4, 3.6], [5.5, 6.2], [-8.5, 6.2]],
    [[-8, -5.6], [5, -5.6], [7.6, -3.2], [7.6, 3.2], [5, 5.6], [-8, 5.6]],
    7.2, 12, P.body,
  );
  T.push(tur);
  const roof = on(tur, prZ([[-7.4, -5], [4.6, -5], [6.8, -2.8], [6.8, 2.8], [4.6, 5], [-7.4, 5]], 12, 12.25, P.light));
  T.push(roof);
  for (const side of [-1, 1]) {
    T.push(box(-3, 5.5, side < 0 ? -8.4 : 6, side < 0 ? -6 : 8.4, 8.4, 11.6, P.dark)); // Waffenkasten
    T.push(cyl([5.5, side * 7.2, 10.1], [24, side * 7.2, 10.1], 0.58, 0.5, 6, GUN));
    T.push(cyl([22.5, side * 7.2, 10.1], [24.5, side * 7.2, 10.1], 0.95, 0.95, 6, GUN));
  }
  T.push(cyl([8.2, 0, 10], [9.8, 0, 10], 2, 2, 12, METAL)); // Folgeradar
  T.push(on(roof, cyl([-5.5, 0, 12.25], [-5.5, 0, 14.2], 0.5, 0.5, 6, METAL))); // Mast
  const radar = on(roof, box(-6.4, -4.8, -5.4, 5.4, 14, 16.4, '#b9bdb2')); // Suchradar
  T.push(radar);
  T.push(fine(on(radar, box(-4.8, -4.6, -4.8, 4.8, 14.4, 16, '#8e9389', { noLine: true }))));
  T.push(fine(on(roof, cyl([0, 3, 12.25], [0, 3, 12.6], 1.4, 1.4, 10, P.dark))));
  camo(T, roof, [[-3, -4.4, 4, 2.4], [1, 1.8, 3, 2.6]], 12.25, P.camo);
  return { S, turret: { x: -1, S: T }, foot: [-16.4, 16.4, -10, 10] };
}

export { tank, ifv, flak, sam, gepard };
