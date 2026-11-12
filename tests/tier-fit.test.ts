import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { MIN_SCALE, colsAt, fitTiers, pageHeight, type FitMeasures } from '../src/rewards/tierFit';

// The rail's card in landscape on a Pixel 9, roughly: 300 dp across.
const m = (h: number, w = 300): FitMeasures => ({
  w,
  h,
  cell: 70,
  gap: 5,
  tileH: 78,
  tileFixed: 0,
  headH: 17,
  headGap: 3,
  between: 12,
  footGap: 6,
});

describe('reward cards fit the folder card', () => {
  test('as many to a row as fit at full size', () => {
    assert.equal(colsAt(m(400), 1), 4);
    assert.equal(colsAt(m(400, 200), 1), 2);
  });

  test('smaller cards fit more to a row', () => {
    assert.ok(colsAt(m(400), 0.75) > colsAt(m(400), 1));
  });

  test('a tab that fits stays at full size', () => {
    // Eight brushes, one tier: two rows.
    const fit = fitTiers(m(220), [{ tiers: [8], foot: 0 }]);
    assert.deepEqual(fit, { scale: 1, cols: 4, fits: true });
  });

  test('a tab that runs over shrinks its cards just enough', () => {
    const pages = [{ tiers: [1, 4, 5], foot: 0 }];
    const fit = fitTiers(m(290), pages);
    assert.ok(fit.fits && fit.scale < 1 && fit.scale >= MIN_SCALE);
    assert.ok(pageHeight(m(290), pages[0], fit.scale) <= 290);
    // A step larger wouldn't have fit.
    assert.ok(pageHeight(m(290), pages[0], Math.round((fit.scale + 0.05) * 100) / 100) > 290);
  });

  test('every tab gets the tallest one’s size', () => {
    const fit = fitTiers(m(290), [{ tiers: [2], foot: 0 }, { tiers: [1, 4, 5], foot: 0 }]);
    assert.equal(fit.scale, fitTiers(m(290), [{ tiers: [1, 4, 5], foot: 0 }]).scale);
  });

  test('a foot takes its room at the bottom', () => {
    const without = pageHeight(m(400), { tiers: [8], foot: 0 }, 1);
    assert.equal(pageHeight(m(400), { tiers: [8], foot: 50 }, 1), without + 6 + 50);
  });

  test('no smaller than the least scale: what still won’t fit says so', () => {
    const fit = fitTiers(m(100), [{ tiers: [40], foot: 0 }]);
    assert.deepEqual({ scale: fit.scale, fits: fit.fits }, { scale: MIN_SCALE, fits: false });
  });
});
