# Notes for Claude

This repository is **Repline**; everything lives in `daily-pro-routine/`. The old KREVO project was removed on purpose: Repline and KREVO are separate and must not be mixed.

## How the owner wants to work

- Reply in **German**, short and clear. The Repline app and website itself are in **English** (Apple-style design).
- **Nothing that costs money** without asking first. Before uploading or turning on anything that could cost money (hosting, storage, paid APIs, credits), stop and ask. The owner wants zero cost risk.
- **No GitHub for hosting or deploys.** Everything runs on Cloudflare (Pages + R2). GitHub only stores the code.
- **No code signing** for the Windows app.
- **Show a preview first** (an Artifact) before building a bigger new feature into the app; build it after the owner approves.
- **Never ask for tokens or secrets in chat.** Use the credential form or the environment settings.
- Keep the owner's email and personal details private.
- Commit and push on branch `claude/nifty-cannon-p4pndg`. No pull requests unless asked. No model names in commits.

## Repline at a glance

- Fortnite training: daily pro routines set by set with timers, map codes, KovaaK's playlists, in-game overlay (Windows app), leaderboards with prizes, friends, badges, streak freezes, reminders, routine builder and sharing, creator codes, Drops (reward wheel).
- Website: https://repline.pages.dev (Cloudflare Pages, one worker file). Windows app: Electron with auto-updates from Cloudflare R2.
- Accounts: Supabase project `wjwjvwjwlipjxsgufffj`, sign-in with Discord.
- Plans: Free / Standard €3.99 (€29.99/year) / Pro €6.99 (€49.99/year). Payments are not live yet ("Coming soon").
- Launch month: every Pro feature free for signed-in players until 13 Dec 2026 00:00 Berlin (`LAUNCH_END` in `index.html`, `effective_plan()` in the database). A scheduled task posts the end announcement in Discord.

## Files

- `daily-pro-routine/index.html`: the whole app (single file).
- `daily-pro-routine/supabase/00X_*.sql`: database changes in order. `supabase/functions/remind/index.ts`: edge function (reminders, gift DMs, #drops posts).
- `daily-pro-routine/desktop/`: Electron app (`package.json` holds the version).
- `daily-pro-routine/tools/`: `build_app.py` (builds `app/` and `desktop/app/`), `deploy.sh preview|production` (Cloudflare Pages), `publish_windows.py <dist>` (uploads the installer to R2 and writes `release.json`).
- `daily-pro-routine/BACKLOG.md`: what is done and what is open. `DISCORD.md`: Discord server setup.

## Release steps

1. `python3 daily-pro-routine/tools/build_app.py`
2. Windows app (only when app code changed): raise `version` in `desktop/package.json` and `SITE.download.version` in `index.html`; build the NSIS installer on Linux with wine (`npx electron-builder --win nsis --x64 --publish never` in a copy of `desktop/`), then `python3 tools/publish_windows.py <dist folder>`.
3. `bash daily-pro-routine/tools/deploy.sh preview` then `bash daily-pro-routine/tools/deploy.sh production`.
4. Commit and push.

The Cloudflare token and the Discord bot token are saved on this cloud environment (network secrets), so `deploy.sh` and Discord API calls work without asking.

## Discord

Server id `1570385914096783381`, invite https://discord.gg/3WeFB27Nk9, bot/app id `1570194691465420870`. Channel #drops `1570793070125908108` (only the bot posts there), #announcements `1570387421269467186`, #ideas `1570387442668671079`, #download `1570387423895224410`.

## Routine Studio (dev only)

Public routines and blocks are stored in the database table `routine_catalog` (newest row is live, `009_routine_studio.sql`). The app applies the cached catalog on load (`applyCatalog`, localStorage `rl.catalog`) and refreshes it from the database; the routines in `index.html` are only the fallback. Devs edit them on `#studio` and publish; pictures go to the storage bucket `set-images`. To change routines, prefer the studio (or publish a new catalog version) over editing `index.html`.

## Open right now (13 Nov 2026)

- **Drops is live** (website + Windows app 1.6.8, `008_drops.sql` applied, `remind` edge function v7 deployed: wins post in #drops).
- Drop points are +10/+15/+25/+50 (confirmed by the owner) so spins don't outweigh training on the leaderboard.
- Later for Drops: overlay skins, timer ring styles and sound packs as wheel items.
- Partners: per-partner commission (50 % for 3 months, then 40 %) and vanity creator codes, once a partner agrees.
- TikTok: posts go through the vidIQ connector (TikTok account "Repline" connected). Every post needs the owner's OK on the draft.
