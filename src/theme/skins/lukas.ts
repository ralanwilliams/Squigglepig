import { EYES, LONG_GUN, SLOTS, carried, dress, held, rightHoof } from './layout';
import type { PropName } from './props';
import type { ArtName, Placement, Skin } from './types';

// The kind brows over the pig's eyes on each piece of art (layout.ts EYES),
// drawn this much narrower than the shield sunglasses there: just the span
// of the eyes.
const BROWS = 0.1 / 0.21;

// The sheriff's badge, pinned over his heart: on the pig's left of its chest
// (the viewer's right), below the chin and clear of the arm, on each piece
// of art where that's showing. On the winner and waiting art the trumpet and
// the pencil are there, so it goes in the middle of the chest, clear of them.
const HEART: Partial<Record<ArtName, Omit<Placement, 'prop'>>> = {
  home: { x: 0.475, y: 0.5, w: 0.1 },
  join: { x: 0.475, y: 0.5, w: 0.1 },
  lobby: { x: 0.475, y: 0.5, w: 0.1 },
  cell: { x: 0.47, y: 0.48, w: 0.09 },
  winner: { x: 0.31, y: 0.575, w: 0.07 },
  waiting: { x: 0.49, y: 0.665, w: 0.045 },
};

// The six-shooter's width, as a multiple of the hold slot's on each piece
// of art (layout.ts SLOTS), in whichever hoof it's in; and how far it's
// turned, clockwise, to hang from it pointing at the ground (props.ts
// sixShooter is drawn upside down, so its grip then faces the viewer's right).
const SIX_SHOOTER = 1.4;
const SIX_SHOOTER_TURN = 80;
// The sack of loot's width, as a multiple of the hold slot's.
const SACK = 0.8;

// What each of the sheriff's props turns into after dark (morph.ts).
const NIGHT: Partial<Record<PropName, PropName>> = {
  sheriffHat: 'outlawHat',
  kindBrows: 'angryBrows',
  sun: 'moon',
  bluebird: 'vulture',
};

// The repeater, carried in both hooves where they're free (layout.ts
// carried), the right hoof (the viewer's right) behind it. By night the left
// hoof holds a sack of loot instead, and the rifle turns into a six-shooter
// hanging from the right hoof, drawn over its grip then; where the right
// hoof is busy (the trumpet, the pencil) the rifle just fades away.
function guns(art: ArtName): Placement[] {
  const [rifle, ...hooves] = carried('repeater', art);
  const [sack] = held('lootSack', art);
  const hold = SLOTS[art].hold;
  if (!rifle || !sack || !hold) return [];
  const loot = { ...sack, w: hold.w * SACK, by: 'night' as const };
  const right = rightHoof(art);
  if (!right) return [{ ...rifle, by: 'day' }, loot, ...hooves];
  const night = { prop: 'sixShooter' as const, x: right.x, y: right.y, w: hold.w * SIX_SHOOTER, rotate: SIX_SHOOTER_TURN };
  return [{ ...rifle, night }, loot, ...hooves, { ...right, by: 'night' }];
}

function outlaw(decor: Skin['decor']): Skin['decor'] {
  for (const art of Object.keys(SLOTS) as ArtName[]) {
    const eyes = EYES[art];
    const heart = HEART[art];
    decor[art] = [
      // First, so the hat's brim goes over them where it comes down low.
      ...(eyes ? [{ ...eyes, w: eyes.w * BROWS, prop: 'kindBrows' as const }] : []),
      ...(decor[art] ?? []),
      ...(heart ? [{ ...heart, prop: 'sheriffBadge' as const, by: 'day' as const }] : []),
      ...(LONG_GUN[art] ? guns(art) : []),
    ].map((p) => (NIGHT[p.prop] ? { ...p, night: { prop: NIGHT[p.prop] } } : p));
    if (!decor[art]!.length) delete decor[art];
  }
  return decor;
}

// Lukas, a theme won in solo play (src/rewards/catalog.ts theme.lukas), for
// Lukas Hirsch, who built the original Squigglepig (app/licenses.tsx): the
// Old West, a good guy by day and a bad guy by night. By day sun-baked
// desert sand, rust-red buttons and turquoise links; the pig is the sheriff,
// in a white hat with a gold star on the band, kind brows, his badge over
// his heart and a repeater rifle in his hooves, a sun and bluebirds
// overhead. By night a midnight desert, blood-red buttons and whiskey-gold
// links, and he's an outlaw: the hat squashed black, a scowl, the badge
// gone, a sack of loot in his left hoof and the rifle shrunk to a
// six-shooter hanging from his right, the sun waned
// to a moon and the bluebirds turned vultures. When the
// light changes each prop morphs into the other (morph.ts) to a sting: dun,
// dun, dunnn going dark, a hero's fanfare coming back (scripts/
// stings.py). A trough full of horseshoes. No season: it shows once its
// owner chooses it, except while a birthday or holiday is showing over it
// (index.ts UNLOCKABLE).
// Every text pair meets WCAG AA (4.5:1, 3:1 for large bold text);
// `node previews/_check-contrast.mjs` checks every skin.
export const lukas: Skin = {
  id: 'lukas',
  label: 'Lukas',

  light: {
    background: '#E7C38A',
    accent: '#8E2A12',
    text: '#26150A',
    textMuted: '#3D2614',
    surfaceText: '#26150A',
    surfaceInset: '#FBF3E4',
    overlay: 'rgba(38,21,10,0.9)',
    overlayLabel: '#F2C230',
    button: 'rgba(122,36,14,0.94)',
    buttonPressed: '#561A0A',
    link: '#0E4A4E',
    success: '#1E4A12',
    shadow: '#5A3A1A',
    divider: 'rgba(38,21,10,0.22)',
  },

  dark: {
    background: '#160E10',
    accent: '#E8453C',
    accentText: '#1E0606',
    text: '#F3E9DC',
    textMuted: '#BBA898',
    surface: '#241719',
    surfaceBorder: '#3D2A2C',
    surfaceText: '#F3E9DC',
    surfaceInset: '#1C1214',
    overlay: '#2A1B1D',
    overlayText: '#F3E9DC',
    overlayLabel: '#F2B33D',
    button: '#8E1B1B',
    buttonPressed: '#A82424',
    link: '#F2B33D',
    placeholder: '#9C8A7C',
    divider: 'rgba(243,233,220,0.22)',
  },

  decor: outlaw(dress({ head: 'sheriffHat', sky: ['sun', 'bluebird', 'bluebird'] })),
  trough: ['horseshoe'],
  sounds: { dark: 'outlaw', light: 'hero' },
};
