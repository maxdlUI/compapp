# KREVO Trailer – Produktionsunterlage (freigegeben)

Storyboard am 02.11.2026 vom Auftraggeber freigegeben. Diese Datei ist die verbindliche Grundlage für alle Sitzungen, die am Trailer arbeiten (Cloud-Sitzung und lokale Sitzung mit Blender-MCP).

## Entscheidungen

- Sprache: **Englisch** (Texte, Voice-over, Schrift).
- Kein Hinweis „Unabhängiges Fanprojekt“ im Trailer.
- Formate: **Master 16:9, 3840×2160, 60 fps** (YouTube) und **9:16, 2160×3840** (TikTok). Master so komponieren, dass ein 9:16-Ausschnitt sauber möglich ist (wichtige Elemente in der Mitte).
- Länge: **40 s**, Musik **120 BPM** (1 Takt = 2 s, 20 Takte). Alle Schnitte auf dem Raster.
- Abspann-URL: **krevo.gg** (gehört dem Auftraggeber).
- Team-Namen: neutrale Platzhalter **Player1, Player2, Player3**.
- Kein eigenes Gameplay vorhanden: Fortnite-Kontext nur über die echte Map.
- Voice-over: männliche, moderne KI-Stimme (Englisch). Lizenz vor Verwendung prüfen.
- Musik/SFX: nur rechtlich freie Quellen (Mixkit, YouTube Audio Library, Pixabay, Freesound nur CC0, Uppbeat mit Credit). Keine Tracks mit Content-ID-Risiko ohne Hinweis.

## Authentizitätsregeln (nicht verhandelbar)

- Keine erfundene KREVO-Oberfläche. UI-Karten werden aus dem echten HTML/CSS der App gerendert (`index.html`, `styles.css`, Schriften Unbounded/Manrope).
- Keine erfundenen Funktionen. KREVO liest **nichts** aus Fortnite aus: Storm-Schaden ist eine **Schätzung** (Zeit × gewählter Schaden pro Sekunde). Die Map-Funktion zeichnet **keine** Zonen. Rotation-Zeiten sind **eigene Presets**, keine offiziellen Phasen.
- Keine KI-generierten Grafiken als Produkt- oder Spieldarstellung. KI nur für Stimme und rein dekorative Elemente (Partikel, Licht).
- Fortnite-Material nur original: Map aus den Spieldateien (Quelle unten). Storm-Darstellung wie auf der Ingame-Map (getönte Fläche außerhalb des Kreises, weiße Linie für den nächsten Kreis).
- Funktionsnamen exakt wie in der App: „Storm“, „Storm Sickness“, „Net Damage“, „Team Net Surge“, „Rotation“, „Map“.

## Creative Direction: „The Bar“

Der lila Balken im KREVO-Symbol entspricht dem echten Storm-Schaden-Balken der App (0 → 500 → 600). Er zieht sich als Leitmotiv durch den Trailer und setzt am Ende das Logo zusammen.

- Farben (aus `styles.css`): Hintergrund `#08070F`, Text/Licht `#EFEAFF`, Storm-Lila `#A78BFA`, Warn-Lila der Sickness-Karte, Orange nur für die Handlungsaufforderung, Türkis = Damage Dealt, Rosa = Damage Taken.
- Materialien: dunkles Rauchglas mit Lichtkante (wie die Glas-Karten), mattes Anthrazit, KREVO-Symbol als helles gebürstetes Metall mit leuchtendem lila Einsatz.
- Licht: Studio im Dunkeln, weiches Kantenlicht oben hinten, lila Fülllicht aus dem Storm, Volumetrik nur im Storm-Nebel.
- Typografie: Unbounded (Wörter, Zahlen), Manrope (Unterzeilen). Zahlen zählen echt hoch.
- Animation: schwer und präzise, Masse, kurzes Nachfedern, nichts schwebt ziellos.
- Kamera: Makro auf Ziffern/Kanten, langsame Bögen, zwei harte Schleuder-Übergänge auf den Drops, Tiefenschärfe ~f/2.
- Sound: Sub-Bass als Storm-Herzschlag; Warn-Pulse aus der App (1,8 s bzw. 0,75 s) als Rhythmus; Klicks/Taster für Eingaben; Whooshes nur bei Kamerabewegung; 0,5 s Stille vor dem Logo.

## Storyboard (40 s)

| # | Zeit | Bild | Kamera | Echte Assets | Übergang | Ton / VO | Funktion |
|---|---|---|---|---|---|---|---|
| S1 | 0:00–0:04 | Echte Fortnite-Map von oben, Storm-Kreis zieht sich zusammen (Ingame-Map-Darstellung) | Top-down, kippt auf 35°, flache Fahrt (2,5D-Parallaxe) | `map_blank.png` / `map_en.png` | Sturz in die Storm-Wand | Brummen, Wind, Sub-Anstieg. VO: „The storm doesn't wait.“ | Spielkontext (keine KREVO-Funktion) |
| S2 | 0:04–0:08 | Volumetrischer lila Nebel, Partikel verdichten sich zu **00:00**, springt auf 00:01 | Schnelle Vorwärtsfahrt, bremst bis scharf | Timer-Ziffern, Unbounded | Storm-Lila → `#A78BFA` | Whoosh, trockener Start-Klick, Musik setzt ein. VO: „Neither should you.“ | Start Storm-Timer |
| S3 | 0:08–0:13 | Storm-Karte als Glasobjekt; Rate 5 → **10 damage per second**; Estimated Damage 0 → 480; Balken füllt sich; Marken 500/600 stehen als Säulen auf | Bogenfahrt, Makro entlang Balken | Storm-Karte aus echtem HTML | Balken trifft 500 | Sekunden-Tick, mechanisches Klacken beim Ratenwechsel. VO: „Estimate your storm damage.“ | Storm-Timer (Schätzung) |
| S4 | 0:13–0:17 | 500: „WARNING: STORM SICKNESS / EXIT THE STORM.“ (Puls 1,8 s); 600: „STORM SICKNESS: ACUTE! / GET OUT OF THE STORM NOW!“ (Puls 0,75 s) | Druck nach vorn, kurzer Shake bei akut | Echte Warnkarte, Biohazard-Symbol, Texte | Letzte Druckwelle fegt Bild frei | Pulse als Sub-Schläge, großer Impact bei 600. VO: „Know when to get out.“ | Storm-Sickness-Warnung |
| S5 | 0:17–0:22 | Rotation-Karte; Presets 1:00 · 1:30 · 2:00 · 3:00 · 5:00 + eigenes Preset „Endzone“ als 3D-Pillen; Countdown 0:10 („10 seconds left“) → „Time's up. Rotate now!“ | Bogen um Pillen, Nahaufnahme Restzeit | Echte Karte, Standard-Presets, Meldungstexte | 90°-Kameradrehung („Rotation“) | Ticken schneller, Ablauf-Ton. VO: „Time every rotation.“ | Rotation-Countdown mit Presets und Ton |
| S6 | 0:22–0:27 | Damage Dealt (Türkis) / Damage Taken (Rosa); Schnellknöpfe +1 +5 +10 / +5 +10 sinken ein; 1,240 und 1,026 → „Dealt − Taken =“ **+214**, „In the plus“ | 45°-Draufsicht, Hochfahrt zum Ergebnis | Echte Net-Damage-Karte, Beispielwerte der Startseite | Karte teilt sich in drei | Taster-Klicks, Zählen, Impact bei +214. VO: „Track your net damage.“ | Net Damage |
| S7 | 0:27–0:32 | Trio Player1/2/3 mit eigenen Trackern; Lichtlinien fließen in **Team Net Surge**; kurz „Copy link“ und „Sign in with Discord“ | Rückfahrt auf alle drei, Vorwärtsfahrt auf Summe | Echte Team-Ansicht | Summen-Karte klappt zur Map-Karte | Drei steigende Töne, Akkord. VO: „Stack it as a team.“ | Team-Modus (Duo/Trio, Link, Abgleich ~3 s) |
| S8 | 0:32–0:36 | Map aus S1 gleitet als Upload in die KREVO-Map-Karte („Your map“, „Stored locally“), Vollbild-Zoom | Fahrt ins Bild | Echte Map-Karte + Map-Bild | Karten fliegen in Formation | Whoosh, Riser. VO: „Your map. Your call.“ | Map-Upload und Vollbild |
| S9 | 0:36–0:40 | Karten fallen zu den drei Formen des KREVO-Symbols zusammen, lila Balken zuletzt; Wortmarke; „Keep the storm under control.“; klein „Free · No account needed for solo“ und **krevo.gg** | Ruhige Nahaufnahme, zieht in Totale | `krevo-symbol.svg`, `krevo-wordmark.svg` | Schwarz | 0,5 s Stille, großer Sub-Drop. VO: „KREVO.“ | Marke und Nutzen |

## Assets

| Asset | Quelle | Status |
|---|---|---|
| Logo, Symbol, Wortmarke | `krevo-logo.svg`, `krevo-symbol.svg`, `krevo-wordmark.svg` | vorhanden |
| Schriften | `unbounded-*.woff2`, `manrope-*.woff2` (SIL OFL) | vorhanden |
| UI-Karten | echtes `index.html` + `styles.css`, gerendert per Playwright | vorhanden (Rendering folgt) |
| Fortnite-Map (aktuelle Season, aus Spieldateien) | `https://fortnite-api.com/images/map.png` (ohne Namen), `https://fortnite-api.com/images/map_en.png` (mit Namen), 2048×2048, Stand 02.11.2026 | per `fetch-assets.sh`, **nicht** ins Repo committen (Rechte bei Epic) |
| Musik, SFX | Mixkit (aus der Cloud erreichbar), weitere freie Quellen | Auswahl folgt |
| Voice-over | männliche KI-Stimme, Englisch | folgt |

## Arbeitsteilung

- **Cloud-Sitzung:** UI-Renderings in 4K, 2D/2,5D-Szenen, Map + Storm, Musik, Stimme, Schnitt, Mastering, 9:16-Fassung.
- **Lokale Sitzung (Blender-MCP auf dem Rechner des Auftraggebers):** 3D-Szenen: Glas-Karten im Raum (S3–S7), Storm-Nebel (S2), KREVO-Symbol in 3D (S9). Renders als PNG-Sequenz (RGBA wo sinnvoll) nach `trailer/renders/<szene>/`.
