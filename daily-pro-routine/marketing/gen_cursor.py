"""Builds <project>/index.html: "Play like the pros" (9:16, ~17 s). Hook over gameplay, kinetic "set routine" cards,
Repline logo, then a camera that follows a Windows cursor through the app (pick Quick Start, Start training, timer,
leaderboard climb), end card. Usage: python3 gen_cursor.py <project dir>
(project/assets: goal.jpg quick.jpg board.jpg (2880x1800 app shots), intro.mp4 + timer.mp4 (app recording, 1440x900),
g1.mp4 g3.mp4 gameplay, vo.wav music.wav click.wav + kit sfx, gsap, font; ../words.json = pocketsphinx alignment)"""
import json, os, sys, wave, contextlib

OUT = sys.argv[1]
W = [w for w in json.load(open(os.path.join(OUT, "..", "words.json"))) if not w[0].startswith("<") and w[0] != "</s>"]
W = [[w.split("(")[0], a, b] for w, a, b in W]
DUR = 17.0


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


def clip(i, cls, a, b, inner="", tag="div", extra=""):
    add(f'<{tag} id="{i}" class="clip {cls}" data-start="{a:.3f}" data-duration="{b - a:.3f}"{extra}>{inner}</{tag}>')


def video(i, cls, a, b, src, ms=0):
    add(f'<video id="{i}" class="clip {cls}" src="assets/{src}.mp4" muted playsinline data-start="{a:.3f}" data-duration="{b - a:.3f}" data-media-start="{ms}"></video>')


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


T = dict(a2=t("you", 2) - 0.06, b=t("a", 1) - 0.08, c=t("thats") - 0.1, d=t("pick") - 0.12, e=t("map") - 0.06,
         f=t("and") - 0.08, g=t("its") - 0.1)

# ---------- A: hook over gameplay
video("ga", "full dim", 0, T["a2"], "g3", 9.0)
video("gb", "full dim", T["a2"], T["b"], "g1", 24.0)
js(f'tl.fromTo("#ga", {{scale: 1.18}}, {{scale: 1.05, duration: {T["a2"]:.2f}, ease: "none"}}, 0);')
js(f'tl.fromTo("#gb", {{scale: 1.05}}, {{scale: 1.22, duration: {T["b"] - T["a2"]:.2f}, ease: "none"}}, {T["a2"]:.3f});')
clip("ta", "txt", 0, T["a2"], words([[("If", "if"), ("you", "you"), ("ever", "ever"), ("wanna", "wanna")],
                                     [("play", "play"), ("like", "like")], [("the", "the"), ("PROS", "pros", 1, "inv big")]], "a"))
clip("tb", "txt", T["a2"], T["b"], words([[("You", "you", 2), ("need", "need")], [("ONE", "one", 1, "inv big")], [("thing.", "thing")]], "b"))
js(f'tl.to("#tb .l1", {{scale: 1.12, duration: 0.5, ease: "power2.out"}}, {t("thing"):.3f});')

# ---------- B: set routine (white)
CARDS = [("1", "Edit wall", "Mechanics"), ("2", "Freebuild · 110%", "Mechanics"), ("3", "Piece control", "Fights")]
cards = "".join(f'<div class="card" id="cd{i}"><b>{n}</b><span>{a}<small>{c}</small></span><i>5:00</i></div>' for i, (n, a, c) in enumerate(CARDS))
DAYS = "".join(f'<div class="day" id="dy{i}"><em>✓</em><span>{d}</span></div>' for i, d in enumerate("MTWTFSS"))
clip("sb", "white", T["b"], T["c"], f'<div class="cards">{cards}</div><div class="days">{DAYS}</div>')
clip("tb1", "head", T["b"], t("same") - 0.08, words([[("A", "a", 1), ("set", "set")], [("routine.", "routine", 1, "inv")]], "c"))
clip("tb2", "head", t("same") - 0.08, t("every", 1) - 0.08, words([[("Same", "same")], [("order.", "order", 1, "inv")]], "d"))
clip("tb3", "head", t("every", 1) - 0.08, T["c"], words([[("Every", "every", 1), ("single", "single")], [("day.", "day", 1, "inv")]], "e"))
for i in range(3):
    at = t("routine", 1) + 0.05 + i * 0.12 if i == 0 else t("same") + (i - 1) * 0.2
    at = [t("routine", 1) + 0.1, t("same") + 0.05, t("order") + 0.05][i]
    js(f'tl.fromTo("#cd{i}", {{opacity: 0, x: 700, rotation: 14}}, {{opacity: 1, x: 0, rotation: 0, duration: 0.32, ease: "power3.out"}}, {at:.3f});')
js(f'tl.to(".cards", {{y: -120, scale: 0.86, duration: 0.3, ease: "power2.inOut"}}, {t("every", 1) - 0.05:.3f});')
for i in range(7):
    at = t("every", 1) + 0.05 + i * 0.11
    js(f'tl.fromTo("#dy{i}", {{opacity: 0, y: 30}}, {{opacity: 1, y: 0, duration: 0.15, ease: "power3.out"}}, {at:.3f});')
    js(f'tl.fromTo("#dy{i} em", {{scale: 0, backgroundColor: "#fff"}}, {{scale: 1, backgroundColor: "#0a0a0a", duration: 0.15, ease: "back.out(3)"}}, {at + 0.12:.3f});')

# ---------- C: That's Repline
LOGO = ('<svg class="ring" viewBox="0 0 200 200"><circle id="rg" cx="100" cy="100" r="84" pathLength="1"/></svg>'
        '<p class="small" id="thats">That\'s</p><p class="logo" id="logo">' + "".join(f'<span>{c}</span>' for c in "REPLINE") + '</p>')
clip("sc", "black", T["c"], T["d"], LOGO)
js(f'tl.fromTo("#thats", {{opacity: 0, y: 20}}, {{opacity: 1, y: 0, duration: 0.15}}, {t("thats") - 0.03:.3f});')
js(f'tl.fromTo("#rg", {{strokeDashoffset: 1, rotation: -90, transformOrigin: "50% 50%"}}, {{strokeDashoffset: 0, rotation: 0, duration: 0.45, ease: "power3.out"}}, {t("thats"):.3f});')
js(f'tl.fromTo("#logo span", {{opacity: 0, y: 40}}, {{opacity: 1, y: 0, duration: 0.22, stagger: 0.03, ease: "back.out(2)"}}, {t("repline") - 0.05:.3f});')
js(f'tl.to(".ring", {{scale: 1.25, opacity: 0.3, duration: 0.5, ease: "power2.out"}}, {t("repline"):.3f});')

# ---------- D/E/F: the app with a camera that follows the cursor
FX, FY = 540, 880  # where the camera focus lands in the frame


def cam(at, px, py, s, dur=0.45, ease="power3.inOut"):
    x, y = FX - px * s, FY - py * s
    if dur <= 0:
        js(f'tl.set("#cam", {{x: {x:.1f}, y: {y:.1f}, scale: {s}}}, {at:.3f});')
    else:
        js(f'tl.to("#cam", {{x: {x:.1f}, y: {y:.1f}, scale: {s}, duration: {dur}, ease: "{ease}"}}, {at:.3f});')


def cur(at, x, y, dur=0.4):
    js(f'tl.to("#cur", {{x: {x}, y: {y}, duration: {dur}, ease: "power2.inOut"}}, {at:.3f});')


CLICKS = []


def click(at, x, y, box=None):
    CLICKS.append(at)
    js(f'tl.to("#cur svg", {{scale: 0.82, duration: 0.06, yoyo: true, repeat: 1, transformOrigin: "0 0"}}, {at:.3f});')
    js(f'tl.set("#rip", {{x: {x}, y: {y}}}, {at:.3f});')
    js(f'tl.fromTo("#rip", {{opacity: 0.9, scale: 0.2}}, {{opacity: 0, scale: 1.6, duration: 0.4, ease: "power2.out"}}, {at:.3f});')
    if box:
        bx, by, bw, bh, r = box
        js(f'tl.set("#hl", {{x: {bx}, y: {by}, width: {bw}, height: {bh}, borderRadius: {r}}}, {at:.3f});')
        js(f'tl.fromTo("#hl", {{opacity: 1, scale: 1}}, {{opacity: 0, scale: 1.04, duration: 0.35, ease: "power2.out"}}, {at:.3f});')


def mark(at, end, x, y, w, h, r):  # drawn outline that stays while the voice names it
    js(f'tl.set("#mk", {{x: {x}, y: {y}, width: {w}, height: {h}, borderRadius: {r}}}, {at:.3f});')
    js(f'tl.fromTo("#mk", {{opacity: 0, scale: 1.25}}, {{opacity: 1, scale: 1, duration: 0.2, ease: "back.out(2)"}}, {at:.3f});')
    js(f'tl.to("#mk", {{opacity: 0, duration: 0.1}}, {end - 0.1:.3f});')


d0, e0, f0, g0 = T["d"], T["e"], T["f"], T["g"]
qs = t("hit") - 0.12  # swap goal -> plan page
ia, ib = t("start") + 0.08, t("start") + 0.08 + 0.48  # intro flash (outside the camera)

ROWS = [("vortexqt", "V", "21 h 30"), ("ramprush", "R", "20 h 44"), ("edit.exe", "E", "19 h 58"),
        ("coldhands", "C", "19 h 10"), ("sunsetboxer", "S", "18 h 22"), ("lowground", "L", "18 h 07")]
SLOT = lambda k: 566 + 60 * k
rows = "".join(f'<div class="row" id="rw{i}"><i>{c}</i><b>{n}</b><em>{p}</em></div>'
               for i, (n, c, p) in enumerate(ROWS))
rows += f'<div class="row you" id="you"><i>M</i><b>You</b><em id="yt">17 h 40</em><u>+15 min</u></div>'
ranks = "".join(f'<span style="top:{SLOT(k) + 6}px">{k + 4}</span>' for k in range(6))
js("".join(f'tl.set("#rw{i}", {{y: {SLOT(i if i < 5 else 6)}}}, 0);' for i in range(6)) + f'tl.set("#you", {{y: {SLOT(5)}}}, 0);')
BOARD = f'<div class="lb"><div class="rk">{ranks}</div>{rows}</div>'

CUR = ('<svg viewBox="0 0 24 36" width="46" height="69"><path d="M1.5 1.5 L1.5 28.5 L8 22.2 L12.4 32.6 L16.6 30.8 L12.3 20.6 L21.3 20.6 Z" '
       'fill="#fff" stroke="#000" stroke-width="1.6" stroke-linejoin="round"/></svg>')
APP = (f'<div id="cam">'
       f'<img id="sg" class="shot" src="assets/goal.jpg"><img id="sq" class="shot" src="assets/quick.jpg">'
       f'<video id="vt" class="shot clip" src="assets/timer.mp4" muted playsinline data-start="{ib - 0.02:.3f}" data-duration="{f0 - ib + 0.02:.3f}" data-media-start="0"></video>'
       f'<img id="sb2" class="shot" src="assets/board.jpg">{BOARD}'
       f'<div id="hl" class="hl"></div><div id="mk" class="mk"></div><div id="rip" class="rip"></div>'
       f'<div id="cur">{CUR}</div></div>')
add(f'<div id="app" class="appw">{APP}</div>')
js(f'tl.set("#app", {{opacity: 0}}, 0); tl.set("#app", {{opacity: 1}}, {d0:.3f}); tl.set("#app", {{opacity: 0}}, {g0:.3f});')
vis = lambda sel, a: js(f'tl.set("{sel}", {{opacity: 1}}, {a:.3f});')
hid = lambda sel, a: js(f'tl.set("{sel}", {{opacity: 0}}, {a:.3f});')
js('tl.set("#sq, #sb2, .lb, #vt, #hl, #mk, #rip", {opacity: 0}, 0);')

# D1: routines page, cursor to Quick Start, click
cam(d0, 720, 470, 0.72, 0)
js(f'tl.fromTo("#cam", {{opacity: 0}}, {{opacity: 1, duration: 0.12}}, {d0:.3f});')
js(f'tl.set("#cur", {{x: 1060, y: 760}}, {d0:.3f});')
cur(d0 + 0.05, 505, 420, 0.42)
cam(d0 + 0.05, 560, 430, 1.45, 0.5)
click(t("routine", 2), 505, 420, (250, 255, 506, 286, 30))
# D2: plan page, cursor to Start training, click
vis("#sq", qs)
cam(qs, 480, 560, 1.15, 0)
cur(qs + 0.02, 345, 682, 0.3)
cam(qs + 0.02, 360, 640, 1.65, 0.34)
click(t("start") - 0.02, 345, 682, (250, 651, 186, 58, 29))
# E: intro flash (full frame), then the live timer
video("vi", "full top7", ia, ib, "intro")
hid("#sg, #sq", ib)
hid("#cur", ib)
vis("#vt", ib)
cam(ib, 900, 430, 1.25, 0)
cam(ib, 930, 430, 1.55, 0.4, "power2.out")
mark(t("map"), t("timers"), 831, 391, 424, 76, 18)
cam(t("timers") - 0.08, 521, 262, 1.5, 0.32)
mark(t("timers"), t("no"), 343, 83, 356, 356, 178)
cam(t("no") - 0.08, 600, 520, 1.6, 0.32)
mark(t("no"), f0, 505, 552, 140, 22, 6)
js(f'tl.fromTo("#nos", {{opacity: 0, y: 14}}, {{opacity: 1, y: 0, duration: 0.18}}, {t("skipping"):.3f});')
# F: leaderboard climb
hid("#vt", f0)
vis("#sb2, .lb", f0)
cam(f0, 640, 560, 0.8, 0)
cam(f0 + 0.05, 560, 700, 1.3, 0.55)
steps = [t("minute"), t("train"), t("pushes"), t("up"), t("leaderboard") + 0.15]
times = ["18 h 25", "19 h 15", "20 h 05", "20 h 50", "21 h 45"]
for k, at in enumerate(steps):
    slot = 4 - k
    js(f'tl.to("#you", {{y: {SLOT(slot)}, duration: 0.2, ease: "power3.out"}}, {at:.3f});')
    js(f'tl.to("#rw{slot}", {{y: {SLOT(slot + 1)}, duration: 0.2, ease: "power3.out"}}, {at:.3f});')
    js(f'tl.set("#yt", {{textContent: "{times[k]}"}}, {at:.3f});')
    cam(at, 560, SLOT(slot) + 28, 1.3 + k * 0.06, 0.25, "power2.out")
js(f'tl.fromTo("#you u", {{opacity: 0, x: -10}}, {{opacity: 1, x: 0, duration: 0.2}}, {steps[0]:.3f});')
# caption band under the app
CAPS = [(d0, qs, [[("Pick", "pick"), ("a", "a", 2), ("routine.", "routine", 2, "inv")]]),
        (qs, ia, [[("Hit", "hit"), ("start.", "start", 1, "inv")]]),
        (ia, f0, [[("Map", "map"), ("codes.", "codes")], [("Timers.", "timers")], [("No", "no"), ("skipping.", "skipping", 1, "inv")]]),
        (f0, g0, [[("Every", "every", 2), ("minute", "minute")], [("pushes", "pushes"), ("you", "you", 4), ("up.", "up", 1, "inv")]])]
for i, (a, b, lines) in enumerate(CAPS):
    clip(f"cp{i}", "cap", a, b, words(lines, f"p{i}"))

# ---------- G: end card (white), cut mid-beat so it loops into the hook
clip("sg2", "white endc", g0, DUR, words([[("It's", "its"), ("free.", "free")], [("GO.", "go", 1, "inv huge")]], "g") +
     '<p class="foot" id="foot">Fortnite training routines<br><b>repline.pages.dev</b></p>')
js(f'tl.fromTo("#foot", {{opacity: 0, y: 16}}, {{opacity: 1, y: 0, duration: 0.25}}, {t("free") + 0.1:.3f});')

CUTS = [T["a2"], T["b"], T["c"], d0, qs, ib, f0, g0]
for a in CUTS:
    js(f'tl.fromTo("#root", {{x: 0}}, {{x: 9, duration: 0.035, yoyo: true, repeat: 1}}, {a:.3f});')

CSS = """
@font-face { font-family: "InterX"; src: url(assets/inter900.woff2) format("woff2"); font-weight: 100 900; }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 1080px; height: 1920px; overflow: hidden; background: #000; }
#root { position: relative; width: 1080px; height: 1920px; overflow: hidden; background: #000; color: #fff; font-family: "InterX", Arial, sans-serif; }
.clip { position: absolute; inset: 0; }
.full { width: 1080px; height: 1920px; object-fit: cover; }
.dim { filter: brightness(.42) saturate(1.1); }
.txt { display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; z-index: 3; padding: 0 50px; }
.ln { font-weight: 900; font-size: 118px; line-height: 1.05; letter-spacing: -0.04em; }
.w { display: inline-block; position: relative; }
.big { font-size: 1.35em; }
.huge { font-size: 2.6em; line-height: 1; }
.inv { background: #fff; color: #0a0a0a; padding: 0 20px; margin: 8px 0; }
.white { background: #fff; color: #0a0a0a; z-index: 2; }
.white .inv { background: #0a0a0a; color: #fff; }
.black { background: #000; z-index: 2; }
.head { z-index: 4; color: #0a0a0a; top: 230px; bottom: auto; height: 400px; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; text-align: center; }
.head .inv { background: #0a0a0a; color: #fff; }
.cards { position: absolute; left: 90px; right: 90px; top: 760px; display: flex; flex-direction: column; gap: 22px; transform-origin: 50% 0; }
.card { display: flex; align-items: center; gap: 30px; background: #0a0a0a; color: #fff; border-radius: 30px; padding: 30px 36px; box-shadow: 0 18px 40px rgba(0,0,0,.25); }
.card b { width: 78px; height: 78px; border-radius: 50%; background: #fff; color: #0a0a0a; display: grid; place-items: center; font-size: 44px; }
.card span { flex: 1; font-size: 50px; font-weight: 800; letter-spacing: -0.02em; display: flex; flex-direction: column; }
.card small { font-size: 28px; color: #8a8a8f; font-weight: 600; letter-spacing: 0.04em; }
.card i { font-style: normal; font-size: 52px; font-weight: 900; font-variant-numeric: tabular-nums; }
.days { position: absolute; left: 80px; right: 80px; top: 1460px; display: flex; justify-content: space-between; }
.day { display: flex; flex-direction: column; align-items: center; gap: 12px; }
.day em { width: 104px; height: 104px; border-radius: 50%; border: 5px solid #0a0a0a; display: grid; place-items: center; font-style: normal; font-size: 54px; color: #fff; }
.day span { font-size: 34px; font-weight: 800; color: #6b6b70; }
.ring { position: absolute; left: 190px; top: 610px; width: 700px; height: 700px; }
.ring circle { fill: none; stroke: #fff; stroke-width: 7; stroke-dasharray: 1; stroke-linecap: round; }
.small { position: absolute; top: 760px; left: 0; right: 0; text-align: center; font-size: 64px; font-weight: 800; color: #9a9aa0; }
.logo { position: absolute; top: 880px; left: 0; right: 0; text-align: center; font-size: 150px; font-weight: 900; letter-spacing: 0.12em; }
.logo span { display: inline-block; }
.appw { position: absolute; inset: 0; overflow: hidden; background: #000; z-index: 2; }
.top7 { z-index: 7; }
#cam { position: absolute; left: 0; top: 0; width: 1440px; height: 900px; transform-origin: 0 0; }
.shot { position: absolute; left: 0; top: 0; width: 1440px; height: 900px; inset: auto; border-radius: 6px; }
.hl, .mk, .rip { position: absolute; left: 0; top: 0; pointer-events: none; }
.hl { border: 4px solid #fff; box-shadow: 0 0 40px rgba(255,255,255,.6); transform-origin: 50% 50%; }
.mk { border: 4px solid #fff; box-shadow: 0 0 0 4000px rgba(0,0,0,.5), 0 0 30px rgba(255,255,255,.5); transform-origin: 50% 50%; }
.rip { width: 90px; height: 90px; margin: -45px 0 0 -45px; border-radius: 50%; border: 5px solid #fff; background: rgba(255,255,255,.25); }
#cur { position: absolute; left: 0; top: 0; z-index: 9; filter: drop-shadow(0 6px 10px rgba(0,0,0,.55)); }
#cur svg { display: block; }
.lb { position: absolute; left: 250px; top: 0; width: 602px; height: 900px; clip-path: inset(560px 0 0 0 round 0); }
.lb .rk { position: absolute; inset: 0; z-index: 5; mix-blend-mode: difference; }
.lb .rk span { position: absolute; left: 26px; font-size: 17px; font-weight: 700; color: #f5f5f7; width: 30px; height: 40px; line-height: 40px; }
.row { position: absolute; left: 0; top: 0; width: 602px; height: 52px; background: #1c1c1e; display: flex; align-items: center; font-family: Arial, sans-serif; }
.row i { margin-left: 78px; width: 40px; height: 40px; border-radius: 50%; background: #3a3a3c; color: #f5f5f7; display: grid; place-items: center; font-style: normal; font-weight: 700; font-size: 17px; }
.row b { margin-left: 12px; font-size: 17px; font-weight: 400; color: #f5f5f7; width: 290px; }
.row em { font-style: normal; font-size: 17px; color: #f5f5f7; }
.row.you { background: #f5f5f7; border-radius: 14px; z-index: 3; box-shadow: 0 10px 30px rgba(0,0,0,.6); }
.row.you i { background: #0a0a0a; }
.row.you b, .row.you em { color: #0a0a0a; font-weight: 700; }
.row.you u { position: absolute; right: -118px; text-decoration: none; background: #fff; color: #0a0a0a; font-weight: 800; font-size: 16px; padding: 6px 10px; border-radius: 10px; }
.cap { z-index: 6; top: auto; bottom: 0; height: 640px; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center;
  background: linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,.85) 30%, #000 60%); padding-top: 120px; }
.cap .ln { font-size: 104px; }
.endc { display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; }
.endc .ln { font-size: 130px; }
.foot { position: absolute; bottom: 250px; left: 0; right: 0; font-weight: 700; font-size: 44px; color: #6b6b70; line-height: 1.35; }
.foot b { color: #0a0a0a; font-weight: 900; }
"""

A = os.path.join(OUT, "assets")
DURS = {}
for f in os.listdir(A):
    if f.endswith(".wav"):
        with contextlib.closing(wave.open(os.path.join(A, f))) as w:
            DURS[f[:-4]] = w.getnframes() / w.getframerate()
SND = [("whoosh", a - 0.06, .3) for a in [T["a2"], T["c"], d0, qs, f0]]
SND += [("impact", 0.0, .5), ("impact", t("pros") - 0.03, .35), ("impact", T["b"], .55), ("tick", t("order") - 0.02, .35),
        ("whoosh2", ia - 0.05, .45), ("ding", t("repline") - 0.02, .3), ("tick", t("map") - 0.02, .3), ("tick", t("timers") - 0.02, .3),
        ("tick", t("no") - 0.02, .3), ("impact", g0, .5), ("riser", T["c"] - 0.9, .18)]
SND += [("click", a - 0.01, .9) for a in CLICKS]
SND += [("tick", a, .35) for a in steps]
SND += [("tick", t("every", 1) + 0.17 + i * 0.11, .14) for i in range(7)]
audio = [f'<audio id="vo" class="clip" src="assets/vo.wav" data-start="0" data-duration="{min(DUR, DURS["vo"]):.3f}" data-volume="1"></audio>',
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
print({k: round(v, 2) for k, v in T.items()}, "clicks", [round(c, 2) for c in CLICKS])
