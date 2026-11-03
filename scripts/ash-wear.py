"""Trace what the Ash theme's pig wears from the pig artwork, so it fits him.

His jersey, a tank top, covers his body from the crease under his head to
its hem over his belly, cut to the outline of the art: bare at the
shoulders, where its armholes are cut deep, and with holes where something
in front of him has to show (the sign, the phone, the pencil, and any arm
not holding a crutch). On the winner art it's cut just as on the home art,
and the trumpet, its banner and the arm holding it are traced in the art's
own colours and drawn again in front of it. Below the hem he's just the
pig. The arms that hold a crutch are traced and drawn again over
the jersey and the crutch, so the crutch is under them, and moved out to his
sides, so they hang from his bare shoulders in the armholes rather than from
the front of his jersey; they say where they've moved his hooves to, so
whatever he holds, from any theme, moves with them (layout.ts followHooves). His sweatband runs
round his head under the ears, its ends on the outline of his head.

Writes src/theme/skins/ashWear.ts: the props (spread into props.ts PROPS)
and where each goes on each piece of art (src/theme/skins/ash.ts). Run from
the repo root after changing any of the pig artwork or anything here:

    python scripts/ash-wear.py

Needs numpy and Pillow (pip install numpy pillow).
"""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
IMAGES = ROOT / 'src' / 'assets' / 'images'
OUT = ROOT / 'src' / 'theme' / 'skins' / 'ashWear.ts'

RED = '#CE1141'
BLACK = '#111111'
WHITE = '#FFFFFF'
SIMPLIFY = 1.4  # how far, in pixels of the art, a traced outline may stray to save points
REACH = 30  # an arm's black sides are this far apart at most (in pixels of the art, halved): the pink between them is filled in

# Each piece of art the pig wears his kit on, as fractions of the image:
#   body_x   — the body's right edge, so the tail and the wordmark are left out
#   neck     — the jersey's top, a round scoop below his chin and jowls (scoop)
#   armholes — the ellipses cut out of it at his shoulders: (x, y) the middle,
#              then the half width and half height; deep enough to take in
#              where each arm that shows through meets his body
#   hem      — the bottom of the jersey
#   crutch   — the arms that hold a crutch, to draw again: the box round each,
#              how far it moves out to his side (dx), and where its hoof is in
#              the art (grip), before it moves; or (mirror) the arm before it,
#              mirrored about that line down his middle, so the two match, the
#              grip then the art's own hoof on that side
#   front    — what's in front of the jersey, traced and drawn again over it:
#              ('colour', box) the trumpet and its banner, ('arm', box) the arm
#              holding them
#   arms     — the boxes round the arms that don't, to show through
#   holes    — what's in front of him: ('sign', box) a white card, ('rect',
#              box) a phone, ('colour', box) the trumpet and banner, the pencil
#   logo     — the middle of the team's pig on his chest and its size, if it
#              shows; number — the middle of his number and its height
def scoop(cx, cy, k):
    """A round neckline: lowest, at cy, in the middle (cx), rising k times
    the square of the distance from it towards the shoulders."""
    return [(x / 100, cy - k * (x / 100 - cx) ** 2) for x in range(0, 101)]


ARMHOLES = [(0.03, 0.44, 0.12, 0.2), (0.565, 0.44, 0.12, 0.2)]
STILL = dict(body_x=0.58, neck=scoop(0.31, 0.515, 2.0), armholes=ARMHOLES, hem=0.77)
# On the sign art his right arm (the viewer's right) meets his body further in.
SIGN_ARMHOLES = [ARMHOLES[0], (0.565, 0.44, 0.15, 0.17)]
ARTS = {
    'home': dict(STILL, file='squigglepig_clear.png',
                 crutch=[dict(box=(0.11, 0.53, 0.215, 0.725), dx=-0.075, grip=(0.162, 0.672)),
                         dict(mirror=0.2975, grip=(0.423, 0.685))],
                 logo=(0.3, 0.585, 0.036), number=(0.3, 0.695, 0.075)),
    'join': dict(STILL, file='squigglepig_join_game_clear.png', armholes=SIGN_ARMHOLES, arms=[(0.06, 0.53, 0.2, 0.71), (0.4, 0.54, 0.52, 0.71)],
                 holes=[('sign', (0.15, 0.55, 0.47, 0.79))], logo=(0.3, 0.548, 0.026)),
    'lobby': dict(STILL, file='squigglepig_lobby_clear.png', armholes=SIGN_ARMHOLES, arms=[(0.06, 0.53, 0.2, 0.71), (0.4, 0.54, 0.52, 0.71)],
                  holes=[('sign', (0.15, 0.55, 0.47, 0.79))], logo=(0.3, 0.548, 0.026)),
    'cell': dict(STILL, file='squigglepig_cell.png', arms=[(0.04, 0.49, 0.25, 0.6), (0.36, 0.49, 0.54, 0.6)],
                 holes=[('rect', (0.233, 0.451, 0.374, 0.74))]),
    # The same pig as the stills, with the trumpet up: his jersey as at home.
    'winner': dict(STILL, file='squigglepig_winner.gif', body_x=0.6,
                   crutch=[dict(box=(0.1, 0.52, 0.215, 0.725), dx=-0.075, grip=(0.162, 0.672))],
                   front=[('colour', (0.3, 0.2, 0.75, 0.75)), ('arm', (0.34, 0.37, 0.49, 0.6))],
                   logo=(0.3, 0.585, 0.036), number=(0.3, 0.695, 0.075)),
    'waiting': dict(file='squigglepig.gif', body_x=0.72, hem=0.845, armholes=[(0.27, 0.605, 0.085, 0.15), (0.69, 0.6, 0.075, 0.12)],
                    neck=scoop(0.465, 0.612, 1.7),
                    crutch=[dict(box=(0.33, 0.64, 0.42, 0.8), dx=-0.06, grip=(0.39, 0.75))], arms=[(0.5, 0.52, 0.62, 0.7)], holes=[('colour', (0.48, 0.38, 0.75, 0.7))],
                    logo=(0.45, 0.67, 0.022), number=(0.45, 0.745, 0.045)),
}

# The sweatband, under his ears and over his brow, on each piece of art: the
# middle of the band's height at its centre, half its height, how far its
# ends rise above the middle, and how far it's turned (the drawing-screen
# pig's head is tilted), all as fractions of the image's width or height.
BANDS = {
    'Still': dict(file='squigglepig_clear.png', arts=['home', 'join', 'lobby', 'cell'], x=0.31, y=0.142, half=0.017, rise=0.012, tilt=0),
    'Winner': dict(file='squigglepig_winner.gif', arts=['winner'], x=0.31, y=0.148, half=0.016, rise=0.012, tilt=0),
    'Waiting': dict(file='squigglepig.gif', arts=['waiting'], x=0.485, y=0.343, half=0.012, rise=0.009, tilt=0),
    'Canvas': dict(file='canvas_pig.png', arts=['canvasPig'], x=0.5, y=0.29, half=0.028, rise=0.02, tilt=-8),
}


def load(name):
    return np.asarray(Image.open(IMAGES / name).convert('RGBA')).astype(int)


def disk(r):
    y, x = np.mgrid[-r:r + 1, -r:r + 1]
    return x * x + y * y <= r * r


def shift_or(m, k):
    """Dilate mask m by structuring element k (both boolean)."""
    out = np.zeros_like(m)
    r = k.shape[0] // 2
    for dy, dx in zip(*np.nonzero(k)):
        dy -= r
        dx -= r
        out |= np.roll(np.roll(m, dy, axis=0), dx, axis=1)
    return out


def dilate(m, r):
    return shift_or(m, disk(r)) if r > 0 else m


def erode(m, r):
    return ~dilate(~m, r) if r > 0 else m


def close(m, r):
    return erode(dilate(m, r), r)


def open_(m, r):
    return dilate(erode(m, r), r)


def components(m):
    """Label 4-connected components; return (labels, sizes)."""
    lab = np.zeros(m.shape, int)
    sizes = [0]
    n = 0
    for sy, sx in zip(*np.nonzero(m)):
        if lab[sy, sx]:
            continue
        n += 1
        lab[sy, sx] = n
        stack, count = [(sy, sx)], 0
        while stack:
            y, x = stack.pop()
            count += 1
            for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= yy < m.shape[0] and 0 <= xx < m.shape[1] and m[yy, xx] and not lab[yy, xx]:
                    lab[yy, xx] = n
                    stack.append((yy, xx))
        sizes.append(count)
    return lab, sizes


def largest(m):
    lab, sizes = components(m)
    return lab == int(np.argmax(sizes)) if len(sizes) > 1 else m


def fill_holes(m):
    outside = largest(np.pad(~m, 1))[1:-1, 1:-1]
    return ~outside


def in_box(shape, box):
    H, W = shape
    m = np.zeros(shape, bool)
    x0, y0, x1, y1 = box
    m[int(y0 * H):int(y1 * H), int(x0 * W):int(x1 * W)] = True
    return m


def lum(im):
    return im[..., :3].mean(axis=2)


def outline(im):
    """The art's black linework."""
    return (im[..., 3] > 128) & (lum(im) < 80)


def arm(im, box, reach):
    """An arm's silhouette: the black linework in its box (its sides and its
    hoof), closed up so the pink between them is in it too."""
    lines = largest(outline(im) & in_box(im.shape[:2], box))
    return fill_holes(close(lines, reach)) & (im[..., 3] > 128)


def hole(im, kind, box):
    H, W = im.shape[:2]
    m = in_box((H, W), box)
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    if kind == 'rect':
        return m
    if kind == 'sign':
        card = largest(m & (r > 215) & (g > 215) & (b > 215))
        ys, xs = np.nonzero(card)
        return in_box((H, W), ((xs.min() - 7) / W, (ys.min() - 7) / H, (xs.max() + 8) / W, (ys.max() + 8) / H))
    # 'colour': whatever's red, gold or yellow (not the pig's pink), with its outline.
    red = (r > 150) & (g < 100)
    gold = (r > 170) & (g > 120) & (b < 120)
    return fill_holes(close(dilate(m & (im[..., 3] > 128) & (red | gold), 6), 12)) & m


def solid_corners(m):
    """Mask m with every pair of pixels that touch only at a corner joined up
    (the outline then never has two ways on from one point)."""
    m = m.copy()
    while True:
        a, b, c, d = m[:-1, :-1], m[:-1, 1:], m[1:, :-1], m[1:, 1:]
        cross = (a & d & ~b & ~c) | (b & c & ~a & ~d)
        if not cross.any():
            return m
        ys, xs = np.nonzero(cross)
        m[ys, xs] = True
        m[ys, xs + 1] = True


def trace(m):
    """The outline loops of mask m, clockwise round what's in it (so holes in
    it run the other way, and are cut out of it when filled)."""
    m = solid_corners(m)
    h, w = m.shape
    pad = np.pad(m, 1)
    edges = {}
    ys, xs = np.nonzero(m)
    for y, x in zip(ys, xs):
        if not pad[y, x + 1]:
            edges[(x, y)] = (x + 1, y)
        if not pad[y + 1, x + 2]:
            edges[(x + 1, y)] = (x + 1, y + 1)
        if not pad[y + 2, x + 1]:
            edges[(x + 1, y + 1)] = (x, y + 1)
        if not pad[y + 1, x]:
            edges[(x, y + 1)] = (x, y)
    loops = []
    while edges:
        start, nxt = edges.popitem()
        loop = [start]
        while nxt != start:
            loop.append(nxt)
            nxt = edges.pop(nxt)
        if len(loop) >= 12:
            loops.append(loop)
    return loops


def simplify(pts, eps):
    if len(pts) < 3:
        return pts
    a, b = pts[0], pts[-1]
    ax, ay = b[0] - a[0], b[1] - a[1]
    L = np.hypot(ax, ay) or 1
    d = [abs(ax * (p[1] - a[1]) - ay * (p[0] - a[0])) / L for p in pts]
    i = int(np.argmax(d))
    if d[i] > eps:
        return simplify(pts[: i + 1], eps)[:-1] + simplify(pts[i:], eps)
    return [a, b]


def path(m, frame):
    """Mask m as one path in a prop's units (`frame`: origin and scale)."""
    ox, oy, k = frame
    d = []
    for loop in trace(m):
        half = len(loop) // 2
        pts = simplify(loop[: half + 1], SIMPLIFY)[:-1] + simplify(loop[half:] + [loop[0]], SIMPLIFY)[:-1]
        if len(pts) < 3:
            continue
        d.append('M' + 'L'.join(f'{round((x - ox) * k, 1)} {round((y - oy) * k, 1)}' for x, y in pts) + 'Z')
    return ''.join(d)


def frame_of(m):
    """A prop's frame round mask m: its top-left corner, the scale to 100
    units across, and its size in units."""
    ys, xs = np.nonzero(m)
    x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    k = 100 / (x1 - x0)
    return (x0, y0, k), (x1 - x0, y1 - y0)


def placement(frame, size, shape):
    (x0, y0, k), (w, h) = frame, size
    H, W = shape
    return {'x': round((x0 + w / 2) / W, 4), 'y': round((y0 + h / 2) / H, 4), 'w': round(w / W, 4)}


def below(shape, pts):
    """Everything below the polyline `pts` (fractions)."""
    H, W = shape
    xs = np.arange(W) / W
    line = np.interp(xs, [p[0] for p in pts], [p[1] for p in pts]) * H
    return np.arange(H)[:, None] > line[None, :]


def rows(shape, lo, hi):
    H = shape[0]
    y = np.arange(H)[:, None] * np.ones((1, shape[1]))
    return (y >= lo * H) & (y < hi * H)


def ellipses(shape, list_):
    """Everything inside any of the ellipses (x, y, half width, half height)."""
    H, W = shape
    y = np.arange(H)[:, None] / H
    x = np.arange(W)[None, :] / W
    m = np.zeros(shape, bool)
    for cx, cy, rx, ry in list_:
        m |= ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1
    return m


def posterize(im, m, colours=12):
    """The art inside mask m as a few flat colours: (mask, fill) layers, the
    biggest first and the dark outline last, each grown a pixel into its
    neighbours so no seam shows between them."""
    ys, xs = np.nonzero(m)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    crop = im[y0:y1, x0:x1, :3].copy()
    inside = m[y0:y1, x0:x1]
    crop[~inside] = np.median(crop[inside], axis=0)
    quant = Image.fromarray(crop.astype(np.uint8)).quantize(colors=colours, method=Image.Quantize.MEDIANCUT)
    index = np.asarray(quant)
    palette = quant.getpalette()
    layers = []
    for k in np.unique(index[inside]):
        layer = np.zeros(m.shape, bool)
        layer[y0:y1, x0:x1] = (index == k) & inside
        if layer.sum() < 12:
            continue
        rgb = palette[3 * k:3 * k + 3]
        layers.append((layer, rgb))
    layers.sort(key=lambda l: (sum(l[1]) / 3 < 60, -l[0].sum()))
    return [(dilate(layer, 1) & m, '#%02X%02X%02X' % tuple(rgb)) for layer, rgb in layers]


def mirrored(m, axis):
    """Mask m flipped left to right about the column `axis` (in pixels)."""
    out = np.zeros_like(m)
    ys, xs = np.nonzero(m)
    xs = np.round(2 * axis - 1 - xs).astype(int)
    keep = (xs >= 0) & (xs < m.shape[1])
    out[ys[keep], xs[keep]] = True
    return out


def num(n):
    return round(float(n), 1)


def ellipse(cx, cy, rx, ry):
    return f'M{num(cx - rx)} {num(cy)}a{num(rx)} {num(ry)} 0 1 0 {num(2 * rx)} 0a{num(rx)} {num(ry)} 0 1 0 {num(-2 * rx)} 0Z'


def team_pig(cx, cy, r):
    """The team's pig: a white head with its ears up, a red snout, in a
    prop's units round (cx, cy), r its head's radius (props.ts loop, straight
    sides, is near enough at this size)."""
    pts = [(0, -1), (0.46, -0.92), (0.85, -1.5), (1.08, -0.62), (1.31, 0), (1.0, 0.77), (0, 1.08), (-1.0, 0.77), (-1.31, 0),
           (-1.08, -0.62), (-0.85, -1.5), (-0.46, -0.92)]
    head = 'M' + 'L'.join(f'{num(cx + x * r)} {num(cy + y * r)}' for x, y in pts) + 'Z'
    return [
        {'d': head, 'fill': WHITE, 'line': True},
        {'d': ellipse(cx, cy + 0.38 * r, 0.54 * r, 0.35 * r), 'fill': RED, 'line': True},
        {'d': ellipse(cx - 0.19 * r, cy + 0.38 * r, 0.09 * r, 0.15 * r) + ellipse(cx + 0.19 * r, cy + 0.38 * r, 0.09 * r, 0.15 * r)
         + ellipse(cx - 0.38 * r, cy - 0.19 * r, 0.12 * r, 0.12 * r) + ellipse(cx + 0.38 * r, cy - 0.19 * r, 0.12 * r, 0.12 * r), 'fill': BLACK},
    ]


def sample(im, m):
    c = np.median(im[m][:, :3], axis=0)
    return '#%02X%02X%02X' % tuple(int(v) for v in c)


def kit(art, cfg):
    im = load(cfg['file'])
    H, W = im.shape[:2]
    shape = (H, W)
    solid = im[..., 3] > 128
    body = largest(open_(solid & in_box(shape, (0, 0, cfg['body_x'], 1)), 4))
    crutch_arms = cfg.get('crutch', [])
    holes = np.zeros(shape, bool)
    for b in cfg.get('arms', []):
        holes |= dilate(arm(im, b, REACH), 3)
    for kind, b in cfg.get('holes', []):
        holes |= hole(im, kind, b)
    armholes = ellipses(shape, cfg['armholes'])
    hem = cfg['hem']
    wear = body & below(shape, cfg['neck']) & ~below(shape, [(0, hem), (1, hem)]) & ~armholes & ~holes
    wear = largest(wear)
    frame, size = frame_of(wear)
    ox, oy, k = frame
    # The trim round the neck and the armholes, and along the hem: black,
    # with a white stripe along the edge (the hem's is inside the black).
    trim = 0.009 * W  # in pixels
    neck_band = wear & ~below(shape, [(x, y + trim / H) for x, y in cfg['neck']])
    neck_white = neck_band & below(shape, [(x, y + trim * 0.45 / H) for x, y in cfg['neck']])
    arm_band = wear & dilate(armholes, round(trim))
    arm_white = wear & dilate(armholes, round(trim * 0.45))
    hem_band = wear & rows(shape, hem - 0.016, hem)
    hem_white = wear & rows(shape, hem - 0.0105, hem - 0.0055)
    shapes = [
        {'d': path(wear, frame), 'fill': RED, 'line': True},
        {'d': path(neck_band & ~neck_white, frame), 'fill': BLACK},
        {'d': path(neck_white, frame), 'fill': WHITE},
        {'d': path(arm_band & ~arm_white, frame), 'fill': BLACK},
        {'d': path(arm_white, frame), 'fill': WHITE},
        {'d': path(hem_band & ~hem_white, frame), 'fill': BLACK},
        {'d': path(hem_white, frame), 'fill': WHITE},
    ]
    prop = {'rim': False, 'under': True, 'w': 100, 'h': round(size[1] * k, 1), 'anchor': [50, round(size[1] * k / 2, 1)]}
    if 'logo' in cfg:
        lx, ly, lr = cfg['logo']
        shapes += team_pig((lx * W - ox) * k, (ly * H - oy) * k, lr * W * k)
    if 'number' in cfg:
        nx, ny, nh = cfg['number']
        size_u = nh * W * k
        prop['text'] = {'x': num((nx * W - ox) * k), 'y': num((ny * H - oy) * k + size_u * 0.35), 'size': num(size_u),
                        'maxW': num(size_u * 1.4), 'fill': WHITE, 'shade': BLACK}
    prop['shapes'] = [s for s in shapes if s['d']]
    name = art[0].upper() + art[1:]
    out = {f'jersey{name}': (prop, placement(frame, size, shape))}

    # What's in front of the jersey, where it overlaps it, drawn again over it.
    if cfg.get('front'):
        m = np.zeros(shape, bool)
        for kind, b in cfg['front']:
            m |= dilate(arm(im, b, REACH), 2) if kind == 'arm' else hole(im, kind, b)
        m &= solid & dilate(wear, 6)
        fframe, fsize = frame_of(m)
        fk = fframe[2]
        front = {'rim': False, 'under': True, 'w': 100, 'h': round(fsize[1] * fk, 1), 'anchor': [50, round(fsize[1] * fk / 2, 1)],
                 'shapes': [{'d': path(layer, fframe), 'fill': fill} for layer, fill in posterize(im, m)]}
        out[f'jerseyFront{name}'] = (front, placement(fframe, fsize, shape))

    # The arms that hold a crutch, drawn again over it, out at his sides: the
    # pink of the arm, its shading and its highlight, and its black linework
    # (hoof and all), each taken from the art where the arm is and moved, or
    # mirrored from the arm before it.
    hooves = []  # where each arm's hoof is in the art, and where it's drawn
    if crutch_arms:
        base = lum(im)
        tone = lambda px: '#%02X%02X%02X' % tuple(int(v) for v in np.median(px, axis=0))
        drawn = []  # each arm's (pink, black, light, dark), moved into place
        pinks, lights, darks = [], [], []
        for c in crutch_arms:
            if 'mirror' in c:
                axis = c['mirror'] * W
                drawn.append(tuple(mirrored(part, axis) for part in drawn[-1]))
                gx, gy = hooves[-1]['to']
                hooves.append({'from': list(c['grip']), 'to': [round(2 * c['mirror'] - gx, 4), gy]})
                continue
            a = arm(im, c['box'], REACH)
            dx = round(c['dx'] * W)
            a_black = a & outline(im)
            # No pink below the top of the hoof (between its toes, round its
            # tips): in each column, the arm's pink stops where the hoof's
            # black starts, in the lower half of the arm.
            ys, xs = np.nonzero(a)
            low = ys.min() + (ys.max() - ys.min()) * 0.55
            hoof = a_black & (np.arange(H)[:, None] > low)
            top = np.where(hoof.any(axis=0), hoof.argmax(axis=0), H)
            a_pink = a & ~a_black & (np.arange(H)[:, None] < top[None, :])
            mid = np.median(base[a_pink])
            a_light = a_pink & (base > mid + 18)
            a_dark = a_pink & (base < mid - 14)
            pinks.append(im[a_pink][:, :3])
            lights.append(im[a_light][:, :3])
            darks.append(im[a_dark][:, :3])
            drawn.append(tuple(np.roll(part, dx, axis=1) for part in (a_pink, a_black, a_light, a_dark)))
            hooves.append({'from': list(c['grip']), 'to': [round(c['grip'][0] + c['dx'], 4), c['grip'][1]]})
        fill, black, light, dark = (np.zeros(shape, bool) for _ in range(4))
        for a_pink, a_black, a_light, a_dark in drawn:
            # The pink reaches a little under the black, so no seam shows
            # between them, but never out to the black's outer edge.
            fill |= dilate(a_pink, 2) & (a_pink | a_black)
            black |= a_black
            light |= a_light
            dark |= a_dark
        aframe, asize = frame_of(fill | black)
        arm_shapes = [
            {'d': path(fill, aframe), 'fill': tone(np.concatenate(pinks))},
            {'d': path(open_(dark, 1), aframe), 'fill': tone(np.concatenate(darks)) if dark.any() else '#000000'},
            {'d': path(open_(light, 1), aframe), 'fill': tone(np.concatenate(lights)) if light.any() else '#000000'},
            {'d': path(black, aframe), 'fill': '#000000'},
        ]
        ak = aframe[2]
        arms = {'rim': False, 'w': 100, 'h': round(asize[1] * ak, 1), 'anchor': [50, round(asize[1] * ak / 2, 1)],
                'hooves': hooves, 'shapes': [s for s in arm_shapes if s['d']]}
        out[f'jerseyArms{name}'] = (arms, placement(aframe, asize, shape))
    return out, [tuple(h['from']) for h in hooves]


def band(name, cfg):
    im = load(cfg['file'])
    H, W = im.shape[:2]
    shape = (H, W)
    solid = im[..., 3] > 128
    y = np.arange(H)[:, None] / H
    x = np.arange(W)[None, :] / W
    head = largest(solid & in_box(shape, (cfg['x'] - 0.3, cfg['y'] - 0.12, cfg['x'] + 0.3, cfg['y'] + 0.12)))
    xs = np.nonzero(head.any(axis=0))[0]
    half_w = (xs.max() - xs.min()) / 2 / W
    t = np.tan(np.radians(cfg['tilt'])) * (W / H)
    middle = cfg['y'] + t * (x - cfg['x']) - cfg['rise'] * ((x - cfg['x']) / half_w) ** 2
    m = head & (np.abs(y - middle) < cfg['half'])
    m = largest(m)
    stripe = m & (np.abs(y - middle) < cfg['half'] * 0.28)
    frame, size = frame_of(m)
    k = frame[2]
    prop = {'head': True, 'w': 100, 'h': round(size[1] * k, 1), 'anchor': [50, round(size[1] * k / 2, 1)],
            'shapes': [{'d': path(m, frame), 'fill': RED, 'line': True}, {'d': path(stripe, frame), 'fill': WHITE}]}
    return {f'sweatband{name}': (prop, {art: placement(frame, size, shape) for art in cfg['arts']})}


def ts(v, indent=''):
    if isinstance(v, dict):
        inner = ', '.join(f'{k}: {ts(x)}' for k, x in v.items())
        return '{ ' + inner + ' }'
    if isinstance(v, list):
        return '[' + ', '.join(ts(x) for x in v) + ']'
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if isinstance(v, str):
        return "'" + v + "'"
    return str(v)


def main():
    props, fits, grips = {}, {}, {}
    for art, cfg in ARTS.items():
        made, held = kit(art, cfg)
        for name, (prop, place) in made.items():
            props[name] = prop
            fits.setdefault(art, []).append((name, place))
        if held:
            grips[art] = held
    for name, cfg in BANDS.items():
        for prop_name, (prop, places) in band(name, cfg).items():
            props[prop_name] = prop
            for art, place in places.items():
                fits.setdefault(art, []).insert(0, (prop_name, place))
    lines = [
        '// Generated by scripts/ash-wear.py from the pig artwork — do not edit.',
        "// What the Ash theme's pig wears (ash.ts), traced to fit him on each piece",
        '// of art: his sweatband, his jersey, and the arms that hold his',
        '// crutches drawn again over them. Rerun the script after changing the art.',
        "import type { Prop } from './props';",
        "import type { ArtName, Placement } from './types';",
        '',
        'export const ASH_WEAR = {',
    ]
    for name, prop in props.items():
        lines.append(f'  {name}: {ts(prop)},')
    lines.append('} satisfies Record<string, Prop>;')
    lines.append('')
    lines.append('// Where each goes on each piece of art, in the order they\'re drawn: the')
    lines.append('// sweatband, the jersey, then (in ash.ts) the crutches, then the arms.')
    lines.append('type Fit = Omit<Placement, \'prop\'> & { prop: keyof typeof ASH_WEAR };')
    lines.append('export const ASH_FIT: Partial<Record<ArtName, Fit[]>> = {')
    for art, items in fits.items():
        lines.append(f'  {art}: [' + ', '.join(ts({'prop': n, **p}) for n, p in items) + '],')
    lines.append('};')
    lines.append('')
    lines.append('// Where his hooves grip his crutches in the art, left to right (the arms')
    lines.append('// drawn again take them out to his sides: layout.ts followHooves).')
    lines.append('export const ASH_GRIPS: Partial<Record<ArtName, [number, number][]>> = {')
    for art, held in grips.items():
        lines.append(f'  {art}: [' + ', '.join(f'[{x}, {y}]' for x, y in held) + '],')
    lines.append('};')
    OUT.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(f'{OUT.relative_to(ROOT)}: {", ".join(props)} ({OUT.stat().st_size // 1024} kB)')


if __name__ == '__main__':
    main()
