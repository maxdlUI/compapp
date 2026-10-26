# Konten einrichten (Supabase), Schritt für Schritt

KREVO funktioniert ohne Konto. Solange `config.js` leer ist, läuft alles wie bisher, und der Knopf „Anmelden“ erklärt ehrlich, dass Konten noch nicht aktiviert sind. Diese Anleitung schaltet Konten ein. Sie braucht ca. 20 Minuten und **keinen eigenen Server**.

**Wichtig vorab:** Die Konten sind erst „live“, wenn du die Schritte 1 bis 6 gemacht hast. Google-Login ist erst „live“, wenn Schritt 7 erledigt ist. Der Code dafür ist fertig, aber ich konnte ihn nicht gegen dein echtes Supabase-Projekt und nicht gegen Google testen (siehe „Was nicht geprüft ist“ in `README.md`).

## Was wo gespeichert wird

| Daten | Wo | Wer kann sie lesen |
|---|---|---|
| E-Mail, Passwort (nur als Hash), Google-Verknüpfung | Supabase Auth (`auth.users`), vom Auth-Server verwaltet | nur du im Dashboard. Die App kann Passwörter nie lesen. |
| Nutzername, Eintrittsdatum | Tabelle `public.profiles`, verknüpft über die stabile Nutzer-ID (UUID) | jeder Nutzer nur sein **eigenes** Profil (Row Level Security) |
| Timer, Notizen, Presets, Map | im Browser auf dem Gerät | nur das Gerät. Konten ändern daran nichts. |

Konten trennen Anmeldedaten (`auth.users`) und öffentliche Profildaten (`profiles`) bewusst. Die ID ist die einzige Verbindung und ändert sich nie, auch wenn jemand Nutzernamen oder E-Mail ändert.

## Schritt 1: Supabase-Projekt anlegen

1. Auf https://supabase.com ein Konto anlegen, „New project“.
2. Region in der EU wählen (z. B. Frankfurt). Das Datenbank-Passwort sicher aufbewahren. **Es gehört nirgends in die App.**
3. Warten, bis das Projekt bereit ist.

## Schritt 2: Datenbank einrichten (SQL-Migration)

1. Im Dashboard: **SQL Editor → New query**.
2. Den kompletten Inhalt von `supabase/001_krevo_profiles.sql` einfügen und **Run** drücken. Erwartet wird „Success. No rows returned“.
3. Prüfen: **Table Editor** zeigt `profiles` und `reserved_usernames`. Bei `profiles` steht „RLS enabled“.

Das Skript ist wiederholbar (idempotent) und löscht nichts. Es legt an:

- `profiles` (id, username, created_at, updated_at) mit **eindeutigem Index auf `lower(username)`**: derselbe Name in anderer Schreibweise ist ein Duplikat.
- Format-Prüfung (3 bis 20 Zeichen, A–Z, a–z, 0–9, Unterstrich, nicht am Rand), Tabelle `reserved_usernames` (reservierte Namen).
- Trigger: jedes neue Konto (E-Mail oder Google) bekommt automatisch ein Profil. Ist der Wunschname vergeben oder ungültig, bekommt es einen erzeugten Namen, die Registrierung scheitert nie daran.
- Zugriffsregeln (RLS): lesen und ändern nur das eigene Profil, geändert werden kann nur `username`. Anlegen und Löschen über die API ist gesperrt.
- `username_available(candidate)` für die Live-Prüfung im Formular, `ensure_profile()` zum Nachholen eines fehlenden Profils.

Regeln für Nutzernamen: `docs/NUTZERNAMEN.md`.

**Bereits vorhandene Konten** (falls du schon Testkonten hast): Das Skript legt am Ende für jedes Konto ohne Profil eines an.

## Schritt 3: Adressen erlauben (URL Configuration)

**Authentication → URL Configuration**

- **Site URL:** deine App-Adresse, vermutlich `https://maxdlui.github.io/compapp/` (genau so, wie sie im Browser erscheint, inklusive `/compapp/`).
- **Redirect URLs:** `https://maxdlui.github.io/compapp/**` hinzufügen. Zum lokalen Testen zusätzlich `http://localhost:8080/**`.

Die App schickt Nutzer nach Google-Login und E-Mail-Links auf ihre eigene Adresse zurück. Fehlt sie in dieser Liste, leitet Supabase auf die Site URL um oder lehnt ab.

## Schritt 4: E-Mail-Anmeldung prüfen

**Authentication → Providers → Email** (Menünamen ändern sich bei Supabase gelegentlich)

- **Enable Email provider:** an.
- **Confirm email:** empfohlen **an**. Dann muss man den Link aus der E-Mail öffnen, bevor man sich anmelden kann. Die App zeigt dafür die passenden Hinweise. Ist es aus, ist man sofort angemeldet.
- **Minimum password length:** mindestens 8 (die App verlangt ebenfalls 8).

## Schritt 5: E-Mail-Versand für echte Nutzer (wichtig)

Der eingebaute Mail-Versand von Supabase ist **nur zum Ausprobieren**: Laut Supabase-Dokumentation (https://supabase.com/docs/guides/auth/auth-smtp, abgerufen am 15.10.2026) liefert er nur an Adressen aus deinem Supabase-Team, mit derzeit 2 Mails pro Stunde, ohne Garantie. Für echte Nutzer brauchst du einen eigenen SMTP-Dienst (z. B. Resend, Brevo, Postmark) unter **Authentication → SMTP Settings**. Ohne das können sich fremde Personen zwar registrieren, bekommen aber keine Bestätigungs- oder Reset-Mail.

Optional: Mail-Vorlagen (Deutsch) unter **Authentication → Email Templates** anpassen.

## Schritt 6: Öffentliche Schlüssel in die App eintragen

1. **Project Settings → API** (oder „API Keys“): **Project URL** und den **öffentlichen** Schlüssel kopieren (`anon` bzw. `publishable`).
2. In `public/js/config.js` (bei der flachen Variante: `config.js`) eintragen:

```js
export const CONFIG = {
  supabaseUrl: 'https://DEINPROJEKT.supabase.co',
  supabaseAnonKey: 'DER_ÖFFENTLICHE_SCHLÜSSEL',
};
```

3. Datei bei GitHub hochladen. In `sw.js` die Zeile `const CACHE = '…';` um eins erhöhen (die mitgelieferte Version von V6 steht auf `krevo-v7`, danach `krevo-v8` usw.), damit auch Geräte mit alter Version die neue Konfiguration laden.

**NIEMALS** eintragen: den `service_role`- bzw. „secret“-Schlüssel, das Datenbank-Passwort oder das Google-Client-Secret. Alles in `config.js` kann jeder Besucher lesen. Der öffentliche Schlüssel ist dafür gedacht. Geschützt sind die Daten durch die Zugriffsregeln aus Schritt 2, nicht durch Geheimhaltung des Schlüssels. Ein Test (`test/security.test.js`) schlägt fehl, wenn ein Schlüssel dieser Art im Code steht.

Danach: App öffnen, „Anmelden“ → „Registrieren“ → Konto anlegen.

## Schritt 7: Google-Login (optional, erst danach „live“)

Dieser Schritt passiert in der Google Cloud Console und im Supabase-Dashboard. Das kann nur du (Google-Konto nötig). Quelle: https://supabase.com/docs/guides/auth/social-login/auth-google (abgerufen am 15.10.2026).

1. **Google Cloud Console** (https://console.cloud.google.com): Projekt anlegen oder wählen.
2. **Google Auth Platform** (OAuth-Zustimmungsbildschirm): Audience/Zielgruppe festlegen, App-Namen „KREVO“ und Support-E-Mail eintragen. Datenzugriff: `openid`, `userinfo.email`, `userinfo.profile` (Standard).
3. **Clients → Create client → Web application:**
   - *Authorized JavaScript origins:* `https://maxdlui.github.io` (nur die Domain, ohne Pfad). Zum Testen lokal zusätzlich `http://localhost:8080`, später wieder entfernen.
   - *Authorized redirect URIs:* die **Callback-URL aus Supabase** (Dashboard → Authentication → Providers → Google, Feld „Callback URL“, Form `https://DEINPROJEKT.supabase.co/auth/v1/callback`).
4. **Client-ID und Client-Secret** kopieren.
5. **Supabase → Authentication → Providers → Google:** Client-ID und Client-Secret eintragen, Provider **aktivieren**, speichern. Das Secret liegt damit nur bei Supabase.
6. Prüfen: In der App „Anmelden“ öffnen. Der Google-Knopf ist jetzt bedienbar. Solange der Provider in Supabase aus ist, zeigt die App den Knopf **gesperrt mit dem Hinweis „Die Google-Anmeldung ist noch nicht eingerichtet“** und versucht keine Weiterleitung.

Hinweise:
- Im Testmodus des Zustimmungsbildschirms dürfen sich nur eingetragene Testnutzer anmelden. Für alle Nutzer muss die App „veröffentlicht“ werden.
- Die App erkennt selbst, ob Google aktiv ist (Abfrage von `/auth/v1/settings`). Du musst im Code nichts umschalten.

## Eigenen Namen „Krevo“ belegen

Der Name `krevo` (und weitere wie `admin`) ist für Nutzer **gesperrt**. Du kannst ihn dir selbst geben, nachdem du dein Konto angelegt hast: SQL Editor:

```sql
update public.profiles set username = 'Krevo'
where id = (select id from auth.users where email = 'DEINE@EMAIL');
```

Das funktioniert, weil die Sperre nur für angemeldete Nutzer über die App gilt, nicht für den SQL Editor.

## Schritt 8: Admin-Rechte und Estimated Qual (Version 5)

Für den optionalen „Estimated Qual“-Banner und die Verwaltung dafür gibt es die zweite Migration `supabase/002_krevo_admin_estimated_qual.sql`. Sie setzt `001` voraus (Schritt 2). Einspielen wie dort: SQL Editor → New query → Inhalt einfügen → Run. Danach legst du dein Konto als Administrator fest (eine SQL-Anweisung mit deiner E-Mail-Adresse). Alles Weitere steht in **`docs/ADMIN.md`**.

Ohne diesen Schritt ändert sich für Besucher nichts: Die App fragt dann zwar einmal an, bekommt aber „nicht vorhanden“ und zeigt keinen Banner.

## Schritt 9: Team-Modus für Net Damage (Version 6, optional)

Für den Team-Modus (Duo/Trio, „Team Net Surge“) gibt es die dritte Migration `supabase/003_krevo_team_net_damage.sql`. Sie setzt nur `001` voraus (Schritt 2), `002` wird nicht gebraucht. Einspielen wie immer: SQL Editor → New query → Inhalt einfügen → Run. Danach ist nichts weiter einzustellen. Bedienung, Regeln und Sicherheitsmodell: **`docs/TEAM.md`**.

Ohne diesen Schritt bleibt Solo unverändert. Der Team-Knopf erscheint (sobald Konten laufen) und meldet beim Erstellen einer Session kurz einen Fehler.

## Eine Änderung später einspielen

Weitere Migrationen kommen als `004_….sql` usw. und werden in Reihenfolge im SQL Editor ausgeführt. Frühere Migrationen müssen nicht erneut laufen (sind aber wiederholbar und unschädlich).

## Fehlersuche

| Beobachtung in der App | Wahrscheinliche Ursache |
|---|---|
| „Konten sind noch nicht aktiviert“ | `config.js` ist leer oder die URL ist keine `https://…supabase.co`-Adresse |
| „Die Datenbank ist noch nicht vollständig eingerichtet (Migration fehlt)“ | Schritt 2 (Profile), Schritt 8 (Admin, Estimated Qual) oder Schritt 9 (Team-Modus) nicht ausgeführt |
| Registrierung klappt, aber keine E-Mail | Schritt 5 (SMTP) fehlt, oder Mail im Spam |
| „Link abgelaufen“ direkt nach dem Klick | Link schon benutzt, oder E-Mail-Programm hat ihn vorab geöffnet (Link-Scanner). Neuen Link anfordern. |
| Nach Google-Login „in einem anderen Browser gestartet“ | Anmeldung wurde im Browser gestartet und in einer anderen App (z. B. eingebetteter Browser) beendet. Auf iPhone: in Safari starten und dort beenden. |
| Google-Knopf gesperrt | Schritt 7 nicht erledigt |
| Weiterleitung auf falsche Seite | Schritt 3: Redirect URL fehlt |

## iPhone-Besonderheit (bitte selbst prüfen)

Die Web-App auf dem Home-Bildschirm („Zum Home-Bildschirm“) und Safari haben auf iOS **getrennte Speicher**. Das betrifft vor allem E-Mail-Links: Öffnet man den Bestätigungs- oder Reset-Link aus der Mail-App, landet man in Safari, nicht in der installierten App. Die Anmeldung gilt dann in Safari. In der installierten App meldet man sich danach einmal mit E-Mail und Passwort an. Der Google-Login sollte komplett in einem Kontext ablaufen. Das ließ sich ohne iPhone nicht testen. Bitte probiere beides einmal auf deinem Gerät.
