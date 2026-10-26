import { useMemo } from 'react';
import { UNLOCKABLE, type Placement, type Skin } from '../theme/skins';
import { cleanBubbleText, useInventory } from '../rewards/inventory';
import { oneEach, slotOf } from '../rewards/catalog';
import { useSkin, useThemeMode } from '../theme/theme';
import { parsePart, partOf, placementsOf } from './themeParts';
import { OUTFITS } from './outfits';
import { BUBBLES, BUBBLE_AT, DEFAULT_SAY, underBubble } from './bubbles';

// A player's pig as everyone sees it when they win: the outfits it has on
// (one per slot: a hat, sunglasses, a bow tie), the speech bubble they chose,
// what it says (all from what they've won, src/rewards/inventory.tsx), the
// parts of themes they've put on it, and the parts of the showing theme
// they've taken off (themeParts.ts). It travels with them into a room, in
// their presence (src/state/GameContext.tsx, as wireAvatar), and the
// scoreboard dresses the winner pig with it.
//
// Anyone can send anything, so one received from another phone is read
// through cleanAvatar: an outfit, bubble or theme part this app has no art
// for is left off, two in one slot keep the first, and the words are cut to a
// bubble's length. An app from before avatars sends none, and its player's
// pig is undressed; one from before slots sends a single `outfit`, and one
// from before theme parts wears and hides none.
export type Avatar = { outfits: string[]; bubble: string | null; say: string; theme: string[]; hide: string[] };

export const NO_AVATAR: Avatar = { outfits: [], bubble: null, say: '', theme: [], hide: [] };

// A part's key (themeParts.ts partOf): a word, and there are only a few.
const PART = /^[A-Za-z]{1,32}$/;
const MAX_PARTS = 8;

const strings = (v: unknown) => (Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : []);

export function cleanAvatar(raw: unknown): Avatar {
  const a = (raw ?? {}) as Record<string, unknown>;
  const given = Array.isArray(a.outfits) ? strings(a.outfits) : typeof a.outfit === 'string' ? [a.outfit] : [];
  const outfits = oneEach(given.filter((id) => !!OUTFITS[id]));
  const bubble = typeof a.bubble === 'string' && BUBBLES[a.bubble] ? a.bubble : null;
  const say = typeof a.say === 'string' ? cleanBubbleText(a.say) : '';
  // One theme part per key, and none in a slot an outfit fills (a theme hat
  // under an outfit hat).
  const keys = new Set<string>(outfits.map(slotOf).filter((s) => !!s));
  const theme = strings(a.theme)
    .filter((id) => {
      const part = parsePart(id);
      if (!part || keys.has(part.key)) return false;
      keys.add(part.key);
      return true;
    })
    .slice(0, MAX_PARTS);
  const hide = strings(a.hide).filter((k) => PART.test(k)).slice(0, MAX_PARTS);
  return { outfits, bubble, say, theme, hide };
}

// An avatar as it's sent: `outfits` for this app, and `outfit`, the first of
// them (the hat, if there is one), for an app from before slots, which reads
// only that.
export const wireAvatar = (a: Avatar) => ({ ...a, outfit: a.outfits[0] ?? null });

// The themes whose parts this player can put on their pig: the birthday or
// holiday in season (showing or not), then the themes they've won.
export function useThemeSkins(): Skin[] {
  const { season } = useThemeMode();
  const { owns } = useInventory();
  const won = Object.entries(UNLOCKABLE)
    .filter(([id]) => owns(id))
    .map(([, skin]) => skin);
  return season ? [season, ...won.filter((s) => s !== season)] : won;
}

// This player's own avatar: what they've won and put on, and what they've
// taken off the theme showing now.
export function useMyAvatar(): Avatar {
  const { worn, chosen, bubbleText, parts, hiddenFor } = useInventory();
  const showing = useSkin();
  const usable = useThemeSkins();
  const bubble = chosen('bubble');
  // Joined, so the memo below only reruns when they change.
  const theme = parts.filter((id) => usable.some((s) => id.startsWith(`${s.id}:`) && s !== showing)).join(' ');
  const hide = (showing ? hiddenFor(showing.id) : []).join(' ');
  return useMemo(
    () =>
      cleanAvatar({
        outfits: worn,
        bubble,
        say: bubbleText,
        theme: theme ? theme.split(' ') : [],
        hide: hide ? hide.split(' ') : [],
      }),
    [worn, bubble, bubbleText, theme, hide]
  );
}

// The winner art (Logo's omit / extra) for an avatar: the outfits, the theme
// parts put on, and the bubble with the words in it. A hat takes the place of
// the showing theme's hat, and a theme part the place of its same part; the
// bubble, of anything in its corner of the sky; and the parts the player took
// off are left off.
export function avatarDecor(a: Avatar): { extra: Placement[]; omit?: (p: Placement) => boolean } {
  const outfits = a.outfits.map((id) => OUTFITS[id]).filter(Boolean);
  const bubble = a.bubble ? BUBBLES[a.bubble] : undefined;
  const parts = a.theme.map(parsePart).filter((p) => !!p);
  // The theme's parts something else stands in for: a theme part put on, or
  // an outfit in that slot (a hat for the theme's hat, sunglasses for its
  // visor).
  const replaced = new Set<string>([...parts.map((p) => p.key), ...a.outfits.map(slotOf).filter((s) => !!s)]);
  const extra: Placement[] = [
    ...parts.flatMap((p) => placementsOf(p.skin, p.key)).filter((p) => !bubble || !underBubble(p)),
    ...outfits,
  ];
  if (bubble) extra.push({ prop: bubble, ...BUBBLE_AT, text: a.say || DEFAULT_SAY });
  if (!bubble && !a.hide.length && !replaced.size) return { extra };
  return {
    extra,
    omit: (p) => (!!bubble && underBubble(p)) || a.hide.includes(partOf(p)) || replaced.has(partOf(p)),
  };
}

// For Your pig's cards: which theme a part of the pig comes from now, if
// any — a part put on, else the showing theme's unless taken off (or an
// outfit fills that slot).
export function partSource(a: Avatar, showing: Skin | null, key: string): string | null {
  const put = a.theme.find((id) => id.endsWith(`:${key}`));
  if (put) return put.slice(0, put.length - key.length - 1);
  if (!showing || a.hide.includes(key) || !placementsOf(showing, key).length) return null;
  if (a.outfits.some((id) => slotOf(id) === key)) return null;
  return showing.id;
}
