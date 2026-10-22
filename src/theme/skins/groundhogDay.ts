import { dress } from './layout';
import type { ArtName, Placement, Skin } from './types';

// The groundhog's stump, standing on the ground to the right of the pig (its
// base at the image's foot); on the drawing screen, where the pig is only a
// head behind a card, at the right edge just above the card.
const STUMP: Partial<Record<ArtName, Placement>> = {
  home: { prop: 'stumpGroundhog', x: 0.74, y: 0.985, w: 0.26 },
  join: { prop: 'stumpGroundhog', x: 0.74, y: 0.985, w: 0.26 },
  lobby: { prop: 'stumpGroundhog', x: 0.74, y: 0.985, w: 0.26 },
  cell: { prop: 'stumpGroundhog', x: 0.74, y: 0.985, w: 0.26 },
  waiting: { prop: 'stumpGroundhog', x: 0.79, y: 0.99, w: 0.19 },
  winner: { prop: 'stumpGroundhog', x: 0.8, y: 0.99, w: 0.21 },
  canvasPig: { prop: 'stumpGroundhog', x: 0.88, y: 0.86, w: 0.2 },
};

function withStump(decor: Skin['decor']): Skin['decor'] {
  for (const [art, stump] of Object.entries(STUMP) as [ArtName, Placement][]) decor[art] = [...(decor[art] ?? []), stump];
  return decor;
}

// Groundhog Day: a pale winter sky by day, a cold blue night; the pig in a
// knit beanie with a beer in its hoof, the groundhog popping out of a tree
// stump beside it.
// Every text pair meets WCAG AA (4.5:1, 3:1 for large bold text);
// `node previews/_check-contrast.mjs` checks every skin.
export const groundhogDay: Skin = {
  id: 'groundhogDay',
  label: 'Groundhog Day',
  season: { from: [2, 1], to: [2, 3] },

  light: {
    background: '#BFD9EA',
    accent: '#7A4A1E',
    text: '#14202A',
    textMuted: '#2F4555',
    surfaceText: '#14202A',
    surfaceInset: '#EEF5FA',
    overlay: 'rgba(20,32,42,0.86)',
    overlayLabel: '#FFD08A',
    button: 'rgba(38,78,116,0.92)',
    buttonPressed: '#1A3A58',
    link: '#1F4A6E',
    success: '#0B4A12',
    shadow: '#1F4A6E',
    divider: 'rgba(20,32,42,0.22)',
  },

  dark: {
    background: '#0F1A26',
    accent: '#E8A867',
    accentText: '#2A1400',
    text: '#E9F1F7',
    textMuted: '#A6B9C8',
    surface: '#1B2B3B',
    surfaceBorder: '#2F4659',
    surfaceText: '#E9F1F7',
    surfaceInset: '#142231',
    overlay: '#203347',
    overlayText: '#E9F1F7',
    overlayLabel: '#FFD08A',
    button: '#3C6E9E',
    buttonPressed: '#41749F',
    link: '#8CC4F0',
    placeholder: '#8EA2B3',
    divider: 'rgba(233,241,247,0.22)',
  },

  decor: withStump(dress({ head: 'beanie', hold: 'beerBottle' })),
  trough: ['beerBottle'],
};
