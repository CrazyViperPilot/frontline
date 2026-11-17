// Einheiten-Modelle, Familie schwere Kettenfahrzeuge: pzh (Panzerhaubitze), mlrs, recovery (Bergepanzer), bridgelayer.
// Einstieg: ../unitpaint.js.
import { METAL, GUN, GLASS, OLIVE, box, prX, prZ, loft, cyl, on, fine, tracks, lowerHull, camo, camoSides, lights, antenna } from './shapes.js';
import { mix } from '../color.js';


function pzh(P) {
  const S = [];
  for (const side of [-1, 1]) tracks(S, side, -17, 17, 6.4, 10, 4.8, P, { wheels: 7, skirt: [-14, 16], fender: 9.4 });
  S.push(lowerHull(-17, 17.8, 6.4, 4.6, P));
  const hull = prX([[-17.2, 4.6], [-17.4, 7.4], [11, 7.4], [17.8, 4.6]], -9.4, 9.4, P.body);
  S.push(hull);
  S.push(fine(on(hull, box(8, 10.6, 2, 6.4, 7.4, 7.65, METAL)))); // Fahrerluke
  S.push(fine(on(hull, box(-17.2, -13.2, -6.6, 6.6, 7.4, 7.6, P.dark))));
  lights(S, hull, 17, 8.2, 5, -17.4, 6.4);
  camoSides(S, hull, 9.4, [[-15, 5, 5.6, 7.1], [4, 4, 5.6, 7]], P.camo);
  const T = [];
  const tur = loft(
    [[-11.5, -7.8], [6, -7.8], [9.4, -5], [9.4, 5], [6, 7.8], [-11.5, 7.8]],
    [[-11, -7.1], [5.6, -7.1], [8.6, -4.4], [8.6, 4.4], [5.6, 7.1], [-11, 7.1]],
    7.4, 13.2, P.body,
  );
  T.push(tur);
  const roof = on(tur, prZ([[-10.2, -6.3], [5.1, -6.3], [7.8, -3.9], [7.8, 3.9], [5.1, 6.3], [-10.2, 6.3]], 13.2, 13.45, P.light));
  T.push(roof);
  T.push(box(8.8, 11.8, -2.2, 2.2, 8.6, 12, P.dark)); // Wiege
  T.push(cyl([11.5, 0, 10.3], [40, 0, 10.3], 1, 0.88, 8, GUN)); // Rohr 155 mm
  T.push(cyl([37.6, 0, 10.3], [41, 0, 10.3], 1.55, 1.55, 8, GUN)); // Mündungsbremse
  T.push(cyl([16, 0, 10.3], [18.6, 0, 10.3], 1.3, 1.3, 8, GUN)); // Rauchabsauger
  T.push(fine(on(roof, cyl([-6, 4, 13.45], [-6, 4, 13.9], 1.7, 1.7, 10, P.dark)))); // Luken
  T.push(fine(on(roof, cyl([-6, -4, 13.45], [-6, -4, 13.9], 1.7, 1.7, 10, P.dark))));
  T.push(on(roof, cyl([-3, -4, 14.2], [3, -4.2, 14.5], 0.3, 0.3, 4, GUN))); // MG
  T.push(fine(box(-11.6, -11.4, -4, 4, 8.4, 12, P.dark, { only: 'iso' }))); // Munitionsklappe
  antenna(T, roof, -9.5, 6, 13.45, 22, P);
  camo(T, roof, [[-8, -5, 6, 3], [-1, 2, 5, 3]], 13.45, P.camo);
  return { S, turret: { x: -5, S: T }, foot: [-17.8, 17.8, -10.5, 10.5] };
}

/** Raketenwerfer (Vorbild M270 MARS): Kettenfahrgestell wie die Panzerhaubitze, kurze flache Fahrerkabine vorn, hinten ein
 *  großer Kasten (Werferbehälter), dessen Stirnfläche schräg nach vorn-oben zeigt und 2 × 6 Rohröffnungen trägt. Teamfarbe nur
 *  als kleine Markierung an der Kabine. Keine Bewegung im Modell (Raketen und Salve kommen aus dem Spielzustand). */
function mlrs(P) {
  const S = [];
  for (const side of [-1, 1]) tracks(S, side, -17, 16, 5.6, 8, 4.4, P, { wheels: 6, skirt: [-14, 14], fender: 6.6 });
  S.push(lowerHull(-16.6, 16.6, 5.8, 4.4, P));
  const hull = prX([[-16.6, 4.6], [-16.8, 7.2], [9, 7.2], [16.2, 4.6]], -6.2, 6.2, P.body);
  S.push(hull);
  lights(S, hull, 15.8, 5.6, 5, -16.6, 6);
  // Fahrerkabine: flach, mit schräger Frontscheibe
  const cab = prX([[6.2, 7.2], [6.2, 9.4], [12.8, 9.4], [15.4, 7.6], [15.6, 7.2]], -5.4, 5.4, P.body);
  S.push(cab);
  S.push(on(cab, box(6.4, 12.6, -5.6, 5.6, 9.4, 9.6, P.light))); // Dach
  S.push(on(cab, prX([[12.9, 9.2], [15.2, 7.7], [15.3, 7.5], [13, 7.5]], -4.6, 4.6, GLASS, { noLine: true })));
  for (const side of [-1, 1]) {
    S.push(on(cab, box(7.4, 11.8, side < 0 ? -5.6 : 5.4, side < 0 ? -5.4 : 5.6, 7.8, 8.9, GLASS, { noLine: true, only: 'iso' })));
    S.push(fine(on(cab, box(6.8, 7.8, side < 0 ? -5.6 : 5.4, side < 0 ? -5.4 : 5.6, 7.6, 8.4, P.mark, { noLine: true, only: 'iso' }))));
  }
  // Werferbehälter: Kasten, vorn schräg nach oben abgeschnitten (Profil in x-z, quer über die Breite gezogen)
  const pod = prX([[-15, 7], [-15, 10.2], [1.6, 12.6], [5, 9.4], [0, 7]], -6.2, 6.2, P.body);
  S.push(pod);
  camoSides(S, pod, 6.2, [[-13.5, 5.5, 7.6, 9.4], [-6, 4.5, 7.6, 9]], P.camo);
  // Rohröffnungen: 2 Reihen × 6 Rohre auf der Stirnfläche (Normale ≈ (0,69; 0,73) in x-z)
  const NX = 0.686;
  const NZ = 0.729;
  for (const t of [0.3, 0.72]) {
    const px = 1.6 + 3.4 * t;
    const pz = 12.6 - 3.2 * t;
    for (const y of [-5, -3, -1, 1, 3, 5]) {
      S.push(on(pod, cyl([px - 0.25 * NX, y, pz - 0.25 * NZ], [px + 0.2 * NX, y, pz + 0.2 * NZ], 0.8, 0.8, 8, GUN)));
    }
  }
  return { S, foot: [-17.8, 17.4, -8.6, 8.6] };
}

// Bergepanzer (Vorbild Büffel auf Kampfpanzer-Fahrgestell, ohne Turm): flacher Aufbau, Fahrerkabine vorn links, Kranausleger
// rechts (+y), schräg nach hinten über das Heck gelegt, Räumschild vorn quer, Seilwinde und Kisten auf dem Heckdeck.
// Maße über SIZE (wie der Kampfpanzer): etwa 9 m × 3,5 m × 2,7 m.
function recovery(P) {
  const S = [];
  for (const side of [-1, 1]) tracks(S, side, -16, 15.2, 6.2, 9, 4.6, P, { wheels: 6, skirt: [-13, 14], fender: 8.4 });
  S.push(lowerHull(-15.6, 16.2, 6.6, 4.4, P));
  const hull = prX([[-15.6, 4.6], [-15.8, 7.2], [7, 7.2], [15.4, 4.6]], -7.2, 7.2, P.body);
  S.push(hull);
  lights(S, hull, 15.4, 7.2, 4.9, -15.8, 6.2);
  camoSides(S, hull, 7.2, [[-12, 5, 5.6, 6.9], [1, 4, 5.4, 7]], P.camo);
  // Fahrerkabine vorn links (-y): flach, mit schräger Frontscheibe und Seitenscheibe
  const cab = prX([[7.2, 7.2], [7.2, 9.8], [12.2, 9.8], [14.6, 7.6], [14.8, 7.2]], -6.4, -1.4, P.body);
  S.push(cab);
  S.push(on(cab, box(7.4, 12, -6.2, -1.6, 9.8, 10, P.light))); // Dach
  S.push(on(cab, prX([[12.4, 9.6], [14.5, 7.7], [14.6, 7.5], [12.5, 7.5]], -6, -1.8, GLASS, { noLine: true })));
  S.push(on(cab, box(8, 11.6, -6.6, -6.4, 7.8, 8.9, GLASS, { noLine: true, only: 'iso' })));
  // Kranausleger rechts (+y): Drehkranz auf dem Deck, Ausleger, Stütze und Hakenflasche
  S.push(on(hull, box(1.4, 6.2, 2.6, 6.4, 7.2, 8.8, P.dark)));
  const boom = cyl([1.8, 4.6, 9.4], [-15, 4.6, 12.6], 1.1, 0.8, 4, P.light);
  S.push(boom);
  S.push(on(boom, cyl([-3.8, 4.6, 7.6], [-5.8, 4.6, 10.6], 0.42, 0.42, 4, METAL))); // Stütze
  S.push(fine(on(boom, cyl([-15, 4.6, 12.6], [-15, 4.6, 10.2], 0.3, 0.3, 6, METAL)))); // Hakenflasche
  // Heckdeck: Seilwinde quer zwischen zwei Kisten
  S.push(cyl([-14.4, 0, 8.4], [-10.6, 0, 8.4], 1.1, 1.1, 8, METAL));
  const crate = mix(P.dark, OLIVE, 0.4);
  for (const side of [-1, 1]) S.push(box(-15.2, -10.4, side < 0 ? -6.2 : 2.4, side < 0 ? -2.4 : 6.2, 7.2, 9.4, crate));
  // Räumschild vorn quer, zwei Arme zum Rahmen
  S.push(prX([[15.6, 0.8], [17.4, 3.6], [17.8, 8.2], [15.8, 8.2]], -9.2, 9.2, P.dark));
  for (const side of [-1, 1]) S.push(fine(cyl([13.4, side * 5.4, 5.2], [15.8, side * 6.6, 5.4], 0.5, 0.5, 4, METAL)));
  return { S, foot: [-16.6, 17.8, -9.6, 9.6] };
}

// Brückenleger (Vorbild Biber): Kettenfahrgestell ohne Turm, flache Wanne, darauf längs eine zusammengeklappte Brücke aus zwei
// breiten Fahrbahnhälften übereinander mit Seitenträgern. Die Brücke ragt vorn und hinten über die Wanne hinaus. Vorn ein
// Abstützschild an zwei Armen. Maße über SIZE (wie der Kampfpanzer): etwa 11 m lang inkl. Brücke, 4 m breit, 3,5 m hoch.
function bridgelayer(P) {
  const S = [];
  for (const side of [-1, 1]) tracks(S, side, -14, 13, 6.2, 9.6, 4.6, P, { wheels: 5, skirt: [-11, 12], fender: 8.6 });
  S.push(lowerHull(-14.2, 13.4, 6.4, 4.4, P));
  const hull = prX([[-14, 4.4], [-14.2, 7], [10.4, 7], [13.4, 4.4]], -7, 7, P.body);
  S.push(hull);
  lights(S, hull, 13.4, 7, 4.6, -14.2, 6);
  camoSides(S, hull, 7, [[-11, 5, 5.4, 6.7], [2, 4, 5.4, 6.7]], P.camo);
  // Brücke, zusammengeklappt, liegt direkt auf der Wanne (Deck z = 7): untere und obere Fahrbahnhälfte (breit, flach),
  // vorn und hinten überstehend. Die Auflagebalken darunter sind weggefallen (Höhe 0, Brücke sitzt auf dem Deck).
  const low = box(-19, 18, -6, 6, 7, 8.2, P.dark);
  S.push(low);
  const up = box(-19, 18, -6, 6, 8.2, 9.4, P.body);
  S.push(up);
  S.push(fine(on(up, box(-18.5, 17.5, -5.2, 5.2, 9.4, 9.55, P.light, { noLine: true })))); // Fahrbahnrand oben
  for (const x of [-6, 2, 10]) S.push(fine(on(up, box(x, x + 0.5, -6.2, 6.2, 9.4, 9.65, P.dark, { noLine: true })))); // Fugen zwischen den Platten
  // Seitenträger: schmale Stege an beiden Längsseiten, über die ganze Höhe der Brücke
  for (const side of [-1, 1]) {
    const y = side * 6.2;
    S.push(on(low, box(-19.4, 18.4, y - 0.45, y + 0.45, 7, 9.8, METAL)));
  }
  // Abstützschild vorn, an zwei Armen aus der Wanne
  S.push(box(13.8, 14.6, -7.6, 7.6, 1.8, 6.6, P.dark));
  S.push(fine(on(hull, box(13.9, 14.7, -6.2, 6.2, 2.4, 6.0, METAL, { noLine: true, only: 'iso' })))); // Schildfeld
  for (const side of [-1, 1]) S.push(fine(cyl([12, side * 5.2, 5], [13.8, side * 6.8, 2.4], 0.5, 0.5, 4, METAL))); // Abstützarme
  return { S, foot: [-19.4, 18.8, -10.2, 10.2] };
}

export { pzh, mlrs, recovery, bridgelayer };
