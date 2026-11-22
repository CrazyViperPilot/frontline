# js/render/units/ – Einheiten-Modelle nach Familien

Einstieg ist `../unitpaint.js`: setzt `MODELS` und `INFANTRY` aus diesen Modulen zusammen, malt und exportiert (Verzeichnis im Kopfkommentar).
Neue Einheit: Modell in die passende Familie, exportieren, in `unitpaint.js` importieren und eintragen; Rezept `docs/rezept-einheiten.md`.
Kein Modul über 20 KB; wer eine Einheit zeichnet, liest `shapes.js` und eine Familie.

- `shapes.js` – Farben (Teamlack, Werkstoffe), Grundkörper und Fahrzeug-Bauteile. `box`, `prX`, `loft`, `cyl`, `ball`, `on`, `fine`, `tracks`, `wheel`
- `painter.js` – Mini-Renderer: Körper mit dem Licht der Gebäude malen, Umriss messen. `paintSolids`, `boundsOf`
- `armor.js` – Kettenfahrzeuge: Kampfpanzer, Schützenpanzer, Flugabwehr. `tank`, `ifv`, `flak`, `sam`, `gepard`
- `heavy.js` – schwere Kettenfahrzeuge: Panzerhaubitze, Raketenwerfer, Berge-, Brückenlegepanzer. `pzh`, `mlrs`, `recovery`, `bridgelayer`
- `wheeled.js` – Rad- und Baufahrzeuge. `truck`, `scout`, `jammer`, `fobTruck`, `engineer`, `excavator`
- `rotor.js` – Hubschrauber und Drohnen. `littlebird`, `drone`, `fpv`, `gunship`, `transporter`
- `airparts.js` – Bausteine der Flugzeuge: facettierter Rumpf aus Ringen, Platten. `hull`, `ring`, `slab`, `inset`, `remap`
- `jets.js`, `f22.js`, `u2.js` – Kampfjets `f16`, `su27`; Tarnkappenjet `f22`; Höhenaufklärer `u2` (dazu `oval`, `arch`, `U2_GLOW`)
- `planes.js` – große Flugzeuge. `a10`, `c130`
- `soldier.js` – Soldat für alle Infanterie-Arten (`o.kind`, Register `INFANTRY` in `unitpaint.js`), liegender Scharfschütze. `soldier`
- `camo.js` – Tarnfarben des Scharfschützen nach Umgebung und Jahreszeit. `CAMO`, `camoOf`, `setCamoWorld`
