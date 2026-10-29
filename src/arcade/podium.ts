import { HAT_ROOM, SLOTS } from '../theme/skins/layout';
import { PROPS, type Prop, type PropName } from '../theme/skins/props';
import type { Placement } from '../theme/skins';
import { OUTFITS } from '../avatar/outfits';
import { LADDER, type Prize } from './engine';
import { rng } from './rng';

// The reward podium (RewardPodium.tsx) as plain data, so the previews draw
// exactly the same pigs (previews/_build-skins.mjs).
//
// First place in the middle, second on its left, third on its right. On each
// step stands the join art's pig, which holds up a sign, the "Join Game" on
// it covered by a card showing the wins in a row the tier takes (props.ts
// signCard). The pig in first place is the player's (RewardPodium.tsx); the
// other two wear a hat each (HATS, hatOn). Fractions of the light-mode image,
// as everywhere in src/theme/skins.

// The pig and its tail (the curl that makes the wordmark's S), with room
// above for the tallest hat (layout.ts HAT_ROOM) and its feet a little
// below. RewardPodium clips the art to it. The right
// edge, x 0.665, is short of the "quigglepig" (it starts at 0.673,
// measured) by more than Logo's rounding can move the art at podium size
// (half a dp), so none of the q shows wherever a pig lands; the tail's tip,
// which curls over to meet it, is cut off too.
export const PODIUM_PIG = { x: -0.02, y: -HAT_ROOM, w: 0.685, h: 1.02 + HAT_ROOM };

// The face of the sign the join art's pig holds, measured from the image.
const SIGN = { x: 0.3215, y: 0.658, w: 0.219 };
const HEAD = SLOTS.join.head!;

// The hats the pigs in second and third place wear, picked at random each
// time: the hats a player can win (src/avatar/outfits.ts), so they show off
// what's to be had.
export const HATS = Object.values(OUTFITS)
  .map((o) => o.prop)
  .filter((prop) => !!(PROPS[prop] as Prop).head);

// A hat on a podium pig. As layout.ts dress(): the slot's w is for a
// 100-unit-wide hat.
export const hatOn = (hat: PropName): Placement => ({ prop: hat, ...HEAD, w: (HEAD.w * PROPS[hat].w) / 100 });

const signed = (won: number): Placement[] => [{ prop: 'signCard', ...SIGN, text: String(won) }];

// The podium is marble: veins wander across each face, down and to the
// right, most of them grey, some white; every other one a hairline, and the
// grey ones that aren't fork once or twice, a short branch splitting off.
// Fixed, seeded, so the podium looks the same every time and the previews
// draw the same marble. Points are fractions of the face (0 … 1, a little
// past the edges so a vein runs off it), `w` the vein's width in dp.
export type Vein = { pts: [number, number][]; w: number; light: boolean };

const at = (v: number) => Math.round(v * 1000) / 1000;

// A vein from (x, y) heading `a` (radians below the horizontal), wandering,
// until it leaves the face or has taken `steps` steps.
function wander(r: () => number, x: number, y: number, a: number, rise: number, steps: number) {
  const pts: [number, number][] = [[at(x), at(y)]];
  while (x < 1.05 && y < 1.05 && y > -0.1 && pts.length <= steps) {
    a = Math.max(-0.4, Math.min(1.1, a + (r() - 0.5) * 0.8));
    x += Math.cos(a) * 0.12;
    y += Math.sin(a) * 0.12 * rise; // a wide face: steeper across its height
    pts.push([at(x), at(y)]);
  }
  return pts;
}

function veins(seed: number, n: number, rise: number): Vein[] {
  const r = rng(seed);
  const out: Vein[] = [];
  for (let i = 0; i < n; i++) {
    const light = i % 3 === 2;
    const hair = i % 2 === 1;
    // In from the left edge or the top, then down and across.
    const left = r() < 0.5;
    const pts = wander(r, left ? -0.05 : r() * 0.8, left ? r() * 0.9 : -0.05, 0.25 + r() * 0.6, rise, 16);
    const w = light ? 0.5 + r() * 0.5 : hair ? 0.3 + r() * 0.3 : 0.6 + r() * 1;
    out.push({ pts, w: at(w), light });
    if (light || hair) continue;
    for (let k = 1 + Math.floor(r() * 2); k > 0 && pts.length > 3; k--) {
      const [x, y] = pts[1 + Math.floor(r() * (pts.length - 2))];
      out.push({ pts: wander(r, x, y, (r() - 0.5) * 1.6, rise, 3 + Math.floor(r() * 4)), w: at(w * 0.45), light });
    }
  }
  return out;
}

// The base's veins: a long, low slab, so they run flatter.
export const BASE_VEINS = veins(7, 12, 1.2);

// `rise` is each step's height, as a share of first place's.
const STEPS: { prize: Prize; rise: number; seed: number }[] = [
  { prize: 'rare', rise: 0.72, seed: 3 },
  { prize: 'premium', rise: 1, seed: 11 },
  { prize: 'common', rise: 0.5, seed: 5 },
];

export const PODIUM = STEPS.map(({ prize, rise, seed }) => {
  const step = LADDER.find((s) => s.prize === prize)!;
  return { prize, label: step.label, won: step.won, rise, first: rise === 1, decor: signed(step.won), veins: veins(seed, 9, 2.4) };
});
