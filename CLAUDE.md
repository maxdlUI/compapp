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
- **Announce every update in Discord** (#announcements, ping the Updates role `1570387326834581535`): a short English post with what is new, after the release is live.
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
2. Windows app (only when app code changed): raise `version` in `desktop/package.json` and `SITE.download.version` in `index.html`, commit and push. Wine no longer runs in the cloud container, so the installer is built on a GitHub Windows runner (`.github/workflows/windows-build.yml`, build only; it runs on push when `desktop/package.json` changes, or via workflow_dispatch). Download the `windows-installer` artifact (GitHub MCP `download_workflow_run_artifact`; the blob hosts are allowed in the environment), unzip, then `python3 tools/publish_windows.py <dist folder>`. Hosting and updates stay on Cloudflare R2.
3. `bash daily-pro-routine/tools/deploy.sh preview` then `bash daily-pro-routine/tools/deploy.sh production`.
4. Commit and push.
5. Post the update in Discord #announcements (see above).

The Cloudflare token and the Discord bot token are saved on this cloud environment (network secrets), so `deploy.sh` and Discord API calls work without asking.

## Discord

Server id `1570385914096783381`, invite https://discord.gg/3WeFB27Nk9, bot/app id `1570194691465420870`. Channel #drops `1570793070125908108` (only the bot posts there), #announcements `1570387421269467186`, #report-a-bug `1572181354353926165`, #suggest-a-feature `1572183657177940049`, #ask-a-question `1572188220970635324` (text channel), #download `1570387423895224410`.

## Routine Studio (dev only)

Public routines and blocks are stored in the database table `routine_catalog` (newest row is live, `009_routine_studio.sql`). The app applies the cached catalog on load (`applyCatalog`, localStorage `rl.catalog`) and refreshes it from the database; the routines in `index.html` are only the fallback. Devs edit them on `#studio` and publish; pictures go to the storage bucket `set-images`. To change routines, prefer the studio (or publish a new catalog version) over editing `index.html`.

## Verified routines and aim progress (1.8, live 16 Nov 2026)

- `010_verified_runs.sql`: `routine_runs` + `run_start` / `run_finish` (server checks real time ≥ 95 % of planned; Windows app with game detection needs the game in ≥ 80 % of game sets). A trigger clamps `training_days.routines/minutes` to counted runs from `runs_since()` (= 2026-11-17). Spins come from counted runs; a Verified run's spin = 2 Golden Tickets (`drops.tickets`). Leaderboard returns `verified`.
- No skipping: the next set starts only when the set is done.
- Windows app: game detection reads only the process list (`tasklist`), never Fortnite itself. KovaaK's tracking reads KovaaK's own `stats/*.csv` files (`desktop/main.js`), syncs to `aim_scores`. Both have switches in Settings → Tracking. Page `#aim` (Free: 7 days, Pro: all + coach notes).
- Fortnite stats were dropped on purpose (owner's decision).

## Open right now (13 Nov 2026)

- **Personal Plan (the coach) is live (1.9.0, renamed and new card in 1.10.0):** page `#ai`, shown as „Personal Plan“ with a band on its home card; understands cup dates (today, tomorrow, in N days, weekdays, next week), players write what they want to train, the coach builds the routine from the catalog (`COACH` module in `index.html`, goal id `coach`, today's routine in localStorage `rl.coach`). Runs on the player's device, so it costs nothing. Next step: a small language model in the browser for unusual sentences (check a free source for the model first). Draft: https://claude.ai/artifact/Sqqk2w4naZMPceeExTG8cC (the owner's knowledge is in `daily-pro-routine/COACH.md`). Limits decided by the owner: Free no coach, **Standard 1 routine a day, Pro 3 a day** (counted on the server). During the launch month everyone signed in counts as Pro.

- **Drops is live** (website + Windows app 1.6.8, `008_drops.sql` applied, `remind` edge function v7 deployed: wins post in #drops).
- Drop points are +10/+15/+25/+50 (confirmed by the owner) so spins don't outweigh training on the leaderboard.
- Drops items since 1.10.0 (`012_more_items.sql`): overlay skins (neon, carbon, glass, gold = Pro forever), timer rings (neon, bold, thin, pulse), sound packs (coin, victory, synth, air horn). Skins/rings/sounds are equipped in settings (`settings.skin`, `settings.ring`, `settings.alertSound`) and reach the Windows overlay through the overlay state.
- **Bug and idea bot (17 Nov 2026):** `013_bug_reports.sql` + `014_feature_ideas.sql` (ideas are rows with kind = 'idea', upvotes in `idea_votes`, `/idea`, #suggest-a-feature, Settings → Suggest a feature; statuses for ideas: Planned / Done / Not now). + edge function `discord` (verify_jwt off, Discord Interactions Endpoint URL). Reports come from #report-a-bug (button, `/bug`) and from Repline (Settings → Help → Report a bug, adds version, device, last error). The bot sorts them (area, priority, similar), opens a thread, DMs the reporter follow-up questions with buttons, DMs devs with Working/Fixed/Not a bug buttons; Fixed thanks the reporter by DM, in the thread and as an in-app notice. A scheduled task (`trig_017XkBUkkCRqC5X7QgaBbwBm`, daily 20:42 Berlin) fires into this session: Claude analyses new reports in the code and DMs the devs a German summary.
- **Question bot (17 Nov 2026):** normal text channel #ask-a-question (the old forum was deleted). `015_questions_bot.sql` + `016_questions_channel.sql` (cursor row in `ask_threads`, `ask_answers`, pg_cron job `repline-questions` every minute) ping edge function `ask` (verify_jwt off). It replies to questions from its FAQ (in `functions/ask/index.ts`, update it when features change) with the player mentioned, no repeats within an hour, ✅ on thanks, DMs devs with a link when unsure, ignores devs and replies to devs. Needs the Message Content intent (set on the app).
- **Welcome for new players (1.11.0, 17 Nov 2026):** `017_welcome.sql`. Popup after sign-in for players who never trained (`welcomeCheck()` / `openWelcome()` in `index.html`, RPCs `welcome_state` / `welcome_seen`): Personal Plan (Free players get one, once: `profiles.welcome_plan_used`, handled in `coach_use`) or start Quick: Aim / Quick: Mechanics / Daily Pro Routine. Bonus spin: `spins_earned()` adds +1 on the day of the first counted routine. The `ask` function sends a welcome DM to new sign-ups and one reminder after 24 h without training (`welcome_dm_at`, `nudge_dm_at`; players from before 17 Nov 13:00 UTC were skipped).
- **Mind (website live 19 Nov 2026):** page `#mind` (nav "Mind", two home cards, a "Cool down?" card on the done page). Separate script block `window.ReplineMind` in `index.html` (before the main script): 8 breathing exercises (cyclic sighing, box, 4-7-8, resonance, long exhale, triangle, wake-up, alternate nostril) and 4 focus games (focus dot, calm trigger, smooth follow, edge vision). The owner removed Slow the beat, Zone memory and Number grid on purpose. Free: box, sighing, long exhale, focus dot, calm trigger; the rest is Pro (`window.replinePlanId`). Best scores in localStorage `rl.labs.best.*`. Windows app: Ctrl+Shift+B shows box breathing in the overlay (`toggleBreath` in `desktop/main.js`, `onBreath` in `overlay-preload.js`/`overlay.html`); Windows 1.12.0 is live (19 Nov 2026).
- Partners: per-partner commission (50 % for 3 months, then 40 %) and vanity creator codes, once a partner agrees.
- TikTok: posts go through the vidIQ connector (TikTok account "Repline" connected). Every post needs the owner's OK on the draft.
