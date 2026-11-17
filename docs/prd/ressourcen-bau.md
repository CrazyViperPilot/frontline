# Frontline PRD – Ressourcen, Logistik, FOB und Gebäude

> Teil des PRD, Abschnitte §3, §4, §5, §5a. Einstieg und Übersicht aller Teile: [PRD.md](../../PRD.md).
> Neue Regeln hier im passenden Abschnitt eintragen, die Version in [docs/changelog.md](../changelog.md).

## 3. Ressourcen & Logistik

**Zwei Varianten:** Mit **Stadt Aus** gilt diese Tabelle: Die Hauptstadt hat unendlich Baumaterial, Munition und Treibstoff, Geld kommt nur von der Front.
Mit **Stadt An** (Standard seit v4.80, Einzelheiten §15) füllen die Werke der Stadt das dann endliche Lager der Hauptstadt, dazu kommen Stahl, Kerosin,
die eingeführten Rohwaren (Rohmaterial, Eisen, Öl, Sprengstoff; §15 „Import“), Einwohner, Strom, Steuern und der Markt.
Rohwaren kommen von außerhalb der Karte an die Werke, Waren fahren über Straßen (§15 „Straßentransport“), seit v5.69 holen LKW Baumaterial,
Munition und Treibstoff auch direkt an den Werken ab (§15 „Werkslager“).
Der Weg ab dem Lager der Hauptstadt (LKW, vordere FOBs, Nachfüllen) ist in beiden Varianten gleich.

| Ressource | Quelle | Lagerort | Verwendung |
|---|---|---|---|
| **Geld** | Einheiten in der Konfliktzone (je Einheit, Hot Zone doppelt; Eroberung: im Quadrat, dazu Flaggengeld, [eroberung.md](eroberung.md)), (weiter unten) | global, **bleibt von Runde zu Runde** | Einheiten (Ausbildung), Forschung, Sendemast, Stadtzellen und Marktkauf |
| **Baumaterial** | BM-Werk aus eingeführtem Rohmaterial | FOB-Lager, LKW, Soldaten (wenig) | Gebäude, Mauern, Tore, Reparatur; auch Gewerbe und Markt (über die Straße) |
| **Munition** | Munitionswerk aus eingeführtem Eisen und Sprengstoff | FOB-Lager, Einheiten, LKW | Mörser/Flak und **Nachladen der Einheiten** |
| **Treibstoff** | Raffinerie aus eingeführtem Öl | FOB-Lager, Fahrzeuge, LKW | **Verbrauch beim Fahren/Fliegen** und Bohrer |
| **Stahl** | Stahlwerk aus eingeführtem Eisen | Stadtlager (nicht im Gebäude Hauptstadt), LKW fahren es nicht | Ausbildung von Fahrzeugen und Hubschraubern, Reparatur, Markt |
| **Kerosin** (seit v5.20) | Kerosin-Raffinerie aus eingeführtem Öl | Stadtlager, LKW fahren es nicht | F-16 am Kerosintank des Fliegerhorsts (seit v5.35), Hubschrauber gelandet am Heliport aus dem Kerosintank (seit v5.51; vorher im Umkreis des Heliports aus dem Stadtlager) |

- **Geld, Quelle:** **eingelagerte Versorgungskisten** (§7), **Abschüsse und fertige Bauten** (Eroberung mit
  mehr als zwei Teams: Prämie an das Team des letzten Treffers, [eroberung.md](eroberung.md));
  auch **Steuern** und **Marktverkauf**

- **Rohwaren** (Rohmaterial, Eisen, Öl, Sprengstoff) kommen nur über die Einfuhr der Stadt an die Werke (§15 „Import“); sie werden nicht gelagert und nicht gehandelt.
  **Kein Grundeinkommen je FOB.** Geld gibt es in der Konfliktzone und der Hot Zone (Abschnitt 7; Eroberung: dazu Flaggengeld, [eroberung.md](eroberung.md)),
  aus **Versorgungskisten** (je eingelagerte Kiste 1 Geld/s, §7) sowie als **Prämie**: Für jede zerstörte gegnerische Einheit zahlt der Gegner (also du) 25 % des Einheitenpreises bei Soldaten,
  **60 % bei Fahrzeugen und Hubschraubern** (z. B. Schütze 15, Kampfpanzer 300); für zerstörte Gebäude 20 % ihres Baumaterialpreises (Mauern und Tore nichts);
  für jedes **fertig gebaute** Gebäude 20 % seines Baumaterialpreises (FOB 80, Mörser 40, Flak 36, Bohrer 30; Mauern und Tore nichts, sonst wäre Mauerbau eine Geldquelle).
  Ab 100 Geld erscheint eine Meldung.
  Die Prämie gilt für beide Seiten, auch für die KI.
- **Hauptstadt:** Ihr Lager liegt im Gebäude Hauptstadt selbst (der ersten FOB); LKW laden dort, Einheiten in ihrem Bauradius füllen dort nach.
  Es ist endlich (höchstens 100 000 je Sorte, §15).
  **Raten:** LKW laden/entladen 100/s (400 Ladung in 4 s), Einheiten nachfüllen (Munition 60/s, Treibstoff 4/s, Baumaterial 20/s), Ausbildung in Kaserne,
  Fabrikhalle und Heliport der Stadt (§15, je eigener Fortschritt)
  (Schütze 5 s, PAK 8 s, Scharfschütze 10 s, LKW 6 s, Baufahrzeug 9 s, SPz 12 s, KPz 20 s, Little Bird 15 s, Transporter 20 s, AH-64 28 s; Warteschlange 5).
- **Vordere FOBs:** eigenes endliches Lager (max. 3000 je Sorte), das nur **LKW oder Transporthubschrauber** füllen. Oben zeigt „Front BM/MUN/TS“ die Summe dieser Lager.
- **Bezahlen:** Gebäude zahlen aus einer FOB, deren Bauradius den Bauort enthält (Baufahrzeug).
  Einheiten kosten **Geld**, Fahrzeuge zusätzlich Stahl, und freie Einwohner (§15).
  Abbruch erstattet an dieses Lager.
- **Soldaten tragen Baumaterial:** Schütze und PAK tragen **50 Baumaterial** (starten voll, laden im FOB-Bauradius oder nahe einem LKW nach) und bauen daraus **Mauern und Tore,
  nur im Bauradius einer FOB**.
- **LKW im Feld:** füllt Einheiten im 180-px-Umkreis aus seiner Ladung auf (Munition, Treibstoff, Baumaterial).
- **Soldaten-Nachschub (wie im Original: Gefallene steigen wieder ein; klassisch, in der Eroberung aus, [eroberung.md](eroberung.md)):** Hat ein Team weniger als **29 Soldaten** (Schützen und PAK,
  auch in Fahrzeugen und in Ausbildung), stellt die Hauptstadt **alle 6 s kostenlos einen Schützen** bereit, der zum Sammelpunkt läuft.
  Die Auswahl der Hauptstadt zeigt „Nachschub: Schütze in N s (Soldaten x/29, Plätze y/300)“ bzw. „Nachschub ruht“.
  Geld bleibt nötig für PAK, Fahrzeuge und Hubschrauber.
- **Kasse:** Das Geld am Rundenende wird gespeichert (höchstens 5000) und ist das Startgeld der nächsten Runde; die KI startet mit demselben Betrag.
  Die Kasse gibt es nur am Konto (§17, „Kasse am Konto“): Gäste starten jede Runde mit 800. Im Startmenü lässt sich die Kasse zurücksetzen (auf 800).
- Einheiten starten **voll munitioniert, betankt und mit vollem Baumaterial**.
- **Waffen und Munition je Einheit:** Jede Waffe hat einen eigenen Schussvorrat; beim Nachladen kostet jeder Schuss Munition aus dem Lager.

  | Einheit | Waffe | Vorrat | Munition je Schuss | Nachladezeit |
  |---|---|---|---|---|
  | Schütze | Gewehr | 2 Magazine à 30 = 60 Schuss (1 Magazin = 1 Munition) | 1/30 | 1 s |
  | Panzerabwehrsoldat | RPG | 5 Schuss | 10 | 3 s |
  | Kampfpanzer | Hauptkanone | 30 Schuss | 20 | **6 s** |
  | Kampfpanzer | MG | 300 Schuss | 5 | 0,25 s |
  | Schützenpanzer | Granatwerfer | 60 Granaten | 10 | 2 s |
  | Schützenpanzer | MG | 300 Schuss | 5 | 0,25 s |
  | Kampfhubschrauber | Bordkanone | 300 Schuss | 10 | 0,5 s |
  | Kampfhubschrauber | Raketen | 10 | 100 | 3 s |

  Waffenwahl automatisch: die für die Panzerklasse des Ziels vorgesehene Waffe (Kanone/Granaten/Raketen gegen Fahrzeuge und
  Gebäude, Raketen auch gegen Hubschrauber), sonst die mit dem besten Schaden je Munition (MG, Gewehr, Bordkanone).
- **Vorrat der Einheiten:** Jede Einheit trägt Munition, Fahrzeuge zusätzlich Treibstoff. Ohne Munition wird nicht geschossen,
  ohne Treibstoff fahren Fahrzeuge mit 25 % Tempo. Mörser und Flugabwehr verbrauchen Munition aus dem Lager ihrer FOB (fehlt sie, schießen sie nicht);
  das MG der FOB schießt kostenlos.
- **Nachfüllen:** automatisch im Bauradius einer eigenen FOB (aus deren Lager) oder in der Nähe (180 px) eines eigenen LKW mit Ladung.
  Das gilt für Soldaten (Munition), Fahrzeuge und Hubschrauber (Treibstoff, Munition).
  Munition fließt mit bis zu 60/s je Einheit (Waffe für Waffe), Treibstoff mit 4/s.
  Ist das Lager leer, wird nicht nachgefüllt.

## 4. FOB & Bauradius

- Die **Hauptstadt** ist das Hauptgebäude: Lager (von den Werken der Stadt gefüllt, §15), Bauradius (450 px),
  bildet **keine** Einheiten aus (Kaserne, Fabrikhalle, Heliport der Stadt, §15), leichtes MG.
  Nicht abreißbar; ihr Verlust beendet die Runde.
- Gebäude nur im Bauradius einer eigenen **fertigen** FOB. Ein Klick auf eine FOB zeigt Radius und Lager.
- **Weitere FOBs:** Man bildet in der Fabrikhalle ein **FOB-Fahrzeug** aus (Taste **B**, 500 Geld, 30 s, 2 Plätze, 80 Stahl, 2 Einwohner),
  fährt es irgendwohin und drückt **Aufbauen** (Taste **D**, Befehl `deploy`): es wird an seiner Stelle **sofort zur fertigen FOB**, ohne Baustelle und Bauzeit; das Fahrzeug verschwindet.
  Die neue FOB hat gleich **20 % ihres Lagers je Sorte** (600 Baumaterial, 600 Munition, 600 Treibstoff bei 3000 Lager; `QUICK.fobStartStock`).
  Es gelten dieselben Regeln wie früher für Baustellen: **höchstens 10 FOBs**, Bauradien dürfen sich **nicht überlappen** (Abstand ≥ 900 px), 700 px zu Gegnern, freie Fläche 3 × 3 ohne Gegner darauf.
  Blockiert an der Stelle des Fahrzeugs etwas (Baum, Mauer, Haus), entsteht die FOB auf der nächsten freien Stelle bis 128 px daneben (`BALANCE.fob.deploySnap`);
  geht auch das nicht, ist der Knopf ausgegraut und nennt den Grund.
  Das **Baufahrzeug baut keine FOBs mehr**.
  Vordere FOBs bilden keine Einheiten aus.
  Die 400 Baumaterial in der Gebäudetabelle (§6) zählen nur noch für Reparaturkosten und Abschussprämie.
  FOB-Baustellen aus älteren Spielständen stehen nach dem Laden fertig da.
- **Bauen braucht Bauer:** Gebäude werden als Baustelle platziert (bezahlt aus einem FOB-Lager in Reichweite) und wachsen nur,
  solange ein Bauer daneben steht – **Baufahrzeug** für alle Gebäude, **Fußsoldaten** (Schütze, Panzerabwehrsoldat) für Mauern
  und Tore. Mehrere Bauer bauen schneller (max. 3).
- **Reparatur:** Baufahrzeuge reparieren beschädigte eigene Gebäude (kostet etwas Baumaterial), im Leerlauf automatisch.
- Das Baufahrzeug darf Mauern/Tore auch außerhalb eines FOB-Radius bauen, wenn ein eigener LKW mit Baumaterial daneben steht; Soldaten nur im Bauradius.

## 5. Gebäude

| Gebäude | Zweck |
|---|---|
| Hauptstadt (Zentrale) | Unendliches Lager, Bauradius, bildet alle Einheiten aus (nur Geld), leichtes MG, nicht abreißbar |
| Vordere FOB | Endliches Lager (LKW füllen es), Bauradius, Nachladen/Tanken, leichtes MG; bis zu 10 FOBs, Bauradien ohne Überlappung |
| Mauer | Blockiert alle Einheiten. Wird per Ziehen als Linie gebaut. |
| Tor | Wie Mauer, aber eigene Einheiten fahren hindurch. (weiter unten) |
| Mörser | Indirektes Feuer, Reichweite 800 px (Mindestreichweite 200), Flächenschaden. (weiter unten) |
| Flugabwehr | Schießt **Hubschrauber** ab (Reichweite 320, 35 Schaden je Schuss), fängt gegnerische Mörsergranaten ab und beschießt Bodenziele schwach. Munition aus der FOB |
| Phalanx (seit v4.99) | Nahbereichsschutz nach dem CIWS-Geschütz: nur Baufahrzeug (Taste C), im Bauradius einer FOB (Militärgebäude), 2×2, 800 Geld, 300 Baumaterial, 200 Munition, **120 s Bauzeit**. (weiter unten) |
| Gefechtsturm (seit v4.73) | 2×2, 220 Baumaterial, nur Baufahrzeug; 3 Soldaten besetzen ihn, Dach trägt einen Aufbau (§5a) |
| Bohrer | Zieht die Hot Zone an (Abschnitt 7); 2×2, 150 Baumaterial, braucht beim Betrieb Treibstoff aus der FOB |
| Sendemast (seit v4.50) | Zweite Siegbedingung (§7), nur wenn im Startmenü eingeschaltet; nur Baufahrzeug, einer je Team, 2×2 |

- **Tor:** **2 Felder breit** (seit dem Paket „Tor 2 Felder“): ein Tor besteht aus zwei Hälften (je ein
  1×1-Gebäude `gate` mit `leaf` 0/1 und `axis` x/y) nebeneinander entlang der Mauer, beide werden zusammen
  gesetzt und bezahlt (50 Baumaterial, je Hälfte 25, je 800 HP).
  Richtung: aus der Zugrichtung des Befehls, bei einem Einzelklick aus den Nachbarmauern (Mauer links/rechts:
  waagrecht, nur oben/unten: senkrecht, sonst waagrecht); die zweite Hälfte liegt auf der freien Seite (erst
  +, dann −).
  Ohne Platz für beide: „Kein Platz für ein Tor (2 Felder)“.
  Als Linie gezogen: je 2 Zellen ein Tor.
  Ältere Spielstände mit 1×1-Toren bleiben Einzeltore
- **Mörser:** **Ziel wählen** (G oder Rechtsklick auf die Karte): ein Schuss alle **20 s**, solange die FOB
  Munition hat; ohne Ziel schießt er automatisch auf sichtbare Gegner.
  Reichweitenkreis und Ziel werden bei Auswahl gezeichnet.
  Trifft keine Hubschrauber
- **Phalanx (seit v4.99):** Reichweite **225 px = halber FOB-Bauradius**.
  Schießt nur auf **Hubschrauber** (Dauerfeuer, 10 Stöße/s à 25 Schaden) und fängt gegnerische
  **Mörsergranaten** zu 95 % ab (ein Versuch alle 0,2 s).
  **Sehr teurer Betrieb:** je Feuerstoß 5 Munition aus dem FOB-Lager und 1 Geld aus der Kasse (Dauerfeuer = 50
  Munition und 10 Geld je Sekunde), je Abfangversuch 15 Munition und 5 Geld; fehlt eins, schweigt sie (Meldung
  „Phalanx: zu wenig Geld für Munition“).
  Die KI baut sie nicht

**Aussehen:** Alle Militärgebäude sind in 2D und Iso detailreich gemalt, isometrisch für jede Drehung dasselbe Bild; Teamfarbe am Rand des Platzes, an Dächern, Bändern und Fahnen.
**FOB** Feldlager hinter einer HESCO-Wall (Drahtkörbe mit Sand) mit Zufahrt, Wache und rot-weißer Schranke, Gefechtsstand mit Dach in Teamfarbe, Klimageräten und Schüssel,
Mannschaftszelt mit Generator, Radarmast mit Gerätecontainer, Munitionskisten und Fässer, Militär-LKW und Jeep, Fahne.
**Mauer** Betonwand (T-Wall) mit Fuß, Plattenfugen und Teamband, verbindet sich mit den Nachbarn (gerade, Ecke, Abzweig, Ende mit Pfeiler).
**Tor** (2 Felder) massive Betonpfeiler mit Kappe in Teamfarbe und Warnleuchte nur an den beiden Außenenden, dazwischen zwei schwere dunkle Stahltorflügel mit Rahmen, Kreuzverstrebung,
Nieten und gelb-schwarzen Warnstreifen unten, darüber ein Querträger mit Warnband; fehlt eine Hälfte, wird die andere wie ein altes Einzeltor (zwei Pfeiler, Stahltor und Schranke) gemalt.
**Mörser** Stellung im Sandsackring mit Zugang, Mörser mit Zweibein, Kisten.
**Flugabwehr** Zwillingsflak mit Schild in Teamfarbe auf dem Drehkranz im Sandsackring, Radaranhänger.
**Phalanx** Sockel mit Teamband, weißer Radardom über dem Gatling-Rohr, Leitstand-Container, Generator.
**Gefechtsturm** Betonschaft mit Schießscharten, auskragende Kanzel mit Sehschlitzen und Teamband, Dachluke, Dachaufbau sichtbar (Mörser im Sandsackring, Zwillingsflak, SAM-Werfer).
**Sendemast** rot-weißer Gittermast mit Abspannseilen, Richtfunkschüsseln in Teamfarbe, blinkendem Warnlicht und langem Schatten, Gerätehaus und Zaun.
**Bohrer** gelber Bohrturm auf dem Unterbau mit Flaschenzug, Bohrmeisterhaus in Teamfarbe, Rohrlager, Rampe, Spülungstanks.
**Baustellen** Bauzaun mit Planen in Teamfarbe, Rohbau mit Bewehrung, der in acht Stufen wächst, Gerüst und Baustoffe, bei der FOB ein Kran.
Unter halben Trefferpunkten dunkler mit Rußflecken; im Winter Schnee auf Dächern, Wällen und Plätzen (Iso).
In 2D bleiben die Anzeigen darüber (Baufortschritt, Besatzung des Turms, Bohrer, Fertigung).
Jedes Bild wird je Maßstab einmal gemalt und danach nur kopiert (`spritecache.js`), darum flüssig.
Nur Bild, Spielregeln unverändert.
Code: `js/render/milbuild.js` (Bauteile aus `isokit.js`).

### 5a. Festung

Eine FOB lässt sich zur Festung ausbauen: Mauerring, Tore und Gefechtstürme mit Besatzung und Geschütz auf dem Dach. Alles nutzt vorhandene Regeln (Mauer, Tor, Bauradius, FOB-Lager).

- **Festung ausbauen (Taste I, FOB gewählt; Befehl `fortify`):** setzt Baustellen für einen Mauerring im Abstand von 4 Zellen um die FOB, ein Tor (2 Felder) in der Mitte jeder Seite
  und 2 Gefechtstürme an den Ecken, die zum Gegner zeigen (`BALANCE.fortress`). Material kommt aus dem FOB-Lager (es muss reichen, sonst bleibt der Ausbau teilweise stehen);
  Baufahrzeuge (Türme) und Soldaten (Mauern, Tore) bauen automatisch. Erneut drücken ergänzt, was fehlt. Natürlich geht auch alles einzeln: Turm im Baumenü (F), Mauern und Tore als Linie.
- **Gefechtsturm:** 1500 HP, 3 Plätze, Reichweitenbonus ab der Wand (60 px) und Höhenvorteil (`fortress.floor`). Soldaten besetzen ihn per Rechtsklick oder Tippen (wie Häuserkampf, §7),
  sind drin geschützt und schießen mit ihren eigenen Waffen. Nur die eigene Seite darf hinein. Fällt der Turm, fallen die Besatzer mit 35 % Schaden heraus (`fortress.ejectDamage`).
- **Dachaufbau (Befehl `roof`, Turm gewählt):** genau einer je Turm: **Mörser** (T), **Flak** (Z) oder **SAM** (N, nur Luftziele, Reichweite 560).
  Kosten aus dem Lager einer FOB im Bauradius, Bauzeit 10–14 s.
  Der Aufbau feuert wie die freistehende Variante (Mörserziel mit G oder Rechtsklick, Flak fängt auch Granaten ab), aber **nur, solange mindestens ein Soldat im Turm sitzt**.
  Munition aus dem FOB-Lager.

Gebäude können abgerissen werden (Erstattung 25 % Baumaterial).
**Einheitenlimit (v4.54 auf 300 Plätze erhöht):** Jedes Team hat **300 Plätze** (`BALANCE.slotCap`, klassisch; in der Eroberung **500**, `BALANCE.conquest.slotCap`).
Soldat, LKW, Baufahrzeug und Hubschrauber belegen je 1 Platz, Schützenpanzer 3, Kampfpanzer 5, Flakpanzer und SAM-Startrampe 2 (`slots` in `units.js`).
Gezählt werden lebende Einheiten, Passagiere und Einträge der Ausbildungs-Warteschlange;
ist kein Platz frei, wird die Ausbildung abgelehnt („Einheitenlimit erreicht“) und der Soldaten-Nachschub pausiert.
Gefallene geben ihre Plätze wieder frei.
