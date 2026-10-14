// Reine Logik ohne DOM-Zugriff. Wird von app.js und von den Tests verwendet.
// Alle Zeiten werden aus Zeitstempeln (ms seit Epoche) berechnet, nie durch Hochzählen.

export const STORM_RATES = [1, 2, 5, 8, 10];
export const STORM_THRESHOLDS = [500, 600];
export const ROTATION_PRESETS = [60, 90, 120, 180, 300]; // Sekunden
export const ROTATION_WARNING_SECONDS = 10;
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
// Zustand: { status: 'idle'|'running'|'paused'|'finished', presetSec, remainingMs, endAt }
// Das Ablaufereignis ist ein Zustandsübergang running -> finished und kann
// deshalb nur einmal pro Countdown auftreten.

export function createRotation(presetSec = DEFAULT_PRESET) {
  return { status: 'idle', presetSec, remainingMs: presetSec * 1000, endAt: null };
}

export function rotationRemainingMs(r, now) {
  if (r.status === 'running') return Math.max(0, r.endAt - now);
  if (r.status === 'finished') return 0;
  return r.remainingMs;
}

export function rotationStart(r, now) {
  if (r.status === 'running') return r;
  const base = r.status === 'finished' ? createRotation(r.presetSec) : r;
  return { ...base, status: 'running', endAt: now + base.remainingMs };
}

export function rotationPause(r, now) {
  if (r.status !== 'running') return r;
  return { ...r, status: 'paused', remainingMs: rotationRemainingMs(r, now), endAt: null };
}

export function rotationReset(r) {
  return createRotation(r.presetSec);
}

/** Preset wählen ist nur möglich, solange der Countdown nicht läuft. */
export function rotationSetPreset(r, presetSec) {
  if (r.status === 'running' || !ROTATION_PRESETS.includes(presetSec)) return r;
  return createRotation(presetSec);
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

export function restoreRotation(raw, now) {
  const d = createRotation();
  if (!raw || typeof raw !== 'object') return d;
  const presetSec = ROTATION_PRESETS.includes(raw.presetSec) ? raw.presetSec : DEFAULT_PRESET;
  const base = createRotation(presetSec);
  const status = ['idle', 'running', 'paused', 'finished'].includes(raw.status) ? raw.status : 'idle';
  if (status === 'running') {
    if (!isNum(raw.endAt)) return base;
    return { ...base, status, endAt: raw.endAt, remainingMs: base.remainingMs };
  }
  if (status === 'paused') {
    const rem = isNum(raw.remainingMs) ? Math.min(Math.max(0, raw.remainingMs), presetSec * 1000) : base.remainingMs;
    return { ...base, status, remainingMs: rem };
  }
  if (status === 'finished') return { ...base, status, remainingMs: 0 };
  return base;
}

// ---------- Net Damage ----------

/**
 * Prüft eine Eingabe als Schaden. Leer zählt als 0.
 * Erlaubt sind nur ganze Zahlen von 0 bis MAX_DAMAGE_INPUT; es wird nie gerundet.
 */
export function parseDamageInput(raw) {
  const text = String(raw ?? '').trim();
  if (text === '') return { ok: true, value: 0, empty: true };
  if (text.startsWith('-') || text.startsWith('−')) {
    return { ok: false, error: 'Keine negativen Werte.' };
  }
  if (!/^\d+$/.test(text)) {
    return { ok: false, error: 'Nur ganze Zahlen ohne Komma oder Buchstaben.' };
  }
  const value = Number(text);
  if (value > MAX_DAMAGE_INPUT) {
    return { ok: false, error: `Höchstens ${MAX_DAMAGE_INPUT.toLocaleString('de-DE')}.` };
  }
  return { ok: true, value, empty: false };
}

export const netDamage = (dealt, taken) => dealt - taken;

export function describeNet(n) {
  if (n > 0) return { kind: 'positive', text: `+${n}`, label: 'Im Plus' };
  if (n < 0) return { kind: 'negative', text: `−${Math.abs(n)}`, label: 'Im Minus' };
  return { kind: 'even', text: '0', label: 'Ausgeglichen' };
}

/** Berechnet Net Damage aus zwei Roh-Eingaben und liefert Fehler je Feld. */
export function computeNet(rawDealt, rawTaken) {
  const dealt = parseDamageInput(rawDealt);
  const taken = parseDamageInput(rawTaken);
  if (!dealt.ok || !taken.ok) {
    return { ok: false, dealtError: dealt.ok ? null : dealt.error, takenError: taken.ok ? null : taken.error };
  }
  return { ok: true, dealtError: null, takenError: null, ...describeNet(netDamage(dealt.value, taken.value)), value: netDamage(dealt.value, taken.value) };
}

// ---------- Notizen ----------

export function makeNoteEntry(text, now) {
  const clean = String(text ?? '').replace(/\r\n/g, '\n').trim();
  if (!clean) return null;
  return { id: `${now}-${Math.random().toString(36).slice(2, 8)}`, ts: now, text: clean };
}

export function restoreNotes(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.entries)) return [];
  return raw.entries
    .filter((e) => e && typeof e.text === 'string' && e.text.trim() && isNum(e.ts))
    .map((e) => ({ id: String(e.id ?? e.ts), ts: e.ts, text: e.text }));
}

export function formatTimestamp(ts) {
  const d = new Date(ts);
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function notesFileName(now) {
  const d = new Date(now);
  return `match-notizen-${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}.txt`;
}

/** Text für Export und Teilen: gespeicherte Notizen (neueste zuerst) und ein nicht gespeicherter Entwurf. */
export function buildNotesExport(entries, draft) {
  const parts = entries.map((e) => `[${formatTimestamp(e.ts)}]\n${e.text}`);
  const d = String(draft ?? '').trim();
  if (d) parts.unshift(`[Entwurf, nicht gespeichert]\n${d}`);
  return parts.join('\n\n---\n\n');
}
