import numpy as np, wave
SR = 48000; DUR = 62.0; N = int(SR * DUR)
rng = np.random.default_rng(7)
t_all = np.arange(N) / SR

# ---------------- helpers ----------------
def buf(): return np.zeros((N, 2))
def place(dst, sig, start, gain=1.0, pan=0.0):
    i = int(round(start * SR))
    if i >= N: return
    if sig.ndim == 1:
        l = np.cos((pan + 1) * np.pi / 4) * 1.414; r = np.sin((pan + 1) * np.pi / 4) * 1.414
        sig = np.stack([sig * l, sig * r], 1)
    j0 = max(0, -i); i = max(0, i); n = min(len(sig) - j0, N - i)
    if n > 0: dst[i:i + n] += sig[j0:j0 + n] * gain
def fftfilt(x, resp):  # resp(freq_array) -> gain
    n = len(x); F = 1 << int(np.ceil(np.log2(n + 1)))
    X = np.fft.rfft(x, F, axis=0); f = np.fft.rfftfreq(F, 1 / SR)
    g = resp(f); X *= g[:, None] if x.ndim == 2 else g
    return np.fft.irfft(X, F, axis=0)[:n]
lpR = lambda fc, o=2: (lambda f: 1 / np.sqrt(1 + (f / fc) ** (2 * o)))
hpR = lambda fc, o=2: (lambda f: 1 / np.sqrt(1 + (fc / np.maximum(f, 1e-3)) ** (2 * o)))
def onepole(x, fc):  # time-varying one-pole lowpass (short buffers)
    fc = np.broadcast_to(fc, x.shape); a = 1 - np.exp(-2 * np.pi * fc / SR); y = np.empty_like(x); s = 0.0
    for i in range(len(x)): s += a[i] * (x[i] - s); y[i] = s
    return y
def env(n, a, d):
    tt = np.arange(n) / SR; return np.minimum(1, tt / max(a, 1e-4)) * np.exp(-tt / d)
def saw(f, n, phase=0.0):
    tt = np.arange(n) / SR; return 2 * ((f * tt + phase) % 1) - 1
def note(m): return 440 * 2 ** ((m - 69) / 12)
def reverb(x, dur=2.4, decay=3.2, mix=.3, seed=1, damp=6000):
    r = np.random.default_rng(seed); n = int(SR * dur)
    ir = np.stack([r.standard_normal(n), r.standard_normal(n)], 1) * np.exp(-np.arange(n) / SR * decay)[:, None]
    ir = fftfilt(ir, lpR(damp, 1)); ir /= np.sqrt((ir ** 2).sum(0))
    m = len(x) + n; F = 1 << int(np.ceil(np.log2(m)))
    y = np.fft.irfft(np.fft.rfft(x, F, axis=0) * np.fft.rfft(ir, F, axis=0), F, axis=0)[:len(x)]
    return x + y * mix

BPM = 120; BEAT = 60 / BPM; BAR = 4 * BEAT
# Akkorde (MIDI) je Takt: Am  F  C  G
CH = [[57, 60, 64], [53, 57, 60], [48, 52, 55, 60], [55, 59, 62]]
ROOT = [45, 41, 48, 43]
def chord_at(tm): return int(tm // BAR) % 4

# Abschnitte: Energie 0..1
def energy(tm):
    if tm < 4.0: return 0.0
    if tm < 12.0: return 0.55
    if tm < 33.0: return 1.0
    if tm < 41.0: return 0.7
    if tm < 55.6: return 1.0
    return 0.0

mus = buf()
# ---------------- Pads (Supersaw) ----------------
pad = np.zeros(N)
nbars = int(np.ceil(DUR / BAR))
for b in range(nbars):
    st = b * BAR; n = int(BAR * SR) + int(.5 * SR); ci = b % 4
    s = np.zeros(n)
    for m in CH[ci]:
        for d in (-.011, -.005, 0, .006, .012):
            s += saw(note(m + 12 if m < 52 else m) * (1 + d), n, rng.random())
    e = np.minimum(1, np.arange(n) / (SR * .25)) * np.minimum(1, (n - np.arange(n)) / (SR * .5))
    i = int(st * SR); seg_ = (s * e)[:max(0, N - i)]; pad[i:i + len(seg_)] += seg_
pad = fftfilt(pad, lpR(2200, 2)) * .045
padst = np.stack([pad, np.roll(pad, 480)], 1)
# Sidechain-Pumpen (Kick auf jedem Schlag ab 4 s)
pump = np.ones(N)
for k in np.arange(4.0, 55.6, BEAT):
    i = int(k * SR); n = int(BEAT * SR); pump[i:i + n] = np.minimum(pump[i:i + n], 1 - .55 * np.exp(-np.arange(n) / SR / .09))
padgain = np.where(t_all < 4, np.minimum(1, t_all / 3) * .8, 1.0)
padgain = np.where(t_all > 55.6, np.maximum(0, 1 - (t_all - 55.6) / .3), padgain)
mus += padst * (pump * padgain)[:, None]

# ---------------- Intro-Drone + Riser ----------------
dr = (np.sin(2 * np.pi * 55 * t_all) + .5 * np.sin(2 * np.pi * 82.4 * t_all)) * np.minimum(1, t_all / 1.5) * (t_all < 4.2)
place(mus, dr * .22, 0)
def riser(dur, f0=300, f1=12000):
    n = int(dur * SR); x = rng.standard_normal(n); fc = np.geomspace(f0, f1, n)
    y = onepole(x, fc) - onepole(onepole(x, fc * .3), fc * .3) * .7
    return y / (np.abs(y).max() + 1e-9) * np.linspace(0, 1, n) ** 2.5
def impact(big=1.0):
    n = int(SR * 2.5); tt = np.arange(n) / SR
    f = 38 + 120 * np.exp(-tt * 22); s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 1.6)
    nz = rng.standard_normal(n) * np.exp(-tt * 8) * .35
    return np.tanh((s + fftfilt(nz, lpR(3000))) * 1.8) * big
def whoosh(dur=.6, rev=False):
    n = int(dur * SR); x = rng.standard_normal(n); fc = np.geomspace(500, 9000, n)
    y = onepole(x, fc) - onepole(x, fc * .4); e = np.sin(np.linspace(0, np.pi, n)) ** 2
    y = y * e / (np.abs(y * e).max() + 1e-9); return y[::-1] if rev else y
place(mus, riser(3.6, 150, 14000), .4, .38)
for tm, big in [(4.0, 1.0), (12.0, .8), (33.0, .6), (41.4, .7), (56.0, 1.3)]:
    place(mus, impact(big), tm, .55)
place(mus, riser(1.8, 300, 12000), 10.2, .3)
place(mus, riser(2.6, 200, 13000), 38.4, .3)
place(mus, riser(1.6, 200, 15000), 54.4, .45)

# ---------------- Drums ----------------
def kick():
    n = int(SR * .45); tt = np.arange(n) / SR; f = 46 + 140 * np.exp(-tt * 32)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 6.5); s[:240] += rng.standard_normal(240) * .3 * np.linspace(1, 0, 240)
    return np.tanh(s * 1.5)
def clap():
    n = int(SR * .35); x = rng.standard_normal(n); e = np.zeros(n)
    for o in (0, .011, .022): i = int(o * SR); e[i:] += np.exp(-np.arange(n - i) / SR / .012) * .6
    e += np.exp(-np.arange(n) / SR / .09) * .5
    return fftfilt(x * e, lambda f: hpR(900)(f) * lpR(9000)(f))
def hat(open_=False):
    n = int(SR * (.25 if open_ else .05)); x = rng.standard_normal(n)
    return fftfilt(x, hpR(7000, 3)) * np.exp(-np.arange(n) / SR / (.08 if open_ else .012))
K, CL, HC, HO = kick(), clap(), hat(), hat(True)
drums = buf()
for b in np.arange(4.0, 55.6, BEAT):
    e = energy(b)
    if e == 0: continue
    in_break = 33.0 <= b < 41.0
    if not in_break or b >= 39.0: place(drums, K, b, .9)
    beat_in_bar = int(round((b % BAR) / BEAT))
    if e >= .7 and beat_in_bar in (1, 3): place(drums, CL, b, .5 if not in_break else .3, -.05)
    place(drums, HO, b + BEAT / 2, .12 * e, .25)
    if e >= 1.0:
        for k in range(4):
            place(drums, HC, b + k * BEAT / 4, (.11 if k % 2 else .07), -.3)
# Snare-Roll vor dem Drop bei 41.4
for k, tm in enumerate(np.arange(39.4, 41.4, BEAT / 4)):
    place(drums, CL, tm, .1 + .25 * k / 8)
drums = reverb(drums, 1.2, 6, .12, seed=3)
mus += drums

# ---------------- Bass ----------------
bass = np.zeros(N)
for b in np.arange(4.0, 55.6, BEAT / 2):
    e = energy(b)
    if e == 0 or (33.0 <= b < 39.0): continue
    f = note(ROOT[chord_at(b)] - 12); n = int(SR * BEAT / 2 * .95)
    s = np.sin(2 * np.pi * f * np.arange(n) / SR) * .9 + saw(f, n) * .35
    s = onepole(s, np.geomspace(1400, 160, n)) * env(n, .003, .18)
    i = int(b * SR); s = s[:max(0, N - i)]; bass[i:i + len(s)] += s * (1 if int(round(b / (BEAT / 2))) % 2 == 0 else .75)
mus += np.stack([bass, bass], 1) * .5 * pump[:, None] ** .5

# ---------------- Arpeggio mit Ping-Pong-Delay ----------------
arp = buf(); pat = [0, 1, 2, 1, 0, 2, 1, 2]
for k, b in enumerate(np.arange(12.0, 55.6, BEAT / 4)):
    if 33.0 <= b < 37.0: continue
    ch = CH[chord_at(b)]; m = ch[pat[k % 8] % len(ch)] + 12 + (12 if k % 16 >= 12 else 0)
    n = int(SR * .2); f = note(m)
    s = (saw(f, n) + saw(f * 1.004, n)) * .5
    s = onepole(s, 400 + 5200 * np.exp(-np.arange(n) / SR / .05)) * env(n, .002, .09)
    place(arp, s, b, .16 * (1.15 if b >= 41.4 else 1), -.35 if k % 2 else .35)
# Delay (3/16) ping-pong
d = int(SR * BEAT * .75); dl = np.zeros_like(arp)
dl[d:, 1] += arp[:-d, 0] * .45; dl[2 * d:, 0] += arp[:-2 * d, 0] * .25
dl[d:, 0] += arp[:-d, 1] * .45; dl[2 * d:, 1] += arp[:-2 * d, 1] * .25
mus += reverb(arp + dl, 2.0, 3.5, .25, seed=4)

# ---------------- Outro: Schimmer-Akkord ----------------
n = int(SR * 6); tt = np.arange(n) / SR
sh = sum(np.sin(2 * np.pi * note(m) * tt + p) * a for m, a, p in [(45, .5, 0), (57, .35, 1), (64, .3, 2), (69, .3, 0), (72, .22, 1), (76, .22, 2), (81, .14, 0), (88, .1, 1)])
sh *= np.minimum(1, tt / .02) * np.exp(-tt / 2.4)
place(mus, reverb(np.stack([sh, sh], 1), 3, 2, .45, seed=5), 56.0, .35)
# Pad-Fläche im Outro
n = int(SR * 6); s = np.zeros(n)
for m in [57, 60, 64, 69]:
    for dd in (-.008, 0, .009): s += saw(note(m) * (1 + dd), n, rng.random())
s = fftfilt(s, lpR(1600)) * np.minimum(1, np.arange(n) / (SR * .3)) * .03
place(mus, s, 56.0, 1.0)

mus = reverb(mus, 2.2, 3.0, .12, seed=9)

# ---------------- Sound-Effekte ----------------
sfx = buf()
def tone(f, dur, a=.003, d=.1, kind='sine'):
    n = int(dur * SR); tt = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * tt) if kind == 'sine' else saw(f, n)
    return s * env(n, a, d)
def click():
    n = int(SR * .04); x = rng.standard_normal(n) * np.exp(-np.arange(n) / SR / .004)
    return fftfilt(x, lambda f: hpR(1500)(f) * lpR(8000)(f)) * 1.5 + tone(1800, .04, .0005, .01) * .4
for tm in [34.35, 16.95, 42.95, 50.7] + [26.1, 26.5, 26.9, 27.4, 27.9, 28.3, 28.8, 29.3, 29.7, 30.1, 30.6, 31.0]:
    place(sfx, click(), tm, .5, .2)
for tm in [26.1, 26.5, 26.9, 27.4, 27.9, 28.3, 28.8, 29.3, 29.7, 30.1, 30.6, 31.0]:
    place(sfx, tone(1320, .08, .001, .03), tm + .02, .07, .2)
# Pops für Callouts / Einblendungen
for tm in [14.9, 19.3, 22.0, 27.2, 28.4, 31.1, 43.2, 44.6, 52.2, 35.2, 36.2, 36.45, 36.7, 38.6]:
    place(sfx, tone(880, .12, .001, .035) + tone(1760, .12, .001, .02) * .4, tm + .2, .14, .3)
# Kapitelmarken
for tm in [5.6, 13.4, 25.0, 33.0, 41.4, 47.4]:
    place(sfx, tone(2093, .3, .001, .12) * .6 + tone(3136, .3, .001, .08) * .3, tm, .12, -.3)
# Whooshes bei Kamerafahrten
for tm, d in [(11.5, .9), (13.4, .7), (24.6, .8), (32.6, .8), (40.9, .8), (47.0, .8), (51.0, .6), (54.6, .9)]:
    place(sfx, whoosh(d), tm, .32, 0)
# Timer-Ticks (Storm läuft 17.0–24.8)
for k, tm in enumerate(np.arange(17.2, 24.6, .5)):
    place(sfx, tone(2600 if k % 4 == 0 else 2000, .04, .0005, .008), tm, .1, -.4)
# Warnungen
for dd in (0, .18): place(sfx, fftfilt(tone(740, .16, .002, .07, 'saw'), lpR(3000)), 19.3 + dd, .12, .3)
for dd in (0, .12, .24): place(sfx, fftfilt(tone(988, .12, .002, .05, 'saw'), lpR(3500)), 22.5 + dd, .13, .3)
# Hochzähl-Blips im Team-Modus
for k, tm in enumerate(np.cumsum(np.geomspace(.03, .09, 20)) + 36.5):
    if tm < 37.7: place(sfx, tone(1100 + k * 30, .03, .0005, .01), tm, .06, .4)
for k, tm in enumerate(np.cumsum(np.geomspace(.025, .1, 24)) + 38.7):
    if tm < 39.9: place(sfx, tone(1300 + k * 35, .03, .0005, .01), tm, .07, -.2)
place(sfx, tone(1046.5, .7, .002, .3) + tone(1568, .7, .002, .3) * .6, 38.8, .1)
# Rotation: Ton-Symbol (sanfter Gong)
place(sfx, tone(1318.5, 1.0, .003, .35) + tone(1975.5, 1.0, .003, .25) * .5, 44.7, .12, .4)
# Map-Scan
place(sfx, whoosh(.8) * .6 + fftfilt(tone(660, .8, .3, 1, 'saw'), lpR(1500)) * .3, 48.6, .3)
# Glitzern beim Logo-Glanz
for k in range(10): place(sfx, tone(2637 * 2 ** ((k % 5) * 2 / 12), .2, .001, .07), 57.35 + k * .04, .06, -.8 + k * .18)
sfx = reverb(sfx, 1.4, 4, .2, seed=6)

# ---------------- Stimme ----------------
VO = [(0.8, 0), (5.6, 1), (12.6, 2), (19.0, 3), (25.2, 4), (33.4, 5), (41.8, 6), (47.6, 7), (57.0, 8)]
vo = np.zeros(N)
for st, k in VO:
    w = wave.open(f'vo/{k}.wav'); x = np.frombuffer(w.readframes(w.getnframes()), '<i2').astype(np.float64) / 32768; sr = w.getframerate()
    n = int(len(x) * SR / sr); y = np.interp(np.linspace(0, len(x) - 1, n), np.arange(len(x)), x)
    i = int(st * SR); y = y[:N - i]; vo[i:i + len(y)] += y
# EQ: Hochpass, Präsenz, Wärme
def voeq(f):
    g = hpR(90, 2)(f)
    g *= 1 + .35 * np.exp(-((np.log(np.maximum(f, 1) / 3200)) ** 2) / .25)  # Präsenz
    g *= 1 + .2 * np.exp(-((np.log(np.maximum(f, 1) / 180)) ** 2) / .3)    # Wärme
    return g
vo = fftfilt(vo, voeq)
# Kompressor (RMS-Hüllkurve)
envv = np.sqrt(fftfilt(vo ** 2, lpR(12, 1)).clip(1e-12))
thr = .08; gainc = np.where(envv > thr, (thr / envv) ** (1 - 1 / 3), 1.0)
vo = vo * gainc; vo /= np.abs(vo).max(); vo *= .9
vost = reverb(np.stack([vo, vo], 1), .9, 9, .07, seed=8, damp=5000)
# Ducking der Musik unter der Stimme
venv = fftfilt(np.abs(vo), lpR(4, 1)); venv = np.clip(venv / (venv.max() * .35), 0, 1)
duck = 1 - .72 * venv

mix = mus * .85 + sfx * 2.0
fade = np.ones(N); fade[:int(.03 * SR)] = np.linspace(0, 1, int(.03 * SR)); fo = int(1.2 * SR); fade[-fo:] = np.linspace(1, 0, fo) ** 1.4
mix *= fade[:, None]
mix /= np.percentile(np.abs(mix), 99.97) / .85
mix = np.tanh(mix * 1.15) / np.tanh(1.15) * .95
w = wave.open('soundtrack_en.wav', 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((mix * 32767).astype('<i2').tobytes()); w.close()
# zusätzlich Musik allein zur Kontrolle
print('ok')
