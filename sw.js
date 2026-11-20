// Frontline Service Worker: network-first (immer die neueste Version), Cache nur als Offline-Fallback.
// Bei Änderungen an Dateien CACHE_VERSION erhöhen, damit Clients die neue Version laden.
const CACHE_VERSION = 'frontline-v299';
const CACHE_PREFIX = 'frontline-';
const CACHE_NAME = CACHE_VERSION;

const ASSETS = [
  './',
  './index.html',
  './editor.html',
  './manifest.json',
  './css/style.css',
  './css/editor.css',
  './js/editor/editor.js',
  './js/game/mapdata.js',
  './js/game/props.js',
  './js/game/propfire.js',
  './js/game/fieldwork.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/version.js',
  './js/main.js',
  './js/audio/sound.js',
  './js/audio/music.js',
  './js/core/loop.js',
  './js/core/rng.js',
  './js/core/snapshot.js',
  './js/game/savegame.js',
  './js/ui/saves.js',
  './js/ui/match.js',
  './js/ui/stats.js',
  './js/data/balance.js',
  './js/data/units.js',
  './js/data/buildings.js',
  './js/data/ai.js',
  './js/data/mapgen.js',
  './js/data/props.js',
  './js/data/maps/index.js',
  './js/data/maps/east-europe-railway.js',
  './js/game/map.js',
  './js/game/relief.js',
  './js/game/landscape.js',
  './js/game/grid.js',
  './js/game/pathfinding.js',
  './js/game/pathplan.js',
  './js/game/entities.js',
  './js/game/game.js',
  './js/game/commands.js',
  './js/game/cmd/units.js',
  './js/game/cmd/build.js',
  './js/game/cmd/train.js',
  './js/game/economy.js',
  './js/game/movement.js',
  './js/game/combat.js',
  './js/game/logistics.js',
  './js/game/construction.js',
  './js/game/garrison.js',
  './js/game/tower.js',
  './js/game/crates.js',
  './js/game/scars.js',
  './js/game/animals.js',
  './js/game/formation.js',
  './js/game/commander.js',
  './js/game/medic.js',
  './js/game/recovery.js',
  './js/game/fpv.js',
  './js/game/mines.js',
  './js/game/paradrop.js',
  './js/game/city/cells.js',
  './js/game/city/query.js',
  './js/game/city/state.js',
  './js/game/city/care.js',
  './js/game/city/gridbfs.js',
  './js/game/city/roadnet.js',
  './js/game/city/clearing.js',
  './js/game/city/create.js',
  './js/game/city/commands.js',
  './js/game/city/economy.js',
  './js/data/city.js',
  './js/data/citykinds.js',
  './js/data/goods.js',
  './js/data/research.js',
  './js/ui/citypanel.js',
  './js/ui/researchpanel.js',
  './js/ui/flowpanel.js',
  './js/render/citylayer.js',
  './js/render/color.js',
  './js/game/weather.js',
  './js/game/research.js',
  './js/game/flow.js',
  './js/game/transport.js',
  './js/game/abilities.js',
  './js/game/river.js',
  './js/game/roads.js',
  './js/game/aircraft.js',
  './js/game/excavator.js',
  './js/game/roadwar.js',
  './js/game/helipad.js',
  './js/game/scramble.js',
  './js/game/ledger.js',
  './js/game/airstrike.js',
  './js/game/zone.js',
  './js/game/conquest.js',
  './js/game/modes.js',
  './js/game/zonegeo.js',
  './js/game/teams.js',
  './js/game/hotzone.js',
  './js/game/fog.js',
  './js/ai/ai.js',
  './js/ai/army/build.js',
  './js/ai/army/combat.js',
  './js/ai/army/conquest.js',
  './js/ai/army/cover.js',
  './js/ai/army/logistics.js',
  './js/ai/army/produce.js',
  './js/ai/army/util.js',
  './js/ai/cityai.js',
  './js/ai/city/common.js',
  './js/ai/city/need.js',
  './js/ai/city/build.js',
  './js/ai/city/grow.js',
  './js/ai/city/station.js',
  './js/ai/city/warehouse.js',
  './js/ai/city/park.js',
  './js/ai/city/roads.js',
  './js/ai/city/airbase.js',
  './js/ai/city/market.js',
  './js/ai/city/raid.js',
  './js/ai/cooldown.js',
  './js/render/camera.js',
  './js/render/iso.js',
  './js/render/isobuild.js',
  './js/render/university.js',
  './js/render/works.js',
  './js/render/townhouses.js',
  './js/render/spritecache.js',
  './js/render/unitpaint.js',
  './js/render/units/shapes.js',
  './js/render/units/painter.js',
  './js/render/units/armor.js',
  './js/render/units/heavy.js',
  './js/render/units/wheeled.js',
  './js/render/units/rotor.js',
  './js/render/units/airparts.js',
  './js/render/units/jets.js',
  './js/render/units/f22.js',
  './js/render/units/u2.js',
  './js/render/units/planes.js',
  './js/render/units/soldier.js',
  './js/render/nature.js',
  './js/render/ways.js',
  './js/render/fields.js',
  './js/render/citysite.js',
  './js/render/stronghold.js',
  './js/render/marks.js',
  './js/render/fx.js',
  './js/render/isokit.js',
  './js/render/milbuild.js',
  './js/render/airbase.js',
  './js/render/maptown.js',
  './js/render/paving.js',
  './js/render/landmarks.js',
  './js/render/mappreview.js',
  './js/render/props.js',
  './js/render/mapprops.js',
  './js/render/fences.js',
  './js/render/milprops.js',
  './js/render/indprops.js',
  './js/render/civprops.js',
  './js/render/bigbuild.js',
  './js/render/cityhall.js',
  './js/render/govquarter.js',
  './js/render/terrain.js',
  './js/render/ground.js',
  './js/render/reliefimg.js',
  './js/render/sprites.js',
  './js/render/renderer.js',
  './js/render/layers/core.js',
  './js/render/layers/consts.js',
  './js/render/layers/fog.js',
  './js/render/layers/top.js',
  './js/render/layers/passes.js',
  './js/render/layers/relief.js',
  './js/render/layers/isoview.js',
  './js/render/layers/isoitems.js',
  './js/render/layers/world.js',
  './js/render/layers/zones.js',
  './js/render/layers/radii.js',
  './js/render/layers/garrison.js',
  './js/render/layers/overlays.js',
  './js/render/isosprites.js',
  './js/render/season.js',
  './js/render/weatherfx.js',
  './js/render/mood.js',
  './js/render/bridge.js',
  './js/render/minimap.js',
  './js/ui/controller.js',
  './js/ui/controller/cards.js',
  './js/ui/controller/modes.js',
  './js/ui/controller/targets.js',
  './js/ui/controller/util.js',
  './js/ui/input.js',
  './js/ui/perfmeter.js',
  './js/ui/hud.js',
  './js/ui/hud/common.js',
  './js/ui/hud/core.js',
  './js/ui/hud/top.js',
  './js/ui/hud/info.js',
  './js/ui/hud/cityinfo.js',
  './js/ui/hud/commands.js',
  './js/ui/hud/messages.js',
  './js/ui/menu.js',
  './js/ui/menu/common.js',
  './js/ui/menu/prefs.js',
  './js/ui/menu/account-html.js',
  './js/ui/menu/account-flow.js',
  './js/ui/menu/account.js',
  './js/ui/menu/start-html.js',
  './js/ui/menu/start-state.js',
  './js/ui/menu/start-saves.js',
  './js/ui/menu/start-account.js',
  './js/ui/menu/start-maps.js',
  './js/ui/menu/start.js',
  './js/ui/menu/pause.js',
  './js/ui/menu/help.js',
  './js/ui/menu/end.js',
  './js/ui/helptext.js',
  './js/ui/status.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Einzelne Fehler (z. B. fehlende Datei) brechen die Installation nicht ab.
    // cache: 'reload' umgeht den HTTP-Cache des Browsers, sonst landen veraltete Dateien im neuen Cache.
    await Promise.allSettled(ASSETS.map((url) => cache.add(new Request(url, { cache: 'reload' }))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    // Nur eigene Caches löschen (Präfix), die Offline-Daten der anderen Spiele bleiben.
    await Promise.all(
      keys
        .filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME)
        .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const res = await fetch(req, { cache: 'no-cache' });
      if (res && res.ok && res.type === 'basic') {
        // Ohne Query-String ablegen, damit ?debug=1 keine eigenen Cache-Einträge erzeugt.
        const key = new URL(req.url);
        key.search = '';
        cache.put(key.href, res.clone()).catch(() => {});
      }
      return res;
    } catch {
      // Offline: aus dem Cache, Navigation fällt auf die Spiel-Shell zurück.
      const cached = await cache.match(req, { ignoreSearch: true });
      if (cached) return cached;
      if (req.mode === 'navigate') {
        const shell = await cache.match('./index.html', { ignoreSearch: true });
        if (shell) return shell;
      }
      return Response.error();
    }
  })());
});
