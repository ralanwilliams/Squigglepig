import type { Member } from '../../src/lib/rooms';
import type { Cell, Chain, Presence } from '../../src/state/rules';

// Small builders for the game's data, so a test reads like the game it sets up.

export const DRAWN = JSON.stringify({ w: 400, h: 300, strokes: ['M 10 10 Q 10 10 15 12 L 20 14'] });
export const EMPTY_CANVAS = JSON.stringify({ w: 400, h: 300, strokes: [] });

export const prompt = (text: string, author = ''): Cell => ({ kind: 'prompt', text, author });
export const drawing = (author: string, data = DRAWN): Cell => ({ kind: 'drawing', data, author });
export const blankDrawing = (author: string): Cell => ({ kind: 'drawing', data: '', author });
export const caption = (author: string, text: string): Cell => ({ kind: 'caption', text, author });
export const chain = (...cells: Cell[]): Chain => ({ cells });

// Members joined a second apart, in the order given; `left` ones tapped Leave
// game at the time given.
export const members = (names: string[], left: Record<string, number> = {}): Member[] =>
  names.map((name, i) => ({ id: `id-${name}`, name, joinedAt: 1000 + i * 1000, leftAt: left[name] ?? null }));

export const here = (names: string[], synced: string[] = names): Presence[] =>
  names.map((name) => ({ id: `id-${name}`, name, synced: synced.includes(name) }));
