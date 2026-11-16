// Startmenü: der Zustand der Schalter. readStartState liest die gemerkten Wahlen (menu/prefs.js) in ein Zustandsobjekt `s`,
// markStart zeigt ihn an den Knöpfen (aria-pressed, ein-/ausgeblendete Felder), applySetting setzt eine Wahl nach einem Klick
// und merkt sie. Alle Handler in start.js lesen `s` erst beim Aufruf und sehen so immer den aktuellen Wert.
// Exporte: readStartState, markStart, applySetting.
import { BALANCE } from '../../data/balance.js';
import { WEATHER_SETTINGS } from '../../game/weather.js';
import { MOOD_SETTINGS } from '../../render/mood.js';
import { SOUND_KEY } from '../../audio/sound.js';
import { DIFFS, markFullscreen, setFullscreen } from './common.js';
import {
  BUILD_KEY, CONQUEST_KEY, MOOD_KEY, OPP_DIFF_KEY, OPP_KEY, RADIO_KEY, RESEARCH_KEY, RIVER_KEY, TICKETS_KEY, WEATHER_KEY,
  readChoice, readFlag, readLowRes, readMapSel, writeChoice, writeFlag, writeLowRes,
} from './prefs.js';

/** Gemerkte Wahlen des Startmenüs als Zustandsobjekt (Standards: BALANCE.menuDefaults). */
export function readStartState() {
  const D = BALANCE.menuDefaults; // Standards: js/data/balance.js
  // Eroberung: bis zu 3 Computergegner, jeder mit eigener Schwierigkeit (gemerkt); klassisch: ein Gegner
  const s = {};
  s.conquest = readFlag(CONQUEST_KEY, D.conquest);
  const TIX = BALANCE.conquest.ticketChoices;
  s.tickets = Number(readChoice(TICKETS_KEY, TIX.map(String), String(BALANCE.conquest.ticketDefault)));
  s.opponents = Number(readChoice(OPP_KEY, ['1', '2', '3'], String(D.opponents)));
  s.diffs = [1, 2, 3].map((i) => readChoice(OPP_DIFF_KEY + i, DIFFS.map(([k]) => k), D.difficulty));
  s.mapSel = readMapSel(); // 'random' | Karten-ID
  s.winPoints = BALANCE.winPoints;
  s.radio = readFlag(RADIO_KEY, D.radio);
  s.weather = readChoice(WEATHER_KEY, WEATHER_SETTINGS, D.weather);
  s.mood = readChoice(MOOD_KEY, MOOD_SETTINGS, 'random');
  s.research = readFlag(RESEARCH_KEY, D.research);
  s.river = readFlag(RIVER_KEY, D.river);
  s.buildRules = readFlag(BUILD_KEY, D.buildRules);
  s.lowres = readLowRes(); // Bildauflösung (nur Darstellung, nicht an new Game())
  s.sound = readFlag(SOUND_KEY, true); // Ton: gleicher Speicher wie der Schalter im Spiel (audio/sound.js)
  return s;
}

/** Knöpfe und Felder des Startmenüs an den Zustand `s` anpassen. */
export function markStart(root, s) {
  const count = s.conquest ? s.opponents : 1;
  root.querySelectorAll('[data-cq]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.cq === '1') === s.conquest)));
  root.querySelector('[data-oppfield]').hidden = !s.conquest;
  root.querySelectorAll('[data-opp]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.opp) === s.opponents)));
  root.querySelectorAll('[data-opprow]').forEach((r) => (r.hidden = Number(r.dataset.opprow) > count));
  root.querySelectorAll('[data-od]').forEach((b) => {
    const [i, k] = b.dataset.od.split(':');
    b.setAttribute('aria-pressed', String(s.diffs[i - 1] === k));
  });
  // Eroberung: Tickets statt Siegpunkte
  root.querySelector('[data-tixfield]').hidden = !s.conquest;
  root.querySelector('[data-ptsfield]').hidden = s.conquest;
  root.querySelectorAll('[data-tix]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.tix) === s.tickets)));
  root.querySelectorAll('[data-pts]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.pts) === s.winPoints)));
  root.querySelectorAll('[data-radio]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.radio === '1') === s.radio)));
  root.querySelectorAll('[data-weather]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.weather === s.weather)));
  root.querySelectorAll('[data-mood]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mood === s.mood)));
  root.querySelectorAll('[data-research]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.research === '1') === s.research)));
  root.querySelectorAll('[data-build]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.build === '1') === s.buildRules)));
  root.querySelectorAll('[data-river]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.river === '1') === s.river)));
  root.querySelectorAll('[data-sound]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.sound === '1') === s.sound)));
  root.querySelectorAll('[data-lowres]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.lowres === '1') === s.lowres)));
  markFullscreen(root);
}

/** Eine Schalter-Wahl nach einem Klick übernehmen und merken. Liefert true, wenn der Knopf ein Schalter war. */
export function applySetting(s, b) {
  if (b.dataset.cq) {
    s.conquest = b.dataset.cq === '1';
    writeFlag(CONQUEST_KEY, s.conquest);
  } else if (b.dataset.opp) {
    s.opponents = Number(b.dataset.opp);
    writeChoice(OPP_KEY, String(s.opponents));
  } else if (b.dataset.tix) {
    s.tickets = Number(b.dataset.tix);
    writeChoice(TICKETS_KEY, String(s.tickets));
  } else if (b.dataset.od) {
    const [i, k] = b.dataset.od.split(':');
    s.diffs[i - 1] = k;
    writeChoice(OPP_DIFF_KEY + i, k);
  } else if (b.dataset.pts) s.winPoints = Number(b.dataset.pts);
  else if (b.dataset.radio) {
    s.radio = b.dataset.radio === '1';
    writeFlag(RADIO_KEY, s.radio);
  } else if (b.dataset.mood) {
    s.mood = b.dataset.mood;
    writeChoice(MOOD_KEY, s.mood);
  } else if (b.dataset.weather) {
    s.weather = b.dataset.weather;
    writeChoice(WEATHER_KEY, s.weather);
  } else if (b.dataset.research) {
    s.research = b.dataset.research === '1';
    writeFlag(RESEARCH_KEY, s.research);
  } else if (b.dataset.build) {
    s.buildRules = b.dataset.build === '1';
    writeFlag(BUILD_KEY, s.buildRules);
  } else if (b.dataset.river) {
    s.river = b.dataset.river === '1';
    writeFlag(RIVER_KEY, s.river);
  } else if (b.dataset.fs) {
    setFullscreen(b.dataset.fs === '1');
  } else if (b.dataset.sound) {
    s.sound = b.dataset.sound === '1';
    writeFlag(SOUND_KEY, s.sound);
  } else if (b.dataset.lowres) {
    s.lowres = b.dataset.lowres === '1';
    writeLowRes(s.lowres);
  } else return false;
  return true;
}
