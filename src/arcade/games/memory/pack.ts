import RAW from './pack.json';

// Draw from memory's drawings, and how to say what one was: shared by the
// solo game (./index.tsx) and the room's Pig Off (src/state/rules.ts), which
// plays the same game to break a tie.
//
// The drawings are doodles from Google's Quick, Draw! (CC BY 4.0, credited on
// app/licenses.tsx), chosen and converted by scripts/quickdraw.mts, easiest
// first.
export type Entry = { word: string; strokes: string[] };
export const PACK = RAW as Entry[];

// What the drawing was: "a cat", "an owl", "an hourglass"; a pair or a
// bunch as it is ("grapes").
const PLURAL = new Set(['drums', 'eyeglasses', 'flip flops', 'grapes', 'headphones', 'pants']);
export const answerFor = (word: string) => (PLURAL.has(word) ? word : `${/^(?:[aeiou]|hour)/.test(word) ? 'an' : 'a'} ${word}`);

// A Pig Off's drawing: one from the easier part of the pack (its first
// fifth: a tie-break should be about memory, not a hard subject), not one
// already used in this Pig Off.
export function pigOffEntry(used: number[], random = Math.random): number {
  const easy = Math.max(1, Math.round(PACK.length / 5));
  const fresh = Array.from({ length: easy }, (_, i) => i).filter((i) => !used.includes(i));
  const pool = fresh.length ? fresh : Array.from({ length: easy }, (_, i) => i);
  return pool[Math.floor(random() * pool.length)];
}
