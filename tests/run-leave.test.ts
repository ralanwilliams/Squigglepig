import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { START, leaveCost, runReducer, runUnderWay, type Run } from '../src/arcade/engine';

// Leaving a solo run mid-way loses the pot, so Leave and Back ask first
// (RunShell.tsx): only while there's something to lose, and saying what.
const round = (n: number): Run => ({ phase: 'round', round: n, until: 0, lives: 2, attempt: 1 });
const between = (won: number): Run => ({ phase: 'between', won, until: 0, at: 0, lives: 2, attempt: 1 });
const missed = (n: number): Run => ({ phase: 'missed', round: n, timeout: false, until: 0, at: 0, lives: 1, attempt: 1 });

describe('a run under way', () => {
  test('from round 1 until it ends', () => {
    assert.ok(runUnderWay(runReducer(START, { type: 'start', until: 0 })));
    assert.ok(runUnderWay(between(1)));
    assert.ok(runUnderWay(missed(1)));
  });
  test('not on its intro, once it is lost, or at the payout', () => {
    assert.ok(!runUnderWay(START));
    assert.ok(!runUnderWay({ phase: 'lost', won: 3, timeout: false, until: 0, at: 0, lives: 0, attempt: 1 }));
    assert.ok(!runUnderWay({ phase: 'payout', won: 3, prize: 'common' }));
  });
});

describe('what leaving costs', () => {
  test('nothing in the pot yet: only the run', () => {
    assert.equal(leaveCost(round(1)), 'This run will end here.');
    assert.equal(leaveCost(round(3)), 'This run will end here.'); // 2 won
    assert.equal(leaveCost(between(2)), 'This run will end here.');
    assert.equal(leaveCost(missed(3)), 'This run will end here.');
  });
  test('the prize in the pot, counting only rounds won', () => {
    assert.equal(leaveCost(between(3)), 'The common prize in the pot will be lost.');
    assert.equal(leaveCost(round(4)), 'The common prize in the pot will be lost.'); // 3 won
    assert.equal(leaveCost(missed(4)), 'The common prize in the pot will be lost.');
    assert.equal(leaveCost(between(6)), 'The rare prize in the pot will be lost.');
    assert.equal(leaveCost(round(10)), 'The rare prize in the pot will be lost.'); // 9 won
  });
});
