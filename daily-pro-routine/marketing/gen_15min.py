"""Builds <project>/index.html: "Stop freebuilding for hours" (white style, energetic voice, ~15.5 s, loop ending).
Usage: python3 gen_15min.py <project dir>   (project/assets holds g1-3.mp4, vo.wav, music.wav, sfx, font, gsap; ../words.json next to project)"""
import json, os, sys, wave, contextlib

OUT = sys.argv[1]
W = [w for w in json.load(open(os.path.join(OUT, "..", "words.json"))) if not w[0].startswith("<") and w[0] != "</s>"]
W = [[w.split("(")[0], a, b] for w, a, b in W]
DUR = 15.5

def t(word, n=1):
    k = 0
    for w, a, b in W:
        if w == word:
            k += 1
            if k == n:
                return a
    raise KeyError(word)

els, tl = [], []
add, js = els.append, tl.append

def clip(i, cls, a, b, inner):
    add(f'<div id="{i}" class="clip {cls}" data-start="{a:.3f}" data-duration="{b - a:.3f}">{inner}</div>')

def video(i, cls, a, b, src, ms):
    add(f'<video id="{i}" class="clip {cls}" src="assets/{src}.mp4" muted playsinline data-start="{a:.3f}" data-duration="{b - a:.3f}" data-media-start="{ms}"></video>')
    js(f'tl.fromTo("#{i}", {{scale: 1.1}}, {{scale: 1.0, duration: 0.25, ease: "power3.out"}}, {a:.3f});')

def words(lines, sid):
    h = []
    for li, line in enumerate(lines):
        parts = []
        for wi, it in enumerate(line):
            txt, key = it[0], it[1]
            n = it[2] if len(it) > 2 else 1
            cls = it[3] if len(it) > 3 else ""
            wid = f"{sid}w{li}_{wi}"
            parts.append(f'<span id="{wid}" class="w {cls}">{txt}</span>')
            at = max(0, t(key, n) - 0.04)
            js(f'tl.fromTo("#{wid}", {{display: "none", opacity: 0, scale: 1.35}}, {{display: "inline-block", opacity: 1, scale: 1, duration: 0.1, ease: "back.out(2)"}}, {at:.3f});')
        h.append(f'<p class="ln l{li}">{" ".join(parts)}</p>')
    return "".join(h)

S = dict(s1=0.0, s2=t("do") - 0.1, s3=t("five", 1) - 0.12, s4=t("five", 2) - 0.1, s5=t("five", 3) - 0.1,
         s6=t("fifteen") - 0.1, s7=t("save") - 0.1)
K = list(S.values()) + [DUR]

# 1 hook: text on top, freebuild window below, "freebuilding" struck through when "hours" lands
clip("c1", "page top", S["s1"], S["s2"],
     words([[("STOP", "stop", 1, "inv big")], [("freebuilding", "freebuilding", 1, "strike")], [("for", "for"), ("hours.", "hours")]], "a"))
video("v1", "pane low", S["s1"], S["s2"], "g2", 33.6)
js(f'tl.fromTo("#c1 .strike i", {{scaleX: 0}}, {{scaleX: 1, duration: 0.18, ease: "power2.out"}}, {t("hours") - 0.02:.3f});')
els[0] = els[0].replace('class="w strike">freebuilding</span>', 'class="w strike">freebuilding<i></i></span>')

# 2
clip("c2", "page", S["s2"], S["s3"], words([[("Do", "do"), ("this", "this")], [("instead.", "instead", 1, "inv")]], "b") +
     '<div class="down" id="down">↓</div>')
js(f'tl.fromTo("#down", {{opacity: 0, y: -30}}, {{opacity: 1, y: 0, duration: 0.25, ease: "power3.out"}}, {t("instead") + 0.1:.3f});')

# steps: big timer + step counter on top, gameplay window, caption below
def step(n, sid, a, b, title_words, sub_words, cuts):
    clip(f"k{sid}", "page step", a, b,
         f'<div class="timer"><b>5:00</b><span>{n} / 3</span></div>' +
         '<div class="cap">' + words([title_words], f"{sid}t") + words([sub_words], f"{sid}s") + '</div>')
    js(f'tl.fromTo("#k{sid} .timer", {{opacity: 0, y: -20}}, {{opacity: 1, y: 0, duration: 0.2}}, {a:.3f});')
    for i, (sa, sb, src, ms) in enumerate(cuts):
        video(f"v{sid}{i}", "pane", sa, sb, src, ms)

step(1, "p", S["s3"], S["s4"], [("Slow", "slow"), ("edits.", "edits", 1)], [("Zero", "zero"), ("mistakes.", "mistakes", 1, "inv")],
     [(S["s3"], S["s4"], "g3", 9.0)])
# spotlight + arrow on the edit counter (it only goes up on a clean edit)
zp, ze = t("zero") - 0.1, S["s4"]
clip("spot", "spotw", zp, ze, '<i class="hole"></i>')
js(f'tl.fromTo("#spot .hole", {{opacity: 0, scale: 1.4}}, {{opacity: 1, scale: 1, duration: 0.3, ease: "power3.out"}}, {zp:.3f});')
ARW = ('<svg class="arw" viewBox="0 0 1080 1920" aria-hidden="true">'
       '<path id="arwp" d="M330 640 C 260 650, 200 680, 170 712" pathLength="1"/>'
       '<path id="arwh" d="M160 680 L 168 716 L 202 702" pathLength="1"/></svg>'
       '<span class="pill">+1 per clean edit</span>')
clip("arw", "arww", zp + 0.12, ze, ARW)
js(f'tl.fromTo("#arw .pill", {{opacity: 0, x: 20}}, {{opacity: 1, x: 0, duration: 0.2, ease: "power3.out"}}, {zp + 0.12:.3f});')
js(f'tl.fromTo("#arwp", {{strokeDashoffset: 1}}, {{strokeDashoffset: 0, duration: 0.25, ease: "power2.out"}}, {zp + 0.2:.3f});')
js(f'tl.fromTo("#arwh", {{strokeDashoffset: 1}}, {{strokeDashoffset: 0, duration: 0.12}}, {zp + 0.42:.3f});')

step(2, "q", S["s4"], S["s5"], [("Same", "same"), ("edits.", "edits", 2)], [("Full", "full", 1, "inv"), ("speed.", "speed", 1, "inv")],
     [(S["s4"], S["s5"], "g3", 21.5)])
sp = t("full") - 0.05
js(f'tl.to("#vq0", {{scale: 1.1, duration: 0.18, ease: "power3.out"}}, {sp:.3f});')
js(f'tl.to("#vq0", {{scale: 1.0, duration: 0.3, ease: "power2.inOut"}}, {sp + 0.6:.3f});')

a5, b5 = S["s5"], S["s6"]
cut_at = [a5, t("real") - 0.05, t("only") - 0.05, t("what") - 0.05, b5]
src = [("g1", 24.0), ("g1", 0.4), ("g1", 37.3), ("g1", 32.5)]
step(3, "r", a5, b5, [("Real", "real"), ("fights.", "fights", 1, "inv")], [("Only", "only"), ("use", "use"), ("what", "what"), ("you", "you"), ("trained.", "trained")],
     [(cut_at[i], cut_at[i + 1], src[i][0], src[i][1]) for i in range(4)])

# 6 the sum
clip("c6", "page", S["s6"], S["s7"], words([[("15", "fifteen", 1, "huge")], [("minutes", "minutes", 4)], [("a", "a"), ("day.", "day", 1, "inv")]], "f"))
# 7 save + small Repline line, ends mid-beat so it loops into "STOP"
clip("c7", "page", S["s7"], DUR, words([[("Save", "save", 1, "big"), ("this.", "this", 2, "big inv")]], "g") +
     '<p class="foot" id="foot">Routine with timers, free:<br><b>repline.pages.dev</b></p>')
js(f'tl.fromTo("#foot", {{opacity: 0, y: 16}}, {{opacity: 1, y: 0, duration: 0.25}}, {S["s7"] + 0.15:.3f});')

for a in K[1:-1]:
    js(f'tl.fromTo("#root", {{x: 0}}, {{x: 8, duration: 0.035, yoyo: true, repeat: 1}}, {a:.3f});')

CSS = """
@font-face { font-family: "InterX"; src: url(assets/inter900.woff2) format("woff2"); font-weight: 100 900; }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 1080px; height: 1920px; overflow: hidden; background: #fff; }
#root { position: relative; width: 1080px; height: 1920px; overflow: hidden; background: #fff; color: #0a0a0a; font-family: "InterX", Arial, sans-serif; }
.clip { position: absolute; inset: 0; }
.page { display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 0 60px; background: #fff; z-index: 2; }
.ln { font-weight: 900; font-size: 112px; line-height: 1.06; letter-spacing: -0.04em; }
.w { display: inline-block; position: relative; }
.big { font-size: 1.3em; }
.huge { font-size: 3.2em; line-height: 0.95; }
.inv { background: #0a0a0a; color: #fff; padding: 0 18px; margin: 6px 0; }
.top { justify-content: flex-start; padding-top: 250px; }
.top .ln { font-size: 104px; }
.strike i { position: absolute; left: -8px; right: -8px; top: 52%; height: 14px; background: #0a0a0a; transform-origin: 0 50%; transform: scaleX(0); }
.low { top: 800px !important; height: 620px !important; }
.down { font-size: 160px; font-weight: 900; margin-top: 30px; }
.step { justify-content: flex-start; }
.timer { position: absolute; top: 200px; left: 0; right: 0; display: flex; flex-direction: column; align-items: center; gap: 4px; }
.timer b { font-size: 150px; font-weight: 900; letter-spacing: -0.05em; font-variant-numeric: tabular-nums; line-height: 1; }
.timer span { font-size: 34px; font-weight: 700; letter-spacing: 0.2em; color: #8a8a8f; }
.cap { position: absolute; top: 1080px; left: 0; right: 0; }
.cap .ln { font-size: 100px; }
.cap .ln + .ln { font-size: 72px; margin-top: 12px; }
.pane { top: 470px; left: 60px; width: 960px; height: 540px; object-fit: cover; border-radius: 26px; z-index: 3; transform-origin: 50% 50%; }
.spotw { z-index: 4; top: 470px; left: 60px; width: 960px; height: 540px; border-radius: 26px; overflow: hidden; }
.hole { position: absolute; left: 8px; top: 232px; width: 112px; height: 72px; border-radius: 20px; box-shadow: 0 0 0 1400px rgba(10,10,10,.55), inset 0 0 0 3px rgba(255,255,255,.95); }
.arww { z-index: 5; }
.arw { position: absolute; inset: 0; width: 1080px; height: 1920px; overflow: visible; }
.arw path { fill: none; stroke: #fff; stroke-width: 9; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 1; filter: drop-shadow(0 3px 6px rgba(0,0,0,.5)); }
.pill { position: absolute; left: 340px; top: 600px; background: #fff; color: #0a0a0a; font-weight: 900; font-size: 40px; padding: 12px 22px; border-radius: 14px; box-shadow: 0 6px 20px rgba(0,0,0,.35); }
.foot { position: absolute; bottom: 260px; left: 0; right: 0; font-weight: 700; font-size: 42px; color: #6b6b70; line-height: 1.35; }
.foot b { color: #0a0a0a; font-weight: 900; }
"""

A = os.path.join(OUT, "assets")
DURS = {}
for f in os.listdir(A):
    if f.endswith(".wav"):
        with contextlib.closing(wave.open(os.path.join(A, f))) as w:
            DURS[f[:-4]] = w.getnframes() / w.getframerate()
SND = [("whoosh", a - 0.05, .25) for a in K[1:-1]]
SND += [("impact", 0.0, .45), ("tick", t("hours") - 0.02, .35), ("tick", t("mistakes") - 0.02, .3), ("tick", t("speed") - 0.02, .3),
        ("impact", t("fights") - 0.04, .4), ("impact", t("fifteen") - 0.04, .45), ("tick", t("day") - 0.02, .3), ("ding", t("save") - 0.03, .25)]
audio = [f'<audio id="vo" class="clip" src="assets/vo.wav" data-start="0" data-duration="{DUR}" data-volume="1"></audio>',
         f'<audio id="mu" class="clip" src="assets/music.wav" data-start="0" data-duration="{DUR}" data-volume="0.28"></audio>']
for i, (n, a, v) in enumerate(SND):
    a = max(0, a)
    audio.append(f'<audio id="fx{i}" class="clip" src="assets/{n}.wav" data-start="{a:.3f}" data-duration="{min(DURS[n], DUR - a):.3f}" data-volume="{v}"></audio>')

page = f'''<!doctype html>
<html lang="en" data-resolution="portrait">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=1080, height=1920" />
<script src="assets/gsap.min.js"></script>
<style>{CSS}</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="{DUR}" data-width="1080" data-height="1920">
{chr(10).join(els)}
{chr(10).join(audio)}
</div>
<script>
const tl = gsap.timeline({{ paused: true }});
{chr(10).join(tl)}
window.__timelines = window.__timelines || {{}};
window.__timelines["main"] = tl;
tl.seek(0);
</script>
</body>
</html>
'''
open(os.path.join(OUT, "index.html"), "w").write(page)
print({k: round(v, 2) for k, v in S.items()})
