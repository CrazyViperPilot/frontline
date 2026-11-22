// Alle globalen Spielzahlen. Einheiten: units.js, Gebäude: buildings.js, KI: ai.js, Kartengenerator: mapgen.js (alle in js/data/). Wegweiser: docs/wo-aendern.md.
//
// Inhalt (Suche nach dem Schlüssel):
//   QUICK            Schnelleinstellungen: die Werte, die man am häufigsten ändert (gleich hier oben)
//   Partie und Sieg  map, tickRate, winPoints, pointInterval
//   Geld             startRes, walletMax, bounty, zone, conquest, hot, crates
//   Einheiten        slotCap, startUnits, reinforce, queueMax, trainSlots, fuelSlowMul, leash, scanInterval
//   FOB und Bauen    fob, construction, demolishRefund
//   Logistik         logistics, shortageWarn, baseAttackWarn
//   KI-Schwierigkeit difficulty (weitere KI-Werte: ai.js)
//   Kampf, Gelände   height, slope, airFire, sightHeight, fogInterval, stealth, garrison, fortress, commander, formation, jets
//   Wetter, Technik  weather, river (Forschung: js/data/research.js)
//   Nur Optik        scars, animals, effects
//   Bewegung, Sicht  move, path (Wegsuche), fog, formation, scanStagger, spawnRing, shellSpeed, combat, notify (Meldedauern)
//   Startmenü        menuDefaults
//   Texte, Farben    resNames, teamNames, teamColors

// == SCHNELLEINSTELLUNGEN ==
// Hier ändern; BALANCE unten liest diese Werte. Danach PRD und Hilfetexte (js/ui/helptext.js, js/ui/menu/start-html.js) anpassen (CLAUDE.md, Regel 7).
export const QUICK = {
  unitLimit: 300, // Einheitenlimit in Plätzen je Team (Soldat, LKW, Hubschrauber 1, SPz 3, KPz 5, Flak/SAM 2: `slots` in units.js)
  startMoney: 800, // Startgeld (die Kasse bleibt von Runde zu Runde, höchstens walletMax)
  walletMax: 5000, // Obergrenze der Kasse, die von Runde zu Runde bleibt
  moneyPerUnitZone: 0.4, // Geld je Sekunde und eigene Einheit in der Konfliktzone
  moneyPerUnitHot: 0.8, // Geld je Sekunde und Einheit in der Hot Zone (statt moneyPerUnitZone, nicht zusätzlich)
  moneyPerCrate: 1, // Geld je Sekunde und eingelagerte Versorgungskiste
  winPoints: 100, // Siegpunkte (Standard; im Startmenü 25, 50 oder 100)
  pointEvery: 30, // Sekunden Zonenkontrolle je Siegpunkt
  maxFobs: 10, // FOBs je Team, mit Hauptstadt
  fobStartStock: 0.2, // Anteil des Lagers je Sorte (storeCap), mit dem eine aufgebaute FOB startet (FOB-Fahrzeug, units.js fobTruck)
  storeCap: 3000, // Lager je Sorte (Baumaterial, Munition, Treibstoff) und vordere FOB
  capitalCap: 100000, // Lager je Sorte der Hauptstadt (mit Stadt füllen es die Werke bis hierhin; ohne Stadt wird es immer wieder aufgefüllt)
  truckLoad: 400, // Ladung eines LKW (Summe aller Sorten)
  trainSlots: 2, // so viele Einheiten bildet die Hauptstadt gleichzeitig aus
  queueMax: 5, // Länge der Ausbildungs-Warteschlange
  reinforceEvery: 6, // Sekunden je kostenloser Schütze, solange weniger als reinforce.soldierMin Soldaten leben
  // Startarmee: 2 Kampfpanzer (10 Plätze), 3 Schützenpanzer (9), 3 LKW und 1 Baufahrzeug (4), 29 Soldaten (22 Schützen, 7 Panzerabwehr) = 52 Plätze;
  // dazu der Kommandeur (0 Plätze, hinten an der Hauptstadt)
  startUnits: ['truck', 'truck', 'truck', 'engineer', 'tank', 'tank', 'ifv', 'ifv', 'ifv', ...Array(22).fill('rifleman'), ...Array(7).fill('at'), 'commander'],
};

export const BALANCE = {
  // Kartengröße (px). Seit v5.14 11072 statt 9024: die Konfliktzone (zone.r) bleibt gleich groß und sitzt in der Mitte, rundum
  // kommen 1024 px (16 Stadtzellen) dazu, so liegt der Fluss doppelt so weit von der Hauptstadt (Platz für die Stadt).
  // Bedingungen: Vielfaches von 128 plus 64 (Kartenmitte auf einer Stadtzellenmitte, Zonenstraßen genau auf Zellreihen) und von
  // RELIEF.res (64, Höhenraster). Ältere gespeicherte Karten mit kleinerer Größe werden beim Laden mittig eingesetzt (mapdata.js).
  map: { width: 11072, height: 11072, tile: 32 },
  tickRate: 20, // Simulationsschritte/s
  winPoints: QUICK.winPoints,
  // Geld für Abschüsse und Bauten (Anteil am Geldpreis der Einheit bzw. am Baumaterialpreis des Gebäudes)
  bounty: { inf: 0.25, vehicle: 0.6, building: 0.2, built: 0.2, notify: 100 },
  walletMax: QUICK.walletMax, // Obergrenze der Kasse, die von Runde zu Runde bleibt
  // Match-Start (docs/prd/konto.md): Gültigkeit eines Tokens in Tagen ab Ausgabe; Spiegel FL_MATCH_TOKEN_DAYS in api/lib/match.php
  match: { tokenDays: 7 },
  pointInterval: QUICK.pointEvery,
  startRes: { money: QUICK.startMoney }, // Startgeld; die Hauptstadt hat unendlich Baumaterial, Munition und Treibstoff
  // Einheitenlimit in Plätzen je Team: Soldat/LKW/Baufahrzeug/Hubschrauber 1, Schützenpanzer 3, Kampfpanzer 5, Flak und SAM 2 (`slots` in units.js)
  slotCap: QUICK.unitLimit,
  startUnits: QUICK.startUnits,
  // Startaufstellung nach Truppengattung getrennt um die Hauptstadt. angle = Grad von der Richtung zur Kartenmitte (0 = vorn,
  // 90 = links, 180 = hinten), dist = Abstand des Ankerpunkts zur FOB-Mitte (px), gap = Lücke zwischen den Einheiten (px).
  // Eine Gattung füllt von ihrem Ankerpunkt aus die nächsten freien Plätze; Typen ohne Gruppe nehmen `fallback`.
  startLayout: {
    maxDist: 700, // weiter als so viele px von der FOB-Mitte wird nichts aufgestellt
    minDist: 60, // näher als so viele px an der FOB-Mitte wird nichts aufgestellt (die FOB-Mitte liegt im Gebäude)
    step: 12, // Rastergröße der Startplätze (px)
    groups: [
      { types: ['tank', 'ifv'], angle: 0, dist: 330, gap: 26 }, // Panzer vorn
      { types: ['rifleman', 'sniper'], angle: 60, dist: 300, gap: 14 }, // Schützen links
      { types: ['at'], angle: -60, dist: 300, gap: 14 }, // Panzerabwehr rechts
      { types: ['truck', 'engineer', 'fobTruck'], angle: 180, dist: 330, gap: 24 }, // Versorgung hinten
      { types: ['flak', 'sam'], angle: -130, dist: 330, gap: 26 }, // Luftabwehr hinten rechts
      { types: ['littlebird', 'transporter', 'gunship'], angle: 130, dist: 380, gap: 40 }, // Hubschrauber hinten links
      { types: ['commander'], angle: 180, dist: 130, gap: 10 }, // Kommandeur dicht hinter der FOB
    ],
    fallback: { angle: 0, dist: 200, gap: 14 },
  },
  // Geld je Sekunde und lebende eigene Einheit in der Konfliktzone (auch umkämpft, ohne Deckel)
  // zone.r: Radius des Kreises der klassischen Zone (px). In der Eroberung ist die Zone ein Quadrat mit dieser halben Kante (conquest.half).
  zone: { r: 3300, unitIncome: QUICK.moneyPerUnitZone },
  // Eroberung (seit dem Paket „Eroberung“, docs/prd/eroberung.md): 2 bis 4 Spieler, jeder gegen jeden. Die Konfliktzone ist ein Quadrat
  // aus grid × grid gleich großen Flaggengebieten, die Karte außerhalb ist in Viertel geteilt (je Startecke eines, für Fremde gesperrt).
  conquest: {
    half: 3300, // halbe Kantenlänge der quadratischen Konfliktzone (px); gleich zone.r, damit Stadt und Hot Zone ganz darin liegen
    grid: 4, // Gebiete je Kante (4 × 4 = 16 Flaggen A bis P)
    capTime: 20, // Sekunden, um eine Flagge bei 1 Einheit Vorsprung zu neutralisieren bzw. danach einzunehmen
    capMaxMul: 3, // Tempo der Einnahme = Vorsprung in Einheiten (2 Einheiten = 2 ×), höchstens so vielfach schneller
    flagIncome: 1.5, // Geld je Sekunde und gehaltener Flagge (kleines Zusatzeinkommen, vor dem Einkommensfaktor der KI)
    ticketMul: 3, // Start-Tickets ohne eigene Angabe (Tests, alte Stände) = Siegpunkte × ticketMul
    ticketChoices: [75, 150, 300, 1000], // Auswahl der Start-Tickets im Startmenü (1000 für lange Partien)
    ticketDefault: 300, // Vorauswahl im Startmenü
    tickEvery: 10, // Sekunden je Ticket-Takt: wer weniger Flaggen hält als der Führende, verliert 1 Ticket
    noFlagLoss: 1, // zusätzlicher Ticket-Verlust je Takt, wenn ein Team gar keine Flagge hält (und ein anderes eine hält)
    lockGrace: 300, // so viele Sekunden ohne Flagge (während ein anderes Team eine hält), dann fällt die Sperre des eigenen Viertels für den Rest der Partie
    spawnMin: 0.4, // Anteil von spawnRing, ab dem Einheiten erscheinen (nicht direkt am Mast)
    spawnRing: 90, // Einheiten erscheinen zwischen spawnMin (40 %) und 100 % dieses Umkreises um den Flaggenmast (px)
    flagRing: 120, // Freiraum um den Flaggenmast (px, Kartenbau); der Sockel am Mast ist ein Drittel davon (nur Darstellung). Das Gebiet (Quadrat) zeigt die Bodenlinie
    slotCap: { 2: 500, 3: 500, 4: 500 }, // Einheitenlimit je Team nach Spielerzahl (klassisch QUICK.unitLimit); viele Einheiten kosten Bildrate
    reinforce: false, // kostenloser Soldaten-Nachschub der Hauptstadt (BALANCE.reinforce): in der Eroberung aus, Truppen kosten immer Geld
    names: 'ABCDEFGHIJKLMNOP', // Buchstaben der Flaggen, zeilenweise von links oben
    // Feste und eigene Karten (Paket „Feste Karten“): Flaggen frei gesetzt, Gebiet ein Kreis um den Mast statt des 4 × 4-Rasters
    mapFlagR: 520, // Halbmesser des Flaggengebiets (px), wenn die Karte keinen eigenen angibt
    mapFlagRange: [250, 1000], // kleinster und größter erlaubter Halbmesser eines Flaggengebiets (px)
    mapFlagGap: 120, // so viel Abstand (px) halten zwei Flaggengebiete mindestens voneinander (Prüfung im Editor)
  },
  // Hot Zone: kleiner Kreis in der Konfliktzone, wandert zufällig oder zu aktiven Bohrern.
  // Einheiten darin bringen statt unitIncome das Doppelte (unitIncome = 2 × zone.unitIncome, nicht zusätzlich).
  // drillMinFuel = Mindestvorrat der FOB, um einen Bohrer zu starten; arrive = so nah (px) am Wanderziel sucht sich die Hot Zone ein neues
  hot: { r: 300, speed: 40, wanderSpeed: 40 / 3, unitIncome: QUICK.moneyPerUnitHot, wanderMin: 25, wanderMax: 45, drillMinFuel: 10, arrive: 8 },
  // Bauradien eigener FOBs dürfen sich nicht überlappen (minDistOwn = 2 × buildRadius); höchstens 10 FOBs mit der Hauptstadt
  // startStock: eine neue FOB (aufgebautes FOB-Fahrzeug) hat sofort diesen Anteil von storeCap je Sorte im Lager;
  // deploySnap: ist die Stelle des Fahrzeugs blockiert (Baum, Haus), baut es bis so viele px daneben auf
  fob: { buildRadius: 450, minDistOwn: 900, minDistEnemy: 700, max: QUICK.maxFobs, startStock: QUICK.fobStartStock, deploySnap: 128 },
  queueMax: QUICK.queueMax,
  trainSlots: QUICK.trainSlots, // Ausbildungsplätze der Hauptstadt: so viele Einträge der Warteschlange werden gleichzeitig ausgebildet
  baseAttackWarn: 20, // s zwischen zwei Meldungen „Basis wird angegriffen“
  shortageWarn: 20, // s zwischen zwei Meldungen je Sorte und Team
  // Straßen der Karte (Stadtraster und Feldwege): Bodenfahrzeuge fahren darauf schneller; abseits verbrauchen sie mehr Treibstoff
  roads: { speedMul: 1.35, offroadFuel: 1.15, defaultWidth: 40 }, // defaultWidth: Breite (px) einer Kartenstraße ohne eigene Angabe, für „auf der Straße“
  // Bagger (seit v5.35): Sekunden Arbeit je Stadtzelle beim Baggern und Abstand (px) zur Zellmitte, ab dem er arbeitet
  excavator: { digTime: 6, reach: 54 },
  fuelSlowMul: 0.25, // Tempo von Fahrzeugen ohne Treibstoff
  // Soldaten-Nachschub (§12): kostenloser Schütze an der Hauptstadt alle `interval` s, solange weniger als `soldierMin` Infanterie lebt
  reinforce: { interval: QUICK.reinforceEvery, soldierMin: 29, unit: 'rifleman' },
  demolishRefund: 0.25, // Abriss fertiger Gebäude (Baustellen: voll)
  scanInterval: 0.25, // Zielsuche
  fogInterval: 0.25,
  leash: 300, // Idle-Einheiten verfolgen max. so weit vom Ankerpunkt
  // Logistik (§11.1–11.3)
  logistics: {
    storeCap: QUICK.storeCap, // Obergrenze je Sorte und Lager einer vorderen FOB
    capitalCap: QUICK.capitalCap, // Obergrenze je Sorte im Lager der Hauptstadt (ohne Stadt wird sie darauf immer wieder aufgefüllt)
    truckCapacity: QUICK.truckLoad, // Ladung eines LKW (Summe)
    transferRate: 100, // Laden/Entladen je s
    transferReach: 140, // LKW muss so nah an der FOB-Mitte stehen
    resupplyRate: 4, // Nachfüllen Treibstoff je s und Einheit
    bmRate: 20, // Nachfüllen Baumaterial der Soldaten je s (bmCap)
    ammoRate: 60, // Nachfüllen Munition je s und Einheit (Lagereinheiten; Waffen füllen der Reihe nach)
    resupplyInterval: 0.5, // Takt des Nachfüllens (s)
    truckSupplyRange: 180, // Nachfüllen/Mauerbau aus LKW-Ladung
    boardReach: 45, // Infanterie steigt ein, wenn sie so nah am Hubschrauber ist
    dropRing: 26, // Absetzen: Abstand der Passagiere um den Hubschrauber
    dropArrive: 40, // Absetzen: so nah (px) am Absetzpunkt gilt der Transporthubschrauber als angekommen
  },
  // Bau und Reparatur (§11.8)
  construction: {
    helperRange: 90, // Bauer zählt, wenn ≤ 90 px vom Gebäuderand
    standRange: 60, // Bauer fährt bis hierher heran
    maxBuilders: 3,
    autoHelpRange: 400, // idle Bauer hilft automatisch
    autoRepairRange: 300, // idle Baufahrzeug repariert automatisch
    assignInterval: 1, // s, Takt der automatischen Zuweisung
    repairRate: 0.02, // Anteil maxHp je s und Baufahrzeug
    repairCostShare: 0.5, // Baumaterial-Kosten = cost.bm × geheilt/maxHp × 0.5
    siteHp: 0.1, // Anteil der Trefferpunkte, mit dem eine neue Baustelle beginnt (wächst mit dem Baufortschritt)
    siteHpGrow: 0.9, // Baustellen-HP wächst um 90 % über die Bauzeit (Start 10 %)
    siteSight: 150, // Baustellen sehen weniger
    wallMax: 40, // höchstens so viele Zellen je Mauerzug (Befehl buildWall; die Vorschau kürzt darauf, längere Befehle werden abgelehnt)
  },
  difficulty: {
    // Schwierigkeit über Verhalten: ab normal Späher und Konter-Mix, ab schwer Überfälle und Gruppen-Rückzug; hart ohne Einkommensbonus.
    // weather: nutzt das Wetter (bei schlechter Sicht früher ein Späher, im Nebel greift die Welle schon mit weniger Stärke an)
    // research: [Spielzeit (s), ab der die KI forscht, (frei)]; upgrades: false = Forschung nur mit doppelter Reserve (Leicht)
    // fobCap: FOBs mit Hauptstadt (höchstens fob.max);
    // cratePickers: so viele Soldaten holen oder tragen gleichzeitig Versorgungskisten;
    // fort: baut ab Spielzeit `from` (s) bis zu `fobs` FOBs zur Festung aus (Mauerring, Tore, `towers` Türme mit Besatzung und Dachaufbau). Weitere KI-Werte: js/data/ai.js
    // scramble: lässt ihre Jets mit Luft-Luft-Waffe in Alarmbereitschaft (Alarmrotte, CITY.air.scramble); false = schaltet sie ab
    // houseStorm: stürmt vom Gegner besetzte Häuser in der Konfliktzone, wenn genug freie Infanterie daneben steht; houseWorks: baut eigene Besatzungshäuser aus (Sandsäcke, MG-Nest, Stacheldraht), seit v5.67
    easy: { think: 3.0, incomeMult: 0.8, attackStrength: 2500, scout: false, mines: false, counter: false, raid: false, fallback: false, weather: false, research: [240, 720], upgrades: false, fobCap: 3, cratePickers: 1, fort: { from: Infinity, fobs: 0, towers: 0 }, houseStorm: false, houseWorks: false, scramble: false },
    normal: { think: 2.0, incomeMult: 1.0, attackStrength: 2000, scout: true, mines: true, counter: true, raid: false, fallback: false, weather: true, research: [150, 540], upgrades: true, fobCap: 5, cratePickers: 2, fort: { from: 600, fobs: 1, towers: 1 }, houseStorm: true, houseWorks: true, scramble: true },
    hard: { think: 1.0, incomeMult: 1.0, attackStrength: 1600, scout: true, mines: true, counter: true, raid: true, fallback: true, weather: true, research: [90, 420], upgrades: true, fobCap: 7, cratePickers: 3, fort: { from: 420, fobs: 2, towers: 2 }, houseStorm: true, houseWorks: true, scramble: true },
  },
  // Gelände (§7): wer höher steht, trifft härter (Direktfeuer, ab `dead` Höhenunterschied, voll ab `full`), tiefer stehend schwächer
  height: { bonus: 0.25, dead: 6, full: 36 },
  // Flugabwehr gegen Luftziele (Flak, SAM in units.js): Trefferchance je Schuss = hitChance der Waffe × Tempo-Faktor × Entfernungs-Faktor.
  // Tempo-Faktor (nur Waffen mit speedRef): speedRef / (speedRef + Zielgeschwindigkeit in px/s), so treffen schnelle Ziele selten.
  // Entfernungs-Faktor: 1 am Waffenrand verliert `falloff` (Anteil), direkt davor 1.
  airFire: { falloff: 0.3 },
  // Sicht im Gelände: Weitsicht von oben (+ (Höhe − base) / per, höchstens max), Kämme verdecken, was dahinter liegt.
  // eye = Augenhöhe über dem Boden (Infanterie, Fahrzeuge, Gebäude), target = Höhe, ab der ein Ziel hinter einer Kuppe auftaucht,
  // near = Gelände näher als das verdeckt nichts (man tritt an die Hangkante und schaut hinab)
  sightHeight: { base: 40, per: 350, max: 0.4, eye: { inf: 16, veh: 20, bld: 30 }, target: 12, near: 72 },
  // Tempo am Hang: Faktor = 1 − Steigung × up (bergab: 1 + Gefälle × down), begrenzt auf min … max; Fahrzeuge spüren es stärker
  slope: { upVeh: 1.5, upInf: 0.8, downVeh: 0.6, downInf: 0.3, min: 0.55, max: 1.2, pathCost: 1.2 },
  // Wegsuche der Einheiten (movement.js, pathfinding.js findUnitPath, seit v5.61), in untersuchten Zellen:
  // budget: je Simulationsschritt; ist es aufgebraucht, warten weitere Einheiten einen oder wenige Schritte auf ihren Weg.
  // slice: so viel darf eine Suche am Stück; braucht sie mehr, läuft sie als lange Suche (eine zur Zeit) je Schritt um slice weiter.
  // pocket: so viele Zellen flutet die Prüfung, ob ein Ziel in einer abgeschlossenen Tasche liegt (dann gilt die nächste freie
  // Zelle außerhalb); ring: so weit (Zellen) sucht sie um ein versperrtes Ziel nach der nächsten freien Zelle.
  // Geteilte Wege (pathplan.js): Start höchstens shareStart px und Ziel höchstens shareGoal px von einem eben gefundenen Weg entfernt
  // → die Einheit übernimmt ihn; shareKeep Wege bleiben je Schritt gemerkt.
  path: { budget: 8000, slice: 8000, pocket: 4096, ring: 64, shareStart: 320, shareGoal: 256, shareKeep: 16,
    hWeight: 1.05, // A*: Gewicht der Heuristik bei Hangkosten
    costDiv: 10, // Hangkosten je Zelle in Zehnteln: Zellenkosten = 1 + Hangwert / costDiv (auch Raster: Hangwert = Steigung × pathCost × costDiv)
    pullMul: 1.02, // Wegglättung (String-Pulling) mit Hangkosten: eine Abkürzung darf höchstens so viel × der Wegkosten kosten …
    pullAdd: 0.3, // … plus so viele Kosteneinheiten
    joinLook: 3, // geteilte Wege: so viele erste Wegpunkte werden auf freie Sicht vom Einstieg geprüft
  },
  // Häuserkampf (§7): Infanterie besetzt Stadthäuser (cap Plätze, hp hält das Haus aus), schießt von dort mit Reichweite ab Hauswand
  // und steht `floor` px höher (Höhenvorteil). Schwere Waffen (Schaden gegen Gebäude ab `heavy`: Kanone, RPG, Granaten, Mörser)
  // treffen Häuser × heavyMult, Handwaffen nur × lightMult. Stürzt ein Haus ein, fallen die Besatzer mit ejectDamage (Anteil der
  // vollen HP) Schaden heraus. minSize: kleinere Gebäude (Mauern) sind keine Häuser; enterReach: Abstand zur Wand beim Betreten.
  garrison: {
    kinds: {
      house: { cap: 4, hp: 700, name: 'Wohnhaus' },
      hall: { cap: 8, hp: 1200, name: 'Halle' },
      factory: { cap: 10, hp: 1800, name: 'Fabrik' },
      station: { cap: 8, hp: 1200, name: 'Bahnhof' },
      plant: { cap: 16, hp: 3000, name: 'Große Fabrikhalle' }, // feste Karten (East Europe Railway): Festung an Flagge F
    },
    minSize: 40,
    floor: 24,
    ejectDamage: 0.35,
    enterReach: 56,
    restApproach: 40, // px: beim Befehl „Gebäude besetzen“ stellt sich der Rest der Gruppe (Plätze voll) so weit unterhalb der Hauswand auf
    heavy: 25,
    heavyMult: 1.5,
    lightMult: 0.5,
    // Besatzer sind nicht ganz unverwundbar: `spill` (Anteil) jedes Hausschadens trifft zusätzlich die Besatzer, gleichmäßig verteilt
    // (Splitter, Schutt). Sandsäcke halbieren das (siehe works).
    spill: 0.2,
    // Stürmen: Infanterie läuft an ein gegnerisch besetztes Haus und kämpft an der Wand (Granaten, Nahkampf). Jeder Beteiligte macht
    // `dps` Schaden je Sekunde an der anderen Seite (der Reihe nach, einer nach dem anderen); die Besatzer stecken nur `cover` (Anteil)
    // des Schadens ein. Ist niemand mehr drin, ziehen die Stürmer ein und halten das Haus.
    storm: { dps: 14, cover: 0.7 },
    // Ausbau zur Stellung (Befehl 'fortifyHouse', einmal je Haus und Art, nur mit eigener Besatzung, `time` s Bauzeit, `cost` Geld):
    // sandbags = hp × hpMult (der Zuwachs kommt sofort dazu) und spill × spillMult; mgnest = Besatzer schießen mit `fire`-facher Feuerrate;
    // wire = Stürmer machen nur `stormMult` (Anteil) ihres Schadens.
    works: {
      sandbags: { name: 'Sandsäcke', cost: { money: 120 }, time: 14, hpMult: 1.5, spillMult: 0.5 },
      mgnest: { name: 'MG-Nest', cost: { money: 200 }, time: 18, fire: 1.35 },
      wire: { name: 'Stacheldraht', cost: { money: 80 }, time: 10, stormMult: 0.6 },
    },
    // Besetztes Haus in der Konfliktzone (seit v5.66): zusätzlich zu den Besatzern zählt es zoneWeight Gewicht für die Zonenkontrolle
    // (je Zone und je Hot Zone, die die Hausmitte erreicht; in der Hot Zone also doppelt). Keine Stimme, kein Geld.
    zoneWeight: 2,
    // Ausguck (seit v5.66): Besatzer sehen sightMul-mal so weit (nur Nebel aufdecken; Waffenreichweite bleibt).
    sightMul: 1.25,
    // Deckung an Ruinen (seit v5.66): Infanterie außerhalb von Häusern, höchstens r px vom Rand einer eingestürzten Stadthausruine,
    // nimmt nur mul des Schadens (direkte Treffer und Granaten, nicht Splitter und nicht Fahrzeuge).
    ruinCover: { r: 40, mul: 0.7 },
    // Feuerbereich (seit v5.67): Fensterseite = Seite, deren Mittelpunkt höchstens streetReach px von einer Stadtstraße entfernt ist
    // (game.map.town.roads ohne Feldwege). Besatzer schießen und zielen nur durch Fensterseiten; ein Haus ohne Straße in der Nähe ist rundum offen.
    streetReach: 60,
  },
  // Festung (§5a): Befehl 'fortify' an einer FOB baut einen Mauerring mit je einem Tor in der Mitte jeder Seite und `towers` Gefechtstürme
  // an den Ecken, die zum Gegner zeigen. ring = Abstand der Mauer von der FOB-Mitte (Zellen); floor = Höhenvorteil der Turmbesatzung (px);
  // ejectDamage = Schaden (Anteil der vollen HP) an der Besatzung, wenn der Turm fällt
  fortress: { ring: 4, towers: 2, floor: 40, ejectDamage: 0.35, towerShift: 3 }, // towerShift: so viele Zellen darf ein Turm nach innen ausweichen, wenn seine Ecke belegt ist (seit v5.03)
  // Tarnung (Scharfschütze): Gegner sehen die Einheit nur nahe an eigenen Einheiten/Gebäuden oder kurz nach einem Schuss
  stealth: { detectRange: 160, revealTime: 4 },
  // Versorgungskisten (§3, nach den Reliquien aus Age of Empires II): liegen abseits der Zone (pairs Paare, punktsymmetrisch).
  // Ein Soldat hebt eine auf (pickReach), trägt sie mit carrySpeed-Tempo und ohne zu schießen zur nächsten eigenen fertigen FOB
  // (deliverReach zur Wand); jede eingelagerte Kiste bringt dem Team `income` Geld/s. Fällt der Träger oder die FOB, liegt sie wieder am Boden.
  // stuckHold = s, die ein Träger ohne Weg zur FOB wartet, bis er es neu versucht; stallTime = s ohne Fortkommen (Gedränge an der FOB): dann gilt die Kiste als abgeliefert, …; stallReach = … wenn der Träger so nah an der FOB-Wand steht
  crates: { pairs: 3, income: QUICK.moneyPerCrate, carrySpeed: 0.75, pickReach: 40, deliverReach: 100, stuckHold: 5, stallTime: 3, stallReach: 320,
    freeRadius: 30, // Zellen: so weit sucht eine abgelegte Kiste die nächste freie Zellmitte
    restApproach: 40, // px: beim Aufheben-Befehl stellt sich der Rest der Gruppe so weit unterhalb der Kiste auf
    // Plätze der eingelagerten Kisten im Hof einer FOB: slotCols je Reihe, ab der unteren linken Ecke (slotX px nach rechts, slotY px nach oben),
    // je Kiste slotDx px nach rechts, je Reihe slotDy px nach oben
    slotCols: 4, slotX: 14, slotY: 12, slotDx: 17, slotDy: 15,
  },
  // Sichtbarer Schaden (rein optisch): Wracks zerstörter Fahrzeuge und Gebäude (wreckLife s, die letzten wreckFade s blassen sie aus,
  // höchstens wreckMax), Krater von Mörsereinschlägen (Radius craterR) und Brandflecken unter Wracks (craterLife s, höchstens craterMax).
  scars: { wreckLife: 240, wreckFade: 30, wreckMax: 80, craterLife: 180, craterFade: 30, craterMax: 150, craterR: 22,
    craterUnitMul: 1.5, // Brandfleck unter einem Fahrzeugwrack: Radius = Einheitenradius × so viel
    craterBuildingMul: 0.6, // Brandfleck unter einem Gebäudewrack: Radius = größere Kante der Grundfläche × so viel
  },
  // Formationen (§8, nach Age of Empires II): Abstand = größter Durchmesser + gap (spacingMin … spacingMax px); Linie höchstens
  // lineMax breit, Kolonne ab columnSingle Einheiten zweireihig. Geschlossen fahren: wer mehr als lead px (Restweg) vor dem Median
  // liegt, bremst (je brake px weiter voraus stärker, bis slowest × Grundtempo); wer mehr als lag px zurückliegt, fährt eigenes Tempo.
  formation: { gap: 12, spacingMin: 26, spacingMax: 44, lineMax: 10, columnSingle: 8, lead: 16, brake: 80, slowest: 0.1, lag: 80, stuck: 3, stuckDist: 8,
    wedgeBack: 0.85, // Keil: Abstand der Reihen nach hinten (× Platzabstand)
    minGap: 0.6, // Mindestabstand zweier Zielplätze (× Platzabstand)
    ringStep: 0.5, // Suche nach einem freien Platz: Ringe im Abstand von so viel × Platzabstand …
    ringMax: 4, // … bis höchstens so viel × Platzabstand
    ringSpots: 12, // Punkte je Ring der Platzsuche
    spotStep: 24, // Rasterweite (px) der Zielpunkte für Marsch- und Angriffsbefehle ohne Formation
    spotRingExtra: 4, // Zellen Reserve um die Mindestgröße des Zielfeldes (Wurzel der Einheitenzahl + so viel)
  },
  // Kommandeur (Held, einer je Team): Aura-Radius, Feuerrate darin (×), Heilung der Infanterie darin (HP/s, erst healDelay s nach dem
  // letzten Treffer); fällt er, bekommt der Gegner deathPoints Punkte
  commander: { aura: 300, fireRate: 1.1, heal: 1.5, healDelay: 6, deathPoints: 5 },
  // Wetter und Jahreszeiten (nach Empire Earth II, im Startmenü; ohne Angabe aus): Sichtweite × sight je Wetter; Bodenfahrzeuge
  // × vehicle bei Schneefall, × winter auf Winterboden. Ein Wetter hält phase s (Zufall je Art), Übergänge blenden über fade s.
  // Häufigkeit (Gewichte) des nächsten Wetters je Jahreszeit: odds (nie dasselbe Wetter zweimal hintereinander).
  weather: {
    sight: { clear: 1, rain: 0.8, fog: 0.65, snow: 0.8 },
    vehicle: 0.8,
    winter: 0.9,
    phase: { clear: [180, 360], rain: [100, 200], fog: [90, 180], snow: [100, 200] },
    fade: 20,
    odds: {
      summer: { clear: 6, rain: 3, fog: 1 },
      autumn: { clear: 3, rain: 4, fog: 3 },
      winter: { clear: 4, snow: 4, fog: 2 },
    },
  },
  // Forschung: eigene Datei js/data/research.js (seit v5.04: 10 Stufen, seit v5.19 8 Äste, Wirkungen je Einheitengruppe)
  // Fluss mit Brücken und Furten (Zufallskarte, im Startmenü; ohne Angabe aus): Furten sind passierbar, Bodeneinheiten dort × ford
  // so schnell, die Wegsuche zahlt fordCost (Zehntel je Zelle) dazu und nimmt lieber eine Brücke. Wasser bis fordDepth unter dem
  // Spiegel zählt in einer Furt als seicht. Brücken (deck px breit) haben bridgeHp und nehmen nur auf Befehl Schaden (Häuser-Faktoren:
  // schwere Waffen mehr, Handwaffen weniger). Zerstört sperren sie; ein Baufahrzeug baut sie für rebuildCost Geld in rebuild s wieder
  // auf (mehrere schneller, höchstens construction.maxBuilders), es arbeitet bis reach px vom Brückenkopf.
  river: { ford: 0.5, fordCost: 30, fordDepth: 12, deck: 80, bridgeHp: 2400, rebuildCost: 200, rebuild: 30, reach: 90 },
  // Pionier und Panzerminen (Paket E8, js/game/mines.js): Mine kostet Munition aus dem Teamlager; sie ist für Gegner getarnt
  // (sichtbar innerhalb spotNear durch einen eigenen Pionier, sonst innerhalb spotAny durch eine eigene Einheit).
  sapper: {
    mineCost: { mun: 40 }, // Munition je Mine
    maxMines: 6, // aktive Minen je Pionier
    mineTrigger: 18, // px: gegnerisches Fahrzeug in diesem Umkreis löst aus
    mineDamage: { heavy: 600, light: 400 }, // Schaden je Panzerung des auslösenden Fahrzeugs
    spotNear: 60, // px: Sicht durch einen eigenen Pionier
    spotAny: 25, // px: Sicht durch irgendeine eigene Einheit
    clearRange: 40, // px: gegnerischer Pionier räumt die Mine
    clearTime: 3, // s Räumzeit
    layReach: 30, // px: der Pionier läuft bis auf diese Nähe zur Klickstelle, dann legt er die Mine (Befehl layMine)
    layNear: 40, // px: endet der Weg des Planers (Zellenraster) etwas davor, legt er trotzdem, wenn er so nah steht
  },
  // Kampfflugzeuge (seit v5.03, PRD §6 „F-16“, §15 „Fliegerhorst“): In der Luft dreht ein Jet
  // höchstens turn rad/s und kreist im Abstand orbit (px) um seinen Befehlspunkt. Er fliegt zurück, wenn der Treibstoff für den
  // Heimweg × reserve plus margin s nicht mehr reicht oder keine Rakete mehr da ist; landet über eine Platzrunde auf Bahn 2 (Werte unten).
  // Am Boden tanken und munitionieren sie nach den Raten in CITY.air (Tank, Munitionslager); repair × maxHp je s wird repariert.
  jets: {
    turn: 2.4,
    orbit: 280,
    reserve: 1.3,
    margin: 8, // s Treibstoff Reserve über dem Heimweg (seit v5.15 8 statt 4: Platzrunde und Rollen)
    repair: 0.04,
    lift: 92,
    // Start und Landung (seit v5.15, aircraft.js): Rollen am Boden, Startlauf, Steigflug, Platzrunde, Gleitpfad, Ausrollen
    taxi: 60, // Rolltempo am Boden (px/s)
    taxiTurn: 3, // Drehrate am Boden (rad/s)
    taxiWait: 12, // s, so lange wartet ein rollender Jet höchstens hinter einem anderen
    gap: 40, // Abstand zum Vordermann beim Rollen (px)
    keepRight: 16, // Rechtsverkehr am Boden: so weit rollt ein Jet rechts neben der Mitte von Rollfeld und Straße (px), Gegenverkehr fährt aneinander vorbei
    accel: 110, // Beschleunigung im Startlauf und danach (px/s²)
    rotate: 0.62, // Anteil des Reisetempos, bei dem er abhebt
    climb: 3, // s vom Boden bis zur Reiseflughöhe
    downwind: 0.75, // Tempo im Gegenanflug (Anteil des Reisetempos)
    approach: 0.55, // Tempo im Endanflug (Anteil)
    slow: 90, // Verzögerung in der Luft (px/s²)
    decel: 120, // Bremsen nach dem Aufsetzen (px/s²)
    final: 700, // Länge des Endanflugs vor der Schwelle (px)
    base: 500, // erst westlich von Schwelle − base dreht er in den Endanflug ein (px)
    pattern: 260, // seitlicher Abstand des Gegenanflugs zur Landebahn (px)
    glide: 520, // Gleitpfad: auf so vielen px vor der Aufsetzmarke sinkt er von Reiseflughöhe auf den Boden
    touch: 40, // Aufsetzmarke hinter der Schwelle von Bahn 2 (px)
    zone: 220, // Aufsetzzone: bis so weit hinter der Marke darf er noch aufsetzen, sonst Durchstarten (px)
    planRoom: 600, // Landerichtung: vor der Schwelle braucht die Platzrunde final + base + planRoom px bis zum Kartenrand
    outbound: 400, // Gegenanflug: so weit über den Eindrehpunkt (Schwelle − final − base) hinaus fliegt er (px)
    lead: 300, // Zielpunkt so weit voraus im Endanflug und im Steigflug nach dem Start (px)
    alignHead: 0.95, // ausgerichtet: Kosinus des Winkels zwischen Nase und Landerichtung mindestens so groß (1 = genau in Landerichtung)
    alignCross: 30, // ausgerichtet: höchstens so weit seitlich der Mittellinie (px), dann sinkt er im Gleitpfad
    finalHead: 0.85, // im Endanflug: Kosinus des Winkels zwischen Nase und Landerichtung mindestens so groß
    finalCross: 80, // im Endanflug: höchstens so weit seitlich der Mittellinie (px)
    turnIn: 1.5, // Eindrehen: vor der Aufsetzmarke braucht er Seitenablage × turnIn + Gleitpfad × turnGlide px
    turnGlide: 0.6,
    taxiAhead: 0.6, // Rollen: ein Jet gilt als „im Weg“, wenn der Vordermann im Winkel liegt, dessen Kosinus über so viel liegt (1 = genau voraus)
    taxiSameDir: 0.3, // … und seine Nase höchstens so weit abweicht (Kosinus der Winkeldifferenz mindestens so groß)
    taxiAlign: 0.05, // Startlauf: erst wenn die Nase höchstens so viele rad von der Startrichtung abweicht, beschleunigt er
    centerPull: 4, // Landung: Zug auf die Mittellinie der Bahn (je s, höchstens 1 je Schritt)
    circleLead: 0.7, // Kreisen: Zielpunkt so viele rad voraus auf dem Kreis
    nearFinal: 2.5, // „nahe am Endanflug“: Abstand zur Schwelle höchstens final × so viel (px)
    lockAhead: 60, // px vor Beginn des Gleitpfads belegt er schon die Landebahn (sonst kreist er weiter)
    edge: 100, // px: Abstand der Platzrunde vom Kartenrand (Zielpunkte werden darauf begrenzt)
    touchAlt: 0.02, // aufgesetzt, sobald die Flughöhe (Anteil der Reiseflughöhe) höchstens so groß ist
    goAroundReset: 1.5, // Durchstarten endet, sobald er mehr als base × so viel vor der Schwelle ist
  },
  // Tiere (rein optisch, nach den Jagdtieren aus Age of Empires II): `pairs` Rudelpaare (punktsymmetrisch) außerhalb der Zone, Rehe
  // (deer Tiere je Rudel) und Wildschweine (boar). Sie grasen und ziehen langsam (walk px/s) weiter; kommt eine Einheit näher als
  // scare (je Art: Infanterie, Fahrzeug, Hubschrauber) oder knallt es in boom px, flieht das ganze Rudel (run px/s) flee px weit.
  animals: {
    pairs: 6, // seit v5.14 mit der größeren Karte 6 statt 4
    deer: [3, 5],
    boar: [2, 4],
    walk: 26,
    run: { deer: 170, boar: 130 },
    scare: { inf: 180, vehicle: 320, air: 280, boom: 380 },
    flee: [350, 520],
    think: 0.25,
    wander: 110, // so weit grast ein Tier um die Rudelmitte
    migrate: [16, 34], // s, nach so langer Zeit zieht das Rudel weiter
    migrateDist: [220, 480], // px, so weit zieht das Rudel dann
    zoneGap: 250, // Abstand der Weiden zur Zonenkante
    spawnGap: 1400, // Abstand der Rudel zu den Startpunkten
    groupGap: 1100, // Abstand der Rudel untereinander
    edge: 60, // px: Abstand zum Kartenrand, den Tiere nicht betreten
    lineStep: 32, // px: Schrittweite der Prüfung, ob die Strecke zu einem Ziel offen ist
    placeTries: 300, // Versuche je Rudelpaar, einen Platz zu finden
    margin: 500, // px: Rudelmitten liegen mindestens so weit vom Kartenrand
    spotTries: 6, // Versuche je Tier (× Rudelgröße), einen freien Startplatz um die Rudelmitte zu finden
    spotMin: 12, // px: Mindestabstand eines Tiers von der Rudelmitte beim Start …
    spotSpread: 50, // … plus ein Zufallsanteil bis so viel px
    startGraze: [1, 6], // s: so lange grasen die Tiere am Anfang (Zufall von … bis)
    fleeAngles: [0, 0.5, -0.5, 1, -1, 1.5, -1.5], // rad: Richtungen zur Wahl bei der Flucht (0 = genau weg von der Gefahr), in dieser Reihenfolge
    fleeJitter: 0.2, // rad: Zufallsabweichung (±) der Fluchtrichtung
    refleeDist: 60, // px: ein fliehendes Tier sucht sich ein neues Ziel, wenn das alte nur noch so nah ist
    runJitter: [0.9, 1.1], // Zufallsfaktor auf das Fluchttempo (von … bis)
    migrateTries: 8, // Versuche, einen neuen Weideplatz zu finden, wenn das Rudel weiterzieht
    arriveFlee: 20, // px: ein Fliehender gilt ab so nah am Ziel als angekommen
    restFlee: [2, 5], // s: Rast nach der Flucht (Zufall von … bis)
    arriveWalk: 6, // px: ein Gehender gilt ab so nah am Ziel als angekommen
    graze: [3, 9], // s: Grasen zwischen zwei Wegen (Zufall von … bis)
    wanderTries: 6, // Versuche, ein neues Ziel in der Nähe der Rudelmitte zu finden
    walkJitter: [0.8, 1.2], // Zufallsfaktor auf das Gehtempo (von … bis)
  },
  // Bewegung der Einheiten (js/game/movement.js): Neuplanung, Ankunftsradien, Formationsplatz, Austritt aus Häusern, Suchradius
  move: {
    repath: 1.0, // s: Neuplanung des Wegs bei Verfolgung eines Ziels
    blockRepath: 0.5, // s: Neuplanung nach einem blockierten Wegpunkt
    arrive: 0.5, // px: ein Wegpunkt gilt so nah als erreicht
    finalArrive: 32, // px: das Endziel gilt so nah als erreicht (Einheiten am selben Sammelpunkt drängeln sich sonst ewig in „move“)
    settleDone: 4, // px: Formation: so nah am eigenen Platz gilt er als erreicht
    settleTime: 3, // s: höchstens so lange rückt eine Einheit am Ende auf ihren Formationsplatz nach
    corner: 48, // px: nahe einer Wegecke geht es bei freier Sicht gleich zum nächsten Wegpunkt (sonst Stau an der Ecke)
    exitFan: 5, // Winkelplätze beim Verlassen eines Hauses ohne Zielrichtung (Einheit-ID reihum, der mittlere zeigt genau zum Ziel)
    exitFanStep: 0.3, // rad zwischen zwei Winkelplätzen beim Verlassen eines Hauses
    exitGap: 14, // px: so weit steht eine Einheit vor der Hauswand, wenn sie das Haus verlässt
    passableRadius: 30, // Zellen: so weit sucht eine Einheit in einer gesperrten Zelle die nächste passierbare
  },
  // Nebel des Krieges (js/game/fog.js; Takt: fogInterval): cell = Kantenlänge einer Nebelzelle (px); Sichtstrahlen im Abstand rayGap (px) am
  // Rand der Sichtweite (kleiner als eine Zelle), mindestens minRays Strahlen je Einheit, Schrittweite entlang eines Strahls rayStep (px)
  fog: { cell: 64, rayGap: 44, rayStep: 24, minRays: 16 },
  // Zielsuche verteilen: eine Einheit mit der ID i beginnt ihre Zielsuche nach (i % slots) × step s (verteilt die Last über die Zeit)
  scanStagger: { slots: 5, step: 0.05 },
  spawnRing: 3, // Zellen: so weit rings um das Ausbildungsgebäude sucht eine neue Einheit ihren Platz
  shellSpeed: 300, // px/s: Flugtempo eines Mörsergeschosses, wenn die Waffe keines nennt (Haubitze schneller)
  // Kampf: cityMargin = zusätzlicher Suchradius (px) nach Stadtgebäuden als Ziel; cannonDamage = Schaden gegen leichte Panzerung, ab dem ein
  // Schuss als Kanonenschuss gilt (Geschoss plus kleine Explosion im Bild)
  // wallOther: Anteil des Gebäudeschadens (struct) gegen Mauern (Schadensklasse wall) für Waffen ohne eigenen Wert wall, z. B. Gewehr
  // 4 → 0,4 je Treffer (Paket „Mauern“): Handwaffen kratzen Mauern nur; Explosionen (Splash) treffen sie voll mit struct
  combat: { cityMargin: 32, cannonDamage: 60, wallOther: 0.1 },
  // Effekte (rein optisch): Lebensdauer je Art in s, ohne Eintrag lifeDefault
  effects: { life: { tracer: 0.12, shell: 0.3, explosion: 0.5, intercept: 0.4, muzzle: 0.1, death: 0.1 }, lifeDefault: 0.3 },
  // Meldungen mit Drosselung (game.notify): Mindestabstand in s zwischen zwei gleichen Meldungen je Team (ohne Eintrag shortageWarn)
  notify: {
    crateGone: 5, // „Der Gegner hat die Kiste zuerst“
    crateStuck: 10, // „Kein Weg zur FOB“
    crateDrop: 5, // „Kistenträger gefallen“
    houseTaken: 3, // „Gebäude ist vom Gegner besetzt“
    houseFull: 3, // „Gebäude ist voll“
    noUni: 30, // „Forschung ruht: keine Universität“
  },
  // Standards im Startmenü (das Menü merkt sich die letzte Wahl je Gerät). new Game() ohne Angabe schaltet alles aus (Tests).
  menuDefaults: { conquest: true, opponents: 1, difficulty: 'normal', weather: 'random', research: true, river: true, buildRules: true }, // buildRules: Baugebiet der Stadt (seit v5.78)
  resNames: { money: 'Geld', bm: 'Baumaterial', mun: 'Munition', fuel: 'Treibstoff' },
  teamNames: ['Blau', 'Rot', 'Grün', 'Gelb'], // Team 2 und 3 nur im Modus Eroberung (bis zu 4 Spieler)
  teamColors: ['#3d8bfd', '#e5484d', '#3fb950', '#e3b341'],
};
