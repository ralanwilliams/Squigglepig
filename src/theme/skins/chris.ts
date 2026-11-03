import { EYES, SLOTS, dress } from './layout';
import type { PropName } from './props';
import type { ArtName, Placement, Skin } from './types';

// The domino mask over the pig's eyes on each piece of art (layout.ts
// EYES), drawn this much narrower than the shield sunglasses there.
const MASK = 0.9;

// The emblem in the middle of his chest, below the chin and between the
// arms, on each piece of art where the chest is showing (the phone covers it
// on the cell art, and the drawing-screen pig is only a head). On the winner
// and waiting art it sits a little left of the trumpet and the pencil.
const CHEST: Partial<Record<ArtName, Omit<Placement, 'prop'>>> = {
  home: { x: 0.3, y: 0.575, w: 0.16 },
  join: { x: 0.3, y: 0.51, w: 0.12 },
  lobby: { x: 0.3, y: 0.51, w: 0.12 },
  winner: { x: 0.27, y: 0.615, w: 0.14 },
  waiting: { x: 0.475, y: 0.7, w: 0.075 },
};

// The cape behind him, its collar's middle on the point between his
// shoulders, as wide as he is (the cape props are drawn 210 units across, the
// pig's body 100 of them). The stills share one drawing of the pig; the
// waiting art's is smaller. The drawing-screen pig is only a head.
const SHOULDERS: Partial<Record<ArtName, Omit<Placement, 'prop'>>> = {
  home: { x: 0.31, y: 0.42, w: 1.26 },
  join: { x: 0.31, y: 0.42, w: 1.26 },
  lobby: { x: 0.31, y: 0.42, w: 1.26 },
  cell: { x: 0.31, y: 0.42, w: 1.26 },
  winner: { x: 0.31, y: 0.43, w: 1.3 },
  waiting: { x: 0.485, y: 0.6, w: 0.95 },
};

// What each of the hero's props turns into after dark (morph.ts).
const NIGHT: Partial<Record<PropName, PropName>> = {
  heroMask: 'villainMask',
  heroEmblem: 'villainEmblem',
  cloud: 'stormCloud',
  heroStar: 'bolt',
};

function villain(decor: Skin['decor']): Skin['decor'] {
  for (const art of Object.keys(SLOTS) as ArtName[]) {
    const eyes = EYES[art];
    const chest = CHEST[art];
    const shoulders = SHOULDERS[art];
    decor[art] = [
      ...(decor[art] ?? []),
      ...(eyes ? [{ ...eyes, w: eyes.w * MASK, prop: 'heroMask' as const }] : []),
      ...(chest ? [{ ...chest, prop: 'heroEmblem' as const }] : []),
      // It blows out in the wind on its way from one to the other.
      ...(shoulders ? [{ ...shoulders, prop: 'heroCape' as const, night: { prop: 'villainCape' as const, via: 'capeBlown' as const } }] : []),
    ].map((p) => (NIGHT[p.prop] ? { ...p, night: { prop: NIGHT[p.prop] } } : p));
    if (!decor[art]!.length) delete decor[art];
  }
  return decor;
}

// Chris, a theme won in solo play (src/rewards/catalog.ts theme.chris), for
// Chris Wells, who built the original Squigglepig (app/licenses.tsx): a
// superhero by day and a supervillain by night. By day a bright comic-book
// sky, red buttons and navy links; the pig is the hero, in a blue domino
// mask swept out at the ends, a gold-edged red shield with a pig's snout on his
// chest and a red cape behind him, clouds and gold stars overhead. By night a villain's lair in
// purple-black, purple buttons and acid-green links, and he's the villain:
// the mask black and swept into points, the emblem a black burst with
// glowing red nostrils, the cape purple and torn, storm clouds and bolts of
// lightning. When the light changes each prop morphs into the other
// (morph.ts), the cape blowing out in the wind on the way, to a sting: a
// villain's menace going dark, a hero's fanfare coming back (scripts/
// stings.py). A trough full of gold stars. No season: it shows once its
// owner chooses it, except while a birthday or holiday is showing over it
// (index.ts UNLOCKABLE).
// Every text pair meets WCAG AA (4.5:1, 3:1 for large bold text);
// `node previews/_check-contrast.mjs` checks every skin.
export const chris: Skin = {
  id: 'chris',
  label: 'Chris',

  light: {
    background: '#8FD0FA',
    accent: '#A3122A',
    text: '#0B1A3A',
    textMuted: '#1C2E55',
    surfaceText: '#0B1A3A',
    surfaceInset: '#F2F8FF',
    overlay: 'rgba(11,26,58,0.9)',
    overlayLabel: '#FFD23F',
    button: 'rgba(170,24,38,0.95)',
    buttonPressed: '#7E1420',
    link: '#0B2F7A',
    success: '#0E4A1A',
    shadow: '#123A6B',
    divider: 'rgba(11,26,58,0.22)',
  },

  dark: {
    background: '#120A1A',
    accent: '#8CFF4F',
    accentText: '#0E1A05',
    text: '#EFE6FA',
    textMuted: '#B3A3CC',
    surface: '#1F1430',
    surfaceBorder: '#3A2756',
    surfaceText: '#EFE6FA',
    surfaceInset: '#170F24',
    overlay: '#251838',
    overlayText: '#EFE6FA',
    overlayLabel: '#8CFF4F',
    button: '#6A1B9A',
    buttonPressed: '#8424BE',
    link: '#9CFF6B',
    placeholder: '#9384AE',
    divider: 'rgba(239,230,250,0.22)',
  },

  decor: villain(dress({ sky: ['cloud', { prop: 'heroStar', twinkle: true }, { prop: 'heroStar', twinkle: true }] })),
  trough: ['heroStar'],
  sounds: { dark: 'supervillain', light: 'superhero' },
};
