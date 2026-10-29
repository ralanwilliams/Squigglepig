import { PROPS, type Prop, type PropName } from '../theme/skins/props';
import { ALL_SKINS, type ArtName, type Placement, type Skin } from '../theme/skins';
import { birthday } from '../theme/skins/birthday';

// A theme's props on the winner pig, in the parts a player can put on or take
// off their pig on Your pig (app/pig.tsx): what's on its head, what's over
// its eyes, what's in the sky (all of it: three bats are one part), what it
// holds (with the hoof redrawn over the grip), and anything else, like
// Easter's ears, by its prop's name. The parts on offer are those of every
// theme the player can use: the birthday or holiday in season, and the
// themes they've won (avatar.ts useThemeSkins).
//
// The theme showing dresses the pig in all its parts unless the player takes
// some off; a part from another theme is worn in place of the showing
// theme's same part (a longbow instead of the pumpkin). A part's key is the
// same for every theme ('head', 'eyes', 'sky', 'hold', or the prop's name),
// so it travels in an avatar (avatar.ts) as is. 'head' and 'eyes' are also
// outfit slots (src/rewards/catalog.ts): an outfit there and a theme's part
// there take each other's place.
export type ThemePart = { key: string; label: string; prop: PropName };

export function partOf(p: Placement): string {
  const prop = PROPS[p.prop] as Prop;
  if (prop.head) return 'head';
  // Easter's ears are drawn for each piece of art; they're one part, kept by
  // the winner art's name.
  if (p.prop.startsWith('ears')) return 'earsWinner';
  if (prop.eyes) return 'eyes';
  if (p.rim === false || p.prop.startsWith('hoof')) return 'hold';
  if (p.bob || p.twinkle) return 'sky';
  return p.prop;
}

// What a part is called on its card: the prop's name, or for the sky, what
// there is of it. A prop missing here is named from its id.
const LABELS: Partial<Record<PropName, string>> = {
  witchHat: 'Witch hat',
  bat: 'Bats',
  pumpkin: 'Pumpkin',
  partyHat: 'Party hat',
  balloonRed: 'Balloons',
  balloonBlue: 'Balloons',
  balloonYellow: 'Balloons',
  giftBlue: 'Present',
  gift: 'Present',
  santaHat: 'Santa hat',
  snowflake: 'Snowflakes',
  earsWinner: 'Bunny ears',
  butterfly: 'Butterflies',
  eggBasket: 'Egg basket',
  unclesamHat: 'Uncle Sam hat',
  fireworkRed: 'Fireworks',
  fireworkBlue: 'Fireworks',
  fireworkGold: 'Fireworks',
  fireworkPink: 'Fireworks',
  flag: 'Flag',
  stumpGroundhog: 'Groundhog',
  beanie: 'Beanie',
  beerBottle: 'Bottle',
  goldHat: 'Party hat',
  popper: 'Party popper',
  flowerCrown: 'Flower crown',
  tulips: 'Tulips',
  leprechaunHat: 'Leprechaun hat',
  shamrock: 'Shamrocks',
  potOfGold: 'Pot of gold',
  pilgrimHat: 'Pilgrim hat',
  leafRed: 'Leaves',
  leafGold: 'Leaves',
  turkey: 'Turkey',
  heartRed: 'Hearts',
  heartPink: 'Hearts',
  cupidBow: "Cupid's bow",
  quiver: 'Quiver',
  conductorCap: 'Conductor cap',
  steam: 'Steam',
  lantern: 'Lantern',
  archerCap: "Archer's cap",
  arrow: 'Arrows',
  longbow: 'Longbow',
  mohawk: 'Mohawk',
  visor: 'Shield shades',
  hoverCar: 'Flying cars',
  rifle: 'Blaster',
};

const named = (prop: PropName) => LABELS[prop] ?? prop.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());

// A theme's parts on the winner pig, in the order they're drawn.
export function partsOf(skin: Skin): ThemePart[] {
  const parts = new Map<string, ThemePart>();
  for (const p of skin.decor.winner ?? []) {
    const key = partOf(p);
    // The hoof only goes with what it holds; the card shows the held prop.
    if (!parts.has(key) && !p.prop.startsWith('hoof')) parts.set(key, { key, label: named(p.prop), prop: p.prop });
  }
  return [...parts.values()];
}

// The placements of one part of a theme on a piece of pig art (the winner
// pig, unless another is given).
export const placementsOf = (skin: Skin, key: string, art: ArtName = 'winner') => (skin.decor[art] ?? []).filter((p) => partOf(p) === key);

// A theme by its id, for a part worn from it: any holiday or won theme, or a
// birthday's (its parts on the winner pig don't carry the name).
const BIRTHDAY = birthday({ name: '', month: 1, day: 1 });
export const skinById = (id: string): Skin | undefined => (id === BIRTHDAY.id ? BIRTHDAY : ALL_SKINS.find((s) => s.id === id));

// A worn part as it's kept and sent, "<skin id>:<part>", read back: null for
// a theme or part this app doesn't know.
export function parsePart(id: string): { skin: Skin; key: string } | null {
  const [skinId, key, extra] = id.split(':');
  const skin = extra === undefined && key ? skinById(skinId) : undefined;
  return skin && placementsOf(skin, key).length ? { skin, key } : null;
}

// Where a part goes on the pig, top to bottom, for the order of Your pig's
// accessories: hats, eyewear, neckwear, what it holds, what's at its feet,
// then what floats about it. An outfit's slot is one of these too
// (src/rewards/catalog.ts). A theme's one-off props go where they sit:
// Easter's ears with the hats, Valentine's quiver with what's carried, the
// groundhog at the pig's feet; any other with what's at its feet.
const PLACES = ['head', 'eyes', 'neck', 'hold', 'feet', 'sky'];
const SITS: Record<string, string> = { earsWinner: 'head', quiver: 'hold', stumpGroundhog: 'feet' };
export function placeRank(key: string): number {
  const i = PLACES.indexOf(SITS[key] ?? key);
  return i < 0 ? PLACES.indexOf('feet') : i;
}

// Whether a part (or an outfit's slot) is worn on the pig's head: a hat,
// eyewear, Easter's ears. A pig holding something, or peeking over it, wears
// only these (avatar.ts avatarDecor).
export const onHead = (key: string) => placeRank(key) <= PLACES.indexOf('eyes');
