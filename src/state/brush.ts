import { STROKE } from '../lib/drawing';

// The brush a player draws with through a game: the ink and width they last
// picked on the canvas (DrawingBoard), kept from one drawing turn to the next
// (each turn's canvas is new, PigCanvas) and put back to black at the usual
// width when a new game starts (GameContext newGameBrush). Only this phone's:
// it isn't sent anywhere, and the app starting afresh starts it afresh. In
// the shape of a drawing store's own (DrawingBoard useDrawingStore), so a
// store can take it in place of its own.
type Ref<T> = { current: T };
export type Brush = { ink: Ref<string | null>; width: Ref<number> };

export const gameBrush: Brush = { ink: { current: null }, width: { current: STROKE } };

export function newGameBrush() {
  gameBrush.ink.current = null;
  gameBrush.width.current = STROKE;
}
