"""Builds <project>/index.html: Repline website ad for X/Twitter, 16:9, 1920x1080, 19 s, SFX only (no music).
Black-and-white Repline look, real website screenshots on 3D cards (CSS 3D + GSAP), HyperFrames render.
Usage: python3 gen_x16.py <project dir>   (assets: home goal board mind cue ai quick plans .png, inter900.woff2, gsap.min.js, sfx *.wav)"""
import os, sys, wave, contextlib

OUT = sys.argv[1]
DUR = 19.0
els, tl = [], []
add, js = els.append, tl.append

def clip(i, cls, a, b, inner="", style=""):
    st = f' style="{style}"' if style else ""
    add(f'<div id="{i}" class="clip {cls}" data-start="{a:.3f}" data-duration="{b - a:.3f}"{st}>{inner}</div>')

def shot(name, cls=""):
    return f'<div class="card {cls}"><img src="assets/{name}.png" alt=""><i class="gl"></i></div>'

def kin(sid, text, at, cls="", step=0.07):
    """kinetic headline: each word drops in with 3D flip"""
    ws = text.split(" ")
    h = []
    for i, w in enumerate(ws):
        h.append(f'<span class="kw" id="{sid}{i}">{w}</span>')
        js(f'tl.fromTo("#{sid}{i}", {{opacity: 0, y: 60, rotateX: -80, filter: "blur(10px)"}}, {{opacity: 1, y: 0, rotateX: 0, filter: "blur(0px)", duration: 0.5, ease: "expo.out"}}, {at + i * step:.3f});')
    return f'<h2 class="kin {cls}">{" ".join(h)}</h2>'

# ---------- 0. logo: ring draws, flips in 3D, wordmark ----------
T0, T1 = 0.0, 2.6
clip("s0", "stage", T0, T1,
     '<div class="logo3d" id="lg"><svg viewBox="0 0 200 200" class="ring"><circle id="rc" cx="100" cy="100" r="78" pathLength="1"/></svg></div>'
     '<div class="word" id="wm">REPLINE</div>')
js('tl.fromTo("#rc", {strokeDashoffset: 1}, {strokeDashoffset: 0, duration: 0.9, ease: "power3.inOut"}, 0.0);')
js('tl.fromTo("#lg", {rotateY: -70, rotateX: 25, scale: 0.6}, {rotateY: 0, rotateX: 0, scale: 1, duration: 1.2, ease: "expo.out"}, 0.1);')
js('tl.to("#lg", {x: -400, scale: 0.55, duration: 0.6, ease: "expo.inOut"}, 1.15);')
js('tl.fromTo("#wm", {opacity: 0, x: 40, letterSpacing: "0.6em", filter: "blur(12px)"}, {opacity: 1, x: 110, letterSpacing: "0.18em", filter: "blur(0px)", duration: 0.7, ease: "expo.out"}, 1.3);')
js('tl.to("#s0 .logo3d, #wm", {opacity: 0, z: 400, duration: 0.35, ease: "power2.in"}, 2.25);')
js('tl.to("#flash", {opacity: 0.18, duration: 0.05}, 1.18); tl.to("#flash", {opacity: 0, duration: 0.4}, 1.23);')

# ---------- 1. statement ----------
A1, B1 = 2.55, 4.6
clip("s1", "stage", A1, B1, kin("k1a", "Stop playing.", A1 + 0.05, "dim") + kin("k1b", "Start training.", A1 + 0.75))
js(f'tl.to("#s1 .kin", {{opacity: 0, y: -40, filter: "blur(8px)", duration: 0.3, ease: "power2.in"}}, {B1 - 0.3:.3f});')

# ---------- 2. routines: card flies in from depth, fanned stack behind ----------
A2, B2 = 4.5, 8.1
clip("s2", "stage persp", A2, B2,
     '<div class="fan" id="fan">' + shot("quick", "fb2") + shot("ai", "fb1") + shot("goal", "front") + '</div>' +
     '<div class="side">' + kin("k2", "Pro routines. Set by set.", A2 + 0.5, "left") +
     '<p class="sub" id="sub2">Timers · map codes · KovaaK\'s playlists</p></div>')
js(f'tl.fromTo("#fan", {{rotateY: -55, rotateX: 18, z: -1400, x: 300, opacity: 0}}, {{rotateY: -18, rotateX: 6, z: 0, x: 0, opacity: 1, duration: 1.1, ease: "expo.out"}}, {A2:.3f});')
js(f'tl.fromTo("#fan .fb1", {{x: 0, z: 0, rotateZ: 0}}, {{x: -70, z: -120, rotateZ: -4, duration: 0.8, ease: "expo.out"}}, {A2 + 0.6:.3f});')
js(f'tl.fromTo("#fan .fb2", {{x: 0, z: 0, rotateZ: 0}}, {{x: -140, z: -240, rotateZ: -8, duration: 0.8, ease: "expo.out"}}, {A2 + 0.7:.3f});')
js(f'tl.to("#fan", {{rotateY: -10, duration: 2.4, ease: "none"}}, {A2 + 1.1:.3f});')
js(f'tl.fromTo("#sub2", {{opacity: 0, y: 20}}, {{opacity: 1, y: 0, duration: 0.4, ease: "power3.out"}}, {A2 + 1.0:.3f});')
js(f'tl.to("#s2 .fan", {{z: 600, opacity: 0, duration: 0.35, ease: "power2.in"}}, {B2 - 0.35:.3f});')

# ---------- 3. timer: big ring counts, set pills ----------
A3, B3 = 8.0, 10.6
clip("s3", "stage", A3, B3,
     '<div class="tmr" id="tmr"><svg viewBox="0 0 400 400"><circle class="trk" cx="200" cy="200" r="170"/><circle id="tp" class="prg" cx="200" cy="200" r="170" pathLength="1"/></svg>'
     '<div class="tv"><b id="tnum">5:00</b><span>Edit wall · set 1 of 3</span></div></div>'
     '<div class="pills" id="pills"><span>2424-4344-7824</span><span>No skipping</span><span>Server-checked</span></div>')
js(f'tl.fromTo("#tmr", {{rotateX: 60, scale: 0.5, opacity: 0}}, {{rotateX: 0, scale: 1, opacity: 1, duration: 0.8, ease: "expo.out"}}, {A3:.3f});')
js(f'tl.fromTo("#tp", {{strokeDashoffset: 0}}, {{strokeDashoffset: 0.78, duration: 2.2, ease: "power1.inOut"}}, {A3 + 0.3:.3f});')
js(f'tl.fromTo("#pills span", {{opacity: 0, y: 30, rotateX: -60}}, {{opacity: 1, y: 0, rotateX: 0, duration: 0.45, stagger: 0.12, ease: "expo.out"}}, {A3 + 0.7:.3f});')
# countdown text: snap through values
for i, v in enumerate(["5:00", "4:12", "3:24", "2:36", "1:48", "1:06"]):
    js(f'tl.set("#tnum", {{textContent: "{v}"}}, {A3 + 0.3 + i * 0.38:.3f});')
js(f'tl.to("#tmr, #pills", {{opacity: 0, scale: 1.3, filter: "blur(10px)", duration: 0.3, ease: "power2.in"}}, {B3 - 0.3:.3f});')

# ---------- 4. leaderboard: card tilts, podium pops ----------
A4, B4 = 10.5, 13.4
clip("s4", "stage persp", A4, B4,
     '<div class="side l2">' + kin("k4", "Climb the board.", A4 + 0.35, "left") +
     '<p class="sub" id="sub4">Ranked by real playtime. Monthly prizes.</p></div>' +
     '<div class="tilt" id="bd">' + shot("board", "front") + '<div class="glow" id="gw"></div></div>')
js(f'tl.fromTo("#bd", {{rotateY: 50, rotateX: -10, x: 500, z: -900, opacity: 0}}, {{rotateY: 16, rotateX: 4, x: 0, z: 0, opacity: 1, duration: 1.0, ease: "expo.out"}}, {A4:.3f});')
js(f'tl.to("#bd", {{rotateY: 8, duration: 2.0, ease: "none"}}, {A4 + 1.0:.3f});')
js(f'tl.fromTo("#gw", {{opacity: 0, scale: 0.6}}, {{opacity: 1, scale: 1, duration: 0.5, ease: "back.out(2)"}}, {A4 + 1.1:.3f});')
js(f'tl.fromTo("#sub4", {{opacity: 0, y: 20}}, {{opacity: 1, y: 0, duration: 0.4}}, {A4 + 0.9:.3f});')
js(f'tl.to("#bd", {{rotateY: -40, x: -300, opacity: 0, duration: 0.35, ease: "power2.in"}}, {B4 - 0.35:.3f});')

# ---------- 5. carousel: Personal Plan / Mind & Body / In-game Tools ----------
A5, B5 = 13.3, 16.2
clip("s5", "stage persp", A5, B5,
     '<div class="car" id="car">' + shot("ai", "c c0") + shot("mind", "c c1") + shot("cue", "c c2") + '</div>' +
     '<div class="lbls"><span id="lb0">Personal Plan</span><span id="lb1">Mind &amp; Body</span><span id="lb2">In-game Tools</span></div>')
js(f'tl.fromTo("#car", {{rotateY: 120, z: -1200, opacity: 0}}, {{rotateY: 0, z: -560, opacity: 1, duration: 0.9, ease: "expo.out"}}, {A5:.3f});')
js(f'tl.to("#car", {{rotateY: -120, duration: 0.55, ease: "expo.inOut"}}, {A5 + 1.0:.3f});')
js(f'tl.to("#car", {{rotateY: -240, duration: 0.55, ease: "expo.inOut"}}, {A5 + 1.9:.3f});')
for i, at in enumerate([A5 + 0.3, A5 + 1.25, A5 + 2.15]):
    js(f'tl.fromTo("#lb{i}", {{opacity: 0, y: 30, filter: "blur(8px)"}}, {{opacity: 1, y: 0, filter: "blur(0px)", duration: 0.35, ease: "expo.out"}}, {at:.3f});')
    if i < 2:
        js(f'tl.to("#lb{i}", {{opacity: 0, y: -30, duration: 0.25}}, {at + 0.75:.3f});')
js(f'tl.to("#car, #lb2", {{opacity: 0, duration: 0.25}}, {B5 - 0.25:.3f});')

# ---------- 6. wall: every screen on a tilted 3D plane, camera pulls back ----------
A6, B6 = 16.1, 17.6
wall = "".join(shot(n, "w") for n in ["home", "goal", "board", "plans", "mind", "quick", "cue", "ai", "board", "home", "goal", "plans"])
clip("s6", "stage persp", A6, B6, f'<div class="wall" id="wall">{wall}</div><div class="vign"></div>' + kin("k6", "Everything competitive needs.", A6 + 0.35, "over"))
js(f'tl.fromTo("#wall", {{rotateX: 55, rotateZ: -18, z: 600, y: 200}}, {{rotateX: 48, rotateZ: -12, z: -500, y: -40, duration: 1.5, ease: "power2.out"}}, {A6:.3f});')

# ---------- 7. end card ----------
A7 = 17.5
clip("s7", "stage", A7, DUR,
     '<div class="end"><svg viewBox="0 0 200 200" class="ring sm"><circle id="rc2" cx="100" cy="100" r="78" pathLength="1"/></svg>'
     '<div class="word big" id="wm2">REPLINE</div><div class="url" id="url">repline.pages.dev</div><div class="free" id="fr">Free · Web + Windows</div></div>')
js(f'tl.fromTo("#rc2", {{strokeDashoffset: 1}}, {{strokeDashoffset: 0, duration: 0.5, ease: "power3.out"}}, {A7:.3f});')
js(f'tl.fromTo("#wm2", {{opacity: 0, scale: 1.4, filter: "blur(14px)"}}, {{opacity: 1, scale: 1, filter: "blur(0px)", duration: 0.6, ease: "expo.out"}}, {A7 + 0.05:.3f});')
js(f'tl.fromTo("#url", {{opacity: 0, y: 20}}, {{opacity: 1, y: 0, duration: 0.4, ease: "expo.out"}}, {A7 + 0.35:.3f});')
js(f'tl.fromTo("#fr", {{opacity: 0}}, {{opacity: 1, duration: 0.4}}, {A7 + 0.55:.3f});')
js(f'tl.to("#flash", {{opacity: 0.22, duration: 0.04}}, {A7:.3f}); tl.to("#flash", {{opacity: 0, duration: 0.45}}, {A7 + 0.04:.3f});')

# slow drift of the light behind everything
js(f'tl.fromTo("#lite", {{x: -300, y: -100}}, {{x: 300, y: 80, duration: {DUR}, ease: "none"}}, 0);')

CSS = """
@font-face { font-family: "InterX"; src: url(assets/inter900.woff2) format("woff2"); font-weight: 100 900; }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 1920px; height: 1080px; overflow: hidden; background: #000; }
#root { position: relative; width: 1920px; height: 1080px; overflow: hidden; background: #000; color: #f5f5f7; font-family: "InterX", Arial, sans-serif; }
#lite { position: absolute; left: 50%; top: 50%; width: 1600px; height: 1600px; margin: -800px 0 0 -800px; background: radial-gradient(closest-side, rgba(255,255,255,.10), rgba(255,255,255,0)); z-index: 0; }
#grain { position: absolute; inset: 0; z-index: 50; pointer-events: none; opacity: .06; background-image: repeating-radial-gradient(circle at 17% 32%, #fff 0 1px, transparent 1px 3px); mix-blend-mode: overlay; }
#flash { position: absolute; inset: 0; background: #fff; opacity: 0; z-index: 60; }
.clip { position: absolute; inset: 0; }
.stage { display: flex; align-items: center; justify-content: center; z-index: 2; }
.persp { perspective: 1800px; }
.logo3d { width: 260px; height: 260px; transform-style: preserve-3d; }
.ring { width: 100%; height: 100%; overflow: visible; }
.ring circle { fill: none; stroke: #f5f5f7; stroke-width: 22; stroke-linecap: round; stroke-dasharray: 1; transform: rotate(-90deg); transform-origin: 100px 100px; filter: drop-shadow(0 0 18px rgba(255,255,255,.35)); }
.word { position: absolute; font-weight: 900; font-size: 120px; letter-spacing: 0.18em; }
.kin { font-weight: 900; font-size: 150px; letter-spacing: -0.045em; line-height: 1.0; text-align: center; perspective: 900px; }
.kin.dim { color: #6e6e73; font-size: 110px; }
#s1 { flex-direction: column; gap: 18px; }
.kw { display: inline-block; transform-origin: 50% 100%; }
.kin.left { text-align: left; font-size: 96px; }
.kin.over { position: absolute; bottom: 120px; left: 0; right: 0; font-size: 92px; z-index: 5; text-shadow: 0 10px 40px rgba(0,0,0,.9); }
.side { position: absolute; left: 120px; top: 50%; transform: translateY(-50%); width: 640px; z-index: 4; }
.side.l2 { left: auto; right: 110px; width: 620px; }
.sub { margin-top: 26px; font-size: 34px; font-weight: 600; color: #a1a1a6; letter-spacing: -0.01em; }
.card { position: absolute; width: 1000px; height: 625px; border-radius: 22px; overflow: hidden; background: #0b0b0c; box-shadow: 0 40px 120px rgba(0,0,0,.8), 0 0 0 1px rgba(255,255,255,.12); transform-style: preserve-3d; }
.card img { width: 100%; height: 100%; object-fit: cover; display: block; }
.card .gl { position: absolute; inset: 0; background: linear-gradient(115deg, rgba(255,255,255,.14) 0%, rgba(255,255,255,0) 35%); pointer-events: none; }
.fan { position: absolute; right: 90px; top: 50%; width: 1000px; height: 625px; margin-top: -312px; transform-style: preserve-3d; }
.fan .card { left: 0; top: 0; }
.fan .fb1 { filter: brightness(.55); } .fan .fb2 { filter: brightness(.35); }
.tilt { position: absolute; left: 110px; top: 50%; width: 1000px; height: 625px; margin-top: -312px; transform-style: preserve-3d; }
.tilt .card { left: 0; top: 0; }
.glow { position: absolute; left: 270px; top: 140px; width: 260px; height: 290px; border-radius: 24px; box-shadow: 0 0 0 4px #d4af37, 0 0 60px rgba(212,175,55,.6); transform: translateZ(40px); }
.tmr { position: relative; width: 560px; height: 560px; transform-style: preserve-3d; }
.tmr svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.trk { fill: none; stroke: #1c1c1e; stroke-width: 18; }
.prg { fill: none; stroke: #f5f5f7; stroke-width: 18; stroke-linecap: round; stroke-dasharray: 1; filter: drop-shadow(0 0 16px rgba(255,255,255,.45)); }
.tv { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; }
.tv b { font-size: 150px; font-weight: 900; letter-spacing: -0.05em; font-variant-numeric: tabular-nums; }
.tv span { font-size: 28px; font-weight: 600; color: #8e8e93; letter-spacing: .02em; }
#s3 { gap: 90px; }
.pills { display: flex; flex-direction: column; gap: 22px; perspective: 800px; }
.pills span { display: inline-block; font-size: 38px; font-weight: 800; padding: 18px 30px; border-radius: 16px; background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.18); backdrop-filter: blur(10px); }
.pills span:first-child { font-family: ui-monospace, Menlo, monospace; letter-spacing: .04em; }
.car { position: absolute; left: 50%; top: 44%; width: 1000px; height: 625px; margin: -312px 0 0 -500px; transform-style: preserve-3d; }
.car .c { left: 0; top: 0; backface-visibility: hidden; -webkit-backface-visibility: hidden; }
.c0 { transform: rotateY(0deg) translateZ(620px); }
.c1 { transform: rotateY(120deg) translateZ(620px); }
.c2 { transform: rotateY(240deg) translateZ(620px); }
.lbls { position: absolute; bottom: 150px; left: 0; right: 0; text-align: center; }
.lbls span { position: absolute; left: 0; right: 0; font-size: 72px; font-weight: 900; letter-spacing: -0.035em; opacity: 0; }
.wall { position: absolute; left: 50%; top: 50%; width: 3200px; margin-left: -1600px; margin-top: -700px; display: grid; grid-template-columns: repeat(4, 780px); gap: 26px; transform-style: preserve-3d; }
.wall .card { position: relative; width: 780px; height: 488px; }
.vign { position: absolute; inset: 0; background: radial-gradient(ellipse at center, rgba(0,0,0,0) 30%, rgba(0,0,0,.85) 80%); z-index: 3; }
.end { display: flex; flex-direction: column; align-items: center; gap: 22px; }
.ring.sm { width: 130px; height: 130px; }
.word.big { position: static; font-size: 132px; }
.url { font-size: 46px; font-weight: 700; color: #f5f5f7; padding: 14px 34px; border-radius: 999px; background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.25); box-shadow: inset 0 1px 0 rgba(255,255,255,.25); }
.free { font-size: 28px; font-weight: 600; color: #8e8e93; letter-spacing: .04em; }
"""

# ---------- sound (SFX only) ----------
A = os.path.join(OUT, "assets")
DURS = {}
for f in os.listdir(A):
    if f.endswith(".wav"):
        with contextlib.closing(wave.open(os.path.join(A, f))) as w:
            DURS[f[:-4]] = w.getnframes() / w.getframerate()
SND = [("boom", 0.05, .9), ("whoosh2", 1.1, .6), ("ui", 1.35, .45),
       ("whoosh2", A1 - 0.05, .55), ("ui", A1 + 0.75, .35),
       ("riser", A2 - 1.6, .5), ("boom", A2 + 0.02, .55), ("ui", A2 + 1.0, .35),
       ("whoosh2", A3 - 0.05, .6), ("ticks", A3 + 0.3, .55),
       ("whoosh2", A4 - 0.05, .6), ("ui", A4 + 1.1, .4),
       ("whoosh2", A5 - 0.05, .55), ("whoosh2", A5 + 1.0, .45), ("whoosh2", A5 + 1.9, .45),
       ("riser", A6 - 0.6, .45), ("whoosh2", A6, .5),
       ("sting", A7 - 0.9, .95)]
audio = []
for i, (n, a, v) in enumerate(SND):
    a = max(0, a)
    if n not in DURS:
        continue
    audio.append(f'<audio id="fx{i}" class="clip" src="assets/{n}.wav" data-start="{a:.3f}" data-duration="{min(DURS[n], DUR - a):.3f}" data-volume="{v}"></audio>')

page = f'''<!doctype html>
<html lang="en" data-resolution="landscape">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=1920, height=1080" />
<script src="assets/gsap.min.js"></script>
<style>{CSS}</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="{DUR}" data-width="1920" data-height="1080">
<div id="lite"></div>
{chr(10).join(els)}
<div id="grain"></div><div id="flash"></div>
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
print("ok", len(SND), "sounds")
