# Nutzernamen: Regeln und wie sie durchgesetzt werden

## Regeln

| Regel | Wert |
|---|---|
| Länge | 3 bis 20 Zeichen |
| Erlaubte Zeichen | `A–Z`, `a–z`, `0–9`, Unterstrich `_` (nur ASCII, keine Umlaute, Leerzeichen, Emojis, Bindestriche) |
| Rand | beginnt und endet mit Buchstabe oder Ziffer (kein `_` am Anfang oder Ende) |
| Schreibweise | bleibt erhalten („Krevo“ wird als „Krevo“ angezeigt) |
| Eindeutigkeit | **ohne Beachtung von Groß-/Kleinschreibung**: „Krevo“, „krevo“ und „KREVO“ sind derselbe Name |
| Normalisierung | Eingabe wird vor der Prüfung getrimmt und Unicode-NFKC-normalisiert (z. B. ganzbreite Buchstaben „ＭａｘＰｌａｙｓ“ → „MaxPlays“). Danach gilt nur ASCII. |
| Reserviert | 27 Namen, u. a. `admin`, `administrator`, `root`, `support`, `system`, `moderator`, `staff`, `krevo`, `help`, `info`, `team`, `official`, `fortnite`, `epicgames`. Für Nutzer gesperrt. Liste: Tabelle `reserved_usernames` und `public/js/username.js` (ein Test hält beide gleich). |
| Meldung bei Duplikat | „Dieser Nutzername ist bereits vergeben.“ |

Diese Regeln stehen an **drei** Stellen, die ein Test (`test/username.test.js`) abgleicht: Browser (`public/js/username.js`, nur für schnelles Feedback), Datenbank-Constraint und Datenbank-Funktionen (`supabase/001_krevo_profiles.sql`, maßgeblich).

## Wo die Eindeutigkeit wirklich entschieden wird

Nicht im Browser. Der Browser prüft nur vorab und zeigt „verfügbar“ oder „vergeben“ an (Funktion `username_available`). Maßgeblich ist der **eindeutige Index** in der Datenbank:

```sql
create unique index profiles_username_lower_key on public.profiles (lower(username));
```

- Zwei gleichzeitige Anfragen mit demselben Namen: Postgres lässt genau eine durch, die andere bekommt `23505 unique_violation` (HTTP 409). Die App zeigt dann „Dieser Nutzername ist bereits vergeben.“ und ändert nichts.
- Die Vorabprüfung kann veraltet sein (jemand anderes war schneller). Das ist ungefährlich, weil beim Speichern der Index entscheidet.
- **Registrierung:** Der Wunschname reist als Metadatum mit. Ein Trigger legt das Profil an. Ist der Name belegt (auch durch eine gleichzeitige Registrierung), bekommt das Konto einen **erzeugten Ersatznamen** (z. B. `Max_1234`), die Registrierung scheitert nicht. Die App sagt das nach dem Anmelden: „Dein Wunschname „…“ war inzwischen vergeben. Du heißt jetzt „…“. Du kannst ihn hier ändern.“
- **Google-Konten** bekommen einen aus ihrem Anzeigenamen abgeleiteten Namen (Umlaute werden umgesetzt, Sonderzeichen entfernt, bei Konflikt vier Ziffern angehängt).

## Weitere Schutzmaßnahmen (Datenbank)

- Spaltenrechte: Nutzer dürfen nur `username` ändern, nicht `id`, `created_at`, `updated_at`.
- Row Level Security: jeder sieht und ändert nur sein eigenes Profil. Profile anlegen und löschen über die API ist verboten (nur Trigger, Löschen mit dem Konto).
- Reservierte Namen sind für angemeldete Nutzer gesperrt, für dich als Betreiber im SQL Editor aber vergebbar (siehe `SETUP-ACCOUNTS.md`, „Eigenen Namen Krevo belegen“).
- Homoglyphen (kyrillisches „а“ statt „a“), Null-Breite-Zeichen und das Kelvin-Zeichen „K“ fallen durch die ASCII-Regel automatisch durch.

## Was getestet ist

`tools/db_test.py` (gegen ein echtes PostgreSQL 16, darunter 24 gleichzeitige Datenbankverbindungen, parallele Registrierungen mit gleichem Wunschnamen und zwei Gegenproben, die absichtlich den eindeutigen Index entfernen bzw. die Spaltenrechte ausweiten und zeigen, dass die Prüfung das wirklich bemerkt) und `tools/e2e_auth.py` (Browser gegen einen Supabase-Nachbau auf echtem Postgres: Vorabprüfung, veraltete Vorabprüfung, parallele Umbenennungen über getrennte Verbindungen, direkte API-Angriffe).
