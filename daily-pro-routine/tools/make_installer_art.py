"""Draws the Windows installer artwork (NSIS sidebar + header) in the Repline look.

Usage:  python3 tools/make_installer_art.py   ->  desktop/build/installerSidebar.bmp, installerHeader.bmp, icon.ico
"""
import os, shutil
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "desktop", "build")
ICON = os.path.join(ROOT, "app", "icons", "icon-512.png")
FONTS = "/usr/share/fonts/opentype/inter/"
os.makedirs(OUT, exist_ok=True)

def font(name, size):
    try:
        return ImageFont.truetype(FONTS + name, size)
    except OSError:
        return ImageFont.load_default()

def sidebar():
    S = 4  # draw large, scale down for smooth edges
    W, H = 164 * S, 314 * S
    im = Image.new("RGB", (W, H), (0, 0, 0))
    # soft glow in the brand colours behind the logo
    glow = Image.new("RGB", (W, H), (0, 0, 0))
    g = ImageDraw.Draw(glow)
    g.ellipse((W * -0.25, H * 0.02, W * 1.25, H * 0.52), fill=(18, 40, 96))
    g.ellipse((W * 0.35, H * 0.62, W * 1.6, H * 1.15), fill=(48, 20, 80))
    im = Image.blend(im, glow.filter(ImageFilter.GaussianBlur(70 * S / 4)), 0.9)
    # the icon sits on black, so "screen" blends it into the glow without a visible square
    logo = Image.open(ICON).convert("RGB").resize((124 * S, 124 * S), Image.LANCZOS)
    layer = Image.new("RGB", (W, H), (0, 0, 0))
    layer.paste(logo, ((W - logo.width) // 2, 28 * S))
    im = ImageChops.screen(im, layer)
    d = ImageDraw.Draw(im)
    def center(text, y, f, fill):
        w = d.textlength(text, font=f)
        d.text(((W - w) / 2, y), text, font=f, fill=fill)
    center("Repline", 160 * S, font("InterDisplay-Bold.otf", 27 * S), (245, 245, 247))
    center("Daily Pro Routine", 196 * S, font("Inter-Medium.otf", 11 * S), (134, 134, 139))
    # set bar like the app: five segments
    cols = [(56, 224, 255), (63, 141, 255), (63, 141, 255), (168, 85, 247), (134, 134, 139)]
    x, bw, gap = 30 * S, 18 * S, 3 * S
    for c in cols:
        d.rounded_rectangle((x, 236 * S, x + bw, 239 * S), radius=2 * S, fill=c)
        x += bw + gap
    center("Your routine.", 262 * S, font("Inter-Medium.otf", 11 * S), (210, 210, 215))
    center("Over your game.", 278 * S, font("Inter-Medium.otf", 11 * S), (210, 210, 215))
    im = im.resize((164, 314), Image.LANCZOS)
    im.save(os.path.join(OUT, "installerSidebar.bmp"))

def header():
    S = 4
    W, H = 150 * S, 57 * S
    im = Image.new("RGB", (W, H), (255, 255, 255))
    logo = Image.open(ICON).convert("RGBA").resize((42 * S, 42 * S), Image.LANCZOS)
    plate = Image.new("RGBA", logo.size, (0, 0, 0, 0))
    m = Image.new("L", logo.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, logo.width - 1, logo.height - 1), radius=10 * S, fill=255)
    plate.paste(logo, (0, 0), m)
    im.paste(plate, (W - logo.width - 10 * S, (H - logo.height) // 2), plate)
    d = ImageDraw.Draw(im)
    f = font("InterDisplay-Bold.otf", 17 * S)
    t = "Repline"
    d.text((W - logo.width - 18 * S - d.textlength(t, font=f), H / 2 - 12 * S), t, font=f, fill=(29, 29, 31))
    im = im.resize((150, 57), Image.LANCZOS)
    im.save(os.path.join(OUT, "installerHeader.bmp"))

sidebar()
header()
shutil.copy(os.path.join(ROOT, "app", "icons", "repline.ico"), os.path.join(OUT, "icon.ico"))
print("installer art ->", OUT)
