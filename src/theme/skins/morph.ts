import type { Prop } from './props';
import type { Placement } from './types';

// A prop that changes between the day and night palettes by morphing from
// one form into the other (Lukas's sheriff turning outlaw, lukas.ts): a
// placement's `night` names the prop it turns into after dark, and anything
// about where it goes that changes too. SkinDecor draws it part way between
// the two while the light changes (theme.tsx useMorph): each shape of the day
// prop turns into the same shape of the night one, the numbers in its path
// sliding from one to the other and its fill blending. With `via` it passes
// through a third form on the way, halfway there (Chris's cape, blown out by
// the wind between hanging one way and the other), on a smooth curve rather
// than a corner. A placement that's only there by day or by night (`by`)
// fades away or in instead.
//
// So the props are drawn alike: as many shapes, in the same order, each set
// of paths with the same commands (only the numbers differ) and all outlined
// or none. `unmorphable` checks a pair; previews/_build-skins.mjs runs it on
// every skin. A pair that doesn't match just swaps halfway.
// Plain data and arithmetic, with no React Native in it, so the previews'
// build loads it too (previews/_shared.js has a copy of the drawing side).

const NUM = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;

// A path as its numbers and the commands between them: glue[i] comes before
// nums[i], and the last glue closes it.
type Split = { glue: string[]; nums: number[]; shape: string };
const splits = new Map<string, Split>();

function split(d: string): Split {
  let s = splits.get(d);
  if (s) return s;
  const glue: string[] = [];
  const nums: number[] = [];
  let at = 0;
  for (const m of d.matchAll(NUM)) {
    glue.push(d.slice(at, m.index));
    nums.push(Number(m[0]));
    at = m.index! + m[0].length;
  }
  glue.push(d.slice(at));
  s = { glue, nums, shape: glue.map((g) => g.replace(/[\s,]/g, '')).join('|') };
  splits.set(d, s);
  return s;
}

// `t` of the way from a to b; with `v`, on the curve that passes through v
// halfway (a quadratic whose control point is pulled out to meet it).
function between(a: number, b: number, t: number, v?: number) {
  if (v === undefined) return a + (b - a) * t;
  const pull = 2 * v - (a + b) / 2;
  return (1 - t) * (1 - t) * a + 2 * t * (1 - t) * pull + t * t * b;
}
const round = (n: number) => Math.round(n * 100) / 100;

function morphPath(a: string, b: string, t: number, v?: string): string {
  if (a === b && (v === undefined || v === a)) return a;
  const p = split(a);
  const q = split(b);
  const w = v === undefined ? undefined : split(v);
  if (p.shape !== q.shape || (w && w.shape !== p.shape)) return t < 0.5 ? a : b;
  let d = p.glue[0];
  p.nums.forEach((n, i) => {
    // A number given straight after another needs a space: "1-2" reads as
    // two, but once the second has slid past zero "1 2" has to say so.
    const glue = p.glue[i + 1];
    d += round(between(n, q.nums[i], t, w?.nums[i])) + (i + 1 < p.nums.length && !glue.trim() ? ' ' : glue);
  });
  return d;
}

// '#rgb', '#rrggbb', 'rgb()' or 'rgba()' as [r, g, b, alpha]; null for
// anything else ('none').
function rgba(c: string): [number, number, number, number] | null {
  if (c[0] === '#') {
    const h = c.length === 4 ? c.slice(1).replace(/./g, '$&$&') : c.slice(1);
    if (h.length !== 6) return null;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
  }
  const m = c.match(/^rgba?\(([^)]*)\)$/);
  if (!m) return null;
  const [r, g, b, a = 1] = m[1].split(',').map(Number);
  return [r, g, b, a];
}

const clamp = (n: number, max: number) => Math.min(max, Math.max(0, n));

function morphColor(a: string, b: string, t: number, v?: string): string {
  if (a === b && (v === undefined || v === a)) return a;
  const p = rgba(a);
  const q = rgba(b);
  const w = v === undefined ? undefined : rgba(v);
  if (!p || !q || w === null) return t < 0.5 ? a : b;
  const [r, g, bl] = [0, 1, 2].map((i) => Math.round(clamp(between(p[i], q[i], t, w?.[i]), 255)));
  return `rgba(${r},${g},${bl},${round(clamp(between(p[3], q[3], t, w?.[3]), 1))})`;
}

// Prop `a` turned `t` of the way into `b` (0 is a, 1 is b), through `via`
// halfway if given: its size, its anchor and every shape.
export function morphProp(a: Prop, b: Prop, t: number, via?: Prop): Prop {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const [ax, ay] = a.anchor ?? [a.w / 2, a.h / 2];
  const [bx, by] = b.anchor ?? [b.w / 2, b.h / 2];
  const [vx, vy] = via ? (via.anchor ?? [via.w / 2, via.h / 2]) : [undefined, undefined];
  return {
    ...a,
    w: between(a.w, b.w, t, via?.w),
    h: between(a.h, b.h, t, via?.h),
    anchor: [between(ax, bx, t, vx), between(ay, by, t, vy)],
    shapes: a.shapes.map((s, i) => {
      const o = b.shapes[i];
      const v = via?.shapes[i];
      return o ? { d: morphPath(s.d, o.d, t, v?.d), fill: morphColor(s.fill, o.fill, t, v?.fill), line: s.line } : s;
    }),
  };
}

// The prop a placement is by night.
export const nightProp = (p: Placement) => p.night?.prop ?? p.prop;

// How much of a placement shows `t` of the way from day to night: all of it,
// or for one that's there only by day or by night, as much as has faded in.
export const shownAt = (p: Placement, t: number) => (p.by === 'day' ? 1 - t : p.by === 'night' ? t : 1);

// Where a placement goes `t` of the way from day to night: where its `night`
// says, or where it is by day for anything that doesn't.
export function morphPlacement(p: Placement, t: number): Placement {
  const n = p.night;
  if (!n || t <= 0) return p;
  return {
    ...p,
    x: between(p.x, n.x ?? p.x, t),
    y: between(p.y, n.y ?? p.y, t),
    w: between(p.w, n.w ?? p.w, t),
    rotate: between(p.rotate ?? 0, n.rotate ?? p.rotate ?? 0, t),
  };
}

// What stops day prop `a` morphing cleanly into night prop `b`, if anything.
export function unmorphable(a: Prop, b: Prop): string[] {
  const why: string[] = [];
  if (a.shapes.length !== b.shapes.length) why.push(`${a.shapes.length} shapes against ${b.shapes.length}`);
  a.shapes.forEach((s, i) => {
    const o = b.shapes[i];
    if (!o) return;
    if (split(s.d).shape !== split(o.d).shape) why.push(`shape ${i}: the paths' commands differ`);
    if (!!s.line !== !!o.line) why.push(`shape ${i}: only one is outlined`);
    if ((s.fill === 'none') !== (o.fill === 'none')) why.push(`shape ${i}: only one is filled`);
  });
  return why;
}
