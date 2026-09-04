#!/usr/bin/env python3
"""Render og-image.jpg from the site's own design tokens.

The social card is built the same way the hero is: a backdrop from images/,
the .veil gradient over it, then a .glass panel with the page's type on top.
Re-run after editing COPY below:  python3 tools/make-og-image.py
"""
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TTF = os.environ.get("PALESKIES_TTF", "/private/tmp/claude-501/-Users-maharishi/1792f025-4e12-44e2-8d96-d2d841aa30ad/scratchpad/ttf")

W, H = 1200, 630
BACKDROP = "images/7.webp"        # the iridescent backdrop, same family as the site's
INK = (245, 246, 242)             # --ink
ACCENT = (216, 247, 129)          # --accent
PAD = 42                          # panel inset
RADIUS = 24

COPY = dict(
    eyebrow="PALESKIES",
    head=[("A clearer view of", False)],
    head2=[("what is ", False), ("Possible.", True)],   # (text, italic)
    sub=["Fine-tuned AI models generating on-brand images and video",
         "inside your templates. India-built models in development."],
    url="paleskies.matri6.com",
    tags="IMAGES · VIDEO · CHOOSE YOUR ENGINE",
)

serif  = lambda s: ImageFont.truetype(f"{TTF}/InstrumentSerif-Regular.ttf", s)
serifi = lambda s: ImageFont.truetype(f"{TTF}/InstrumentSerif-Italic.ttf", s)
mono   = lambda s: ImageFont.truetype(f"{TTF}/DMMono-Medium.ttf", s)
def sans(size, weight=400):
    f = ImageFont.truetype(f"{TTF}/DMSans.ttf", size)
    try: f.set_variation_by_axes([14.0, float(weight)])
    except Exception: pass
    return f

def tracked(draw, xy, text, font, fill, tracking=0.0):
    """PIL has no letter-spacing; .eyebrow/.wordmark need it, so step per glyph."""
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        x += draw.textlength(ch, font=font) + tracking
    return x

def linear_gradient(size, stops, horizontal=True):
    """stops: [(pos 0..1, (r,g,b,a))] -> RGBA image, matching CSS linear-gradient."""
    w, h = size
    n = w if horizontal else h
    strip = Image.new("RGBA", (n, 1))
    px = strip.load()
    for i in range(n):
        t = i / max(n - 1, 1)
        for j in range(len(stops) - 1):
            p0, c0 = stops[j]; p1, c1 = stops[j + 1]
            if p0 <= t <= p1:
                f = (t - p0) / (p1 - p0) if p1 > p0 else 0
                px[i, 0] = tuple(round(c0[k] + (c1[k] - c0[k]) * f) for k in range(4))
                break
        else:
            px[i, 0] = stops[-1][1]
    return strip.resize((w, h) if horizontal else (w, h)) if horizontal else \
           strip.rotate(90, expand=True).resize((w, h))

# --- backdrop, cropped "cover" like .scene ------------------------------------
src = Image.open(os.path.join(ROOT, BACKDROP)).convert("RGB")
scale = max(W / src.width, H / src.height)
src = src.resize((round(src.width * scale), round(src.height * scale)), Image.LANCZOS)
left = round((src.width - W) * 0.65)                      # background-position: 65%
top = round((src.height - H) * 0.42)
card = src.crop((left, top, left + W, top + H))

# --- .veil ---------------------------------------------------------------------
card = card.convert("RGBA")
card.alpha_composite(linear_gradient((W, H), [
    (0.00, (3, 7, 4, 173)), (0.62, (3, 7, 4, 43)), (1.00, (2, 7, 5, 64))]))
card.alpha_composite(linear_gradient((W, H), [
    (0.00, (2, 8, 4, 0)), (0.52, (2, 8, 4, 0)), (1.00, (2, 8, 4, 120))], horizontal=False))

# --- .glass panel: blur what is behind it, then the translucent fill + hairline -
box = (PAD, PAD, W - PAD, H - PAD)
mask = Image.new("L", (W, H), 0)
ImageDraw.Draw(mask).rounded_rectangle(box, RADIUS, fill=255)
blurred = card.filter(ImageFilter.GaussianBlur(18))       # --glass-blur
card = Image.composite(blurred, card, mask)
fill = Image.new("RGBA", (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(fill)
d.rounded_rectangle(box, RADIUS, fill=(17, 26, 19, 150),  # --glass, opacity raised
                    outline=(255, 255, 255, 71), width=1) # for legibility at card size
card.alpha_composite(fill)

# --- type ----------------------------------------------------------------------
d = ImageDraw.Draw(card)
x = 104
tracked(d, (x, 98), COPY["eyebrow"], mono(15), (255, 255, 255, 235), tracking=4.6)

f_head, f_headi = serif(84), serifi(84)
y = 142
for line in (COPY["head"], COPY["head2"]):
    cx = x
    for text, italic in line:
        f = f_headi if italic else f_head
        d.text((cx, y), text, font=f, fill=INK)
        cx += d.textlength(text, font=f)
    y += 78

f_sub = sans(21, 400)
y = 346
for line in COPY["sub"]:
    d.text((x, y), line, font=f_sub, fill=(255, 255, 255, 190))
    y += 33

tracked(d, (x, 512), COPY["url"], mono(17), ACCENT, tracking=0.6)
f_tags = mono(13)
tw = sum(d.textlength(c, font=f_tags) + 1.6 for c in COPY["tags"])
tracked(d, (W - PAD - 62 - tw, 515), COPY["tags"], f_tags, (255, 255, 255, 120), tracking=1.6)

out = os.path.join(ROOT, "og-image.jpg")
card.convert("RGB").save(out, "JPEG", quality=88, optimize=True, progressive=True)
print(f"wrote {out} ({os.path.getsize(out)/1024:.0f} KB)")
