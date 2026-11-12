// Strokes as the game's canvas (src/components/DrawingBoard.tsx) builds them
// from the finger's points, so the tests can make drawings like a player's.

type Pt = { x: number; y: number };
const px = (n: number) => n.toFixed(1);
const MIN_STEP = 1; // DrawingBoard drops moves smaller than this (at 1×)

export function canvasStroke(points: Pt[]): string {
  let last = points[0];
  let d = `M ${px(last.x)} ${px(last.y)}`;
  let moved = false;
  for (const p of points.slice(1)) {
    if (Math.abs(p.x - last.x) < MIN_STEP && Math.abs(p.y - last.y) < MIN_STEP) continue;
    d += ` Q ${px(last.x)} ${px(last.y)} ${px((last.x + p.x) / 2)} ${px((last.y + p.y) / 2)}`;
    last = p;
    moved = true;
  }
  return moved ? `${d} L ${px(last.x)} ${px(last.y)}` : `${d} L ${px(last.x + 0.1)} ${px(last.y)}`;
}

// A seeded random, so a test draws the same thing every run.
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

// One stroke the way a hand moves: a wandering curve, a touch event every
// `step` units or so (a slow, careful line is ~1 unit; a quick one, more).
export function handStroke(random: () => number, length: number, step = 1.2): Pt[] {
  let x = 40 + random() * 320;
  let y = 30 + random() * 240;
  let heading = random() * Math.PI * 2;
  const pts: Pt[] = [{ x, y }];
  for (let i = 0; i < length; i++) {
    heading += (random() - 0.5) * 0.35;
    x = Math.min(399, Math.max(1, x + Math.cos(heading) * step * (0.7 + random() * 0.6)));
    y = Math.min(299, Math.max(1, y + Math.sin(heading) * step * (0.7 + random() * 0.6)));
    pts.push({ x, y });
  }
  return pts;
}

// A detailed drawing: `strokes` strokes of `length` touch events each.
export function detailedDrawing(seed: number, strokes: number, length: number, step = 1.2): string[] {
  const random = rng(seed);
  return Array.from({ length: strokes }, () => canvasStroke(handStroke(random, length, step)));
}

// The points a path passes through, finely: M/L lines and Q curves.
export function tracePath(d: string): Pt[] {
  const tokens = d.match(/[MLQ]|-?\d+(?:\.\d+)?/g) ?? [];
  const out: Pt[] = [];
  let i = 0;
  let cmd = '';
  let cur: Pt = { x: 0, y: 0 };
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/[MLQ]/.test(tokens[i])) cmd = tokens[i++];
    if (cmd === 'M' || cmd === 'L') {
      const p = { x: num(), y: num() };
      if (cmd === 'L') for (let k = 1; k <= 8; k++) out.push({ x: cur.x + ((p.x - cur.x) * k) / 8, y: cur.y + ((p.y - cur.y) * k) / 8 });
      else out.push(p);
      cur = p;
    } else if (cmd === 'Q') {
      const c = { x: num(), y: num() };
      const p = { x: num(), y: num() };
      for (let k = 1; k <= 8; k++) {
        const t = k / 8;
        const u = 1 - t;
        out.push({ x: u * u * cur.x + 2 * u * t * c.x + t * t * p.x, y: u * u * cur.y + 2 * u * t * c.y + t * t * p.y });
      }
      cur = p;
    } else break;
  }
  return out;
}

// How far the farthest point of `a` is from the nearest point of `b`.
export function farthest(a: Pt[], b: Pt[]): number {
  let worst = 0;
  for (const p of a) {
    let best = Infinity;
    for (const q of b) best = Math.min(best, Math.hypot(p.x - q.x, p.y - q.y));
    worst = Math.max(worst, best);
  }
  return worst;
}
