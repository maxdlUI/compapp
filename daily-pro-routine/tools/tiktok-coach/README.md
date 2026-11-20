# TikTok ad "Coach" (17 s, 1080×1920)

- `overlay.html`: all animations, timed to the voiceover; `window.render(t)` draws the frame at second `t`.
- `frames.js`: renders 510 transparent PNG frames (30 fps) into `fr/` with Playwright.
- Then ffmpeg puts the frames over a 1080×1920 background video and mixes voiceover and sound effects.

The finished video lands in `daily-pro-routine/marketing/` (not in git, too large). To swap the background, cut new clips to the same scene times (cuts at 1.65, 6.02, 7.72, 9.85, 12.0, 13.08, 14.03, 15.18 s) and run the ffmpeg step again.
