# Discord-Anmeldung (Version 7)

Discord ist die erste Anmeldeoption in KREVO. E-Mail und Passwort funktionieren weiter. Google-Login ist entfernt.

## Wie es technisch läuft

KREVO ist eine statische Seite auf GitHub Pages ohne eigenen Server. Die Anmeldung übernimmt **Supabase Auth**, das Discord als Anbieter direkt unterstützt (offizieller OAuth2-Flow von Discord, Scopes `identify` und `email`).

1. Tippt man auf **Mit Discord fortfahren**, erzeugt der Browser einen geheimen Code-Verifier (PKCE) und leitet zu Supabase weiter, Supabase weiter zu Discord.
2. Discord fragt nach der Freigabe und schickt zurück zu Supabase. Supabase prüft dabei selbst den `state`-Parameter (CSRF-Schutz) und tauscht den Discord-Code mit dem **Client-Secret** ein. Das Secret liegt nur in Supabase, nie im Browser und nie auf GitHub.
3. Supabase leitet mit einem Einmal-Code zurück zur App. Die App tauscht ihn nur zusammen mit dem Verifier aus Schritt 1 gegen eine Sitzung. Ein Code aus einem anderen Browser oder ein untergeschobener Code ist ohne diesen Verifier wertlos. Der Verifier gilt 15 Minuten und wird nach Gebrauch gelöscht.
4. Die Sitzung (Zugriffs- und Erneuerungstoken) liegt wie bei E-Mail-Konten im Speicher des Browsers und wird automatisch erneuert.

## Konto, Identität, Käufe

| Begriff | Was es ist | Ändert sich? |
|---|---|---|
| **KREVO-Konto** | `auth.users.id`, eine UUID. Daran hängen Profil, Team-Mitgliedschaft, Admin-Rechte und künftige Käufe (`public.entitlements`). | nie |
| **Discord-Identität** | Eintrag in `auth.identities` mit `provider = 'discord'` und `provider_id` = **feste Discord-User-ID** (Snowflake) | nie (gehört zum Discord-Konto) |
| Discord-Name | wird nur angezeigt | ja, beliebig oft, ohne Folgen |
| KREVO-Nutzername | eigener, eindeutiger Name in `public.profiles` | nur, wenn man ihn selbst ändert |

Meldet sich jemand mit Discord an, sucht Supabase die Identität über die Discord-User-ID. Ein neuer Discord-Name führt deshalb nie zu einem neuen Konto und nie zum Verlust von Käufen. Ein Discord-Konto kann nur an **einem** KREVO-Konto hängen (das erzwingt Supabase). Der Versuch, es ein zweites Mal zu verknüpfen, endet mit der Meldung „schon mit einem anderen KREVO-Konto verbunden“.

## Bestehende Konten

- **E-Mail-Konten** bleiben, wie sie sind. Im Profil gibt es **Mit Discord verbinden**: Das läuft nur, solange man angemeldet ist, Supabase hängt die Discord-Identität an genau dieses Konto, und die App prüft nach der Rückkehr zusätzlich, dass es dieselbe interne Konto-ID ist. **Discord trennen** (zweimal tippen) geht, solange ein anderer Anmeldeweg bleibt.
- **Google-Konten:** Am 27.10.2026 gab es im Projekt **keine** (abgefragt in `auth.identities`: genau ein Konto, Anbieter E-Mail). Es wird also niemand ausgesperrt. Falls doch noch jemand ein Google-Konto hätte: „Passwort vergessen?“ mit der Google-Adresse setzt ein Passwort, danach kann man Discord im Profil verbinden.
- **Automatische Verknüpfung durch Supabase:** Meldet sich jemand mit Discord an, dessen bei Discord **bestätigte** E-Mail-Adresse zu einem bestehenden, ebenfalls **bestätigten** KREVO-Konto gehört, hängt Supabase Discord an dieses Konto, statt ein zweites anzulegen. Das ist festes Verhalten von Supabase Auth und lässt sich dort nicht abschalten. Es greift nur bei auf beiden Seiten bestätigten Adressen. Wer das nicht möchte, verbindet Discord stattdessen bewusst im Profil. Eine ungeprüfte Adresse führt nie zur Verknüpfung.

## Einrichten (einmalig, ca. 10 Minuten)

### 1. Discord Developer Portal

1. https://discord.com/developers/applications → **New Application**, Name z. B. „KREVO“.
2. Links **OAuth2**:
   - **Client ID** kopieren.
   - **Reset Secret** → **Client Secret** kopieren (wird nur einmal angezeigt; nirgends speichern außer in Supabase).
   - **Redirects → Add Redirect:** `https://mwaszqstxhpofxomjagn.supabase.co/auth/v1/callback` (genau so, das ist die Callback-Adresse deines Supabase-Projekts; sie steht auch in Supabase unter Authentication → Providers → Discord).
   - Speichern.
3. Optional unter **General Information**: App-Symbol und Beschreibung, die Nutzer auf der Freigabeseite sehen.

### 2. Supabase

1. **Authentication → Sign In / Providers → Discord:** aktivieren, **Client ID** und **Client Secret** eintragen, speichern.
2. **Authentication → URL Configuration:**
   - *Site URL:* `https://maxdlui.github.io/compapp/`
   - *Redirect URLs:* `https://maxdlui.github.io/compapp/**` (falls noch nicht vorhanden; für lokale Tests zusätzlich z. B. `http://localhost:8080/**`)
3. **Authentication → Sign In / Providers (Abschnitt „User Signups“) → Allow manual linking: an.** Ohne diesen Schalter funktionieren **Mit Discord verbinden** und **Discord trennen** im Profil nicht (die App zeigt dann „Das Verbinden mit Discord ist noch nicht freigeschaltet“). Die Anmeldung mit Discord selbst braucht ihn nicht.
4. **SQL Editor:** `supabase/004_krevo_entitlements.sql` einspielen (Grundlage für spätere Käufe, siehe unten). Wiederholbar, löscht nichts.

### 3. Prüfen

- In der App **Anmelden** öffnen: Der Discord-Knopf steht oben und ist bedienbar. Solange Discord in Supabase aus ist, ist er **gesperrt** und darunter steht „Die Discord-Anmeldung ist noch nicht eingerichtet“. Die App fragt das selbst bei Supabase ab, im Code muss nichts umgeschaltet werden.
- Einmal mit Discord anmelden, abmelden, wieder anmelden: Es darf nur ein Konto entstehen (Supabase → Authentication → Users).
- Mit einem E-Mail-Konto im Profil **Mit Discord verbinden**, danach **Discord trennen**.

## Umgebungsvariablen

Es gibt keine. KREVO hat keinen Build-Schritt und keinen eigenen Server, deshalb auch keine `.env`-Datei. Im Frontend stehen nur die öffentlichen Werte in `config.js` (Projekt-URL und öffentlicher Schlüssel). Die einzigen geheimen Werte der Discord-Anmeldung sind:

| Wert | Wo er hingehört | Niemals |
|---|---|---|
| Discord Client ID | Supabase → Providers → Discord | (nicht geheim, trotzdem nur dort nötig) |
| Discord Client Secret | Supabase → Providers → Discord | in `config.js`, in GitHub, in Chats |

Ein Test (`test/security.test.js`) schlägt fehl, wenn ein Schlüssel nach Art eines Secrets im Frontend steht.

## Käufe vorbereiten (`supabase/004_krevo_entitlements.sql`)

- Tabelle `public.entitlements`: Berechtigung je **interner Konto-ID** (`user_id`), Produktname, Quelle (`manual`, später der Zahlungsanbieter), externe Kennung (eindeutig je Quelle, damit ein doppelt gemeldeter Kauf keine zweite Berechtigung erzeugt), Beginn, Ablauf, Entzug (statt Löschen, der Verlauf bleibt).
- Nutzer lesen nur ihre eigenen Zeilen. Schreiben über die API darf niemand, auch nicht der eigene Nutzer. Einträge entstehen im SQL Editor oder später serverseitig (Webhook des Zahlungsanbieters mit dem `service_role`-Schlüssel, z. B. als Supabase Edge Function). Das ist noch nicht gebaut.
- `public.has_entitlement('premium')` beantwortet für den angemeldeten Nutzer, ob eine gültige Berechtigung besteht.

## Grenzen und offene Punkte

- Getestet gegen einen Nachbau der Supabase-Schnittstellen (`tools/mock_supabase.py`) mit einer Attrappe der Discord-Freigabeseite, **nicht gegen echtes Discord und echtes Supabase**. Bitte nach der Einrichtung einmal komplett durchspielen.
- Die feste Discord-User-ID steht in `auth.identities`, nicht in einer eigenen Tabelle. Das ist der von Supabase vorgesehene Ort; dort ist sie eindeutig.
- Discord übermittelt Profilbild-Adressen von `cdn.discordapp.com`. Das Bild wird im Konto-Knopf direkt von Discord geladen (siehe Datenschutzseite).
