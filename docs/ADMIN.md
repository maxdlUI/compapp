# Admin-Rechte und „Estimated Qual“ (Version 5)

Diese Anleitung ist für den Betreiber. Sie erklärt, wie du dein eigenes KREVO-Konto zum Administrator machst, wie du „Estimated Qual“ bedienst und wie beides abgesichert ist.

## Kurz erklärt

- **Estimated Qual** ist ein optionaler Banner ganz oben auf der Seite, direkt unter der Navigation. Er zeigt einen Wert, den **du von Hand pflegst**, zum Beispiel „Estimated Qual: 300 Points“ (300 ist nur ein Beispiel, es gibt keinen Standardwert). Es wird nichts berechnet oder vorhergesagt.
- Im Standard ist er **aus**. Dann gibt es auf der Seite weder Banner noch Platzhalter noch leeren Platz. Die Seite sieht aus wie vorher.
- Nur **Administratoren** können ihn ein- und ausschalten, Wert und Bild ändern und veröffentlichen. Wer Administrator ist, steht in der Datenbank (Tabelle `admins`) und wird über die **interne Nutzer-ID** (UUID) erkannt, nicht über Namen oder Einstellungen im Browser.

## Einrichten (einmalig, ca. 5 Minuten, am iPad machbar)

### Schritt 1: Migration 002 ausführen

1. Supabase-Dashboard öffnen, Projekt wählen.
2. **SQL Editor → New query**.
3. Den kompletten Inhalt von `supabase/002_krevo_admin_estimated_qual.sql` einfügen (liegt auch als `.txt` bei) und **Run** drücken. Erwartet wird „Success“.

Das Skript ist wiederholbar, löscht nichts und verändert deine bestehenden Konten und Profile nicht. Es legt an: die Tabelle `admins`, die Einstellungen von Estimated Qual (aus), die Zugriffsregeln und den Bildspeicher `estimated-qual`.

### Schritt 2: Dich selbst zum Admin machen

Du musst **keine Nutzer-ID heraussuchen**: Die Datenbank findet sie über deine E-Mail-Adresse. Im SQL Editor (neue Abfrage) ausführen und `DEINE@EMAIL` durch die Adresse ersetzen, mit der du dich **bei KREVO** angemeldet hast:

```sql
insert into public.admins (user_id)
select id from auth.users where lower(email) = lower('DEINE@EMAIL')
on conflict do nothing;
```

Prüfen (muss genau deine Adresse zeigen, eine Zeile):

```sql
select a.user_id, u.email from public.admins a join auth.users u on u.id = a.user_id;
```

Kommt keine Zeile: Die Adresse stimmt nicht mit dem Konto überein (Schreibfehler, anderes Konto, Google-Konto mit anderer Adresse). Unter **Authentication → Users** siehst du die Adresse und die **User UID**.

**Alternative mit der Nutzer-ID** (falls du die Adresse nicht eintragen willst): die User UID aus **Authentication → Users** kopieren und ausführen:

```sql
insert into public.admins (user_id) values ('HIER-DIE-UUID');
```

Admin wieder entziehen:

```sql
delete from public.admins where user_id = 'HIER-DIE-UUID';
```

Das Eintragen geht **nur im SQL Editor** (also nur mit Zugriff auf dein Supabase-Projekt). Über die App oder die öffentliche Schnittstelle kann sich niemand zum Admin machen. Das ist getestet (siehe unten).

### Schritt 3: App-Dateien aktualisieren

Die neue Version hochladen (Anleitung in `README.md`, Abschnitt „Update einspielen“). **`config.js` nicht überschreiben**: Dort stehen deine Supabase-Werte. Die mitgelieferten Update-Dateien enthalten sie deshalb gar nicht.

### Schritt 4: Prüfen

1. App öffnen und anmelden. Oben auf dein Profil tippen.
2. Es erscheint ein Knopf **„Estimated Qual verwalten“**. Nur Administratoren sehen ihn.
3. Normale Konten sehen ihn nicht. Selbst wenn jemand den Knopf mit Gewalt einblendet, bleibt die Verwaltung leer („Dieses Konto hat keine Admin-Rechte“), weil die Datenbank nichts herausgibt.

## Bedienen

Der Ablauf ist **Entwurf → Vorschau → Veröffentlichen**. Der Entwurf ist für Besucher unsichtbar.

1. **Punkte:** ganze Zahl von 1 bis 999999, nur Ziffern, ohne führende Null (zum Beispiel `300`). Ungültige Eingaben werden sofort erklärt und lassen sich nicht speichern.
2. **Hintergrundbild (optional):** JPG, PNG oder WebP, höchstens 5 MB. Das Bild wird zugeschnitten, nie verzerrt. Über **Bild ersetzen** und **Bild entfernen** änderst du es. Ohne Bild erscheint ein dezenter KREVO-Hintergrund.
3. **Vorschau:** zeigt den Banner genau so, wie Besucher ihn sehen werden, auch mit noch nicht gespeicherten Eingaben.
4. **Entwurf speichern:** speichert Punkte und Bild als Entwurf. Öffentlich ändert sich dadurch **nichts**.
5. **Veröffentlichen:** übernimmt den gespeicherten Entwurf. Nur gültige Werte lassen sich veröffentlichen. Der Knopf ist gesperrt, solange es ungespeicherte Änderungen gibt oder nichts Neues da ist.
6. **Schalter „Estimated Qual auf der Website anzeigen“:** schaltet den Banner für **alle** Besucher ein oder aus. Beim Ausschalten bleibt der veröffentlichte Stand gespeichert. Beim erneuten Einschalten erscheint **der zuletzt veröffentlichte Stand**, nicht der Entwurf. Ohne gültigen veröffentlichten Stand erscheint auch bei „An“ kein Banner (die Verwaltung weist darauf hin).

Wann Besucher Änderungen sehen: Neu geladene Seiten sofort. Bereits geöffnete Seiten fragen einmal pro Minute und beim Zurückkehren zum Tab nach. Es wird bewusst nichts im Browser zwischengespeichert, damit Ausschalten überall wirkt.

Wird ein Bild ersetzt oder entfernt und veröffentlicht, löscht die Verwaltung die nicht mehr gebrauchte Datei aus dem Speicher.

## Wer darf was

| Aktion | Besucher (nicht angemeldet) | angemeldeter Nutzer | Administrator |
|---|---|---|---|
| veröffentlichten Stand lesen (nur wenn eingeschaltet und gültig) | ja | ja | ja |
| Entwurf, Schalter und Metadaten lesen | nein | nein | ja |
| ein-/ausschalten, Entwurf ändern | nein | nein | ja |
| veröffentlichen | nein | nein | ja |
| Bild hochladen, ersetzen, löschen | nein | nein | ja |
| Admin-Liste lesen oder ändern | nein | nein | nein (nur im SQL Editor) |

Umgesetzt in der Datenbank (`supabase/002_krevo_admin_estimated_qual.sql`), nicht im Browser:

- **Admin-Tabelle** ohne jedes API-Recht: weder lesbar noch beschreibbar, auch nicht für den Admin selbst.
- **`is_admin()`** vergleicht ausschließlich die Nutzer-ID aus dem **geprüften Anmelde-Token**, nie eine Angabe des Clients.
- **Zeilenregeln (RLS)** auf den Einstellungen: lesen und ändern nur, wenn `is_admin()`. Es gibt genau eine Zeile; Anlegen und Löschen ist niemandem erlaubt.
- **Spaltenrechte:** Selbst der Admin kann über die Tabelle nur `enabled`, `draft_points` und `draft_image` ändern. Die veröffentlichten Spalten setzt ausschließlich die Funktion `estimated_qual_publish()`, die selbst wieder `is_admin()` prüft und nur gültige Entwürfe übernimmt.
- **Öffentlich** gibt es nur die Funktion `estimated_qual_public()`: Sie liefert Punkte, Bildname und Zeitpunkt, und nur wenn eingeschaltet **und** gültig veröffentlicht. Sonst `null`.
- **Prüfregeln in der Tabelle:** Punkte 1 bis 999999, Bildname nur `<UUID>.jpg|png|webp`. Ungültiges wird auch bei direkten Anfragen abgelehnt.
- **Bildspeicher:** Bucket `estimated-qual` (öffentlich lesbar, 5 MB, nur JPEG/PNG/WebP). Hochladen, Ersetzen und Löschen erlaubt eine Speicher-Regel nur Administratoren und nur für Dateinamen im Format `<UUID>.jpg|png|webp`. Jede Datei bekommt einen neuen Namen, ein Entwurf überschreibt also nie das veröffentlichte Bild.
- Im Browser steht nur der öffentliche Schlüssel aus `config.js`. Ein Test sucht im ausgelieferten Code nach Geheimnissen.

## Bekannte Grenzen (ehrlich)

- **Bildadressen sind öffentlich abrufbar**, wer die genaue Adresse kennt. Der Dateiname ist eine zufällige UUID und steht nur in der (für Administratoren lesbaren) Einstellungstabelle. Ein Entwurfsbild ist deshalb praktisch nicht auffindbar, aber technisch nicht geheim. Das alte, veröffentlichte Bild wird nach dem Ersetzen gelöscht.
- Der Speicherdienst prüft den Dateityp anhand des **angegebenen** Typs (nicht am Inhalt). Die Verwaltung prüft den Inhalt zusätzlich im Browser (JPEG, PNG, WebP; SVG und HTML werden abgelehnt). Wer direkt mit Admin-Rechten hochlädt, kann das umgehen. Das betrifft nur Administratoren.
- Beim Laden der Seite erscheint der Banner nach dem Abruf (meist unter einer Sekunde). Ist er eingeschaltet, rückt der Inhalt dabei einmal nach unten. Ausgeschaltet gibt es keinerlei Verschiebung.
- Es gibt keine Versionshistorie. Der Zeitpunkt der letzten Veröffentlichung und die ID des Veröffentlichers werden gespeichert, frühere Werte nicht.
- Echtes Supabase wurde nicht getestet (siehe `README.md`): Die Regeln liefen gegen echtes PostgreSQL, der Speicherdienst gegen einen Nachbau.

## Fehlersuche

| Beobachtung | Ursache |
|---|---|
| Kein „Estimated Qual verwalten“ im Profil | Migration 002 fehlt, Admin-Eintrag fehlt oder die Adresse im SQL stimmte nicht (Schritt 2, Prüf-Abfrage). Nach dem Eintragen einmal abmelden und anmelden. |
| „Die Datenbank ist noch nicht vollständig eingerichtet (Migration fehlt)“ | Schritt 1 nicht ausgeführt |
| „Dafür fehlt die Berechtigung“ beim Speichern | Admin-Eintrag wurde entfernt, oder die Sitzung gehört zu einem anderen Konto |
| „Dieser Dateityp wird nicht unterstützt“ | Nur JPG, PNG, WebP. Fotos im HEIC-Format wandelt iOS-Safari beim Auswählen normalerweise selbst um; das konnte ich nicht auf einem echten iPhone prüfen. Notfalls das Foto vorher als JPG sichern. |
| „Die Datei ist größer als 5 MB“ | Bild verkleinern |
| Banner erscheint trotz „An“ nicht | Nichts veröffentlicht (Hinweis in der Verwaltung), oder Seite noch nicht neu geladen |
| Bild fehlt im Banner | Bild noch nicht veröffentlicht (nur gespeichert), oder die Datei wurde aus dem Speicher gelöscht. Dann zeigt der Banner den Standardhintergrund. |
