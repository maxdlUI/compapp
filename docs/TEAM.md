# Team-Modus für Net Damage (Version 6)

Optionaler Modus für **2 (Duo) oder 3 (Trio) Spieler**. Jeder trägt seinen eigenen Net Damage ein, KREVO zeigt zusätzlich die Summe als **Team Net Surge**. Wer allein spielt, merkt nichts davon: Der Solo-Tracker arbeitet genau wie vorher, ohne Konto, mit denselben Feldern, Knöpfen, „Rückgängig“ und „Reset“.

## Kurz erklärt

| Begriff | Bedeutung |
|---|---|
| **Net Damage** | dein persönlicher Wert: Damage Dealt − Damage Taken (wie bisher) |
| **Team Net Surge** | Summe der Net-Damage-Werte aller Mitglieder, die schon Werte eingetragen haben. Man kann sie **nicht von Hand eingeben**, sie wird immer berechnet. |

Wichtig: Team Net Surge ist eine **Summe von Werten, die ihr selbst eintragt**. Die App liest nichts aus Fortnite aus und erkennt keinen Ingame-Schwellenwert. Jeder Spieler zählt genau einmal, auch bei Neuladen, mehreren Tabs oder einem zweiten Gerät. Wer beitritt, wird sofort mit 0 / 0 angelegt und zählt ab dann mit Net Damage 0. Ein Mitglied, dessen Werte noch nicht übertragen sind (etwa bei Verbindungsproblemen direkt nach dem Beitritt), trägt nichts zur Summe bei und steht als „Noch keine Werte“ da. „2 von 3 Spielern“ unter der Summe zeigt, wie viele Mitglieder schon zählen.

## Einrichten (einmalig, ca. 3 Minuten, am iPad machbar)

Voraussetzung: Konten laufen schon (`SETUP-ACCOUNTS.md`, Schritte 1 bis 6, Migration `001`). Migration `002` (Admin) wird **nicht** gebraucht.

1. Supabase-Dashboard → **SQL Editor → New query**.
2. Den kompletten Inhalt von `supabase/003_krevo_team_net_damage.sql` einfügen (liegt auch als `003_krevo_team_net_damage.txt` bei) und **Run** drücken. Erwartet: „Success“.
3. Die neuen App-Dateien hochladen (siehe README, „Update einspielen“). `config.js` **nicht** überschreiben. In `sw.js` steht jetzt `krevo-v7`.
4. Zwei Konten, zwei Geräte (oder zwei Browser) nehmen und den Ablauf unten einmal durchspielen.

Das Skript ist wiederholbar, löscht nichts und ändert Konten und Profile nicht. Ohne diesen Schritt bleibt die App benutzbar: Der Team-Knopf zeigt dann beim Erstellen eine kurze Fehlermeldung, Solo ist nicht betroffen.

## Bedienung

**Session erstellen:** Im Net-Damage-Bereich auf **Team** tippen (Symbol mit zwei Personen). Ohne Konto bietet der Dialog „Anmelden“ an. Mit Konto: **Duo** oder **Trio** wählen, **Session erstellen**. Danach erscheint die Teamübersicht: oben **Team Net Surge**, darunter jede Spielerzeile (Name, Net Damage, Rechnung „Dealt − Taken“), freie Plätze zuletzt.

**Einladen:** **Link kopieren**. Der Link ist immer wieder kopierbar, solange die Session läuft. Er sieht so aus: `https://…/index.html?team=<22 Zeichen>`.

**Beitreten:** Der Eingeladene öffnet den Link.
- Ist er abgemeldet, öffnet sich direkt „Anmelden, um beizutreten“. Nach der Anmeldung (auch nach Registrierung und Bestätigungs-Mail, bis zu 24 Stunden später) erscheint die Einladung wieder: Größe, belegte Plätze, Leitung, **Beitreten**.
- Ist er angemeldet, erscheint sofort die Einladung.
- Alternativ: **Team → Mit Link beitreten**, Link einfügen.
- Ist das Team voll, abgelaufen, beendet oder der Link ungültig, steht eine kurze Meldung da. Nichts wird beigetreten.

**Eintragen:** Im Team zeigt der Tracker **deine** Werte („Dein Tracker · Name“). Felder, +1/+5/+10, „leeren“, „Rückgängig“ und „Reset“ funktionieren wie im Solo-Betrieb. Fremde Zeilen sind nur Anzeige und nicht bedienbar. Ungültige Eingaben (Text, negativ, über 999.999) zeigt der Tracker wie immer an und sendet nichts.

**Verlassen:** **Verlassen** tippen, dann zur Sicherheit innerhalb von etwa 4 Sekunden noch einmal tippen. Dein Platz wird frei. Danach siehst du wieder deinen Solo-Tracker mit den Werten von vorher (die Solo-Werte wurden im Team nie angetastet).

**Beenden** (nur Leitung): ebenfalls zweimal tippen. Alle anderen werden innerhalb weniger Sekunden informiert und sind wieder solo.

## Regeln

| Regel | Verhalten |
|---|---|
| Konto | Für den Team-Modus nötig. Solo funktioniert ohne. |
| Ein Team gleichzeitig | Jedes Konto ist nur in **einer** offenen Session. Zweiter Beitritt oder zweites Erstellen wird abgelehnt („Du bist bereits in einem Team“). Öffnet man ein zweites Gerät mit demselben Konto, wechselt es in dieselbe Session. |
| Größe | Duo = 2, Trio = 3. Ist das Team voll, wird der Beitritt abgelehnt. Treten zwei gleichzeitig dem letzten Platz bei, bekommt genau einer ihn. |
| Leitung | Wer die Session erstellt. Geht die Leitung (Verlassen, Konto gelöscht), wird das **am längsten anwesende** Mitglied die neue Leitung. Ist niemand mehr da, wird die Session gelöscht. |
| Beenden | Nur die Leitung. Danach nimmt die Session niemanden mehr auf. |
| Gültigkeit | **12 Stunden** ab der letzten Aktivität (Beitritt, Wertänderung). Danach gilt der Link als abgelaufen. |
| Aufräumen | Beendete oder abgelaufene Sessions werden beim Erstellen einer neuen Session nach 7 Tagen entfernt. Ist die letzte Person gegangen, ist die Session sofort weg (ein alter Link meldet dann „ungültig“ statt „beendet“). |
| Werte | ganze Zahlen von 0 bis 999.999, wie im Solo-Tracker. |

## Synchronisation (ehrlich beschrieben)

- Es gibt **kein WebSocket und kein Supabase Realtime**. Jedes Gerät fragt den Zustand der Session **alle 3 Sekunden** ab, solange der Tab sichtbar ist (rund 20 kleine Anfragen pro Minute und Spieler). Änderungen anderer erscheinen also nach höchstens etwa 3 bis 4 Sekunden. Im Hintergrund ruht die Abfrage und setzt beim Zurückkehren sofort ein.
- Eigene Änderungen werden nach 0,25 Sekunden gesammelt gesendet, immer nur eine Anfrage gleichzeitig. Die Antwort enthält den ganzen Zustand, die Anzeige ist also sofort wieder aktuell.
- **Verbindungsstatus:** Nach zwei fehlgeschlagenen Anfragen erscheint rechts neben „Team Net Surge“ klein „Offline, verbinde neu …“. Die App versucht es mit wachsenden Pausen (bis 15 Sekunden) weiter, beim Zurückkehren des Netzes sofort. Eigene Änderungen, die in der Pause gemacht wurden, werden dann gesendet.
- **Kein stilles Überschreiben:** Jede Zeile hat eine Versionsnummer. Schreibt ein veralteter Stand (zum Beispiel ein zweiter Tab, der eine ältere Version kennt), lehnt die Datenbank ab. Es gilt der Wert in der Datenbank; die App zeigt kurz „Auf einem anderen Gerät geändert, Werte aktualisiert.“ Fremde Zeilen kann ohnehin niemand ändern.
- Verspätete Antworten werden anhand eines Zählers der Session verworfen, ein älterer Zustand ersetzt nie einen neueren.

## Sicherheit

Alles Wichtige entscheidet die **Datenbank**, nicht der Browser (`supabase/003_krevo_team_net_damage.sql`):

- **Kein Geheimnis im Code.** Die App kennt nur die öffentlichen Werte aus `config.js`. Jede Anfrage trägt das Token des angemeldeten Nutzers.
- **Tabellen sind gesperrt.** `teams` und `team_members` haben Row Level Security: Lesen darf nur, wer Mitglied ist. Schreiben (Einfügen, Ändern, Löschen) darf über die Tabellen **niemand**. Geändert wird ausschließlich über acht Funktionen (`team_create`, `team_preview`, `team_join`, `team_get`, `team_mine`, `team_set`, `team_leave`, `team_end`), die jeweils Anmeldung und Mitgliedschaft prüfen und **nie eine Nutzer-ID vom Client annehmen**.
- **Nur eigene Werte.** `team_set` ändert ausschließlich die Zeile des angemeldeten Nutzers (`auth.uid()`), mit Prüfung von Wertebereich und Version.
- **Einladungskennung:** 22 Zeichen aus einer kryptografisch zufälligen UUID (122 Bit), nicht erratbar, nicht fortlaufend. Der Link gibt nur das Recht zum **Beitritt** (solange Platz ist). Lesen und Ändern setzt Mitgliedschaft voraus. Wer den Link weitergibt, lädt damit jemanden ein: Das ist so gewollt.
- Die Antworten enthalten **keine Nutzer-IDs**, nur Namen, Werte und die Markierungen „du“ und „Leitung“.
- **Gleichzeitigkeit:** Beitritt, Erstellen und Verlassen sind pro Konto und pro Team serialisiert (Sperren in der Datenbank). Ein Platz wird nie doppelt vergeben, ein Konto nie zweimal gezählt, es geht keine Zeile verloren.
- Anzeige im Browser ohne `innerHTML`: Namen werden nur als Text eingesetzt.

## Welche Namen erscheinen

Der Nutzername aus dem KREVO-Profil. Jeder Teilnehmer sieht die Namen der anderen Mitglieder seiner Session, sonst nichts (keine E-Mail-Adresse, keine ID). Hat ein Konto (ausnahmsweise) noch kein Profil, steht dort „Spieler 1“, „Spieler 2“ oder „Spieler 3“ (Platznummer, nur auf Deutsch).

## Fehlersuche

| Beobachtung | Ursache |
|---|---|
| Beim Erstellen „Serverfehler“ | Migration 003 nicht eingespielt oder Konten nicht eingerichtet |
| „Dieser Einladungslink ist ungültig.“ | Tippfehler, Link unvollständig kopiert, oder die Session ist inzwischen gelöscht (alle gegangen) |
| „Dieser Einladungslink ist abgelaufen.“ | länger als 12 Stunden ohne Aktivität |
| „Das Team ist voll.“ | alle Plätze belegt. Die Leitung kann nicht mehr Plätze freischalten, nur ein Mitglied kann gehen. |
| „Offline, verbinde neu …“ bleibt stehen | Netz weg oder Supabase nicht erreichbar. Sobald es wieder geht, verschwindet der Hinweis von selbst. |
| Kopieren funktioniert nicht | Der Browser verweigert die Zwischenablage. Dann erscheint der Link in einem Feld zum Markieren. |
| Der Link öffnet die App, aber kein Dialog | Du bist schon in dieser Session (dann siehst du sie direkt), oder der Link ist fehlerhaft |

## Grenzen

- Nur Duo und Trio. Kein Chat, keine Rangliste, keine Verlaufsdaten. Es wird nur der aktuelle Stand gespeichert, kein Protokoll.
- Eine Session endet nach 12 Stunden Pause von selbst; Werte bleiben in dieser Zeit in der Datenbank (nur Zahlen und Name-Zuordnung).
- Die Abfrage alle 3 Sekunden ist keine Echtzeit im strengen Sinn. Für 2 bis 3 Spieler reicht das, bei sehr vielen gleichzeitigen Sessions wäre Supabase Realtime die bessere Wahl.
- iOS: Safari pausiert Hintergrund-Tabs. Wer die App wegwischt, sieht den neuesten Stand nach der Rückkehr (die Abfrage setzt sofort ein).
- Datenschutz: Mit Team-Sessions speichert die Datenbank zusätzlich Spielerzahlen und Zuordnungen zu Konten. Für eine öffentliche Seite gilt dasselbe wie für Konten (siehe README, „Kein Impressum, keine Datenschutzerklärung“).

## Tests (Überblick)

Siehe README, Tabelle „Was getestet wurde“. Für den Team-Modus: `test/team.test.js` (Logik und Abgleich mit nachgebauter Uhr und Schnittstelle), `tools/db_test.py` (Abschnitt „Team-Modus“, echtes PostgreSQL, inklusive gleichzeitiger Beitritte und Gegenproben) und `tools/e2e_team.py` (mehrere Browser gleichzeitig).
