// Map-Upload: Bild wählen, anzeigen, lokal speichern (IndexedDB), ersetzen, entfernen, Vollbild.
// Das Bild verlässt das Gerät nie. Alle Fehler werden als verständliche Meldung angezeigt.
import {
  isSupportedImage, fitSize, formatBytes, nextZoom,
  MAP_MAX_EDGE, MAP_KEEP_BYTES, MAP_MAX_FILE_BYTES,
} from './logic.js';
import { t, getLocale, onLanguageChange } from './i18n.js';

const DB_NAME = 'fnc-map';
const STORE = 'files';
const KEY = 'current';

// ---------- IndexedDB ----------
function openDb() {
  return new Promise((resolve, reject) => {
    let req;
    try {
      if (!window.indexedDB) throw new Error('IndexedDB nicht verfügbar');
      req = window.indexedDB.open(DB_NAME, 1);
    } catch (err) {
      reject(err);
      return;
    }
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB-Fehler'));
    req.onblocked = () => reject(new Error('IndexedDB blockiert'));
  });
}

async function withStore(mode, fn) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      let result;
      const request = fn(tx.objectStore(STORE));
      if (request) request.onsuccess = () => { result = request.result; };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error || new Error('Speicherfehler'));
      tx.onabort = () => reject(tx.error || new Error('Speichern abgebrochen'));
    });
  } finally {
    db.close();
  }
}

const loadStored = () => withStore('readonly', (s) => s.get(KEY));
const saveStored = (record) => withStore('readwrite', (s) => s.put(record, KEY));
const clearStored = () => withStore('readwrite', (s) => s.delete(KEY));

// ---------- Bild verarbeiten ----------
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('decode'));
    img.src = url;
  });
}
const canvasToBlob = (canvas, type, quality) =>
  new Promise((resolve) => {
    try {
      canvas.toBlob((b) => resolve(b), type, quality);
    } catch {
      resolve(null);
    }
  });

/** Liefert { blob, w, h, resized }. Große Bilder werden proportional verkleinert. */
async function processImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    if (!nw || !nh) throw new Error('decode');
    const fit = fitSize(nw, nh, MAP_MAX_EDGE);
    if (fit.scale === 1 && file.size <= MAP_KEEP_BYTES) {
      return { blob: file, w: nw, h: nh, resized: false };
    }
    const canvas = document.createElement('canvas');
    canvas.width = fit.w;
    canvas.height = fit.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, fit.w, fit.h);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, fit.w, fit.h);
    let blob = await canvasToBlob(canvas, 'image/webp', 0.9);
    if (!blob || blob.type !== 'image/webp') blob = await canvasToBlob(canvas, 'image/jpeg', 0.9);
    if (!blob) throw new Error('encode');
    // Ohne Verkleinerung nur ersetzen, wenn die neue Datei wirklich kleiner ist
    if (fit.scale === 1 && blob.size >= file.size) return { blob: file, w: nw, h: nh, resized: false };
    return { blob, w: fit.w, h: fit.h, resized: true };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---------- Oberfläche ----------
export function initMap() {
  const el = (id) => document.getElementById(id);
  const ui = {
    input: el('map-input'),
    empty: el('map-empty'),
    view: el('map-view'),
    img: el('map-img'),
    chips: el('map-chips'),
    note: el('map-note'),
    status: el('map-status'),
    upload: el('map-upload'),
    replace: el('map-replace'),
    remove: el('map-remove'),
    full: el('map-fullscreen'),
    viewer: el('map-viewer'),
    viewerImg: el('viewer-img'),
    viewerScroll: el('viewer-scroll'),
    viewerClose: el('viewer-close'),
    zoomIn: el('zoom-in'),
    zoomOut: el('zoom-out'),
    zoomLevel: el('zoom-level'),
  };

  let currentUrl = null;
  let seq = 0; // verwirft Ergebnisse veralteter Ladevorgänge
  let zoom = 1;
  let lastFocus = null;

  // Statusmeldungen merken Schlüssel und Parameter, damit sie beim Sprachwechsel neu übersetzt werden.
  // params darf eine Funktion sein, die erst beim Anzeigen ausgewertet wird (Zahlenformat der aktuellen Sprache).
  let lastStatus = null;
  let shown = null; // { w, h, size, stored } des aktuell angezeigten Bildes

  function renderStatus() {
    if (!lastStatus) {
      ui.status.dataset.kind = '';
      ui.status.textContent = '';
      return;
    }
    const params = typeof lastStatus.params === 'function' ? lastStatus.params() : lastStatus.params;
    ui.status.dataset.kind = lastStatus.kind;
    ui.status.textContent = t(lastStatus.key, params);
  }
  const say = (key, kind = 'ok', params) => {
    lastStatus = { key, kind, params };
    renderStatus();
  };

  function chip(text, cls = '') {
    const li = document.createElement('li');
    li.className = `chip ${cls}`.trim();
    li.textContent = text;
    return li;
  }

  function showImage(blob, meta, { stored }) {
    if (currentUrl) URL.revokeObjectURL(currentUrl);
    currentUrl = URL.createObjectURL(blob);
    ui.img.onerror = () => {
      clearUi();
      say('map.say.displayFail', 'error');
    };
    ui.img.width = meta.w;
    ui.img.height = meta.h;
    ui.img.src = currentUrl;
    shown = { w: meta.w, h: meta.h, size: blob.size, stored };
    renderInfo();
    ui.empty.hidden = true;
    ui.view.hidden = false;
  }

  function renderInfo() {
    if (!shown) return;
    ui.chips.replaceChildren(
      chip(`${shown.w} × ${shown.h}`, 'chip-blue'),
      chip(formatBytes(shown.size, getLocale())),
      shown.stored ? chip(t('map.chipStored'), 'chip-green') : chip(t('map.chipNotStored'), 'chip-warn'),
    );
    ui.note.textContent = t(shown.stored ? 'map.noteStored' : 'map.noteNotStored');
  }

  function clearUi() {
    closeViewer();
    if (currentUrl) URL.revokeObjectURL(currentUrl);
    currentUrl = null;
    ui.img.removeAttribute('src');
    shown = null;
    ui.chips.replaceChildren();
    ui.view.hidden = true;
    ui.empty.hidden = false;
  }

  async function handleFile(file) {
    if (!file) return;
    const token = ++seq;
    if (!isSupportedImage(file)) {
      say('map.say.unsupported', 'error');
      return;
    }
    if (file.size > MAP_MAX_FILE_BYTES) {
      say('map.say.tooLarge', 'error', () => ({ size: formatBytes(file.size, getLocale()), max: formatBytes(MAP_MAX_FILE_BYTES, getLocale()) }));
      return;
    }
    say('map.say.loading', 'info');
    let result;
    try {
      result = await processImage(file);
    } catch {
      if (token === seq) say('map.say.loadFail', 'error');
      return;
    }
    if (token !== seq) return;

    const record = { blob: result.blob, w: result.w, h: result.h, name: file.name || 'map', ts: Date.now() };
    let stored = true;
    try {
      await saveStored(record);
    } catch {
      stored = false;
    }
    if (token !== seq) return;

    showImage(result.blob, result, { stored });
    if (stored) {
      say(result.resized ? 'map.say.savedResized' : 'map.say.saved');
    } else {
      say('map.say.saveFail', 'warn');
    }
  }

  async function removeMap() {
    seq++;
    clearUi();
    try {
      await clearStored();
      say('map.say.removed');
    } catch {
      say('map.say.removeFail', 'warn');
    }
  }

  // Auswahl
  const pick = () => ui.input.click();
  ui.upload.addEventListener('click', pick);
  ui.replace.addEventListener('click', pick);
  ui.remove.addEventListener('click', removeMap);
  ui.input.addEventListener('change', () => {
    const file = ui.input.files && ui.input.files[0];
    ui.input.value = ''; // dieselbe Datei kann erneut gewählt werden
    handleFile(file);
  });

  // Ziehen und Ablegen (Desktop, iPad mit Maus oder Split View)
  const card = ui.empty.closest('.card');
  ['dragenter', 'dragover'].forEach((type) =>
    card.addEventListener(type, (e) => {
      if (!e.dataTransfer || ![...e.dataTransfer.types].includes('Files')) return;
      e.preventDefault();
      ui.empty.classList.add('is-drag');
    })
  );
  ['dragleave', 'drop'].forEach((type) =>
    card.addEventListener(type, () => ui.empty.classList.remove('is-drag'))
  );
  card.addEventListener('drop', (e) => {
    if (!e.dataTransfer || !e.dataTransfer.files.length) return;
    e.preventDefault();
    handleFile(e.dataTransfer.files[0]);
  });

  // Vollbild mit Zoom
  function applyZoom() {
    const img = ui.viewerImg;
    if (zoom === 1) {
      img.classList.remove('zoomed');
      img.style.width = '';
    } else {
      img.classList.add('zoomed');
      img.style.width = `${zoom * 100}%`;
    }
    ui.zoomLevel.textContent = new Intl.NumberFormat(getLocale(), { style: 'percent', maximumFractionDigits: 0 }).format(zoom);
    ui.zoomOut.disabled = zoom === 1;
    ui.zoomIn.disabled = zoom === 4;
  }
  function openViewer() {
    if (!currentUrl) return;
    lastFocus = document.activeElement;
    ui.viewerImg.src = currentUrl;
    zoom = 1;
    applyZoom();
    ui.viewer.hidden = false;
    document.body.classList.add('viewer-open');
    ui.viewerClose.focus();
  }
  function closeViewer() {
    if (ui.viewer.hidden) return;
    ui.viewer.hidden = true;
    document.body.classList.remove('viewer-open');
    ui.viewerImg.removeAttribute('src');
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  }
  ui.full.addEventListener('click', openViewer);
  ui.viewerClose.addEventListener('click', closeViewer);
  ui.zoomIn.addEventListener('click', () => { zoom = nextZoom(zoom, 1); applyZoom(); });
  ui.zoomOut.addEventListener('click', () => { zoom = nextZoom(zoom, -1); applyZoom(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !ui.viewer.hidden) closeViewer();
  });

  onLanguageChange(() => {
    renderInfo();
    renderStatus();
    applyZoom();
  });

  // Gespeicherte Map beim Start laden. Ein Fehler hier lässt einfach den Leerzustand stehen.
  (async () => {
    const token = seq;
    try {
      const record = await loadStored();
      if (token !== seq || !record || !record.blob) return;
      showImage(record.blob, { w: record.w, h: record.h }, { stored: true });
    } catch {
      /* Leerzustand bleibt */
    }
  })();
}
