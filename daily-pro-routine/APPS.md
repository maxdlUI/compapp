# Repline als App

Die Seite `index.html` ist die einzige Quelle. Alles andere wird daraus gebaut:

```
python3 tools/build_app.py
```

## iPhone und Windows (installierbare Web-App)

Der Ordner `app/` ist die fertige Web-App. Lade ihn auf einen HTTPS-Host, zum Beispiel per Drag & Drop auf app.netlify.com/drop, und verbinde dort später repline.gg.

- **iPhone:** Seite in Safari öffnen → Teilen → „Zum Home-Bildschirm“.
- **Windows:** Seite in Edge oder Chrome öffnen → Symbol „App installieren“ in der Adressleiste.

Die App startet im eigenen Fenster mit Repline-Symbol und funktioniert offline.

## Windows-Programm (.exe)

`desktop/` enthält das Electron-Programm. Der GitHub-Workflow `.github/workflows/repline-windows.yml` baut bei jedem Push einen Installer (`Repline-Setup-1.0.0.exe`) und eine portable Version (`Repline-Portable-1.0.0.exe`). Sie liegen danach unter „Actions“ → letzter Lauf → „Artifacts“.

Lokal auf einem Windows-PC: `cd desktop`, `npm install`, `npm run dist`.

Die Programme sind nicht signiert. Windows zeigt beim ersten Start „Der Computer wurde durch Windows geschützt“ → „Weitere Informationen“ → „Trotzdem ausführen“.

## Symbole

`python3 tools/make_icons.py app/icons` zeichnet alle Symbole neu.

## In-Game-Overlay (nur Windows-Programm)

Während einer Routine zeigt ein kleines Overlay über dem Spiel: Ring mit Routinenfortschritt, aktuelles Set, Restzeit und nächstes Set. Klicks gehen durch das Overlay hindurch ins Spiel.

- **Einstellungen:** Konto-Panel → „In-game overlay“: an/aus, Position (8 Felder oder „Move“ zum freien Verschieben), Größe S/M/L, Deckkraft, Tastenkürzel.
- **Tastenkürzel im Spiel:** Strg+Umschalt+Leertaste Start/Pause · Strg+Umschalt+N nächstes Set · Strg+Umschalt+R Set neu · Strg+Umschalt+O Overlay an/aus.
- **Fortnite:** Anzeigemodus „Vollbild im Fenster“ (Windowed Fullscreen). Im exklusiven Vollbild kann Windows kein Fenster darüber zeigen.
- Die Overlay-Einstellungen liegen in `%APPDATA%\Repline\overlay.json`.

### Set-Ende und Test-Routine

- **Kurz vor Ende eines Sets** (letzte 10 Sekunden, bei sehr kurzen Sets mindestens 3) pulsiert das Overlay in der Set-Farbe, die Zeit färbt sich, und bei 3, 2, 1 tickt es leise.
- **Am Ende** springt das Overlay kurz auf, eine Lichtwelle läuft herum, ein Gong in zwei Tönen erklingt, und groß steht das nächste Set da. Nach dem letzten Set kommt ein Dreiklang mit „Routine done“.
- Der Ton folgt der Einstellung „Sound at the end of a set“. Ist das Overlay an, spielt nur das Overlay den Ton.
- **Test-Routine:** Konto-Panel → Data → „Test routine · 3 s sets“. In Schritt 1 erscheint dann „Test routine“: 8 Sets à 3 Sekunden, die automatisch nacheinander laufen. Das letzte Set ist ein Kill-Set, dort hakst du die drei Runden ab.

### Ton und Animation wählen

Konto-Panel → „Set alerts“: 7 Töne (Chime, Bell, Marimba, Arcade, Ping, Fanfare, kein Ton), jeder mit ▶ zum Anhören, und 7 Abschluss-Animationen (Wave, Flash, Shake, Glow, Confetti, Slide, Minimal). Die Mini-Vorschau zeigt die gewählte Animation sofort. „Preview“ spielt beides ab, im Windows-Programm zusätzlich im echten Overlay. Die Auswahl gilt für Overlay und App. Alles zum Durchprobieren gibt es auch auf `preview-alerts.html`.
