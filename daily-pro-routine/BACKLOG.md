# Repline – vorgemerkt

**Stand 11.11.2026:** Alle Punkte unten sind umgesetzt (Custom Sound gesperrt bis zum Kauf, Devs können ihn testen). Offen bleibt nur der Preis für den Custom Sound und ein Download-Link für die Windows-App.

## Custom Sound (kostenpflichtig)

- Unter Konto → Set alerts eine zusätzliche Ton-Option **„Custom sound“**: eigenen Ton hochladen, der am Ende eines Sets bzw. Szenarios abgespielt wird.
- Soll **etwas kosten**. Das muss in der Liste sofort sichtbar sein.
- Optisch hervorheben, damit es sich von den kostenlosen Tönen abhebt, z. B. eine Zeile mit dezentem Effekt und einem passenden Zeichen für „kostet etwas“.
- **Einmalkauf** (kein Abo).
- **Preis steht noch nicht fest:** Keinen Betrag zeigen, nur klar machen, dass es etwas kostet, z. B. Abzeichen „✦ Pro“ plus Hinweis „Einmalkauf · Preis folgt“.
- **Zeitpunkt:** Zusammen mit der nächsten neuen Funktion einbauen, nicht vorher.
- Noch offen: erlaubte Formate, Länge und Dateigröße. Vorschlag: MP3 oder WAV, höchstens 5 Sekunden, höchstens 1 MB.

## Test-Routine als Auswahl „For devs only“

- **Heute:** Die Test-Routine mit 3-Sekunden-Sets lässt sich über einen Schalter unter Konto → Data einblenden.
- **Beim nächsten Mal:** Sie steht direkt bei den Routinen in Schritt 1 als normale Auswahl, deutlich gekennzeichnet mit **„For devs only“**. Der Schalter unter Data entfällt dann.
- **Später, wenn es Dev-Accounts gibt:** Nur Dev-Accounts sehen und starten die Test-Routine. Alle anderen sehen sie nicht.
- **Allgemeine Regel:** Funktionen, die als „for devs“ markiert sind, werden automatisch auf Dev-Accounts beschränkt, sobald es Dev-Accounts gibt. Die Test-Routine ist die erste davon.

## Zurück zur laufenden Routine (hervorgehoben)

- **Problem:** Eine Routine ist pausiert oder läuft noch, und man ist zurück auf dem Homescreen oder in der Auswahl. Dann findet man kaum zurück. Heute gibt es nur einen schlichten „Continue“-Knopf im Hero des Homescreens, der leicht übersehen wird.
- **Lösung:** Eine gut sichtbare **„Resume routine“**-Leiste auf allen Seiten außer dem Training, z. B. als schwebende Pille unten oder in der Kopfzeile. Sie zeigt einen Mini-Ring mit Fortschritt, Set-Name, Restzeit und Status (Paused/Running). Ein Klick führt direkt zurück ins Training, an dieselbe Stelle.
- **Hervorheben:** zum Beispiel ein sanftes Leuchten oder Pulsieren in der Set-Farbe. Gilt für Webseite und Windows-Programm, passend zum Overlay.

## Routine nie automatisch pausieren

- **Heute:** Die Routine pausiert von selbst, sobald man das Training verlässt, also zum Homescreen, zur Auswahl oder zum KI-Training wechselt. Das war Absicht, ist aber falsch.
- **Gewünscht:** Eine laufende Routine läuft immer weiter, bis man selbst auf Pause drückt. Seitenwechsel, Konto-Panel und Fenster im Hintergrund dürfen sie nicht unterbrechen.
- **Technisch:**
  - In `route()` das automatische `pause()` beim Verlassen des Trainings entfernen.
  - Beim Betreten des Trainings `laeuft` nicht mehr auf `pause` setzen.
  - Der Timer muss auch auf anderen Seiten weiterlaufen, inklusive Set-Ende, Ton, Overlay und Auto-Weiter.
- **Neu laden der Seite:** Statt immer zu pausieren, den Startzeitpunkt speichern und die Zeit weiterrechnen.

## Konto-Panel aufteilen

- **Heute:** Ein Klick auf Account öffnet rechts ein Panel, in dem alles untereinander steht. Konto, Abo, Affiliate, Einstellungen, Set alerts, Overlay, Daten und Hilfe sind zu viel auf einmal.
- **Gewünscht:** Das Panel fährt weiter rechts heraus, aber übersichtlich getrennt, z. B. in drei Bereiche:
  1. **Account:** Profil, Fortschritt, Abo, Affiliate, Abmelden, Konto löschen.
  2. **Settings:** Ton an/aus, Bildschirm anlassen, Daten (zurücksetzen), Test-Routine für Devs, Hilfe.
  3. **Appearance:** Set alerts (Ton und Animation mit Vorschau), Animationen an/aus, In-game overlay (Position, Größe, Deckkraft, Hotkeys).
- **Umsetzung im Apple-Stil:** Oben im Panel eine Segment-Leiste „Account · Settings · Appearance“. Alternativ eine Startliste mit drei Zeilen, die wie in den iPhone-Einstellungen in eine Unterseite hineinschieben, mit „‹ Back“.
- Der Knopf oben rechts bleibt: „Sign in“ oder Avatar. Ein eigener Zahnrad-Knopf für Settings ist eine Option.

## Echte Konten: gleiche Daten in Webseite und App

- **Grundsatz:** Webseite und Windows-Programm nutzen dasselbe Konto und dieselben Daten. Alles, was heute nur im Browser gespeichert wird, wandert ins Konto:
  - Streak und Trainingstage
  - laufende Routine des Tages
  - Today's focus
  - Einstellungen und Set alerts
  - Affiliate-Code und Zahlen
  - Käufe, z. B. Custom Sound
- **Technik:** Supabase (Auth mit Discord + Postgres-Datenbank, Row Level Security, jeder sieht nur seine eigenen Daten). Die Webseite liegt bei einem kostenlosen Host, z. B. Cloudflare Pages. Die Daten liegen nur bei Supabase, deshalb gehen beim Wechsel von Host oder Domain keine Daten verloren.
- **Ohne Konto** funktioniert alles weiter lokal. Nach der Anmeldung werden die lokalen Daten einmal ins Konto übernommen.
- **Windows-Programm:** Die Anmeldung öffnet den normalen Browser und kommt per `repline://`-Link zurück ins Programm.
- **Später eigene Domain (repline.gg):** In Supabase Site URL und Redirect URLs anpassen. Der Discord-Callback bleibt die Supabase-Adresse.

## Set alerts nur in der App, auf der Webseite als Teaser

- **Webseite:** Den Bereich „Set alerts“ mit Ton, Animation und Vorschau aus dem Konto-Panel entfernen. Im Browser gibt es kein Overlay, deshalb bringt die Auswahl dort nichts. Im Browser gilt der Standard (Chime und Wave), und „Sound at the end of a set“ an/aus bleibt.
- **Windows-App:** Set alerts bleiben vollständig, zusammen mit den Overlay-Einstellungen, später unter „Appearance“.
- **Teaser auf dem Homescreen der Webseite:** neuer Abschnitt im Apple-Stil, z. B. „Your routine. Over your game.“
  - zeigt das Overlay über einer Spielszene, gern animiert mit Countdown und Abschluss-Animation
  - zählt kurz auf, was man in der App wählen kann: 7 Töne, 7 Animationen, Position, Größe, Deckkraft, Hotkeys im Spiel
  - Knopf „Get the Windows app“ (Download, sobald es einen Download-Link gibt)
- Die Testseite `preview-alerts.html` kann als Vorlage für die Teaser-Animation dienen.

## Nächstes Update: Download-Button und automatische App-Updates

- **Download-Button auf der Webseite:** „Download for Windows“ im Overlay-Teaser, in Appearance und im Footer. Er führt immer auf die **neueste Version**, über einen festen Link wie `…/Repline-Setup-latest.exe`, der bei jedem Release automatisch neu zeigt. Daneben stehen Versionsnummer und Größe.
- **Updates ohne Neu-Herunterladen:**
  1. **Inhalte live laden:** Das Windows-Programm lädt Repline von `repline.pages.dev`, mit der eingebauten Kopie als Offline-Ersatz. Jedes Webseiten-Update ist damit sofort auch in der App, ohne Neuinstallation.
  2. **Auto-Update für das Programm selbst** (Overlay, Hotkeys, Fenster): `electron-updater` prüft beim Start auf eine neue Version, lädt sie im Hintergrund und installiert sie beim nächsten Neustart. Hinweis „Update ready · Restart“ im Programm.
- **Wo die Dateien liegen:** Cloudflare R2. 10 GB sind gratis, Downloads kosten nichts. Dort liegen Installer und `latest.yml` (die Versions-Info für den Updater). Cloudflare Pages erlaubt nur 25 MB pro Datei, deshalb R2. Der Cloudflare-Token braucht dafür zusätzlich die Berechtigung „R2 · Edit“.
- **Installer bauen:** Für die Updates ist ein richtiger Installer nötig, nicht die ZIP. Bauen über den bestehenden GitHub-Workflow (Windows-Rechner) oder hier mit Wine. Ohne Code-Signatur zeigt Windows beim ersten Installieren eine SmartScreen-Warnung, die Updates laufen danach trotzdem.

### Entscheidung: komplette App automatisch aktualisieren (Profi-Variante)

Ersetzt Punkt 1 oben („Inhalte live laden“). Jede neue Version aktualisiert die **ganze App**:
- **electron-builder + NSIS-Installer + electron-updater:** Die App prüft beim Start und alle paar Stunden auf Updates. Sie lädt nur die geänderten Teile (Differential-Update über `.blockmap`), installiert im Hintergrund und fragt „Update ready · Restart“. Bei längerer Nichtnutzung installiert sie beim nächsten Beenden.
- **Update-Kanäle:** `latest` für alle, `beta` für Devs. Dev-Accounts testen neue Versionen zuerst.
- **Release-Notizen** im Programm anzeigen („What's new in 1.3“).
- **Code-Signatur: vorerst keine** (Entscheidung 11.11.2026). Beim ersten Installieren zeigt Windows SmartScreen („Weitere Informationen“ → „Trotzdem ausführen“), die Auto-Updates laufen danach trotzdem. Kann später mit Azure Trusted Signing nachgerüstet werden, ohne dass Nutzer neu installieren müssen.
- **Dateien:** Cloudflare R2 (Installer, `latest.yml`, Blockmaps). Download-Button und Updater nutzen denselben Ort.
- **Build:** Ein Befehl erzeugt die neue Version (Versionsnummer +1, Installer bauen, signieren, hochladen). Kein Hand-Upload mehr.

## Plans, Bezahlung und Pro-Inhalte (Stand v1.3)

- **Erledigt:** Plans-Seite (Free / Standard €2.99 / Pro €5.99), Routine-Baukasten mit Limits (Free 1, Standard 2, Pro unbegrenzt; die Datenbank setzt das Limit selbst durch), gesperrte Längen für Free, Partners-Seite, „Join Discord · soon“, Rückfrage bei beiden Resets.
- **Stripe-Bezahlung (offen):** Wartet auf ein Stripe-Konto. Danach: Stripe-Keys als Supabase-Secrets im Dashboard (nie im Chat), eine Edge Function für Checkout und eine für den Webhook, die `profiles.plan` und `purchases` schreibt. „Manage subscription“ führt dann ins Stripe-Kundenportal.
- **Erinnerung: Pro-Routinen / Pro-Playlists:** Die Inhalte fehlen noch. Die Karte „Pro routines · Coming Soon“ steht schon in Schritt 1.
- **AI Training:** nur für Pro, bisher Coming Soon.
- **Discord:** Sobald der Einladungslink steht, `SITE.discordUrl` setzen. Dann werden alle Discord-Knöpfe automatisch aktiv.
- **Custom Sound:** Der Preis für den Einmalkauf ist noch offen.
