import { useMemo } from 'react';
import { PROPS, type Prop, type PropName } from '../theme/skins/props';
import type { Placement } from '../theme/skins';
import { cleanBubbleText, useInventory } from '../rewards/inventory';
import { OUTFITS } from './outfits';
import { BUBBLES, BUBBLE_AT, DEFAULT_SAY, underBubble } from './bubbles';

// A player's pig as everyone sees it when they win: the outfit they chose,
// the speech bubble they chose, and what it says (all from what they've won,
// src/rewards/inventory.tsx). It travels with them into a room, in their
// presence (src/state/GameContext.tsx), and the scoreboard dresses the winner
// pig with it.
//
// Anyone can send anything, so one received from another phone is read
// through cleanAvatar: an outfit or bubble this app has no art for is left
// off, and the words are cut to a bubble's length. An app from before avatars
// sends none, and its player's pig is undressed.
export type Avatar = { outfit: string | null; bubble: string | null; say: string };

export const NO_AVATAR: Avatar = { outfit: null, bubble: null, say: '' };

export function cleanAvatar(raw: unknown): Avatar {
  const a = (raw ?? {}) as Record<string, unknown>;
  const outfit = typeof a.outfit === 'string' && OUTFITS[a.outfit] ? a.outfit : null;
  const bubble = typeof a.bubble === 'string' && BUBBLES[a.bubble] ? a.bubble : null;
  const say = typeof a.say === 'string' ? cleanBubbleText(a.say) : '';
  return { outfit, bubble, say };
}

// This player's own avatar, from what they've won and chosen.
export function useMyAvatar(): Avatar {
  const { chosen, bubbleText } = useInventory();
  const outfit = chosen('outfit');
  const bubble = chosen('bubble');
  return useMemo(() => cleanAvatar({ outfit, bubble, say: bubbleText }), [outfit, bubble, bubbleText]);
}

const worn = (name: PropName) => !!(PROPS[name] as Prop).head;

// The winner art (Logo's omit / extra) for an avatar: the outfit, and the
// bubble with the words in it. A hat takes the place of the season's hat;
// the bubble, of the season's props in its corner of the sky.
export function avatarDecor(a: Avatar): { extra: Placement[]; omit?: (p: Placement) => boolean } {
  const outfit = a.outfit ? OUTFITS[a.outfit] : undefined;
  const bubble = a.bubble ? BUBBLES[a.bubble] : undefined;
  const hat = !!outfit && worn(outfit.prop);
  const extra: Placement[] = [];
  if (outfit) extra.push(outfit);
  if (bubble) extra.push({ prop: bubble, ...BUBBLE_AT, text: a.say || DEFAULT_SAY });
  if (!hat && !bubble) return { extra };
  return {
    extra,
    omit: (p) => (hat && worn(p.prop)) || (!!bubble && underBubble(p)),
  };
}
