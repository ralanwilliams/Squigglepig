import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { shuffle } from '../src/lib/shuffle';

// A shuffled copy (src/lib/shuffle.ts): the live game's stand-in prompts and
// trivia's answers both go through it.

describe('shuffle', () => {
  test('keeps every item, and leaves the original as it was', () => {
    const arr = [1, 2, 3, 4, 5];
    const out = shuffle(arr);
    assert.deepEqual([...out].sort(), [1, 2, 3, 4, 5]);
    assert.deepEqual(arr, [1, 2, 3, 4, 5]);
    assert.notEqual(out, arr);
  });

  test('goes by the random numbers it is given', () => {
    // rand() → 0 always swaps with the front: [a,b,c] → [b,c,a].
    assert.deepEqual(shuffle(['a', 'b', 'c'], () => 0), ['b', 'c', 'a']);
    // Just under 1 always swaps an item with itself: nothing moves.
    assert.deepEqual(shuffle(['a', 'b', 'c'], () => 0.999), ['a', 'b', 'c']);
  });

  test('an empty or single list comes back as it was', () => {
    assert.deepEqual(shuffle([]), []);
    assert.deepEqual(shuffle(['x']), ['x']);
  });
});
