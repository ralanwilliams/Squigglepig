import { SLOTS } from '../theme/skins/layout';
import type { Placement } from '../theme/skins';
import type { PropName } from '../theme/skins/props';

// Where each outfit (src/rewards/catalog.ts, kind 'outfit') sits on the winner
// art, by reward id: hats in the head slot the seasonal hats use
// (layout.ts SLOTS), sunglasses over the eyes, the bow tie under the chin,
// clear of the trumpet. Fractions of the light-mode image, as everywhere in
// src/theme/skins. The art is in props.ts.
//
// An outfit only ever shows on the winner art (the scoreboard, the Your pig
// screen); a reward id with no entry here shows nothing.
const head = SLOTS.winner.head!;
const hat = (prop: PropName): Placement => ({ prop, ...head });

export const OUTFITS: Record<string, Placement> = {
  'outfit.crown': hat('crown'),
  'outfit.topHat': hat('topHat'),
  'outfit.cowboyHat': hat('cowboyHat'),
  'outfit.chefHat': hat('chefHat'),
  'outfit.shades': { prop: 'shades', x: 0.316, y: 0.18, w: 0.15, rotate: -4 },
  'outfit.bowTie': { prop: 'bowTie', x: 0.25, y: 0.485, w: 0.15, rotate: -8 },
};
