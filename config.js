// Öffentliche Konfiguration für Konten (Supabase). Einrichtung: SETUP-ACCOUNTS.md.
//
// Hier gehören NUR öffentliche Werte hinein:
//   supabaseUrl      z. B. 'https://abcdxyz.supabase.co'      (Supabase > Project Settings > API > Project URL)
//   supabaseAnonKey  der öffentliche Schlüssel ("anon" oder "publishable")
//
// NIEMALS den "service_role"-Schlüssel, ein Datenbank-Passwort oder ein Discord-Client-Secret eintragen:
// Alles in dieser Datei kann jeder Besucher der Seite lesen. Der öffentliche Schlüssel ist dafür gedacht;
// geschützt werden die Daten durch die Zugriffsregeln in der Datenbank (supabase/001_krevo_profiles.sql).
//
// Solange beide Werte leer sind, funktioniert die App wie bisher, nur ohne Konten.
export const CONFIG = {
  supabaseUrl: 'https://mwaszqstxhpofxomjagn.supabase.co',
  supabaseAnonKey: 'sb_publishable_rPR0o6UP2kpmg7AWP3HSRg_kU3Hl18u',
};
