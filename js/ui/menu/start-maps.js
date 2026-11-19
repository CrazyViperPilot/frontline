// Startmenü: Kartenwahl (Zufall, feste Karte mit Vorschau, gespeicherte Karte, Import, Editor). renderMapBox zeichnet den Bereich unter „Karte“, mapChange ist
// der change-Handler (Auswahl und Import), mapClick behandelt die Knöpfe des Bereichs. Die gewählte Karte steht in s.mapSel.
// Exporte: renderMapBox, mapChange, mapClick.
import { listMaps, deleteMap, saveMap, normalizeMap, describeMap, listFixedMaps, isFixedMap, loadMap } from '../../game/mapdata.js';
import { drawMapPreview } from '../../render/mappreview.js';
import { esc } from './common.js';
import { writeMapSel } from './prefs.js';

/** Bereich unter „Karte“ neu zeichnen (Zufall: Hinweis, gespeichert: Auswahl, Bearbeiten, Löschen, Import). */
export function renderMapBox(root, s) {
  const box = root.querySelector('[data-mapbox]');
  const saved = listMaps();
  if (s.mapSel !== 'random' && !isFixedMap(s.mapSel) && !saved.some((m) => m.id === s.mapSel)) s.mapSel = 'random';
  root.querySelectorAll('[data-mapmode]').forEach((b) => {
    const m = b.dataset.mapmode;
    const on = m === 'fixed' ? isFixedMap(s.mapSel) : m === 'saved' ? s.mapSel !== 'random' && !isFixedMap(s.mapSel) : m === 'random' && s.mapSel === 'random';
    b.setAttribute('aria-pressed', String(on));
  });
  if (isFixedMap(s.mapSel)) {
    renderFixed(box, s);
    return;
  }
  if (s.mapSel === 'random') {
    box.innerHTML = '<p class="muted small">Bei jedem Start wird eine neue Karte erzeugt. <button type="button" class="btn-sm" data-act="editRandom">im Editor öffnen</button></p>';
  } else {
    box.innerHTML = '';
  }
  if (s.mapSel !== 'random' || root.dataset.showSaved === '1') {
    const opts = saved
      .map((m) => {
        const d = describeMap(m.map);
        return `<option value="${esc(m.id)}"${m.id === s.mapSel ? ' selected' : ''}>${esc(m.name)} (${d.buildings} Gebäude, ${d.trees} Bäume)</option>`;
      })
      .join('');
    box.innerHTML = saved.length
      ? `<select data-mapsel>${opts}</select>
           <div class="maprow"><button type="button" class="btn-sm" data-act="mapEdit">Bearbeiten</button>
           <button type="button" class="btn-sm" data-act="mapDelete">Löschen</button>
           <label class="btn-sm filebtn">Importieren<input type="file" accept=".json,application/json" data-mapimport hidden></label></div>`
      : `<p class="muted small">Noch keine Karte gespeichert. <label class="btn-sm filebtn">Importieren<input type="file" accept=".json,application/json" data-mapimport hidden></label></p>`;
  }
}

/** Feste Karte: Auswahl, Beschreibung, Vorschau (Flaggen, Startpunkte, Baugebiete), im Editor öffnen. */
function renderFixed(box, s) {
  const list = listFixedMaps();
  const cur = list.find((m) => m.id === s.mapSel) ?? list[0];
  const map = loadMap(cur.id);
  const opts = list.map((m) => `<option value="${esc(m.id)}"${m.id === cur.id ? ' selected' : ''}>${esc(m.name)}</option>`).join('');
  const players = map.spawns.length; // Eroberung: so viele Spieler höchstens
  box.innerHTML = `<select data-mapsel>${opts}</select>
    <p class="muted small">${esc(cur.info)} Startpunkte: ${players}; klassisch spielen die ersten beiden.</p>
    <canvas class="mappreview" width="320" height="320" aria-label="Vorschau der Karte ${esc(cur.name)}"></canvas>
    <div class="maprow"><button type="button" class="btn-sm" data-act="mapEdit">Im Editor öffnen</button></div>`;
  try {
    drawMapPreview(box.querySelector('canvas'), map);
  } catch {
    box.querySelector('canvas').remove(); // ohne Canvas (alte Browser) nur der Text
  }
}

/** change-Handler des Startmenüs: Kartenauswahl und Import einer Karten-Datei. */
export function mapChange(root, s) {
  return (e) => {
    if (e.target.matches('[data-mapsel]')) {
      s.mapSel = e.target.value;
      writeMapSel(s.mapSel);
      if (isFixedMap(s.mapSel)) renderMapBox(root, s); // Vorschau und Beschreibung der gewählten Karte
    } else if (e.target.matches('[data-mapimport]')) {
      const f = e.target.files?.[0];
      if (!f) return;
      f.text()
        .then((t) => {
          const m = normalizeMap(JSON.parse(t));
          const id = saveMap(m);
          if (!id) throw new Error('Speicher voll');
          s.mapSel = id;
          writeMapSel(id);
          renderMapBox(root, s);
        })
        .catch((err) => {
          const box = root.querySelector('[data-mapbox]');
          box.insertAdjacentHTML('beforeend', `<p class="bad small">Import fehlgeschlagen: ${esc(err.message)}</p>`);
        });
    }
  };
}

/** Knöpfe der Kartenwahl (Zufall, Gespeichert, Neue Karte, Editor, Bearbeiten, Löschen). Liefert true, wenn der Knopf einer davon war. */
export function mapClick(root, s, b) {
  if (b.dataset.mapmode === 'random') {
    s.mapSel = 'random';
    delete root.dataset.showSaved;
    writeMapSel(s.mapSel);
    renderMapBox(root, s);
    return true;
  }
  if (b.dataset.mapmode === 'fixed') {
    if (!isFixedMap(s.mapSel)) s.mapSel = listFixedMaps()[0].id;
    delete root.dataset.showSaved;
    writeMapSel(s.mapSel);
    renderMapBox(root, s);
    return true;
  }
  if (b.dataset.mapmode === 'saved') {
    const saved = listMaps();
    if ((s.mapSel === 'random' || isFixedMap(s.mapSel)) && saved.length) s.mapSel = saved[0].id;
    else if (isFixedMap(s.mapSel)) s.mapSel = 'random';
    else if (!saved.length) root.dataset.showSaved = '1';
    writeMapSel(s.mapSel);
    renderMapBox(root, s);
    return true;
  }
  if (b.dataset.mapmode === 'new') {
    location.href = 'editor.html?new=1';
    return true;
  }
  if (b.dataset.act === 'editRandom') {
    location.href = `editor.html?seed=${Math.floor(Math.random() * 1e9) + 1}${s.river ? '&river=1' : ''}`;
    return true;
  }
  if (b.dataset.act === 'mapEdit') {
    location.href = `editor.html?map=${encodeURIComponent(s.mapSel)}`;
    return true;
  }
  if (b.dataset.act === 'mapDelete') {
    if (!window.confirm('Diese Karte löschen?')) return true;
    deleteMap(s.mapSel);
    s.mapSel = 'random';
    writeMapSel(s.mapSel);
    renderMapBox(root, s);
    return true;
  }
  return false;
}
