// Gemeinsame Konstanten der Zeichenebenen des Renderers (Kartenmaße, Bildauflösung, Detailstufen, Farben, Lebensdauern).
// Nur Darstellung. Konstanten, die nur eine Ebene braucht, stehen in deren Datei.
import { BALANCE } from '../../data/balance.js';

export const TILE = BALANCE.map.tile;
export const W = BALANCE.map.width;
export const H = BALANCE.map.height;
export const BG = '#0d110d';
// Bildauflösung (Einstellung im Start- und Pausenmenü, nur Darstellung): höchste Pixeldichte je Stufe. „Scharf“ 2 (Standard), „Leistung“ 1.
export const MAX_DPR_SHARP = 2;
export const MAX_DPR_FAST = 1;
export const SMALL_FX = new Set(['tracer', 'muzzle']); // Leuchtspur und Mündungsfeuer: unter der Schwelle weg (Granaten, Explosionen bleiben)
export const HP_OFFSET = 14; // Abstand Lebensbalken-Oberkante zum Einheitenrand (Bildschirm-px); darunter Vorrat
export const STAR_UP = 8; // Stern des Kommandeurs: so weit über dem Lebensbalken (Bildschirm-px)
export const STAR_R = 8; // Radius des Sterns (Bildschirm-px)
export const ISO_PAD = 260; // Iso: Rand um den Ausschnitt, hohe Objekte ragen nach oben ins Bild (Welt-px)
export const SC = BALANCE.scars;
