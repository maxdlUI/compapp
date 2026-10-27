// Reine Logik ohne DOM-Zugriff. Wird von app.js und von den Tests verwendet.
// Alle Zeiten werden aus Zeitstempeln (ms seit Epoche) berechnet, nie durch Hochzählen.

export const STORM_RATES = [1, 2, 5, 8, 10];
export const STORM_THRESHOLDS = [500, 600];
export const ROTATION_PRESETS = [60, 90, 120, 180, 300]; // Standard-Presets in Sekunden (Ausgangspunkt, siehe presets.js)
export const ROTATION_WARNING_SECONDS = 10;
export const DURATION_MIN_SEC = 1; // kürzeste erlaubte Rotation-Dauer
export const DURATION_MAX_SEC = 99 * 60 + 59; // längste erlaubte Dauer: 99:59
export const MAX_DAMAGE_INPUT = 999999;
export const DEFAULT_RATE = 5;
export const DEFAULT_PRESET = 120;

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const pad2 = (n) => String(n).padStart(2, '0');

// ---------- Formatierung ----------

/** 125 -> "02:05" */
export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;
}

/** 90 -> "1:30" (für Preset-Beschriftungen) */
export function formatPreset(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${pad2(s % 60)}`;
}

// ---------- Storm-Timer ----------
// Zustand: { status: 'idle'|'running'|'paused', accMs, startedAt, rate, banked, bankSec }
// Schaden = banked + (aktive ganze Sekunden - bankSec) * rate.
// Bei konstanter Rate ist das exakt "verstrichene Sekunden x Schaden pro Sekunde".
// Ändert der Nutzer die Rate während des Laufs, wird der bisherige Schaden
// eingefroren (banked) und ab dann mit der neuen Rate weitergerechnet.

export function createStorm(rate = DEFAULT_RATE) {
  return { status: 'idle', accMs: 0, startedAt: null, rate, banked: 0, bankSec: 0 };
}

export function stormElapsedMs(s, now) {
  const live = s.status === 'running' && isNum(s.startedAt) ? Math.max(0, now - s.startedAt) : 0;
  return s.accMs + live;
}

export function stormStart(s, now) {
  if (s.status === 'running') return s;
  return { ...s, status: 'running', startedAt: now };
}

export function stormPause(s, now) {
  if (s.status !== 'running') return s;
  return { ...s, status: 'paused', accMs: stormElapsedMs(s, now), startedAt: null };
}

/** Setzt nur den Storm-Timer zurück. Die gewählte Rate bleibt erhalten. */
export function stormReset(s) {
  return createStorm(s.rate);
}

export function stormDamage(s, now) {
  const sec = Math.floor(stormElapsedMs(s, now) / 1000);
  return s.banked + Math.max(0, sec - s.bankSec) * s.rate;
}

export function stormSetRate(s, rate, now) {
  if (!STORM_RATES.includes(rate) || rate === s.rate) return s;
  return {
    ...s,
    rate,
    banked: stormDamage(s, now),
    bankSec: Math.floor(stormElapsedMs(s, now) / 1000),
  };
}

export function stormStats(s, now) {
  const elapsedSec = Math.floor(stormElapsedMs(s, now) / 1000);
  const damage = stormDamage(s, now);
  const max = STORM_THRESHOLDS[STORM_THRESHOLDS.length - 1];
  const thresholds = STORM_THRESHOLDS.map((target) => {
    const remaining = Math.max(0, target - damage);
    return {
      target,
      remaining,
      secondsLeft: remaining === 0 ? 0 : Math.ceil(remaining / s.rate),
      reached: damage >= target,
    };
  });
  return { elapsedSec, damage, rate: s.rate, thresholds, progress: Math.min(1, damage / max) };
}

/**
 * Warnstufe der Storm-Sickness-Anzeige, nur aus den vorhandenen Schwellen (500 und 600) abgeleitet:
 * 'normal' darunter, 'warning' ab der ersten Schwelle, 'active' ab der letzten. Keine eigenen Grenzwerte.
 */
export function stormSicknessLevel(stats) {
  const th = (stats && stats.thresholds) || [];
  if (th.length && th[th.length - 1].reached) return 'active';
  if (th.some((x) => x.reached)) return 'warning';
  return 'normal';
}

export function restoreStorm(raw, now) {
  const d = createStorm();
  if (!raw || typeof raw !== 'object') return d;
  const rate = STORM_RATES.includes(raw.rate) ? raw.rate : DEFAULT_RATE;
  const status = ['idle', 'running', 'paused'].includes(raw.status) ? raw.status : 'idle';
  const accMs = isNum(raw.accMs) && raw.accMs >= 0 ? raw.accMs : 0;
  const banked = isNum(raw.banked) && raw.banked >= 0 ? raw.banked : 0;
  const bankSec = isNum(raw.bankSec) && raw.bankSec >= 0 ? raw.bankSec : 0;
  let startedAt = isNum(raw.startedAt) ? raw.startedAt : null;
  if (status === 'running') {
    if (startedAt === null) return { ...d, rate };
    if (startedAt > now) startedAt = now; // Systemuhr wurde zurückgestellt
    return { status, accMs, startedAt, rate, banked, bankSec };
  }
  return { status, accMs, startedAt: null, rate, banked, bankSec };
}

// ---------- Rotation-Countdown ----------
// Zustand: { status: 'idle'|'running'|'paused'|'finished', presetSec, presetId, remainingMs, endAt }
// presetSec ist die Dauer dieses Countdowns (eine Kopie, kein Verweis). Eine spätere
// Änderung am Preset verändert einen laufenden oder pausierten Countdown deshalb nicht.
// Das Ablaufereignis ist ein Zustandsübergang running -> finished und kann
// deshalb nur einmal pro Countdown auftreten.

export const isValidDuration = (sec) => Number.isInteger(sec) && sec >= DURATION_MIN_SEC && sec <= DURATION_MAX_SEC;

export function createRotation(presetSec = DEFAULT_PRESET, presetId = null) {
  return { status: 'idle', presetSec, presetId, remainingMs: presetSec * 1000, endAt: null };
}

export function rotationRemainingMs(r, now) {
  if (r.status === 'running') return Math.max(0, r.endAt - now);
  if (r.status === 'finished') return 0;
  return r.remainingMs;
}

export function rotationStart(r, now) {
  if (r.status === 'running') return r;
  const base = r.status === 'finished' ? createRotation(r.presetSec, r.presetId) : r;
  return { ...base, status: 'running', endAt: now + base.remainingMs };
}

export function rotationPause(r, now) {
  if (r.status !== 'running') return r;
  return { ...r, status: 'paused', remainingMs: rotationRemainingMs(r, now), endAt: null };
}

export function rotationReset(r) {
  return createRotation(r.presetSec, r.presetId);
}

/** Ein Preset (Objekt mit id und seconds) lässt sich nur im Zustand "bereit" oder "abgelaufen" wählen. */
export function rotationCanSwitch(r) {
  return r.status === 'idle' || r.status === 'finished';
}

/** Preset wählen: setzt den Countdown auf "bereit" mit der Dauer des Presets. Läuft oder pausiert er, bleibt alles unverändert. */
export function rotationSelectPreset(r, preset) {
  if (!rotationCanSwitch(r) || !preset || !isValidDuration(preset.seconds)) return r;
  return createRotation(preset.seconds, preset.id);
}

/**
 * Gleicht einen wartenden Countdown ("bereit" oder "abgelaufen") mit der aktuellen Preset-Liste ab.
 * Wurde das gewählte Preset geändert, gilt die neue Dauer. Wurde es gelöscht, wird das erste Preset gewählt.
 * Laufende und pausierte Countdowns bleiben unangetastet; sie übernehmen Änderungen erst nach dem Zurücksetzen.
 */
export function rotationSyncPresets(r, presets) {
  if (!rotationCanSwitch(r) || !Array.isArray(presets) || presets.length === 0) return r;
  const found = presets.find((p) => p.id === r.presetId);
  const target = found || presets[0];
  if (target.id === r.presetId && target.seconds === r.presetSec) return r;
  return createRotation(target.seconds, target.id);
}

/** Prüft, ob der Countdown abgelaufen ist. justFinished ist genau einmal true. */
export function rotationTick(r, now) {
  if (r.status === 'running' && now >= r.endAt) {
    return { state: { ...r, status: 'finished', remainingMs: 0, endAt: null }, justFinished: true };
  }
  return { state: r, justFinished: false };
}

export function rotationDisplaySeconds(r, now) {
  return Math.ceil(rotationRemainingMs(r, now) / 1000);
}

export function rotationInWarning(r, now) {
  if (r.status !== 'running') return false;
  const ms = rotationRemainingMs(r, now);
  return ms > 0 && ms <= ROTATION_WARNING_SECONDS * 1000;
}

/**
 * Stellt den Zustand aus dem Speicher wieder her. Kompatibel mit älteren Daten ohne presetId:
 * dann wird das erste Preset mit gleicher Dauer gewählt (oder keines, wenn es keins gibt).
 */
export function restoreRotation(raw, now, presets = []) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const presetSec = isValidDuration(src.presetSec) ? src.presetSec : DEFAULT_PRESET;
  const savedId = typeof src.presetId === 'string' ? src.presetId : null;
  const byId = savedId ? presets.find((p) => p.id === savedId && p.seconds === presetSec) : null;
  const presetId = byId ? byId.id : (presets.find((p) => p.seconds === presetSec) || {}).id || null;
  const base = createRotation(presetSec, presetId);
  const status = ['idle', 'running', 'paused', 'finished'].includes(src.status) ? src.status : 'idle';
  if (status === 'running') {
    if (!isNum(src.endAt)) return base;
    return { ...base, status, endAt: src.endAt, remainingMs: base.remainingMs };
  }
  if (status === 'paused') {
    const rem = isNum(src.remainingMs) ? Math.min(Math.max(0, src.remainingMs), presetSec * 1000) : base.remainingMs;
    return { ...base, status, remainingMs: rem };
  }
  if (status === 'finished') return { ...base, status, remainingMs: 0 };
  return base;
}

// ---------- Net Damage ----------

/**
 * Prüft eine Eingabe als Schaden. Leer zählt als 0.
 * Erlaubt sind nur ganze Zahlen von 0 bis MAX_DAMAGE_INPUT; es wird nie gerundet.
 * Fehler werden als Code geliefert ('negative', 'format', 'max'); die Oberfläche übersetzt sie.
 */
export function parseDamageInput(raw) {
  const text = String(raw ?? '').trim();
  if (text === '') return { ok: true, value: 0, empty: true };
  if (text.startsWith('-') || text.startsWith('−')) return { ok: false, code: 'negative' };
  if (!/^\d+$/.test(text)) return { ok: false, code: 'format' };
  const value = Number(text);
  if (value > MAX_DAMAGE_INPUT) return { ok: false, code: 'max', max: MAX_DAMAGE_INPUT };
  return { ok: true, value, empty: false };
}

export const netDamage = (dealt, taken) => dealt - taken;

/** Zahl in der Schreibweise der Sprache: de 1.234, en 1,234. */
export const formatNumber = (n, locale = 'de-DE') => n.toLocaleString(locale);

/** kind: 'positive' | 'negative' | 'even'. text trägt immer ein Vorzeichen, damit Farbe nie die einzige Information ist. */
export function describeNet(n, locale = 'de-DE') {
  if (n > 0) return { kind: 'positive', text: `+${formatNumber(n, locale)}` };
  if (n < 0) return { kind: 'negative', text: `−${formatNumber(Math.abs(n), locale)}` };
  return { kind: 'even', text: '0' };
}

/** Berechnet Net Damage aus zwei Roh-Eingaben und liefert Fehlercodes je Feld. */
export function computeNet(rawDealt, rawTaken, locale = 'de-DE') {
  const dealt = parseDamageInput(rawDealt);
  const taken = parseDamageInput(rawTaken);
  if (!dealt.ok || !taken.ok) {
    return {
      ok: false,
      dealtError: dealt.ok ? null : dealt,
      takenError: taken.ok ? null : taken,
    };
  }
  const value = netDamage(dealt.value, taken.value);
  return { ok: true, dealtError: null, takenError: null, ...describeNet(value, locale), value, dealt: dealt.value, taken: taken.value };
}

// ---------- Net Damage: Schnellbuttons und Verlauf ----------

// Es gibt bewusst keine Minus-Schritte. Korrigiert wird über das Eingabefeld, "Rückgängig" und "Leeren".
export const DEALT_STEPS = [1, 5, 10];
export const TAKEN_STEPS = [5, 10]; // eingehender Schaden: "5 Damage" und "10 Damage"
export const HISTORY_MAX = 50;

/**
 * Verändert einen Eingabewert um delta (die Oberfläche nutzt nur positive Schritte; negative bleiben für Tests und Korrekturen möglich). Liest immer den aktuellen Text, nie einen
 * zwischengespeicherten Wert, damit schnelle Mehrfachtipps nichts verschlucken.
 * Das Ergebnis bleibt zwischen 0 und MAX_DAMAGE_INPUT.
 */
export function applyDelta(raw, delta) {
  const parsed = parseDamageInput(raw);
  if (!parsed.ok) return { ok: false, code: parsed.code, max: parsed.max };
  const next = Math.min(MAX_DAMAGE_INPUT, Math.max(0, parsed.value + delta));
  return { ok: true, value: next, changed: next !== parsed.value };
}

/** Momentaufnahme der beiden Eingabetexte für "Rückgängig". Es werden Texte gespeichert, keine berechneten Werte. */
export const netSnapshot = (dealt, taken) => ({ dealt: String(dealt ?? ''), taken: String(taken ?? '') });
export const sameSnapshot = (a, b) => !!a && !!b && a.dealt === b.dealt && a.taken === b.taken;

/** Legt eine Momentaufnahme oben auf den Verlauf (ohne Dubletten, begrenzt auf max Einträge). Ändert das Array nicht. */
export function historyPush(stack, snap, max = HISTORY_MAX) {
  if (sameSnapshot(stack[stack.length - 1], snap)) return stack;
  const next = [...stack, snap];
  return next.length > max ? next.slice(next.length - max) : next;
}

/** Nimmt die oberste Momentaufnahme herunter. Bei leerem Verlauf ist snap null. */
export function historyPop(stack) {
  if (stack.length === 0) return { stack, snap: null };
  return { stack: stack.slice(0, -1), snap: stack[stack.length - 1] };
}

// ---------- Map-Bild ----------

export const MAP_MAX_EDGE = 2560; // längste Kante nach der Verkleinerung in Pixeln
export const MAP_KEEP_BYTES = 6 * 1024 * 1024; // kleinere Dateien bleiben unverändert
export const MAP_MAX_FILE_BYTES = 30 * 1024 * 1024; // größere Dateien werden abgelehnt

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const IMAGE_EXT = /\.(png|jpe?g|webp)$/i;

/** PNG, JPG und WEBP. Manche iOS-Dateien melden keinen MIME-Typ, dann zählt die Endung. */
export function isSupportedImage(file) {
  if (!file) return false;
  const type = String(file.type || '').toLowerCase();
  if (IMAGE_TYPES.includes(type)) return true;
  if (type === '' || type === 'application/octet-stream') return IMAGE_EXT.test(String(file.name || ''));
  return false;
}

/** Verkleinert proportional, sodass die längste Kante höchstens max beträgt. */
export function fitSize(w, h, max = MAP_MAX_EDGE) {
  const longest = Math.max(w, h);
  if (!(longest > max)) return { w, h, scale: 1 };
  const scale = max / longest;
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)), scale };
}

export function formatBytes(n, locale = 'de-DE') {
  if (!Number.isFinite(n) || n < 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MB`;
}

export const ZOOM_LEVELS = [1, 1.5, 2, 3, 4];
export function nextZoom(current, dir) {
  const i = ZOOM_LEVELS.indexOf(current);
  const base = i === -1 ? 0 : i;
  return ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, Math.max(0, base + dir))];
}
