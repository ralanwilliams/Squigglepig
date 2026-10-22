import { easterSunday, shift } from './dates';
import { dress } from './layout';
import type { ArtName, Placement, Skin } from './types';

// The bunny-ear outlines (props.ts earsStill …), where each was traced: the
// stills share one drawing of the pig (the phone art is 3 px taller).
const STILL = { prop: 'earsStill', x: 0.3108, w: 0.4874 } as const;
const EARS: Partial<Record<ArtName, Placement>> = {
  home: { ...STILL, y: 0.0778 },
  join: { ...STILL, y: 0.0778 },
  lobby: { ...STILL, y: 0.0778 },
  cell: { ...STILL, y: 0.0775 },
  waiting: { prop: 'earsWaiting', x: 0.4813, y: 0.2975, w: 0.3792 },
  winner: { prop: 'earsWinner', x: 0.3125, y: 0.0779, w: 0.4958 },
  canvasPig: { prop: 'earsCanvas', x: 0.5095, y: 0.1474, w: 0.4464 },
};

function withEars(decor: Skin['decor']): Skin['decor'] {
  for (const [art, ears] of Object.entries(EARS) as [ArtName, Placement][]) decor[art] = [ears, ...(decor[art] ?? [])];
  return decor;
}

// Easter: lavender by day, a violet night; the pig's ears outlined in white
// like a bunny's, butterflies about, a basket of painted eggs in its hoof.
// The week before Easter Sunday, and the Monday after.
// Every text pair meets WCAG AA (4.5:1, 3:1 for large bold text);
// `node previews/_check-contrast.mjs` checks every skin.
export const easter: Skin = {
  id: 'easter',
  label: 'Easter',
  season: (year) => ({ from: shift(year, easterSunday(year), -7), to: shift(year, easterSunday(year), 1) }),

  light: {
    background: '#DCD0F2',
    accent: '#A0306A',
    text: '#1C1530',
    textMuted: '#3F3560',
    surfaceText: '#1C1530',
    surfaceInset: '#F4F0FB',
    overlay: 'rgba(28,21,48,0.86)',
    overlayLabel: '#FFD2E6',
    button: 'rgba(94,60,160,0.92)',
    buttonPressed: '#3E2478',
    link: '#43287F',
    success: '#0B4A12',
    shadow: '#43287F',
    divider: 'rgba(28,21,48,0.22)',
  },

  dark: {
    background: '#17132A',
    accent: '#F9A8D4',
    accentText: '#2A0A1C',
    text: '#F1EDFA',
    textMuted: '#B9B0D6',
    surface: '#262043',
    surfaceBorder: '#3D3566',
    surfaceText: '#F1EDFA',
    surfaceInset: '#1D1836',
    overlay: '#2B244C',
    overlayText: '#F1EDFA',
    overlayLabel: '#FFD2E6',
    button: '#5E3CA0',
    buttonPressed: '#7452BA',
    link: '#C9B8FF',
    placeholder: '#998FBA',
    divider: 'rgba(241,237,250,0.22)',
  },

  decor: withEars(dress({ sky: ['butterfly', 'butterfly'], hold: 'eggBasket' })),
  // Loose painted eggs, tumbling in.
  trough: ['eggPink', 'eggLavender', 'eggBerry', 'eggPurple', 'eggBlush'],
};
