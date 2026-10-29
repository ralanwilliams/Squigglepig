import { EYES, SLOTS } from '../theme/skins/layout';
import type { ArtName, Placement } from '../theme/skins';
import type { PropName } from '../theme/skins/props';

// Where each outfit (src/rewards/catalog.ts, kind 'outfit') sits on each piece
// of pig art, by reward id: hats in the head slot the seasonal hats use
// (layout.ts SLOTS), sunglasses over the eyes (layout.ts EYES, drawn smaller
// than the shield sunglasses there), the bow tie under the chin. Fractions of
// the light-mode image, as everywhere in src/theme/skins. The art is in
// props.ts.
//
// A player's pig wears its outfits on every pig in the app (avatar.ts
// avatarDecor). The bow tie only goes where there's a chin clear of the
// hooves: Home's pig, and the winner's, where it sits left of the trumpet.
// A reward id with no entry here shows nothing.
export type Outfit = { prop: PropName; on: (art: ArtName) => Placement | null };

const hat = (prop: PropName): Outfit => ({ prop, on: (art) => (SLOTS[art].head ? { prop, ...SLOTS[art].head } : null) });

// The sunglasses, of the shield sunglasses' width.
const SHADES = 0.15 / 0.19;
const glasses = (prop: PropName): Outfit => ({
  prop,
  on: (art) => {
    const eyes = EYES[art];
    return eyes ? { prop, ...eyes, w: eyes.w * SHADES } : null;
  },
});

const NECK: Partial<Record<ArtName, Omit<Placement, 'prop'>>> = {
  home: { x: 0.335, y: 0.49, w: 0.17, rotate: -4 },
  winner: { x: 0.25, y: 0.485, w: 0.15, rotate: -8 },
};
const neck = (prop: PropName): Outfit => ({ prop, on: (art) => (NECK[art] ? { prop, ...NECK[art] } : null) });

export const OUTFITS: Record<string, Outfit> = {
  'outfit.crown': hat('crown'),
  'outfit.topHat': hat('topHat'),
  'outfit.cowboyHat': hat('cowboyHat'),
  'outfit.chefHat': hat('chefHat'),
  'outfit.shades': glasses('shades'),
  'outfit.bowTie': neck('bowTie'),
};

// Where outfit `id` goes on `art`, if anywhere.
export const outfitOn = (id: string, art: ArtName): Placement | null => OUTFITS[id]?.on(art) ?? null;
