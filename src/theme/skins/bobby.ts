import { EYES, LONG_GUN, carried, dress } from './layout';
import type { ArtName, Placement, Skin } from './types';

// The shield sunglasses (props.ts visor) over the pig's eyes on each piece of
// art (layout.ts EYES).
function withVisor(decor: Skin['decor']): Skin['decor'] {
  for (const [art, eyes] of Object.entries(EYES) as [ArtName, Omit<Placement, 'prop'>][]) decor[art] = [...(decor[art] ?? []), { ...eyes, prop: 'visor' }];
  return decor;
}

// The two-handed blaster (props.ts rifle), carried in both hooves where
// they're free (layout.ts carried), a little lower than the grip so it sits
// down in the hooves, under the forearm drawn over it: this much, of the
// image's height.
const LOWER = 0.02;

function withRifle(decor: Skin['decor']): Skin['decor'] {
  for (const art of Object.keys(LONG_GUN) as ArtName[]) {
    const [gun, ...arm] = carried('rifle', art);
    if (gun) decor[art] = [...(decor[art] ?? []), { ...gun, y: gun.y + LOWER }, ...arm];
  }
  return decor;
}

// Bobby, a theme won in solo play (src/rewards/catalog.ts theme.bobby): a
// neon city at night, and a pig with attitude. A neon-violet dusk by day, a
// deep indigo night; buttons in hot magenta, links in cyan glow. The pig in a
// pink mohawk and shield sunglasses, a two-handed blaster in its hooves;
// flying cars and a neon pig sign overhead; a trough full of microchips. No season: it shows
// once its owner chooses it, except while a birthday or holiday is showing
// over it (index.ts UNLOCKABLE).
// Every text pair meets WCAG AA (4.5:1, 3:1 for large bold text);
// `node previews/_check-contrast.mjs` checks every skin.
export const bobby: Skin = {
  id: 'bobby',
  label: 'Bobby',

  light: {
    background: '#A898F2',
    accent: '#86006E',
    text: '#120A2E',
    textMuted: '#251848',
    surfaceText: '#120A2E',
    surfaceInset: '#F1ECFF',
    overlay: 'rgba(16,10,40,0.9)',
    overlayLabel: '#2EF2E6',
    button: 'rgba(112,0,118,0.92)',
    buttonPressed: '#4E0052',
    link: '#2E0E6E',
    success: '#063A0C',
    shadow: '#2E0E6E',
    divider: 'rgba(18,10,46,0.22)',
  },

  dark: {
    background: '#140C2E',
    accent: '#FF4FD8',
    accentText: '#2A0026',
    text: '#F1EAFF',
    textMuted: '#B3A6D9',
    surface: '#22174A',
    surfaceBorder: '#3A2B70',
    surfaceText: '#F1EAFF',
    surfaceInset: '#1A1240',
    overlay: '#261A52',
    overlayText: '#F1EAFF',
    overlayLabel: '#2EF2E6',
    button: '#8E1590',
    buttonPressed: '#AC1DAE',
    link: '#2EF2E6',
    placeholder: '#9387BD',
    divider: 'rgba(241,234,255,0.22)',
  },

  decor: withRifle(withVisor(dress({ head: 'mohawk', sky: ['hoverCar', { prop: 'neonSign', twinkle: true }] }))),
  trough: ['chip'],
};
