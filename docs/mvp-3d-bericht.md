# Bericht MVP-Messung 3D (Stufe 1, Plan `docs/plan-3d.md`)

Stand 2026-11-26, Spielstand v5.263. Gemessen mit `node tools/smoke-3d.mjs --only mvp --gametime 5 --fpsms 5000 --frames 4`
(Rundgang und Zahlen je Gerät; alle Fotos nach `.smoke/3d/mvp/`, Zahlen nach `.smoke/3d/mvp/messung.json`).
Ergebnis des Skripts: **grün**, keine Browserfehler, Auswahl und Befehl in 3D auf allen drei Geräten.

**Wichtig:** Der Container hat keine Grafikkarte, nur Software-WebGL (SwiftShader). Die Bildraten unten sind daher nicht
absolut zu lesen (ein echter Rechner ist 10- bis 50-mal schneller), sondern nur als **Vergleich Iso gegen 3D** auf derselben
Maschine. Ob 3D auf echten Geräten reicht, misst Daniel selbst (Anleitung unten).

## Rundgang (je Gerät desktop 1280×800, tablet iPad Pro 11 quer, phone Pixel 7 quer; Seed 7)

| Schritt | desktop | tablet | phone |
|---|---|---|---|
| Start mit `?three=1`, Ansicht 3D aktiv | ok | ok | ok |
| Ansicht umschalten (V bzw. Knopf): 3D → 2D → Iso → 3D | ok | ok | ok |
| 4 Drehungen, Zoom 0,35 / 1 / 1,6 (Fotos) | ok | ok | ok |
| Auswahl: Klick bzw. Tippen auf das 3D-Bild eines Panzers | gewählt | gewählt | gewählt |
| Befehl: Rechtsklick bzw. Tippen auf den Boden, Panzer fährt (3 s) | 150 px | 60 px | 150 px |
| Wald (x 7600, y 9000), Panzer am Hang, Winter (`weather=winter&wx=snow`) | ok | ok | ok |
| Partie im Zeitraffer (beide Seiten KI, 10×) | 5,1 min, 79 Einheiten | 5,2 min, 81 | 5,2 min, 80 |
| Browserfehler | keine | keine | keine |

Tablet fuhr nur 60 px: in 3 s echter Zeit liefen dort bei ≈ 1 Bild/s weniger Simulationsschritte, kein Fehler der Steuerung.

## Bildrate (Bilder/s, in Klammern langsamstes Bild in ms; Software-WebGL)

Gemessen 5 s je Stufe bei laufender Partie (1×). „Basis“ = Mitte der eigenen Bodentruppen nach gut 5 Spielminuten,
„Wald“ = Seed 7 bei x 7600, y 9000 (≈ 880 Bäume, Zoom 1), „Winter“ = Start einer Winterpartie an der Hauptstadt.

| Gerät | Stelle | Iso | 3D Aus | 3D Mittel | 3D Hoch |
|---|---|---|---|---|---|
| desktop | Basis | 3,2 (383) | 3,0 (383) | 2,3 (517) | 2,3 (517) |
| desktop | Wald | 3,1 (350) | 2,4 (467) | 1,9 (633) | 1,9 (583) |
| desktop | Winter | 4,1 (300) | 3,8 (300) | 3,1 (350) | 3,0 (400) |
| tablet | Basis | 1,2 (883) | 1,1 (1017) | 0,9 (1117) | 0,9 (1250) |
| tablet | Wald | 1,2 (900) | 1,0 (1083) | 0,8 (1283) | 0,8 (1317) |
| tablet | Winter | 1,4 (817) | 1,2 (867) | 1,0 (1150) | 1,0 (1067) |
| phone | Basis | 3,2 (333) | 3,2 (383) | 2,6 (450) | 2,6 (417) |
| phone | Wald | 3,4 (350) | 2,7 (383) | 2,1 (567) | 2,1 (550) |
| phone | Winter | 3,8 (300) | 3,4 (350) | 2,5 (450) | 2,7 (417) |

Verhältnis 3D zu Iso: Schatten Aus 0,8–1,0; Schatten Mittel/Hoch 0,65–0,8 (im Wald am schlechtesten). Mittel und Hoch kosten
in Software gleich viel (die Größe der Schattenkarte zählt dort kaum, Zeichnen und Fänger zählen).

## Zeit je Durchlauf (ms je Bild, Mittel über 4 Bilder, Stelle „Basis“ nach 5 Spielminuten)

| Gerät | Ansicht | Bild gesamt | Gelände | Boden | Objekte | übrige |
|---|---|---|---|---|---|---|
| desktop | Iso | 249 | 243 | 2 | 2 | 2 |
| desktop | 3D Mittel | 444 | 256 | 14 | 172 | 2 |
| tablet | Iso | 777 | 692 | 2 | 81 | 2 |
| tablet | 3D Mittel | 1049 | 694 | 8 | 307 | 40 (Schatten 15, Schilder 14, Effekte 11) |
| phone | Iso | 259 | 229 | 27 | 1 | 2 |
| phone | 3D Mittel | 360 | 233 | 10 | 116 | 1 |

„Gelände“ ist in Iso wie in 3D der WebGL-Boden-Shader und dominiert in Software beide Ansichten; der Mehraufwand von 3D steckt
fast ganz in „Objekte“ (Einheiten, Bäume, Billboards, Schattenkarte und Fänger).

## Fotos (links alt = Iso, rechts neu = 3D; Auswahl, alle weiteren in `.smoke/3d/mvp/`)

- Start an der Hauptstadt: [desktop](mvp-3d/desktop-start.jpg), [phone](mvp-3d/phone-start.jpg)
- Drehung 1: [desktop](mvp-3d/desktop-drehung1.jpg)
- Wald: [desktop](mvp-3d/desktop-wald.jpg), [phone](mvp-3d/phone-wald.jpg)
- Winter mit Wald: [desktop](mvp-3d/desktop-winter-wald.jpg)
- Panzer am Hang (Zoom 2): [desktop](mvp-3d/desktop-hang.jpg)
- Basis nach 5 Spielminuten (Stadt, Verkehr): [desktop](mvp-3d/desktop-basis-5min.jpg)

Nur lokal (nicht im Repo): `<gerät>-drehung2|3`, `-zoom0.35|1.6`, `-winter`, `-auswahl-3d`, `-befehl-3d`.

## Was im Rundgang auffiel

- Auswahl, Befehl, Umschalten der Ansicht, Drehen und Zoomen verhalten sich in 3D wie in Iso; keine Browserfehler.
- Bild nach 5 Minuten (Stadt mit Verkehr) in Iso und 3D fast gleich; 3D-Panzer und 3D-Bäume werfen sichtbare Schatten.
- 3D-Bäume wirken dunkler und dichter als die gemalten, Laubkronen körniger (v. a. auf dem Telefon); Winter: kahle
  Laubbäume und Schnee auf den Fichten passen.
- Einheiten in 3D sind rechts heller, gemalte Gebäude von links oben beleuchtet (bekannter offener Punkt, siehe unten).
- Winterfoto Iso (Wald): der Bauernhof neben dem Acker fehlt im Iso-Bild, im 3D-Bild steht er. Vermutlich hatte der
  Sprite-Cache nach 4 Bildern das Wintersprite noch nicht gemalt (Zeitbudget je Bild); kein 3D-Fehler, aber nachsehen.
- Schnee wirkt in beiden Ansichten sandfarben (Stimmung/Licht), nicht 3D-spezifisch.
- Tablet (iPad Pro 11, 2388×1668 Pixel) ist im Container am langsamsten: die Pixelzahl treibt den Software-Boden.

## Offene Punkte (aus „Stand“ in `docs/plan-3d.md`, durch die Messung bestätigt oder offen)

1. **Kosten der Schattenkarte:** Mittel/Hoch kosten in Software 20–35 % Bildrate gegenüber Aus. Auf echter GPU offen (Daniel
   misst). Falls teuer: Karte nur bei Bewegung neu zeichnen, Bodennetz in Kacheln mit Sichtprüfung (Fänger und Boden zeichnen
   heute das ganze Netz).
2. **Wald mit vielen Bäumen:** schlechteste Stelle (3D Mittel 0,6× Iso). Falls auf dem Handy zu teuer: ferne Bäume als
   Billboards (Impostor), weniger Bäume in die Schattenkarte.
3. **Keine Schatten auf Einheiten:** Einheiten empfangen keine Schatten (eigener Shader), Baumschatten auf Panzern fehlen.
4. **Baumkronen durch gemalte Wände:** 3D-Bäume dicht an gemalten Gebäuden können mit der Krone durch die Wand ragen
   (Billboards haben nur die Tiefe ihres Fußpunkts); erst mit Gebäuden in 3D (Stufe 2) gelöst.
5. **Licht:** gemalte Gebäude sind von links oben beleuchtet, 3D-Einheiten und -Bäume von rechts (`lightVec`) – auf den Fotos
   sichtbar. Entscheiden: Sonne der 3D-Szene an die gemalten Gebäude anpassen oder bis Stufe 2 hinnehmen.
6. Neu: fehlendes Wintersprite im Iso-Foto (siehe oben) prüfen.

## Anleitung für Daniel: Messung auf eigenem Handy und Rechner

1. Spiel öffnen mit `?three=1&perf=1` an der Adresse (z. B. `…/index.html?three=1&perf=1`). `perf=1` zeigt die Messanzeige
   (am Rechner auch F3). Für Winter: Wetter im Startmenü auf Winter stellen, oder `?debug=1&three=1&perf=1&weather=winter&wx=snow`
   (Achtung: `debug=1` deckt die Karte auf, das kostet etwas mehr als mit Nebel).
2. Prüfen, dass die Ansicht „3D“ ist (Knopf „Ansicht“ oben zeigt „3D“; in der Messanzeige steht „3D: … Einheiten“).
3. Schattenstufe im Pausenmenü „Schatten (3D)“ wählen: erst **Mittel**, dann **Hoch** (oder `&shadows=mid` / `&shadows=high`).
4. Eine Partie normal spielen (oder auf 3× stellen) bis **20 Spielminuten**, dann je Stelle 10 s ruhig halten und ablesen:
   - **Bilder … /s** und **langsamstes … ms** (oberste Zeilen der Messanzeige),
   - darunter **Zeichnen** je Ebene, vor allem „Gelände“ und „Objekte“.
5. Stellen: (a) eigene Basis mit Stadt, (b) Wald (dichter Baumbestand, Zoom normal und weit heraus), (c) viele Einheiten
   (größtes Gefecht bzw. eigene Armee gesammelt), (d) Winterpartie mit Wald.
6. Zum Vergleich dieselben Stellen einmal in Iso (Ansicht umschalten bis „Iso“).
7. Richtwerte aus dem Plan: **Rechner 60 Bilder/s, Handy 30 Bilder/s mit Schatten Mittel nach 20 Minuten Partie**;
   langsamstes Bild möglichst unter 50 ms (Handy) bzw. 25 ms (Rechner). Bedienung (Tippen, Ziehen, Zoomen) ohne Unterschied zu Iso.
8. Ergebnis kurz notieren: Gerät, Stelle, Stufe, Bilder/s, langsamstes Bild, Auffälliges (Ruckeln, Hitze, Akku).
