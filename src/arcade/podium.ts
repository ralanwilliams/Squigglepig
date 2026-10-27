import { SLOTS } from '../theme/skins/layout';
import { PROPS, type PropName } from '../theme/skins/props';
import type { Placement } from '../theme/skins';
import { LADDER, type Prize } from './engine';

// The reward podium (RewardPodium.tsx) as plain data, so the previews draw
// exactly the same pigs (previews/_build-skins.mjs).
//
// First place in the middle, second on its left, third on its right. On each
// step stands the join art's pig, which holds up a sign: dressed for its tier
// (a chef's hat, a top hat, a crown), with the "Join Game" on the sign
// covered by a card showing the wins in a row the tier takes (props.ts
// signCard). Fractions of the light-mode image, as everywhere in
// src/theme/skins.

// The pig and its tail (the curl that makes the wordmark's S), with room
// above for the tallest hat. RewardPodium clips the art to it. The right
// edge, x 0.665, is short of the "quigglepig" (it starts at 0.673,
// measured) by more than Logo's rounding can move the art at podium size
// (half a dp), so none of the q shows wherever a pig lands; the tail's tip,
// which curls over to meet it, is cut off too.
export const PODIUM_PIG = { x: -0.02, y: -0.16, w: 0.685, h: 1.18 };

// The face of the sign the join art's pig holds, measured from the image.
const SIGN = { x: 0.3215, y: 0.658, w: 0.219 };
const HEAD = SLOTS.join.head!;

function dressed(hat: PropName, won: number): Placement[] {
  return [
    // As layout.ts dress(): the slot's w is for a 100-unit-wide hat.
    { prop: hat, ...HEAD, w: (HEAD.w * PROPS[hat].w) / 100 },
    { prop: 'signCard', ...SIGN, text: String(won) },
  ];
}

// `rise` is each step's height, as a share of first place's.
const STEPS: { prize: Prize; rise: number; hat: PropName }[] = [
  { prize: 'rare', rise: 0.72, hat: 'topHat' },
  { prize: 'premium', rise: 1, hat: 'crown' },
  { prize: 'common', rise: 0.5, hat: 'chefHat' },
];

export const PODIUM = STEPS.map(({ prize, rise, hat }) => {
  const step = LADDER.find((s) => s.prize === prize)!;
  return { prize, label: step.label, won: step.won, rise, first: rise === 1, decor: dressed(hat, step.won) };
});
