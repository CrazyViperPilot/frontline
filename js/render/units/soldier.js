// Einheiten-Modell Soldat (alle Infanterie-Arten über o.kind, Register INFANTRY in ../unitpaint.js).
import { METAL, GUN, SKIN, OLIVE, BOOT, WHITE, box, cyl, ball, on, fine } from './shapes.js';
import { mix } from '../color.js';

// ---------- Modelle: Soldaten ----------

/**
 * Soldat (Schütze, PAK-Schütze, Scharfschütze, Kommandeur) in Bild `frame`: 0 steht, 1–4 Gehbewegung (Beine und Arme schwingen).
 * Höhe gut 14 px, Weste in Teamfarbe, Helm mit Teamband.
 */
function soldier(P, o) {
  const S = [];
  const kind = o.kind;
  const ph = o.frame ? ((o.frame - 1) * Math.PI) / 2 : 0;
  const sw = o.frame ? Math.sin(ph) * 1.5 : 0;
  const uni = kind === 'sniper' ? '#5a5d3c' : '#5b6146';
  for (const side of [-1, 1]) {
    const k = side < 0 ? sw : -sw;
    S.push(cyl([0, side * 0.95, 6.4], [k, side * 0.95, 1.1], 0.78, 0.7, 4, uni)); // Bein
    S.push(box(k - 0.9, k + 1.5, side * 0.95 - 0.7, side * 0.95 + 0.7, 0, 1.1, BOOT)); // Stiefel
  }
  S.push(box(-1, 1, -1.85, 1.85, 5.8, 7.4, uni)); // Hüfte
  // Flammenwerfer, Mörsertrupp, Pionier und Sanitäter: Weste in Uniformfarbe (Teamfarbe nur am Helmband)
  const plainVest = kind === 'flamer' || kind === 'mortar' || kind === 'sapper' || kind === 'medic';
  const RED = '#c8202a'; // Sanitätskreuz
  const vest = box(-1.25, 1.25, -2, 2, 7.2, 11, kind === 'sniper' ? mix(P.vest, '#5a5d3c', 0.5) : plainVest ? '#4d5339' : P.vest);
  S.push(vest);
  S.push(fine(on(vest, box(1.25, 1.4, -1.4, 1.4, 8, 9.4, mix(plainVest ? '#4d5339' : P.vest, '#000000', 0.25), { noLine: true })))); // Taschen
  if (kind === 'flamer') {
    // Flammenwerfer-Tornister: zwei aufrechte Druckbehälter nebeneinander, dazwischen ein kleiner Kugel-Drucktank,
    // Schlauch vom Behälter zum Flammrohr (vorn am Hüftgriff)
    for (const side of [-1, 1]) S.push(cyl([-2.3, side * 0.9, 7.4], [-2.3, side * 0.9, 11.2], 0.7, 0.7, 8, '#6b6f58')); // Druckbehälter
    S.push(ball([-2.95, 0, 9.3], 0.5, 0.5, 0.5, '#7b7f66', { n: 6, m: 4 })); // Kugel-Drucktank dazwischen
    S.push(fine(cyl([-2.3, 0.9, 11.2], [-2.3, 0.9, 11.5], 0.3, 0.3, 4, '#3c4130')), fine(cyl([-2.3, -0.9, 11.2], [-2.3, -0.9, 11.5], 0.3, 0.3, 4, '#3c4130'))); // Ventile oben
    S.push(cyl([-2.3, 0.9, 7.5], [-0.4, 2.2, 7.1], 0.22, 0.22, 4, '#1b1d1f'), cyl([-0.4, 2.2, 7.1], [1.2, 1.0, 7.8], 0.22, 0.22, 4, '#1b1d1f')); // Schlauch
  } else if (kind === 'medic') {
    // Sanitätsrucksack: großer Kasten auf dem Rücken; die Rückseite trägt ein weißes Feld mit rotem Kreuz (große Teile,
    // bleiben auch herausgezoomt sichtbar)
    const pack = box(-3.3, -1.25, -2, 2, 6.9, 11, '#4a5038');
    S.push(pack);
    const panel = on(pack, box(-3.45, -3.3, -1.3, 1.3, 7.5, 10.1, WHITE, { noLine: true }));
    S.push(panel);
    S.push(on(panel, box(-3.6, -3.45, -0.35, 0.35, 7.9, 9.7, RED, { noLine: true }))); // Kreuz: senkrechter Balken
    S.push(on(panel, box(-3.6, -3.45, -0.9, 0.9, 8.45, 9.15, RED, { noLine: true }))); // Kreuz: waagerechter Balken
  } else {
    S.push(box(-2.5, -1.25, -1.55, 1.55, 7.6, 10.6, kind === 'at' || kind === 'manpads' ? '#4b5034' : '#474c37')); // Rucksack
  }
  S.push(cyl([0, 0, 11], [0, 0, 11.7], 0.6, 0.6, 6, SKIN)); // Hals
  S.push(ball([0.15, 0, 12.6], 1.15, 1.05, 1.25, SKIN, { n: 8, m: 5 }));
  if (kind === 'commander') {
    S.push(cyl([0, 0, 13.3], [0, 0, 13.9], 1.45, 1.45, 10, mix(P.mark, '#2a2a2a', 0.35))); // Barett
    S.push(cyl([-2, 1, 10.6], [-2, 1, 18], 0.14, 0.12, 4, '#1b1d1f')); // Funkantenne
  } else {
    const helmet = ball([0, 0, 12.9], 1.6, 1.5, 1.3, kind === 'sniper' ? '#4f5a35' : OLIVE, { n: 10, m: 3, half: true });
    S.push(helmet);
    if (kind === 'medic') {
      // Sanitäter: kleines weißes Feld vorn am Helm (über dem Teamband) mit rotem Kreuz
      const patch = on(helmet, box(1.4, 1.65, -0.7, 0.7, 13.4, 13.95, WHITE, { noLine: true }));
      S.push(fine(patch));
      S.push(fine(on(patch, box(1.65, 1.7, -0.1, 0.1, 13.45, 13.9, RED, { noLine: true })))); // Kreuz: senkrecht
      S.push(fine(on(patch, box(1.65, 1.7, -0.3, 0.3, 13.6, 13.75, RED, { noLine: true })))); // Kreuz: waagerecht
    }
    S.push(fine(on(helmet, cyl([0, 0, 12.85], [0, 0, 13.35], 1.62, 1.55, 10, P.mark, { noLine: true })))); // Teamband
  }
  if (kind === 'sniper') {
    // Tarnanzug: Büschel auf Schultern, Rücken und Kopf
    const tufts = [[-1.4, -1.6, 10.6], [-1.4, 1.6, 10.4], [-2, 0, 11.2], [0.4, -2, 9.4], [0.4, 2, 9.6], [-1, 0, 13.6], [-2.6, -1, 8.6], [-2.6, 1.2, 9]];
    tufts.forEach(([x, y, z], i) => S.push(ball([x, y, z], 1.1, 1, 0.8, i % 3 ? '#5f6a3a' : '#6e6544', { n: 6, m: 3 })));
  }
  // Arme zur Waffe (gehend schwingt der freie Arm leicht mit)
  const hand = kind === 'flamer' ? [4, 0.9, 7.9] : [3.4, 0.9, 9.2]; // Flammenwerfer: Hände am Rohr auf Hüfthöhe
  const armSw = o.frame ? Math.sin(ph) * 0.6 : 0;
  S.push(cyl([0, -2.2, 10.4], [hand[0] - 1.2 + armSw, -0.6, hand[2] - 0.2], 0.55, 0.5, 4, uni));
  S.push(cyl([0, 2.2, 10.4], [hand[0] - 2.6 - armSw, hand[1] + 0.5, hand[2] - 0.6], 0.55, 0.5, 4, uni));
  if (kind === 'manpads') {
    // Stinger-Schütze: langes, dickes Startrohr auf der Schulter, etwas nach oben geneigt; Zielgerät seitlich am Rohr,
    // Batterie-/Kühleinheit unter dem hinteren Rohr, Suchkopf vorn.
    S.push(cyl([-6.2, 1.6, 11.2], [8.4, 1.6, 13.0], 0.8, 0.8, 6, OLIVE)); // Startrohr (rund 14 px, geneigt)
    S.push(fine(cyl([-6.8, 1.6, 11.1], [-6.2, 1.6, 11.2], 1.0, 0.85, 6, '#3c4130', { noLine: true }))); // Rohrmündung hinten
    S.push(cyl([8.4, 1.6, 13.0], [9.6, 1.6, 13.25], 0.8, 0.45, 6, '#6a6f4a')); // Suchkopf vorn
    S.push(fine(box(0.2, 3.2, 2.4, 3.4, 11.9, 13.4, '#3c4130'))); // Zielgerät (kastenförmig, seitlich am Rohr)
    S.push(fine(box(3.2, 3.9, 2.7, 3.1, 12.6, 13.0, '#1b1d1f'))); // Visierlinse vorn am Zielgerät
    S.push(box(-4.6, -2.9, 0.9, 2.3, 9.7, 10.8, '#474c37')); // Batterie-/Kühleinheit unter dem Rohr
    S.push(fine(cyl([2.6, 1.6, 10.8], [3.4, 1.2, 9.6], 0.35, 0.35, 4, '#1b1d1f'))); // Griff unter dem Rohr
  } else if (kind === 'at') {
    S.push(cyl([-5, 1.6, 11.4], [5.5, 1.6, 11.9], 0.75, 0.75, 6, OLIVE)); // Rohr auf der Schulter
    S.push(cyl([5.5, 1.6, 11.9], [7.4, 1.6, 12], 1.05, 0.25, 6, '#6a6f4a')); // Gefechtskopf
    S.push(cyl([1, 1.6, 10.6], [1, 1.6, 11], 0.3, 0.3, 4, GUN));
  } else if (kind === 'sniper') {
    S.push(cyl([-1, 0.7, 9.4], [9.5, 0.4, 9.6], 0.3, 0.26, 4, GUN)); // langes Gewehr
    S.push(cyl([1.2, 0.7, 10.2], [4.2, 0.6, 10.2], 0.42, 0.42, 6, '#1c1e20')); // Zielfernrohr
  } else if (kind === 'commander') {
    S.push(cyl([0.5, 0.8, 9.2], [5, 0.6, 9.4], 0.32, 0.3, 4, GUN)); // Maschinenpistole
  } else if (kind === 'flamer') {
    // Flammrohr auf Hüfthöhe: kürzer als das Gewehr, aber dicker; Düse vorn aufgeweitet; Ventil am Griff darunter
    S.push(cyl([0.8, 0.8, 7.9], [5.6, 0.6, 7.6], 0.5, 0.5, 6, GUN)); // Flammrohr
    S.push(cyl([5.6, 0.6, 7.6], [7, 0.55, 7.5], 0.5, 0.8, 8, '#1c1e20')); // Düse vorn
    S.push(fine(box(2.2, 2.9, 0.4, 1.2, 7.1, 7.5, '#1c1e20'))); // Ventil am Griff
  } else if (kind === 'mortar') {
    // Mörsertrupp: 60-mm-Mörser, kein Gewehr. Rohr schräg über die Schulter (vorn unten an der Hand, hinten oben auf der
    // Bodenplatte), runde Bodenplatte als flache Scheibe auf dem Rücken, Munitionsbehälter am Gürtel rechts.
    S.push(cyl([3, 1.4, 8.8], [-3, 1.4, 11.4], 0.85, 0.6, 8, '#3c4130')); // Mörserrohr
    S.push(fine(cyl([3.1, 1.4, 8.8], [3.4, 1.4, 8.8], 1.0, 1.0, 8, '#1b1d1f', { noLine: true }))); // Mündung
    S.push(cyl([-2.5, 0, 9.6], [-3.1, 0, 9.6], 1.6, 1.6, 12, '#474c37')); // Bodenplatte auf dem Rücken (Radius 1,6)
    S.push(box(-1, 1, 1.9, 3.1, 5.9, 7.5, '#4f5536')); // Munitionsbehälter am Gürtel
    S.push(fine(box(-0.4, 0.4, 3.1, 3.3, 6.5, 7, '#3c4130'))); // Verschlussgriff am Behälter
  } else if (kind === 'medic') {
    // Sanitäter, unbewaffnet: in der linken Hand eine kleine weiße Sanitätstasche mit rotem Kreuz (hängt an der Hand, folgt
    // der Gehbewegung); am linken Oberarm eine weiße Armbinde mit rotem Kreuz (Ellbogen → Handgelenk, mitgeschwungen).
    const elbow = [0, -2.2, 10.4];
    const wrist = [hand[0] - 1.2 + armSw, -0.6, hand[2] - 0.2];
    const armAt = (t) => elbow.map((v, i) => v + (wrist[i] - v) * t);
    const b0 = armAt(0.15);
    const b1 = armAt(0.5);
    const bm = armAt(0.32);
    const band = cyl(b0, b1, 0.7, 0.7, 8, WHITE, { noLine: true });
    S.push(band); // Armbinde
    S.push(fine(on(band, box(bm[0] - 0.14, bm[0] + 0.14, bm[1] - 0.9, bm[1] - 0.62, bm[2] - 0.38, bm[2] + 0.38, RED, { noLine: true })))); // Armbinde-Kreuz: senkrecht
    S.push(fine(on(band, box(bm[0] - 0.36, bm[0] + 0.36, bm[1] - 0.9, bm[1] - 0.62, bm[2] - 0.12, bm[2] + 0.12, RED, { noLine: true })))); // Armbinde-Kreuz: waagerecht
    const bag = box(1.4, 3.4, -1.9, -0.3, 6.8, 8.6, WHITE); // Sanitätstasche
    S.push(bag);
    S.push(fine(box(2.0, 2.8, -1.2, -1.0, 8.6, 8.9, '#1b1d1f'))); // Griff oben
    S.push(fine(on(bag, box(3.4, 3.55, -1.25, -0.95, 7.1, 8.3, RED, { noLine: true })))); // Taschenkreuz: senkrecht
    S.push(fine(on(bag, box(3.4, 3.55, -1.6, -0.6, 7.4, 8.0, RED, { noLine: true })))); // Taschenkreuz: waagerecht
  } else if (kind === 'sapper') {
    // Pionier: kurzer Karabiner, runde Panzermine als dicke Scheibe auf dem Tornister (Achse nach hinten), Minensuchgerät
    // mit langem Stiel von der linken Hand schräg nach vorn unten zur flachen Suchspule am Boden, Spaten am Gürtel links.
    S.push(cyl([-0.8, 0.8, 9], [4.4, 0.5, 9.3], 0.3, 0.26, 4, GUN)); // kurzer Karabiner
    S.push(fine(box(1.4, 2.2, 0.4, 1.0, 7.9, 9, GUN))); // Magazin
    S.push(cyl([-2.5, 0, 9.2], [-3.3, 0, 9.2], 2.1, 2.1, 12, '#3f4433')); // Panzermine (dicke Scheibe) auf dem Rücken
    S.push(fine(cyl([-3.3, 0, 9.2], [-3.5, 0, 9.2], 0.5, 0.5, 6, '#1b1d1f', { noLine: true }))); // Zünder mittig
    S.push(cyl([2.2, -0.6, 9.0], [6.6, -3.2, 1.0], 0.22, 0.2, 4, '#1b1d1f')); // Stiel des Minensuchgeräts
    S.push(cyl([7.0, -3.4, 0.2], [7.0, -3.4, 0.6], 1.7, 1.7, 10, '#3c4130')); // flache Suchspule am Boden
    S.push(cyl([-1.7, -2.3, 6.8], [-1.7, -2.3, 5.0], 0.22, 0.22, 4, '#474c37')); // Spatenstiel am Gürtel
    S.push(box(-2.1, -1.3, -2.5, -2.0, 3.6, 5.1, METAL)); // Spatenblatt
  } else {
    S.push(cyl([-0.8, 0.8, 9], [6.6, 0.5, 9.4], 0.32, 0.28, 4, GUN)); // Gewehr
    S.push(fine(box(1.6, 2.6, 0.45, 1.1, 7.9, 9, GUN))); // Magazin
  }
  return { S, foot: [-1.6, 1.6, -1.6, 1.6], inf: true };
}

export { soldier };
