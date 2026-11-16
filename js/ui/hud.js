// DOM-HUD (docs/verlauf.md §5 ui/hud.js, §11.4): Ressourcen, Punkte, Zone, Zeit, Auswahl, Befehlskarte und Meldungen.
// Einstieg: die Klasse Hud steckt in Modulen unter js/ui/hud/ (nur js/main.js importiert sie von hier).
//   hud/common.js    Konstanten und Helfer (Farben, Formate, Balken, Anzeigezeilen)
//   hud/core.js      Klasse Hud: Aufbau, Vorlage, Klicks, Takt (höchstens 5× je s), Abbau; hängt die Gruppen unten an
//   hud/top.js       Kopfleiste: Ressourcen, Punkte/Tickets, Zone, Hot Zone, Sendemast, Wetter, Uhr
//   hud/info.js      Infofeld: Einheit, Gebäude, Warteschlange, Nachschub, Forschung, Bohrer, Baustelle, Mehrfachauswahl, Erscheinungsort
//   hud/cityinfo.js  Stadt-Infofeld: Stadtgebäude, Einfuhr, Güterbahnhof, Straßentransport
//   hud/commands.js  Befehlskarte
//   hud/messages.js  Meldungen
export { Hud } from './hud/core.js';
