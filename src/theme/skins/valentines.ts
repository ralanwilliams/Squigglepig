import { SLOTS, dress } from './layout';
import type { ArtName, Placement, Skin } from './types';

// Width ÷ height of each drawing of the pig, to turn an offset measured in
// widths into a fraction of the image's height.
const ASPECT: Partial<Record<ArtName, number>> = {
  home: 954 / 900,
  join: 954 / 900,
  lobby: 954 / 900,
  cell: 954 / 903,
  waiting: 480 / 442,
  winner: 480 / 456,
  canvasPig: 737 / 363,
};

// The quiver on each pig's back, placed from its head slot (the point between
// its eyes, and the head's size): on the stills it sits behind the head's
// upper left (the viewer's left), leaning out so the arrows clear the
// shoulder. Offsets are in
// still-image widths and scale with each pig.
function withQuiver(decor: Skin['decor']): Skin['decor'] {
  for (const [art, aspect] of Object.entries(ASPECT) as [ArtName, number][]) {
    const head = SLOTS[art].head;
    if (!head) continue;
    const k = head.w / 0.3; // this pig's size against the stills'
    const quiver: Placement = { prop: 'quiver', x: head.x - 0.2 * k, y: head.y + 0.11 * k * aspect, w: 0.12 * k, rotate: -22, flip: true };
    decor[art] = [quiver, ...(decor[art] ?? [])];
  }
  return decor;
}

// Valentine's Day: blush pink by day, deep wine by night; the pig as Cupid, a
// quiver of arrows on its back and a bow in its hoof, hearts floating up.
// Every text pair meets WCAG AA (4.5:1, 3:1 for large bold text);
// `node previews/_check-contrast.mjs` checks every skin.
export const valentines: Skin = {
  id: 'valentines',
  label: 'Valentine\'s Day',
  season: { from: [2, 7], to: [2, 14] },

  light: {
    background: '#FBDDE3',
    accent: '#B0123F',
    text: '#2A0A14',
    textMuted: '#5A2433',
    surfaceText: '#2A0A14',
    surfaceInset: '#FDEFF2',
    overlay: 'rgba(42,10,20,0.86)',
    overlayLabel: '#FFB3C6',
    button: 'rgba(176,18,63,0.92)',
    buttonPressed: '#7A0B2B',
    link: '#8A0F33',
    success: '#0B4A12',
    shadow: '#8A0F33',
    divider: 'rgba(42,10,20,0.22)',
  },

  dark: {
    background: '#22080F',
    accent: '#FF7A9C',
    accentText: '#2A0010',
    text: '#FBEAF0',
    textMuted: '#D1A9B6',
    surface: '#3A1420',
    surfaceBorder: '#5A2433',
    surfaceText: '#FBEAF0',
    surfaceInset: '#2C0C16',
    overlay: '#401826',
    overlayText: '#FBEAF0',
    overlayLabel: '#FFB3C6',
    button: '#B0123F',
    buttonPressed: '#CC2A57',
    link: '#FF9EB8',
    placeholder: '#B08A97',
    divider: 'rgba(251,234,240,0.22)',
  },

  decor: withQuiver(dress({ sky: ['heartRed', 'heartPink'], hold: 'cupidBow' })),
  trough: ['cupidBow'],
};
