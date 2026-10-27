import * as L from './logic.js';
import * as P from './presets.js';
import { initMap } from './map.js';
import { initPresetUI } from './presets-ui.js';
import { t, getLocale, initLanguage, setLanguage, onLanguageChange } from './i18n.js';

const $ = (id) => document.getElementById(id);

// Sprache zuerst setzen, damit die statischen Texte schon vor der ersten Anzeige stimmen
initLanguage();

// ---------- Lokaler Speicher (mit Fehlerbehandlung) ----------
const KEYS = {
  storm: 'fnc.v1.storm',
  rotation: 'fnc.v1.rotation',
  rotPresets: 'fnc.v1.rotPresets',
  net: 'fnc.v1.net',
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
// Fehlt der Schlüssel (Version 1 und 2), gelten die Standard-Presets. Beim Laden wird nichts überschrieben.
let presets = P.restorePresets(store.read(KEYS.rotPresets));
let rotation = L.restoreRotation(store.read(KEYS.rotation), Date.now(), presets);
let prefs = { sound: true, ...(store.read(KEYS.prefs) || {}) };

// Ein Countdown, der abgelaufen ist, während die App geschlossen war, zeigt still "abgelaufen" (kein Ton).
rotation = L.rotationTick(rotation, Date.now()).state;
rotation = L.rotationSyncPresets(rotation, presets);

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
const fmt = (n) => L.formatNumber(n, getLocale());

// ---------- Storm ----------
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
  card: $('storm'),
  alert: $('storm-alert'),
  alertTitle: $('storm-alert-title'),
  alertText: $('storm-alert-text'),
  alertCta: $('storm-alert-cta'),
};
let sickShown = ''; // zuletzt angezeigte Stufe und Sprache: Texte (und die Ansage für Screenreader) nur bei einem Wechsel neu setzen

// Storm Sickness: Stufe aus den Schwellen, Animation nur solange der Timer läuft. Wechselt die Stufe (auch durch Reset oder
// eine andere Schadensrate), ersetzt das neue data-level die alte CSS-Animation sofort, es läuft nichts weiter.
function renderStormSickness(st) {
  const level = L.stormSicknessLevel(st);
  const anim = level !== 'normal' && storm.status === 'running' ? 'on' : 'off';
  if (stormEls.alert.dataset.level !== level) stormEls.alert.dataset.level = level;
  if (stormEls.card.dataset.sickness !== level) stormEls.card.dataset.sickness = level;
  if (stormEls.alert.dataset.anim !== anim) stormEls.alert.dataset.anim = anim;
  const key = `${level}|${getLocale()}`;
  if (key === sickShown) return;
  sickShown = key;
  stormEls.alertTitle.removeAttribute('data-i18n');
  stormEls.alertText.removeAttribute('data-i18n');
  setText(stormEls.alertTitle, t(`storm.sick.${level}.title`));
  setText(stormEls.alertText, t(`storm.sick.${level}.text`));
  setText(stormEls.alertCta, level === 'normal' ? '' : t(`storm.sick.${level}.cta`));
}

function buildStormOptions() {
  stormEls.rate.replaceChildren(
    ...L.STORM_RATES.map((rate) => {
      const o = document.createElement('option');
      o.value = String(rate);
      o.textContent = t('storm.rateOption', { n: rate });
      return o;
    })
  );
  stormEls.rate.value = String(storm.rate);
}
buildStormOptions();

function renderStorm(now = Date.now()) {
  const st = L.stormStats(storm, now);
  setText(stormEls.time, L.formatClock(st.elapsedSec));
  setText(stormEls.damage, fmt(st.damage));
  setText(stormEls.rateOut, String(st.rate));
  stormEls.fill.style.width = `${(st.progress * 100).toFixed(2)}%`;
  stormEls.bar.setAttribute('aria-valuenow', String(Math.min(600, st.damage)));
  stormEls.bar.setAttribute('aria-valuetext', t('storm.barValue', { n: fmt(st.damage) }));
  st.thresholds.forEach((th, i) => {
    const { li, text } = stormEls.th[i];
    li.dataset.reached = String(th.reached);
    setText(
      text,
      th.reached
        ? t('storm.thReached', { n: th.target })
        : t('storm.thLeft', { n: fmt(th.remaining), t: L.formatClock(th.secondsLeft) })
    );
  });
  renderStormSickness(st);
  const label = storm.status === 'running' ? ['pause', t('common.pause')] : storm.status === 'paused' ? ['play', t('common.resume')] : ['play', t('common.start')];
  setButton(stormEls.toggle, label[0], label[1]);
  setText(stormEls.pill, t(`storm.status.${storm.status}`));
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
  calc: $('net-calc'),
  icon: $('net-icon'),
  reset: $('net-reset'),
  undo: $('net-undo'),
};
const savedNet = store.read(KEYS.net);
if (savedNet && typeof savedNet === 'object') {
  netEls.dealt.value = typeof savedNet.dealt === 'string' ? savedNet.dealt.slice(0, 7) : '';
  netEls.taken.value = typeof savedNet.taken === 'string' ? savedNet.taken.slice(0, 7) : '';
}

// Rückgängig-Verlauf: nur im Speicher, nicht gespeichert. Jeder Eintrag ist der Zustand vor einer Änderung.
let netHistory = [];
let netCommitted = L.netSnapshot(netEls.dealt.value, netEls.taken.value);
const netCurrent = () => L.netSnapshot(netEls.dealt.value, netEls.taken.value);

/** Übernimmt den aktuellen Stand in den Verlauf (der vorherige Stand wird zum Rückgängig-Schritt). */
function commitNet() {
  const cur = netCurrent();
  if (!L.sameSnapshot(cur, netCommitted)) {
    netHistory = L.historyPush(netHistory, netCommitted);
    netCommitted = cur;
  }
  updateUndo();
}
function updateUndo() {
  const canUndo = netHistory.length > 0 || !L.sameSnapshot(netCurrent(), netCommitted);
  if (netEls.undo.disabled === canUndo) netEls.undo.disabled = !canUndo;
}
const persistNet = () => store.write(KEYS.net, { dealt: netEls.dealt.value, taken: netEls.taken.value });

// Anbindung für den Team-Modus (team-ui.js). Ohne Team ändert sich nichts: gespeichert wird wie bisher in KEYS.net.
// Im Team benutzt derselbe Tracker die eigenen Team-Werte; die Solo-Werte in KEYS.net bleiben unberührt und kommen nach dem
// Verlassen des Teams zurück. Die Team-Werte werden nie unter KEYS.net gespeichert.
const netBridge = {
  team: false,
  listeners: new Set(),
  values: () => ({ dealt: netEls.dealt.value, taken: netEls.taken.value }),
  onChange(fn) { netBridge.listeners.add(fn); },
  enterTeam() {
    netBridge.team = true;
    netEls.dealt.value = '';
    netEls.taken.value = '';
    netHistory = [];
    netCommitted = netCurrent();
    renderNet();
  },
  setValues(dealt, taken) {
    netEls.dealt.value = dealt;
    netEls.taken.value = taken;
    netHistory = [];
    netCommitted = netCurrent();
    renderNet();
  },
  leaveTeam() {
    if (!netBridge.team) return;
    netBridge.team = false;
    const solo = store.read(KEYS.net);
    netEls.dealt.value = solo && typeof solo.dealt === 'string' ? solo.dealt.slice(0, 7) : '';
    netEls.taken.value = solo && typeof solo.taken === 'string' ? solo.taken.slice(0, 7) : '';
    netHistory = [];
    netCommitted = netCurrent();
    renderNet();
  },
};

function showFieldError(input, errEl, err) {
  if (err) {
    errEl.hidden = false;
    setText(errEl, t(`net.err.${err.code}`, { max: err.max !== undefined ? fmt(err.max) : '' }));
    input.setAttribute('aria-invalid', 'true');
  } else {
    errEl.hidden = true;
    setText(errEl, '');
    input.removeAttribute('aria-invalid');
  }
}

function renderNet() {
  const r = L.computeNet(netEls.dealt.value, netEls.taken.value, getLocale());
  showFieldError(netEls.dealt, netEls.dealtErr, r.dealtError);
  showFieldError(netEls.taken, netEls.takenErr, r.takenError);
  if (!r.ok) {
    netEls.result.dataset.kind = 'invalid';
    setText(netEls.label, t('net.kind.invalid'));
    setText(netEls.value, '–');
    setText(netEls.calc, '');
    netEls.icon.setAttribute('href', '#i-alert');
  } else {
    netEls.result.dataset.kind = r.kind;
    setText(netEls.label, t(`net.kind.${r.kind}`));
    setText(netEls.value, r.text);
    setText(netEls.calc, `${fmt(r.dealt)} − ${fmt(r.taken)} = ${r.text}`);
    netEls.icon.setAttribute('href', r.kind === 'positive' ? '#i-up' : r.kind === 'negative' ? '#i-down' : '#i-even');
  }
  updateUndo();
}
function onNetInput() {
  renderNet();
  if (netBridge.team) netBridge.listeners.forEach((fn) => fn());
  else persistNet();
}
netEls.dealt.addEventListener('input', onNetInput);
netEls.taken.addEventListener('input', onNetInput);
netEls.dealt.addEventListener('change', commitNet);
netEls.taken.addEventListener('change', commitNet);

// Schnellbuttons: lesen immer den aktuellen Feldwert, daher gehen schnelle Mehrfachtipps nicht verloren.
// Es gibt nur Plus-Schritte. Dealt: +1, +5, +10. Taken: "5 Damage" und "10 Damage" (eingehender Schaden).
// Die Beschriftung für Screenreader nennt Menge und Ziel und wird mit der Sprache neu gesetzt.
function labelQuickButtons() {
  document.querySelectorAll('.qbtn').forEach((btn) => {
    btn.setAttribute('aria-label', t(btn.dataset.target === 'dealt' ? 'net.addDealt' : 'net.addTaken', { n: btn.dataset.delta }));
  });
}
labelQuickButtons();
document.querySelectorAll('.qbtn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const input = btn.dataset.target === 'dealt' ? netEls.dealt : netEls.taken;
    commitNet(); // noch nicht bestätigten Tipptext sichern
    const result = L.applyDelta(input.value, Number(btn.dataset.delta));
    if (!result.ok) {
      renderNet(); // ungültiger Text im Feld: Fehlermeldung bleibt sichtbar, nichts wird überschrieben
      return;
    }
    input.value = String(result.value);
    onNetInput();
    commitNet();
  });
});
// Ein Feld leeren (die Eingabe des anderen bleibt)
document.querySelectorAll('[data-clear]').forEach((btn) => {
  btn.addEventListener('click', () => {
    commitNet();
    (btn.dataset.clear === 'dealt' ? netEls.dealt : netEls.taken).value = '';
    onNetInput();
    commitNet();
  });
});
netEls.reset.addEventListener('click', () => {
  commitNet();
  netEls.dealt.value = '';
  netEls.taken.value = '';
  onNetInput();
  commitNet();
});
netEls.undo.addEventListener('click', () => {
  commitNet();
  const { stack, snap } = L.historyPop(netHistory);
  if (!snap) return;
  netHistory = stack;
  netEls.dealt.value = snap.dealt;
  netEls.taken.value = snap.taken;
  netCommitted = snap;
  onNetInput();
});

// ---------- Rotation ----------
const rotEls = {
  card: document.querySelector('.card-rot'),
  time: $('rot-time'),
  status: $('rot-status'),
  warn: $('rot-warning'),
  done: $('rot-done'),
  toggle: $('rot-toggle'),
  reset: $('rot-reset'),
  sound: $('sound-toggle'),
  soundText: $('sound-text'),
};

const presetUI = initPresetUI({
  getPresets: () => presets,
  getRotation: () => rotation,
  onSelect(preset) {
    const next = L.rotationSelectPreset(rotation, preset);
    if (next === rotation) return;
    rotation = next;
    saveRotation();
    renderRotation();
  },
  onSave(items) {
    presets = items;
    const persisted = store.write(KEYS.rotPresets, P.serializePresets(items));
    const synced = L.rotationSyncPresets(rotation, presets);
    if (synced !== rotation) {
      rotation = synced;
      saveRotation();
    }
    renderRotation();
    presetUI.renderPicker();
    return { persisted };
  },
});

let pickerKey = '';
function renderRotation(now = Date.now()) {
  const secs = L.rotationDisplaySeconds(rotation, now);
  setText(rotEls.time, L.formatPreset(secs));
  const warn = L.rotationInWarning(rotation, now);
  const state = rotation.status === 'finished' ? 'finished' : warn ? 'warn' : rotation.status;
  if (rotEls.card.dataset.state !== state) rotEls.card.dataset.state = state;
  setText(rotEls.status, t(`rot.status.${rotation.status}`));
  if (rotEls.status.dataset.state !== rotation.status) rotEls.status.dataset.state = rotation.status;
  if (rotEls.warn.hidden === warn) rotEls.warn.hidden = !warn;
  const finished = rotation.status === 'finished';
  if (rotEls.done.hidden === finished) rotEls.done.hidden = !finished;
  const label = rotation.status === 'running' ? ['pause', t('common.pause')] : rotation.status === 'paused' ? ['play', t('common.resume')] : finished ? ['play', t('common.restart')] : ['play', t('common.start')];
  setButton(rotEls.toggle, label[0], label[1]);
  // Die Preset-Auswahl wird nur neu gezeichnet, wenn sich Status oder Auswahl ändern (nicht bei jedem Tick)
  const key = `${rotation.status}|${rotation.presetId}|${rotation.presetSec}`;
  if (key !== pickerKey) {
    pickerKey = key;
    presetUI.renderPicker();
  }
}

function renderSoundToggle() {
  rotEls.sound.setAttribute('aria-pressed', String(prefs.sound));
  setText(rotEls.soundText, t(prefs.sound ? 'rot.soundOn' : 'rot.soundOff'));
}

rotEls.toggle.addEventListener('click', () => {
  const now = Date.now();
  unlockAudio(); // Safari erlaubt Ton nur nach einer Nutzeraktion
  rotation = rotation.status === 'running' ? L.rotationPause(rotation, now) : L.rotationStart(rotation, now);
  saveRotation();
  renderRotation(now);
});
rotEls.reset.addEventListener('click', () => {
  // Reset übernimmt auch geänderte Preset-Dauern, die während eines laufenden Countdowns gespeichert wurden
  rotation = L.rotationSyncPresets(L.rotationReset(rotation), presets);
  saveRotation();
  renderRotation();
});
rotEls.sound.addEventListener('click', () => {
  prefs = { ...prefs, sound: !prefs.sound };
  if (prefs.sound) unlockAudio();
  savePrefs();
  renderSoundToggle();
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

// ---------- Karte (Bild-Upload) ----------
initMap();

// ---------- Sprachumschaltung ----------
document.querySelectorAll('[data-lang]').forEach((btn) => {
  btn.addEventListener('click', () => setLanguage(btn.dataset.lang));
});
// Alle dynamisch erzeugten Texte neu zeichnen. Nutzerdaten (Preset-Namen, Zahlen) bleiben unverändert.
onLanguageChange(() => {
  labelQuickButtons();
  buildStormOptions();
  renderStorm();
  renderRotation();
  renderSoundToggle();
  renderNet();
  presetUI.render();
});

// ---------- Navigation: aktiven Bereich markieren ----------
(function setupNav() {
  const tabs = [...document.querySelectorAll('.tab')];
  const sections = tabs.map((t) => document.querySelector(t.getAttribute('href'))).filter(Boolean);
  if (!sections.length) return;
  const bar = document.querySelector('.topbar');
  const probe = () => (bar ? bar.getBoundingClientRect().bottom : 84) + 36; // Unterkante der Leiste plus etwas Abstand
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
      if (top <= probe() && top > bestTop + 2) {
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
  if (!document.hidden) tick();
});
window.addEventListener('pageshow', tick);
window.addEventListener('focus', tick);

renderNet();
renderSoundToggle();
tick();
// Intro (reine Anzeige): Overlay über der bereits fertigen App, es blockiert nichts. Es wird nachgeladen, damit eine
// fehlende oder fehlerhafte intro.js die Werkzeuge nie lahmlegt. Die Seite wird erst danach sichtbar (styles.css:
// html:not([data-ready]) body), damit die App nicht kurz hinter dem Intro aufblitzt; styles.css zeigt sie spätestens nach 1,5 s.
import('./intro.js')
  .then((m) => m.initIntro())
  .catch(() => { const el = $('intro'); if (el) el.remove(); })
  .finally(() => { document.documentElement.dataset.ready = '1'; });

// ---------- Estimated Qual (öffentlicher Banner) ----------
// Optional: ohne Supabase-Konfiguration oder bei ausgeschaltetem Estimated Qual passiert nichts und es entsteht kein Element.
// Eigener Block, damit ein Fehler im Konto-Code den Banner nicht verhindert (und umgekehrt).
let qualBanner = null;
(async () => {
  try {
    const [{ CONFIG }, qp] = await Promise.all([import('./config.js'), import('./qual-public.js')]);
    qualBanner = qp.initQualBanner({ config: CONFIG });
  } catch {
    /* Banner nicht ladbar: Werkzeuge laufen unverändert weiter */
  }
})();

// ---------- Konten ----------
// Optional und erst nach den Werkzeugen geladen. Ein Fehler hier (fehlende Datei, Netzwerk,
// falsche Konfiguration) darf die App nie beeinträchtigen.

(async () => {
  try {
    const [{ CONFIG }, client, ui] = await Promise.all([import('./config.js'), import('./authclient.js'), import('./auth-ui.js')]);
    const auth = client.createAuthClient({
      url: CONFIG.supabaseUrl,
      anonKey: CONFIG.supabaseAnonKey,
      storage: client.makeStorage(),
      location,
      history,
      crypto: window.crypto,
      locks: navigator.locks,
      navigate: (url) => location.assign(url),
    });
    // Verwaltung (Estimated Qual): wird erst geladen, wenn ein Administrator sie öffnet
    let adminApi = null;
    const openAdmin = async () => {
      if (!adminApi) {
        const m = await import('./admin-ui.js');
        adminApi = m.initAdmin({ auth, baseUrl: CONFIG.supabaseUrl, onPublicChange: () => { if (qualBanner) qualBanner.refresh(); } });
      }
      if (adminApi) adminApi.open();
    };
    ui.initAccounts({ auth, openAdmin }); // zuerst Oberfläche anbinden, dann Sitzung prüfen (nicht abwarten)
    // Team-Modus (Net Damage): eigener Block, ein Fehler hier beeinträchtigt weder Konten noch Werkzeuge
    import('./team-ui.js')
      .then((tm) => tm.initTeam({ auth, net: netBridge, openAccount: () => { const b = $('account-btn'); if (b) b.click(); } }))
      .catch(() => { const c = $('team-open'); if (c) c.hidden = true; });
    auth.init().catch(() => {});
  } catch {
    const btn = $('account-btn');
    if (btn) btn.hidden = true; // Konto-Code nicht ladbar: Werkzeuge laufen unverändert weiter
  }
})();

// ---------- Service Worker (nur über HTTPS oder localhost) ----------
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      /* Offline-Cache ist optional; die App läuft auch ohne */
    });
  });
}
