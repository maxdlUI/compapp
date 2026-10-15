// Storm-Surge-Auswertung: reine Logik ohne DOM und ohne Netzwerk. Wird von surge-ui.js und den Tests verwendet.
//
// Wichtige Grenze: Aus historischen Beobachtungen entsteht hier nur eine Verteilung (Median, Bereich,
// Stichprobengröße). Sie ist NIE der Surge-Schwellenwert eines laufenden Matches. Dieses Modul kennt
// deshalb weder "über Surge" noch "unter Surge" und gibt keine Schwelle aus.
//
// Datenformat siehe docs/STORM-SURGE.md und public/surge-data.json.

export const SCHEMA_VERSION = 1;

// Stichprobengrenzen pro Zone (n = Anzahl unabhängiger Beobachtungen). Siehe docs/STORM-SURGE.md.
export const MIN_N_STATS = 10; // darunter keine Statistik, nur die Anzahl
export const MIN_N_COMPARE = 30; // erst ab hier eine Einordnung des eigenen Werts
export const STALE_DAYS = 180; // Datengruppen, die älter sind, werden als veraltet markiert

// Welche Kennzahl der Daten mit welchem Eingabefeld der App vergleichbar ist.
// Alles andere (oder Unbekanntes) wird gezeigt, aber nicht mit dem Nutzerwert verglichen.
export const COMPARABLE = { damage_dealt: 'dealt', net_damage: 'net' };

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isStr = (v) => typeof v === 'string' && v.trim() !== '';
const optStr = (v) => (isStr(v) ? v.trim() : null);
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

// ---------- Statistik ----------

/** Quantil mit linearer Interpolation (Methode 7, wie R und NumPy). p zwischen 0 und 1. Liefert null bei leerer Liste. */
export function quantile(values, p) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * Math.min(1, Math.max(0, p));
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export const median = (values) => quantile(values, 0.5);

/** Alle Kennzahlen einer Zone. Gerundet wird erst in der Anzeige. */
export function summarize(values) {
  const n = values.length;
  if (n === 0) return null;
  return {
    n,
    median: median(values),
    p10: quantile(values, 0.1),
    p25: quantile(values, 0.25),
    p75: quantile(values, 0.75),
    p90: quantile(values, 0.9),
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

/** 'insufficient' (keine Statistik) | 'low' (nur Orientierung) | 'ok' (grobe Einordnung möglich) */
export function qualityForN(n) {
  if (n < MIN_N_STATS) return 'insufficient';
  if (n < MIN_N_COMPARE) return 'low';
  return 'ok';
}

// ---------- Datensatz prüfen ----------

/**
 * Prüft und bereinigt einen Datensatz. Unbrauchbare Gruppen werden verworfen und gezählt
 * (droppedGroups), der Rest bleibt nutzbar. Ein kaputtes Gesamtformat ergibt { ok: false }.
 * Es wird nichts ergänzt oder geschätzt.
 */
export function validateDataset(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, reason: 'shape' };
  if (raw.schemaVersion !== SCHEMA_VERSION) return { ok: false, reason: 'version' };
  if (raw.kind !== 'verified' && raw.kind !== 'test-fixture') return { ok: false, reason: 'shape' };
  if (!isStr(raw.datasetVersion) || !Array.isArray(raw.sources) || !Array.isArray(raw.groups)) return { ok: false, reason: 'shape' };

  const sources = new Map();
  for (const s of raw.sources) {
    if (!s || !isStr(s.id) || !isStr(s.title) || !/^https?:\/\//i.test(String(s.url ?? ''))) continue;
    sources.set(s.id, {
      id: s.id,
      title: s.title.trim(),
      url: s.url.trim(),
      retrieved: isDate(s.retrieved) ? s.retrieved : null,
      license: optStr(s.license),
      contains: optStr(s.contains),
    });
  }

  // Geprüfte Quellen ohne verwertbare Daten (nur zur Transparenz, ohne Zahlen)
  const reviewed = [];
  for (const r of Array.isArray(raw.reviewedSources) ? raw.reviewedSources : []) {
    if (!r || !isStr(r.title) || !/^https?:\/\//i.test(String(r.url ?? '')) || !r.finding) continue;
    if (!isStr(r.finding.de) || !isStr(r.finding.en)) continue;
    reviewed.push({
      title: r.title.trim(),
      url: r.url.trim(),
      accessed: isDate(r.accessed) ? r.accessed : null,
      finding: { de: r.finding.de.trim(), en: r.finding.en.trim() },
    });
  }

  const groups = [];
  let droppedGroups = 0;
  for (const g of raw.groups) {
    const group = sanitizeGroup(g, sources);
    if (group) groups.push(group);
    else droppedGroups++;
  }

  return {
    ok: true,
    dataset: {
      schemaVersion: SCHEMA_VERSION,
      kind: raw.kind,
      datasetVersion: raw.datasetVersion.trim(),
      updated: isDate(raw.updated) ? raw.updated : null,
      note: optStr(raw.note),
      sources: [...sources.values()],
      reviewedSources: reviewed,
      groups,
    },
    droppedGroups,
  };
}

function sanitizeGroup(g, sources) {
  if (!g || !isStr(g.id) || !isStr(g.tournament) || !isStr(g.metric) || !isStr(g.metricDefinition) || !isStr(g.method)) return null;
  if (!sources.has(g.sourceId)) return null; // ohne nachvollziehbare Herkunft wird nichts angezeigt
  if (!Array.isArray(g.zones)) return null;
  const zones = [];
  const seen = new Set();
  for (const z of g.zones) {
    if (!z || !Number.isInteger(z.zone) || z.zone < 0 || z.zone > 20 || seen.has(z.zone) || !Array.isArray(z.values)) return null;
    if (!z.values.every((v) => isNum(v) && v >= -1e7 && v <= 1e7)) return null;
    seen.add(z.zone);
    zones.push({ zone: z.zone, values: [...z.values] });
  }
  zones.sort((a, b) => a.zone - b.zone);
  return {
    id: g.id.trim(),
    tournament: g.tournament.trim(),
    gameVersion: optStr(g.gameVersion),
    format: optStr(g.format),
    region: optStr(g.region),
    metric: g.metric.trim(),
    metricDefinition: g.metricDefinition.trim(),
    observationUnit: optStr(g.observationUnit),
    sourceId: g.sourceId,
    asOf: isDate(g.asOf) ? g.asOf : null,
    method: g.method.trim(),
    zones,
  };
}

// ---------- Auswertung ----------

const DAY_MS = 86_400_000;

/** Alter in Tagen oder null, wenn das Datum unbekannt ist. */
export function ageInDays(asOf, now) {
  if (!isDate(asOf)) return null;
  return Math.max(0, Math.floor((now - Date.parse(asOf)) / DAY_MS));
}

export function isStale(asOf, now) {
  const age = ageInDays(asOf, now);
  return age !== null && age > STALE_DAYS;
}

/** Neueste Gruppe zuerst (nach Stand der Daten), Gruppen ohne Datum zuletzt. Gruppen werden nie zusammengeführt. */
export function sortGroups(groups) {
  return [...groups].sort((a, b) => {
    if (a.asOf && b.asOf && a.asOf !== b.asOf) return a.asOf < b.asOf ? 1 : -1;
    if (a.asOf && !b.asOf) return -1;
    if (!a.asOf && b.asOf) return 1;
    return a.tournament.localeCompare(b.tournament);
  });
}

/** Kennzahlen jeder Zone einer Gruppe. Bei zu kleiner Stichprobe ist stats null. */
export function summarizeGroup(group) {
  return group.zones.map((z) => {
    const n = z.values.length;
    const quality = qualityForN(n);
    return { zone: z.zone, n, quality, stats: quality === 'insufficient' ? null : summarize(z.values) };
  });
}

/** Warnungen zur Vergleichbarkeit einer Gruppe: Codes, die die Oberfläche übersetzt. */
export function groupWarnings(group, now) {
  const w = [];
  if (!group.gameVersion) w.push('noVersion');
  if (!group.format) w.push('noFormat');
  if (!group.asOf) w.push('noDate');
  else if (isStale(group.asOf, now)) w.push('stale');
  if (!COMPARABLE[group.metric]) w.push('otherMetric');
  return w;
}

/**
 * Ordnet den eigenen Wert in die Verteilung einer Zone ein.
 * userValues: { dealt, net } (Zahlen oder null, wenn die Eingabe ungültig ist).
 * Ergebnis: { status: 'ok', position: 'low'|'typical'|'high' } oder { status: 'unavailable', reason }.
 * Eine Einordnung gibt es nur bei kompatibler Kennzahl, bekannter Version und bekanntem Format,
 * ausreichender Stichprobe (n >= MIN_N_COMPARE) und gültigem Nutzerwert.
 */
export function compareToZone(group, zoneSummary, userValues) {
  const field = COMPARABLE[group.metric];
  if (!field) return { status: 'unavailable', reason: 'metric' };
  if (!group.gameVersion || !group.format) return { status: 'unavailable', reason: 'context' };
  if (!zoneSummary || zoneSummary.quality !== 'ok' || !zoneSummary.stats) return { status: 'unavailable', reason: 'sample' };
  const value = userValues ? userValues[field] : null;
  if (!isNum(value)) return { status: 'unavailable', reason: 'input' };
  const { p25, p75 } = zoneSummary.stats;
  const position = value < p25 ? 'low' : value > p75 ? 'high' : 'typical';
  return { status: 'ok', position, field, value };
}

/** Gesamtzustand für die Anzeige: 'empty' (keine Datengruppen), 'ready' oder 'fixture' (Testdaten). */
export function datasetState(dataset) {
  if (!dataset || dataset.groups.length === 0) return 'empty';
  return dataset.kind === 'test-fixture' ? 'fixture' : 'ready';
}
