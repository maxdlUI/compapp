import * as L from './logic.js';
import { initMap } from './map.js';

const $ = (id) => document.getElementById(id);

// ---------- Lokaler Speicher (mit Fehlerbehandlung) ----------
const KEYS = {
  storm: 'fnc.v1.storm',
  rotation: 'fnc.v1.rotation',
  net: 'fnc.v1.net',
  notes: 'fnc.v1.notes',
  draft: 'fnc.v1.draft',
  prefs: 'fnc.v1.prefs',
};

const store = {
  read(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? null : JSON.parse(raw);
    } catch {
      return null;
    }
  },
  write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  available() {
    try {
      localStorage.setItem('fnc.probe', '1');
      localStorage.removeItem('fnc.probe');
      return true;
    } catch {
      return false;
    }
  },
};

if (!store.available()) $('storage-warning').hidden = false;

// ---------- Zustand ----------
let storm = L.restoreStorm(store.read(KEYS.storm), Date.now());
let rotation = L.restoreRotation(store.read(KEYS.rotation), Date.now());
let prefs = { sound: true, ...(store.read(KEYS.prefs) || {}) };
let notes = L.restoreNotes(store.read(KEYS.notes));

// Ein Countdown, der abgelaufen ist, während die App geschlossen war, zeigt still "abgelaufen" (kein Ton).
rotation = L.rotationTick(rotation, Date.now()).state;

const saveStorm = () => store.write(KEYS.storm, storm);
const saveRotation = () => store.write(KEYS.rotation, rotation);
const savePrefs = () => store.write(KEYS.prefs, prefs);

// ---------- Audio und Haptik ----------
let audioCtx = null;
function unlockAudio() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audioCtx = audioCtx || new AC();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch {
    /* Ton ist optional */
  }
}
function beep() {
  if (!audioCtx || audioCtx.state === 'closed') return;
  try {
    const t0 = audioCtx.currentTime;
    for (let i = 0; i < 3; i++) {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      const t = t0 + i * 0.26;
      o.type = 'sine';
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.connect(g).connect(audioCtx.destination);
      o.start(t);
      o.stop(t + 0.22);
    }
  } catch {
    /* Die visuelle Meldung genügt */
  }
}
function vibrate() {
  try {
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]); // iOS Safari: nicht verfügbar
  } catch {
    /* ignorieren */
  }
}

// ---------- Hilfen für die Anzeige ----------
function setText(el, text) {
  if (el.textContent !== text) el.textContent = text;
}
function setButton(btn, icon, label) {
  btn.querySelector('use').setAttribute('href', `#i-${icon}`);
  setText(btn.querySelector('span'), label);
}
const fmt = (n) => n.toLocaleString('de-DE');

// ---------- Storm ----------
const STORM_STATUS = { idle: 'Bereit', running: 'Läuft', paused: 'Pausiert' };
const stormEls = {
  pill: $('storm-pill'),
  rate: $('storm-rate'),
  rateOut: $('storm-rate-out'),
  time: $('storm-time'),
  damage: $('storm-damage'),
  bar: $('storm-bar'),
  fill: $('storm-fill'),
  toggle: $('storm-toggle'),
  reset: $('storm-reset'),
  th: [
    { li: $('th-500'), text: $('th-500-text') },
    { li: $('th-600'), text: $('th-600-text') },
  ],
};
stormEls.rate.value = String(storm.rate);

function renderStorm(now = Date.now()) {
  const st = L.stormStats(storm, now);
  setText(stormEls.time, L.formatClock(st.elapsedSec));
  setText(stormEls.damage, fmt(st.damage));
  setText(stormEls.rateOut, String(st.rate));
  stormEls.fill.style.width = `${(st.progress * 100).toFixed(2)}%`;
  stormEls.bar.setAttribute('aria-valuenow', String(Math.min(600, st.damage)));
  stormEls.bar.setAttribute('aria-valuetext', `${st.damage} von 600 Schaden`);
  st.thresholds.forEach((t, i) => {
    const { li, text } = stormEls.th[i];
    li.dataset.reached = String(t.reached);
    setText(
      text,
      t.reached
        ? `Erreicht (${t.target} Schaden)`
        : `Noch ${fmt(t.remaining)} Schaden · ca. ${L.formatClock(t.secondsLeft)}`
    );
  });
  const label = storm.status === 'running' ? ['pause', 'Pause'] : storm.status === 'paused' ? ['play', 'Fortsetzen'] : ['play', 'Start'];
  setButton(stormEls.toggle, label[0], label[1]);
  setText(stormEls.pill, STORM_STATUS[storm.status]);
  if (stormEls.pill.dataset.state !== storm.status) stormEls.pill.dataset.state = storm.status;
}

stormEls.toggle.addEventListener('click', () => {
  const now = Date.now();
  storm = storm.status === 'running' ? L.stormPause(storm, now) : L.stormStart(storm, now);
  saveStorm();
  renderStorm(now);
});
stormEls.reset.addEventListener('click', () => {
  storm = L.stormReset(storm);
  saveStorm();
  renderStorm();
});
stormEls.rate.addEventListener('change', () => {
  const rate = Number(stormEls.rate.value);
  storm = L.stormSetRate(storm, rate, Date.now());
  stormEls.rate.value = String(storm.rate);
  saveStorm();
  renderStorm();
});

// ---------- Net Damage ----------
const netEls = {
  dealt: $('dmg-dealt'),
  taken: $('dmg-taken'),
  dealtErr: $('dealt-error'),
  takenErr: $('taken-error'),
  result: $('net-result'),
  label: $('net-label'),
  value: $('net-value'),
  icon: $('net-icon'),
  reset: $('net-reset'),
};
const savedNet = store.read(KEYS.net);
if (savedNet && typeof savedNet === 'object') {
  netEls.dealt.value = typeof savedNet.dealt === 'string' ? savedNet.dealt.slice(0, 7) : '';
  netEls.taken.value = typeof savedNet.taken === 'string' ? savedNet.taken.slice(0, 7) : '';
}

function showFieldError(input, errEl, message) {
  if (message) {
    errEl.hidden = false;
    setText(errEl, message);
    input.setAttribute('aria-invalid', 'true');
  } else {
    errEl.hidden = true;
    setText(errEl, '');
    input.removeAttribute('aria-invalid');
  }
}

function renderNet() {
  const r = L.computeNet(netEls.dealt.value, netEls.taken.value);
  showFieldError(netEls.dealt, netEls.dealtErr, r.dealtError);
  showFieldError(netEls.taken, netEls.takenErr, r.takenError);
  if (!r.ok) {
    netEls.result.dataset.kind = 'invalid';
    setText(netEls.label, 'Ungültige Eingabe');
    setText(netEls.value, '–');
    netEls.icon.setAttribute('href', '#i-alert');
    return;
  }
  netEls.result.dataset.kind = r.kind;
  setText(netEls.label, r.label);
  setText(netEls.value, r.text);
  netEls.icon.setAttribute('href', r.kind === 'positive' ? '#i-up' : r.kind === 'negative' ? '#i-down' : '#i-even');
}
function onNetInput() {
  renderNet();
  store.write(KEYS.net, { dealt: netEls.dealt.value, taken: netEls.taken.value });
}
netEls.dealt.addEventListener('input', onNetInput);
netEls.taken.addEventListener('input', onNetInput);
// Schnellbuttons: lesen immer den aktuellen Feldwert, daher gehen schnelle Mehrfachtipps nicht verloren
document.querySelectorAll('.qbtn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const input = btn.dataset.target === 'dealt' ? netEls.dealt : netEls.taken;
    const result = L.applyDelta(input.value, Number(btn.dataset.delta));
    if (!result.ok) {
      renderNet(); // ungültiger Text im Feld: Fehlermeldung bleibt sichtbar, nichts wird überschrieben
      return;
    }
    input.value = String(result.value);
    onNetInput();
  });
});
netEls.reset.addEventListener('click', () => {
  netEls.dealt.value = '';
  netEls.taken.value = '';
  onNetInput();
});

// ---------- Rotation ----------
const rotEls = {
  card: document.querySelector('.card-rot'),
  presets: $('presets'),
  time: $('rot-time'),
  status: $('rot-status'),
  warn: $('rot-warning'),
  done: $('rot-done'),
  toggle: $('rot-toggle'),
  reset: $('rot-reset'),
  sound: $('sound-toggle'),
  soundText: $('sound-text'),
};

L.ROTATION_PRESETS.forEach((sec) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'preset';
  b.setAttribute('role', 'radio');
  b.dataset.sec = String(sec);
  b.textContent = L.formatPreset(sec);
  b.setAttribute('aria-label', `${L.formatPreset(sec)} Minuten`);
  b.addEventListener('click', () => {
    if (rotation.status === 'running') return;
    rotation = L.rotationSetPreset(rotation, sec);
    saveRotation();
    renderRotation();
  });
  rotEls.presets.appendChild(b);
});

const STATUS_LABELS = { idle: 'Bereit', running: 'Läuft', paused: 'Pausiert', finished: 'Abgelaufen' };

function renderRotation(now = Date.now()) {
  const secs = L.rotationDisplaySeconds(rotation, now);
  setText(rotEls.time, L.formatPreset(secs));
  const warn = L.rotationInWarning(rotation, now);
  const state = rotation.status === 'finished' ? 'finished' : warn ? 'warn' : rotation.status;
  if (rotEls.card.dataset.state !== state) rotEls.card.dataset.state = state;
  setText(rotEls.status, STATUS_LABELS[rotation.status]);
  if (rotEls.status.dataset.state !== rotation.status) rotEls.status.dataset.state = rotation.status;
  if (rotEls.warn.hidden === warn) rotEls.warn.hidden = !warn;
  const finished = rotation.status === 'finished';
  if (rotEls.done.hidden === finished) rotEls.done.hidden = !finished;
  const label = rotation.status === 'running' ? ['pause', 'Pause'] : rotation.status === 'paused' ? ['play', 'Fortsetzen'] : finished ? ['play', 'Neu starten'] : ['play', 'Start'];
  setButton(rotEls.toggle, label[0], label[1]);
  rotEls.presets.querySelectorAll('.preset').forEach((b) => {
    b.setAttribute('aria-checked', String(Number(b.dataset.sec) === rotation.presetSec));
    b.setAttribute('aria-disabled', String(rotation.status === 'running'));
    b.tabIndex = Number(b.dataset.sec) === rotation.presetSec ? 0 : -1;
  });
}

function renderSoundToggle() {
  rotEls.sound.setAttribute('aria-pressed', String(prefs.sound));
  setText(rotEls.soundText, prefs.sound ? 'Ton an' : 'Ton aus');
}

rotEls.toggle.addEventListener('click', () => {
  const now = Date.now();
  unlockAudio(); // Safari erlaubt Ton nur nach einer Nutzeraktion
  rotation = rotation.status === 'running' ? L.rotationPause(rotation, now) : L.rotationStart(rotation, now);
  saveRotation();
  renderRotation(now);
});
rotEls.reset.addEventListener('click', () => {
  rotation = L.rotationReset(rotation);
  saveRotation();
  renderRotation();
});
rotEls.sound.addEventListener('click', () => {
  prefs = { ...prefs, sound: !prefs.sound };
  if (prefs.sound) unlockAudio();
  savePrefs();
  renderSoundToggle();
});
// Pfeiltasten innerhalb der Preset-Gruppe
rotEls.presets.addEventListener('keydown', (e) => {
  if (!['ArrowLeft', 'ArrowRight'].includes(e.key) || rotation.status === 'running') return;
  const idx = L.ROTATION_PRESETS.indexOf(rotation.presetSec);
  const next = L.ROTATION_PRESETS[(idx + (e.key === 'ArrowRight' ? 1 : -1) + L.ROTATION_PRESETS.length) % L.ROTATION_PRESETS.length];
  rotation = L.rotationSetPreset(rotation, next);
  saveRotation();
  renderRotation();
  rotEls.presets.querySelector(`[data-sec="${next}"]`).focus();
  e.preventDefault();
});

function tickRotation(now) {
  const res = L.rotationTick(rotation, now);
  if (res.justFinished) {
    rotation = res.state;
    saveRotation();
    if (prefs.sound) beep();
    vibrate();
  }
}

// ---------- Notizen ----------
const noteEls = {
  input: $('note-input'),
  save: $('note-save'),
  exp: $('note-export'),
  share: $('note-share'),
  del: $('note-delete'),
  confirm: $('note-confirm'),
  confirmOk: $('note-confirm-ok'),
  confirmCancel: $('note-confirm-cancel'),
  status: $('note-status'),
  list: $('note-list'),
  empty: $('note-empty'),
};
const savedDraft = store.read(KEYS.draft);
if (typeof savedDraft === 'string') noteEls.input.value = savedDraft;

let statusTimer = null;
function say(message, kind = 'ok') {
  noteEls.status.dataset.kind = kind;
  setText(noteEls.status, message);
  clearTimeout(statusTimer);
  if (kind === 'ok') statusTimer = setTimeout(() => setText(noteEls.status, ''), 4000);
}

function renderNotes() {
  noteEls.list.replaceChildren(
    ...notes.map((n) => {
      const li = document.createElement('li');
      const time = document.createElement('span');
      time.className = 'note-time';
      time.textContent = L.formatTimestamp(n.ts);
      const text = document.createElement('span');
      text.className = 'note-text';
      text.textContent = n.text;
      li.append(time, text);
      return li;
    })
  );
  noteEls.empty.hidden = notes.length > 0;
}

let draftTimer = null;
noteEls.input.addEventListener('input', () => {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => store.write(KEYS.draft, noteEls.input.value), 400);
});
// Entwurf nicht verlieren, wenn die App in den Hintergrund geht
function flushDraft() {
  clearTimeout(draftTimer);
  store.write(KEYS.draft, noteEls.input.value);
}

noteEls.save.addEventListener('click', () => {
  const entry = L.makeNoteEntry(noteEls.input.value, Date.now());
  if (!entry) {
    say('Nichts zu speichern. Das Feld ist leer.', 'error');
    return;
  }
  const next = [entry, ...notes];
  if (!store.write(KEYS.notes, { entries: next })) {
    say('Speichern fehlgeschlagen. Der Text bleibt im Feld erhalten.', 'error');
    return;
  }
  notes = next;
  noteEls.input.value = '';
  store.write(KEYS.draft, '');
  renderNotes();
  say('Notiz gespeichert.');
});

function currentExport() {
  return L.buildNotesExport(notes, noteEls.input.value);
}

noteEls.exp.addEventListener('click', () => {
  const text = currentExport();
  if (!text) {
    say('Keine Notizen zum Exportieren.', 'error');
    return;
  }
  try {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = L.notesFileName(Date.now());
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    say('Textdatei erstellt.');
  } catch {
    say('Export fehlgeschlagen. Nutze „Teilen“ oder kopiere den Text.', 'error');
  }
});

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px';
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, text.length);
  const ok = document.execCommand && document.execCommand('copy');
  ta.remove();
  if (!ok) throw new Error('copy failed');
}

noteEls.share.addEventListener('click', async () => {
  const text = currentExport();
  if (!text) {
    say('Keine Notizen zum Teilen.', 'error');
    return;
  }
  const name = L.notesFileName(Date.now());
  try {
    if (navigator.share) {
      const file = typeof File === 'function' ? new File([text], name, { type: 'text/plain' }) : null;
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Match-Notizen' });
      } else {
        await navigator.share({ title: 'Match-Notizen', text });
      }
      say('Geteilt.');
      return;
    }
  } catch (err) {
    if (err && err.name === 'AbortError') return; // Nutzer hat das Teilen-Menü geschlossen
  }
  // Fallback: Teilen nicht verfügbar oder fehlgeschlagen -> kopieren
  try {
    await copyText(text);
    say('Teilen ist hier nicht verfügbar. Der Text wurde in die Zwischenablage kopiert.');
  } catch {
    say('Teilen und Kopieren sind nicht möglich. Nutze „Export .txt“.', 'error');
  }
});

noteEls.del.addEventListener('click', () => {
  noteEls.confirm.hidden = false;
  noteEls.confirmCancel.focus();
});
noteEls.confirmCancel.addEventListener('click', () => {
  noteEls.confirm.hidden = true;
  noteEls.del.focus();
});
noteEls.confirmOk.addEventListener('click', () => {
  const ok = store.write(KEYS.notes, { entries: [] }) && store.write(KEYS.draft, '');
  noteEls.confirm.hidden = true;
  if (!ok) {
    say('Löschen im Speicher fehlgeschlagen.', 'error');
    return;
  }
  notes = [];
  noteEls.input.value = '';
  renderNotes();
  say('Notizen gelöscht.');
  noteEls.del.focus();
});

// ---------- Karte (Bild-Upload) ----------
initMap();

// ---------- Navigation: aktiven Bereich markieren ----------
(function setupNav() {
  const tabs = [...document.querySelectorAll('.tab')];
  const sections = tabs.map((t) => document.querySelector(t.getAttribute('href'))).filter(Boolean);
  if (!sections.length) return;
  const PROBE = 120; // Höhe der Navigationsleiste plus etwas Abstand
  let lockUntil = 0; // nach einem Tipp auf einen Tab bleibt dessen Markierung bis das Scrollen fertig ist
  let ticking = false;

  const mark = (id) => tabs.forEach((t) => {
    if (t.getAttribute('href') === `#${id}`) t.setAttribute('aria-current', 'true');
    else t.removeAttribute('aria-current');
  });

  function update() {
    ticking = false;
    if (Date.now() < lockUntil) return;
    const doc = document.documentElement;
    const atBottom = window.innerHeight + window.scrollY >= doc.scrollHeight - 4;
    if (atBottom && window.scrollY > 0) {
      mark(sections[sections.length - 1].id);
      return;
    }
    let best = null;
    let bestTop = -Infinity;
    sections.forEach((sec) => {
      const top = sec.getBoundingClientRect().top;
      if (top <= PROBE && top > bestTop + 2) {
        best = sec;
        bestTop = top;
      }
    });
    mark((best || sections[0]).id);
  }
  const schedule = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  };

  tabs.forEach((t) => t.addEventListener('click', () => {
    mark(t.getAttribute('href').slice(1));
    lockUntil = Date.now() + 900;
    setTimeout(schedule, 950);
  }));
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  update();
})();

// ---------- Hauptschleife ----------
function tick() {
  const now = Date.now();
  tickRotation(now);
  renderStorm(now);
  renderRotation(now);
}

setInterval(() => {
  if (!document.hidden) tick();
}, 200);

// Nach App-Wechsel oder Sperrbildschirm sofort neu berechnen (Zeitstempel statt Hintergrund-Timer)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) flushDraft();
  else tick();
});
window.addEventListener('pageshow', tick);
window.addEventListener('focus', tick);
window.addEventListener('pagehide', flushDraft);

renderNet();
renderNotes();
renderSoundToggle();
tick();

// ---------- Service Worker (nur über HTTPS oder localhost) ----------
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      /* Offline-Cache ist optional; die App läuft auch ohne */
    });
  });
}
