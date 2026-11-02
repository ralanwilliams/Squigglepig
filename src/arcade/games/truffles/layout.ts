import { rng } from '../../rng';

// Where a round's things lie on the forest floor, and how long players take
// to clear it, as plain data: art.tsx draws it, index.tsx fits each field to
// its clock with it, and Pig.tsx walks it. No React here, so it can be
// checked on its own.
//
// Some truffles lie under a pile of leaves, and there are empty piles just
// like them. A pile with a truffle under it gives off wisps of scent, often
// and plain near the pig, now and then far from it (scentEvery).

export type Spot = { x: number; y: number; r: number };
export type Box = { x0: number; y0: number; x1: number; y1: number };
type Point = { x: number; y: number };

// One round's tuning (index.tsx): `e` runs 0 on round 1 to 1 on the last.
// `hidden` of the `count` truffles are under piles, and `piles` more piles
// hide nothing.
export type Look = { seed: number; e: number; count: number; r: number; contrast: number; decoys: number; hidden: number; piles: number };

// A pile of leaves: over truffle `truffle`, or over nothing (null).
export type Pile = Spot & { truffle: number | null };
export type Layout = { truffles: Spot[]; decoys: Spot[]; piles: Pile[] };

export const PILE = 1.5; // a pile's radius, of the truffle's

// Places `n` things of radius about `rr` in the box, clear of `taken` by
// `gap`; gives up on any it can't fit.
function place(n: number, rr: number, box: Box, taken: Spot[], gap: number, rand: () => number): Spot[] {
  const out: Spot[] = [];
  for (let tries = 0; out.length < n && tries < Math.max(5000, 50 * n); tries++) {
    const r = rr * (0.8 + 0.4 * rand());
    const x = box.x0 + r + 6 + rand() * Math.max(0, box.x1 - box.x0 - 2 * r - 12);
    const y = box.y0 + r + 6 + rand() * Math.max(0, box.y1 - box.y0 - 2 * r - 12);
    const near = (t: Spot) => Math.hypot(t.x - x, t.y - y) < t.r + r + gap;
    if (taken.some(near) || out.some(near)) continue;
    out.push({ x, y, r });
  }
  return out;
}

// The truffles, look-alike stones and piles for `look` in `box`, `s` the UI
// scale. A crowded field (the endless hunt's later levels) draws them smaller
// and closer together, to fit; a round's few are never crowded enough for
// this. All the truffles are placed (the hunt's level n is n truffles): a
// layout that doesn't fit them all is laid again a little smaller and closer.
export function layout(box: Box, look: Look, s: number): Layout {
  const rand = rng(look.seed);
  const room = Math.sqrt(((box.x1 - box.x0) * (box.y1 - box.y0)) / Math.max(1, look.count + look.piles));
  let r = Math.min(look.r * s, room * 0.27);
  let gap = Math.min(18 * s, room * 0.2);
  let truffles = place(look.count, r, box, [], gap, rand);
  for (let shrink = 0; truffles.length < look.count && shrink < 20; shrink++) {
    r *= 0.9;
    gap *= 0.9;
    truffles = place(look.count, r, box, [], gap, rand);
  }
  const decoys = place(look.decoys, r * 1.05, box, truffles, Math.min(10 * s, gap), rand);
  // The truffles are where they fell, so the first few are as good as any.
  const piles: Pile[] = truffles.slice(0, look.hidden).map((t, i) => ({ x: t.x, y: t.y, r: t.r * PILE, truffle: i }));
  const covered = truffles.map((t, i) => (i < look.hidden ? { ...t, r: t.r * PILE } : t));
  for (const p of place(look.piles, r * PILE, box, [...covered, ...decoys], gap, rand)) piles.push({ ...p, truffle: null });
  return { truffles, decoys, piles };
}

// ---- The pig ------------------------------------------------------------------

export const PIG = {
  len: 58, // dp nose to tail, before the UI scale
  speed: 170, // dp a second, before the UI scale, unless a round sets its own
  minWalk: 0.28, // s, however near
  eatAt: 0.18, // s into the snuffle, the truffle goes
  rest: 0.56, // s from arriving to setting off for the next
};

// Where the pig stops for spot `t`, coming from `from`: its snout at the
// truffle's edge, facing it (Pig.tsx draws its 62 × 44 grid, the snout 27
// units ahead of the middle).
export function standAt(from: Point, t: Spot, s: number): Point & { dir: 1 | -1 } {
  const k = (PIG.len * s) / 62;
  const dir: 1 | -1 = t.x >= from.x ? 1 : -1;
  return { x: t.x - dir * (t.r * 0.6 + 27 * k), y: t.y + 7 * k, dir };
}

// ---- Scent ----------------------------------------------------------------------

// A pile over a truffle sends up a wisp every so often: every `near` s with
// the pig beside it, slowing to `far(e)` s (fainter, too, index.tsx Scent)
// once the pig is `range` dp away or more (before the UI scale).
export const SCENT = { near: 0.8, far: (e: number) => 1.4 + 2 * e, range: 160 };
const clamp = (v: number) => Math.max(0, Math.min(1, v));
export const nearness = (d: number, s: number) => 1 - clamp(d / (SCENT.range * s));
export const scentEvery = (d: number, e: number, s: number) => SCENT.far(e) + (SCENT.near - SCENT.far(e)) * nearness(d, s);

// ---- How long it takes ----------------------------------------------------------

// Two players. A steady one looks the field over, then taps each truffle as
// they spot it, the nearest to the last next, and the piles last: watching
// each for a while to be sure of its scent, and now and then sending the pig
// to an empty one first. A quick one spots them faster, taps them in the
// pig's best order (nearest to where it'll be next), reads a pile's scent
// from the first wisp or so, and never tries an empty one.
export type Player = { look: number; spot: (e: number) => number; scent: number; wrong: number; plan: boolean };
export const PLAYERS: { steady: Player; quick: Player } = {
  steady: { look: 1.2, spot: (e) => 0.6 + 0.8 * e, scent: 1.5, wrong: 0.4, plan: false },
  quick: { look: 0.6, spot: (e) => 0.3 + 0.4 * e, scent: 0.6, wrong: 0, plan: true },
};

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

// `ids` in nearest-next order, from `from`.
function nearestNext(ids: number[], at: (i: number) => Point, from: Point): number[] {
  const left = [...ids];
  const out: number[] = [];
  let here = from;
  while (left.length) {
    let best = 0;
    for (let k = 1; k < left.length; k++) if (dist(here, at(left[k])) < dist(here, at(left[best]))) best = k;
    out.push(left[best]);
    here = at(left[best]);
    left.splice(best, 1);
  }
  return out;
}

// Seconds from the clock starting to the last truffle eaten, for player `p`,
// the pig setting off from `start` at `speed` dp a second; `e` the round's
// difficulty, `s` the UI scale.
export function clearTime(lay: Layout, start: Point, speed: number, e: number, s: number, p: Player): number {
  const { truffles, piles } = lay;
  const v = speed * s;
  const under = new Set(piles.filter((q) => q.truffle !== null).map((q) => q.truffle!));
  const empties = piles.filter((q) => q.truffle === null);
  const ids = truffles.map((_, i) => i);
  const seen = ids.filter((i) => !under.has(i));
  const hid = ids.filter((i) => under.has(i));
  const at = (i: number) => truffles[i];
  const order = p.plan
    ? nearestNext(ids, at, start)
    : (() => {
        const first = nearestNext(seen, at, start);
        return [...first, ...nearestNext(hid, at, first.length ? at(first[first.length - 1]) : start)];
      })();

  // When each is tapped: the ones in sight one a spot apart, a pile once its
  // scent's been read (from where the pig will be before it).
  const taps: number[] = [];
  let last = p.look;
  let prev: Point = start;
  for (const i of order) {
    const read = p.look + p.scent * scentEvery(dist(prev, at(i)), e, s);
    last = under.has(i) ? Math.max(last + p.spot(e), read) : last + p.spot(e);
    taps.push(last);
    prev = at(i);
  }

  // The pig: off to each once it's free and it's been tapped; a wrong pile
  // first, as often as `wrong`, costs the walk there and on, and a snuffle.
  let free = 0;
  let pos: Point = start;
  let done = 0;
  order.forEach((i, k) => {
    const t = at(i);
    const to = standAt(pos, t, s);
    let walk = Math.max(PIG.minWalk, dist(pos, to) / v);
    if (under.has(i) && p.wrong && empties.length) {
      const e0 = empties.reduce((a, b) => (dist(pos, a) < dist(pos, b) ? a : b));
      const via = standAt(pos, { ...e0, r: e0.r / PILE }, s); // sent as to a truffle there (index.tsx)
      const astray = Math.max(PIG.minWalk, dist(pos, via) / v) + PIG.rest + Math.max(PIG.minWalk, dist(via, standAt(via, t, s)) / v) - walk;
      walk += p.wrong * astray;
    }
    const arrive = Math.max(free, taps[k]) + walk;
    free = arrive + PIG.rest;
    pos = to;
    done = arrive + PIG.eatAt;
  });
  return done;
}

// ---- Fitting a field to its clock -----------------------------------------------

// The layout a round's field uses, and the pig's speed on it: tried from
// `look.seed` on, the first where a steady player, at a speed within REACH
// of `speed`, is done `spare` s before `clock` runs out (as near as SLACK);
// failing that, the nearest. Laid out where it's drawn (FieldFrame's box),
// so it fits the phone it's on.
const REACH = [0.85, 1.2]; // of the round's speed
const SLACK = 0.3; // s
const TRIES = 30;

export function fit(box: Box, look: Look, s: number, start: Point, clock: number, spare: number, speed: number) {
  const want = clock - spare;
  let best = { seed: look.seed, speed, miss: Infinity };
  for (let i = 0; i < TRIES; i++) {
    const seed = (look.seed + i * 7919) % 2 ** 31;
    const lay = layout(box, { ...look, seed }, s);
    const time = (v: number) => clearTime(lay, start, v, look.e, s, PLAYERS.steady);
    let lo = speed * REACH[0];
    let hi = speed * REACH[1];
    // Slower is longer: the speed that takes `want`, or the end of the reach nearest it.
    if (time(lo) < want) hi = lo;
    else if (time(hi) > want) lo = hi;
    else {
      for (let k = 0; k < 20; k++) {
        const mid = (lo + hi) / 2;
        if (time(mid) > want) lo = mid;
        else hi = mid;
      }
    }
    const v = (lo + hi) / 2;
    const miss = Math.abs(time(v) - want);
    if (miss < best.miss) best = { seed, speed: v, miss };
    if (miss <= SLACK) break;
  }
  return { seed: best.seed, speed: best.speed };
}
