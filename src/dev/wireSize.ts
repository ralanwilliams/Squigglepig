import { split } from '../lib/chunks';

// How big a drawing is on the wire, for the development readout on the
// canvas (./DrawingSize.tsx). Apart from React so tests can check it tells
// the truth (tests/drawing-size.test.ts).

// The most one broadcast may carry on Supabase's free plan: 256 KB, read
// the cautious way (1 kB = 1000 bytes), so the readout reaches 100% a
// touch before the real limit, never after.
export const PAYLOAD_LIMIT = 256_000;

// Bytes as UTF-8, which is how the JSON travels.
export function utf8Bytes(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      n += 4; // a surrogate pair: one character outside the BMP (an emoji)
      i++;
    } else n += 3;
  }
  return n;
}

// A drawing (its JSON, as DrawingBoard's drawingData makes it) in the 'cell'
// message that hands it in (GameContext handIn): the payload's size in
// bytes, and how many pieces it goes in (src/lib/chunks.ts; 1 = whole).
// The round, chain, stage and name are stand-ins: they change the size by
// a few bytes at most.
export function cellSize(data: string, author = 'Player'): { bytes: number; pieces: number } {
  const payload = { round: 0, chain: 0, stage: 1, cell: { kind: 'drawing', data, author } };
  return { bytes: utf8Bytes(JSON.stringify(payload)), pieces: split('cell', payload, 'size')?.length ?? 1 };
}
