"""Builds order/index.html: "The right order" (white page, black type, word by word; marrentm calm + reisshub pace)."""
import json, os, wave, contextlib

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "order")
W = [w for w in json.load(open(os.path.join(ROOT, "..", "vid10", "words.json"))) if not w[0].startswith("<") and w[0] != "</s>"]
W = [[w.split("(")[0], a, b] for w, a, b in W]
DUR = 40.6

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

def clip(i, cls, a, b, inner, extra=""):
    add(f'<div id="{i}" class="clip {cls}" data-start="{a:.3f}" data-duration="{b - a:.3f}"{extra}>{inner}</div>')

def words(spec, sid):
    """spec: list of lines; each line a list of (text, word_key, n, cls). Returns html; queues pops."""
    h = []
    for li, line in enumerate(spec):
        parts = []
        for wi, (txt, key, n, cls) in enumerate(line):
            wid = f"{sid}w{li}_{wi}"
            parts.append(f'<span id="{wid}" class="w {cls}">{txt}</span>')
            at = t(key, n) - 0.03
            js(f'tl.fromTo("#{wid}", {{display: "none", opacity: 0, y: 14}}, {{display: "inline-block", opacity: 1, y: 0, duration: 0.12, ease: "power2.out"}}, {at:.3f});')
        h.append(f'<p class="ln l{li}">{" ".join(parts)}</p>')
    return "".join(h)

def P(*items):  # helper: P(("You've","youve"),...) -> line
    out = []
    for it in items:
        txt, key = it[0], it[1]
        n = it[2] if len(it) > 2 else 1
        cls = it[3] if len(it) > 3 else ""
        out.append((txt, key, n, cls))
    return out

# scene times
S = dict(s1=0.0, s2=t("so") - 0.12, s3=t("because") - 0.15, s4=t("pros") - 0.12, s5=t("first") - 0.12,
         s6=t("then", 1) - 0.12, s7=t("then", 2) - 0.12, s8=t("most") - 0.12, s9=t("thats") - 0.12,
         s10=t("fifteen") - 0.12, s11=t("precision", 2) - 0.12)
K = list(S.values()) + [DUR]

# --- 1 hook
clip("c1", "page", S["s1"], S["s2"], words([P(("You've", "youve"), ("played", "played")), P(("thousands", "thousands", 1, "big")), P(("of", "of"), ("hours.", "hours"))], "a"))
# --- 2
clip("c2", "page", S["s2"], S["s3"], words([P(("So", "so"), ("why", "why"), ("aren't", "arent"), ("you", "you")), P(("getting", "getting"), ("better?", "better", 1, "inv"))], "b"))
# --- 3 split: white text on top, fight below
clip("c3", "page split", S["s3"], S["s4"], words([P(("Because", "because"), ("playing", "playing")), P(("isn't", "isnt", 1, "inv"), ("practice.", "practice", 1, "inv"))], "c"))
add(f'<video id="v3" class="clip vsplit" src="assets/g1.mp4" muted playsinline data-start="{S["s3"]:.3f}" data-duration="{S["s4"] - S["s3"]:.3f}" data-media-start="14"></video>')
js(f'tl.fromTo("#v3", {{scale: 1.12}}, {{scale: 1.0, duration: 0.35, ease: "power3.out"}}, {S["s3"]:.3f});')
# --- 4
clip("c4", "page", S["s4"], S["s5"], words([P(("Pros", "pros"), ("don't", "dont"), ("train", "train", 1), ("more.", "more", 1, "big"))], "d") +
     '<div class="gap"></div>' + words([P(("They", "they"), ("train", "train", 2), ("in", "in"), ("the", "the")), P(("right", "right", 1, "inv"), ("order.", "order", 1, "inv"))], "d2"))

# --- steps (gameplay window on white)
def step(n, sid, a, b, vid, mstart, title, tkey, tn, subs, cuts=None):
    clip(f"k{sid}", "page step", a, b, f'<span class="num">{n} / 3</span>' + words([P((title, tkey, tn, "title"))], f"{sid}t") +
         '<div class="subs">' + words(subs, f"{sid}s") + '</div>')
    segs = cuts or [(a, b, mstart)]
    for i, (sa, sb, ms) in enumerate(segs):
        add(f'<video id="v{sid}{i}" class="clip pane" src="assets/{vid}.mp4" muted playsinline data-start="{sa:.3f}" data-duration="{sb - sa:.3f}" data-media-start="{ms}"></video>')
        js(f'tl.fromTo("#v{sid}{i}", {{scale: 1.08}}, {{scale: 1.0, duration: 0.3, ease: "power3.out"}}, {sa:.3f});')
    js(f'tl.fromTo("#k{sid} .num", {{opacity: 0}}, {{opacity: 1, duration: 0.2}}, {a:.3f});')

step(1, "p", S["s5"], S["s6"], "g3", 8, "Precision.", "precision", 1,
     [P(("Slow,", "slow"), ("clean", "clean"), ("edits.", "edits")), P(("Zero", "zero"), ("mistakes.", "mistakes", 1, "inv"))])
# zoom punch + ring on the edit (reisshub-style)
zp = t("clean") - 0.05
js(f'tl.to("#vp0", {{scale: 1.45, x: 60, y: -10, duration: 0.25, ease: "power3.out"}}, {zp:.3f});')
js(f'tl.to("#vp0", {{scale: 1.0, x: 0, y: 0, duration: 0.3, ease: "power2.inOut"}}, {t("zero") - 0.1:.3f});')
clip("ring", "ringw", zp + 0.15, t("zero") - 0.1, '<i class="ring"></i>')
js(f'tl.fromTo("#ring .ring", {{scale: 1.6, opacity: 0}}, {{scale: 1, opacity: 1, duration: 0.2, ease: "back.out(2)"}}, {zp + 0.15:.3f});')

step(2, "q", S["s6"], S["s7"], "g2", 26, "Speed.", "speed", 1,
     [P(("Same", "same"), ("moves.", "moves"), ("Faster.", "faster", 1, "inv")), P(("Until", "until"), ("you", "you", 2), ("stop", "stop"), ("thinking.", "thinking"))])
a7, b7 = S["s7"], S["s8"]
fc = [a7, a7 + 1.1, a7 + 2.0, a7 + 2.9, a7 + 3.8, b7]
offs = [12, 20, 27, 15, 31]
step(3, "r", a7, b7, "g1", 12, "Pressure.", "pressure", 1,
     [P(("Real", "real"), ("fights.", "fights", 1, "inv")), P(("Only", "only"), ("use", "use"), ("what", "what"), ("you", "you", 3), ("just", "just"), ("trained.", "trained"))],
     cuts=[(fc[i], fc[i + 1], offs[i]) for i in range(5)])

# --- 8 silence line
clip("c8", "page", S["s8"], S["s9"], words([P(("Most", "most"), ("players", "players"), ("start", "start")), P(("at", "at"), ("step", "step", 1, "inv"), ("three.", "three", 1, "inv"))], "e") +
     '<div class="gap"></div>' + words([P(("Every", "every", 1, "sm"), ("single", "single", 1, "sm"), ("day.", "day", 1, "sm"))], "e2"))
# --- 9
clip("c9", "page", S["s9"], S["s10"], words([P(("That's", "thats"), ("why", "why", 2), ("their", "their")), P(("mechanics", "mechanics")), P(("never", "never", 1, "big"), ("show", "show", 1, "big"), ("up", "up", 1, "big")), P(("in", "in", 2), ("fights.", "fights", 2))], "f"))
# --- 10 offer
clip("c10", "page", S["s10"], S["s11"], words([P(("15", "fifteen"), ("minutes.", "minutes")), P(("This", "this"), ("order.", "order", 2)), P(("Every", "every", 2, "inv"), ("day.", "day", 2, "inv"))], "g") +
     '<p class="foot" id="foot">The full routine with timers is free<br><b>repline.pages.dev</b></p>')
js(f'tl.fromTo("#foot", {{opacity: 0, y: 20}}, {{opacity: 1, y: 0, duration: 0.3}}, {t("the", 2) - 0.05:.3f});')
# --- 11 loop line
clip("c11", "page", S["s11"], DUR, words([P(("Precision.", "precision", 2)), P(("Speed.", "speed", 2)), P(("Pressure.", "pressure", 2, "inv"))], "h"))

# soft page flash between scenes (hard cut feel, very subtle)
for i, a in enumerate(K[1:-1]):
    js(f'tl.fromTo("#root", {{x: 0}}, {{x: 6, duration: 0.04, yoyo: true, repeat: 1}}, {a:.3f});')

CSS = """
@font-face { font-family: "InterX"; src: url(assets/inter900.woff2) format("woff2"); font-weight: 100 900; }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 1080px; height: 1920px; overflow: hidden; background: #fff; }
#root { position: relative; width: 1080px; height: 1920px; overflow: hidden; background: #fff; color: #0a0a0a; font-family: "InterX", Arial, sans-serif; }
.clip { position: absolute; inset: 0; }
.page { display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 0 70px; background: #fff; z-index: 2; }
.ln { font-weight: 900; font-size: 96px; line-height: 1.08; letter-spacing: -0.035em; }
.w { display: inline-block; }
.big { font-size: 1.22em; }
.inv { background: #0a0a0a; color: #fff; padding: 0 16px; margin: 4px 0; }
.sm { font-size: 0.62em; font-weight: 800; color: #3a3a3d; }
.gap { height: 56px; }
.split { justify-content: flex-start; padding-top: 250px; }
.split .ln { font-size: 92px; }
.vsplit { top: 806px; height: 1114px; width: 1080px; object-fit: cover; z-index: 3; }
.step { justify-content: flex-start; padding-top: 0; }
.num { position: absolute; top: 230px; left: 0; right: 0; font-family: "InterX"; font-weight: 600; font-size: 34px; letter-spacing: 0.2em; color: #8a8a8f; }
.step > .l0 { position: absolute; top: 1160px; left: 0; right: 0; }
.title { font-size: 132px; letter-spacing: -0.045em; }
.subs { position: absolute; top: 1340px; left: 0; right: 0; }
.subs .ln { font-size: 58px; font-weight: 800; color: #1c1c1e; line-height: 1.25; letter-spacing: -0.02em; }
.pane { top: 470px; left: 60px; width: 960px; height: 540px; object-fit: cover; border-radius: 22px; z-index: 3; transform-origin: 50% 50%; }
.ringw { z-index: 4; }
.ring { position: absolute; left: 470px; top: 640px; width: 190px; height: 190px; border-radius: 50%; border: 10px solid #0a0a0a; box-shadow: 0 0 0 8px #fff; }
.foot { position: absolute; bottom: 240px; left: 0; right: 0; font-weight: 600; font-size: 40px; color: #6b6b70; line-height: 1.35; letter-spacing: -0.01em; }
.foot b { color: #0a0a0a; font-weight: 800; }
"""

# ---------- sound ----------
A = os.path.join(OUT, "assets")
DURS = {}
for f in os.listdir(A):
    if f.endswith(".wav"):
        with contextlib.closing(wave.open(os.path.join(A, f))) as w:
            DURS[f[:-4]] = w.getnframes() / w.getframerate()
SND = [("whoosh", a - 0.06, .18) for a in K[1:-1]]
SND += [("tick", t(k, n) - 0.02, .22) for k, n in [("thousands", 1), ("better", 1), ("practice", 1), ("order", 1), ("mistakes", 1), ("faster", 1), ("fights", 1), ("three", 1), ("never", 1), ("day", 2), ("pressure", 2)]]
SND += [("impact", t("precision", 1) - 0.05, .35), ("impact", t("speed", 1) - 0.05, .35), ("impact", t("pressure", 1) - 0.05, .35), ("whoosh", zp, .3)]
SND += [("ding", t("repline") - 0.05, .25)]
audio = [f'<audio id="vo" class="clip" src="assets/vo.wav" data-start="0" data-duration="{DUR}" data-volume="1"></audio>',
         f'<audio id="mu" class="clip" src="assets/music.wav" data-start="0" data-duration="{DUR}" data-volume="0.22"></audio>']
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
