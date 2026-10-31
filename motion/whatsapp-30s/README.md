# WhatsApp – 30-Sekunden-Motion-Graphic

Ein 30-Sekunden-Clip in 1080p mit 30 fps. Er stellt die wichtigsten WhatsApp-Funktionen vor. Alles ist als Code gebaut: Es gibt keine Videovorlagen und keine fremden Samples. Unabhängiges Fan- und Demoprojekt, nicht mit WhatsApp oder Meta verbunden.

- **Fertiges Video:** `whatsapp-30s.mp4` (H.264 + AAC, mit Musik und Sounddesign)
- **Live-Vorschau:** `index.html` über einen lokalen Server öffnen, zum Beispiel `npx serve .` im Repo-Hauptordner, dann `/motion/whatsapp-30s/`. Mit der Leertaste startest und stoppst du die Wiedergabe, mit dem Regler springst du an eine Stelle, `?t=12.5` öffnet die Vorschau direkt bei einer Sekunde.
- **Neu rendern:** `node motion/whatsapp-30s/render.cjs`. Dafür brauchst du Node, Playwright (Chromium) und ffmpeg. `--stills 3,8.5` speichert nur Standbilder.

## Storyboard (120 BPM, Schnitte auf dem Beat)

| Zeit | Szene | Motion-Highlights |
|---|---|---|
| 0–3 s | **Intro** | Lichtstreifen fliegen zusammen, ein Punkt fällt (Squash & Stretch), Schockwellen. Die Logo-Kontur zeichnet sich als Pfad (Trim Path), dann folgen Füllung, Glyph-Pop, Partikel und Buchstaben-Reveal der Wortmarke |
| 3 s | **Dive** | Die Kamera zoomt in das Logo hinein, ein Iris-Reveal führt in die nächste Szene |
| 3–8 s | **01 Chatten / 02 Sprechen** | Telefon-Mockup mit Nachrichten (Overshoot-Pops), Häkchen grau → blau, „schreibt …“, Herz-Reaktion. Danach Sprachaufnahme mit Ripple-Ringen und eine Waveform, die mitläuft |
| 8–11 s | **03 Teilen** | Sechs Medienkarten (Fotos, Video, PDF) fliegen auf Bézier-Pfaden mit gepunkteten Spuren ins Raster, dann Auswahl-Haken und Senden-Knopf |
| 11–14,5 s | **04 Anrufen** | Eingehender Videoanruf mit Sonar-Ringen. Der Avatar verwandelt sich in einen 2×2-Gruppenanruf, die Sprecher-Hervorhebung wandert |
| 14,5–18 s | **05 Gemeinsam** | Gruppen-Netzwerk auf einer Umlaufbahn, Verbindungspfade werden gezeichnet, Nachrichten-Impulse folgen den Pfaden (Path Following), dazu Sprechblasen |
| 18–21 s | **06 Status** | Segmentierte Status-Ringe. Ein Avatar verwandelt sich in eine Story-Karte, Herzen steigen auf Wellenpfaden auf |
| 21–24 s | **07 Standort** | Die Karte baut sich auf, Straßen werden gezeichnet. Die Route zeichnet sich live mit einem Standortpunkt, eine Pin fällt mit Bounce |
| 24–27 s | **08 Privat** | Die Nachricht wird zu einem verschlüsselten Zeichenstrom, der durch einen Tunnel-Pfad und das Schloss läuft. Der Bügel schnappt zu, am Ziel wird die Nachricht wieder lesbar |
| 27–30 s | **Outro** | Ein Icon-Ring spiralt ins Zentrum, das Logo schlägt mit Elastic-Bewegung und Flash ein, dazu Partikel-Burst, Wortmarke mit Licht-Sweep und Claim |

## Technik

- **Deterministische Engine:** Jedes Bild ist eine reine Funktion `f(t)`. Dadurch lässt sich der Clip Bild für Bild exakt rendern.
- **Kamera:** Die Szenen liegen an verschiedenen Stellen einer großen Welt. Die Kamera bewegt sich per Keyframes mit eigenem Easing zwischen ihnen, mit Rolle (*bank*) und Zoom-Dip bei Whip-Pans. Der Dive zoomt auf einen festen Bildpunkt (*zoomTo*).
- **Motion Blur:** 8 Sub-Frames pro Bild mit einem 180°-Shutter.
- **Tiefe:** Parallax-Bokeh, ein Punktraster im Weltraum, Flow-Linien, Vignette und Filmkorn.
- **Ton:** `soundtrack.cjs` erzeugt Musik (C–G–Am–F, Kick, Clap, Hats, Bass, Arpeggio, Pad mit Sidechain) und synchrone Effekte (Whooshes, Pops, Riser, Impacts, Klicks).
- Schrift: Manrope (OFL) aus dem Repo. Icons: Material Icons (Apache 2.0) als Pfade.
