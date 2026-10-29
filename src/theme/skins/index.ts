import { themes, type Theme } from '../tokens';
import { birthday, type Birthday } from './birthday';
import { bobby } from './bobby';
import { christmas } from './christmas';
import { easter } from './easter';
import { fourthOfJuly } from './fourthOfJuly';
import { groundhogDay } from './groundhogDay';
import { halloween } from './halloween';
import { newYear } from './newYear';
import { paul } from './paul';
import { railroad } from './railroad';
import { spring } from './spring';
import { stPatricks } from './stPatricks';
import { thanksgiving } from './thanksgiving';
import { valentines } from './valentines';
import type { Season, Skin } from './types';

export type { ArtName, Placement, Skin } from './types';
export type { Birthday } from './birthday';

// Every holiday skin, in the order they're tried: the first in season wins,
// so Easter comes before the Spring it falls inside. To add one, write a file
// beside halloween.ts and list it here. Birthdays aren't here: they come from
// the Supabase `birthdays` table (src/lib/birthdays.ts) and beat any holiday.
export const SKINS: Skin[] = [
  newYear,
  groundhogDay,
  valentines,
  stPatricks,
  easter,
  spring,
  fourthOfJuly,
  halloween,
  thanksgiving,
  christmas,
];

// Themes a player wins in solo play and then chooses (src/rewards/catalog.ts),
// by the reward's id. They have no season: the chosen one shows whenever no
// birthday or holiday is on (or always, with Seasonal themes off), and over
// the one that was on when it was chosen (theme.tsx pinChoice). To add
// one, write it beside railroad.ts, list it here, and take `soon` off its
// reward in the catalog.
export const UNLOCKABLE: Record<string, Skin> = {
  'theme.railroad': railroad,
  'theme.paul': paul,
  'theme.bobby': bobby,
};

// Every skin, holidays first (the previews and their contrast check use this).
export const ALL_SKINS: Skin[] = [...SKINS, ...Object.values(UNLOCKABLE)];

// Set to a skin's id to see it out of season in a dev build ('birthday' shows
// a cake for "Squigglepig"; an unlockable theme shows as if in season, so
// only while Seasonal themes is on).
// Constant-folded away in release bundles.
const PREVIEW: string | null = null;

const md = (m: number, d: number) => m * 100 + d;

function inSeason(season: Season, today: number) {
  const a = md(...season.from);
  const b = md(...season.to);
  return a <= b ? today >= a && today <= b : today >= a || today <= b;
}

// A birthday's skin, built once per person and reused (the palette memo and
// the props key off the same object).
const birthdaySkins = new Map<string, Skin>();
function birthdaySkin(b: Birthday): Skin {
  const key = `${b.name}|${b.month}|${b.day}`;
  let s = birthdaySkins.get(key);
  if (!s) {
    s = birthday(b);
    birthdaySkins.set(key, s);
  }
  return s;
}

// The skin in season on `date`, if any: a birthday that day (from
// `birthdays`; the first listed if two share it), else a holiday.
export function skinFor(date: Date, birthdays: Birthday[] = []): Skin | null {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  if (__DEV__ && PREVIEW) {
    return PREVIEW === 'birthday'
      ? birthdaySkin({ name: 'Squigglepig', month, day })
      : (ALL_SKINS.find((s) => s.id === PREVIEW) ?? null);
  }
  const bday = birthdays.find((b) => b.month === month && b.day === day);
  if (bday) return birthdaySkin(bday);
  const today = md(month, day);
  const year = date.getFullYear();
  return SKINS.find((s) => s.season && inSeason(typeof s.season === 'function' ? s.season(year) : s.season, today)) ?? null;
}

// A date as "YYYY-MM-DD", so two compare as strings.
export const dayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

// The last day of `skin`'s season that `date` falls in (skinFor returned it
// for that date), as a dayKey: this Halloween's, not next year's. A season
// that runs across New Year ends next year when `date` is before it. A skin
// with no season (an unlockable one previewed in a dev build) ends that day.
export function seasonEnd(skin: Skin, date: Date): string {
  if (!skin.season) return dayKey(date);
  const year = date.getFullYear();
  const season = typeof skin.season === 'function' ? skin.season(year) : skin.season;
  const wraps = md(...season.from) > md(...season.to);
  const endYear = wraps && md(date.getMonth() + 1, date.getDate()) >= md(...season.from) ? year + 1 : year;
  return dayKey(new Date(endYear, season.to[0] - 1, season.to[1]));
}

// The palette to show: classic, with the skin's colors laid over it. Built
// once per skin and mode and then reused, so useThemedStyles' memo (keyed on
// the palette object) keeps hitting. High contrast never takes a skin palette.
const cache = new Map<string, Theme>();
export function paletteFor(skin: Skin | null, name: 'light' | 'dark', high: boolean): Theme {
  const base = themes[name][high ? 'high' : 'normal'];
  if (!skin || high) return base;
  const key = `${skin.id}.${name}`;
  let t = cache.get(key);
  if (!t) {
    t = { ...base, ...skin[name] };
    cache.set(key, t);
  }
  return t;
}
