import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { STROKE, WIDTHS, parseDrawing, strokeWidth, toWidth } from '../src/lib/drawing';
import { BRUSH_SIZE, REWARDS, rewardById } from '../src/rewards/catalog';
import { gameBrush, newGameBrush } from '../src/state/brush';
import { prizes } from '../src/arcade/payout';

const A = 'M 10 10 L 20 20';
const B = 'M 30 30 L 40 40';
const drawing = (extra: object) => JSON.stringify({ w: 400, h: 300, strokes: [A, B], ...extra });

describe('a drawing gives each stroke its width', () => {
  test('widths in step with the strokes are kept', () => {
    assert.deepEqual(parseDrawing(drawing({ widths: [9, null] }))?.widths, [9, null]);
  });

  test('a drawing without widths, or with only the usual one, has none: every line is STROKE wide', () => {
    assert.equal(parseDrawing(drawing({}))?.widths, undefined);
    assert.equal(parseDrawing(drawing({ widths: [null, null] }))?.widths, undefined);
    assert.equal(strokeWidth(undefined, 0), STROKE);
    assert.equal(strokeWidth([9, null], 1), STROKE);
    assert.equal(strokeWidth([9, null], 0), 9);
  });

  test("widths that don't line up with the strokes are ignored", () => {
    assert.equal(parseDrawing(drawing({ widths: [9] }))?.widths, undefined);
  });

  test('a width out of range is brought into it, and anything not a number is the usual width', () => {
    assert.deepEqual(parseDrawing(drawing({ widths: [500, -2] }))?.widths, [WIDTHS.max, WIDTHS.min]);
    assert.deepEqual(parseDrawing(drawing({ widths: ['wide', 6] }))?.widths, [null, 6]);
  });

  test('a dropped stroke takes its width with it', () => {
    const d = JSON.stringify({ w: 400, h: 300, strokes: [A, '<script>', B], widths: [2, 8, 12] });
    assert.deepEqual(parseDrawing(d)?.widths, [2, 12]);
  });

  test('widths land on the slider’s steps', () => {
    assert.equal(toWidth(6.2), 6);
    assert.equal(toWidth(6.3), 6.5);
    assert.equal(toWidth(0), WIDTHS.min);
  });
});

describe('the brush lasts the game', () => {
  test('a new game puts it back to black at the usual width', () => {
    gameBrush.ink.current = 'brush.barnRed';
    gameBrush.width.current = 12;
    newGameBrush();
    assert.equal(gameBrush.ink.current, null);
    assert.equal(gameBrush.width.current, STROKE);
  });
});

describe('Brush size is a premium prize', () => {
  test('it is a premium reward', () => {
    assert.equal(rewardById(BRUSH_SIZE)?.tier, 'premium');
  });

  test('winning all 10 offers it', () => {
    assert.ok(prizes('premium', new Set(), false).list.some((r) => r.id === BRUSH_SIZE));
    // Every premium reward but one owned: the offer is the one left, Brush size.
    const others = new Set(REWARDS.filter((r) => r.tier === 'premium' && r.id !== BRUSH_SIZE).map((r) => r.id));
    assert.deepEqual(prizes('premium', others, false).list.map((r) => r.id), [BRUSH_SIZE]);
  });
});
