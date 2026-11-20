# Symbol-Index core

Erzeugt von `npm run index` (tools/index.mjs), nicht von Hand ändern. Ordner: `js/`, `js/audio/`, `js/core/`, `js/editor/`. Pfade relativ zu `js/`.

## audio/music.js (10 KB)
- BATTLE_TYPES – Kampfeffekte (game.effects), die als Gefecht zählen: Schuss, Mündung, Einschlag…
- class Music
  - constructor(ctx, noise, level) – `ctx`: AudioContext; `noise`: Rausch-Puffer (von Sound erzeugt)
  - build() – Ausgänge: Musik-Bus direkt zum Ausgang (nicht durch den Kompressor der Geräusch…
  - reset() – Neues Spiel: Lage und Ring zurücksetzen (die Spielzeit beginnt bei 0)
  - setLevel(v)
  - silence() – Sofort leise (Ton aus, Partie beendet, Menü): keine neuen Noten, Bus blendet aus
  - hit(clock) – Ein Kampfeffekt (Spielzeit `clock`) in Bildnähe oder bei eigenen Einheiten
  - alert(clock) – Alarm „Basis wird angegriffen“: gilt wie Gefecht für BATTLE_WINDOW s.
  - update(dt, game, paused) – Einmal je Bild: Lage nachführen, Pegel setzen und die Noten der nächsten LOOKAH…
  - setTo(param, key, v, now, tc) – Pegel nur setzen, wenn er sich merklich ändert (keine Flut von Automationsereig…
  - planStep(s, t) – Alle Stimmen eines Achtels (Index `s`) zur Zeit `t`
  - pad(chord, t) – Fläche für einen Takt: zwei verstimmte Sägezahn-Oszillatoren durch den Tiefpass…
  - bell(chord, t, half) – Glocke (Sinus) je Halbtakt, ein Ton aus dem Akkord
  - kick(t) – Pauke: tiefer Sinus mit fallender Tonhöhe
  - snare(t) – Marschtrommel: kurzes Rauschen durch das Bandfilter
  - bass(chord, t) – Bass-Ostinato: Grundton in jedem Achtel, Rechteck durch den Tiefpass

## audio/sound.js (25 KB)
- SOUND_KEY
- loadLevel(kind) – Lautstärke-Regler 0–1 aus dem Speicher (Standard: Geräusche 80 %, Musik 50 %)
- saveLevel(kind, v) – Regler 0–1 speichern (als Prozent)
- class Sound
  - constructor({ ctx = null }) – `ctx`: nur für Tests (fertiger AudioContext, z. B. OfflineAudioContext)
  - unlock() – Muss aus einer Nutzergeste kommen (Tippen, Taste): erzeugt den AudioContext und…
  - attach(game, camera, team) – Spiel anbinden (Kamera für Stereo-Position und Entfernung)
  - detach()
  - setOn(on, save)
  - setLevel(kind, v) – Lautstärke-Regler 0–1: 'sfx' Geräusche, 'music' Musik
  - getLevel(kind)
  - applyLevels() – Regler auf die Ausgänge legen (Geräusche: Hauptpegel = MASTER × Regler; Musik:…
  - toggle()
  - build()
  - buildAmbience() – Dauergeräusche (Regen, Wind, Hubschrauber, Fahrzeuge, Düsenjets): laufen immer,…
  - setLevels(rain, wind, heli, veh, jet, pitch) – Pegel der Dauergeräusche (0–1 je Art), weich überblendet
  - rv()
  - bus(vol, pan) – Ausgang mit Lautstärke und Stereo-Position
  - noise(t, dur, { type = 'lowpass', f0 = 1000, f1 = 0, q = 0.7, gain = 1, atk = 0.004, dest })
  - tone(t, dur, { type = 'sine', f0 = 440, f1 = 0, gain = 1, atk = 0.004, dest })
  - play(name, vol, pan, delay) – Spielt ein Geräusch
  - where(x, y, team) – Entfernung und Stereo-Position eines Weltpunkts: { vol, pan } oder null, wenn z…
  - at(name, x, y, team, delay, boost) – Ort-Geräusch am Weltpunkt (x, y)
  - effect(e) – Neue Effekte des Spiels (Schüsse, Einschläge, Gefallene) in Geräusche übersetzen
  - message(ev) – Meldung für den Spieler (Text aus game.message)
  - order() – Bestätigung eines gegebenen Befehls (Marsch, Angriff …)
  - click()
  - end(won) – Spielende: Fanfare oder Trauermarsch
  - update(dt, paused) – Einmal je Bild: neue Effekte abholen, alle 0,25 s Dauergeräusche (Wetter, Hubsc…
  - nearBattle(e) – Kampfeffekt im Bild der Kamera oder nahe eigener Einheiten/Gebäude (nur für die…
  - ambience()

## core/loop.js (2.7 KB)
- createLoop({ update, render, tickRate = 20, onFrame = null })

## core/rng.js (0.9 KB)
- makeRng(seed)

## core/snapshot.js (9.6 KB)
- encode(root, statics, classes, replace)
- decode(data, statics, classes) – Gegenstück zu encode: baut den Objektgraphen neu auf (Klassen ohne Konstruktora…
- pack(obj) – JSON → gzip-Bytes (CompressionStream; Chrome/Android und Node 22)
- unpack(bytes)
- toB64
- fromB64

## editor/editor.js (82 KB)
- (keine Exporte)

## main.js (27 KB)
- (keine Exporte)

## version.js (0.0 KB)
- GAME_VERSION
