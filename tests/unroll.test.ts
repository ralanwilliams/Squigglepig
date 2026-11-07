import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { SHUT, unrollRanges } from '../src/theme/skins/unroll';

// Bug: on phones the royal scroll's paper (between its two rolls) wasn't
// there until the scroll was fully open. Its window was squashed to SHUT of
// its height with the paper stretched back 1 / SHUT (50×) inside, and a
// phone's graphics drop a layer stretched that far. Now the window and the
// paper only slide. This checks the geometry: at every point of the unroll
// the paper is where it always is, the window shows it from the top roll
// down, and the bottom roll rides the window's edge. (Whether a phone draws
// it is for the eye: open the winner screen with the royal scroll.)

const lerp = ([a, b]: [number, number], t: number) => a + (b - a) * t;

describe('the royal scroll unrolls by sliding, not stretching', () => {
  const top = 20; // the top roll's middle (dp, in the scroll's box)
  const length = 80; // to the bottom roll's middle
  const { drop, hold } = unrollRanges(length);

  for (const shown of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
    test(`${Math.round(shown * 100)}% open: the paper shows from the top roll to the bottom roll's edge`, () => {
      const windowTop = top + lerp(drop, shown);
      const paperTop = windowTop - top + lerp(hold, shown); // the paper's box, inside the window
      assert.equal(paperTop, 0, 'the paper itself never moves');
      const windowBottom = windowTop + length;
      const shownLength = windowBottom - top; // the paper visible below the top roll
      assert.ok(Math.abs(shownLength - length * (SHUT + (1 - SHUT) * shown)) < 1e-9);
      assert.ok(shownLength > 0, 'some paper is always there');
      const bottomRoll = top + length + lerp(drop, shown);
      assert.equal(bottomRoll, windowBottom, 'the bottom roll rides the edge');
    });
  }

  test('rolled up, only SHUT of the scroll shows; open, all of it', () => {
    assert.ok(Math.abs(length + lerp(drop, 0) - SHUT * length) < 1e-9);
    assert.equal(length + lerp(drop, 1), length);
  });
});
