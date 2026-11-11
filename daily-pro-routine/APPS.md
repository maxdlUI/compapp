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
