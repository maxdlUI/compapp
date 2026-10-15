// Rotation-Presets: reine Logik ohne DOM. Wird von der Oberfläche (presets-ui.js) und den Tests verwendet.
//
// Ein Preset ist { id, name, seconds }. Der Name ist ein vom Nutzer frei gewählter Text und wird
// niemals übersetzt. Die Standard-Presets heißen wie ihre Dauer ("1:30"); das ist sprachneutral.
//
// Speicherformat (localStorage, Schlüssel fnc.v1.rotPresets):
//   { version: 1, items: [{ id, name, seconds }, ...] }
// Fehlt der Schlüssel (Nutzer von Version 1 und 2), gelten die Standard-Presets. Beim Laden wird nichts geschrieben.

import { DURATION_MIN_SEC, DURATION_MAX_SEC, ROTATION_PRESETS, formatPreset, isValidDuration } from './logic.js';

export const PRESET_MAX_COUNT = 12;
export const PRESET_NAME_MAX = 24;
export const PRESETS_VERSION = 1;

export function defaultPresets() {
  return ROTATION_PRESETS.map((seconds) => ({ id: `default-${seconds}`, name: formatPreset(seconds), seconds }));
}

/** Zerlegt Sekunden in Minuten und Sekunden für die Eingabefelder. */
export const splitDuration = (seconds) => ({ minutes: Math.floor(seconds / 60), seconds: seconds % 60 });

const wholeNumber = /^\d{1,3}$/;

/**
 * Prüft Minuten und Sekunden aus zwei Textfeldern. Leer zählt als 0.
 * Fehlercodes: 'minutes' (keine ganze Zahl 0 bis 99), 'seconds' (keine ganze Zahl 0 bis 59),
 * 'zero' (Gesamtdauer 0), 'max' (über 99:59, praktisch nicht erreichbar, aber abgesichert).
 */
export function parseDuration(minRaw, secRaw) {
  const m = String(minRaw ?? '').trim();
  const s = String(secRaw ?? '').trim();
  const minutes = m === '' ? 0 : wholeNumber.test(m) ? Number(m) : NaN;
  const seconds = s === '' ? 0 : wholeNumber.test(s) ? Number(s) : NaN;
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 99) return { ok: false, field: 'minutes', code: 'minutes' };
  if (!Number.isInteger(seconds) || seconds < 0 || seconds > 59) return { ok: false, field: 'seconds', code: 'seconds' };
  const total = minutes * 60 + seconds;
  if (total < DURATION_MIN_SEC) return { ok: false, field: 'minutes', code: 'zero' };
  if (total > DURATION_MAX_SEC) return { ok: false, field: 'minutes', code: 'max' };
  return { ok: true, seconds: total };
}

/** Name: getrimmt, nicht leer, höchstens PRESET_NAME_MAX Zeichen. */
export function validateName(raw) {
  const value = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (value === '') return { ok: false, code: 'empty' };
  if ([...value].length > PRESET_NAME_MAX) return { ok: false, code: 'long' };
  return { ok: true, value };
}

/**
 * Prüft einen Entwurf (Liste von Zeilen { id, name, min, sec } mit Roh-Texten).
 * Liefert entweder die bereinigte Liste oder alle Fehler mit Zeilennummer, Feld und Code.
 */
export function validateDraft(rows) {
  const errors = [];
  const items = [];
  if (!Array.isArray(rows) || rows.length === 0) return { ok: false, items: [], errors: [{ index: -1, field: 'list', code: 'none' }] };
  if (rows.length > PRESET_MAX_COUNT) errors.push({ index: -1, field: 'list', code: 'count' });
  rows.forEach((row, index) => {
    const name = validateName(row.name);
    const dur = parseDuration(row.min, row.sec);
    if (!name.ok) errors.push({ index, field: 'name', code: name.code });
    if (!dur.ok) errors.push({ index, field: dur.field, code: dur.code });
    if (name.ok && dur.ok) items.push({ id: row.id, name: name.value, seconds: dur.seconds });
  });
  return errors.length ? { ok: false, items: [], errors } : { ok: true, items, errors: [] };
}

/** Liest gespeicherte Presets. Ungültige Einträge werden verworfen, doppelte IDs entfernt. Ohne gültige Einträge gelten die Standard-Presets. */
export function restorePresets(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.items)) return defaultPresets();
  const seen = new Set();
  const items = [];
  for (const it of raw.items) {
    if (!it || typeof it.id !== 'string' || !it.id || seen.has(it.id)) continue;
    const name = validateName(it.name);
    if (!name.ok || !isValidDuration(it.seconds)) continue;
    seen.add(it.id);
    items.push({ id: it.id, name: name.value, seconds: it.seconds });
    if (items.length >= PRESET_MAX_COUNT) break;
  }
  return items.length ? items : defaultPresets();
}

export const serializePresets = (items) => ({ version: PRESETS_VERSION, items: items.map(({ id, name, seconds }) => ({ id, name, seconds })) });

/** Neue eindeutige ID. rand ist austauschbar, damit Tests deterministisch bleiben. */
export function newPresetId(existing, now = Date.now(), rand = Math.random) {
  const used = new Set(existing.map((p) => p.id));
  const base = `p-${now.toString(36)}-${Math.floor(rand() * 36 ** 4).toString(36)}`;
  // Kollisionen sind extrem selten; ein Zähler garantiert trotzdem eine freie ID und verhindert Endlosschleifen.
  let id = base;
  for (let i = 2; used.has(id); i++) id = `${base}-${i}`;
  return id;
}

/** Verschiebt den Eintrag an Position index um dir (-1 nach oben, +1 nach unten). Gibt eine neue Liste zurück. */
export function moveItem(list, index, dir) {
  const to = index + dir;
  if (index < 0 || index >= list.length || to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

/** Zeigt der Name nur die Dauer (Standard-Preset), genügt eine Zeile in der Auswahl. */
export const isTimeName = (p) => p.name === formatPreset(p.seconds);

/** Sichtbare Auswahl-Beschriftung: { title, time }. title ist null, wenn der Name nur die Dauer wiederholt. */
export function presetLabel(p) {
  return { title: isTimeName(p) ? null : p.name, time: formatPreset(p.seconds) };
}
