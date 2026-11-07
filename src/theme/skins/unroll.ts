// The royal scroll unrolling (SkinDecor.tsx, props.ts `appear: 'unroll'`),
// apart from React so it can be tested (tests/unroll.test.ts).
//
// The paper shows through a window as long as the paper, from the top roll
// down. Rolled up, the window is slid up until only SHUT of it is left below
// the top roll, and the paper inside is slid back down just as far, so it
// stays put; unrolling slides both back, so the window's bottom edge — and the
// bottom roll with it — comes down over still paper. Only slides, nothing
// squashed or stretched: a phone's graphics can't be relied on to draw a layer
// stretched many times over (an earlier version squashed the window to SHUT
// and stretched the paper back by 1 / SHUT, and on phones the paper wasn't
// there until it was all the way open).

// How much of the scroll's length shows rolled up.
export const SHUT = 0.02;

// For a scroll whose rolls' middles are `length` apart: how far the window
// and the bottom roll slide (`drop`) and the paper inside the window slides
// back (`hold`), from rolled up (shown 0) to open (shown 1). Straight lines
// between, so each is the output range of an interpolation of `shown`.
export function unrollRanges(length: number) {
  return {
    drop: [-(1 - SHUT) * length, 0] as [number, number],
    hold: [(1 - SHUT) * length, 0] as [number, number],
  };
}
