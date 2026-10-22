// The prompts screen's trough (src/components/Trough.tsx), filled with the
// season's props instead of mud: a slot fills each time the level would rise,
// bottom row first, centre outwards, until the last few heap up over the rim;
// once it's full a shower of extras packs it to the brim. Each prop drops in
// and lands any which way. In the trough's own drawing units (400 × 168, the
// cavity y 52 → 128).

// How big each prop is drawn: about TROUGH_ITEM units across, by its area,
// so slim ones (rockets, bottles) don't come out thin as matchsticks, though
// never longer than 1.25 × TROUGH_ITEM.
export const TROUGH_ITEM = 46;
export const troughScale = (w: number, h: number) => TROUGH_ITEM / Math.max(0.8 * Math.max(w, h), Math.sqrt(w * h));

// A spot in the pile. Rows inside the trough are clipped to its cavity; the
// heap sits on top of the rim, unclipped. `v` picks from the skin's list of
// props (v modulo its length).
export type TroughSlot = { x: number; y: number; rotate: number; v: number; heap?: true };

// A fixed scatter (0 → 1) for slot i, so a "random" pile is the same on every
// render and every phone.
const scatter = (i: number, k: number) => {
  const n = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return n - Math.floor(n);
};

// Rows of spots, knocked about — a few units off, tumbled to any angle, the
// kind of prop picked at random — so props land haphazardly, not in rows.
type Row = { y: number; xs: number[]; heap?: true };
const knocked = (rows: Row[], from: number): TroughSlot[] =>
  rows
    .flatMap(({ y, xs, heap }) => xs.map((x) => ({ x, y, heap })))
    .map(({ x, y, heap }, j) => {
      const i = from + j;
      return {
        x: Math.round(x + (scatter(i, 1) - 0.5) * 14),
        y: Math.round(y + (scatter(i, 2) - 0.5) * 8),
        rotate: Math.round((scatter(i, 3) - 0.5) * 90),
        v: Math.floor(scatter(i, 4) * 60),
        ...(heap ? { heap } : {}),
      };
    });

// Fill order: the bottom row from the middle out, the row above, then the heap.
export const TROUGH_SLOTS: TroughSlot[] = knocked(
  [
    { y: 107, xs: [200, 155, 245, 110, 290] },
    { y: 81, xs: [178, 221, 135, 264, 92, 307] },
    { y: 55, xs: [172, 222, 122, 272], heap: true },
  ],
  0
);

// The shower once it's full: into the gaps between the rows, then a higher
// heap over the rim.
export const TROUGH_FLOOD: TroughSlot[] = knocked(
  [
    { y: 120, xs: [96, 132, 168, 204, 240, 276, 304] },
    { y: 94, xs: [112, 156, 200, 244, 288] },
    { y: 68, xs: [76, 114, 156, 200, 244, 286, 324] },
    { y: 40, xs: [146, 198, 250], heap: true },
  ],
  TROUGH_SLOTS.length
);

// What a falling prop is clipped to: the column of air above the trough (from
// `top` down to the rim) and the cavity below the rim, but not the rim's
// wooden band between them (y 40 → 52, plus its outline) — so a prop drops
// behind the rim into the trough, never across its sides or over its top.
export const troughShaft = (top: number) => `M62 ${top} H338 V38.5 H62 Z M62.4 53.5 H337.6 L318 128 H82 Z`;

// How many slots are full at `count` of `target`: in proportion, but all of
// them only once the trough really is full (so the shower never comes a prompt
// early) and at least one from the first prompt (so it never goes unseen).
export function troughFilled(count: number, target: number) {
  if (target <= 0 || count <= 0) return 0;
  if (count >= target) return TROUGH_SLOTS.length;
  return Math.min(TROUGH_SLOTS.length - 1, Math.max(1, Math.round((count / target) * TROUGH_SLOTS.length)));
}
