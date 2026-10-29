import React from 'react';
import Svg, { Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { rng } from '../../rng';

// The forest floor, made up fresh for each round from its seed: soil, leaf
// litter, twigs, pebbles and moss, the truffles, and from round 5 smooth dark
// stones that pass for one at a glance. Nothing is authored. Sizes are in dp
// times the UI scale, so a truffle is the same size on any phone and a bigger
// field just has more floor; the clutter grows with the field's area.
//
// It comes in layers so the round can animate the truffles on their own: the
// ground (everything under the truffles), each truffle, and the leaves lying
// over them (later rounds let those cover a truffle's edge).

export type Spot = { x: number; y: number; r: number };
export type Box = { x0: number; y0: number; x1: number; y1: number };

// One round's tuning (index.tsx): `e` runs 0 on round 1 to 1 on the last.
export type Look = { seed: number; e: number; count: number; r: number; contrast: number; decoys: number };

// A truffle's drawing, centred on 0,0.
export type TruffleArt = Spot & {
  body: string;
  highlight: string;
  wartsDark: string;
  wartsLight: string;
  fill: string;
  dark: string;
  light: string;
};

export type Field = {
  ground: React.ReactElement;
  over: React.ReactElement;
  truffles: TruffleArt[];
};

// ---- Helpers -----------------------------------------------------------------

type Rand = () => number;

const f1 = (v: number) => v.toFixed(1);
const r3 = (v: number) => v.toFixed(3);
const frac = (v: number) => v - Math.floor(v);

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
// a → b by t, as a #rrggbb.
export function mix(a: string, b: string, t: number) {
  const x = hex(a);
  const y = hex(b);
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

// A lumpy closed outline of radius ~r, smoothed through its midpoints.
export function blob(r: number, rand: Rand, bump: number) {
  const n = 24;
  const p1 = rand() * 6.28;
  const p2 = rand() * 6.28;
  const pts: number[][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * Math.PI;
    const k = 1 + bump * (0.5 * Math.sin(5 * a + p1) + 0.3 * Math.sin(9 * a + p2)) + (rand() - 0.5) * bump * 0.5;
    pts.push([Math.cos(a) * r * k, Math.sin(a) * r * k * 0.9]);
  }
  const mid = (a: number[], b: number[]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const m0 = mid(pts[n - 1], pts[0]);
  let d = `M${f1(m0[0])} ${f1(m0[1])}`;
  for (let i = 0; i < n; i++) {
    const m = mid(pts[i], pts[(i + 1) % n]);
    d += `Q${f1(pts[i][0])} ${f1(pts[i][1])} ${f1(m[0])} ${f1(m[1])}`;
  }
  return d + 'Z';
}

// A circle as a path, so many can share one <Path>.
const dot = (x: number, y: number, r: number) =>
  `M${f1(x - r)} ${f1(y)}a${f1(r)} ${f1(r)} 0 1 0 ${f1(2 * r)} 0a${f1(r)} ${f1(r)} 0 1 0 ${f1(-2 * r)} 0`;

// The pips in the count chip: one truffle outline, the same every time.
export const PIP = blob(9, rng(3), 0.2);

// ---- Fall leaves -------------------------------------------------------------
// Each species after a sheet of real ones: an outline in unit space (stem at
// 0,1, tip at 0,-1) with its veins, in its own base-to-tip colors.

type Shape = { d: string; v: string };
const poly = (pts: number[][]) => 'M' + pts.map((p) => `${r3(p[0])} ${r3(p[1])}`).join('L') + 'Z';
const segs = (list: number[][]) => list.map((s) => `M${r3(s[0])} ${r3(s[1])}L${r3(s[2])} ${r3(s[3])}`).join('');

// Maples, sassafras, red oak: a radius around a centre, peaking at each lobe
// (mirrored), sinuses down at `base`. A lobe is [angle from up, length,
// width, roundness]; roundness < 1 domes it, > 1 points it. `teeth` saws the
// lobes' edges.
function palmate(cy: number, base: number, lobes: number[][], round: number, teeth: number, nTeeth: number): Shape {
  const pts: number[][] = [];
  const N = 120;
  for (let i = 0; i < N; i++) {
    const th = -Math.PI + (i / N) * 2 * Math.PI;
    let r = base;
    for (const l of lobes) {
      for (const a of [l[0], -l[0]]) {
        const x = Math.abs(th - a) / l[2];
        if (x < 1) r = Math.max(r, base + (l[1] - base) * Math.pow(1 - x, l[3] ?? round));
      }
    }
    r *= 1 + teeth * (frac((i / N) * nTeeth) - 0.5) * Math.min(1, (r - base) / (base * 0.5));
    pts.push([Math.sin(th) * r, cy - Math.cos(th) * r]);
  }
  const v = [[0, cy, 0, 1.05]];
  for (const l of lobes) {
    if (Math.abs(l[0]) > 3) continue; // the base's wedge has no vein of its own
    for (const a of l[0] ? [l[0], -l[0]] : [0]) v.push([0, cy, Math.sin(a) * l[1] * 0.9, cy - Math.cos(a) * l[1] * 0.9]);
  }
  return { d: poly(pts), v: segs(v) };
}

// White oak, birch, alder, dogwood: a half-width along the midrib (t 0 at the
// base, 1 at the tip) shaped by `edge`, side veins at `veins`; `lean` sweeps
// lobe tips toward the leaf's tip.
function pinnate(width: (t: number) => number, edge: (t: number) => number, veins: number[], lean?: (t: number) => number): Shape {
  const y0 = 0.8;
  const len = 1.8;
  const w = (t: number) => width(t) * edge(t);
  const R: number[][] = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    R.push([w(t), y0 - len * t - (lean ? lean(t) : 0)]);
  }
  const pts = R.concat(R.slice(1, -1).reverse().map((p) => [-p[0], p[1]]));
  const v = [[0, 1.05, 0, -0.95]];
  for (const t of veins) {
    const x = w(t) * 0.85;
    const y = y0 - len * t - (lean ? lean(t) * 0.85 : 0);
    v.push([0, y0 - len * t + 0.16, x, y], [0, y0 - len * t + 0.16, -x, y]);
  }
  return { d: poly(pts), v: segs(v) };
}

// Ash: four pairs of leaflets up a rachis, one at the tip.
function compound(): Shape {
  let d = '';
  const v = [[0, 1.05, 0, -0.5]];
  const leaflet = (y: number, a: number, len: number, wd: number) => {
    const pts: number[][] = [];
    for (let i = 0; i <= 12; i++) pts.push([(i / 12) * len, wd * Math.pow(Math.sin((Math.PI * i) / 12), 0.8)]);
    for (let i = 11; i > 0; i--) pts.push([(i / 12) * len, -wd * Math.pow(Math.sin((Math.PI * i) / 12), 0.8)]);
    const c = Math.cos(a);
    const s = Math.sin(a);
    d += poly(pts.map((p) => [p[0] * c - p[1] * s, y + p[0] * s + p[1] * c]));
    v.push([0, y, len * 0.9 * c, y + len * 0.9 * s]);
  };
  [0.7, 0.35, 0, -0.35].forEach((y, k) => {
    const len = 0.6 - k * 0.04;
    leaflet(y, -Math.PI / 2 - 1.05, len, 0.11);
    leaflet(y, -Math.PI / 2 + 1.05, len, 0.11);
  });
  leaflet(-0.5, -Math.PI / 2, 0.5, 0.11);
  return { d, v: segs(v) };
}

const lobe = (s: number) => Math.sqrt(Math.max(0, 1 - s * s));
const SPECIES: { shape: Shape; colors: [string, string][]; big?: boolean }[] = [
  // red maple, sugar maple, sassafras
  { shape: palmate(0.2, 0.42, [[0, 1.15, 0.75], [1.15, 1.0, 0.7], [2.15, 0.62, 0.55]], 0.95, 0.16, 54), colors: [['#a8130c', '#e2361a'], ['#c0200f', '#f06a1c']] },
  { shape: palmate(0.22, 0.45, [[0, 1.18, 0.8], [1.2, 1.05, 0.75], [2.2, 0.66, 0.55]], 0.85, 0.2, 34), colors: [['#e0561a', '#f5b82a'], ['#d23a14', '#f29a1e']] },
  { shape: palmate(0.25, 0.3, [[0, 1.2, 0.62], [0.95, 0.95, 0.52], [Math.PI, 0.58, 1.4, 1.5]], 0.8, 0, 1), colors: [['#d8461a', '#b81e12'], ['#e86a1c', '#d03516']] },
  // birch
  {
    shape: pinnate((t) => 0.78 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.75)), 0.9), (t) => 1 + 0.08 * (frac(t * 15) - 0.5), [0.15, 0.3, 0.45, 0.6, 0.75]),
    colors: [['#b9a52a', '#f2cc36'], ['#d8a422', '#f5d64a']],
  },
  // white oak
  {
    shape: pinnate(
      (t) => 0.8 * Math.pow(Math.sin(Math.PI * Math.pow(t, 1.25)), 0.6),
      (t) => 0.3 + 0.7 * lobe(2 * frac(t * 3.6 + 0.78) - 1),
      [0.2, 0.478, 0.756],
      (t) => 0.1 * lobe(2 * frac(t * 3.6 + 0.78) - 1)
    ),
    colors: [['#7f8f2a', '#f0a024'], ['#c47a1f', '#f2b13a']],
  },
  // alder
  {
    shape: pinnate((t) => 0.66 * Math.pow(Math.sin(Math.PI * t), 0.75), (t) => 1 + 0.06 * (frac(t * 22) - 0.5), [0.15, 0.28, 0.41, 0.54, 0.67, 0.8]),
    colors: [['#5f8a2a', '#eaa628'], ['#7c9a30', '#d9b23a']],
  },
  // red oak
  { shape: palmate(0.35, 0.3, [[0, 1.3, 0.42], [0.62, 1.05, 0.4], [1.3, 0.95, 0.42], [2.05, 0.62, 0.45], [Math.PI, 0.45, 0.9, 1.5]], 1.25, 0.14, 70), colors: [['#b8160e', '#ec5a1e']] },
  // ash
  { shape: compound(), colors: [['#d8461a', '#6f8f2a'], ['#e07a1c', '#8a9a2c']], big: true },
  // dogwood
  { shape: pinnate((t) => 0.6 * Math.pow(Math.sin(Math.PI * t), 0.95), () => 1, [0.2, 0.38, 0.56, 0.74]), colors: [['#4f7a2a', '#b51d2a'], ['#6b8a2a', '#c8361c']] },
];

// A layer's leaves: its gradients (faded toward the ground as rounds go on)
// and leaf() to scatter one. Gradient ids carry the layer's prefix, since the
// ground and the leaves over the truffles are two drawings.
function leafKit(prefix: string, ground: string, fade: number, rand: Rand) {
  const defs: React.ReactElement[] = [];
  const picks: { shape: Shape; id: string; vein: string; big?: boolean }[] = [];
  SPECIES.forEach((sp, i) =>
    sp.colors.forEach((c, j) => {
      const id = `${prefix}${i}_${j}`;
      const a = mix(c[0], ground, fade);
      const b = mix(c[1], ground, fade);
      defs.push(
        <LinearGradient key={id} id={id} x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor={a} />
          <Stop offset="1" stopColor={b} />
        </LinearGradient>
      );
      picks.push({ shape: sp.shape, id, vein: mix(mix(a, b, 0.5), '#2a0f05', 0.55), big: sp.big });
    })
  );
  const leaf = (key: number, x: number, y: number, L: number, rot: number) => {
    const p = picks[Math.floor(rand() * picks.length)];
    const k = p.big ? L * 1.2 : L;
    const flip = rand() < 0.5 ? -1 : 1;
    return (
      <G key={key} transform={`translate(${f1(x)} ${f1(y)}) rotate(${f1(rot)}) scale(${r3(flip * k)} ${r3(k)})`}>
        <Path d={p.shape.d} fill={`url(#${p.id})`} stroke={p.vein} strokeOpacity={0.55} strokeWidth={0.6 / k} />
        <Path d={p.shape.v} fill="none" stroke={p.vein} strokeWidth={0.7 / k} strokeLinecap="round" />
      </G>
    );
  };
  return { defs, leaf };
}

// ---- The rest of the floor ----------------------------------------------------

function twig(x: number, y: number, len: number, rot: number, rand: Rand) {
  let a = (rot * Math.PI) / 180;
  const pts = [[x, y]];
  for (let i = 1; i <= 4; i++) {
    a += (rand() - 0.5) * 0.5;
    const p = pts[i - 1];
    pts.push([p[0] + (Math.cos(a) * len) / 4, p[1] + (Math.sin(a) * len) / 4]);
  }
  const ba = a + (rand() < 0.5 ? 0.7 : -0.7);
  return (
    'M' + pts.map((p) => `${f1(p[0])} ${f1(p[1])}`).join('L') +
    `M${f1(pts[2][0])} ${f1(pts[2][1])}l${f1(Math.cos(ba) * len * 0.3)} ${f1(Math.sin(ba) * len * 0.3)}`
  );
}

// Places `n` things of radius about `rr` in the box, clear of `taken` by
// `gap`; gives up on any it can't fit.
function place(n: number, rr: number, box: Box, taken: Spot[], gap: number, rand: Rand): Spot[] {
  const out: Spot[] = [];
  for (let tries = 0; out.length < n && tries < 5000; tries++) {
    const r = rr * (0.8 + 0.4 * rand());
    const x = box.x0 + r + 6 + rand() * Math.max(0, box.x1 - box.x0 - 2 * r - 12);
    const y = box.y0 + r + 6 + rand() * Math.max(0, box.y1 - box.y0 - 2 * r - 12);
    if ([...taken, ...out].some((t) => Math.hypot(t.x - x, t.y - y) < t.r + r + gap)) continue;
    out.push({ x, y, r });
  }
  return out;
}

const LEAF_UNDER = (e: number) => 8 + 34 * e;
const LEAF_OVER = (e: number) => 2 + 14 * e;

// The field for a w × h screen, truffles inside `box`. `s` is the UI scale.
export function makeField(w: number, h: number, box: Box, look: Look, s: number): Field {
  const rand = rng(look.seed);
  const { e } = look;
  const A = (w * h) / (411 * 306); // how many of the reference field fit
  const soil = mix('#8c6a47', '#5c432c', e);
  const under = leafKit(`u${look.seed}_`, soil, 0.1 + 0.3 * e, rand);
  const ground: React.ReactElement[] = [<Rect key="soil" width={w} height={h} fill={soil} />];
  let key = 0;

  for (let i = 0; i < 40 * A; i++) {
    const cx = rand() * w;
    const cy = rand() * h;
    ground.push(
      <Ellipse
        key={key++}
        cx={cx}
        cy={cy}
        rx={(20 + rand() * 50) * s}
        ry={(10 + rand() * 25) * s}
        transform={`rotate(${f1(rand() * 180)} ${f1(cx)} ${f1(cy)})`}
        fill={mix(soil, rand() < 0.5 ? '#3a2819' : '#b08b62', 0.25 + rand() * 0.25)}
        opacity={0.55}
      />
    );
  }
  let dk = '';
  let lt = '';
  for (let i = 0; i < (220 + 420 * e) * A; i++) {
    const p = dot(rand() * w, rand() * h, (0.6 + rand() * 1.4) * s);
    if (rand() < 0.55) dk += p;
    else lt += p;
  }
  ground.push(<Path key="dk" d={dk} fill={mix(soil, '#1f140c', 0.55)} />, <Path key="lt" d={lt} fill={mix(soil, '#d2b08a', 0.45)} />);

  // A crowded field (the endless hunt's later levels) draws them smaller and
  // closer together, to fit; a round's few are never crowded enough for this.
  const room = Math.sqrt(((box.x1 - box.x0) * (box.y1 - box.y0)) / Math.max(1, look.count));
  const r = Math.min(look.r * s, room * 0.3);
  const gap = Math.min(18 * s, room * 0.22);
  const spots = place(look.count, r, box, [], gap, rand);
  const decoys = place(look.decoys, r * 1.05, box, spots, Math.min(10 * s, gap), rand);

  for (let i = 0; i < (3 + 6 * e) * A; i++) {
    const mx = rand() * w;
    const my = rand() * h;
    let md = '';
    for (let k = 0; k < 9; k++) md += dot(mx + (rand() - 0.5) * 16 * s, my + (rand() - 0.5) * 10 * s, (1.5 + rand() * 2.2) * s);
    ground.push(<Path key={key++} d={md} fill={mix(mix('#5f7d36', '#7c9a45', rand()), soil, 0.3 * e)} />);
  }
  for (let i = 0; i < LEAF_UNDER(e) * A; i++) ground.push(under.leaf(key++, rand() * w, rand() * h, (9 + rand() * 9) * s, rand() * 360));
  for (let i = 0; i < (2 + 7 * e) * A; i++) {
    const col = mix('#3e2a1a', soil, 0.2 * rand());
    ground.push(
      <Path
        key={key++}
        d={twig(rand() * w, rand() * h, (25 + rand() * 45) * s, rand() * 360, rand)}
        fill="none"
        stroke={col}
        strokeWidth={(1.6 + rand() * 1.8) * s}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  }
  for (let i = 0; i < (4 + 10 * e) * A; i++) {
    const r = (3 + rand() * 6) * s;
    const col = mix('#a39d92', '#6e6a63', rand());
    ground.push(
      <G key={key++} transform={`translate(${f1(rand() * w)} ${f1(rand() * h)}) rotate(${f1(rand() * 180)})`}>
        <Ellipse rx={r} ry={r * 0.75} fill={col} stroke={mix(col, '#000000', 0.3)} strokeWidth={0.7} />
        <Ellipse cx={-r * 0.3} cy={-r * 0.25} rx={r * 0.4} ry={r * 0.2} fill="#ffffff" opacity={0.3} />
      </G>
    );
  }
  // The look-alikes: about truffle-sized and as dark, but smooth and glossy.
  for (const d of decoys) {
    const col = mix(soil, '#37302b', look.contrast);
    ground.push(
      <G key={key++} transform={`translate(${f1(d.x)} ${f1(d.y)}) rotate(${f1(rand() * 180)})`}>
        <Ellipse cx={d.r * 0.1} cy={d.r * 0.25} rx={d.r * 1.05} ry={d.r * 0.8} fill="#000000" opacity={0.2} />
        <Ellipse rx={d.r * 1.05} ry={d.r * 0.82} fill={col} stroke={mix(col, '#000000', 0.3)} strokeWidth={1} />
        <Ellipse cx={-d.r * 0.35} cy={-d.r * 0.32} rx={d.r * 0.42} ry={d.r * 0.2} fill="#ffffff" opacity={0.2} />
      </G>
    );
  }

  // The truffles: knobbly, dark and warty, their colors drawn toward the
  // soil's as rounds go on.
  const c = look.contrast;
  const fill = mix(soil, '#2a1b12', c);
  const dark = mix(soil, '#160d07', c);
  const light = mix(soil, '#6e5039', c);
  const truffles = spots.map((t): TruffleArt => {
    const body = blob(t.r, rand, 0.22);
    const highlight = blob(t.r * 0.5, rand, 0.2);
    let wartsDark = '';
    let wartsLight = '';
    for (let i = 0; i < 9; i++) {
      const a = rand() * 6.28;
      const d = Math.sqrt(rand()) * t.r * 0.72;
      const p = dot(Math.cos(a) * d, Math.sin(a) * d * 0.9, t.r * (0.06 + rand() * 0.07));
      if (i % 2) wartsDark += p;
      else wartsLight += p;
    }
    return { ...t, body, highlight, wartsDark, wartsLight, fill, dark, light };
  });

  // Leaves on top: early rounds keep clear of every truffle, later ones lie
  // over their edges (never the middle).
  const top = leafKit(`o${look.seed}_`, soil, 0.15 + 0.3 * e, rand);
  const over: React.ReactElement[] = [];
  const want = Math.round(LEAF_OVER(e) * A);
  for (let tries = 0; over.length < want && tries < 600; tries++) {
    const L = (9 + rand() * 9) * s;
    const x = rand() * w;
    const y = rand() * h;
    if (spots.some((t) => Math.hypot(t.x - x, t.y - y) < L + t.r * (e > 0.4 ? 0.45 : 1.3))) continue;
    over.push(top.leaf(key++, x, y, L, rand() * 360));
  }

  return {
    ground: (
      <Svg width={w} height={h}>
        <Defs>{under.defs}</Defs>
        {ground}
      </Svg>
    ),
    over: (
      <Svg width={w} height={h} pointerEvents="none">
        <Defs>{top.defs}</Defs>
        {over}
      </Svg>
    ),
    truffles,
  };
}

// One truffle, in an Svg of its own (so it can pop and fade), with its shadow.
export function Truffle({ t }: { t: TruffleArt }) {
  const R = t.r * 1.4;
  return (
    <Svg width={2 * R} height={2 * R} viewBox={`${f1(-R)} ${f1(-R)} ${f1(2 * R)} ${f1(2 * R)}`}>
      <Ellipse cx={t.r * 0.12} cy={t.r * 0.3} rx={t.r * 1.05} ry={t.r * 0.78} fill="#000000" opacity={0.22} />
      <Path d={t.body} fill={t.fill} stroke={t.dark} strokeWidth={1.2} />
      <Path d={t.highlight} transform={`translate(${f1(-t.r * 0.25)} ${f1(-t.r * 0.28)})`} fill={t.light} opacity={0.5} />
      <Path d={t.wartsDark} fill={t.dark} />
      <Path d={t.wartsLight} fill={t.light} opacity={0.8} />
    </Svg>
  );
}
