import { ASH_FIT, ASH_GRIPS } from './ashWear';
import { SLOTS, dress } from './layout';
import type { ArtName, Placement, Skin } from './types';

// The number on his jersey.
const NUMBER = '1';

// The cast round the ankle of his left leg (the viewer's right), from where
// the leg leaves his body to the top of the hoof, measured from the art.
// The stills share one drawing of the pig; the waiting art's is smaller.
const STILL_ANKLE = { x: 0.42, y: 0.908, w: 0.095 };
const ANKLE: Partial<Record<ArtName, Omit<Placement, 'prop'>>> = {
  home: STILL_ANKLE,
  join: STILL_ANKLE,
  lobby: STILL_ANKLE,
  cell: STILL_ANKLE,
  winner: STILL_ANKLE,
  waiting: { x: 0.568, y: 0.94, w: 0.065 },
};

// His crutches, gripped at the hoof (props.ts crutch), the pad up under his
// arm and the tip on the floor, his arms in front of them: ashWear.ts draws
// those arms again over the crutches, out at his sides, and the crutches go
// with their hooves (layout.ts followHooves). Each sits a little lower and further out than the hoof, so
// its pad tucks in under his arm, and leans out a little, its tip past his
// foot; on the home art the right one mirrors the left, as his arms do. In both hooves
// on the home art, where they're free; in the left (the viewer's left) on
// the winner and waiting art (the trumpet and the pencil are in the right);
// on the join, lobby and cell art both hooves are busy with the sign or the
// phone, so one stands propped against his side, clear of his arm.
const CRUTCH: Partial<Record<ArtName, number>> = { home: 0.076, winner: 0.076, waiting: 0.0575 };
const LEAN = 6; // degrees, the left one clockwise and the right one the other way
const DROP = 0.03; // how much lower than the hoof's grip, of the image's height
const OUT = 0.012; // and how much further out, of its width
const PROPPED: Placement = { prop: 'crutch', x: 0.035, y: 0.672, w: 0.076, rotate: 3, rim: false };

function crutches(art: ArtName): Placement[] {
  const w = CRUTCH[art];
  const grips = ASH_GRIPS[art];
  if (!w || !grips) return art === 'join' || art === 'lobby' || art === 'cell' ? [PROPPED] : [];
  return grips.map(([x, y], i) => ({ prop: 'crutch', x: x + (i ? OUT : -OUT), y: y + DROP, w, rotate: i ? -LEAN : LEAN, rim: false }));
}

// On each piece of art: his sweatband and jersey (traced to fit, ashWear.ts),
// his crutches, the arms that hold them, and the cast.
function player(decor: Skin['decor']): Skin['decor'] {
  for (const art of Object.keys(SLOTS) as ArtName[]) {
    const fit = (ASH_FIT[art] ?? []).map((p): Placement => (p.prop.startsWith('jersey') && !p.prop.startsWith('jerseyArms') ? { ...p, text: NUMBER } : p));
    const arms = fit.filter((p) => p.prop.startsWith('jerseyArms'));
    const ankle = ANKLE[art];
    decor[art] = [
      ...(decor[art] ?? []),
      ...fit.filter((p) => !arms.includes(p)),
      ...crutches(art),
      ...arms,
      ...(ankle ? [{ ...ankle, prop: 'ankleCast' as const }] : []),
    ];
    if (!decor[art]!.length) delete decor[art];
  }
  return decor;
}

// Ash, a theme won in solo play (src/rewards/catalog.ts theme.ash): a
// basketball player in red, black and white, out injured. An arena's white
// by day and black by night, the buttons red; the pig in a red sweatband
// under his ears and the team's jersey, a tank top with a pig on its chest
// and his number under it, traced to fit him (scripts/ash-wear.py), leaning
// on crutches with his ankle in a signed cast; a hoop and basketballs
// overhead, a trough full of basketballs. The team, its pig and its look are
// our own. No season: it shows once its owner chooses it, except while a
// birthday or holiday is showing over it (index.ts UNLOCKABLE).
// Every text pair meets WCAG AA (4.5:1, 3:1 for large bold text);
// `node previews/_check-contrast.mjs` checks every skin.
export const ash: Skin = {
  id: 'ash',
  label: 'Ash',

  light: {
    background: '#F3EEE7',
    accent: '#CE1141',
    text: '#111111',
    textMuted: '#333333',
    surfaceText: '#111111',
    surfaceInset: '#FFFFFF',
    overlay: 'rgba(17,17,17,0.92)',
    overlayLabel: '#FF5C78',
    button: 'rgba(196,15,58,0.96)',
    buttonPressed: '#8E0B2C',
    link: '#A00D33',
    success: '#14532D',
    shadow: '#3A0A16',
    divider: 'rgba(17,17,17,0.2)',
  },

  dark: {
    background: '#0D0D0D',
    accent: '#FF3B5C',
    accentText: '#1A0006',
    text: '#F5F5F5',
    textMuted: '#B8B8B8',
    surface: '#1C1C1C',
    surfaceBorder: '#333333',
    surfaceText: '#F5F5F5',
    surfaceInset: '#151515',
    overlay: '#222222',
    overlayText: '#F5F5F5',
    overlayLabel: '#FF5C78',
    button: '#B50F35',
    buttonPressed: '#D11541',
    link: '#FF6B85',
    placeholder: '#9A9A9A',
    divider: 'rgba(245,245,245,0.2)',
  },

  decor: player(dress({ sky: ['hoop', 'basketball', 'basketball'] })),
  trough: ['basketball'],
};
