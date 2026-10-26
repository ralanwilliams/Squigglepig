import type { Placement } from '../theme/skins';
import type { PropName } from '../theme/skins/props';

// Each speech bubble style (src/rewards/catalog.ts, kind 'bubble'), by reward
// id: its art in props.ts, whose text slot takes what the player wrote.
export const BUBBLES: Record<string, PropName> = {
  'bubble.speech': 'bubbleSpeech',
  'bubble.thought': 'bubbleThought',
  'bubble.shout': 'bubbleShout',
  'bubble.heart': 'bubbleHeart',
  'bubble.scroll': 'bubbleScroll',
};

// Where a bubble sits on the winner art: the open sky top right, its tail
// pointing down and left at the pig's head. Fractions of the image (its
// centre, and its width).
export const BUBBLE_AT = { x: 0.74, y: 0.13, w: 0.5 };

// The season's props in that corner (the winner art's sky props) give way to
// the bubble.
export const underBubble = (p: Placement) => p.x > 0.5 && p.y < 0.3;

// What a bubble says when the player hasn't written anything.
export const DEFAULT_SAY = 'Oink!';
