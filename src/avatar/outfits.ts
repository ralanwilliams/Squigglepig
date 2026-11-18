import { EYES, SLOTS, carried } from '../theme/skins/layout';
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
// Something held (the magic wand) is carried the way the long guns are
// (layout.ts carried): gripped in the pig's left hoof at the hold slot a
// theme's held things use, at the guns' angle (level across the belly on
// Home's pig, pointing down across it on the winner's), the forearm drawn
// again over the grip so a dark stick reads as in the hoof, not lost in it;
// only on a pig with its hooves free (Home's, the winner's), as for the
// theme's. A reward id with no entry here shows nothing.
export type Outfit = { prop: PropName; on: (art: ArtName) => Placement[] };

const hat = (prop: PropName): Outfit => ({ prop, on: (art) => (SLOTS[art].head ? [{ prop, ...SLOTS[art].head }] : []) });

// The sunglasses, of the shield sunglasses' width.
const SHADES = 0.15 / 0.19;
const glasses = (prop: PropName): Outfit => ({
  prop,
  on: (art) => {
    const eyes = EYES[art];
    return eyes ? [{ prop, ...eyes, w: eyes.w * SHADES }] : [];
  },
});

const NECK: Partial<Record<ArtName, Omit<Placement, 'prop'>>> = {
  home: { x: 0.335, y: 0.49, w: 0.17, rotate: -4 },
  winner: { x: 0.25, y: 0.485, w: 0.15, rotate: -8 },
};
const neck = (prop: PropName): Outfit => ({ prop, on: (art) => (NECK[art] ? [{ prop, ...NECK[art] }] : []) });

// Carried as the repeater is (the same angle on each art), shorter than a gun.
const WAND_W = 0.3; // of the image's width, tip to end
const hand = (prop: PropName): Outfit => ({
  prop,
  on: (art) => {
    // Only on the pigs with free hooves, as wearsAll (avatar.ts) has it.
    if (art !== 'home' && art !== 'winner') return [];
    const [thing, ...arm] = carried(prop, art);
    return thing ? [{ ...thing, w: WAND_W }, ...arm] : [];
  },
});

export const OUTFITS: Record<string, Outfit> = {
  'outfit.crown': hat('crown'),
  'outfit.topHat': hat('topHat'),
  'outfit.cowboyHat': hat('cowboyHat'),
  'outfit.chefHat': hat('chefHat'),
  'outfit.shades': glasses('shades'),
  'outfit.bowTie': neck('bowTie'),
  'outfit.magicWand': hand('magicWand'),
};

// Where outfit `id` goes on `art`: nothing, or its placements (something
// held comes with the hoof drawn over it).
export const outfitOn = (id: string, art: ArtName): Placement[] => OUTFITS[id]?.on(art) ?? [];
