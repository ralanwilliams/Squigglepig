"""Make every app icon from the one source picture, src/assets/images/icon.png.

icon.png is a 1024 px square with no transparency (Apple rejects icons that
have it), so iOS uses it as-is and rounds the corners itself.

Android launchers show only the middle 72/108 of an adaptive icon, then cut
that to their own shape (circle, squircle, rounded square). So
adaptive-icon.png fits the whole picture into that middle part, and stretches
its edge pixels, softly blurred, out across the rest; the rest only shows
when the launcher nudges the icon about, and the stretched edges keep the
pig's body from ending in a hard line there. Web maskable icons are cut the
same way, so icon-maskable-512.png is the same picture. Run from the repo
root after changing icon.png:

    python scripts/app-icons.py
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'src' / 'assets' / 'images' / 'icon.png'
VIEWPORT = 72 / 108  # the part of an adaptive icon a launcher shows

# Full picture, square corners: the platform rounds them.
FULL = {
    'public/icon-192.png': 192,
    'public/icon-512.png': 512,
    'public/apple-touch-icon.png': 180,
    'site/apple-touch-icon.png': 180,
    'docs/play-store/icon-512.png': 512,
}
# Picture fitted into the launcher's viewport.
ADAPTIVE = {
    'src/assets/images/adaptive-icon.png': 1024,
    'public/icon-maskable-512.png': 512,
}


def adaptive(src, size):
    inner = round(size * VIEWPORT)
    lo = (size - inner) // 2
    hi = size - inner - lo
    pic = src.resize((inner, inner), Image.LANCZOS)
    a = np.asarray(pic)
    # Stretched edge pixels streak, so blur them into a soft continuation.
    out = Image.fromarray(np.pad(a, ((lo, hi), (lo, hi), (0, 0)), mode='edge'))
    out = out.filter(ImageFilter.GaussianBlur(size / 40))
    out.paste(pic, (lo, lo))
    return out


def main():
    src = Image.open(SRC).convert('RGB')
    for rel, size in FULL.items():
        img = src.resize((size, size), Image.LANCZOS)
        if rel.startswith('docs/play-store/'):
            img = img.convert('RGBA')  # Play wants a 32-bit PNG
        img.save(ROOT / rel, optimize=True)
    for rel, size in ADAPTIVE.items():
        adaptive(src, size).save(ROOT / rel, optimize=True)
    print(f'Wrote {len(FULL) + len(ADAPTIVE)} icons from {SRC.relative_to(ROOT).as_posix()}')


if __name__ == '__main__':
    main()
