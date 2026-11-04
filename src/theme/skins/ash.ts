import { ASH_FIT, ASH_GRIPS } from './ashWear';
import { SLOTS, dress, held } from './layout';
import type { ArtName, Placement, Skin } from './types';

// The number on his jersey.
const NUMBER = '1';

// By night he's out injured: the cast round the ankle of the leg on the
// viewer's left, from where the leg leaves his body to the top of the hoof,
// measured from the art, turned so its signature faces out; and his
// crutches. The stills share one drawing of the pig; the waiting art's is
// smaller.
const STILL_ANKLE = { x: 0.125, y: 0.908, w: 0.09, flip: true };
const ANKLE: Partial<Record<ArtName, Omit<Placement, 'prop'>>> = {
  home: STILL_ANKLE,
  join: STILL_ANKLE,
  lobby: STILL_ANKLE,
  cell: STILL_ANKLE,
  winner: STILL_ANKLE,
  waiting: { x: 0.348, y: 0.94, w: 0.06, flip: true },
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
// phone, so one stands propped against his side, clear of his arm. On the
// winner art his jersey's off (THROWN), so no arms are drawn again: the
// crutch is in his own hoof, drawn again over its grip (layout.ts held).
const CRUTCH: Partial<Record<ArtName, number>> = { home: 0.076, winner: 0.076, waiting: 0.0575 };
const LEAN = 6; // degrees, the left one clockwise and the right one the other way
const DROP = 0.03; // how much lower than the hoof's grip, of the image's height
const OUT = 0.012; // and how much further out, of its width
const PROPPED: Placement = { prop: 'crutch', x: 0.035, y: 0.672, w: 0.076, rotate: 3, rim: false };

function crutches(art: ArtName): Placement[] {
  const w = CRUTCH[art];
  if (art === 'winner' && w) {
    const [crutch, ...hoof] = held('crutch', art);
    return crutch ? [{ ...crutch, w, rotate: LEAN }, ...hoof] : [];
  }
  const grips = ASH_GRIPS[art];
  if (!w || !grips) return art === 'join' || art === 'lobby' || art === 'cell' ? [PROPPED] : [];
  return grips.map(([x, y], i) => ({ prop: 'crutch', x: x + (i ? OUT : -OUT), y: y + DROP, w, rotate: i ? -LEAN : LEAN, rim: false }));
}

// By day he's fit to play, a basketball in the hoof on the viewer's left
// (the hold slot), the hoof drawn again over it (layout.ts held), palming it from
// above: the ball's middle sits this far below the hoof, of the image's
// height, and is this wide, of its width. On the join, lobby and cell art
// both hooves are busy with the sign or the phone, so it rests on the floor
// by his foot instead, where the propped crutch stands by night.
const BALL: Partial<Record<ArtName, { w: number; drop: number }>> = {
  home: { w: 0.13, drop: 0.045 },
  winner: { w: 0.115, drop: 0.04 },
  waiting: { w: 0.07, drop: 0.025 },
};
const FLOOR_BALL: Placement = { prop: 'basketball', x: 0.05, y: 0.93, w: 0.09, rim: false };

function ball(art: ArtName): Placement[] {
  const size = BALL[art];
  if (!size) return art === 'join' || art === 'lobby' || art === 'cell' ? [FLOOR_BALL] : [];
  const [inHoof, ...hoof] = held('basketball', art);
  if (!inHoof) return [];
  return [{ ...inHoof, w: size.w, y: inHoof.y + size.drop, rotate: 0 }, ...hoof];
}

// On the winner art (the trumpet) he's celebrating: he's thrown his jersey
// off, and it's tossed through the air to land on the ground beside him,
// right of his feet, under the wordmark (SkinDecor.tsx `toss`). It's the
// jersey part on Your pig there too, so a player wearing it throws it.
const THROWN: Placement = { prop: 'jerseyThrown', x: 0.68, y: 0.915, w: 0.27, rotate: -8, toss: true, text: NUMBER };

const byDay = (p: Placement): Placement => ({ ...p, by: 'day' });
const byNight = (p: Placement): Placement => ({ ...p, by: 'night' });

// On each piece of art: his sweatband and jersey (traced to fit, ashWear.ts),
// the ball by day or the crutches by night, the arms that hold them, and the
// cast by night; on the winner art, his jersey thrown off. The ball goes
// first, so on Your pig the crutches are its night look (themeParts.ts
// partsOf).
function player(decor: Skin['decor']): Skin['decor'] {
  for (const art of Object.keys(SLOTS) as ArtName[]) {
    const fit = (ASH_FIT[art] ?? []).map((p): Placement => (p.prop.startsWith('jersey') && !p.prop.startsWith('jerseyArms') ? { ...p, text: NUMBER } : p));
    const arms = fit.filter((p) => p.prop.startsWith('jerseyArms'));
    const ankle = ANKLE[art];
    decor[art] = [
      ...(decor[art] ?? []),
      ...fit.filter((p) => !arms.includes(p)),
      ...ball(art).map(byDay),
      ...crutches(art).map(byNight),
      ...arms,
      ...(ankle ? [byNight({ ...ankle, prop: 'ankleCast' })] : []),
      ...(art === 'winner' ? [THROWN] : []),
    ];
    if (!decor[art]!.length) delete decor[art];
  }
  return decor;
}

// Ash, a theme won in solo play (src/rewards/catalog.ts theme.ash): a
// basketball player in red, black and white, fit to play by day and out
// injured by night. An arena's white by day and black by night, the buttons
// red; the pig in a red sweatband under his ears and the team's jersey, a
// tank top with a pig on its chest and his number under it, traced to fit
// him (scripts/ash-wear.py). By day he has a basketball in his hoof; by
// night he leans on crutches with his ankle in a signed cast. When the light
// changes the ball and the crutches and cast trade places to a crowd: an
// "ooooh!!!" going dark, as though he's just gone down hurt, and a cheer coming back
// (scripts/stings.py). A hoop and basketballs overhead, a trough full of
// basketballs. The team, its pig and its look are our own. No season: it
// shows once its owner chooses it, except while a birthday or holiday is
// showing over it (index.ts UNLOCKABLE).
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
  sounds: { dark: 'ooh', light: 'cheer' },
};
