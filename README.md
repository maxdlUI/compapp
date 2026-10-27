# KREVO: Fortnite-Competitive-Companion (PWA), Version 7

Unabhängiges Fanprojekt, nicht von Epic Games oder Fortnite unterstützt oder betrieben. Läuft als Web-App in Safari auf iPhone, iPad und Desktop. Reines HTML, CSS und JavaScript (ES-Module), kein Build-Schritt, keine Abhängigkeiten, nichts wird von Fremdservern nachgeladen.

Werkzeuge: **Storm-Timer** (Schätzung, 1/2/5/8/10 Schaden pro Sekunde) mit **Storm-Sickness-Warnung**, **Net Damage** (solo oder im Team), **Rotation-Countdown** mit eigenen Presets, **Map** (eigenes Bild hochladen und groß ansehen). Oberfläche auf **Deutsch und Englisch**.

**Neu in Version 7:** Anmeldung mit **Discord** (erste Option, E-Mail und Passwort bleiben, Google entfernt), Discord im Profil verbinden und trennen, Datenbank-Grundlage für spätere Käufe, deutlich bedrohlichere **Storm-Sickness-Warnung** mit zwei Warnstufen und Animation. **Entfernt:** Match-Notizen. Anleitung Discord: `docs/DISCORD.md`.

**Neu in Version 6:** optionaler **Team-Modus** für Net Damage (Duo/Trio, Einladungslink, „Team Net Surge“ als Summe). Solo bleibt unverändert und braucht kein Konto. Anleitung: `docs/TEAM.md`.

**Version 5:** Admin-Rechte (in der Datenbank abgesichert) und der optionale Banner **„Estimated Qual“** mit Verwaltung. Standardmäßig **aus**: dann ist die Seite identisch zu vorher. Anleitung: `docs/ADMIN.md`.

**Version 4:** Marke KREVO, Konten (E-Mail und Passwort, damals auch Google), Profil mit eindeutigem Nutzernamen, kurzes Willkommens-Intro. **Entfernt:** Storm Surge.

> **Ehrlicher Stand in einem Satz:** Alles ist gebaut und getestet, aber nicht gegen ein echtes Supabase-Projekt. Konten sind erst „live“, wenn du ein Supabase-Projekt angelegt, die SQL-Dateien ausgeführt und zwei öffentliche Werte in `config.js` eingetragen hast (`SETUP-ACCOUNTS.md`). Admin und Estimated Qual brauchen zusätzlich `supabase/002_…sql` und einen Admin-Eintrag (`docs/ADMIN.md`), der Team-Modus `supabase/003_…sql` (`docs/TEAM.md`). Discord-Login braucht die Einrichtung bei Discord und in Supabase (`docs/DISCORD.md`). Bis dahin läuft die App wie bisher, und der Konto-Knopf sagt offen, was fehlt.

## Was in Version 7 geändert wurde

### Discord statt Google
- **Mit Discord fortfahren** steht in Anmelden und Registrieren ganz oben (Discord-Blau, Discord-Logo), darunter „oder mit E-Mail“ und die bisherigen Felder. Anmelden und Registrieren mit Discord sind derselbe Ablauf: Beim ersten Mal legt Supabase das Konto an, der KREVO-Nutzername wird aus dem Discord-Namen abgeleitet (eindeutig, bei Konflikt mit Ziffern).
- Ablauf über **Supabase Auth mit PKCE**: Das Discord-Client-Secret liegt nur in Supabase, Supabase prüft den OAuth-`state`, die App nimmt einen Rückkehr-Code nur mit dem eigenen Verifier an. Details: `docs/DISCORD.md`.
- **Konto = interne UUID.** Discord hängt als Identität mit der **festen Discord-User-ID** daran. Ein neuer Discord-Name ändert weder das Konto noch den KREVO-Nutzernamen (im Browsertest geprüft).
- **Profil:** Zeile „Discord“ (verbunden mit Anzeigename oder „Nicht verbunden“), **Mit Discord verbinden** für bestehende E-Mail-Konten (nur angemeldet, die App prüft nach der Rückkehr, dass es dasselbe Konto ist), **Discord trennen** mit zweitem Tippen, nur wenn ein anderer Anmeldeweg bleibt. Ein Discord-Konto, das schon an einem anderen KREVO-Konto hängt, wird abgewiesen („schon mit einem anderen KREVO-Konto verbunden“), es entsteht kein Doppelkonto.
- **Google** ist vollständig aus Oberfläche, Auth-Client, Texten, Tests und Doku entfernt. Im Projekt gab es kein Google-Konto (geprüft am 27.10.2026), niemand wird ausgesperrt.
- Hinweis: Supabase verknüpft eine Discord-Anmeldung automatisch mit einem bestehenden Konto, wenn beide E-Mail-Adressen bestätigt und gleich sind. Das ist festes Supabase-Verhalten (siehe `docs/DISCORD.md`).

### Grundlage für Käufe
- `supabase/004_krevo_entitlements.sql`: Tabelle `entitlements` je interner Konto-ID, nur eigene Zeilen lesbar, über die API nicht beschreibbar, doppelte Kauf-Ereignisse ausgeschlossen, Funktion `has_entitlement()`. Noch ohne Zahlungsanbieter und ohne Anzeige in der App.

### Storm-Sickness-Warnung
- Die Warnstufen kommen ausschließlich aus den bisherigen Schwellen: **normal** unter 500 Schaden, **Warnung** ab 500, **akut** ab 600 (geschätzter Storm-Schaden wie bisher). Keine neuen Grenzwerte, Timer und Berechnung unverändert.
- Neues Warnfeld unter der Zeit nach dem Vorbild der Fortnite-Meldung: lila, Dreieck mit Biohazard-Zeichen (selbst nachgezeichnet, kein Spiel-Asset), weiße Großbuchstaben, Handlungsaufforderung in Orange („Verlasse den Storm.“ bzw. „Sofort raus aus dem Storm!“). Normal ist es ruhig und grau.
- **Warnung** pulsiert langsam (1,8 s), **akut** schneller (0,75 s) mit kräftigerem Lila, breiterem Rahmen und pochendem Symbol. Die Stufen unterscheiden sich auch ohne Farbe (Titel, Text, Symbolgröße). Die Animation läuft nur, solange der Timer läuft; pausiert bleibt die Warnung stehen, Reset beendet sie sofort. Bei „Bewegung reduzieren“ gibt es keine Animation, die Stufen bleiben an Farbe, Rahmen und Text erkennbar.
- Die grünen Haken an den Schwellen 500 und 600 sind durch das Gefahrensymbol ersetzt (500 lila umrandet, 600 lila gefüllt).
- Das Warnfeld hat eine feste Höhe, die Karte springt beim Stufenwechsel nicht (gemessen bei 320 bis 1280 px).

### Match-Notizen entfernt
- Bereich, Navigationspunkt, Code, Texte, Styles und Tests sind entfernt. Notizen lagen nur im Browser, es gab keine Datenbank-Tabelle. Vorhandene alte Notizen im Browser (`fnc.v1.notes`, `fnc.v1.draft`) werden nicht mehr angezeigt, aber auch **nicht gelöscht**.

### Sonst
- Datenschutzseite, Meta-Beschreibungen, Manifest und Vorschaubild ohne Notizen, mit Discord. `sw.js` auf `krevo-v9`.

## Was in Version 6.1 geändert wurde (Auffindbarkeit, Datenschutz, 404)

Keine Änderung an Werkzeugen, Berechnungen, Konten, Team-Modus oder Datenbank.

- **Seitentitel** nennt jetzt den Zweck („KREVO · Storm-Timer und Net Damage für Fortnite Competitive“) und wechselt mit der Sprache. Der Name auf dem Homescreen bleibt „KREVO“ (`apple-mobile-web-app-title`, Manifest).
- **Vorschau beim Teilen:** `canonical`, Open Graph (`og:title`, `og:description`, `og:image`, `og:url`, `og:type`) und Twitter-Karte. Das Vorschaubild `icons/og-image.png` (1200×630) besteht nur aus Logo, Wortmarke und Text, ohne Fortnite-Assets.
- **Eine `h1`** für Suchmaschinen und Screenreader: die Wortmarke in der Kopfzeile plus ein nur vorgelesener Zusatz. Optisch unverändert.
- **Fußzeile:** Der Satz zu Konten war seit dem Team-Modus ungenau und nennt jetzt auch die Team-Werte. Neuer Link **Datenschutz**.
- **`datenschutz.html`:** Entwurf, der beschreibt, was die App tatsächlich verarbeitet (Gerätespeicher, GitHub Pages, Supabase mit Server in Frankfurt, Google-Login, Team-Modus, Estimated Qual). **Die Angaben zum Verantwortlichen fehlen** und müssen ergänzt werden. Bis dahin steht die Seite auf `noindex` und nicht in der Sitemap. Keine Rechtsberatung.
- **`404.html`:** eigene Fehlerseite im KREVO-Stil. GitHub Pages liefert sie für unbekannte Adressen mit Status 404 aus. Links zeigen absolut auf `/compapp/`.
- **`robots.txt` und `sitemap.xml`** (nur die Startseite). Hinweis: Suchmaschinen lesen `robots.txt` nur im Wurzelverzeichnis der Domain (`maxdlui.github.io/robots.txt`). Unter `/compapp/` wirkt sie erst mit eigener Domain. Die Sitemap kann man in der Google Search Console direkt einreichen.
- `sw.js` auf `krevo-v8`, `datenschutz.html` ist im Offline-Cache.
- Nicht eingebaut, mit Absicht: Cookie-Banner (die App setzt keine Cookies und nutzt keine Analyse), Analytics, AGB und eine feste Aktionsleiste auf dem Handy (sie würde Tracker-Knöpfe verdecken).

## Was in Version 6 geändert wurde

### Team-Modus für Net Damage
- **Optional.** Solo ist unverändert: ohne Konto, mit denselben Feldern, Schnellknöpfen, „Rückgängig“, „Reset“ und denselben gespeicherten Werten. Neu ist nur ein kleiner Knopf **Team** in der Kopfzeile des Net-Damage-Bereichs (auf dem Handy als Symbol; die Kopfzeile bleibt einzeilig, bei 320 px Breite darf er in eine zweite Zeile rutschen).
- **Duo (2) oder Trio (3):** Session erstellen, **Link kopieren**, der andere öffnet den Link (landet direkt in der passenden Session, bei Bedarf nach Anmeldung) oder fügt ihn unter „Mit Link beitreten“ ein. Kompakte Beitrittsansicht mit Größe, belegten Plätzen und Leitung. Volle, abgelaufene, beendete oder ungültige Links bekommen eine kurze Meldung.
- **Eigener Tracker je Mitglied:** Damage Dealt, Damage Taken und persönliche **Net Damage** (Dealt − Taken). Nur die eigenen Werte sind änderbar, die Zeilen der anderen sind reine Anzeige. „Dein Tracker · Name“ zeigt, wem der Tracker gehört. Beim Verlassen kommen die Solo-Werte zurück (sie wurden nie angetastet).
- **Team Net Surge** (genau diese Schreibweise; persönlich bleibt „Net Damage“): Summe der Net-Damage-Werte aller Mitglieder, nicht von Hand eingebbar, jedes Konto genau einmal (auch bei Neuladen, zwei Tabs, zweitem Gerät). Es ist eine Summe von **selbst eingetragenen Werten**, keine Erkennung eines Ingame-Schwellenwerts.
- **Abgleich:** alle 3 Sekunden (kein WebSocket, kein Supabase Realtime, bewusst einfach), eigene Änderungen nach 0,25 s gesammelt. Kleine Verbindungsanzeige („Offline, verbinde neu …“), automatische Wiederverbindung. Veraltete Schreibzugriffe überschreiben nichts: Die Datenbank lehnt sie ab (Versionsnummer je Zeile), der Wert der Datenbank gilt und die App zeigt einen kurzen Hinweis.
- **Teamverwaltung:** Namen, belegte und freie Plätze, Link jederzeit erneut kopierbar, **Verlassen** und (nur Leitung) **Beenden** mit Rückfrage durch zweites Tippen. Geht die Leitung, übernimmt das am längsten anwesende Mitglied; das letzte Mitglied löscht die Session. Ein Konto kann nur in einer Session gleichzeitig sein. Sessions laufen 12 Stunden nach der letzten Aktivität ab.
- **Sicherheit in der Datenbank** (`supabase/003_krevo_team_net_damage.sql`): Row Level Security (nur Mitglieder lesen, niemand schreibt über die Tabellen), acht Funktionen als einzige Schnittstelle, Nutzer-ID kommt immer aus dem Token (`auth.uid()`), Werte nur in der eigenen Zeile, zufällige 22-Zeichen-Kennung (122 Bit), Beitritt zum letzten Platz serialisiert, Versionsprüfung. Keine Geheimnisse im Frontend. Details: `docs/TEAM.md`.
- Alle neuen Texte sind in `i18n.js` (DE und EN). Neuer Speicherschlüssel im Browser: nur `fnc.v1.teamInvite` (eine wartende Einladung, höchstens 24 Stunden).

## Was in Version 5 geändert wurde

### Admin-Rechte
- Wer Administrator ist, steht in der Datenbank-Tabelle `admins` und wird über die **interne Nutzer-ID** (UUID) erkannt, nicht über Namen oder Einstellungen im Browser. Die Tabelle hat keinerlei API-Rechte: Niemand kann sich über die App zum Admin machen. Eintragen geht nur im SQL Editor von Supabase (`docs/ADMIN.md`: eine SQL-Anweisung, die die ID über deine E-Mail-Adresse selbst findet).
- Normale Konten und Besucher sehen den Admin-Zugang nicht (Knopf „Estimated Qual verwalten“ im Profil). **Die Sicherheit liegt nicht darin**: Jede Änderung prüft die Datenbank (Zeilenregeln, Spaltenrechte, Speicherregeln, `is_admin()`). Ein mit Gewalt eingeblendeter Knopf öffnet nur eine leere Verwaltung.

### Estimated Qual
- Optionaler Banner als **erstes Element im Hauptbereich, direkt unter der Navigation**. Der Kopfbereich bleibt unverändert. Text: „Estimated Qual: [Wert] Points“ (in Deutsch und Englisch, die Zahl mit Tausendertrennung der Sprache). Den Wert pflegt der Admin von Hand, es gibt keinen Standardwert und keine Berechnung.
- **Standard: aus.** Ausgeschaltet entsteht **gar kein Element**: kein Banner, keine Überschrift, kein Platzhalter, kein reservierter Platz (per Test gegen die Seite ohne Konfiguration verglichen: Position und Größe aller Bereiche identisch).
- Verwaltung (Profil → „Estimated Qual verwalten“): Schalter, Punkte (1 bis 999999), eigenes Hintergrundbild (JPG/PNG/WebP bis 5 MB, mit Vorschau, Ersetzen, Entfernen), Vorschau des Banners, **Entwurf speichern**, **Veröffentlichen**. Entwurf und veröffentlichter Stand sind getrennt: Ein Entwurf ändert öffentlich nichts. Ausschalten blendet den Banner für alle aus und behält den veröffentlichten Stand. Einschalten zeigt den **zuletzt veröffentlichten** Stand.
- Typografie und Farben fest vorgegeben: Hintergrund `#14120D`, Text `#F4F1E8`, Gold `#E6CF6E` nur für „Estimated Qual“ und eine feine Linie; Zahl groß in der Monospace-Schrift der App, „Points“ klein. Keine Leucht-, Schatten- oder 3D-Effekte.
- Das Bild liegt im **Supabase-Speicher** (Bucket `estimated-qual`), nicht im Browser. In der Datenbank steht nur der Dateiname. Ohne Bild erscheint ein dezenter KREVO-Hintergrund; lädt ein Bild nicht, ebenfalls.
- Alle neuen Texte sind in `i18n.js` (DE und EN). Der Funktionsname „Estimated Qual“ ist in beiden Sprachen gleich (ein Test sucht im ganzen Projekt nach einer falschen Schreibweise).
- Datenbank: `supabase/002_krevo_admin_estimated_qual.sql` (wiederholbar, löscht nichts, ändert bestehende Konten und Profile nicht).

**Was beim Update mit bestehenden Daten passiert:** Nichts wird überschrieben. Neue Speicherschlüssel im Browser gibt es nicht (der Banner wird bewusst nicht zwischengespeichert, damit Ausschalten sofort überall wirkt).

## Was in Version 4 geändert wurde

### Marke KREVO
- Name, Logo, Wortmarke, Favicon, App-Icons, Manifest und Seitentitel stammen jetzt von KREVO. Das Logo wurde aus deinem gelieferten Bild als Vektor nachgezeichnet (Details und Abweichungen: `ASSETS.md`). Das Gold ist auf deinen Wert `#E6CF6E` normalisiert, das Bild hatte ein dunkleres Senfgelb.
- Farben: Hintergrund `#14120D`, Text und Logo `#F4F1E8`, Akzent `#E6CF6E` sparsam. Keine Glows, keine 3D-Effekte, keine Fortnite- oder Epic-Assets.
- Der Hinweis „Unabhängiges Fanprojekt“ bleibt im Fuß der Seite.

### Storm Surge entfernt
Karte, Navigationspunkt, Skripte, Datendatei, Übersetzungen, Tests und die Doku sind vollständig entfernt, auch aus dem Service-Worker-Cache. Ein Test prüft, dass weder Dateien noch Text (DE und EN) übrig sind. **Storm-Timer und Net Damage sind davon nicht betroffen.**

### Konten (Supabase)
- Registrieren mit E-Mail und Passwort, Anmelden, Abmelden, „Passwort vergessen“ mit Reset-Mail und neuem Passwort, Anmelden mit Google, Sitzung bleibt nach dem Neuladen erhalten. Lade-, Prüf- und Fehlerzustände sind eingebaut.
- Die App bleibt **ohne Anmeldung voll nutzbar**. Timer, Notizen, Presets und Map liegen weiter nur im Browser. Konten ändern daran nichts.
- Anmeldedaten (E-Mail, Passwort-Hash, Google-Verknüpfung) liegen im Auth-System von Supabase. Öffentliche Profildaten (Nutzername, Eintrittsdatum) liegen getrennt in `public.profiles`, verknüpft über die unveränderliche Nutzer-ID.
- Im Code stehen nur Projekt-URL und öffentlicher Schlüssel (`config.js`). Ein Test sucht im gesamten `public/` nach Geheimnissen und schlägt bei einem Fund fehl. Der Auth-Client ist handgeschrieben (`public/js/authclient.js`), ohne Bibliothek.
- Google nutzt PKCE. Die App fragt selbst bei Supabase ab, ob Google aktiviert ist, und sperrt den Knopf mit Hinweis, solange das nicht der Fall ist.
- Abgelaufene Sitzungen werden erneuert (nur ein Erneuerungsvorgang gleichzeitig, auch über mehrere Tabs). Bei Netzwerkfehlern bleibt man angemeldet, statt ausgeloggt zu werden. Ein Fehler beim Laden des Profils stört die App nicht.

### Profil und eindeutige Nutzernamen
- Nach der Anmeldung zeigt der Knopf oben den Avatar (Initiale, wenn kein Bild vorhanden). Das Profil erlaubt Nutzername ändern, E-Mail ansehen (nicht ändern) und Abmelden.
- Nutzernamen: 3 bis 20 Zeichen, A–Z, a–z, 0–9 und Unterstrich, nicht am Rand, Groß-/Kleinschreibung wird beim Vergleich ignoriert („Max“ und „max“ sind derselbe Name). Reservierte Namen (z. B. `krevo`, `admin`) sind für Nutzer gesperrt.
- **Die Eindeutigkeit wird in der Datenbank erzwungen**, nicht nur im Formular: ein eindeutiger Index auf `lower(username)`. Bei gleichzeitigem Zugriff gewinnt genau einer, alle anderen bekommen „Dieser Nutzername ist bereits vergeben.“ Die Live-Prüfung im Formular ist nur eine Komfortfunktion. Regeln und Tests: `docs/NUTZERNAMEN.md`.
- Die Sprachumschaltung ändert keine Profildaten. Alle neuen Texte sind in `i18n.js` (DE und EN).

### Willkommens-Intro
Kurze Animation nur mit CSS (kein Ton, keine Partikel). Beim ersten Besuch 1,9 Sekunden, bei späteren neuen Sitzungen 0,9 Sekunden, mit „Bewegung reduzieren“ ein ruhiges Einblenden von 0,8 Sekunden. Innerhalb einer Sitzung, nach der Rückkehr von der Anmeldung und bei verstecktem Tab erscheint es nicht. Es blockiert keine Eingaben und verzögert die App nicht. Fällt die Animation aus, beendet ein CSS-Notfall die Einblendung selbst.

## Was beim Update mit deinen Daten passiert

Nichts wird überschrieben oder umgebaut. Alle Speicherschlüssel aus Version 3 (`fnc.v1.storm`, `.net`, `.notes`, `.draft`, `.prefs`, `.rotation`, `.rotPresets`, `.lang`, IndexedDB `fnc-map`) bleiben unverändert. Neu sind nur `fnc.v1.auth` (Konto-Sitzung), `fnc.v1.authFlow` (kurzlebig während des Google-Logins), die Intro-Merker `fnc.v1.introSeen` (localStorage) und `fnc.v1.introSession` (sessionStorage) sowie seit V6 `fnc.v1.teamInvite` (eine wartende Team-Einladung, höchstens 24 Stunden). Die Team-Werte selbst liegen nie im Browserspeicher, sondern nur in der Datenbank. Surge stand in der Schlüsselliste von Version 3 nicht auf und hatte keinen eigenen Speicherschlüssel.

## Dateien

```
public/                      Die App (diesen Ordner hosten)
  index.html, css/styles.css
  js/app.js                  Oberfläche, Timer, Navigation
  js/logic.js                reine Logik (Storm, Net Damage, Rotation, Notizen)
  js/presets.js, presets-ui.js   Rotation-Presets
  js/i18n.js                 alle Texte DE/EN
  js/map.js                  Map-Upload (IndexedDB)
  js/intro.js                Willkommens-Intro (Steuerung, Animation in CSS)
  js/config.js               öffentliche Konfiguration der Konten (leer ausgeliefert)
  js/authclient.js           Auth-Client für Supabase (Anmeldung, Sitzung, Google/PKCE, Profil-API)
  js/auth-ui.js              Konto-Dialog, Profil, Fehlerzustände
  js/username.js             Prüfregeln für Nutzernamen (identisch zur Datenbank, per Test abgeglichen)
  js/qual.js                 Estimated Qual: reine Logik (Punkteregel, Bilddatei-Prüfung, Formate)
  js/qual-public.js          Estimated Qual: öffentlicher Banner (Abruf, Anzeige, Aktualisierung)
  js/admin-ui.js             Estimated Qual: Verwaltung für Administratoren (wird erst bei Bedarf geladen)
  js/team.js                 Team-Modus: reine Logik (Einladungslinks, Summe, Teamübersicht, Schnittstelle)
  js/team-sync.js            Team-Modus: Abgleich (Abfrage-Takt, Senden, Konflikte, Verbindungsstatus)
  js/team-ui.js              Team-Modus: Dialog, Teamübersicht, Anbindung an den Tracker (wird erst bei Bedarf geladen)
  icons/                     Logo, Wortmarke, Favicon, App-Icons
  manifest.webmanifest, sw.js
supabase/001_krevo_profiles.sql   Datenbank-Migration: Profile (Tabellen, Index, Trigger, Zugriffsregeln)
supabase/002_krevo_admin_estimated_qual.sql   Datenbank-Migration: Admin-Rolle, Estimated Qual, Bildspeicher-Regeln
supabase/003_krevo_team_net_damage.sql   Datenbank-Migration: Team-Modus (Tabellen, Zugriffsregeln, Funktionen)
docs/TEAM.md                 Team-Modus: Bedienung, Regeln, Synchronisation, Sicherheitsmodell
docs/ADMIN.md                Admin einrichten, Estimated Qual bedienen, Sicherheitsmodell
SETUP-ACCOUNTS.md            Konten einrichten, Schritt für Schritt (inkl. Google)
docs/NUTZERNAMEN.md          Regeln und Absicherung der Nutzernamen
brand/                       Logo-Vorlage und gemessene Geometrie
test/                        Unit-Tests (Node)
tools/                       Datenbank-Test, Browser-Tests, Mock-Server, Logo- und Flat-Build
server.js                    kleiner lokaler Testserver ohne Abhängigkeiten
ASSETS.md                    Herkunft und Lizenzen der Assets
```

## Lokal starten und testen

```
npm start                              # http://localhost:8080 (anderer Port: PORT=3000 npm start)
npm test                               # 161 Unit-Tests (Node 18 oder neuer)
python3 tools/db_test.py               # Datenbank-Tests gegen ein echtes PostgreSQL (psql nötig)
PORT=8099 npm start                    # in einem zweiten Terminal, dann:
python3 tools/e2e_check.py http://localhost:8099 shots/   # Browser-Tests der Werkzeuge (Playwright)
python3 tools/e2e_auth.py  http://localhost:8099 shots/   # Browser-Tests Konten/Profil (startet den Mock selbst)
python3 tools/e2e_admin.py http://localhost:8099 shots/   # Browser-Tests Admin und Estimated Qual (startet den Mock selbst)
python3 tools/e2e_team.py  http://localhost:8099 shots/   # Browser-Tests Team-Modus, mehrere Spieler gleichzeitig (startet den Mock selbst)
python3 tools/mutation_e2e.py                             # Gegenproben Admin: baut 12 gezielte Fehler ein, der Test muss jeden finden (ca. 16 Minuten)
python3 tools/mutation_e2e.py team                        # Gegenproben Team-Modus: 8 gezielte Fehler (ca. 20 Minuten)
```

Die Mock-basierten Tests (`e2e_auth`, `e2e_admin`, `e2e_team`, `mutation_e2e`) belegen alle den Port 54321. Sie dürfen deshalb nicht gleichzeitig laufen (`fuser -k 54321/tcp` räumt auf).

Die flache Variante lässt sich genauso prüfen: `python3 -m http.server 8098 -d upload-flat`, dann dieselben Skripte mit `http://localhost:8098` aufrufen. Für `e2e_auth.py` zusätzlich `MOCK_ALLOWED_REDIRECT=http://localhost:8098` setzen (der Mock erlaubt wie Supabase nur eingetragene Rücksprung-Adressen).

## Auf iPhone und iPad installieren und aktualisieren

1. Inhalt hosten über HTTPS (GitHub Pages, Netlify, Cloudflare Pages …), in Safari öffnen, Teilen → „Zum Home-Bildschirm“.
2. Einmal mit Internet öffnen, damit die App sich zwischenspeichert. Danach läuft sie auch offline.

**Flache Variante für den Upload vom iPhone (GitHub Pages):** Safari auf dem iPhone kann keine Ordner hochladen. `python3 tools/make-flat.py` erzeugt `upload-flat/` mit allen 30 Dateien **ohne Unterordner** (Pfade sind schon angepasst; `krevo-logo.svg`, das waagerechte Logo, wird von der App selbst nicht geladen und liegt nur als Markenmaterial bei). Fertig gebaut liegt sie als `compapp-dateien-v6.zip` bei, ohne `config.js` (siehe „Update einspielen“).

**Update einspielen (GitHub Pages):**
1. Im Repository `maxdlUI/compapp` in Safari: „Add file“ → „Upload files“, **alle Dateien** der flachen Variante auswählen. Gleichnamige Dateien werden ersetzt. **`config.js` ist im Update-Paket nicht enthalten und darf nicht überschrieben werden**: Dort stehen deine Supabase-Werte.
2. **Alte Dateien aus Version 3 löschen**, die jetzt nicht mehr gebraucht werden: `surge.js`, `surge-ui.js`, `surge-data.json`. (Sie stören nicht, werden aber nicht mehr geladen.)
3. „Commit changes“ auf `main`, 1 bis 2 Minuten warten.
4. App schließen und zweimal neu öffnen: beim ersten Öffnen lädt der Service Worker die neue Version, beim zweiten ist sie aktiv. Notizen, Presets, Map und Einstellungen bleiben erhalten.

Nach jeder Änderung an App-Dateien (auch `config.js`) in `sw.js` die Zeile `const CACHE = 'krevo-v6';` hochzählen (die mitgelieferte Version von V6 steht auf `krevo-v7`, die nächste wäre `krevo-v8`), sonst bleiben alte Dateien im Cache.

**Konten einschalten:** `SETUP-ACCOUNTS.md`.

## Was in Version 7 getestet wurde (ausgeführt am 27.10.2026)

| Suite | Ergebnis | Neu in Version 7 |
|---|---|---|
| Unit-Tests (`npm test`) | 162 von 162 | Discord-Weiterleitung mit PKCE, Rückkehr, Verknüpfen (nur angemeldet, gleiches Konto), Konto-Wechsel bei der Rückkehr wird verworfen, Discord an fremdem Konto, Trennen nur mit zweitem Anmeldeweg, kein liegengebliebener Verifier; Notiz-Tests entfernt |
| Browser, Werkzeuge (`e2e_check.py`) | 414 von 414 | Storm Sickness: normal, Warnung ab 500, akut ab 600 (auch bei 1/s), Animation je Stufe, Pause stoppt sie, Reset beendet sie, keine grünen Haken, keine Höhenänderung, Sprachwechsel, „Bewegung reduzieren“, 320/390/1280 px; Notizen vollständig entfernt (kein Bereich, Tab oder verstecktes Element), alte Notiz-Daten werden nicht gelöscht |
| Browser, Konten (`e2e_auth.py`) | 327 von 327 | Discord anmelden, abbrechen, Sitzung nach Neuladen, Namensänderung bei Discord ohne neues Konto, reservierter Name, E-Mail-Konto verbinden und trennen, Discord an fremdem Konto abgewiesen, gleiche bestätigte E-Mail ohne Doppelkonto, Verknüpfen nicht freigeschaltet, Discord nicht eingerichtet, kein Google mehr |
| Browser, Team (`e2e_team.py`) | 184 von 184 | unverändert grün |
| Browser, Admin (`e2e_admin.py`) | 237 von 237 | unverändert grün |
| Datenbank (`db_test.py`) | 476 von 476 | Migrationen 001 bis 003 unverändert |
| Datenbank Käufe (`db_test_entitlements.py`) | 18 von 18 | Migration 004: wiederholbar, nur eigene Zeilen, kein Schreiben über die API, doppelte Kauf-Ereignisse, Ablauf, Entzug, Bindung an die interne ID, 2 Gegenproben |

Alle Browser-Suiten liefen zuletzt gegen genau die flachen Dateien, die auf GitHub liegen (Chromium, Supabase-Nachbau mit Discord-Attrappe auf echtem PostgreSQL 16). **Nicht** gegen echtes Discord, echtes Supabase oder ein echtes iPhone.

## Was getestet wurde (ausgeführt am 17.10.2026)

| Suite | Ergebnis | Was sie prüft | Wogegen sie lief |
|---|---|---|---|
| Unit-Tests (`npm test`) | 161 von 161 bestanden | Logik, Presets, Übersetzungen (gleiche Schlüssel, alle benutzten vorhanden, Fehlercodes), Intro-Entscheidung, Nutzernamen-Regeln, **Auth-Client** (Anmeldung, Sitzung, Erneuerung, Google/PKCE, Recovery, Offline, Mehrfach-Tab), **Sicherheit** (keine Geheimnisse, keine Roh-Fehlertexte, kein innerHTML im Konto-Code), **Estimated Qual** (Punkteregel, Bilddatei-Prüfung am Inhalt, Banner-Abruf, Admin-Abfrage, Upload-Format, der Name „Estimated Qual“ wird überall exakt so geschrieben; **V6 Team-Modus** (`test/team.test.js`, 26 Tests): Einladungslinks, Summe, Teamübersicht, Fehlercodes, Abgleich mit nachgebauter Uhr und Schnittstelle (Debounce, nur eine Anfrage gleichzeitig, verspätete Antworten, Konflikte, Offline-Wiederverbindung, Beenden/Verlassen), „Team Net Surge“ exakt geschrieben, keine Geheimnisse und kein `innerHTML`) | Node mit nachgebautem `fetch` und Speicher |
| Datenbank (`tools/db_test.py`) | 476 von 476 bestanden | Index auf `lower(username)`, Format-Prüfung, Reservierungen, Trigger bei Registrierung (auch bei vergebenem/ungültigem Wunschnamen), Zugriffsregeln (RLS, Spaltenrechte, anonym gesperrt), `username_available`, `ensure_profile`, Kaskade beim Löschen, **gleichzeitige Zugriffe über getrennte Verbindungen** (genau einer gewinnt), Gegenproben, die absichtlich Schutz entfernen und Fehlschlag erwarten; **Version 5:** Admin-Rolle (nur per SQL vergebbar, API-Angriffsversuche), Estimated Qual (Standard aus, Prüfregeln, Spaltenrechte, Veröffentlichen nur durch Admin, öffentlicher Abruf nur eingeschaltet und gültig), Speicher-Regeln für das Bild, 10 Gegenproben gegen die neuen Regeln; **Version 6:** Team-Modus (Duo/Trio anlegen, Kapazität, Beitritt idempotent, ein Konto nur in einem Team, gleichzeitige Beitritte zum letzten Platz über getrennte Verbindungen: genau einer gewinnt, gleichzeitiges Erstellen, Versionsprüfung, fremde Zeilen unveränderbar, Zugriffsregeln der Tabellen für Fremde und Anonyme, Leitungsübergabe, Löschen des letzten Mitglieds, Löschen eines Kontos, Ende, Ablauf, Aufräumen, Zufallstest der Invarianten über 150 Schritte) mit 14 Gegenproben gegen die neuen Regeln | **echtes PostgreSQL 16**, aber mit einer Nachbildung der Supabase-Rollen (`tools/db/supabase-shim.sql`), nicht mit Supabase selbst |
| Browser, Werkzeuge (`e2e_check.py`) | 407 von 407 bestanden | alle bestehenden Funktionen (Storm, Net Damage, Rotation und Presets, Notizen, Map, DE/EN, Offline-Start), Marke und Assets, Surge entfernt, Intro-Verhalten, Layout und Touch-Ziele bei 320 bis 1024 px | Chromium über Playwright, **Quell-Version und flache Upload-Variante** (je 407 von 407) |
| Browser, Konten (`e2e_auth.py`) | 307 von 307 bestanden (Quell-Version und flache Upload-Variante). Ein Test wurde angepasst: Der Netzwerkausfall-Test unterbricht jetzt gezielt nur die Profil-Abrufe, weil die Seite seit V5 beim Laden zusätzlich den Banner abfragt. | Registrieren, Anmelden, Abmelden, Reset, Sitzung nach Neuladen, abgelaufene Sitzung, Netzwerkausfall, doppelte Namen (auch parallel: 12 gleichzeitige Änderungen → genau 1 Erfolg; 8 gleichzeitige Registrierungen mit gleichem Wunschnamen → 8 verschiedene Namen), Zugriffsschutz über direkte API-Aufrufe, Sprachwechsel ohne Änderung der Profildaten, Google-Ablauf inkl. Abbruch/Fehler, Layout ohne Überlauf, keine Konsolenfehler | Chromium gegen **`tools/mock_supabase.py`**: ein selbst geschriebener Nachbau der Supabase-Schnittstellen auf einem echten PostgreSQL. **Nicht gegen ein echtes Supabase-Projekt.** |
| Browser, Admin und Estimated Qual (`e2e_admin.py`) | 237 von 237 bestanden (Quell-Version und flache Upload-Variante) | Standard: aus, Seite identisch zu vorher (kein Banner, kein Platz). Admin-Zugang nur für Admins; direkte API-Angriffe (anonym, normaler Nutzer, gefälschtes Token) bleiben wirkungslos. Punkte-Regel, Entwurf getrennt von Veröffentlichung, Ein-/Ausschalten für alle offenen Besucherseiten, Bild hochladen/ersetzen/entfernen samt Aufräumen, Größen- und Typgrenzen auch serverseitig, erneutes Einschalten zeigt den letzten veröffentlichten Stand, entzogene Admin-Rechte, DE/EN, Layout 320 bis 1440 px, Abmelden schließt die Verwaltung | Chromium gegen **`tools/mock_supabase.py`** (inkl. nachgebautem Speicherdienst) auf echtem PostgreSQL. **Nicht gegen ein echtes Supabase-Projekt.** |
| Browser, Team-Modus (`e2e_team.py`) | 184 von 184 bestanden (Quell-Version und flache Upload-Variante) | **Mehrere Spieler gleichzeitig in getrennten Browser-Kontexten:** Solo unverändert (auch Layout 360 bis 768 px), Duo erstellen, Link kopieren, Beitritt per Link inkl. Anmeldung, volles Team, ungültiger/abgelaufener/beendeter Link, gleichzeitige Eingaben, Summe, Schnellknöpfe/Rückgängig/Reset/manuelle Korrektur, ungültige Eingaben, Neuladen und zweiter Tab ohne Duplikate, **Konflikt** (veralteter Tab überschreibt nichts), direkte API-Angriffe (Fremder, Nicht-Leitung, fremde Zeile, Direktzugriff auf Tabellen, anonym), Offline und Wiederverbindung, Verlassen, Nachrücken, Leitungswechsel, Beenden mit Benachrichtigung, Trio, **Wettlauf zweier Spieler um den letzten Platz**, zweites Gerät desselben Kontos, Abmelden/Anmelden, Mitglied ohne übertragene Werte, DE/EN, Layout 320 bis 1440 px und Querformat, Backend ohne Team-Funktionen | Chromium gegen **`tools/mock_supabase.py`** auf echtem PostgreSQL 16 mit den echten Migrationen 001 bis 003. **Nicht gegen ein echtes Supabase-Projekt, nicht auf einem echten iPhone/iPad.** |
| Gegenproben (`mutation_e2e.py`) | 12 von 12 Fehlern erkannt (zuletzt in V5 ausgeführt; der dort geprüfte Admin-Code ist in V6 unverändert), unveränderte Kontrolle 237 von 237 | Baut je einen Fehler absichtlich ein (Banner bleibt nach Ausschalten, Banner nicht ganz oben, Admin-Zugang für alle, Banner trotz „aus“, Zugriffsregeln der Einstellungen offen (zwei Varianten), Veröffentlichen ohne Admin-Prüfung, Speicher-Regeln ohne Admin-Prüfung, Spalten direkt beschreibbar, Entwurf wird öffentlich, Punktegrenze entfernt, Dateityp ungeprüft) und erwartet, dass der Browser-Test fehlschlägt | wie `e2e_admin.py` |
| Gegenproben Team-Modus (`mutation_e2e.py team`) | 8 von 8 Fehlern erkannt, unveränderte Kontrolle 184 von 184 | Baut je einen Fehler absichtlich ein: Beitritt ohne Gültigkeitsprüfung, Duo nimmt Dritten auf, Beenden ohne Leitungsprüfung, Mitgliederzeilen für alle lesbar, veralteter Tab überschreibt still, Team-Werte im Solo-Speicher, Summe zählt eigene Zeile doppelt, Leitung wird nicht weitergegeben. **Der erste Durchlauf fand einen Fehler nicht** (Beitritt zu abgelaufener Session: die Vorschau fing es im Browser vorher ab). Dafür gibt es jetzt eine direkte Prüfung der Beitrittsfunktion; danach wurde der Fall erkannt. | wie `e2e_team.py` |

## Was NICHT geprüft ist

- **Echtes Supabase und echtes Google.** Der Auth-Client und die Migration sind gegen die dokumentierten Schnittstellen gebaut und gegen Nachbauten getestet. Abweichungen im echten Dienst (z. B. Wortlaut von Fehlermeldungen, Rate-Limits, Mail-Vorlagen) können Anpassungen nötig machen. Bitte nach der Einrichtung einmal komplett durchspielen: Registrieren, Mail-Link, Anmelden, Namen ändern, Reset, Google.
- **Echte E-Mails.** Der eingebaute Mail-Versand von Supabase ist laut Doku nur für Team-Adressen und stark begrenzt. Für fremde Nutzer braucht es eigenen SMTP-Versand (`SETUP-ACCOUNTS.md`, Schritt 5).
- **Echtes iOS-Safari und installierte Home-Bildschirm-App.** Besonders: Foto-Auswahl, Teilen-Menü, Ton mit Stumm-Schalter, und auf iOS haben Safari und die installierte App **getrennte Speicher**. Ein E-Mail-Link öffnet Safari, nicht die installierte App (siehe `SETUP-ACCOUNTS.md`). Bitte auf deinem Gerät probieren.
- **Echter Supabase-Speicherdienst (Storage).** Der Bild-Upload ist nach dem Muster von `supabase-js` gebaut (multipart), aber nur gegen den Nachbau geprüft. Die Speicher-Regeln selbst liefen gegen echtes PostgreSQL. Bitte nach der Einrichtung einmal ein Bild hochladen, veröffentlichen und ausblenden.
- **Estimated Qual mit echten Konten und echtem iPhone.** Insbesondere die Fotoauswahl auf iOS (HEIC wandelt Safari beim Auswählen normalerweise selbst um) und die Admin-Verwaltung auf dem kleinen Bildschirm (nur in Chromium-Größen von 320 bis 1440 px geprüft).
- **Team-Modus mit echtem Supabase und echten Geräten.** Datenbank-Regeln liefen gegen echtes PostgreSQL, der Browser gegen den Supabase-Nachbau. Nicht geprüft: echtes Supabase (z. B. Verhalten des PostgREST-Schnittstellen-Caches direkt nach dem Einspielen der Migration, Antwortzeiten), echtes iOS-Safari (Zwischenablage, Hintergrund-Tabs) und zwei echte Geräte. Bitte einmal mit zwei Konten auf zwei Geräten durchspielen (`docs/TEAM.md`).
- **Echtzeit.** Der Team-Abgleich fragt alle 3 Sekunden ab (kein WebSocket, kein Supabase Realtime). Das ist bewusst einfach und für 2 bis 3 Spieler ausreichend, aber nicht „sofort“: Änderungen anderer erscheinen nach höchstens etwa 3 bis 4 Sekunden.
- **Lasttest und Sicherheitsprüfung durch Dritte.** Die Zugriffsregeln sind getestet, aber nicht von einer unabhängigen Stelle geprüft.

## Bekannte Einschränkungen

- **Estimated Qual (V5):** Bildadressen im Speicher sind öffentlich abrufbar, wer die genaue (zufällige) Adresse kennt. Die Dateityp-Prüfung des Speicherdienstes beruht auf dem angegebenen Typ; den Inhalt prüft die Verwaltung im Browser. Der Banner erscheint nach dem Abruf (meist unter einer Sekunde) und schiebt den Inhalt dabei einmal nach unten, wenn er eingeschaltet ist; ausgeschaltet gibt es keine Verschiebung. Geöffnete Seiten fragen einmal pro Minute nach. Es gibt keine Versionshistorie. Details: `docs/ADMIN.md`.
- **Team-Modus (V6):** nur Duo und Trio, kein Chat, keine Rangliste, kein Verlauf (nur der aktuelle Stand). Wer den Einladungslink kennt, kann beitreten, solange ein Platz frei ist, und sieht dann die Namen und Werte des Teams: Link nur an die richtigen Leute schicken. Beendete oder abgelaufene Sessions bleiben bis zum Aufräumen (7 Tage nach Ende, beim Erstellen einer neuen Session) in der Datenbank, solange noch jemand Mitglied ist; sind alle gegangen, ist die Session sofort gelöscht und ein alter Link meldet „ungültig“. Ein Konto ohne Profil erscheint als „Spieler 1/2/3“ (nur Deutsch). Die Einladung wartet nach Registrierung höchstens 24 Stunden im Browser; auf iOS gilt wie bei Konten: Safari und die installierte App haben getrennte Speicher. Bei 320 px Breite (iPhone SE der 1. Generation) rutscht der Team-Knopf in eine zweite Zeile der Net-Damage-Kopfzeile; ab 360 px bleibt sie einzeilig.
- **Kein Impressum, keine Datenschutzerklärung.** Sobald Konten live sind, werden E-Mail-Adressen verarbeitet. Für eine öffentliche Seite in Deutschland brauchst du beides (und eine Auftragsverarbeitung mit Supabase). Das ist nicht umgesetzt und keine Rechtsberatung.
- **Passwortregel:** mindestens 8 Zeichen (auch in Supabase so einstellen). Die App selbst prüft nicht gegen geleakte Passwörter.
- **Kein Avatar-Upload.** Der Avatar ist die Initiale. Ein Bild vom Google-Konto wird nur angezeigt, wenn die Adresse mit `https://` beginnt.
- **E-Mail-Adresse ändern ist nicht umgesetzt.** Das Profil zeigt die E-Mail nur an. Nutzername ändern geht. (Die Aufgabenstellung nannte „Nutzername/E-Mail bearbeiten“: der E-Mail-Teil fehlt.)
- **Konto löschen** ist nicht umgesetzt. Über das Supabase-Dashboard möglich, das Profil wird dabei automatisch mitgelöscht.
- **Kein Hintergrundbetrieb auf iOS.** Safari pausiert Seiten im Hintergrund. Die Zeiten werden aus Zeitstempeln berechnet und stimmen nach der Rückkehr wieder, die Ton-Meldung der Rotation kommt aber nur bei sichtbarer App.
- **Ton:** Safari erlaubt Ton erst nach einer Berührung (wird bei „Start“ freigeschaltet), der Stumm-Schalter kann ihn unterdrücken. Die visuelle Meldung funktioniert immer. Vibration gibt es in iOS Safari nicht.
- **Map:** PNG, JPG, WEBP bis 30 MB, große Bilder werden auf 2560 px Kantenlänge verkleinert. HEIC wird nicht unterstützt. Keine automatische Zonenerkennung.
- **Speicher:** Notizen, Presets und Einstellungen liegen in `localStorage`, die Map in IndexedDB. Löschst du in Safari die Website-Daten, sind sie weg (Konto-Daten bleiben bei Supabase). Konten synchronisieren **keine** Notizen, Timer oder Presets zwischen Geräten.
- **Storm-Schaden ist eine Schätzung** aus Zeit mal gewähltem Schaden pro Sekunde. Die App liest nichts aus Fortnite aus.
- **Net Damage** akzeptiert nur ganze Zahlen von 0 bis 999.999. „Rückgängig“ gilt nur in der geöffneten App.
- **Marke:** Es wurde keine Marken- oder Domainrecherche durchgeführt. Vor einer öffentlichen Bewerbung bitte DPMA/EUIPO/TMview prüfen und die Epic-Fan-Content-Policy lesen. Das Google-„G“ im Anmelde-Knopf ist eine Marke von Google (`ASSETS.md`).
