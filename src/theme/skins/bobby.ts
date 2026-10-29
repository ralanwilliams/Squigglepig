import { EYES, dress, held } from './layout';
import type { ArtName, Placement, Skin } from './types';

// The shield sunglasses (props.ts visor) over the pig's eyes on each piece of
// art (layout.ts EYES).
function withVisor(decor: Skin['decor']): Skin['decor'] {
  for (const [art, eyes] of Object.entries(EYES) as [ArtName, Omit<Placement, 'prop'>][]) decor[art] = [...(decor[art] ?? []), { ...eyes, prop: 'visor' }];
  return decor;
}

// The two-handed blaster (props.ts rifle): its grip in the pig's left hoof
// (the viewer's left) at the hold slot, with the hoof redrawn over it
// (layout.ts held). On the home art both hooves are free, so it lies level
// across the belly on the other hoof, the barrel just past the pig's side;
// on the winner and waiting art the other hoof is busy (the trumpet, the
// pencil), so it's carried low, pointing down across the belly. The join,
// lobby and phone art have both hooves on the sign or phone, so the pig
// holds no blaster there.
const RIFLE: Partial<Record<ArtName, Partial<Placement>>> = {
  home: { w: 0.61 },
  winner: { w: 0.5, rotate: 24 },
  waiting: { w: 0.3, rotate: 24 },
};

function withRifle(decor: Skin['decor']): Skin['decor'] {
  for (const [art, place] of Object.entries(RIFLE) as [ArtName, Partial<Placement>][]) {
    const [gun, ...hoof] = held('rifle', art);
    if (gun) decor[art] = [...(decor[art] ?? []), { ...gun, ...place }, ...hoof];
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
