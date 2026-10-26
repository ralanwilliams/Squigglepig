import { rewardById } from '../rewards/catalog';
import { canvas } from '../theme/tokens';

// A drawing as it travels between players: JSON, vector, tiny. PigCanvas makes
// one, DrawingImage shows one.
//
//   { w, h, strokes, inks?, stickers? }
//
// `strokes` are SVG paths in the drawing's own units (SPACE: 400 × 300). The
// other two fields came later (with brush colors and stickers) and are
// optional, so the format reads both ways: an app from before them reads the
// same JSON, ignores what it doesn't know, and draws every stroke in black
// ink; and a drawing without them is simply all black, no stickers.
//
//   inks     — one per stroke, in step with `strokes`: the id of the brush
//              reward it was drawn with (src/rewards/catalog.ts), or null
//              for black ink. Ids, not colors: a brush can grow more than a
//              color later without the format changing again, and an id this
//              app doesn't know draws in black.
//   stickers — pictures stamped on top of the strokes, by sticker id
//              (src/stickers/art.ts), at x / y (their centre) and s units
//              wide, turned r degrees clockwise. An id this app doesn't know
//              is left out.
//
// Anyone can send anything, so parseDrawing reads it defensively: a malformed
// part is dropped rather than drawn, and a hopeless drawing is null.

// The drawing space: every drawing is 400 × 300 units whatever the device,
// orientation or zoom it was drawn at (PigCanvas).
export const SPACE = { w: 400, h: 300 };

// Pen width, in drawing units.
export const STROKE = 3;

export type Sticker = { id: string; x: number; y: number; s: number; r: number };

export type Drawing = {
  w: number;
  h: number;
  strokes: string[];
  inks?: (string | null)[];
  stickers?: Sticker[];
};

// Only what a path drawn on the canvas can contain: commands and numbers.
const PATH = /^[MLQCSTHVZmlqcsthvz0-9eE.,\s+-]*$/;
const MAX_STICKERS = 50;
const MAX_SIDE = 4000; // a drawing's w / h, in units; anything bigger is junk

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

export function parseDrawing(data: string): Drawing | null {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(data);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const { w, h } = raw;
  if (!finite(w) || !finite(h) || w <= 0 || h <= 0 || w > MAX_SIDE || h > MAX_SIDE) return null;
  if (!Array.isArray(raw.strokes)) return null;

  // Inks only count if they line up with the strokes one for one.
  const inkList = Array.isArray(raw.inks) && raw.inks.length === raw.strokes.length ? raw.inks : null;
  const strokes: string[] = [];
  const inks: (string | null)[] = [];
  raw.strokes.forEach((d, i) => {
    if (typeof d !== 'string' || !PATH.test(d)) return;
    strokes.push(d);
    const ink = inkList?.[i];
    inks.push(typeof ink === 'string' ? ink : null);
  });

  const stickers = (Array.isArray(raw.stickers) ? raw.stickers : [])
    .filter(
      (s): s is Sticker =>
        !!s && typeof s === 'object' && typeof s.id === 'string' && finite(s.x) && finite(s.y) && finite(s.s) && finite(s.r) && s.s > 0 && s.s <= MAX_SIDE
    )
    .slice(0, MAX_STICKERS)
    .map(({ id, x, y, s, r }) => ({ id, x, y, s, r }));

  return {
    w,
    h,
    strokes,
    ...(inks.some((i) => i !== null) ? { inks } : {}),
    ...(stickers.length ? { stickers } : {}),
  };
}

// The color stroke `i` is drawn in: its brush's, or black ink.
export function inkColor(inks: (string | null)[] | undefined, i: number): string {
  const id = inks?.[i];
  const brush = id ? rewardById(id) : undefined;
  return brush?.kind === 'brush' ? brush.color : canvas.ink;
}
