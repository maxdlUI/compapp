# Glass Messenger – 30-Sekunden-Motion-Graphic (Apple-/Liquid-Glass-Look)

Eine eigenständige Version des Messenger-Clips in 1080p mit 30 fps. **Sie enthält keine Assets von WhatsApp oder einer anderen Marke.** Es gibt keinen Markennamen und kein fremdes Logo. Das App-Icon (Squircle mit Farbverlauf und Glas-Sprechblasen), die Farben, die Oberfläche und die Texte sind eigene Gestaltung.

- **Video:** `glass-30s.mp4` (H.264 + AAC, mit Musik und Sounddesign)
- **Vorschau:** über einen lokalen Server öffnen, zum Beispiel `npx serve .` im Repo-Hauptordner, dann `/motion/glass-30s/`. Mit der Leertaste startest und stoppst du die Wiedergabe, `?t=12.5` springt direkt zu einer Sekunde.
- **Neu rendern:** `node motion/glass-30s/render.cjs`. Mit `--stills 3,8.5` speicherst du nur Standbilder.

## Look

- **Liquid Glass:** Jedes Glas-Element (Navigation, Pillen, Knöpfe, Karten, Schloss, Icon-Blasen) nimmt das, was dahinter liegt, und verarbeitet es live: Weichzeichner, mehr Sättigung, leichte Lupen-Brechung. Dazu kommen Tönung, Glanzverlauf und eine Lichtkante.
- **Hintergrund:** tiefes Schwarz mit farbigen Licht-Orbs, die im Raum liegen und sich mit der Kamera mitbewegen (Parallaxe).
- **Typografie:** große Headlines mit enger Laufweite, eine Zeile mit Farbverlauf, darüber eine farbige Zeile mit dem Funktionsnamen. Text erscheint mit Weichzeichner, Aufsteigen und Einblenden.
- **Akzentfarbe je Funktion:** Blau (Chat), Orange (Sprache), Pink (Medien), Mint (Anrufe), Lila (Gruppen), Orange-Pink (Status), Türkis (Standort), Indigo (Privatsphäre).

## Ablauf

| Zeit | Szene |
|---|---|
| 0–3 s | Eine Glaskugel fällt, die Icon-Kontur zeichnet sich, die Fläche füllt sich, die Glas-Blasen springen hinein. Headline „Alles, was dich verbindet.“ Danach fliegt die Kamera ins Icon und ein Kreis öffnet die nächste Szene. |
| 3–8 s | Chat in einem iPhone-artigen Rahmen mit Glas-Navigation: Nachrichten, „Gelesen“, Reaktion, Tippanzeige. Danach eine Sprachaufnahme mit Live-Tonwelle. |
| 8–11 s | Medienkarten fliegen auf Pfaden auf eine Glas-Bühne, werden ausgewählt und gesendet. |
| 11–14,5 s | Videoanruf, dann verwandelt sich der Avatar in einen Gruppenanruf mit Glas-Steuerleiste. |
| 14,5–18 s | Gruppen-Netzwerk mit Nachrichten-Impulsen, die den Pfaden folgen, und Glas-Sprechblasen. |
| 18–21 s | Status-Ringe mit Farbverlauf, ein Avatar wird zur Story-Karte, Herzen steigen auf. |
| 21–24 s | Eine Karte im Glasrahmen, die Route zeichnet sich live, eine Pin fällt, dazu eine Glas-Infokarte. |
| 24–27 s | Ein Zeichenstrom läuft durch ein Glasschloss, Ende-zu-Ende-Verschlüsselung. |
| 27–30 s | Glas-Icons spiralen ins App-Icon, „Bleib in Verbindung.“ mit Licht-Sweep. |

Kamera, Bewegungsunschärfe (8 Sub-Frames pro Bild) und Soundtrack funktionieren wie in `motion/whatsapp-30s`. Schrift: Manrope (OFL). Icons: Material Icons (Apache 2.0).
