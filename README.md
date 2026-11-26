# Repline

Trainings-App für Fortnite: tägliche Pro-Routinen Set für Set mit Timer, Map-Codes, KovaaK's-Playlists, In-Game-Overlay, Bestenlisten mit Preisen, Freunden, Badges, Erinnerungen, eigenen Routinen, Creator-Codes und Drops (Glücksrad).

- Website: https://repline.pages.dev (Cloudflare Pages)
- Windows-App: Electron mit automatischen Updates (Cloudflare R2)
- Konten: Supabase, Anmeldung mit Discord
- Discord: https://discord.gg/3WeFB27Nk9

Unabhängiges Projekt, nicht mit Epic Games verbunden.

## Aufbau

Alles liegt in [`daily-pro-routine/`](daily-pro-routine/):

- `index.html`: die komplette App
- `desktop/`: Windows-App (Electron)
- `supabase/`: Datenbank-Änderungen und die Edge Function `remind`
- `tools/`: Build, Deploy auf Cloudflare, Windows-Release
- `BACKLOG.md`, `DISCORD.md`: Stand und offene Punkte
