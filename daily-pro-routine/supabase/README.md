# Repline · Supabase

- Projekt: `repline` (Organisation „krevo“, Region Frankfurt, Gratis-Plan)
- API-URL: `https://wjwjvwjwlipjxsgufffj.supabase.co`
- Öffentlicher Schlüssel (darf in die Webseite): `sb_publishable_xA1CO4em6oz2mocDqBC5jg_4WhlX13q`
- Discord-Callback (im Discord Developer Portal eintragen): `https://wjwjvwjwlipjxsgufffj.supabase.co/auth/v1/callback`
- Site URL: `https://repline.pages.dev` · Redirect URLs: `https://repline.pages.dev/**`, `https://preview.repline.pages.dev/**`

## Tabellen (`001_accounts.sql`)

Alle Tabellen haben Row Level Security: Jeder sieht nur seine eigenen Daten.

- `profiles`: Name, Avatar, Discord-ID, `is_dev` (Dev-Account, nur im Dashboard setzbar)
- `user_state`: Einstellungen, Today's focus, laufende Routine
- `training_days`: Trainingstage für die Streak
- `referral_codes`: eigener Empfehlungscode, wird bei der Anmeldung automatisch erstellt
- `referral_signups`: wer sich über wessen Link angemeldet hat
- Funktion `claim_referral(code)`: zählt eine Empfehlung, aber nur für neue Konten und nie für sich selbst.

Ein Dev-Account wird so freigeschaltet: Dashboard → Table Editor → `profiles` → `is_dev` auf `true`.
