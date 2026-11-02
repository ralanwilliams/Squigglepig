// The pen's maze, as plain data: a grid of cells with the walls between them
// open or shut. Made fresh for each round from its seed, so nothing is
// authored and every run is new.

export type Cell = [number, number]; // column, row
export type Dir = [number, number]; // one step: [1, 0] east, [0, 1] south
export type Maze = {
  cols: number;
  rows: number;
  e: boolean[][]; // e[row][col]: the wall east of the cell is open
  s: boolean[][]; // s[row][col]: the wall south of it is open
};

export const DIRS: Dir[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

// A randomized depth-first maze (a "recursive backtracker", run with a stack
// so a big one can't overflow): every cell is reachable and there's exactly
// one way between any two, so the way through always exists. Its long
// winding corridors and dead ends are what make it a maze rather than a
// field of walls.
export function makeMaze(cols: number, rows: number, rand: () => number): Maze {
  const grid = <T,>(v: T) => Array.from({ length: rows }, () => Array.from({ length: cols }, () => v));
  const e = grid(false);
  const s = grid(false);
  const seen = grid(false);
  const stack: Cell[] = [[0, 0]];
  seen[0][0] = true;
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const next = DIRS.map(([dx, dy]): Cell => [x + dx, y + dy]).filter(
      ([nx, ny]) => nx >= 0 && ny >= 0 && nx < cols && ny < rows && !seen[ny][nx]
    );
    if (!next.length) {
      stack.pop();
      continue;
    }
    const [nx, ny] = next[Math.floor(rand() * next.length)];
    if (nx !== x) e[y][Math.min(x, nx)] = true;
    else s[Math.min(y, ny)][x] = true;
    seen[ny][nx] = true;
    stack.push([nx, ny]);
  }
  return { cols, rows, e, s };
}

// Whether the pig can step from `c` in direction `d`.
export function isOpen(m: Maze, [x, y]: Cell, [dx, dy]: Dir): boolean {
  if (dx === 1) return x < m.cols - 1 && m.e[y][x];
  if (dx === -1) return x > 0 && m.e[y][x - 1];
  if (dy === 1) return y < m.rows - 1 && m.s[y][x];
  return y > 0 && m.s[y - 1][x];
}

export const exits = (m: Maze, c: Cell) => DIRS.filter((d) => isOpen(m, c, d));
const same = (a: Cell, b: Cell) => a[0] === b[0] && a[1] === b[1];

// Where a swipe sends the pig: from `from` in direction `dir`, along the
// corridor, round its bends, until it branches (more than one way on), ends,
// or reaches `goal`. Empty when `dir` is fenced off.
export function corridor(m: Maze, from: Cell, dir: Dir, goal: Cell): Cell[] {
  const out: Cell[] = [];
  let at = from;
  let d = dir;
  while (isOpen(m, at, d)) {
    at = [at[0] + d[0], at[1] + d[1]];
    out.push(at);
    if (same(at, goal)) break;
    const back = d;
    const on = exits(m, at).filter(([dx, dy]) => dx !== -back[0] || dy !== -back[1]);
    if (on.length !== 1) break;
    d = on[0];
  }
  return out;
}

// The same maze turned on its side (the top-left cell stays put), for a
// field wider than it's tall.
export function transpose(m: Maze): Maze {
  const flip = (g: boolean[][]) => Array.from({ length: m.cols }, (_, y) => Array.from({ length: m.rows }, (_, x) => g[x][y]));
  return { cols: m.rows, rows: m.cols, e: flip(m.s), s: flip(m.e) };
}

// How long players take from the gate (the top-left cell) to each cell, in
// seconds, the pig trotting a cell in `step` s. A steady player swipes once
// the pig has stopped, taking a moment at each stop, and now and then tries
// a wrong way first, turning the pig round (index.tsx) once they see it, or
// at the corridor's end if that comes first; `waiting` is the same player
// making no wrong turns. A
// player who plays ahead swipes the next turn while the pig still trots, so
// a stop costs nothing unless the run to it was too short to swipe in, and
// takes no wrong turns. Pigpen places its baskets by these (index.tsx).
export const PLAYER = {
  look: 1.5, // finding the basket and the way there, before the first swipe
  stop: 0.6, // seeing where the pig has stopped, and swiping on
  wrong: 0.2, // the chance, at a branch, of trying a wrong way first
  notice: 0.7, // how long into a wrong way before turning the pig round
  swipe: 0.4, // the quickest a player swipes again, playing ahead
};
export type Pace = { cell: Cell; steady: number; waiting: number; ahead: number };

export function paces(m: Maze, step: number): Pace[] {
  const out: Pace[] = [];
  // The cell reached, the one before it, the times up to the last stop, and
  // the cells trotted since.
  type At = { c: Cell; from: Cell | null; steady: number; waiting: number; ahead: number; run: number };
  const todo: At[] = [{ c: [0, 0], from: null, steady: 0, waiting: 0, ahead: 0, run: 0 }];
  while (todo.length) {
    const { c, from, steady, waiting, ahead, run } = todo.pop()!;
    const t = run * step;
    if (from) out.push({ cell: c, steady: steady + t, waiting: waiting + t, ahead: ahead + Math.max(t, PLAYER.swipe) });
    const on = exits(m, c).filter(([dx, dy]) => !from || !same([c[0] + dx, c[1] + dy], from));
    const next = (d: Dir): Cell => [c[0] + d[0], c[1] + d[1]];
    if (from && on.length === 1) {
      todo.push({ c: next(on[0]), from: c, steady, waiting, ahead, run: run + 1 });
      continue;
    }
    // A stop (corridor's): the run to it, then a swipe on. A steady player
    // tries each wrong way as often as `wrong`, there and back: turned round
    // part way, or from the end after a stop there, then a swipe on again.
    const think = from ? PLAYER.stop : PLAYER.look;
    const ahead0 = ahead + (from ? Math.max(t, PLAYER.swipe) : PLAYER.look);
    const back = (o: Dir) => {
      const out = corridor(m, c, o, [-1, -1]).length * step;
      return out < PLAYER.notice ? 2 * out + 2 * PLAYER.stop : 2 * PLAYER.notice + PLAYER.stop;
    };
    for (const d of on) {
      const others = on.filter((o) => o !== d);
      const astray = others.length ? (PLAYER.wrong * others.reduce((sum, o) => sum + back(o), 0)) / others.length : 0;
      todo.push({ c: next(d), from: c, steady: steady + t + think + astray, waiting: waiting + t + think, ahead: ahead0, run: 1 });
    }
  }
  return out;
}

// The way from `from` to `to` (breadth first), not counting `from`.
export function route(m: Maze, from: Cell, to: Cell): Cell[] {
  const key = ([x, y]: Cell) => y * m.cols + x;
  const prev = new Map<number, Cell | null>([[key(from), null]]);
  const queue: Cell[] = [from];
  while (queue.length) {
    const c = queue.shift()!;
    if (same(c, to)) break;
    for (const d of exits(m, c)) {
      const n: Cell = [c[0] + d[0], c[1] + d[1]];
      if (prev.has(key(n))) continue;
      prev.set(key(n), c);
      queue.push(n);
    }
  }
  const out: Cell[] = [];
  for (let c: Cell | null | undefined = to; c && !same(c, from); c = prev.get(key(c))) out.unshift(c);
  return out;
}

// Every fence as a segment [x1, y1, x2, y2] along the cells' edges: the
// outside, less the open gate left of the start, and every shut wall inside.
export function walls(m: Maze): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  for (let x = 0; x < m.cols; x++) out.push([x, 0, x + 1, 0]);
  for (let y = 1; y < m.rows; y++) out.push([0, y, 0, y + 1]);
  for (let y = 0; y < m.rows; y++) {
    for (let x = 0; x < m.cols; x++) {
      if (!(x < m.cols - 1 && m.e[y][x])) out.push([x + 1, y, x + 1, y + 1]);
      if (!(y < m.rows - 1 && m.s[y][x])) out.push([x, y + 1, x + 1, y + 1]);
    }
  }
  return out;
}
