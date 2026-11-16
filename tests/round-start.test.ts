import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { verdictForCell, verdictForRound, type Position } from '../src/state/rules';
import { lobbyOnCatchUp } from '../src/state/nav';

// Bug: going back into the lobby, the screen jumped: it showed, and then,
// once the host's copy of the room arrived, was swapped for a fresh copy of
// itself. Now a phone already in the lobby stays put when it catches up.
// Also around the start of a round: every round starts with its prompts,
// once, and a prompt only counts while they're still being written.

describe('catching up in the lobby', () => {
  test('a phone already in the lobby stays put (no fresh copy of the screen)', () => {
    assert.equal(lobbyOnCatchUp('lobby', '/lobby'), false);
    assert.equal(lobbyOnCatchUp('gameover', '/scoreboard'), false);
    assert.equal(lobbyOnCatchUp('gameover', '/lobby'), false);
  });
  test('or anywhere else in the app: nothing pulls it away', () => {
    assert.equal(lobbyOnCatchUp('lobby', '/arcade/memory'), false);
  });
  test('a phone whose game ended while it was away goes to the lobby', () => {
    assert.equal(lobbyOnCatchUp('draw', '/drawing'), true);
    assert.equal(lobbyOnCatchUp('reveal', '/reveal'), true);
  });
  test('so does one reconnecting into a game that turns out to be over', () => {
    assert.equal(lobbyOnCatchUp('lobby', '/waiting'), true);
  });
});

const at = (p: Partial<Position>): Position => ({ phase: 'lobby', round: 0, stage: 0, revealIndex: 0, revealStep: 0, chains: 0, ...p });

describe("a round starts once, whoever's keeping the clock", () => {
  test('the next round, straight on from a finished reveal', () => {
    assert.equal(verdictForRound(at({ phase: 'reveal', round: 0, revealIndex: 3, chains: 3 }), 1), 'apply');
  });
  test('a second round message (two phones moving it on for a moment) is ignored', () => {
    assert.equal(verdictForRound(at({ phase: 'prompts', round: 1, chains: 3 }), 1), 'stale');
  });
  test('round 0 comes with the game starting, never on its own', () => {
    assert.equal(verdictForRound(at({ phase: 'prompts', round: 0, chains: 3 }), 0), 'stale');
  });
});

describe("a round's prompts", () => {
  const writing = at({ phase: 'prompts', round: 1, stage: 0, chains: 3 });
  test('count while they are being written', () => {
    assert.equal(verdictForCell(writing, 2, 0, 1), 'apply');
  });
  test('one that comes once the drawing has started is too late: a stand-in took its place', () => {
    assert.equal(verdictForCell({ ...writing, phase: 'draw', stage: 1 }, 2, 0, 1), 'stale');
    assert.equal(verdictForCell(at({ phase: 'reveal', round: 1, chains: 3 }), 2, 0, 1), 'stale');
  });
  test("one from the last round's prompts is late", () => {
    assert.equal(verdictForCell(writing, 0, 0, 0), 'stale');
  });
});
