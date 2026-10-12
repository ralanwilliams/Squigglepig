"""Make the dark-mode versions of the Squigglepig artwork.

The art is black line work drawn for the teal background. On the dark palette
the outline (and the thin hand-written "squigglepig" wordmark and tail) sinks
into the background, so each image gets a "sticker" border: the artwork's
silhouette, grown by RADIUS px and filled with OUTLINE, laid underneath it.
The art runs right to the edges of most images, so each dark version gets a
transparent margin of PAD px on every side for the border to grow into; Logo
and WorkStage work the margin out from the two sizes and line the original
area up exactly where the light image goes (so Logo windows and the snout
hotspot don't move). Run from the repo root after changing any source image:

    python scripts/dark-art.py [radius] [#rrggbb]

PNGs get a smooth (anti-aliased) border; GIF transparency is on/off, so the
GIFs' border is hard-edged.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageSequence

DIR = Path(__file__).resolve().parent.parent / 'src' / 'assets' / 'images'
PNGS = ['squigglepig_clear', 'squigglepig_join_game_clear', 'squigglepig_lobby_clear', 'squigglepig_cell', 'canvas_pig']
GIFS = ['squigglepig_winner', 'squigglepig']
RADIUS = 8  # px at the source resolution (thick)
PAD = 12  # transparent margin on every side (PNGs; the half-size GIFs get half), enough for RADIUS up to 10
OUTLINE = '#4ECDC4'  # the brand teal: in dark mode the art keeps a rim of the light-mode background


def disk_dilate(alpha, r):
    """Grow an alpha mask by r px with a round brush, anti-aliased (2x supersampled)."""
    h, w = alpha.shape
    big = np.array(Image.fromarray(alpha).resize((w * 2, h * 2), Image.BILINEAR)).astype(np.float32)
    R = r * 2
    pad = np.pad(big, R)
    out = big.copy()
    for dy in range(-R, R + 1):
        for dx in range(-R, R + 1):
            if dx * dx + dy * dy <= R * R:
                out = np.maximum(out, pad[R + dy:R + dy + h * 2, R + dx:R + dx + w * 2])
    return np.array(Image.fromarray(out.astype(np.uint8)).resize((w, h), Image.LANCZOS))


def outlined(im, r, color, hard=False, pad=0):
    im = im.convert('RGBA')
    if pad:
        padded = Image.new('RGBA', (im.width + 2 * pad, im.height + 2 * pad), (0, 0, 0, 0))
        padded.paste(im, (pad, pad))
        im = padded
    a = np.array(im)
    alpha = a[..., 3]
    if hard:
        alpha = np.where(alpha >= 128, 255, 0).astype(np.uint8)
    grown = disk_dilate(alpha, r)
    if hard:
        grown = np.where(grown >= 128, 255, 0).astype(np.uint8)
    rgb = tuple(int(color[i:i + 2], 16) for i in (1, 3, 5))
    base = np.zeros_like(a)
    base[..., :3] = rgb
    base[..., 3] = grown
    out = Image.fromarray(base, 'RGBA')
    out.alpha_composite(im)
    return out


def gif_frames_to_p(frames):
    """RGBA frames -> palette frames with index 255 as the transparent color."""
    out = []
    for f in frames:
        a = np.array(f)
        q = f.convert('RGB').quantize(colors=255, method=Image.MEDIANCUT, dither=Image.NONE)
        p = np.array(q)
        p[a[..., 3] < 128] = 255
        pal = q.getpalette()[:255 * 3] + [0, 0, 0]
        img = Image.fromarray(p.astype(np.uint8), 'P')
        img.putpalette(pal)
        img.info['transparency'] = 255
        out.append(img)
    return out


def main(r=RADIUS, color=OUTLINE, out_dir=DIR, suffix='_dark'):
    out_dir = Path(out_dir)
    for name in PNGS:
        src = DIR / f'{name}.png'
        outlined(Image.open(src), r, color, pad=PAD).save(out_dir / f'{name}{suffix}.png', optimize=True)
        print('wrote', out_dir / f'{name}{suffix}.png')
    for name in GIFS:
        src = Image.open(DIR / f'{name}.gif')
        durations = []
        frames = []
        for fr in ImageSequence.Iterator(src):
            durations.append(fr.info.get('duration', src.info.get('duration', 70)))
            frames.append(outlined(fr.convert('RGBA'), max(1, round(r * 0.5)), color, hard=True, pad=PAD // 2))
        p = gif_frames_to_p(frames)
        p[0].save(out_dir / f'{name}{suffix}.gif', save_all=True, append_images=p[1:], duration=durations,
                  loop=src.info.get("loop", 0), disposal=2, transparency=255, optimize=True)
        print('wrote', out_dir / f'{name}{suffix}.gif')


if __name__ == '__main__':
    args = sys.argv[1:]
    main(int(args[0]) if len(args) > 0 else RADIUS, args[1] if len(args) > 1 else OUTLINE,
         *(args[2:4] if len(args) > 2 else []))
