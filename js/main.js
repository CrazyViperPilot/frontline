// Bootstrap (docs/verlauf.md §5 main.js): Startmenü, Spiel erzeugen, Schleife, URL-Parameter, Service Worker.
// URL: ?seed=N (feste Karte) · ?river=0|1 (Fluss) · ?speed=N (Startgeschwindigkeit) · ?debug=1 (Karte aufgedeckt, M = +1000, bis 10×).
// Debug: ?mood=morning|day|evening|night (Lichtstimmung) · ?weather=summer|autumn|winter (Jahreszeit) · ?wx=clear|rain|fog|snow (Wetter sofort, ohne Wechsel).
import { BALANCE } from './data/balance.js';
import { Game } from './game/game.js';
import { loadMap } from './game/mapdata.js';
import { AI } from './ai/ai.js';
import { createLoop } from './core/loop.js';
import { Sound } from './audio/sound.js';
import { Camera } from './render/camera.js';
import { Renderer } from './render/renderer.js';
import { Minimap } from './render/minimap.js';
import { Controller } from './ui/controller.js';
import { Input } from './ui/input.js';
import { Hud } from './ui/hud.js';
import { CityPanel, MarketPanel } from './ui/citypanel.js';
import { ResearchPanel } from './ui/researchpanel.js';
import { FlowPanel } from './ui/flowpanel.js';
import { showStartMenu, showPause, showHelp, showEnd, hideOverlay } from './ui/menu.js';
import { pickMood, MOOD_SETTINGS } from './render/mood.js';
import { snapshotGame, restoreGame, SAVE_FORMAT } from './game/savegame.js';
import { pack, unpack } from './core/snapshot.js';
import * as saves from './ui/saves.js';
import { matchStart, matchResume, finishMatch, gameInfo } from './ui/match.js';
import { GAME_VERSION } from './version.js';
import { WEATHER_NAMES, WEATHER_SETTINGS } from './game/weather.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const REVEAL = DEBUG && params.get('fog') !== '1'; // Debug deckt die Karte auf; `fog=1` behält den Nebel (Sicht prüfen)
// Ansicht: ?iso=1 / ?iso=0 oder zuletzt gewählt (V bzw. Schaltfläche); Standard 2D
function loadIso() {
  if (params.has('iso')) return params.get('iso') === '1';
  try {
    return localStorage.getItem('frontline-iso') === '1';
  } catch {
    return false;
  }
}
// Gewertete Partien (Match-Start, ui/match.js, MS1/MS2): nur mit einem Token des Kontos. Sie starten mit dessen Kasse (w0) und
// melden am Ende den Endstand. Das Token wird erst dann verbraucht. Der Stand merkt es lokal (meta.match): ein fortgesetzter
// Stand bleibt gewertet, solange das Token auf diesem Gerät noch im Vorrat ist. Alle anderen Partien (Gast, kein Vorrat,
// Fortsetzen ohne Token) laufen ungewertet mit dem Startbetrag. Mit ?debug=1 nie gewertet.
const UNRATED_NOTE = 'Diese Partie zählt nicht für die Kasse (ohne Konto oder ohne gewertetes Token).';
const URL_SEED = Number.parseInt(params.get('seed'), 10);
const URL_SPEED = Number.parseFloat(params.get('speed'));
const SPEEDS = DEBUG ? [1, 2, 3, 5, 10] : [1, 2, 3];
const HUMAN = 0; // Blau
const AI_TEAM = 1; // Rot

const canvas = document.getElementById('view');
const hudRoot = document.getElementById('hud');
const overlay = document.getElementById('overlay');

const sound = new Sound(); // Ton (PRD §14): ein Sound-Objekt für alle Partien, der AudioContext entsteht erst bei der ersten Geste
const levelCtl = { get: (kind) => sound.getLevel(kind), set: (kind, v) => sound.setLevel(kind, v) }; // Regler im Pausenmenü (seit v5.68)
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, () => sound.unlock(), { capture: true });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) sound.ctx?.suspend?.().catch?.(() => {});
  else if (sound.on) sound.ctx?.resume?.().catch?.(() => {});
});
hudRoot.addEventListener('click', (e) => {
  if (e.target.closest('button')) sound.click();
});

let session = null; // laufendes Spiel: { game, ai, camera, renderer, minimap, controller, hud, input, loop, … }
// Nur mit ?debug=1: Zugriff für Browser-Prüfungen (tools/smoke.mjs, Playwright), z. B. window.__frontline.session().game (seit v5.81)
if (DEBUG) window.__frontline = { session: () => session };
let settings = { difficulty: 'normal', winPoints: BALANCE.winPoints, radio: true, weather: 'random', mood: 'random', research: true, river: true, city: true };

function nearestSpeedIndex(v) {
  let best = 0;
  for (let i = 1; i < SPEEDS.length; i++) {
    if (Math.abs(SPEEDS[i] - v) < Math.abs(SPEEDS[best] - v)) best = i;
  }
  return best;
}

function resume() {
  if (session) session.loop.paused = false;
}

function clearCanvas() {
  const ctx = canvas.getContext('2d');
  ctx?.clearRect(0, 0, canvas.width, canvas.height);
}

function stopSession() {
  const s = session;
  if (!s) return;
  session = null;
  sound.detach();
  s.loop.stop();
  s.input.destroy();
  window.removeEventListener('resize', s.onResize);
  s.cityPanel?.destroy();
  s.market?.destroy();
  s.research?.destroy();
  s.flow?.destroy();
  s.hud.destroy();
  clearCanvas();
}

function quitToMenu() {
  stopSession();
  showStartMenu(overlay, startGame, { resume: resumeOffer });
}

// ---- Spielstand (Gerät + Webspace, ui/saves.js) ----------------------------------------------------------------

const AUTOSAVE_MS = 90000; // Takt der Autospeicherung (Echtzeit, nur bei laufendem Spiel)
const MIN_SAVE_TIME = 20; // erst ab dieser Spielzeit (s) lohnt ein Stand

/**
 * Stand der laufenden Partie packen. Liefert null, wenn es nichts zu speichern gibt (Ende ohne `ended`, zu früh, Debug).
 * Der Endstand (ended = true) wird einmal nach dem Spielende geschrieben. Die erste Speicherung legt die Partie als Stand an
 * (id, Name „Partie TT.MM.JJJJ HH:MM“, createdAt); danach schreibt jede Speicherung in diesen Stand. copyName (seit SP3,
 * „Speichern unter …“): legt stattdessen einen neuen Stand mit neuer id und diesem Namen an, in den die Partie weiterschreibt.
 */
async function captureSave(s, ended = false, copyName = null) {
  const g = s.game;
  if (DEBUG || (!ended && (s.ended || g.winner !== null || g.time < MIN_SAVE_TIME))) return null;
  if (copyName !== null) {
    s.saveId = saves.newSaveId();
    s.saveName = copyName;
    s.createdAt = Date.now();
  } else if (!s.saveId) {
    s.saveId = saves.newSaveId();
    s.saveName = saves.defaultName(new Date());
    s.createdAt = Date.now();
  }
  const cam = s.camera;
  const body = {
    format: SAVE_FORMAT,
    settings: s.settings,
    view: { x: cam.x, y: cam.y, zoom: cam.zoom, iso: cam.iso, rot: cam.rot, speed: s.loop.speed },
    snap: snapshotGame(g, s.ai),
  };
  const bytes = await pack(body);
  const meta = {
    id: s.saveId,
    name: s.saveName,
    version: GAME_VERSION,
    format: SAVE_FORMAT,
    createdAt: s.createdAt,
    updatedAt: Date.now(),
    gameTime: g.time,
    points: [g.teams[0].points, g.teams[1].points],
    winPoints: g.winPoints,
    difficulty: s.settings.difficulty ?? 'normal',
    ended,
    size: bytes.length,
  };
  // Gewertete Partie: das Token merkt sich der Stand (lokal; zum Webspace geht es nicht, saves.js remoteMeta). Beendet: nicht mehr.
  if (s.match && !ended) meta.match = { token: s.match.token, w0: s.match.w0 };
  return { meta, bytes };
}

/**
 * Speichert die laufende Partie. Speicherungen laufen nacheinander (eine Warteschlange je Partie). Liefert einen Text für
 * die Anzeige (oder null, wenn nichts gespeichert wurde).
 */
function saveNow(s, ended = false, copyName = null) {
  s.pendingSaves = (s.pendingSaves ?? 0) + 1;
  const job = (s.saveChain ?? Promise.resolve()).then(() => doSave(s, ended, copyName)).finally(() => {
    s.pendingSaves -= 1;
  });
  s.saveChain = job.catch(() => {});
  return job;
}

async function doSave(s, ended, copyName = null) {
  try {
    const rec = await captureSave(s, ended, copyName);
    if (!rec) return null;
    s.lastSave = performance.now();
    const where = await saves.storeSave(rec);
    const place = where === 'beide' ? 'Gerät und Webspace' : 'nur Gerät, Webspace nicht erreichbar';
    return copyName !== null ? `Kopie „${copyName}“ angelegt (${place})` : `Gespeichert (${place})`;
  } catch (err) {
    return `Speichern fehlgeschlagen: ${err.message ?? err}`;
  }
}

/** „Speichern unter …“ im Pausenmenü: neuer Stand mit diesem Namen, die Partie spielt darin weiter. Liefert einen Text. */
function saveCopy(s, name) {
  let clean;
  try {
    clean = saves.cleanName(name);
  } catch (err) {
    return Promise.reject(err);
  }
  if (session !== s || s.ended) return Promise.resolve('Keine laufende Partie');
  return saveNow(s, false, clean).then((t) => t ?? 'Noch zu kurz zum Speichern (ab 20 s Spielzeit)');
}

/** „Speichern unter …“ und der Name im Pausenmenü (für showPause): Name des Stands, Vorschlag, Kopie anlegen. */
function pauseSaveAs(s) {
  return {
    name: () => s.saveName ?? null,
    suggest: () => saves.copyName(s.saveName ?? saves.defaultName(new Date())),
    copy: (name) => saveCopy(s, name),
  };
}

/** Angebot im Startmenü: der neueste nicht beendete Stand (Gerät oder Webspace), dazu die Liste (ui/menu.js). */
let offeredId = null;
const resumeOffer = {
  async find() {
    offeredId = null;
    if (DEBUG) return null;
    saves.syncUp().catch(() => {}); // nach Offline-Spielen neuere Stände nachschicken
    const best = (await saves.listSaves()).find((e) => !e.meta.ended && e.meta.format === SAVE_FORMAT);
    if (!best) return null;
    offeredId = best.meta.id;
    return { text: saves.describe(best.meta, best.source) };
  },
  onResume() {
    if (offeredId) loadStand(offeredId);
  },
  onDiscard() {
    if (offeredId) saves.deleteSave(offeredId).catch(() => {});
    offeredId = null;
  },
  /** Liste der Stände fürs Startmenü; loadable = Format passt (sonst nicht fortsetzbar). */
  async list() {
    if (DEBUG) return [];
    return (await saves.listSaves()).map((e) => ({ ...e, loadable: e.meta.format === SAVE_FORMAT }));
  },
  load: (id) => loadStand(id),
  /** Umbenennen (Name wird geprüft: 1 bis 60 Zeichen). Ist es die laufende Partie, zieht ihr Name nach. */
  async rename(id, name) {
    const clean = saves.cleanName(name);
    const where = await saves.renameSave(id, clean);
    if (session?.saveId === id) session.saveName = clean;
    return where;
  },
  remove: (id) => saves.deleteSave(id),
};

/** Einen Stand laden und fortsetzen; bei Fehler zurück ins Startmenü mit Meldung. */
function loadStand(id) {
  saves
    .loadSave(id)
    .then((rec) => {
      if (!rec) throw new Error('Stand nicht gefunden');
      return resumeGame(rec);
    })
    .catch((err) => {
      showStartMenu(overlay, startGame, { resume: resumeOffer });
      alert(`Spielstand lässt sich nicht laden: ${err.message ?? err}`);
    });
}

async function resumeGame(rec) {
  const body = await unpack(rec.bytes);
  if (body.format !== SAVE_FORMAT) throw new Error('Stand stammt von einer anderen Version');
  const { game, ai } = restoreGame(body.snap);
  stopSession();
  hideOverlay(overlay);
  settings = body.settings ?? settings;
  // Gewertet bleibt, wer das Token des Standes noch im Vorrat hat (MS2); sonst läuft die Partie ungewertet weiter
  const match = DEBUG ? null : matchResume(rec.meta.match);
  buildSession(game, ai, settings, body.view);
  session.match = match;
  if (!DEBUG) session.hud.pushMessage(match ? 'Gewertete Partie: der Endstand zählt für die Kasse.' : 'Fortgesetzte Partien zählen nicht für die Kasse.');
  // Die Partie schreibt ab jetzt in diesen Stand
  Object.assign(session, { saveId: rec.meta.id, saveName: rec.meta.name, createdAt: rec.meta.createdAt });
  // Beim Fortsetzen erst pausiert: Zeit zum Umsehen
  session.loop.paused = true;
  showPause(overlay, resume, quitToMenu, () => {}, levelCtl, pauseSaveAs(session), { rated: !!session.match });
}

async function quitAndSave() {
  const s = session;
  if (s) await saveNow(s);
  quitToMenu();
}

/** Aktionen für Hilfe, Tastatur und HUD. */
const app = {
  debug: DEBUG,
  status() {
    const s = session;
    return s ? { paused: s.loop.paused, speed: s.loop.speed, sound: sound.on } : { paused: false, speed: 1, sound: sound.on };
  },
  overlayOpen: () => !overlay.hidden,
  closeOverlay() {
    const kind = overlay.dataset.kind;
    if (kind === 'help') hideOverlay(overlay);
    else if (kind === 'pause') {
      hideOverlay(overlay);
      resume();
    }
  },
  togglePause() {
    const s = session;
    if (!s || s.ended) return;
    if (s.loop.paused) {
      hideOverlay(overlay);
      resume();
    } else {
      s.loop.paused = true;
      const s2 = s;
      showPause(overlay, resume, quitAndSave, (setText, setName) => {
        saveNow(s2).then((t) => {
          if (t) setText(t);
          setName();
        });
      }, levelCtl, pauseSaveAs(s2), { rated: !!s2.match });
    }
  },
  toggleView() {
    const s = session;
    if (!s) return;
    s.camera.iso = !s.camera.iso;
    s.camera.clamp();
    try {
      localStorage.setItem('frontline-iso', s.camera.iso ? '1' : '0');
    } catch {
      /* ohne Speicher: gilt nur für diese Sitzung */
    }
    s.hud.pushMessage(s.camera.iso ? 'Ansicht: isometrisch (V)' : 'Ansicht: 2D von oben (V)');
    s.hud.refresh();
  },
  rotateView(dir) {
    const s = session;
    if (!s) return;
    if (!s.camera.iso) {
      s.hud.pushMessage('Drehen geht nur in der isometrischen Ansicht (V)');
      return;
    }
    s.camera.rotate(dir);
    s.hud.pushMessage(`Ansicht gedreht (${s.camera.rot * 90}°)`);
  },
  toggleHelp() {
    if (overlay.dataset.kind === 'help') {
      hideOverlay(overlay);
      return;
    }
    if (!overlay.hidden || !session || session.ended) return;
    showHelp(overlay);
  },
  changeSpeed(dir) {
    const s = session;
    if (!s) return;
    const j = Math.min(SPEEDS.length - 1, Math.max(0, nearestSpeedIndex(s.loop.speed) + dir));
    s.loop.speed = SPEEDS[j];
    s.hud.pushMessage(`Tempo ${SPEEDS[j]}×`);
  },
  cycleSpeed() {
    const s = session;
    if (!s) return;
    s.loop.speed = SPEEDS[(nearestSpeedIndex(s.loop.speed) + 1) % SPEEDS.length];
    s.hud.pushMessage(`Tempo ${s.loop.speed}×`);
  },
  /** Nächstes Baufahrzeug wählen und anfahren (J, Knopf „Bauer“). */
  nextBuilder() {
    const s = session;
    if (!s || s.ended || !overlay.hidden) return;
    s.input.nextBuilder();
    s.hud.refresh?.();
  },
  toggleCity() {
    const s = session;
    if (!s || s.ended || !s.cityPanel) return;
    if (!overlay.hidden) return;
    if (s.cityPanel.open && s.cityPanel.folded) s.cityPanel.fold(false); // eingeklappt: Stadt-Knopf klappt auf
    else s.cityPanel.toggle();
    if (s.cityPanel.open) s.controller.cancel();
    s.hud.refresh?.();
  },
  /** Marktmenü auf/zu (Geldanzeige, Aktion „Handel“ am Markt, Knopf „Handel“ im Baumodus); ohne fertigen Markt nur ein Hinweis. */
  toggleMarket() {
    const s = session;
    if (!s || s.ended || !s.market || !overlay.hidden) return;
    s.market.toggle();
  },
  /** Esc: offenes Marktmenü schließen; true, wenn es offen war. */
  closeMarket() {
    const m = session?.market;
    if (!m?.open) return false;
    m.toggle(false);
    return true;
  },
  /** Forschungsmenü auf/zu (Knopf „Forschung“ unter „Stadt“, Befehl „Forschung“ der Hauptstadt). */
  toggleResearch() {
    const s = session;
    if (!s || s.ended || !s.research || !overlay.hidden) return;
    if (!s.research.open) s.flow?.toggle(false); // ein Fenster zugleich
    s.research.toggle();
  },
  /** Ressourcenanzeige auf/zu (Knopf „Ressourcen“ unter „Forschung“, nur mit Stadt). */
  toggleFlow() {
    const s = session;
    if (!s || s.ended || !s.flow || !overlay.hidden) return;
    if (!s.flow.open) s.research?.toggle(false);
    s.flow.toggle();
  },
  /** Esc: offene Ressourcenanzeige schließen; true, wenn sie offen war. */
  closeFlow() {
    const f = session?.flow;
    if (!f?.open) return false;
    f.toggle(false);
    return true;
  },
  /** Esc: offenes Forschungsmenü schließen; true, wenn es offen war. */
  closeResearch() {
    const r = session?.research;
    if (!r?.open) return false;
    r.toggle(false);
    return true;
  },
  /** Baumodus der Stadt offen? Dann die Stadtleiste (Input zieht damit Rechtecke auf der Karte). */
  cityBuild: () => (session?.cityPanel?.open && !session.ended ? session.cityPanel : null),
  toggleSound() {
    const on = sound.toggle();
    session?.hud.pushMessage(on ? 'Ton an (F2)' : 'Ton aus (F2)');
    session?.hud.refresh();
  },
  debugMoney() {
    const s = session;
    if (!DEBUG || !s) return;
    if (s.game.issue(HUMAN, { type: 'debug', money: 1000 }).ok) s.hud.pushMessage('Debug: +1000 Geld');
  },
};

function startSpeed() {
  return Number.isFinite(URL_SPEED) ? Math.min(10, Math.max(0.25, URL_SPEED)) : 1;
}

/** Ein Bild: Eingabe, Ereignisse, Zeichnen, HUD und Spielende. */
function frame(s) {
  const now = performance.now();
  const dt = Math.min(0.1, (now - (s.last ?? now)) / 1000);
  s.last = now;
  s.input.update(dt);
  s.cityPanel?.update();
  s.market?.update();
  s.research?.update();
  s.flow?.update();
  if (!s.loop.paused && !s.ended && !s.pendingSaves && now - s.lastSave > AUTOSAVE_MS) saveNow(s);

  for (const ev of s.game.drainEvents()) {
    if (ev.type !== 'message' || (ev.team !== HUMAN && ev.team !== -1)) continue;
    s.controller.noteEvent(ev);
    s.hud.pushMessage(ev.text, Number.isFinite(ev.x) ? { x: ev.x, y: ev.y } : null);
    sound.message(ev);
  }
  sound.update(dt, s.loop.paused);

  s.renderer.render(s.controller.view);
  s.minimap.render();
  s.hud.update();

  const g = s.game;
  if (g.winner !== null && !s.ended) {
    s.ended = true;
    if (!DEBUG && s.match) finishMatch(s.match.token, g.teams[HUMAN].res.money, gameInfo(g, s.settings?.difficulty, HUMAN)); // gewertete Partie: Endstand und Partie-Infos (Statistik) an den Server
    if (!DEBUG) saveNow(s, true); // beendete Partie bleibt als Stand (ended, nicht fortsetzbar), wird nicht gelöscht
    sound.end(g.winner === HUMAN);
    showEnd(
      overlay,
      {
        winner: g.winner,
        team: HUMAN,
        reason: g.winReason,
        stats: {
          time: g.time,
          points: [g.teams[0].points, g.teams[1].points],
          winPoints: g.winPoints,
          teams: g.teams.map((t) => ({ ...t.stats, earned: t.earned || 0, used: { ...t.used } })), // Statistik je Team (seit v5.65)
        },
      },
      () => startGame(settings),
    );
  }
}

function startGame(opts) {
  settings = opts;
  stopSession();
  hideOverlay(overlay);

  const seed = Number.isFinite(URL_SEED) ? URL_SEED : Math.floor(Math.random() * 1e9) + 1;
  const map = opts.mapId && opts.mapId !== 'random' ? loadMap(opts.mapId) : null; // gespeicherte Karte, sonst aus dem Seed
  const weather = DEBUG && WEATHER_SETTINGS.includes(params.get('weather')) ? params.get('weather') : opts.weather ?? 'off';
  const river = params.has('river') ? params.get('river') === '1' : opts.river !== false; // ?river=0|1 übersteuert das Startmenü
  const match = DEBUG ? null : matchStart(); // gewertet nur mit Token; sonst ungewertet
  const game = new Game({ seed, winPoints: opts.winPoints, startMoney: match ? match.w0 : BALANCE.startRes.money, map, radio: opts.radio !== false, weather, research: opts.research !== false, river, city: true, buildRules: opts.buildRules !== false, debug: DEBUG });
  if (DEBUG && WEATHER_NAMES[params.get('wx')]) {
    const wx = params.get('wx');
    game.issue(HUMAN, { type: 'debug', weather: wx, season: wx === 'snow' ? 'winter' : game.weather.season, hold: true }); // Schnee nur im Winter; bleibt so (Grafik prüfen)
  }
  const ai = new AI(game, AI_TEAM, opts.difficulty);
  buildSession(game, ai, opts, null);
  session.match = match;
  if (!DEBUG && !match) session.hud.pushMessage(UNRATED_NOTE);
}

/** Oberfläche und Schleife um ein (neues oder geladenes) Spiel aufbauen. view = gespeicherte Kameraansicht oder null. */
function buildSession(game, ai, opts, view) {
  const seed = game.seed;
  const camera = new Camera(BALANCE.map.width, BALANCE.map.height);
  camera.iso = loadIso();
  if (view) {
    camera.iso = !!view.iso;
    camera.rot = view.rot ?? 0;
    camera.zoom = view.zoom ?? 1;
  }
  const renderer = new Renderer(canvas, game, camera, HUMAN);
  const moodSetting = DEBUG && MOOD_SETTINGS.includes(params.get('mood')) ? params.get('mood') : opts.mood ?? 'off';
  renderer.mood = pickMood(moodSetting, seed, game.weather.season); // nur Optik, ?debug=1&mood=night
  const controller = new Controller(game, HUMAN, camera);
  const hud = new Hud(hudRoot, game, HUMAN, controller, app);
  controller.onMessage = (text) => hud.pushMessage(text);
  controller.onOrder = () => sound.order();
  sound.attach(game, camera, HUMAN);
  const minimap = new Minimap(hud.minimapCanvas, game, camera, HUMAN);

  const applyInsets = () => {
    const ins = hud.insets();
    camera.insetTop = ins.top;
    camera.insetBottom = ins.bottom;
  };
  app.onLayout = applyInsets; // HUD klappt ein/aus
  applyInsets();
  const home = controller.homeBase();
  if (view) {
    camera.x = view.x;
    camera.y = view.y;
    camera.clamp();
  } else if (home) camera.centerOn(home.x, home.y);
  if (REVEAL) {
    renderer.revealAll = true;
    minimap.revealAll = true;
  }
  const input = new Input({ canvas, minimap, camera, controller, hud, app });
  const onResize = () => {
    renderer.resize();
    minimap.resize();
    applyInsets();
  };
  window.addEventListener('resize', onResize);

  const cityPanel = game.city ? new CityPanel(hudRoot.parentElement ?? document.body, game, HUMAN, (t) => hud.pushMessage(t), (x, y) => camera.centerOn(x, y), () => app.toggleMarket()) : null;
  renderer.cityUi = cityPanel; // Baumodus: Gebiet und gezogenes Rechteck zeichnen (nur lesen)
  const market = game.city ? new MarketPanel(hudRoot.parentElement ?? document.body, game, HUMAN, (t) => hud.pushMessage(t)) : null;
  controller.onMarket = () => app.toggleMarket();
  controller.onCity = () => app.toggleCity();
  const research = game.research ? new ResearchPanel(hudRoot.parentElement ?? document.body, game, HUMAN, (t) => hud.pushMessage(t)) : null;
  const flow = game.city ? new FlowPanel(hudRoot.parentElement ?? document.body, game, HUMAN) : null;
  controller.onResearch = () => app.toggleResearch();
  const s = { game, ai, camera, renderer, minimap, controller, hud, input, cityPanel, market, research, flow, onResize, loop: null, ended: false, last: null, settings: opts, pendingSaves: 0, saveChain: null, lastSave: performance.now() };
  s.loop = createLoop({
    tickRate: BALANCE.tickRate,
    update(dt) {
      ai.update(dt);
      game.update(dt);
      if (REVEAL) game.fog[HUMAN].revealAll(); // Simulation setzt den Nebel alle 0,25 s neu
    },
    render: () => frame(s),
  });
  s.loop.speed = view?.speed ?? startSpeed();
  session = s;
  if (DEBUG) window.frontlineSound = sound;
  if (DEBUG) window.frontline = s; // Konsole/Tests: Zugriff auf Spielzustand
  s.loop.start();
}

showStartMenu(overlay, startGame, { resume: resumeOffer });

// Beim Verlassen/Wegwischen der App sichern (lokal sicher, Webspace, wenn die Zeit reicht)
document.addEventListener('visibilitychange', () => {
  if (document.hidden && session && !session.loop.paused) saveNow(session);
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
