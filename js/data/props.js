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
//   gate      Kachel kann ein Tor sein (map: gate 1 = geschlossen wie die Kachel, 2 = offen: sperrt nichts, keine Deckung)
export const PROPS = {
  // Deckung (combat.js): Infanterie höchstens r px vom Rand einer Prop-Zelle, die zwischen ihr und dem Schützen liegt (Winkel zur
  // Schussrichtung höchstens arc, Bogenmaß), nimmt cover weniger Schaden. absorb: Anteil des Schadens gegen die Panzerklasse des Props,
  // den es dabei selbst abbekommt (Deckung nutzt sich ab). Steilfeuer (Mörser, Artillerie) und Luftangriffe kennen keine Deckung.
  cover: { r: 24, arc: 1.1, absorb: 0.5 },
  // Splash von Granaten und Bomben (combat.impact) trifft Props mit diesem Anteil des Schadens gegen ihre Panzerklasse
  splashMul: 1,
  // Gruppen im Editor (Reihenfolge der Auswahlliste)
  groups: { fence: 'Zäune und Mauern' },
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
  },
};
