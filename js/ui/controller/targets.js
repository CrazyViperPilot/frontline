// Spieler-Steuerung, Zielmodi: Bestätigung der Klicks je Befehl (Angriff, Route, Landung, Ziel, Mauer, Platzierung) und ihre Vorschau. Kein DOM.
// Methoden der Klasse Controller (js/ui/controller.js), eingehängt über Object.assign.

import { isStand } from '../../game/aircraft.js';
import { isHeliport } from '../../game/helipad.js';
import { cityEntityAt } from '../../game/city/query.js';
import { CITY } from '../../data/city.js';
import { lineCells } from '../../game/grid.js';
import { BUILDINGS } from '../../data/buildings.js';
import { canSeat, ownWork, isWarehouse } from '../../game/logistics.js';
import { canGarrison, canEnter } from '../../game/garrison.js';
import { WALL_MAX, isCarrier } from './util.js';
import { propAt } from '../../game/propfire.js';
import { PROPS } from '../../data/props.js';
import { canFieldwork, fieldSpotWhy } from '../../game/fieldwork.js';
import { propCells, rotAcross } from '../../game/props.js';

/** Mauerzug von Start- zu Endzelle, höchstens WALL_MAX Zellen. */
function wallLine(a, b) {
  return lineCells(a.c, a.r, b.c, b.r)
    .slice(0, WALL_MAX)
    .map(([c, r]) => ({ c, r }));
}

export const targetMethods = {
  confirmPlace(wx, wy, shift) {
    const type = this.placeType;
    if (!type) return;
    const r = this.issue({ type: 'build', ids: this.builderIds(type), building: type, x: wx, y: wy });
    if (!r.ok) return;
    if (shift) this.updatePointer(wx, wy);
    else this.setMode('normal');
  },

  confirmAttackMove(wx, wy, shift) {
    const ids = this.selectedUnits().map((e) => e.id);
    if (!ids.length) {
      this.message('Keine Einheit gewählt');
      this.setMode('normal');
      return;
    }
    // Intakte Brücke angeklickt: beschießen (nur so greift jemand eine Brücke an)
    const bridge = this.pickBridge(wx, wy, (b) => !b.broken);
    if (bridge) {
      if (!this.issue({ type: 'attack', ids, targetId: bridge.id }).ok) return;
      this.message('Brücke wird beschossen');
      if (!shift) this.setMode('normal');
      return;
    }
    // Zaun, Mauer, Container … angeklickt: gezielt beschießen (props der Karte, propfire.js)
    const pi = propAt(this.game, wx, wy);
    if (pi >= 0) {
      if (!this.issue({ type: 'attackProp', ids, x: wx, y: wy }).ok) return;
      this.message(`${PROPS.kinds[this.game.map.props[pi].kind].name} wird beschossen`);
      if (!shift) this.setMode('normal');
      return;
    }
    const r = this.issue({ type: 'attackMove', ids, x: wx, y: wy, formation: this.formation });
    if (!r.ok) return;
    this.moveMarker(wx, wy, r.slots);
    if (!shift) this.setMode('normal');
  },

  /** Laden oder Entladen: Klick auf eigene FOB. */
  confirmTruckFob(kind, wx, wy) {
    const ids = this.selectedUnits().filter(isCarrier).map((e) => e.id);
    if (!ids.length) {
      this.message('Kein LKW gewählt');
      this.setMode('normal');
      return;
    }
    const fob = this.pickB(wx, wy, (e) => e.team === this.team && e.type === 'fob');
    if (!fob) {
      this.message('Eigene FOB anklicken');
      return;
    }
    if (this.issue({ type: kind, ids, fobId: fob.id }).ok) this.setMode('normal');
  },

  /** Pendeln, Schritt 1: Start = eigene fertige FOB oder eigenes Werk mit Ausgangslager (seit v5.70, pickWork). */
  confirmRouteFrom(wx, wy) {
    const ids = this.selectedUnits().filter(isCarrier);
    if (!ids.length) {
      this.message('Kein LKW gewählt');
      this.setMode('normal');
      return;
    }
    const hall = cityEntityAt(this.game, wx, wy);
    const fob = this.pickB(wx, wy, (e) => e.team === this.team && e.type === 'fob' && e.built) ?? (hall?.team === this.team && isWarehouse(this.game, hall) ? hall : null);
    const work = fob ? null : this.pickWork(wx, wy);
    if (!fob && !work) {
      this.message('Start: eigene FOB, Lagerhalle oder Werk anklicken');
      return;
    }
    this.routeFromId = fob ? fob.id : null; // setMode('routeTo') behält den Start
    this.routeFromWork = work ? work.cityCell : null;
    this.setMode('routeTo');
  },

  /** Pendeln, Schritt 2: Ziel-FOB. */
  confirmRouteTo(wx, wy) {
    const ids = this.selectedUnits().filter(isCarrier).map((e) => e.id);
    const fob = this.pickB(wx, wy, (e) => e.team === this.team && e.type === 'fob');
    if (!fob) {
      this.message('Ziel: eigene FOB anklicken');
      return;
    }
    if (fob.id === this.routeFromId) {
      this.message('Start und Ziel sind gleich');
      return;
    }
    const cmd = this.routeFromWork != null ? { type: 'route', ids, fromWork: this.routeFromWork, toId: fob.id } : { type: 'route', ids, fromId: this.routeFromId, toId: fob.id };
    if (this.issue(cmd).ok) this.setMode('normal');
  },

  /** Eigenes fertiges Werk mit Ausgangslager (CITY.pickup) unter dem Weltpunkt oder null (seit v5.69). */
  pickWork(wx, wy) {
    const e = this.pickCity(wx, wy);
    return e && ownWork(this.game, this.team, e.cityCell) ? e : null;
  },

  /** Eigener fertiger Stellplatz an (wx, y) oder null. */
  pickStand(wx, wy) {
    const e = this.pickCity(wx, wy);
    return e && isStand(this.game, e) ? e : null;
  },

  /** Eigener fertiger Heliport an (wx, wy) oder null (seit v5.51). */
  pickHeliport(wx, wy) {
    const e = this.pickCity(wx, wy);
    return e && isHeliport(this.game, e) ? e : null;
  },

  /** Landen (L): gewählte Flugzeuge landen am angeklickten Stellplatz, Hubschrauber am angeklickten Heliport (seit v5.51). */
  confirmLand(wx, wy) {
    const air = this.selectedUnits().filter((u) => u.def.air);
    if (!air.length) {
      this.message('Kein Flugzeug und kein Hubschrauber gewählt');
      this.setMode('normal');
      return;
    }
    const hp = this.pickHeliport(wx, wy);
    const ap = hp ? null : this.pickStand(wx, wy);
    const ids = air.filter((u) => (hp ? !u.def.jet : u.def.jet)).map((u) => u.id);
    if ((!hp && !ap) || !ids.length) {
      this.message(hp ? 'Kein Hubschrauber gewählt' : ap ? 'Kein Flugzeug gewählt' : 'Eigenen Stellplatz (Flugzeuge) oder Heliport (Hubschrauber) anklicken');
      return;
    }
    if (hp) {
      if (this.issue({ type: 'land', ids, airportId: hp.id }).ok) {
        this.moveMarker(hp.x, hp.y);
        this.setMode('normal');
      }
      return;
    }
    if (this.issue({ type: 'land', ids, airportId: ap.id }).ok) {
      this.moveMarker(ap.x, ap.y);
      this.setMode('normal');
    }
  },

  /** Baggern (G): gewählte Bagger räumen die angeklickte Stadtzelle (Shift: weitere Zellen anhängen). */
  confirmDig(wx, wy, shift) {
    const ids = this.selectedUnits().filter((u) => u.def.digger).map((u) => u.id);
    if (!ids.length) {
      this.message('Kein Bagger gewählt');
      this.setMode('normal');
      return;
    }
    const S = CITY.cell;
    const c = Math.floor(wx / S);
    const r = Math.floor(wy / S);
    if (!this.issue({ type: 'dig', ids, c0: c, r0: r, c1: c, r1: r, append: shift }).ok) return;
    this.moveMarker((c + 0.5) * S, (r + 0.5) * S);
    if (!shift) this.setMode('normal');
  },

  /** Straße beschießen (E) bzw. Schutt räumen (R, Paket „Straßen“): Befehl auf die angeklickte Stadtzelle (Shift: Modus bleibt). */
  confirmCellOrder(type, wx, wy, shift) {
    const ids = this.selectedUnits().map((u) => u.id);
    const S = CITY.cell;
    const c = Math.floor(wx / S);
    const r = Math.floor(wy / S);
    if (!this.issue({ type, ids, c0: c, r0: r, c1: c, r1: r }).ok) return;
    this.moveMarker((c + 0.5) * S, (r + 0.5) * S);
    if (!shift) this.setMode('normal');
  },

  confirmShellRoad(wx, wy, shift) {
    this.confirmCellOrder('shellRoad', wx, wy, shift);
  },

  confirmClearRubble(wx, wy, shift) {
    this.confirmCellOrder('clearRubble', wx, wy, shift);
  },

  /** Mörser-Ziel: Klick auf die Karte, alle gewählten Mörser in Reichweite feuern dorthin. */
  confirmMortarTarget(wx, wy) {
    const ids = this.selected().filter((e) => (e.kind === 'building' && e.def.weapon && e.def.weapon.shell) || (e.kind === 'unit' && e.def.indirect)).map((e) => e.id);
    if (!ids.length) {
      this.message('Kein Mörser und keine Artillerie gewählt');
      this.setMode('normal');
      return;
    }
    if (this.issue({ type: 'mortarTarget', ids, x: wx, y: wy }).ok) {
      this.moveMarker(wx, wy);
      this.setMode('normal');
    }
  },

  /** Luftschlag (Paket „Luftschlag“): sichtbares feindliches Ziel unter dem Punkt angreifen, sonst Angriffsmarsch dorthin (js/game/airstrike.js). */
  confirmAirstrike(wx, wy) {
    const foe = (e) => e.team !== this.team && this.game.sees(this.team, e);
    const city = cityEntityAt(this.game, wx, wy);
    const target = (city && foe(city) ? city : null) ?? this.pick(wx, wy, foe);
    const r = this.issue({ type: 'airstrike', x: wx, y: wy, targetId: target?.id ?? null });
    if (r.ok) this.moveMarker(target?.x ?? wx, target?.y ?? wy);
    this.setMode('normal');
  },

  /** Brücke legen (E14): gewählte Brückenleger legen auf der angetippten Flusszelle eine Behelfsbrücke (js/game/river.js). */
  confirmLayBridge(wx, wy) {
    const ids = this.selectedUnits().filter((u) => u.def.bridgelayer).map((u) => u.id);
    if (!ids.length) {
      this.message('Kein Brückenleger gewählt');
      this.setMode('normal');
      return;
    }
    const S = CITY.cell;
    const c = Math.floor(wx / S);
    const r = Math.floor(wy / S);
    const r2 = this.issue({ type: 'layBridge', ids, c, r });
    if (r2.ok) {
      this.moveMarker((c + 0.5) * S, (r + 0.5) * S);
      this.setMode('normal');
    } else this.message(r2.reason);
  },

  /** Mine legen: gewählte Pioniere legen an der angetippten Stelle eine getarnte Panzermine (js/game/mines.js). */
  confirmLayMine(wx, wy) {
    const ids = this.selected().filter((e) => e.kind === 'unit' && e.type === 'sapper').map((e) => e.id);
    if (!ids.length) {
      this.message('Kein Pionier gewählt');
      this.setMode('normal');
      return;
    }
    const r = this.issue({ type: 'layMine', ids, x: wx, y: wy });
    if (r.ok) {
      this.moveMarker(wx, wy);
      this.setMode('normal');
    } else this.message(r.reason);
  },

  /** Stürmen: gewählte Soldaten greifen das angetippte, vom Gegner besetzte Haus an der Wand an (Nahkampf, dann einziehen). */
  confirmStorm(wx, wy) {
    const house = this.pickHouse(wx, wy);
    const inf = this.selectedUnits().filter(canGarrison);
    if (!house || house.team < 0 || house.team === this.team) {
      this.message('Kein gegnerisch besetztes Haus angetippt');
      return;
    }
    if (!inf.length) {
      this.message('Nur Infanterie stürmt Gebäude');
      this.setMode('normal');
      return;
    }
    if (this.issue({ type: 'storm', ids: inf.map((u) => u.id), houseId: house.id }).ok) {
      this.moveMarker(house.x, house.y);
      this.setMode('normal');
    }
  },

  /** Einsteigen: gewählte Soldaten gehen zum angetippten eigenen Transportfahrzeug oder in ein Stadthaus (Touch-Weg, sonst Rechtsklick). */
  confirmBoard(wx, wy) {
    const veh = this.pick(wx, wy, (e) => e.kind === 'unit' && e.team === this.team && e.def.seats > 0);
    if (!veh) {
      const house = this.pickHouse(wx, wy);
      if (!house) {
        this.message('Kein Transportfahrzeug oder Gebäude angetippt');
        return;
      }
      if (!canEnter(house, this.team)) {
        this.message('Gebäude ist vom Gegner besetzt');
        return;
      }
      const inf = this.selectedUnits().filter(canGarrison);
      if (!inf.length) {
        this.message('Nur Infanterie besetzt Gebäude');
        this.setMode('normal');
        return;
      }
      if (this.issue({ type: 'garrison', ids: inf.map((u) => u.id), houseId: house.id }).ok) {
        this.moveMarker(house.x, house.y);
        this.setMode('normal');
      }
      return;
    }
    const riders = this.selectedUnits().filter((u) => u !== veh && canSeat(veh, u));
    if (!riders.length) {
      this.message(veh.def.air ? 'Nur Infanterie und Baufahrzeuge steigen ein' : 'Nur Infanterie steigt hier ein');
      this.setMode('normal');
      return;
    }
    if (this.issue({ type: 'board', ids: riders.map((u) => u.id), heliId: veh.id }).ok) this.setMode('normal');
  },

  /** Absetzen: Transportfahrzeug fliegt/fährt zum Klickpunkt und setzt Passagiere ab. */
  /** Fallschirm absetzen: die gewählte C-130 mit Passagieren fliegt zum Klickpunkt (js/game/paradrop.js). */
  confirmParadrop(wx, wy) {
    const ids = this.selectedUnits().filter((e) => e.type === 'c130').map((e) => e.id);
    if (!ids.length) {
      this.message('Kein Transportflugzeug gewählt');
      this.setMode('normal');
      return;
    }
    if (this.issue({ type: 'paradrop', ids, x: wx, y: wy }).ok) {
      this.moveMarker(wx, wy);
      this.setMode('normal');
    } else this.message('Kein Transportflugzeug mit Passagieren oder keines in der Luft');
  },

  confirmDropoff(wx, wy) {
    const ids = this.selectedUnits().filter((e) => e.def.seats > 0).map((e) => e.id);
    if (!ids.length) {
      this.message('Kein Transporthubschrauber gewählt');
      this.setMode('normal');
      return;
    }
    if (this.issue({ type: 'dropoff', ids, x: wx, y: wy }).ok) {
      this.moveMarker(wx, wy);
      this.setMode('normal');
    }
  },

  // ---- Platzierung und Mauerzug -------------------------------------------------

  beginPlacement(type) {
    if (!BUILDINGS[type]) return;
    this.setMode(type === 'wall' ? 'wall' : 'place');
    this.placeType = type;
    if (this.pointer) this.updatePointer(this.pointer.x, this.pointer.y);
  },

  /** Maus gedrückt im Modus wall: Startpunkt setzen. */
  beginWall(wx, wy) {
    if (this.view.mode !== 'wall') return;
    const g = this.game.grid;
    this.wall = { c: g.toCell(wx), r: g.toCell(wy) };
    this.updatePointer(wx, wy);
  },

  /** Maus losgelassen im Modus wall: Mauerzug bauen (die gewählten Bauer gehen mit). */
  endWall(wx, wy, shift) {
    if (this.view.mode !== 'wall') return;
    const g = this.game.grid;
    const start = this.wall || { c: g.toCell(wx), r: g.toCell(wy) };
    const cells = wallLine(start, { c: g.toCell(wx), r: g.toCell(wy) });
    const end = cells[cells.length - 1];
    this.wall = null;
    const r = this.issue({
      type: 'buildWall',
      building: 'wall',
      ids: this.builderIds('wall'),
      x1: g.center(start.c),
      y1: g.center(start.r),
      x2: g.center(end.c),
      y2: g.center(end.r),
    });
    if (r.ok && !shift) this.setMode('normal');
    else if (this.pointer) this.updatePointer(this.pointer.x, this.pointer.y);
  },

  /** Feldstellung wählen (Baumenü): Zielmodus „field“ mit der Art (PROPS.field.kinds). */
  beginFieldwork(kind) {
    this.fieldKind = kind;
    this.setMode('field');
  },

  /** Bauer der Auswahl für die gewählte Feldstellung. */
  fieldBuilders() {
    return this.selectedUnits().filter((u) => canFieldwork(u.def, this.fieldKind));
  },

  /** Geplantes Prop der Feldstellung an (wx, wy): Kacheln auf die Zellmitte, Einzelstück quer zur Richtung Bauer → Klick. */
  fieldPlan(wx, wy) {
    const g = this.game.grid;
    const K = PROPS.kinds[this.fieldKind];
    if (K?.line) return { kind: this.fieldKind, x: g.center(g.toCell(wx)), y: g.center(g.toCell(wy)), rot: 0 };
    const us = this.fieldBuilders();
    const cx = us.length ? us.reduce((a, u) => a + u.x, 0) / us.length : wx;
    const cy = us.length ? us.reduce((a, u) => a + u.y, 0) / us.length : wy - 1;
    return { kind: this.fieldKind, x: wx, y: wy, rot: rotAcross(Math.atan2(wy - cy, wx - cx)) };
  },

  /** Vorschau der Feldstellung: Zellen des Props, grün oder rot mit Grund. */
  fieldPreview(wx, wy) {
    const p = this.fieldPlan(wx, wy);
    const g = this.game.grid;
    const reason = this.fieldBuilders().length ? fieldSpotWhy(this.game, this.team, p) : 'Kein passender Bauer gewählt';
    const cells = propCells(p, g.cols, g.rows).map((i) => ({ cx: i % g.cols, cy: Math.floor(i / g.cols), ok: !reason }));
    return { type: 'field', x: p.x, y: p.y, ok: !reason, reason, cells };
  },

  /** Feldstellung bauen (Befehl fieldwork); Shift hält den Modus für weitere Stücke. */
  confirmFieldwork(wx, wy, shift) {
    const p = this.fieldPlan(wx, wy);
    const r = this.issue({ type: 'fieldwork', ids: this.fieldBuilders().map((u) => u.id), kind: p.kind, x: p.x, y: p.y, rot: p.rot });
    if (!r.ok) return;
    this.moveMarker(p.x, p.y);
    if (shift) this.updatePointer(wx, wy);
    else this.setMode('normal');
  },

  placementFor(type, wx, wy) {
    if (type === 'gate') {
      // Tor: zwei Felder nebeneinander (Richtung nach den Nachbarmauern), Vorschau zeigt beide
      const q = this.game.gatePreview(this.team, wx, wy, { carried: this.carriedFor(type) });
      return { type, x: wx, y: wy, ok: q.ok, reason: q.reason, payer: null, cells: q.cells };
    }
    const p = this.game.canPlace(this.team, type, wx, wy, { carried: this.carriedFor(type) });
    return {
      type,
      x: Number.isFinite(p.x) ? p.x : wx,
      y: Number.isFinite(p.y) ? p.y : wy,
      ok: p.ok,
      reason: p.ok ? null : p.reason,
      payer: p.payer || null, // { kind: 'fob'|'truck', id } – wer bezahlt (Vorschau)
    };
  },

  wallPreview(wx, wy) {
    const g = this.game.grid;
    const cur = { c: g.toCell(wx), r: g.toCell(wy) };
    const cells = this.wall ? wallLine(this.wall, cur) : [cur];
    const cost = BUILDINGS.wall.cost;
    const carried = this.carriedFor('wall');
    const affordable = this.game.canAfford(this.team, cost);
    const short = this.moneyReason(cost);
    const list = cells.map(({ c, r }) => {
      const p = this.game.canPlace(this.team, 'wall', g.center(c), g.center(r), { carried });
      return { cx: c, cy: r, ok: p.ok && affordable, reason: p.ok ? null : p.reason, payer: p.payer || null };
    });
    const ok = list.some((x) => x.ok);
    const firstReason = list.find((x) => x.reason)?.reason || null;
    const reason = ok ? null : affordable ? firstReason : short;
    return { type: 'wall', x: wx, y: wy, ok, reason, cells: list };
  },
};
