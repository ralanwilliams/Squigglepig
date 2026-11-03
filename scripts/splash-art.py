"""Make the Android splash image, src/assets/images/splash-android.png.

Since Android 12 the phone draws the splash itself and shows the image only
inside a circle 192 dp across (app.json's expo-splash-screen "android"
imageWidth), cutting off whatever falls outside it. The splash picture,
squigglepig_clear_dark.png, runs out to its corners (the ears, the feet, the
wordmark), so splash-android.png is that picture moved onto a square canvas
the smallest circle around all of it just fits, with a hair of margin, so
Android shows every bit of it. iOS doesn't cut its splash, so it uses the
picture as it is (app.json's "ios" image, 320 pt wide). Run from the repo
root after changing squigglepig_clear_dark.png (or after running
scripts/dark-art.py, which makes it):

    python scripts/splash-art.py
"""
import math
import random
from pathlib import Path

import numpy as np
from PIL import Image

DIR = Path(__file__).resolve().parent.parent / 'src' / 'assets' / 'images'
SRC = DIR / 'squigglepig_clear_dark.png'
OUT = DIR / 'splash-android.png'
MARGIN = 1.01  # canvas = circle diameter × this, so the mask's soft edge misses the art


def hull(points):
    """Convex hull (Andrew's monotone chain): the only points the circle can touch."""
    pts = sorted(set(points))
    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lower, upper = [], []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    return lower[:-1] + upper[:-1]


def circle_through(*pts):
    """The circle with 2 points as its diameter, or through 3 (None if they're in a line)."""
    if len(pts) == 2:
        (ax, ay), (bx, by) = pts
        c = ((ax + bx) / 2, (ay + by) / 2)
        return c, math.dist(c, pts[0])
    (ax, ay), (bx, by), (cx, cy) = pts
    d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by))
    if abs(d) < 1e-9:
        return None
    a2, b2, c2 = ax * ax + ay * ay, bx * bx + by * by, cx * cx + cy * cy
    c = ((a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d,
         (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d)
    return c, math.dist(c, pts[0])


def smallest_circle(points):
    """Welzl's smallest enclosing circle, in its iterative form."""
    pts = list(points)
    random.Random(1).shuffle(pts)
    inside = lambda c, p: math.dist(c[0], p) <= c[1] + 1e-7
    c = (pts[0], 0.0)
    for i, p in enumerate(pts):
        if inside(c, p):
            continue
        c = (p, 0.0)
        for j in range(i):
            q = pts[j]
            if inside(c, q):
                continue
            c = circle_through(p, q)
            for k in range(j):
                r = pts[k]
                if not inside(c, r):
                    c = circle_through(p, q, r) or c
    return c


def main():
    src = Image.open(SRC).convert('RGBA')
    ys, xs = np.nonzero(np.asarray(src.getchannel('A')) > 0)
    # Every visible pixel's four corners, so the circle clears whole pixels.
    corners = [(x + dx, y + dy) for x, y in zip(xs.tolist(), ys.tolist()) for dx in (0, 1) for dy in (0, 1)]
    (cx, cy), r = smallest_circle(hull(corners))
    size = math.ceil(2 * r * MARGIN)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.paste(src, (round(size / 2 - cx), round(size / 2 - cy)), src)
    out.save(OUT, optimize=True)
    print(f'Wrote {OUT.name}: {size} px square; the picture is {src.width / size:.0%} of its width')


if __name__ == '__main__':
    main()
