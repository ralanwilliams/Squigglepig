// A stroke as it's sent, with fewer points.
//
// The canvas (DrawingBoard) adds a point to the stroke under the finger at
// nearly every touch event, smoothing as it goes: each point is the control
// of a quadratic curve ending halfway to the next, so a stroke is
//
//   M p0  Q p0 mid(p0,p1)  Q p1 mid(p1,p2)  …  Q pk-1 mid(pk-1,pk)  L pk
//
// in drawing units to one decimal. A slow, careful stroke has a point every
// unit or so, far more than its shape needs, and a detailed drawing came to
// hundreds of kilobytes: slow to send, and past what the live channel will
// carry in one message (src/lib/chunks.ts). Before it's handed in, each
// stroke keeps only the points its shape needs — the ones a line through
// the rest would stray more than TOLERANCE from (Ramer–Douglas–Peucker),
// and at least one every MAX_GAP units, so a corner rounds off no more than
// it did — and is written out again exactly as the canvas writes it. Same
// format, so every app, old or new, draws it the same way; the line moves
// by a fraction of its own width, too little to see.
//
// Only a stroke in the canvas's own form is thinned; anything else (a dot, a
// stroke from elsewhere) goes as it is.

type Pt = { x: number; y: number };

export const TOLERANCE = 0.3; // drawing units (the pen is 3 wide)
export const MAX_GAP = 4; // drawing units between kept points, at most

const NUM = '(-?\\d+(?:\\.\\d+)?)';
const M = new RegExp(`^M ${NUM} ${NUM}`);
const Q = new RegExp(` Q ${NUM} ${NUM} ${NUM} ${NUM}`, 'y');
const L = new RegExp(` L ${NUM} ${NUM}$`, 'y');

// The finger's points along a stroke the canvas made, or null if it isn't
// one (or has nothing to thin).
export function strokePoints(d: string): Pt[] | null {
  const m = M.exec(d);
  if (!m) return null;
  const pts: Pt[] = [];
  let at = m[0].length;
  for (;;) {
    Q.lastIndex = at;
    const q = Q.exec(d);
    if (!q) break;
    pts.push({ x: Number(q[1]), y: Number(q[2]) });
    at = Q.lastIndex;
  }
  L.lastIndex = at;
  const l = L.exec(d);
  if (!l || L.lastIndex !== d.length || pts.length < 2) return null;
  // The first curve's control is the starting point itself.
  if (pts[0].x !== Number(m[1]) || pts[0].y !== Number(m[2])) return null;
  pts.push({ x: Number(l[1]), y: Number(l[2]) });
  return pts;
}

const px = (n: number) => n.toFixed(1);

// The canvas's own way of writing a stroke through these points.
export function strokePath(pts: Pt[]): string {
  let d = `M ${px(pts[0].x)} ${px(pts[0].y)}`;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    d += ` Q ${px(a.x)} ${px(a.y)} ${px((a.x + b.x) / 2)} ${px((a.y + b.y) / 2)}`;
  }
  const last = pts[pts.length - 1];
  return `${d} L ${px(last.x)} ${px(last.y)}`;
}

// How far p is from the straight line between a and b: the segment, not the
// whole line through them, so a stroke that doubles back on itself (scribbling
// along the canvas edge, say) keeps the point where it turned.
function offLine(p: Pt, a: Pt, b: Pt) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

// Which points the shape needs (Ramer–Douglas–Peucker), without recursion.
function needed(pts: Pt[], tolerance: number): boolean[] {
  const keep = pts.map(() => false);
  keep[0] = keep[pts.length - 1] = true;
  const todo: [number, number][] = [[0, pts.length - 1]];
  while (todo.length) {
    const [a, b] = todo.pop()!;
    let far = -1;
    let farD = tolerance;
    for (let i = a + 1; i < b; i++) {
      const d = offLine(pts[i], pts[a], pts[b]);
      if (d > farD) {
        far = i;
        farD = d;
      }
    }
    if (far >= 0) {
      keep[far] = true;
      todo.push([a, far], [far, b]);
    }
  }
  return keep;
}

export function thinPoints(pts: Pt[], tolerance = TOLERANCE, maxGap = MAX_GAP): Pt[] {
  if (pts.length <= 2) return pts;
  const keep = needed(pts, tolerance);
  // No gap longer than maxGap where the finger's own points were closer.
  let last = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    if (keep[i]) {
      last = i;
    } else if (Math.hypot(pts[i + 1].x - pts[last].x, pts[i + 1].y - pts[last].y) > maxGap) {
      keep[i] = true;
      last = i;
    }
  }
  return pts.filter((_, i) => keep[i]);
}

export function thinStroke(d: string): string {
  const pts = strokePoints(d);
  if (!pts) return d;
  const out = strokePath(thinPoints(pts));
  return out.length < d.length ? out : d;
}
