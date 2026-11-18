// Gemerkte Einstellungen der Menüs (localStorage, jede Stelle mit try/catch: ohne Speicher gilt die Wahl nur für diese Sitzung):
// Schlüssel der Startmenü-Schalter und die Lese-/Schreibfunktionen (Ein/Aus, Auswahl, Karte, Bildauflösung „Leistung“).
// Exporte: *_KEY, readLowRes, writeLowRes, readMapSel, writeMapSel, readFlag, writeFlag, readChoice, writeChoice.
const MAPSEL_KEY = 'frontline-kartenwahl';
export const MOOD_KEY = 'frontline-licht'; // Startmenü: Lichtstimmung (nur Optik)
export const WEATHER_KEY = 'frontline-wetter'; // Startmenü: Wetter aus, Zufall oder feste Jahreszeit
export const RESEARCH_KEY = 'frontline-forschung'; // Startmenü: Forschung an/aus
export const RIVER_KEY = 'frontline-fluss'; // Startmenü: Flüsse auf Zufallskarten an/aus
export const CONQUEST_KEY = 'frontline-eroberung'; // Startmenü: Modus Eroberung an/aus
export const TICKETS_KEY = 'frontline-tickets'; // Startmenü: Start-Tickets der Eroberung
export const OPP_KEY = 'frontline-gegner'; // Startmenü: Zahl der Computergegner (1 bis 3, nur Eroberung)
export const OPP_DIFF_KEY = 'frontline-ki-'; // + Nummer des Gegners: seine Schwierigkeit
export const BUILD_KEY = 'frontline-baugebiet'; // Startmenü: Baugebiet der Stadt an/aus (seit v5.78)
export const LOWRES_KEY = 'frontline-lowres'; // Start- und Pausenmenü: Bildauflösung „Leistung“ (1× statt bis 2×, nur Darstellung)
/** Bildauflösung „Leistung“ an? URL ?lowres=1 bzw. ?lowres=0 hat Vorrang (zum Prüfen), sonst die gemerkte Wahl. */
export function readLowRes() {
  const q = new URLSearchParams(location.search);
  if (q.has('lowres')) return q.get('lowres') === '1';
  return readFlag(LOWRES_KEY, false);
}
/** Bildauflösung merken (Startmenü und Pausenmenü). */
export function writeLowRes(on) {
  writeFlag(LOWRES_KEY, on);
}
export function readMapSel() {
  try {
    return localStorage.getItem(MAPSEL_KEY) || 'random';
  } catch {
    return 'random';
  }
}
/** Ein/Aus-Einstellung des Startmenüs (gemerkt). */
export function readFlag(key, dflt) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? dflt : v === '1';
  } catch {
    return dflt;
  }
}
export function writeFlag(key, on) {
  try {
    localStorage.setItem(key, on ? '1' : '0');
  } catch {
    /* ohne Speicher: gilt nur für diese Sitzung */
  }
}
/** Gemerkte Auswahl des Startmenüs (eine von `allowed`, sonst dflt). */
export function readChoice(key, allowed, dflt) {
  try {
    const v = localStorage.getItem(key);
    return allowed.includes(v) ? v : dflt;
  } catch {
    return dflt;
  }
}
export function writeChoice(key, v) {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* ohne Speicher: gilt nur für diese Sitzung */
  }
}
export function writeMapSel(v) {
  try {
    localStorage.setItem(MAPSEL_KEY, v);
  } catch {
    /* ohne Speicher: gilt nur für diese Sitzung */
  }
}
