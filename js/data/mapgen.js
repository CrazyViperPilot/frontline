// Werte des Kartengenerators (js/game/map.js, landscape.js, relief.js, river.js, mapdata.js). Wegweiser: docs/wo-aendern.md.
// Vorsicht: Jede Änderung hier verändert ALLE Zufallskarten (gleicher Seed = andere Karte als vorher) und kann Tests brechen,
// die feste Seeds nutzen. Gespeicherte Karten aus dem Editor bleiben unverändert. Abstände in px, Paare = punktsymmetrisch gespiegelt.
// Zufallsbereiche [von, bis] werden mit rng.range gezogen; die Reihenfolge der Zufallsaufrufe im Code ist Teil der Karte.
export const MAPGEN = {
  // Allgemein: Versuche, Zugänge zur Zone, Hänge
  general: {
    attempts: 20, // Versuche mit seed + 1, bis eine spielbare Karte entsteht
    minRoutes: 3, // so viele getrennte Wege führen mindestens von jedem Start in die Konfliktzone
    zoneSlope: 0.25, // in der Stadt ist kein Hang steiler (alle Wege gut befahrbar)
    crossRegion: 1500, // so viele Zellen erreicht man von jedem Ufer einer Querung mindestens (sonst liegt sie in einer Tasche)
    crossBank: 250, // Prüfpunkte einer Querung: so weit (px) hinter der Wasserkante liegt je ein Punkt an jedem Ufer
    crossReach: 200, // Suchkreis der Uferverbindung: Radius um die Querung = Abstand der Prüfpunkte + dieser Wert (px)
    routeKeepOut: 900, // Wegezählung (Zugänge zur Zone): ringsum den Startpunkt (px) werden gefundene Wege nicht gesperrt (auch Karteneditor „Prüfen“)
    routeWant: 3, // Wegezählung: so viele getrennte Wege werden höchstens gezählt, wenn nichts anderes verlangt wird
    routeBand: 340, // Wegezählung: Radius (px) des Korridors, den ein gefundener Weg für die nächste Suche sperrt
    spawnEdge: 700, // Startpunkte (Hauptstadt) so weit vom linken und unteren bzw. rechten und oberen Kartenrand (auch leere Editor-Karte)
    buildLand: 2000, // Bauland (seit v5.14 2000 statt 1300, bis nahe an den Fluss): so weit um jeden Startpunkt keine Felsen, Wälder, Bäume, Gehöfte, Einzelhäuser (Platz für die Stadt)
  },
  // Prüfung einer Editor-Karte (mapdata.js, „Prüfen“)
  check: {
    spawnClear: 180, // freier Platz (px) um einen Startpunkt (Hauptstadt und Startunits): keine Gebäude, Bäume, Hindernisse, steiles Gelände, Wasser
    spawnEdgeMin: 250, // Startpunkte liegen mindestens so weit (px) vom Kartenrand
    spawnDistMin: 2500, // die beiden Startpunkte liegen mindestens so weit (px) auseinander
    zoneCenterClear: 40, // ist die Zonenmitte so nah (px) an einem Hindernis, wird stattdessen ein Punkt am Zonenrand geprüft
    zoneSearch: 30, // Suchradius (Zellen) um die Zonenmitte nach der nächsten freien Zelle als Ziel der Wegezählung
    routesShown: 4, // „Prüfen“ zählt höchstens so viele getrennte Zugänge je Startpunkt
  },
  // Höhengelände (relief.js)
  relief: {
    water: -20, // Wasserspiegel: tiefer liegendes Gelände ist See und unpassierbar
    steep: 0.42, // Neigung (Höhe je px), ab der niemand mehr hinaufkommt (Fels)
    rock: 0.3, // Neigung, ab der das Bild Fels zeigt (Gelände für Wald, Gehöfte und Bäume darf nicht steiler sein)
    peak: 300, // Gipfel: darüber ist alles Fels und unpassierbar, auch wenn es flach ist
  },
  // Gelände der Zufallskarte (landscape.js)
  terrain: {
    hills: 10, // Hügelpaare außerhalb der Stadt (passierbar; seit v5.14 mit der größeren Karte 10 statt 7)
    zoneHills: 2, // sanfte Hügelpaare in der Stadt
    ridges: 6, // Bergrücken-Paare (steile Flanken = Fels, unpassierbar; seit v5.14 6 statt 4)
    lakes: 3, // Seepaare (seit v5.14 3 statt 2)
    spawnFlat: 1400, // ebene Fläche um die Startpunkte, danach weicher Übergang bis SPAWN_BLEND (seit v5.03 größer: Bauland; seit v5.14 1400 statt 950)
    spawnBlend: 1800, // Ende des weichen Übergangs um die Startpunkte (seit v5.14 1800 statt 1250)
    baseLevel: 36, // mittlere Höhe des Grundes über dem Wasserspiegel-Bezug 0
    dryLevel: 22, // Mindesthöhe über dem Wasserspiegel an Wegen, in der Stadt und an den Startpunkten (kein Tümpel auf dem Weg)
    groundDry: 8, // Wald, Gehöfte und Bäume stehen nur, wo das Gelände mindestens so hoch (Höhe) über dem Wasserspiegel liegt
    clearEdge: 150, // Freiraum für Hügel, Berge und Seen: so weit (px) vom Kartenrand weg
    clearRoad: 40, // Freiraum: Abstand (px) zu den Zufahrtsstraßen, zusätzlich zum Einflussradius
    clearRail: 60, // Freiraum: Abstand (px) zur Bahnlinie, zusätzlich zum Einflussradius
    baseNoise: [
      { amp: 46, scale: 2600, ox: 3.1, oy: 7.7 }, // grobe Wellen des Grundes: Höhe, Wellenlänge (px), Versatz im Rauschen
      { amp: 22, scale: 1300, ox: 11.3, oy: 1.9 }, // mittlere Wellen
      { amp: 10, scale: 650, ox: 5.5, oy: 13.1 }, // feine Wellen
    ],
    baseMix: 0.7, // Anteil des gemittelten (punktsymmetrischen) Grundrauschens an der Höhe
    townDamp: 0.25, // in der Stadt bleibt vom Grundrauschen nur dieser Anteil (Untergrenze der Dämpfung)
    townGain: 0.75, // Anteil des Grundrauschens, der mit dem Abstand zur Stadt hinzukommt (Dämpfung + Zuwachs = volles Rauschen)
    townDampIn: 700, // Dämpfung beginnt so weit (px) innerhalb des Zonenrands
    townDampOut: 800, // volles Rauschen ab so weit (px) außerhalb des Zonenrands
    dryRoadIn: 70, // Zufahrten und Bahn: bis zu diesem Abstand (px) gilt die Mindesthöhe voll
    dryRoadOut: 260, // Zufahrten und Bahn: ab diesem Abstand (px) gilt sie nicht mehr
    dryZoneOut: 300, // Stadt: Mindesthöhe gilt voll bis zum Zonenrand und läuft bis so weit (px) davor aus
    peakSoft: 330, // Gipfel über dieser Höhe werden weich begrenzt (Speicherformat reicht bis 382)
    peakSoftRate: 0.5, // oberhalb von peakSoft zählt nur dieser Anteil der Mehrhöhe
    ridgeTries: 400, // Versuche je Bergrücken
    ridgeSigma: [230, 310], // Breite (σ, px) des Bergrückens (Querschnitt glockenförmig)
    ridgeHeight: [190, 250], // Kammhöhe
    ridgeEdge: 300, // Anfangspunkt des Bergrückens: so weit (px) vom Kartenrand
    ridgeLeg: [480, 900], // Länge (px) jeder der zwei Strecken eines Bergrückens
    ridgeTurn: 0.7, // Knick zwischen den beiden Strecken: höchstens ± so viele Bogenmaß
    ridgePhase: 10, // Phase der Gipfelwellen entlang des Kamms: zufällig von 0 bis hier (Bogenmaß)
    ridgeBumps: [2, 4], // Anzahl der Gipfel entlang des Kamms (Zufallsbereich, gebrochen)
    ridgeReach: 2.3, // Einflussradius des Bergrückens beim Freiraum: dieses Vielfache von σ
    ridgeSpacing: 1.8, // Abstand zweier Bergrücken: mindestens dieses Vielfache der Summe ihrer σ
    ridgeMirror: 3.6, // Abstand eines Bergrückens zu seinem Spiegelbild: mindestens dieses Vielfache von σ
    ridgeCut: 3, // ab diesem Vielfachen von σ vom Kamm gibt es keinen Bergrücken mehr
    ridgeFadeIn: 0.22, // der Kamm läuft am Anfang auf den ersten Teil seiner Länge (Anteil) aus
    ridgeFadeOut: 0.78, // der Kamm läuft am Ende ab diesem Anteil seiner Länge aus
    ridgeCrest: 0.8, // Kammhöhe: Sockel des Kamms als Anteil (der Rest sind die Gipfel)
    ridgeBump: 0.2, // Kammhöhe: Anteil der Gipfelwellen
    ridgeFoot: 2.4, // Fuß des Bergrückens: so viele σ vom Kamm läuft er flach aus
    ridgeShape: 1.7, // Querschnitt: Exponent (größer = spitzer, steilere Flanken)
    lakeTries: 300, // Versuche je See
    lakeR: [260, 420], // Radius des Sees (px)
    lakeEdge: 300, // Mittelpunkt des Sees: so weit (px) vom Kartenrand
    lakeClear: 1.9, // Freiraum des Sees: dieses Vielfache seines Radius zu Zone, Startpunkten, Zufahrten, Bahn
    lakeZoneGap: 80, // Freiraum des Sees: zusätzlicher Abstand (px) zur Zone
    lakeRidgeGap: 2.2, // Abstand eines Sees zu Bergrücken: dieses Vielfache seines Radius
    lakeSpacing: 2.4, // Abstand zweier Seen: dieses Vielfache der Summe ihrer Radien
    lakeSpacingAdd: 200, // Abstand zweier Seen: dazu noch so viele px
    lakeMirror: 3.4, // Abstand eines Sees zu seinem Spiegelbild: mindestens dieses Vielfache seines Radius
    lakeWobA: [0.08, 0.16], // Uferlinie, Schwankung mit 3 Buchten: Stärke (Anteil des Radius)
    lakeWobB: [0.05, 0.1], // Uferlinie, Schwankung mit 5 Buchten: Stärke (Anteil des Radius)
    lakeShoreIn: 0.85, // Ufer: Mulde reicht bis zu diesem Anteil des Radius voll, dann läuft sie aus
    lakeShoreOut: 2.7, // Ufer: bei diesem Vielfachen des Radius ist der See ausgelaufen
    lakeDepth: 48, // Tiefe in der Mitte des Sees unter dem Wasserspiegel
    lakeRim: 3, // Höhe des Ufers knapp außerhalb des Sees über dem Wasserspiegel
    hillTries: 300, // Versuche je Hügel
    hillHeight: [80, 150], // Höhe eines Hügels
    hillSigmaMin: 2.4, // Breite (σ) mindestens dieses Vielfache der Höhe (sanft genug zum Hinauffahren)
    hillSigma: [330, 520], // Breite (σ, px) eines Hügels (mindestens hillSigmaMin · Höhe)
    hillEdge: 200, // Mittelpunkt eines Hügels: so weit (px) vom Kartenrand
    hillZoneSlope: 0.2, // an der Stadt (näher als 2 σ am Zonenrand) nur Hügel, deren Höhe höchstens diesen Anteil von σ hat
    hillZoneInner: 200, // Hügel liegen nie weiter als so viele px innerhalb des Zonenrands
    hillLakeGap: 2.4, // Abstand eines Hügels zu Seen: dieses Vielfache des Seeradius (plus 2 σ)
    hillMirror: 3, // Abstand eines Hügels zu seinem Spiegelbild: mindestens dieses Vielfache von σ
    zoneHillIn: 700, // Hügel in der Stadt: Abstand zur Zonenmitte mindestens so viele px
    zoneHillOut: 900, // Hügel in der Stadt: Abstand zur Zonenmitte höchstens Zonenradius minus so viele px
    zoneHillHeight: [40, 70], // Höhe der Hügel in der Stadt
    zoneHillSigma: [480, 650], // Breite (σ, px) der Hügel in der Stadt
  },
  // Fluss mit Brücken und Furten (landscape.js, river.js; nur wenn „Fluss“ an ist)
  river: {
    halfW: 92, // halbe Breite des Flusses
    bank: 330, // Breite des Uferhangs beiderseits des Wassers (px)
    depth: 40, // Tiefe der Flussmitte unter dem Wasserspiegel
    r: [3728, 3968], // Abstand der Flussmitte von der Kartenecke (seit v5.14 mit der größeren Karte 1448 px weiter: gleich weit von der Zone, doppelt so weit von der Hauptstadt)
    bridges: [16, 45, 74], // Winkel (Grad vom Seitenrand aus) der Brücken am Flussbogen
    straight: 45, // die Brücke bei diesem Winkel (die mittlere) liegt zur Ecke hin gerade und trägt den Feldweg zur Stadt
    fords: [30.5, 59.5], // Winkel (Grad) der Furten
    shift: 4, // Brücken und Furten rücken bis zu ± so viele Grad auf das niedrigste Gelände
    ramp: 0.16, // Steigung der Zufahrten an Brücken und Furten (befahrbar)
    fordR: 150, // Radius der Furt (Kartenformat `fords`)
    deckOver: 62, // Brücke reicht so weit über die Wasserkante hinaus auf festen Grund
    maxH: 165, // höchstes Gelände unter dem Flusslauf (sonst neuer Versuch: kein Fluss durch einen Bergrücken)
    fordDepth: 1.5, // Furt: so tief unter dem Wasserspiegel liegt das Bett (seicht, man sieht die Strömung über den Steinen)
    bedBelow: 3, // Flussbett: Rand der Mitte liegt so viel unter dem Wasserspiegel, dazu kommt depth zur Mitte hin
    deckMargin: 8, // Fahrbahn einer Brücke: Zellen höchstens so viele px neben der Achse (zusätzlich zur halben Breite) zählen dazu
    deckLift: 8, // Höhe der Fahrbahn: mindestens so viel über dem Wasserspiegel (Höhenvorteil)
    stopShort: 20, // Haltepunkt vor Brücke oder Furt: so viele px vor der Reichweite bleibt ein Baufahrzeug stehen
    minPiece: 40, // Straßen und Feldwege: Stücke über Land, die kürzer als so viele px sind, entfallen am Fluss
    tries: 60, // Versuche, einen Flussbogen zu finden, der Startgelände, Zone und Berge meidet
    swing1: [60, 150], // große Schwünge des Flusses: Ausschlag (px)
    wave1: [2.5, 4.5], // große Schwünge: Anzahl Wellen entlang des Bogens
    swing2: [20, 50], // kleine Schwünge: Ausschlag (px)
    wave2: [7, 11], // kleine Schwünge: Anzahl Wellen entlang des Bogens
    arc: [-12, 102], // Bogen des Flusses in Grad von der Seitenkante aus (über die Kartenränder hinaus)
    arcStep: 1.5, // Abstand der Stützpunkte des Bogens (Grad)
    offMap: 50, // Punkte des Bogens so weit (px) außerhalb der Karte werden nicht geprüft
    zoneGap: 40, // der Fluss hält so viel (px) Abstand zur Zone, zusätzlich zum Uferhang
    probes: 6, // Suche der Querungsstelle: so viele Prüfpunkte je Seite im Abstand probeStep
    probeStep: 110, // Abstand (px) der Prüfpunkte quer zum Fluss
    probeKeep: 4, // von den Prüfpunkten zählen die ersten so viele für die Höhe des Geländes
    wetLevel: 4, // ein Prüfpunkt unter dem Wasserspiegel plus diesem Wert zählt als „nass“ (die Zufahrt führte ins Wasser)
    wetPenalty: 1000, // jeder nasse Prüfpunkt verschlechtert die Stelle um so viel Höhe
    influence: 700, // Gelände wird im Abstand bis Uferhang + so viele px vom Fluss umgeformt (Zufahrten)
    rampReach: 900, // Zufahrten an Brücken und Furten wirken im Umkreis von so vielen px
    rampIn: 130, // Zufahrt: bis zu diesem Abstand (px) von der Brückenachse bzw. Furt voll flach
    rampOut: 250, // Zufahrt: ab diesem Abstand (px) nicht mehr
    rampBankIn: 450, // Zufahrt: bis Wasserrand plus so viele px quer zum Fluss voll
    rampBankOut: 650, // Zufahrt: ab Wasserrand plus so vielen px nicht mehr
    rampBase: 3, // Zufahrt an Land beginnt so hoch über dem Wasserspiegel
    rampMin: 6, // Zufahrt: Senken und Seen werden mindestens bis so hoch über den Wasserspiegel aufgefüllt
    fordClearOff: 180, // freie Fläche an einer Furt: Kreise so weit (px) hinter dem Wasserrand
    fordClearR: 260, // Radius dieser Kreise an einer Furt (kein Wald, keine Bäume, keine Gebäude)
    fordClearMid: 220, // Radius der freien Fläche in der Furtmitte
    bridgeClearOff: 90, // freie Fläche an einer Brücke: Kreise so weit (px) hinter den Brückenenden
    bridgeClearR: 200, // Radius dieser Kreise an einer Brücke
  },
  // Hindernisse und Bewuchs
  scatter: {
    obstaclePairs: 48, // Felsen- und Waldpaare (seit v5.14 mit der größeren Karte 48 statt 32)
    scatterPairs: 520, // verstreute Bäume und Büsche (Paare; seit v5.14 520 statt 350)
    obstacleTries: 300, // Versuche je Wald
    obstacleR: [30, 90], // halber Radius eines Waldes (px; der Radius ist das Doppelte, gerundet, immer gerade)
    obstacleZoneGap: 40, // Abstand eines Waldes zur Stadt (px)
    treeEdge: 40, // einzelne Bäume: so weit (px) vom Kartenrand
    treeRail: 20, // einzelne Bäume: Abstand (px) zum Bahnkorridor
    treeZoneGap: 30, // einzelne Bäume: Abstand (px) zur Zone
    treeObstacleGap: 25, // einzelne Bäume: Abstand (px) zu Wäldern
    treeAreaGap: 25, // einzelne Bäume: Abstand (px) zu belegten Flächen (Gebäudegelände, Zufahrten)
    treeR: [10, 19], // Radius eines einzelnen Baums (px)
    treeGroup: [40, 20], // zweiter Baum einer Baumgruppe: Versatz (px) in x und y
  },
  // Stadt in der Konfliktzone (Straßenraster, Bahn, Wachtürme)
  town: {
    railHalf: 40, // halbe Breite des Bahnkorridors, Gebäude, Bäume und Felsen bleiben davon frei
    railMargin: 20, // Zielpunkt der Erreichbarkeitsprüfung: so weit (px) über dem Bahnkorridor (die Zonenmitte liegt unter dem Zug)
    block: 384, // Häuserblock (Straßenraster); seit v5.03 ein Vielfaches von 2 Stadtzellen (128 px), damit jede Straße genau auf einer Zellreihe liegt
    roadW: 64, // Straßenbreite (= eine Stadtzelle; die Straßen der Zone sind Stadtstraßen, js/game/roads.js)
    avenueW: 64, // die zwei Straßen am Zentrumsplatz (seit v5.03 so breit wie alle anderen)
    roadRim: 60, // Rasterstraßen enden so weit (px) innerhalb des Zonenrands (Kreissehne)
    roadMin: 100, // Rasterstraßen, deren halbe Länge kürzer ist (px), entfallen
    blockMargin: 150, // Häuserblöcke bis so weit (px) innerhalb des Zonenrands (bestimmt die Zahl der Blockreihen)
    lotRim: 230, // Häuserblöcke, deren Mitte weiter als Zonenradius minus so viele px von der Mitte liegt, bleiben leer
    accessEnd: 80, // Zufahrtsstraßen (Feldwege) von den Startpunkten enden so weit (px) vor dem Zonenrand
    accessW: 52, // Breite der Zufahrtsstraßen (px)
    towerSize: 80, // Grundfläche eines Wachturms
    towerRim: 0.86, // Lage der Wachtürme oben und links: dieser Anteil des Zonenradius von der Mitte
    towerLeftDy: 190, // der Wachturm links liegt so viele px über der Bahnlinie
    towerClear: 30, // Räumung um einen Wachturm: so viel (px) Rand um seine Grundfläche, Gebäude, Bäume, Autos darin entfallen
    // Stehender Zug auf der Bahnlinie (Lok an der Ostseite): Wagen mit Versatz dx von der Zonenmitte (px)
    train: [
      { part: 'tank', dx: -100 },
      { part: 'container', dx: 0 },
      { part: 'loco', dx: 100 },
    ],
    trainSize: [96, 46], // Breite und Tiefe eines Wagens (px)
    plazaR: 150, // Zentrumsplatz (Park): Radius
    plazaTrees: 6, // Bäume im Ring um den Zentrumsplatz
    plazaTreeDist: 110, // Abstand (px) dieser Bäume von der Mitte
    plazaTreeR: 14, // Radius dieser Bäume
    treeR: [12, 20], // Radius eines Stadtbaums (px)
    // Art eines Häuserblocks: Würfel in [0, 1) mit diesen Obergrenzen: Wohnhäuser, Fabrik, Hallen, kleiner Park, sonst zwei Häuser
    lotRolls: [0.34, 0.54, 0.72, 0.88],
    houseCorner: 90, // Wohnhäuser eines Blocks stehen in den vier Ecken dieser Entfernung (px) von der Blockmitte
    houseSkip: 0.2, // Wahrscheinlichkeit, dass in einer Ecke kein Wohnhaus steht
    houseJitter: 10, // Wohnhaus: Lage schwankt um ± so viele px
    houseW: [80, 100], // Wohnhaus: Breite (px, Zufallsbereich; auch Einzelhäuser außerhalb der Stadt)
    houseH: [64, 86], // Wohnhaus: Tiefe (px, Zufallsbereich; auch Einzelhäuser außerhalb der Stadt)
    houseTreeJitter: 20, // Baum bei den Wohnhäusern: Lage schwankt um ± so viele px von der Blockmitte
    factoryJitter: 15, // Fabrik: Lage schwankt um ± so viele px von der Blockmitte
    factorySize: [170, 260], // Fabrik: kurze und lange Seite (px; gedreht je nach Würfel; auch Fabrikgelände außerhalb der Stadt)
    hallSize: [290, 100], // Halle: lange und kurze Seite (px; auch freistehende Hallen außerhalb der Stadt)
    hallDy: 80, // erste Halle eines Blocks liegt so viele px über der Blockmitte
    hall2Chance: 0.6, // Wahrscheinlichkeit einer zweiten Halle im Block
    hall2Dy: 90, // zweite Halle liegt so viele px unter der Blockmitte
    hall2Size: [220, 80], // zweite Halle: Breite und Tiefe (px)
    parkR: 150, // kleiner Park: Radius
    parkTrees: [7, 12], // kleiner Park: Zahl der Bäume (Zufallsbereich, gerundet)
    parkSpread: 135, // kleiner Park: Bäume streuen um ± so viele px
    pairOffset: [80, 70], // zwei Häuser: Versatz (px) der Häuser von der Blockmitte in x und y (das zweite spiegelt das erste)
    pairA: [96, 76], // zwei Häuser: Größe des ersten Hauses (Breite, Tiefe)
    pairB: [90, 70], // zwei Häuser: Größe des zweiten Hauses
    pairTrees: 4, // zwei Häuser: Zahl der Bäume
    pairSpread: 140, // zwei Häuser: Bäume streuen um ± so viele px
    carMax: 4, // geparkte Autos je Block: zufällig von 0 bis unter diesen Wert (abgerundet)
    carSpread: 130, // Autos stehen entlang der Straße um ± so viele px von der Blockmitte
    carEdge: 18, // Autos stehen so viele px innerhalb der Straßenmitte (halber Block minus dieser Wert)
    carSize: 40, // Maß (px) eines Autos bei der Räumung von Wachtürmen
    carBigPad: 40, // Autos, die so nah (px) am Rand eines großen Blocks stehen, entfallen (die Straße dort entfällt)
    carHalf: 20, // Autos bleiben vom Bahnkorridor um diesen Rand (px) frei
    // Große Blöcke (seit v5.16): je 2 × 2 Häuserblöcke ohne die Straßen dazwischen (innen 11 × 11 Stadtzellen, Platz für einen
    // Flughafen 10 × 10). Angabe [i, j] = Block links oben (Blockindex vom Zentrum, i nach rechts, j nach unten); das Spiegelbild
    // [-i-1, -j-1] entsteht automatisch (punktsymmetrisch). empty: true = freies Bauland (Häuser, Bäume, Autos entfallen),
    // sonst bleibt die Bebauung stehen und lässt sich im Stadtmodus mit „Räumen“ abreißen. Die Bahnzeile (j = 0) bleibt frei.
    bigBlocks: [
      { at: [1, -5], empty: true },
      { at: [3, 1], empty: true },
      { at: [2, -3], empty: false },
      { at: [5, -2], empty: false },
    ],
  },
  // Gebäude außerhalb der Zone
  outposts: {
    houses: 32, // Einzelhäuser außerhalb der Zone (Paare; seit v5.14 32 statt 22)
    halls: 9, // freistehende Hallen (Paare; seit v5.14 9 statt 6)
    factories: 10, // Fabrikgelände mit Mauer (Paare; seit v5.14 10 statt 7)
    wallT: 16, // Mauerstärke
    wallMargin: 80, // Abstand der Mauer zur Fabrik (Platz zum Umfahren)
    wallGap: 130, // Lücke in der Mauer (zwei gegenüberliegende Seiten)
    tries: 600, // Versuche je Gebäudegruppe, einen Platz zu finden
    edge: 300, // Gruppen halten so viele px (zusätzlich zu ihrem Radius) Abstand zum Kartenrand
    zoneGap: 150, // Abstand (px) zur Zone, zusätzlich zum Radius
    obstacleGap: 40, // Abstand (px) zu Wäldern, zusätzlich zum Radius
    areaGap: 60, // Abstand (px) zu anderen belegten Flächen, zusätzlich zum Radius
    maxSlope: 0.22, // steilster Hang, auf dem Häuser, Hallen und Fabriken stehen (Neigung)
    factoryPad: 30, // Platzbedarf einer Fabrik: halbe Diagonale plus Mauerabstand plus so viele px
    hallR: 160, // Platzbedarf (Radius, px) einer freistehenden Halle
    houseR: 80, // Platzbedarf (Radius, px) eines Einzelhauses
  },
  // Versorgungskisten (Platzierung)
  crates: {
    clear: 40, // so weit ringsum ist der Boden um eine Kiste frei und erreichbar
    zoneGap: 350, // Abstand zur Zonenkante
    spawnGap: 2000, // Abstand zu den Startpunkten (seit v5.14 2000 statt 1300: außerhalb des Baulands)
    gap: 900, // Abstand der Kisten untereinander
    tries: 300, // Versuche je Kistenpaar
    edge: 400, // Kisten liegen so weit (px) vom Kartenrand
    railGap: 80, // Abstand (px) zum Bahnkorridor
  },
  // Gehöfte und Felder
  farms: {
    chance: 0.75, // so viele Einzelhäuser außerhalb der Zone werden Gehöfte mit Feldern
    tries: 8, // Anordnungen je Gehöft (die mit der meisten Feldfläche gewinnt)
    fieldBlocks: 12, // freie Flure (Paare): zwei Feldreihen beiderseits eines Feldwegs, ohne Haus (seit v5.14 12 statt 8)
    fieldGap: 24, // Feldrain zwischen zwei Feldern
    fieldYard: 54, // Abstand Haus–Feldreihe (darin läuft der Feldweg entlang)
    trackW: 26, // Feldweg
    trackReach: 1800, // so weit führt ein Feldweg höchstens zur nächsten Straße oder zum Nachbargehöft
    cropRoll: [['wheat', 0.35], ['green', 0.6], ['soil', 0.8], ['rape', 1]], // Weizen, junge Saat, gepflügt, Raps
    pasture: 0.3, // Wahrscheinlichkeit, dass ein Feld eine Weide ist
    angleStraight: 0.4, // Wahrscheinlichkeit, dass eine Feldreihe nicht gedreht ist
    angleMax: 0.35, // sonst ist sie um höchstens ± so viel Bogenmaß gedreht
    fieldWidth: [170, 320], // Breite eines Felds entlang der Reihe (px, Zufallsbereich)
    farmDepth: [170, 300], // Tiefe der Feldreihe eines Gehöfts (px)
    farmFields: [1, 3], // Felder je Reihe eines Gehöfts (ganze Zahl, Zufallsbereich)
    farmShift: 60, // Reihe eines Gehöfts rückt um ± so viele px entlang des Hauses
    blockDepth: [180, 300], // Tiefe der Feldreihen einer freien Flur (px)
    blockFields: [2, 3], // Felder je Reihe einer freien Flur (ganze Zahl, Zufallsbereich)
    blockMin: 3, // eine freie Flur braucht mindestens so viele freie Felder
    blockTries: 40, // Versuche je freie Flur
    blockEdge: 400, // freie Fluren liegen so weit (px) vom Kartenrand
    blockZoneGap: 400, // freie Fluren liegen so weit (px) außerhalb der Zone
    laneExtra: 10, // der Feldweg ragt so viele px über die Feldreihe hinaus
    fieldEdge: 150, // Felder liegen so weit (px) vom Kartenrand
    fieldRail: 30, // Felder: Abstand (px) zum Bahnkorridor
    fieldZone: 120, // Felder: Abstand (px) zur Zone
    fieldObstacle: 15, // Felder: Abstand (px) zu Wäldern
    fieldBuilding: 20, // Felder: Abstand (px) zu Gebäuden
    fieldRoad: 12, // Felder: Abstand (px) zum Straßenrand
    fieldNearObstacle: 20, // Vorauswahl der Wälder in der Nähe eines Felds (px, mindestens fieldObstacle)
    fieldNearBuilding: 25, // Vorauswahl der Gebäude in der Nähe eines Felds (px, mindestens fieldBuilding)
    trackEdge: 60, // Feldwege: so weit (px) vom Kartenrand
    trackZone: 60, // Feldwege halten sich so weit (px) innerhalb des Zonenrands fern
    trackObstacle: 8, // Feldwege: Abstand (px) zu Wäldern
    trackBuilding: 6, // Feldwege: Abstand (px) zu fremden Gebäuden
    trackField: 4, // Feldwege dürfen so weit (px) in ein Feld ragen
    trackMin: 40, // Anbindung: bestehende Straßen näher als so viele px gelten als schon angebunden
    trackDetour: 1.15, // Anbindung an ein Nachbargehöft zählt um diesen Faktor länger (Straße ist bevorzugt)
    trackCands: 8, // Anbindung: so viele der nächsten Ziele werden höchstens versucht
  },
};
