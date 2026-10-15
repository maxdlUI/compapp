// Regeln für Nutzernamen. Sie müssen mit supabase/001_krevo_profiles.sql übereinstimmen
// (ein Test vergleicht Regex und Liste reservierter Namen mit der Migration).
//
//  * 3 bis 20 Zeichen: A-Z, a-z, 0-9 und Unterstrich, am Anfang und Ende Buchstabe oder Ziffer
//  * Schreibweise bleibt erhalten ("Krevo"), für die Eindeutigkeit zählt nur die Kleinschreibung ("krevo")
//  * Eingaben werden vor der Prüfung per NFKC normalisiert und getrimmt (z. B. Ganzbreiten-Zeichen werden ASCII)
//
// Das ist nur die Vorprüfung im Browser für schnelle Rückmeldung. Maßgeblich sind Format-Check und
// eindeutiger Index in der Datenbank.

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const USERNAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_]{1,18}[A-Za-z0-9]$/;

export const RESERVED_USERNAMES = new Set([
  'admin', 'administrator', 'root', 'support', 'system', 'moderator', 'mod', 'staff',
  'krevo', 'krevogg', 'help', 'info', 'contact', 'team', 'official', 'api', 'www',
  'null', 'undefined', 'anonymous', 'everyone', 'owner', 'security', 'abuse', 'epic',
  'fortnite', 'epicgames',
]);

export const normalizeUsername = (raw) => String(raw ?? '').normalize('NFKC').trim();

/** Schlüssel für den Vergleich: nur ASCII erlaubt, daher reicht toLowerCase (wie lower() in der Datenbank). */
export const usernameKey = (name) => normalizeUsername(name).toLowerCase();

/**
 * @returns {{ok: true, value: string, key: string} | {ok: false, code: 'empty'|'short'|'long'|'chars'|'edge'|'reserved', value: string}}
 */
export function validateUsername(raw) {
  const value = normalizeUsername(raw);
  if (value === '') return { ok: false, code: 'empty', value };
  if (value.length < USERNAME_MIN) return { ok: false, code: 'short', value };
  if (value.length > USERNAME_MAX) return { ok: false, code: 'long', value };
  if (/[^A-Za-z0-9_]/.test(value)) return { ok: false, code: 'chars', value };
  if (!USERNAME_PATTERN.test(value)) return { ok: false, code: 'edge', value };
  if (RESERVED_USERNAMES.has(value.toLowerCase())) return { ok: false, code: 'reserved', value };
  return { ok: true, value, key: value.toLowerCase() };
}

/** Anfangsbuchstabe(n) für den Standard-Avatar. */
export function avatarInitial(name, fallback = '?') {
  const m = String(name ?? '').match(/[A-Za-z0-9]/);
  return m ? m[0].toUpperCase() : fallback;
}
