// Props der Karte (Deko und Gelände: Zäune, Mauern, später Sandsäcke, Container, Fässer …): Spielwerte je Art.
// Simulation: js/game/props.js (Sperren je Bewegungsklasse, Deckung, Sicht, Schaden, Überfahren); Bilder: js/render/mapprops.js.
// Karte: map.props = [{ kind, x, y, rot?, gate? }] (game/mapdata.js); Editor-Werkzeug „Deko“, Zufallskarten MAPGEN.props.
//
// Felder je Art:
//   name      Anzeige im Editor
//   group     Gruppe im Editor (GROUPS)
//   line      Kachel (eine Rasterzelle, 32 px): verbindet sich mit Nachbarn derselben Art zu Gerade, Ecke, T-Stück, Kreuz, Ende
//   size      Grundfläche [Breite, Tiefe] in px (nur ohne line), gedreht um rot × 45°; sperrt die Zellen, deren Mitte darin liegt
//   blocks    wen das Prop aufhält: 'all', 'veh' (Fahrzeuge), 'inf' (Infanterie), 'none'
//   crush     Kettenfahrzeuge (units.js crush) fahren darüber; das Prop ist danach weg
//   cover     Deckung für Infanterie dahinter (Anteil weniger Schaden, Richtung zählt: PROPS.cover)
//   coverVeh  Deckung für Fahrzeuge dahinter (fehlt = 0)
//   sight     Sichthöhe (wie Gelände, BALANCE.sightHeight: Augen Infanterie 16, Fahrzeug 20, Gebäude 30); 0 = durchsichtig
//   hp        Trefferpunkte; Schaden je Panzerklasse `armor` der Waffe (inf, light, heavy, struct)
//   rubble    Trümmer nach Zerstörung durch Beschuss { blocks, crush, cover, sight } oder null (dann ist es weg)
//   gate      Kachel kann ein Tor sein (map: gate 1 = geschlossen wie die Kachel, 2 = offen: sperrt nichts, keine Deckung); Schranke ebenso
//   connect   Kacheln ohne Verbindung (false): je Zelle ein Stück (Panzersperren)
//   flag      trägt eine Fahne in Teamfarbe (map: team −1 … 3, PROPS.flagReach)
//   conceal   Tarnnetz: Einheiten darunter sind getarnt
//   blast     fliegt bei Zerstörung durch Beschuss in die Luft { r, damage je Panzerklasse }
//   stack     bis zu so viele Lagen übereinander (map: stack 1 … stack; Container): Trefferpunkte und Sichthöhe je Lage
//   rotStep   Drehung im Editor in Achteln je Druck (Autos: 2 = 90°, sie stehen an den Achsen)
//   foot      Teilflächen [[x0, x1, y0, y1] …] (px, wie size gedreht): nur sie sperren (Portalkran: nur die Beine)
export const PROPS = {
  // Deckung (combat.js): Infanterie höchstens r px vom Rand einer Prop-Zelle, die zwischen ihr und dem Schützen liegt (Winkel zur
  // Schussrichtung höchstens arc, Bogenmaß), nimmt cover weniger Schaden. absorb: Anteil des Schadens gegen die Panzerklasse des Props,
  // den es dabei selbst abbekommt (Deckung nutzt sich ab). Steilfeuer (Mörser, Artillerie) und Luftangriffe kennen keine Deckung.
  cover: { r: 24, arc: 1.1, absorb: 0.5 },
  // Splash von Granaten und Bomben (combat.impact) trifft Props mit diesem Anteil des Schadens gegen ihre Panzerklasse
  splashMul: 1,
  // Gruppen im Editor (Reihenfolge der Auswahlliste)
  groups: { fence: 'Zäune und Mauern', mil: 'Militär', ind: 'Industrie und Logistik', civ: 'Zivil und Natur', war: 'Kriegsspuren' },
  // Fahnen (Kontrollpunkt, Zelt, Funkmast): in der Eroberung zeigt eine Fahne die Farbe des Besitzers der nächsten Flagge, wenn sie
  // höchstens flagReach px von ihr steht; sonst die im Editor eingestellte Farbe (team) oder weiß (neutral)
  flagReach: 700,
  // Tarnung unter Tarnnetzen (conceal): Einheiten darunter sieht der Gegner nur aus der Nähe (BALANCE.stealth.detectRange), bis sie
  // schießen (BALANCE.stealth.revealTime), wie Scharfschützen
  kinds: {
    fence_wood: {
      name: 'Holzzaun',
      group: 'fence',
      line: true,
      gate: true,
      blocks: 'all',
      crush: true,
      cover: 0.15,
      sight: 0,
      hp: 60,
      armor: 'light',
      rubble: null,
    },
    fence_metal: {
      name: 'Metallzaun',
      group: 'fence',
      line: true,
      gate: true,
      blocks: 'all',
      crush: true,
      cover: 0.3, // gemauerter Sockel
      sight: 0,
      hp: 120,
      armor: 'light',
      rubble: { blocks: 'none', crush: true, cover: 0.1, sight: 0 },
    },
    fence_wire: {
      name: 'Maschendraht',
      group: 'fence',
      line: true,
      gate: true,
      blocks: 'all',
      crush: true,
      cover: 0,
      sight: 0,
      hp: 50,
      armor: 'light',
      rubble: null,
    },
    wall_concrete: {
      name: 'Betonmauer',
      group: 'fence',
      line: true,
      gate: true,
      blocks: 'all',
      crush: false, // auch Panzer kommen nicht hindurch
      cover: 0.6,
      coverVeh: 0.3,
      sight: 26, // höher als Augen von Infanterie und Fahrzeugen: verdeckt, was dahinter steht
      hp: 600,
      armor: 'struct',
      rubble: { blocks: 'veh', crush: true, cover: 0.35, sight: 0 }, // Schuttwall: Radfahrzeuge kommen nicht darüber
    },
    wall_stone: {
      name: 'Bruchsteinmauer',
      group: 'fence',
      line: true,
      gate: true,
      blocks: 'all',
      crush: true, // niedrig: Panzer schieben sie um
      cover: 0.5,
      coverVeh: 0.15,
      sight: 0,
      hp: 300,
      armor: 'struct',
      rubble: { blocks: 'none', crush: true, cover: 0.25, sight: 0 },
    },
    // ---------- Militär (Schritt 3) ----------
    // Kacheln: Sandsackwall, Hesco, Jersey-Sperre, Stacheldrahtrolle, Panzersperren (ohne Verbindung: je Zelle ein Igel)
    sandbag: {
      name: 'Sandsackwall',
      group: 'mil',
      line: true,
      blocks: 'all',
      crush: true,
      cover: 0.55,
      coverVeh: 0.2,
      sight: 0,
      hp: 250,
      armor: 'struct',
      rubble: { blocks: 'none', crush: true, cover: 0.25, sight: 0 }, // aufgerissene Säcke
    },
    hesco: {
      name: 'Hesco-Barriere',
      group: 'mil',
      line: true,
      blocks: 'all',
      crush: false,
      cover: 0.7,
      coverVeh: 0.4,
      sight: 0,
      hp: 800,
      armor: 'struct',
      rubble: { blocks: 'veh', crush: true, cover: 0.3, sight: 0 }, // Sandhaufen aus geplatzten Körben
    },
    jersey: {
      name: 'Betonsperre (Jersey)',
      group: 'mil',
      line: true,
      blocks: 'veh', // Infanterie steigt darüber
      crush: false,
      cover: 0.4,
      coverVeh: 0.25,
      sight: 0,
      hp: 500,
      armor: 'struct',
      rubble: { blocks: 'none', crush: true, cover: 0.15, sight: 0 },
    },
    wire_coil: {
      name: 'Stacheldrahtrolle',
      group: 'mil',
      line: true,
      blocks: 'all', // Infanterie und Radfahrzeuge bleiben hängen
      crush: true,
      cover: 0,
      sight: 0,
      hp: 30,
      armor: 'light',
      rubble: null,
    },
    hedgehog: {
      name: 'Panzersperre (Tschechenigel)',
      group: 'mil',
      line: true,
      connect: false, // jede Zelle ein Igel, keine Verbindung
      blocks: 'veh', // Infanterie geht zwischen den Igeln durch
      crush: false,
      cover: 0.1,
      sight: 0,
      hp: 400,
      armor: 'heavy',
      rubble: null,
    },
    // Einzelstücke: Grundfläche size [Länge, Tiefe] px, gedreht um rot × 45°
    sandbag_nest: {
      name: 'Sandsack-Stellung (Halbkreis)',
      group: 'mil',
      size: [56, 40],
      blocks: 'veh', // Infanterie steigt hinein: steht sie darin, deckt die Stellung nach allen Seiten
      crush: true,
      cover: 0.6,
      sight: 0,
      hp: 300,
      armor: 'struct',
      rubble: { blocks: 'none', crush: true, cover: 0.25, sight: 0 },
    },
    camo_net: {
      name: 'Tarnnetz',
      group: 'mil',
      size: [80, 52],
      blocks: 'none', // nur dünne Stangen
      crush: true,
      cover: 0,
      sight: 0,
      conceal: true,
      hp: 40,
      armor: 'light',
      rubble: null,
    },
    tent: {
      name: 'Zelt',
      group: 'mil',
      size: [64, 44],
      flag: true,
      blocks: 'all',
      crush: true,
      cover: 0.1,
      sight: 22,
      hp: 80,
      armor: 'light',
      rubble: { blocks: 'none', crush: true, cover: 0, sight: 0 }, // eingefallene Plane
    },
    radio_mast: {
      name: 'Funkmast',
      group: 'mil',
      size: [24, 24],
      flag: true,
      blocks: 'all',
      crush: false,
      cover: 0,
      sight: 0, // Gittermast: durchsichtig
      hp: 300,
      armor: 'heavy',
      rubble: { blocks: 'none', crush: true, cover: 0.1, sight: 0 }, // umgestürzt
    },
    ammo_stack: {
      name: 'Munitionskisten',
      group: 'mil',
      size: [28, 20],
      blocks: 'all',
      crush: true,
      cover: 0.35,
      sight: 0,
      hp: 60,
      armor: 'light',
      // fliegt in die Luft, wenn Beschuss sie zerstört (nicht beim Überfahren): Splash wie eine Granate
      blast: { r: 70, damage: { inf: 60, light: 50, heavy: 15, struct: 60 } },
      rubble: null,
    },
    fuel_tank: {
      name: 'Treibstofftank',
      group: 'mil',
      size: [64, 30],
      blocks: 'all',
      crush: false,
      cover: 0.4,
      coverVeh: 0.3,
      sight: 0,
      hp: 200,
      armor: 'heavy',
      blast: { r: 110, damage: { inf: 90, light: 90, heavy: 30, struct: 100 } },
      rubble: { blocks: 'all', crush: false, cover: 0.4, sight: 0 }, // ausgebrannte Hülle
    },
    checkpoint: {
      name: 'Kontrollpunkt-Häuschen',
      group: 'mil',
      size: [40, 40],
      flag: true,
      blocks: 'all',
      crush: false,
      cover: 0.5,
      coverVeh: 0.2,
      sight: 24,
      hp: 400,
      armor: 'struct',
      rubble: { blocks: 'veh', crush: true, cover: 0.3, sight: 0 },
    },
    boom_gate: {
      name: 'Schranke',
      group: 'mil',
      size: [64, 8],
      gate: true, // zu (1): hält Fahrzeuge auf; offen (2): hält niemanden auf
      blocks: 'veh', // Infanterie duckt sich darunter durch
      crush: true,
      cover: 0,
      sight: 0,
      hp: 40,
      armor: 'light',
      rubble: null,
    },
    // ---------- Industrie und Logistik (Schritt 4) ----------
    container: {
      name: 'Container',
      group: 'ind',
      size: [42, 17], // 20-Fuß-Container
      stack: 3,
      blocks: 'all',
      crush: false,
      cover: 0.6,
      coverVeh: 0.4,
      sight: 22, // je Lage (zwei Lagen 44): verdeckt, was dahinter steht
      hp: 400, // je Lage
      armor: 'heavy',
      rubble: { blocks: 'all', crush: false, cover: 0.5, sight: 0 }, // aufgerissene Blechkiste
    },
    pallets: {
      name: 'Paletten',
      group: 'ind',
      size: [18, 14],
      blocks: 'none', // flacher Stapel: man steigt und fährt darüber
      crush: true,
      cover: 0.1,
      sight: 0,
      hp: 30,
      armor: 'light',
      rubble: null,
    },
    crate_stack: {
      name: 'Kistenstapel',
      group: 'ind',
      size: [24, 18],
      blocks: 'all',
      crush: true,
      cover: 0.3,
      sight: 0,
      hp: 60,
      armor: 'light',
      rubble: null,
    },
    barrels: {
      name: 'Fässer (stehend)',
      group: 'ind',
      size: [18, 18],
      blocks: 'all',
      crush: true,
      cover: 0.3,
      sight: 0,
      hp: 50,
      armor: 'light',
      blast: { r: 50, damage: { inf: 35, light: 30, heavy: 8, struct: 30 } }, // Öl, Treibstoff
      rubble: null,
    },
    barrels_lying: {
      name: 'Fässer (liegend)',
      group: 'ind',
      size: [26, 12],
      blocks: 'all',
      crush: true,
      cover: 0.25,
      sight: 0,
      hp: 50,
      armor: 'light',
      blast: { r: 50, damage: { inf: 35, light: 30, heavy: 8, struct: 30 } },
      rubble: null,
    },
    tyres: {
      name: 'Reifenstapel',
      group: 'ind',
      size: [16, 16],
      blocks: 'all',
      crush: true,
      cover: 0.3,
      sight: 0,
      hp: 80,
      armor: 'light',
      rubble: null,
    },
    forklift: {
      name: 'Gabelstapler',
      group: 'ind',
      size: [22, 11],
      blocks: 'all',
      crush: true,
      cover: 0.3,
      sight: 0,
      hp: 120,
      armor: 'light',
      rubble: { blocks: 'all', crush: true, cover: 0.3, sight: 0 }, // Wrack
    },
    gantry_crane: {
      name: 'Portalkran',
      group: 'ind',
      size: [128, 44],
      foot: [[-64, -52, -22, 22], [52, 64, -22, 22]], // nur die Beine sperren, darunter fährt man durch
      blocks: 'all',
      crush: false,
      cover: 0.2,
      sight: 0,
      hp: 1500,
      armor: 'heavy',
      rubble: { blocks: 'all', crush: false, cover: 0.4, sight: 0 }, // eingestürzt: Trümmer an den Beinen sperren weiter
    },
    loading_dock: {
      name: 'Laderampe',
      group: 'ind',
      size: [64, 24],
      blocks: 'veh', // Infanterie klettert hinauf
      crush: false,
      cover: 0.45,
      coverVeh: 0.2,
      sight: 0,
      hp: 800,
      armor: 'struct',
      rubble: { blocks: 'none', crush: true, cover: 0.2, sight: 0 },
    },
    street_lamp: {
      name: 'Laternenmast',
      group: 'ind',
      size: [6, 6],
      blocks: 'none', // dünner Mast
      crush: true,
      cover: 0,
      sight: 0,
      hp: 30,
      armor: 'light',
      rubble: { blocks: 'none', crush: true, cover: 0, sight: 0 }, // umgeknickt
    },
    power_box: {
      name: 'Stromverteiler',
      group: 'ind',
      size: [12, 6],
      blocks: 'none', // schmaler Schrank
      crush: true,
      cover: 0.15,
      sight: 0,
      hp: 40,
      armor: 'light',
      rubble: null,
    },
    // ---------- Zivil und Natur (Schritt 5) ----------
    civ_car: {
      name: 'Zivilauto',
      group: 'civ',
      size: [36, 16],
      rotStep: 2,
      blocks: 'all',
      crush: true,
      cover: 0.4,
      coverVeh: 0.2,
      sight: 0,
      hp: 100,
      armor: 'light',
      rubble: { blocks: 'all', crush: true, cover: 0.35, sight: 0 }, // ausgebrannt
    },
    bus_stop: {
      name: 'Bushaltestelle',
      group: 'civ',
      size: [40, 14],
      blocks: 'all',
      crush: true,
      cover: 0.1,
      sight: 0, // Glas
      hp: 60,
      armor: 'light',
      rubble: { blocks: 'none', crush: true, cover: 0, sight: 0 }, // Gestell ohne Scheiben
    },
    bench: {
      name: 'Parkbank',
      group: 'civ',
      size: [20, 8],
      blocks: 'none',
      crush: true,
      cover: 0.1,
      sight: 0,
      hp: 30,
      armor: 'light',
      rubble: null,
    },
    mailbox: {
      name: 'Briefkasten',
      group: 'civ',
      size: [6, 6],
      blocks: 'none',
      crush: true,
      cover: 0,
      sight: 0,
      hp: 20,
      armor: 'light',
      rubble: null,
    },
    road_sign: {
      name: 'Verkehrsschild',
      group: 'civ',
      size: [6, 6],
      blocks: 'none',
      crush: true,
      cover: 0,
      sight: 0,
      hp: 20,
      armor: 'light',
      rubble: { blocks: 'none', crush: true, cover: 0, sight: 0 }, // umgeknickt
    },
    hay_bale: {
      name: 'Heuballen',
      group: 'civ',
      size: [20, 13],
      blocks: 'all',
      crush: true,
      cover: 0.4,
      sight: 0,
      hp: 40,
      armor: 'light',
      rubble: null,
    },
    log_pile: {
      name: 'Holzstapel',
      group: 'civ',
      size: [36, 16],
      blocks: 'all',
      crush: true,
      cover: 0.5,
      sight: 0,
      hp: 150,
      armor: 'light',
      rubble: { blocks: 'none', crush: true, cover: 0.2, sight: 0 }, // verstreute Stämme
    },
    well: {
      name: 'Brunnen',
      group: 'civ',
      size: [20, 20],
      blocks: 'all',
      crush: false,
      cover: 0.4,
      sight: 0,
      hp: 300,
      armor: 'struct',
      rubble: { blocks: 'veh', crush: true, cover: 0.3, sight: 0 }, // Brunnenring ohne Dach
    },
    rock: {
      name: 'Felsen',
      group: 'civ',
      size: [24, 24],
      blocks: 'all',
      crush: false,
      cover: 0.5,
      coverVeh: 0.3,
      sight: 0,
      hp: 3000, // praktisch unzerstörbar
      armor: 'struct',
      rubble: null,
    },
    bush: {
      name: 'Busch',
      group: 'civ',
      size: [16, 16],
      blocks: 'none',
      crush: true,
      cover: 0.1,
      sight: 0,
      hp: 20,
      armor: 'light',
      rubble: null,
    },
    hedge: {
      name: 'Hecke',
      group: 'civ',
      line: true,
      blocks: 'all',
      crush: true,
      cover: 0.2, // Blätter halten kaum Kugeln auf
      sight: 20, // aber man sieht nicht hindurch (Fahrzeuge mit Augenhöhe 20 gerade nicht)
      hp: 80,
      armor: 'light',
      rubble: null,
    },
    // ---------- Kriegsspuren ----------
    crater: {
      name: 'Krater',
      group: 'war',
      size: [40, 40],
      blocks: 'none',
      crush: false,
      cover: 0.35, // wer darin steht, liegt tiefer: Deckung nach allen Seiten
      sight: 0,
      hp: 9999, // unzerstörbar
      armor: 'struct',
      rubble: null,
    },
    rubble_heap: {
      name: 'Trümmerhaufen',
      group: 'war',
      size: [40, 32],
      blocks: 'veh', // Infanterie klettert darüber
      crush: true,
      cover: 0.4,
      coverVeh: 0.2,
      sight: 0,
      hp: 1000,
      armor: 'struct',
      rubble: null,
    },
    burnt_car: {
      name: 'Ausgebranntes Auto',
      group: 'war',
      size: [36, 16],
      rotStep: 2,
      blocks: 'all',
      crush: true,
      cover: 0.35,
      sight: 0,
      hp: 150,
      armor: 'heavy',
      rubble: null,
    },
    fallen_tree: {
      name: 'Umgestürzter Baum',
      group: 'war',
      size: [60, 20],
      blocks: 'all',
      crush: true,
      cover: 0.35,
      sight: 0,
      hp: 120,
      armor: 'light',
      rubble: null,
    },
  },
};
