// How alike two drawings are, 0–100: the one flashed and the one drawn from
// memory. Both are SVG paths in drawing units (src/lib/drawing.ts): the
// player's from DrawPad (M, then Q curves, then L), the pack's from the
// Quick, Draw! import (M, then L). Only those absolute commands are read; a
// path with anything else ends where the unknown command starts.
//
// Each drawing becomes a cloud of points spaced evenly along its ink, moved
// so its centre of ink is at the origin and scaled so its points sit, on
// average, one unit from it. Where and how big it was drawn doesn't count,
// only its shape. Then every point of each finds its nearest point in the
// other; the mean of those distances, both ways, is how far apart the shapes
// are, and FAR turns that into a score. `fit` lines the two up the same way
// for the ghost the player sees after Done (ScoreReveal.tsx).
//
// Pure: no React, no imports, so scripts/quickdraw.mts runs it in Node to
// choose the pack's clearest drawings.

type Pt = { x: number; y: number };

// Points per drawing. More is finer and slower; this is plenty for a doodle
// and runs in a few milliseconds on a phone.
const POINTS = 128;
// A mean distance of this much (in the clouds' own units) or more scores 0,
// and none scores 100, in a straight line between. Set with
// `npm run quickdraw -- --calibrate` so that a fair attempt at the drawing
// scores about 75, someone else's drawing of the same thing about 50 and a
// drawing of something else about 20. Even a perfect trace scores about 90,
// not 100: DrawPad's smoothing rounds the corners off.
const FAR = 0.27;
// Points along one quadratic curve.
const CURVE_STEPS = 4;

// The polyline of one path.
function pathPoints(d: string): Pt[] {
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
  const pts: Pt[] = [];
  let i = 0;
  let cmd = '';
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) cmd = tokens[i++];
    if (cmd === 'M' || cmd === 'L') {
      pts.push({ x: num(), y: num() });
    } else if (cmd === 'Q' && pts.length) {
      const p0 = pts[pts.length - 1];
      const c = { x: num(), y: num() };
      const p1 = { x: num(), y: num() };
      for (let s = 1; s <= CURVE_STEPS; s++) {
        const t = s / CURVE_STEPS;
        const u = 1 - t;
        pts.push({ x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x, y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y });
      }
    } else {
      break;
    }
  }
  return pts.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)) ? pts : [];
}

// POINTS points spread evenly along all the ink (a dot gets one).
function sample(strokes: string[]): Pt[] {
  const lines = strokes.map(pathPoints).filter((l) => l.length);
  let total = 0;
  for (const l of lines) for (let k = 1; k < l.length; k++) total += Math.hypot(l[k].x - l[k - 1].x, l[k].y - l[k - 1].y);
  const out: Pt[] = [];
  if (total <= 0) {
    for (const l of lines) out.push(l[0]);
  } else {
    const step = total / POINTS;
    let next = 0; // ink length at which the next point goes
    let along = 0;
    for (const l of lines) {
      if (along >= next) {
        out.push(l[0]);
        next = along + step;
      }
      for (let k = 1; k < l.length; k++) {
        const a = l[k - 1];
        const b = l[k];
        const seg = Math.hypot(b.x - a.x, b.y - a.y);
        while (seg > 0 && next <= along + seg) {
          const t = (next - along) / seg;
          out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
          next += step;
        }
        along += seg;
      }
    }
  }
  return out;
}

// Where a drawing's ink is centred and how far it spreads: its points' mean,
// and their RMS distance from it. Null for one with no ink worth measuring.
function spread(pts: Pt[]): { x: number; y: number; r: number } | null {
  if (!pts.length) return null;
  const x = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const y = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const r = Math.sqrt(pts.reduce((s, p) => s + (p.x - x) ** 2 + (p.y - y) ** 2, 0) / pts.length);
  return r < 1e-6 ? null : { x, y, r };
}

// The sampled ink, normalised as above. Empty for a drawing with no ink worth
// measuring.
export function cloud(strokes: string[]): Pt[] {
  const pts = sample(strokes);
  const at = spread(pts);
  if (!at) return [];
  return pts.map((p) => ({ x: (p.x - at.x) / at.r, y: (p.y - at.y) / at.r }));
}

// How to lay `shown` over `drawn` the way they were compared: move `shown`'s
// centre of ink to the origin, scale it by k, move it to `drawn`'s. Null when
// either has no ink to line up.
export function fit(shown: string[], drawn: string[]): { from: Pt; to: Pt; k: number } | null {
  const a = spread(sample(shown));
  const b = spread(sample(drawn));
  if (!a || !b) return null;
  return { from: { x: a.x, y: a.y }, to: { x: b.x, y: b.y }, k: b.r / a.r };
}

// The length of one path's ink, in its own units.
export function inkLength(d: string): number {
  const l = pathPoints(d);
  let total = 0;
  for (let k = 1; k < l.length; k++) total += Math.hypot(l[k].x - l[k - 1].x, l[k].y - l[k - 1].y);
  return total;
}

// The mean distance from each point of `a` to the nearest of `b`.
function reach(a: Pt[], b: Pt[]) {
  let sum = 0;
  for (const p of a) {
    let best = Infinity;
    for (const q of b) {
      const d = (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
      if (d < best) best = d;
    }
    sum += Math.sqrt(best);
  }
  return sum / a.length;
}

// 0–100. Clouds rather than strokes, so one side can be made once and
// compared many times (the import does).
export function likeness(a: Pt[], b: Pt[]): number {
  if (!a.length || !b.length) return 0;
  const d = (reach(a, b) + reach(b, a)) / 2;
  return Math.round(100 * Math.max(0, 1 - d / FAR));
}

export const similarity = (a: string[], b: string[]) => likeness(cloud(a), cloud(b));
