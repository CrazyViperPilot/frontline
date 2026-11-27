// Spieler-Steuerung: gemeinsame Hilfsfunktionen der Controller-Module (js/ui/controller/). Kein DOM.

import { BALANCE } from '../../data/balance.js';
import { UNITS } from '../../data/units.js';

export const WALL_MAX = BALANCE.construction.wallMax; // max. Zellen je Mauerzug (Vorschau; der Befehl prüft dasselbe)

export const isCarrier = (u) => u.def.cargoCap > 0; // LKW und Transporthubschrauber

/** Gebäude, das Bodeneinheiten ausbildet (Kaserne, Fabrikhalle; nicht Heliport, Stellplatz): bekommt den Knopf „Sammelpunkt“. */
export const landTrainer = (b) => !!b.produces?.some((u) => !UNITS[u]?.air);
