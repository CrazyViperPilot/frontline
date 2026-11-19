// Eroberung (docs/prd/eroberung.md): 2 bis 4 Teams, jeder gegen jeden. Quadratische Konfliktzone mit 4 × 4 Flaggengebieten,
// Tickets statt Punktebalken, gesperrte Viertel außerhalb der Zone, Ausscheiden. Karten mit eigenen Flaggen (map.flags) haben
// runde Flaggengebiete; mit map.layout 'sides' liegen die Viertel (Baugebiete) an den Kartenseiten statt in den Ecken. Kein DOM.
import { BALANCE } from '../data/balance.js';
import { inZone, sideOf } from './zonegeo.js';
import { aliveTeams } from './teams.js';
import { nearestPassable } from './movement.js';
import { earn } from './ledger.js';

const Q = BALANCE.conquest;
const H = BALANCE.hot;
const CLOSED = 9; // Viertel ohne Spieler: für alle gesperrt

/** Startzustand; ohne `on` bleibt `game.conquest` null und die Partie klassisch (Punktebalken, 2 Teams). */
function createConquest(game, on, tickets = null) {
  game.conquest = null;
  if (!on) return;
  const z = game.map.zone;
  game.zone.half = Q.half; // die Zone ist ab jetzt ein Quadrat (zonegeo.inZone liest `half`)
  const size = (2 * Q.half) / Q.grid;
  const x0 = z.x - Q.half;
  const y0 = z.y - Q.half;
  const flags = [];
  const own = game.map.flags ?? [];
  // eigene Flaggen der Karte: Gebiet ein Kreis mit f.r um den Mast (round), sonst das Raster
  for (const [id, f] of own.entries()) flags.push({ id, letter: Q.names[id] ?? String(id + 1), x: f.x, y: f.y, r: f.r, ...(f.name ? { name: f.name } : {}), owner: -1, capTeam: -1, p: 0, counts: game.teams.map(() => 0), contested: false });
  for (let r = 0; r < (own.length ? 0 : Q.grid); r++) {
    for (let c = 0; c < Q.grid; c++) {
      const id = r * Q.grid + c;
      // owner: Besitzer oder -1 (grau); capTeam/p: wessen Balken gerade steht (0..1); counts: Einheiten je Team im Gebiet
      flags.push({ id, letter: Q.names[id] ?? String(id + 1), x: x0 + (c + 0.5) * size, y: y0 + (r + 0.5) * size, owner: -1, capTeam: -1, p: 0, counts: game.teams.map(() => 0), contested: false });
    }
  }
  // Viertel je Kartenquadrant (bzw. Kartenseite im Seitenlayout): Index des Teams, dessen Startpunkt dort liegt, sonst CLOSED
  const sides = game.map.layout === 'sides';
  const quad = [CLOSED, CLOSED, CLOSED, CLOSED];
  game.teams.forEach((t) => {
    const sp = game.map.spawns[t.id];
    quad[sides ? sideOf(z, sp.x, sp.y) : quadIndex(z, sp.x, sp.y)] = t.id;
  });
  const open = new Array(CLOSED + 1).fill(false); // true = Sperre des Viertels gefallen
  const startTickets = Number.isFinite(tickets) && tickets > 0 ? Math.round(tickets) : Math.round(game.winPoints * Q.ticketMul);
  // round: runde Flaggengebiete (eigene Flaggen); size dann der größte Durchmesser (Maßstab der KI); sides: Viertel an den Seiten
  const round = own.length > 0;
  game.conquest = { startTickets, half: Q.half, x0, y0, size: round ? 2 * Math.max(...own.map((f) => f.r)) : size, round, sides, flags, quad, open, timer: 0, noFlag: game.teams.map(() => 0), held: game.teams.map(() => 0) };
  for (const t of game.teams) {
    t.tickets = startTickets;
    t.out = false;
  }
  bindLock(game);
}

/** Sperre ins Wegeraster hängen (auch nach dem Laden eines Spielstands): grid.lock je Zelle = Viertel, -1 in der Zone. */
function bindLock(game) {
  const cq = game.conquest;
  const g = game.grid;
  if (!cq) return;
  game.zone.half ??= cq.half; // Stände vor v5.167 hatten das Feld noch nicht
  const lock = new Int8Array(g.cols * g.rows);
  for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) lock[r * g.cols + c] = quarterAt(game, g.center(c), g.center(r));
  g.lock = lock;
  g.lockOpen = cq.open; // dasselbe Array: fällt eine Sperre, gilt das sofort im Raster
}

/** In der quadratischen Konfliktzone? */
export function inSquare(game, x, y) {
  return inZone(game.zone, x, y);
}

/** Index des Kartenquadranten um die Zonenmitte: 0 links oben, 1 rechts oben, 2 links unten, 3 rechts unten. */
const quadIndex = (z, x, y) => (x >= z.x ? 1 : 0) + (y >= z.y ? 2 : 0);

/** Viertel des Punkts: Team-Index, CLOSED (Viertel ohne Spieler) oder -1 (Konfliktzone). Seitenlayout: Index = Kartenseite (sideOf). */
export function quarterAt(game, x, y) {
  if (inSquare(game, x, y)) return -1;
  const z = game.map.zone;
  const cq = game.conquest;
  return cq.quad[cq.sides ? sideOf(z, x, y) : quadIndex(z, x, y)];
}

/** Darf `team` an diesem Punkt weder stehen noch hinschießen? (fremdes Viertel, dessen Sperre noch steht) */
export function lockedFor(game, team, x, y) {
  const cq = game.conquest;
  if (!cq) return false;
  const q = quarterAt(game, x, y);
  return q >= 0 && q !== team && !cq.open[q];
}

/** Flagge des Gebiets, in dem der Punkt liegt, oder null (außerhalb der Zone). */
export function flagAt(game, x, y) {
  const cq = game.conquest;
  if (!cq) return null;
  if (cq.round) {
    for (const f of cq.flags) if ((x - f.x) ** 2 + (y - f.y) ** 2 <= f.r * f.r) return f;
    return null;
  }
  const c = Math.floor((x - cq.x0) / cq.size);
  const r = Math.floor((y - cq.y0) / cq.size);
  if (c < 0 || r < 0 || c >= Q.grid || r >= Q.grid) return null;
  return cq.flags[r * Q.grid + c];
}

/** Buchstabe der Flagge, bei Karten mit Namen dazu der Name: „A (Gehöft)“. */
export const flagLabel = (f) => (f.name ? `${f.letter} (${f.name})` : f.letter);

/** Eigene Flaggen, an denen gerade Einheiten erscheinen dürfen (gehalten und kein Gegner im Gebiet). */
export function spawnFlags(game, team) {
  return game.conquest ? game.conquest.flags.filter((f) => f.owner === team && !f.contested) : [];
}

/** Einheitenlimit je Team: klassisch BALANCE.slotCap, in der Eroberung nach Spielerzahl. */
function slotCapOf(game) {
  return game.conquest ? (Q.slotCap[game.teams.length] ?? BALANCE.slotCap) : BALANCE.slotCap;
}

/** Team scheidet aus: Einheiten und Gebäude verschwinden, sein Viertel ist offen, seine Flaggen werden neutral. */
export function eliminate(game, t, why) {
  const team = game.teams[t];
  if (!game.conquest || team.out) return;
  team.out = true;
  team.tickets = 0;
  game.conquest.open[t] = true;
  for (const u of game.units) if (u.team === t) u.alive = false; // ohne Prämie und Wrack (cleanup)
  for (const b of game.buildings) {
    if (b.team !== t) continue;
    b.demolished = true;
    b.hp = 0;
  }
  for (const f of game.conquest.flags) {
    if (f.owner === t) f.owner = -1;
    if (f.capTeam === t) {
      f.capTeam = -1;
      f.p = 0;
    }
  }
  game.message(-1, `${team.name} scheidet aus (${why})`);
  checkEnd(game);
}

function checkEnd(game) {
  if (game.winner !== null) return;
  const alive = aliveTeams(game);
  const humans = game.teams.filter((t) => !t.isAI);
  const best = () => [...(alive.length ? alive : game.teams)].sort((a, b) => b.tickets - a.tickets || a.id - b.id)[0].id;
  if (alive.length <= 1) game.endGame(best(), 'tickets');
  else if (humans.length && humans.length < game.teams.length && humans.every((t) => t.out)) game.endGame(best(), 'tickets'); // der Mensch ist raus: Partie vorbei
}

/** Tickets abziehen; bei 0 scheidet das Team aus (einzige Stelle, die Tickets senkt: Takt, Kommandeur). */
function loseTickets(game, t, n) {
  const team = game.teams[t];
  if (!game.conquest || team.out) return;
  team.tickets -= n;
  if (team.tickets <= 0) eliminate(game, t, 'keine Tickets mehr');
}

/** Hauptstadt gefallen (nur möglich, wenn die Sperre des Viertels gefallen ist): das Team scheidet aus. */
function checkCapitals(game) {
  for (const t of game.teams) if (!t.out && !game.mainFob(t.id)) eliminate(game, t.id, 'Hauptstadt gefallen');
}

/** Ein Schritt: Einheiten je Gebiet zählen, Flaggen umfärben, Geld (Zone, Hot Zone, Flaggen), Tickets, Sperren. */
function updateConquest(game, dt) {
  const cq = game.conquest;
  const z = game.zone;
  const hot = game.hot;
  const n = game.teams.length;
  const counts = new Array(n).fill(0);
  const money = new Array(n).fill(0);
  for (const f of cq.flags) f.counts.fill(0);
  for (const u of game.units) {
    if (!u.alive || game.teams[u.team].out) continue;
    const f = flagAt(game, u.x, u.y);
    if (cq.round ? !inSquare(game, u.x, u.y) : !f) continue; // Raster: die Gebiete füllen das Quadrat; runde Gebiete nicht
    counts[u.team]++;
    if (f && !u.def.jet) f.counts[u.team]++; // Flugzeuge im Überflug erobern nicht, Hubschrauber schon
    const inHot = !!hot && Math.hypot(u.x - hot.x, u.y - hot.y) <= hot.r;
    money[u.team] += inHot ? H.unitIncome : BALANCE.zone.unitIncome;
  }
  z.counts = counts;
  z.weight = counts;

  // Flaggen: das Team mit den meisten Einheiten im Gebiet (Gleichstand: niemand) zieht den Balken eines anderen erst auf 0
  // (neutral, grau), dann den eigenen auf 1 (Besitz). Tempo wächst mit dem Vorsprung.
  const held = new Array(n).fill(0);
  for (const f of cq.flags) {
    let lead = -1;
    let top = 0;
    let second = 0;
    let present = 0;
    for (let t = 0; t < n; t++) {
      const c = f.counts[t];
      if (c > 0) present++;
      if (c > top) {
        second = top;
        top = c;
        lead = t;
      } else if (c > second) second = c;
    }
    if (top === second) lead = -1;
    f.contested = present > 1 || (present === 1 && f.owner >= 0 && f.counts[f.owner] === 0);
    if (lead >= 0) {
      const step = (Math.min(Q.capMaxMul, top - second) * dt) / Q.capTime;
      if (f.capTeam === lead || f.capTeam < 0) {
        f.capTeam = lead;
        f.p = Math.min(1, f.p + step);
        if (f.p >= 1 && f.owner !== lead) {
          f.owner = lead;
          game.message(-1, `${game.teams[lead].name} nimmt Flagge ${flagLabel(f)} ein`, f.x, f.y);
        }
      } else {
        f.p -= step;
        if (f.p <= 0) {
          f.p = 0;
          if (f.owner >= 0) game.message(f.owner, `Flagge ${flagLabel(f)} verloren`, f.x, f.y);
          f.owner = -1;
          f.capTeam = lead;
        }
      }
    }
    if (f.owner >= 0) held[f.owner]++;
  }
  cq.held = held;
  const most = Math.max(...held);
  const leaders = held.filter((h) => h === most).length;
  z.owner = most > 0 && leaders === 1 ? held.indexOf(most) : -1; // Führender nach Flaggen (Anzeige, KI)
  z.contested = false;

  // Geld: Einheiten in der Zone wie bisher, dazu das Flaggengeld
  for (let t = 0; t < n; t++) {
    const team = game.teams[t];
    if (team.out) continue;
    const perSec = (money[t] + held[t] * Q.flagIncome) * team.incomeMult;
    if (perSec > 0) {
      team.rate.money += perSec;
      earn(team, 'flags', perSec * dt);
    }
  }

  // Sperre: wer lockGrace lang keine Flagge hält, während ein anderer eine hält, verliert den Schutz seines Viertels
  if (most > 0) {
    for (let t = 0; t < n; t++) {
      if (game.teams[t].out || cq.open[t]) continue;
      cq.noFlag[t] = held[t] > 0 ? 0 : cq.noFlag[t] + dt;
      if (cq.noFlag[t] >= Q.lockGrace) {
        cq.open[t] = true;
        game.message(-1, `${game.teams[t].name} hält keine Flagge mehr: sein Viertel ist offen`, game.map.spawns[t].x, game.map.spawns[t].y);
      }
    }
  }

  // Tickets: je Takt verliert, wer weniger Flaggen hält als der Führende; ohne jede Flagge zusätzlich
  cq.timer += dt;
  if (cq.timer >= Q.tickEvery) {
    cq.timer -= Q.tickEvery;
    if (most > 0) {
      for (let t = 0; t < n; t++) {
        const team = game.teams[t];
        if (team.out || held[t] >= most) continue;
        loseTickets(game, t, 1 + (held[t] === 0 ? Q.noFlagLoss : 0));
      }
    }
  }
}

/** Platz an der gewählten Flagge des Gebäudes (b.spawnFlag), wenn sie dem Team gehört und kein Gegner im Gebiet steht; sonst null. */
function flagSpot(game, b) {
  if (b.spawnFlag === null || b.spawnFlag === undefined) return null;
  const f = game.conquest.flags[b.spawnFlag];
  if (!f || f.owner !== b.team || f.contested) return null;
  const a = game.rng.next() * Math.PI * 2;
  const r = Q.spawnRing * (Q.spawnMin + (1 - Q.spawnMin) * game.rng.next());
  const p = nearestPassable(game.grid, f.x + Math.cos(a) * r, f.y + Math.sin(a) * r, b.team);
  return p ? { x: p.x, y: p.y, letter: f.letter } : null;
}

/** Der Modus „Eroberung“ für das Modus-Register (js/game/modes.js): alle Stellen, an denen er von der klassischen Partie abweicht. */
export const CONQUEST_MODE = {
  id: 'conquest',
  teamCount: (players) => Math.max(2, Math.min(4, Math.floor(players) || 2)),
  create: (game, opts) => createConquest(game, true, opts.tickets),
  restore: bindLock,
  update: updateConquest,
  checkEnd: checkCapitals,
  locked: lockedFor,
  slotCap: slotCapOf,
  foeSpawn(game, team) {
    // der Punkt gegenüber der eigenen Startecke (durch die Zonenmitte gespiegelt): dort liegt die ferne Seite der Zone
    const z = game.map.zone;
    const sp = game.map.spawns[team];
    return { x: 2 * z.x - sp.x, y: 2 * z.y - sp.y };
  },
  commanderLost(game, u, points) {
    game.message(u.team, `Unser Kommandeur ist gefallen: −${points} Tickets`, u.x, u.y);
    game.messageFoes(u.team, `Kommandeur von ${game.teams[u.team].name} gefallen`, u.x, u.y);
    loseTickets(game, u.team, points); // bei 0 Tickets scheidet das Team aus, auch wenn es führt
    return true;
  },
  freeReinforce: Q.reinforce,
  spawnSpot: flagSpot,
  score: (team) => Math.max(0, team.tickets),
  scoreName: 'Tickets',
  aiArmy: 'conquestArmy',
};
