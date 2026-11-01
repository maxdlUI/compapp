# WhatsApp – 30-Sekunden-Motion-Graphic im Original-Apple-Look

Ein Clip in 1080p mit 30 fps, der WhatsApp so zeigt, wie die App unter iOS 26 auf einem iPhone 17 Pro aussieht: mit Liquid Glass, SF Pro und dem Original-WhatsApp-Logo.

- **Video:** `whatsapp-ios.mp4` (H.264 + AAC, mit Musik und Sounddesign)
- **Assets laden:** `./fetch-assets.sh` (braucht curl und 7z). Danach liegen sie in `./assets/`.
- **Vorschau:** im Repo-Hauptordner `npx serve .` starten und `/motion/whatsapp-ios/` öffnen.
- **Neu rendern:** `node motion/whatsapp-ios/render.cjs`

## Original-Assets (absichtlich nicht im Repo)

| Asset | Quelle | Hinweis |
|---|---|---|
| SF Pro Display / SF Pro Text | Apple, [developer.apple.com/fonts](https://developer.apple.com/fonts/) | Apple lizenziert die Schrift nur für UI-Mockups von Apple-Plattformen. Weitergeben ist nicht erlaubt. |
| iPhone 17 Pro, Silber (Bezel-PNG) | Apple, [Design Resources](https://developer.apple.com/design/resources/) | Gedacht für Mockups und App-Marketing |
| WhatsApp-Logo (SVG) | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:WhatsApp.svg) | Gemeinfrei, aber als Marke von WhatsApp LLC / Meta geschützt |

Ohne Assets läuft die Seite trotzdem: Dann wird Manrope als Schrift und ein gezeichneter Rahmen statt des Bezels verwendet.

## Was dem Original entspricht

- **Chat-Screen wie WhatsApp unter iOS 26:**
  - Liquid-Glass-Kapseln oben: Zurück mit Ungelesen-Zähler, Kontakt mit Status, Video- und Anruf-Knopf
  - beiger Chat-Hintergrund mit Doodle-Muster
  - Sprechblasen mit Schwänzchen, ausgehend in `#D9FDD3`
  - Uhrzeiten und Häkchen grau, dann blau `#53BDEB`
  - Herz-Reaktion
  - „schreibt …“ in der Kopfzeile
  - Sprachnachricht mit Profilbild und Mikrofon-Symbol
  - Eingabeleiste mit +, Sticker, Kamera und Mikrofon
  - iOS-Statusleiste und Home-Indikator
- **App-Icon:** grüner Squircle mit dem Original-Logo
- **Look:** Apple-Keynote-Stil mit schwarzem Hintergrund, grünen Licht-Orbs, SF-Pro-Headlines mit enger Laufweite und grünem Verlauf, dazu Glas-Pillen
- **Gelbes Verschlüsselungs-Banner** wie im Original

Ablauf, Kamera, Bewegungsunschärfe (8 Sub-Frames pro Bild) und Soundtrack funktionieren wie in `motion/whatsapp-30s`.
