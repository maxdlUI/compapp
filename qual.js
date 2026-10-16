// Estimated Qual: reine Logik ohne Oberfläche und ohne Netzwerk (Prüfregeln, Formate, Bilddateien).
// Wird vom öffentlichen Banner (qual-public.js) und vom Admin-Panel (admin-ui.js) gemeinsam genutzt, damit beide
// dieselben Regeln anwenden. Maßgeblich sind trotzdem die Prüfungen der Datenbank (supabase/002_krevo_admin_estimated_qual.sql).

export const FEATURE_NAME = 'Estimated Qual'; // Eigenname, in allen Sprachen gleich
export const UNIT = 'Points'; // ebenfalls Eigenname, nicht übersetzt
export const MIN_POINTS = 1;
export const MAX_POINTS = 999999;
export const BUCKET = 'estimated-qual';
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = Object.freeze({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' });

const IMAGE_NAME_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;
export const isImageName = (s) => typeof s === 'string' && IMAGE_NAME_RE.test(s);

/**
 * Prüft eine Punkteeingabe. Regel: nur Ziffern 0-9, ganze Zahl von 1 bis 999999, keine führende Null,
 * keine Leerzeichen im Inneren, keine Vorzeichen, Punkte, Kommas oder Exponenten. Leerzeichen am Rand werden ignoriert.
 * @returns {{ok:true,value:number}|{ok:false,code:'empty'|'format'|'range'}}
 */
export function parsePoints(input) {
  if (typeof input === 'number') {
    if (!Number.isInteger(input)) return { ok: false, code: 'format' };
    input = String(input);
  }
  if (typeof input !== 'string') return { ok: false, code: 'empty' };
  const s = input.trim();
  if (s === '') return { ok: false, code: 'empty' };
  if (!/^[0-9]+$/.test(s) || (s.length > 1 && s[0] === '0')) return { ok: false, code: 'format' };
  if (s.length > 7) return { ok: false, code: 'range' };
  const n = Number(s);
  if (n < MIN_POINTS || n > MAX_POINTS) return { ok: false, code: 'range' };
  return { ok: true, value: n };
}

/** Zahl mit Tausendertrennung der Sprache (de: 1.500, en: 1,500). */
export function formatPoints(n, locale = 'de-DE') {
  try { return new Intl.NumberFormat(locale).format(n); } catch { return String(n); }
}

/** Der öffentliche Text als Klartext, z. B. "Estimated Qual: 300 Points" (für Screenreader, Tests und Vorschau). */
export function bannerText(points, locale = 'de-DE', name = FEATURE_NAME, unit = UNIT) {
  return `${name}: ${formatPoints(points, locale)} ${unit}`;
}

/**
 * Prüft die Antwort der öffentlichen Datenbankfunktion. Der Browser vertraut ihr nicht blind:
 * Nur gültige Punkte und ein Bildname im erwarteten Format werden übernommen, sonst gibt es keinen Banner.
 * @returns {{points:number,image:string|null,publishedAt:string}|null}
 */
export function parsePublic(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const p = parsePoints(typeof data.points === 'number' ? data.points : NaN);
  if (!p.ok) return null;
  const image = isImageName(data.image) ? data.image : null; // ungültiger Bildname: Banner ohne Bild statt gar nichts
  return { points: p.value, image, publishedAt: typeof data.published_at === 'string' ? data.published_at : '' };
}

/** Adresse des öffentlichen Bilds. Nur https oder localhost, nur gültige Dateinamen. */
export function publicImageUrl(base, name) {
  const b = String(base || '').replace(/\/+$/, '');
  if (!isImageName(name)) return null;
  if (!/^https:\/\/[^/\s]+$/.test(b) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(b)) return null;
  return `${b}/storage/v1/object/public/${BUCKET}/${name}`;
}

/** Erkennt den echten Bildtyp an den ersten Bytes (verlässt sich nicht auf Dateiendung oder angegebenen Typ). */
export function sniffImage(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  const eq = (off, arr) => arr.every((v, i) => b[off + i] === v);
  if (b.length >= 3 && eq(0, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (b.length >= 8 && eq(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (b.length >= 12 && eq(0, [0x52, 0x49, 0x46, 0x46]) && eq(8, [0x57, 0x45, 0x42, 0x50])) return 'image/webp';
  return null;
}

/**
 * Prüft eine ausgewählte Datei vor dem Hochladen.
 * @param {{size:number,type?:string}} file
 * @param {Uint8Array} [head] erste Bytes der Datei (für die Typprüfung am Inhalt)
 * @returns {{ok:true,type:string,ext:string}|{ok:false,code:'empty'|'type'|'size'}}
 */
export function checkImageFile(file, head) {
  if (!file || !(file.size > 0)) return { ok: false, code: 'empty' };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, code: 'size' };
  const sniffed = head ? sniffImage(head) : null;
  const declared = typeof file.type === 'string' ? file.type.toLowerCase() : '';
  // Der Inhalt entscheidet (nicht Dateiendung oder vom Gerät angegebener Typ); ohne Dateikopf gilt der angegebene Typ.
  const type = sniffed || (head ? null : IMAGE_TYPES[declared] ? declared : null);
  if (!type || !IMAGE_TYPES[type]) return { ok: false, code: 'type' };
  return { ok: true, type, ext: IMAGE_TYPES[type] };
}

/** Neuer Dateiname <UUID v4>.<ext>. Jede Datei bekommt einen neuen Namen, so überschreibt ein Entwurf nie das veröffentlichte Bild. */
export function newImageName(ext, cryptoApi = globalThis.crypto) {
  let id;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') id = cryptoApi.randomUUID();
  else if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
    const b = cryptoApi.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
    id = `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  } else throw new Error('no_crypto');
  const name = `${id.toLowerCase()}.${ext}`;
  if (!isImageName(name)) throw new Error('bad_name');
  return name;
}

/**
 * Vergleicht den gespeicherten Entwurf mit dem veröffentlichten Stand.
 * @returns {'empty'|'unpublished'|'in_sync'|'changed'}
 *   empty = kein gültiger Entwurf, unpublished = noch nie veröffentlicht, in_sync = Entwurf = veröffentlicht, changed = Entwurf weicht ab
 */
export function draftStatus(row) {
  if (!row || !parsePoints(row.draft_points == null ? '' : String(row.draft_points)).ok) return 'empty';
  if (row.published_points == null || !row.published_at) return 'unpublished';
  const same = row.draft_points === row.published_points && (row.draft_image || null) === (row.published_image || null);
  return same ? 'in_sync' : 'changed';
}

/** Ist der veröffentlichte Stand gültig? (Nur dann kann ein Banner erscheinen.) */
export function hasValidPublished(row) {
  return !!row && row.published_points != null && !!row.published_at && parsePoints(String(row.published_points)).ok;
}
