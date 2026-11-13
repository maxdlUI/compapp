# Stream banner

Animated lower-third for streamers (OBS media source, transparent WebM, 1920x1080, 20 s loop).

1. Copy `../../app/icons/icon-1024.png` here as `icon.png`.
2. `node render.js full launch` and `node render.js full evergreen` (PNG frames, needs Playwright and the Inter Display font).
3. Encode, for example:
   `ffmpeg -f lavfi -i "color=c=black@0.0:s=1920x1080:r=30:d=20,format=rgba" -framerate 30 -i frames_launch/%04d.png -filter_complex "[1:v]format=rgba[b];[0:v][b]overlay=x=360:y=800:format=auto,format=yuva420p" -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 28 -auto-alt-ref 0 -an Repline-Stream-Banner-launch.webm`

`launch` shows the launch month (free Pro until 12 December); `evergreen` says "Free to start" instead.
