import { PROPS, type PropName } from './props';
import type { ArtName, Placement, Skin } from './types';

// Where props go on each piece of artwork, measured once and shared by every
// skin that dresses the pig the usual way: something on its head, three
// things in the sky beside it, one held in its hoof. A skin names the props;
// dress() puts them in place on all seven images.
//
// Fractions of the light-mode image. The head slot is where a hat's anchor
// (the middle of its band) goes: midway between the pig's eyes, at the top of
// its head, tilted with it; `w` is the width a 100-unit hat is drawn at.
// The hold slot is the pig's left hoof (the viewer's left): a held prop's
// grip (its anchor: a stem, a bow, a handle) goes there, swung by `rotate`
// where it would cover what the other hoof holds; then the hoof itself is
// redrawn on top (HOOVES), so it wraps round the grip. The drawing-screen pig
// (canvasPig) is only a head behind a card, so it gets a hat and the sky
// props but holds nothing.
type Slot = { x: number; y: number; w: number; rotate?: number };

const STILL_HEAD: Slot = { x: 0.311, y: 0.12, w: 0.3, rotate: -10 };
// How far the tallest hat in the head slot reaches above the top of the
// still art (Home's, the join art), of its height: New Year's and the
// birthday's party hats, 18.4% with their outline and dark-mode rim. A crop
// of the art that's to show any hat whole starts this far above it (the
// reward podium's pigs, PigBoard.tsx).
export const HAT_ROOM = 0.19;
const STILL_SKY: Slot[] = [
  { x: 0.8, y: 0.13, w: 0.22 },
  { x: 0.66, y: 0.33, w: 0.14 },
  { x: 0.9, y: 0.42, w: 0.12 },
];
const STILL_HOLD: Slot = { x: 0.162, y: 0.672, w: 0.2 };

export const SLOTS: Record<ArtName, { head?: Slot; sky: Slot[]; hold?: Slot }> = {
  home: { head: STILL_HEAD, sky: STILL_SKY, hold: STILL_HOLD },
  // On the sign and the phone the prop swings out to the left, clear of them.
  join: { head: STILL_HEAD, sky: STILL_SKY, hold: { x: 0.18, y: 0.665, w: 0.15, rotate: 14 } },
  lobby: { head: STILL_HEAD, sky: STILL_SKY, hold: { x: 0.18, y: 0.665, w: 0.15, rotate: 14 } },
  cell: { head: STILL_HEAD, sky: STILL_SKY, hold: { x: 0.215, y: 0.585, w: 0.14, rotate: 18 } },
  waiting: {
    head: { x: 0.486, y: 0.321, w: 0.21, rotate: -10 },
    sky: [
      { x: 0.84, y: 0.3, w: 0.14 },
      { x: 0.88, y: 0.48, w: 0.09 },
      { x: 0.73, y: 0.18, w: 0.1 },
    ],
    hold: { x: 0.39, y: 0.75, w: 0.14 },
  },
  winner: {
    head: { x: 0.314, y: 0.122, w: 0.24, rotate: -10 },
    sky: [
      { x: 0.85, y: 0.1, w: 0.17 },
      { x: 0.63, y: 0.07, w: 0.1 },
      { x: 0.91, y: 0.48, w: 0.1 },
    ],
    hold: { x: 0.162, y: 0.672, w: 0.17 },
  },
  canvasPig: {
    head: { x: 0.503, y: 0.27, w: 0.26, rotate: -8 },
    sky: [
      { x: 0.88, y: 0.22, w: 0.16 },
      { x: 0.77, y: 0.07, w: 0.1 },
      { x: 0.93, y: 0.55, w: 0.1 },
    ],
  },
  icon: { sky: [] }, // the app icon in the menu is never dressed
};

// Over the pig's eyes on each piece of art: the middle of a pair of glasses
// on the point midway between them, measured from the art (the stills share
// one drawing of the pig, the phone art sits a little lower, and the
// drawing-screen pig's head is tilted). `w` is the width the shield
// sunglasses are drawn at (props.ts visor); a smaller pair is drawn smaller
// (src/avatar/outfits.ts).
const STILL_EYES: Slot = { x: 0.3085, y: 0.1765, w: 0.21 };
export const EYES: Partial<Record<ArtName, Slot>> = {
  home: STILL_EYES,
  join: STILL_EYES,
  lobby: STILL_EYES,
  cell: { x: 0.308, y: 0.207, w: 0.19, rotate: -2 },
  waiting: { x: 0.487, y: 0.369, w: 0.15, rotate: -4 },
  winner: { x: 0.316, y: 0.18, w: 0.19, rotate: -4 },
  canvasPig: { x: 0.5035, y: 0.383, w: 0.175, rotate: -10 },
};

const TILTS = [0, 8, -10];

// The pig's left hoof on each piece of art, where it was traced from (props.ts
// hoofStill and friends), to redraw over whatever it holds.
const HOOVES: Partial<Record<ArtName, Placement>> = {
  home: { prop: 'hoofStill', x: 0.1646, y: 0.6672, w: 0.0797 },
  join: { prop: 'hoofSign', x: 0.1646, y: 0.6472, w: 0.0692 },
  lobby: { prop: 'hoofSign', x: 0.1646, y: 0.6472, w: 0.0692 },
  cell: { prop: 'hoofPhone', x: 0.2013, y: 0.5742, w: 0.0734 },
  waiting: { prop: 'hoofWaiting', x: 0.3896, y: 0.7443, w: 0.05 },
  winner: { prop: 'hoofWinner', x: 0.1646, y: 0.6667, w: 0.0792 },
};

// `prop` in the pig's left hoof on `art`: the prop at the hold slot, then the
// hoof over its grip. Nothing on art with no hold slot.
export function held(prop: PropName, art: ArtName): Placement[] {
  const slot = SLOTS[art].hold;
  const hoof = HOOVES[art];
  return slot && hoof ? [{ prop, ...slot, rim: false }, hoof] : [];
}

// A sky prop: by name (it bobs), or with options (`twinkle` for fireworks).
type SkyProp = PropName | { prop: PropName; twinkle?: boolean; flip?: boolean };

export function dress({ head, sky = [], hold }: { head?: PropName; sky?: SkyProp[]; hold?: PropName }): Skin['decor'] {
  const decor: Skin['decor'] = {};
  for (const [art, slots] of Object.entries(SLOTS) as [ArtName, (typeof SLOTS)[ArtName]][]) {
    const list: Placement[] = [];
    // The slot's w is for a 100-unit-wide hat; a wider or narrower prop is drawn at the same scale.
    if (head && slots.head) list.push({ prop: head, ...slots.head, w: (slots.head.w * PROPS[head].w) / 100 });
    slots.sky.forEach((slot, i) => {
      // A skin naming fewer sky props than there are slots repeats them.
      const s = sky[i % Math.max(1, sky.length)];
      if (!s) return;
      const o = typeof s === 'string' ? { prop: s } : s;
      const still = 'twinkle' in o && o.twinkle;
      // Alternate sides and tilts, so repeats of a prop don't look stamped.
      list.push({ ...slot, prop: o.prop, bob: !still, twinkle: !!still, flip: ('flip' in o && o.flip) || i % 2 === 1, rotate: TILTS[i % TILTS.length] });
    });
    if (hold) list.push(...held(hold, art));
    if (list.length) decor[art] = list;
  }
  return decor;
}
