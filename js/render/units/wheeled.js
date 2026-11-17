// Einheiten-Modelle, Familie Rad- und Baufahrzeuge: truck, scout, jammer, fobTruck, engineer, excavator. Einstieg: ../unitpaint.js.
import { METAL, GUN, GLASS, YELLOW, OLIVE, box, prX, prY, loft, cyl, on, fine, tracks, lowerHull, wheel, camoSides, lights } from './shapes.js';
import { mix } from '../color.js';

function truck(P) {
  const S = [];
  S.push(box(-15, 12, -3.6, 3.6, 2.2, 3.8, METAL, { only: 'iso', under: true })); // Rahmen
  for (const x of [9.5, -5.5, -11]) for (const side of [-1, 1]) S.push(wheel(x, side * 4.4, 2.7, 2.7, 1.8, side));
  const cab = prX([[8, 3.6], [8, 11], [12.5, 11], [15, 8.8], [15.4, 3.6]], -6, 6, P.body);
  S.push(cab);
  S.push(on(cab, box(8.4, 12.3, -5.6, 5.6, 11, 11.3, P.light))); // Dach
  S.push(on(cab, prX([[12.7, 10.6], [14.85, 8.75], [14.9, 7.4], [12.9, 7.4]], -5.2, 5.2, GLASS, { noLine: true })));
  for (const side of [-1, 1]) S.push(on(cab, box(9, 12, side < 0 ? -6.15 : 6, side < 0 ? -6 : 6.15, 7.6, 10.2, GLASS, { noLine: true, only: 'iso' })));
  S.push(box(15.2, 16.2, -6, 6, 3, 4.6, METAL)); // Stoßfänger
  for (const side of [-1, 1]) S.push(fine(box(15.3, 15.6, side * 4.2 - 0.9, side * 4.2 + 0.9, 5, 6, '#e8e2b8', { only: 'iso' })));
  const bed = box(-15.2, 7.4, -6, 6, 3.8, 6.4, P.dark);
  S.push(bed);
  const tarp = prY([[-6, 6.4], [6, 6.4], [6, 11.2], [4.6, 12.8], [-4.6, 12.8], [-6, 11.2]], -14.8, 7, mix(P.body, OLIVE, 0.45));
  S.push(tarp);
  for (const x of [-10, -4.5, 1.5]) S.push(fine(on(tarp, box(x, x + 0.5, -4.5, 4.5, 12.8, 13, mix(P.dark, OLIVE, 0.4), { noLine: true }))));
  S.push(fine(on(tarp, box(-12, 4, -1, 1, 12.8, 13.05, P.mark, { noLine: true })))); // Kennstreifen
  return { S, foot: [-15.5, 16, -6.2, 6.2] };
}

// Aufklärungsfahrzeug (Vorbild Fennek): flacher Spähwagen mit Keilbug, schrägen Seitenwänden, kleiner Fahrerkabine mit
// schräger Frontscheibe, MG auf dem Dach und einem ausfahrbaren Sensormast mit Kamerakopf am Heck. Ohne Mast etwa 5,7 m × 2,5 m × 1,8 m.
function scout(P) {
  const S = [];
  S.push(lowerHull(-13.2, 13.4, 4.8, 3.6, P)); // Unterboden
  for (const x of [8.6, -8.4]) for (const side of [-1, 1]) S.push(wheel(x, side * 5.4, 2.2, 2.2, 1.2, side)); // vier Räder
  // Wanne: unten breiter als oben (schräge Seiten), vorn ein Keil
  const hullBody = loft(
    [[-13.2, -5.2], [10.8, -5.2], [10.8, 5.2], [-13.2, 5.2]],
    [[-12.4, -4.4], [10, -4.4], [10, 4.4], [-12.4, 4.4]],
    3, 6.8, P.body,
  );
  S.push(hullBody);
  const nose = prX([[10.8, 3], [10, 6.8], [13.8, 3.6], [13.8, 3]], -4.8, 4.8, P.body);
  S.push(nose);
  lights(S, nose, 13.8, 4.8, 3.6, -13.2, 4.4);
  S.push(fine(box(13.7, 13.9, -1.4, 1.4, 3.1, 3.5, P.mark, { noLine: true }))); // Teamfarbe: kleine Kennung am Bug
  camoSides(S, hullBody, 4.9, [[-10, 6, 3.2, 4.4], [-2, 5, 3.2, 4.4]], P.camo);
  // Fahrerkabine: schmal, mit schräger Frontscheibe
  const cab = prX([[-7.2, 6.6], [-7.2, 8.6], [2.8, 8.6], [5.4, 6.6]], -4.4, 4.4, P.body);
  S.push(cab);
  S.push(on(cab, box(-6.9, 2.8, -4.4, 4.4, 8.6, 8.8, P.light))); // Dach
  S.push(on(cab, prX([[2.9, 8.4], [5.25, 6.8], [5.4, 6.8], [3.05, 8.5]], -4.2, 4.2, GLASS, { noLine: true })));
  for (const side of [-1, 1]) S.push(on(cab, box(-5.2, 1.4, side < 0 ? -4.55 : 4.4, side < 0 ? -4.4 : 4.55, 7.2, 8.2, GLASS, { noLine: true, only: 'iso' })));
  // MG auf dem Dach: Lafette und Rohr nach vorn
  const mgMount = on(cab, cyl([-1.8, 0, 8.8], [-1.8, 0, 9.7], 0.6, 0.6, 8, METAL));
  S.push(mgMount);
  S.push(on(mgMount, cyl([-1.8, 0, 9.4], [2.2, 0, 9.6], 0.26, 0.22, 4, GUN)));
  // Heck: Staukasten mit Sensormast (leicht nach hinten geneigt) und Kamerakopf
  const deck = on(hullBody, box(-12.6, -8.4, -4, 4, 6.8, 7.4, P.dark));
  S.push(deck);
  const mast = on(deck, cyl([-10.5, 0, 7.4], [-11.4, 0, 19], 0.34, 0.26, 6, GUN));
  S.push(mast);
  const head = on(mast, box(-12.6, -9.6, -2.2, 2.2, 18.2, 19.8, METAL));
  S.push(head);
  S.push(fine(on(head, cyl([-12.6, 0, 19], [-13.2, 0, 19], 0.95, 0.85, 8, GLASS, { noLine: true })))); // Objektiv nach hinten
  return { S, foot: [-14.6, 14.6, -6.8, 6.8] };
}

// Störsender / EloKa-Fahrzeug (Vorbild: geschützter 6-Rad-LKW mit Shelter): vorn eine gepanzerte Kabine mit schräger Scheibe,
// hinten ein hoher Shelter-Kasten mit gerundetem Dach. Darauf zwei hohe Peitschenantennen, ein flacher Schüsselstrahler und ein
// Rahmen mit Dipolen. Ohne Antennen etwa 8 m × 2,5 m × 3,2 m (wie der LKW: rund 4 Welt-Pixel je Meter).
function jammer(P) {
  const S = [];
  S.push(box(-15, 12, -3.4, 3.4, 2.2, 3.8, METAL, { only: 'iso', under: true })); // Rahmen
  for (const x of [9.5, -5.5, -11]) for (const side of [-1, 1]) S.push(wheel(x, side * 3.9, 2.7, 2.7, 1.6, side)); // sechs Räder
  // Gepanzerte Kabine: hoher Kasten mit schräger Frontscheibe, Dachpanzerung, Seitenfenster
  const cab = prX([[8, 3.6], [8, 11.5], [12.5, 11.5], [15, 8.8], [15.4, 3.6]], -5, 5, P.body);
  S.push(cab);
  S.push(on(cab, box(8.4, 12.3, -4.6, 4.6, 11.5, 11.8, P.light))); // Dachpanzerung
  S.push(on(cab, prX([[12.7, 10.6], [14.85, 8.75], [14.9, 7.4], [12.9, 7.4]], -4.5, 4.5, GLASS, { noLine: true })));
  for (const side of [-1, 1]) S.push(on(cab, box(9, 12, side < 0 ? -5.2 : 5, side < 0 ? -5 : 5.2, 7.6, 10.2, GLASS, { noLine: true, only: 'iso' })));
  S.push(box(15.2, 16.2, -5, 5, 3, 4.6, METAL)); // Stoßstange
  for (const side of [-1, 1]) S.push(fine(box(15.3, 15.6, side * 3.8 - 0.8, side * 3.8 + 0.8, 5, 6, '#e8e2b8', { only: 'iso' })));
  // Shelter: großer Kasten mit abgerundetem Dach, Tür hinten, Teamstreifen an den Seiten
  const shelter = prY(
    [[-5.2, 3.8], [-5.2, 12], [-4.2, 13], [4.2, 13], [5.2, 12], [5.2, 3.8]],
    -15.2,
    7.4,
    mix(P.body, OLIVE, 0.2),
  );
  S.push(shelter);
  S.push(on(shelter, box(-15.45, -15.25, -3.8, 3.8, 4.2, 11.6, P.dark, { only: 'iso' }))); // Hecktür
  for (const side of [-1, 1]) S.push(fine(on(shelter, box(-6, 1, side * 5.2 - 0.06, side * 5.2 + 0.06, 6.6, 7.6, P.mark, { noLine: true, only: 'iso' })))); // Teamstreifen
  // Peitschenantennen (hoch, dünn) am hinteren Dach
  for (const y of [-2.2, 2.2]) S.push(on(shelter, cyl([-11, y, 13], [-11, y, 24], 0.3, 0.1, 4, GUN)));
  // Flacher Schüsselstrahler vorn auf dem Dach, leicht nach vorn geneigt
  S.push(on(shelter, cyl([2.8, 0, 13], [2.8, 0, 14.6], 0.45, 0.45, 6, GUN)));
  S.push(on(shelter, cyl([2.8, 0, 14.6], [3.4, 0, 15.2], 3.4, 2.8, 12, '#c5cabf')));
  // Rahmen mit Dipolen (quer zur Fahrtrichtung, auf zwei Stützen)
  const fx = -5.5;
  for (const y of [-4.4, 4.4]) S.push(on(shelter, cyl([fx, y, 13], [fx, y, 14.2], 0.3, 0.3, 4, GUN)));
  S.push(on(shelter, box(fx - 0.25, fx + 0.25, -4.6, 4.6, 14.2, 14.6, GUN)));
  S.push(on(shelter, box(fx - 0.25, fx + 0.25, -4.6, 4.6, 18.4, 18.8, GUN)));
  for (const y of [-4.6, 4.2]) S.push(on(shelter, box(fx - 0.25, fx + 0.25, y, y + 0.4, 14.2, 18.8, GUN)));
  for (const z of [15.5, 16.9]) for (const y of [-2.4, 0, 2.4]) S.push(fine(on(shelter, cyl([fx - 1.2, y, z], [fx + 1.2, y, z], 0.14, 0.14, 4, GUN))));
  return { S, foot: [-15.5, 16, -6.2, 6.2] };
}

function fobTruck(P) {
  const S = [];
  S.push(box(-20, 15, -3.4, 3.4, 2.2, 3.8, METAL, { only: 'iso', under: true }));
  for (const x of [16, 10.5, -11, -16]) for (const side of [-1, 1]) S.push(wheel(x, side * 4.6, 2.8, 2.8, 1.8, side));
  const cab = prX([[13, 3.6], [13, 11.2], [17.5, 11.2], [20, 9], [20.4, 3.6]], -6.4, 6.4, P.body);
  S.push(cab);
  S.push(on(cab, box(13.4, 17.3, -6, 6, 11.2, 11.5, P.light)));
  S.push(on(cab, prX([[17.7, 10.8], [19.85, 8.95], [19.9, 7.6], [17.9, 7.6]], -5.6, 5.6, GLASS, { noLine: true })));
  for (const side of [-1, 1]) S.push(on(cab, box(14, 17, side < 0 ? -6.55 : 6.4, side < 0 ? -6.4 : 6.55, 7.8, 10.4, GLASS, { noLine: true, only: 'iso' })));
  S.push(box(20.2, 21.2, -6.4, 6.4, 3, 4.6, METAL));
  const box1 = box(-20.5, 11.5, -6.8, 6.8, 4, 13.4, mix(P.body, OLIVE, 0.35));
  S.push(box1);
  for (const x of [-17, -8, 1, 9]) {
    S.push(fine(on(box1, box(x, x + 1.8, -6.95, -6.8, 4, 13.4, YELLOW, { noLine: true, only: 'iso' }))));
    S.push(fine(on(box1, box(x, x + 1.8, 6.8, 6.95, 4, 13.4, YELLOW, { noLine: true }))));
    S.push(fine(on(box1, box(x, x + 1.8, -6.8, 6.8, 13.4, 13.55, YELLOW, { noLine: true }))));
  }
  S.push(fine(on(box1, box(-19, 9, -1, 1, 13.55, 13.7, P.mark, { noLine: true }))));
  S.push(cyl([-16, -3.5, 13.4], [-16, -3.5, 27], 0.42, 0.3, 6, '#2b2f2b')); // Antennenmast
  S.push(prX([[-16, 27], [-16, 23.6], [-10.5, 25.3]], -3.6, -3.4, YELLOW)); // Wimpel
  return { S, foot: [-21, 21.5, -6.9, 6.9] };
}

function engineer(P) {
  const S = [];
  for (const side of [-1, 1]) tracks(S, side, -14, 13, 5.6, 9, 4.4, P, { wheels: 5 });
  S.push(lowerHull(-14, 13.6, 5.6, 4.2, P));
  const hull = prX([[-14, 4], [-14.2, 7.6], [7, 7.6], [13.6, 4.6], [13.4, 4]], -8.6, 8.6, P.body);
  S.push(hull);
  lights(S, hull, 12.6, 7, 4.9, -14.2, 6.4);
  camoSides(S, hull, 8.6, [[-12, 5, 4.6, 7], [0, 4, 4.8, 7.2]], P.camo);
  const blade = box(14, 15.6, -9.6, 9.6, 0.6, 5.2, YELLOW); // Räumschild
  S.push(blade);
  S.push(fine(on(blade, box(15.6, 15.9, -9.6, 9.6, 0.6, 1.4, METAL, { noLine: true }))));
  for (let i = -3; i <= 3; i += 2) S.push(fine(on(blade, box(15.6, 15.75, i * 2.4 - 0.9, i * 2.4 + 0.9, 3.6, 4.6, '#1e1f1c', { noLine: true, only: 'iso' }))));
  for (const side of [-1, 1]) S.push(cyl([8, side * 7, 5], [14.2, side * 7, 3.4], 0.6, 0.6, 6, METAL));
  const cab = loft([[-9, 1.6], [-1.5, 1.6], [-1.5, 8.2], [-9, 8.2]], [[-8.6, 2], [-2, 2], [-2, 7.8], [-8.6, 7.8]], 7.6, 12.2, P.body);
  S.push(cab);
  S.push(on(cab, box(-8.3, -2.3, 2.3, 7.5, 12.2, 12.45, P.light)));
  S.push(on(cab, box(-1.85, -1.6, 2.4, 7.4, 9.4, 11.6, GLASS, { noLine: true, only: 'iso' })));
  S.push(on(cab, box(-8, -2.6, 7.9, 8.12, 9.4, 11.6, GLASS, { noLine: true, only: 'iso' })));
  S.push(cyl([0, -3.4, 7.6], [0, -3.4, 9.4], 2.6, 2.6, 12, YELLOW)); // Drehkranz
  S.push(cyl([0.5, -3.4, 9], [11, -3.4, 15.2], 1.15, 1, 4, YELLOW)); // Ausleger
  S.push(cyl([11, -3.4, 15.2], [17.5, -3.4, 8.2], 0.95, 0.85, 4, YELLOW)); // Stiel
  S.push(box(16, 19.2, -5.2, -1.6, 6, 9, METAL)); // Schaufel
  S.push(fine(cyl([3, -3.4, 10.4], [9, -3.4, 14], 0.4, 0.4, 4, METAL))); // Hydraulik
  return { S, foot: [-14.5, 16, -9.6, 9.6] };
}

/** Bagger (seit v5.35): Kettenfahrwerk, Oberwagen mit Kabine und Gegengewicht, langer Ausleger mit Tieflöffel. */
function excavator(P) {
  const S = [];
  for (const side of [-1, 1]) tracks(S, side, -12, 12, 5.4, 9, 4, P, { wheels: 4 });
  S.push(lowerHull(-12, 12, 5.4, 3.8, P));
  S.push(cyl([0, 0, 3.8], [0, 0, 5.2], 5, 5, 12, METAL)); // Drehkranz
  const upper = box(-11, 6, -7.6, 7.6, 5.2, 9.6, YELLOW); // Oberwagen
  S.push(upper);
  S.push(on(upper, box(-12.6, -9.4, -7.2, 7.2, 5.4, 10.4, mix(YELLOW, '#2a2a26', 0.35)))); // Gegengewicht
  camoSides(S, upper, 7.6, [[-9, 5.6, 4.2, 8.8]], P.camo);
  const cab = loft([[-1, 1], [6, 1], [6, 7.2], [-1, 7.2]], [[-0.6, 1.4], [5.2, 1.4], [5.2, 6.8], [-0.6, 6.8]], 9.6, 15, YELLOW);
  S.push(cab);
  S.push(on(cab, box(-0.4, 5, 1.6, 6.6, 15, 15.25, P.light)));
  S.push(on(cab, box(5.4, 5.7, 1.8, 6.4, 10.6, 14.2, GLASS, { noLine: true, only: 'iso' })));
  S.push(on(cab, box(-0.4, 5, 7.1, 7.3, 10.6, 14.2, GLASS, { noLine: true, only: 'iso' })));
  S.push(fine(box(-6, -2, -7.8, -7.6, 6.4, 8.6, P.mark, { noLine: true, only: 'iso' }))); // Kennung
  S.push(cyl([3, -3, 9.4], [14, -3, 19], 1.3, 1.1, 4, YELLOW)); // Ausleger
  S.push(cyl([14, -3, 19], [21, -3, 8.5], 1, 0.9, 4, YELLOW)); // Stiel
  S.push(box(19, 23, -5.6, -0.4, 4.2, 8.6, METAL)); // Tieflöffel
  for (let i = 0; i < 3; i++) S.push(fine(box(22.8, 23.6, -5 + i * 1.8, -4 + i * 1.8, 3.4, 4.4, '#1e1f1c', { noLine: true, only: 'iso' }))); // Zähne
  S.push(fine(cyl([5, -3, 10.8], [12, -3, 17], 0.45, 0.45, 4, METAL))); // Hydraulik
  lights(S, upper, 6, 6.4, 8.8, -12.6, 7);
  return { S, foot: [-12.6, 23.6, -9, 9] };
}

export { truck, scout, jammer, fobTruck, engineer, excavator };
