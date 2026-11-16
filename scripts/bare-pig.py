"""Make the Home pig without its wordmark: squigglepig_bare.png.

The Home art (squigglepig_clear.png) is the pig with its tail running into
the hand-written "squigglepig" beside it. A row of players' pigs (the prompts
screen's PigRoster) wants the pig alone, dressed in each player's avatar, so
this copy erases everything right of the pig's body: the tail and the
wordmark. It keeps the original's size, so every outfit and theme part placed
on the Home art (src/theme/skins, src/avatar/outfits.ts) lands on it exactly
as it does there (src/assets/assets.ts names it 'home').

Run from the repo root after changing squigglepig_clear.png, then
scripts/dark-art.py (which makes squigglepig_bare_dark.png from it):

    python scripts/bare-pig.py
"""
from pathlib import Path

import numpy as np
from PIL import Image

DIR = Path(__file__).resolve().parent.parent / 'src' / 'assets' / 'images'
# The pig's body ends here (source px); the tail and wordmark are all to its right.
EDGE = 566
# ... but for the tail's root, which leaves the body a little further left,
# low down: (x from, y from, y to).
ROOT = (546, 728, 752)


def main():
    im = Image.open(DIR / 'squigglepig_clear.png').convert('RGBA')
    a = np.array(im)
    a[:, EDGE:, 3] = 0
    x, y0, y1 = ROOT
    a[y0:y1, x:, 3] = 0
    Image.fromarray(a, 'RGBA').save(DIR / 'squigglepig_bare.png', optimize=True)
    print('wrote', DIR / 'squigglepig_bare.png')


if __name__ == '__main__':
    main()
