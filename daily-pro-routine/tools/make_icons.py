"""Draws the Repline app icon (five-set ring on black) in every size the web app and Windows need."""
import math, os, sys
from PIL import Image, ImageDraw, ImageFilter

OUT = sys.argv[1] if len(sys.argv) > 1 else "icons"
os.makedirs(OUT, exist_ok=True)
COLORS = ["#38e0ff", "#7debff", "#3f8dff", "#a855f7", "#8f7bff"]

def hexrgb(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))

def draw(size, ring_scale=0.62, rounded=False):
    S = size * 4
    img = Image.new("RGBA", (S, S), (0, 0, 0, 255))
    # soft blue glow
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    r = S * ring_scale * 0.42
    gd.ellipse([S / 2 - r, S / 2 - r, S / 2 + r, S / 2 + r], fill=(40, 90, 200, 110))
    glow = glow.filter(ImageFilter.GaussianBlur(S * 0.08))
    img.alpha_composite(glow)
    d = ImageDraw.Draw(img)
    R = S * ring_scale / 2
    w = max(2, int(S * ring_scale * 0.062))
    box = [S / 2 - R, S / 2 - R, S / 2 + R, S / 2 + R]
    gap = 4.5
    for i, c in enumerate(COLORS):
        start = -90 + i * 72 + gap / 2
        d.arc(box, start, start + 72 - gap, fill=hexrgb(c), width=w)
    # minute ticks
    for k in range(12):
        a = k / 12 * 2 * math.pi
        r1 = R - w * 2.6
        r2 = R - w * 1.6
        col = (245, 245, 247, 120)
        d.line([S / 2 + r1 * math.cos(a), S / 2 + r1 * math.sin(a), S / 2 + r2 * math.cos(a), S / 2 + r2 * math.sin(a)], fill=col, width=max(1, int(S * 0.006)))
    img = img.resize((size, size), Image.LANCZOS)
    if rounded:
        m = Image.new("L", (size * 4, size * 4), 0)
        ImageDraw.Draw(m).rounded_rectangle([0, 0, size * 4 - 1, size * 4 - 1], radius=int(size * 4 * 0.225), fill=255)
        img.putalpha(m.resize((size, size), Image.LANCZOS))
    return img

draw(1024).save(f"{OUT}/icon-1024.png")
draw(512).save(f"{OUT}/icon-512.png")
draw(192).save(f"{OUT}/icon-192.png")
draw(512, ring_scale=0.5).save(f"{OUT}/icon-maskable-512.png")
draw(180).convert("RGB").save(f"{OUT}/apple-touch-icon.png")
draw(32, ring_scale=0.8).save(f"{OUT}/favicon-32.png")
win = draw(256, ring_scale=0.7, rounded=True)
win.save(f"{OUT}/repline.ico", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
win.save(f"{OUT}/icon-window-256.png")
print("icons written to", OUT)
