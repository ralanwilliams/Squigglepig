import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { PIG_OFF_TRIES, pigOffOutcome, tiedLeaders, verdictForCell, verdictForGameOver, verdictForPigOff, verdictForPigOffTurn, verdictForRound, type Position } from '../src/state/rules';
import { asPigOff, asStrokes } from '../src/state/wire';
import { PACK, pigOffEntry } from '../src/arcade/games/memory/pack';
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

// The game ends tied: a Pig Off settles it (./rules "Pig Off").
describe('a tie at the end of the game', () => {
  test('is the players still in sharing the top score', () => {
    const scores = { Ann: 5, Bo: 5, Cy: 3, Di: 5 };
    assert.deepEqual(tiedLeaders(scores, ['Ann', 'Bo', 'Cy']), ['Ann', 'Bo'], 'not Di, who left');
    assert.deepEqual(tiedLeaders({ Ann: 5, Bo: 4 }, ['Ann', 'Bo']), ['Ann'], 'one on top is a win, not a tie');
    assert.deepEqual(tiedLeaders({}, ['Ann', 'Bo']), [], 'nobody on 0');
  });
  test('the closest match wins outright', () => {
    assert.deepEqual(pigOffOutcome({ Ann: 71, Bo: 64 }, ['Ann', 'Bo']), { winner: 'Ann', tied: [] });
  });
  test('the same match is a tie again, between just those on top', () => {
    assert.deepEqual(pigOffOutcome({ Ann: 70, Bo: 70, Cy: 40 }, ['Ann', 'Bo', 'Cy']), { winner: '', tied: ['Ann', 'Bo'] });
  });
  test('nobody drawing at all (both away) is a tie at 0, and the tries run out', () => {
    assert.deepEqual(pigOffOutcome({}, ['Ann', 'Bo']).tied, ['Ann', 'Bo']);
    assert.ok(PIG_OFF_TRIES >= 2);
  });
  test('each attempt gets a drawing not used yet, from the easier part of the pack', () => {
    const easy = Math.round(PACK.length / 5);
    const first = pigOffEntry([], () => 0);
    assert.ok(first < easy);
    assert.notEqual(pigOffEntry([first], () => 0), first);
  });
});

describe("a Pig Off's messages", () => {
  const revealed = at({ phase: 'reveal', round: 4, revealIndex: 3, chains: 3 });
  const pigoff = (attempt: number) => at({ phase: 'pigoff', round: 4, stage: attempt, revealIndex: 3, chains: 3 });
  test('the first comes straight on from the last chain scored', () => {
    assert.equal(verdictForPigOff(revealed, 1, 4), 'apply');
    assert.equal(verdictForPigOff({ ...revealed, revealIndex: 2 }, 1, 4), 'resync', 'a chain this phone missed being scored');
  });
  test('another go follows the last, once', () => {
    assert.equal(verdictForPigOff(pigoff(1), 2, 4), 'apply');
    assert.equal(verdictForPigOff(pigoff(2), 2, 4), 'stale', 'two phones starting it');
    assert.equal(verdictForPigOff(pigoff(1), 3, 4), 'resync', 'one this phone missed');
  });
  test("a drawing or result counts only for the attempt that's on", () => {
    assert.equal(verdictForPigOffTurn(pigoff(2), 2, 4), 'apply');
    assert.equal(verdictForPigOffTurn(pigoff(2), 1, 4), 'stale');
    assert.equal(verdictForPigOffTurn(at({ phase: 'gameover', round: 4 }), 2, 4), 'stale');
  });
  test('the game ends from it', () => {
    assert.equal(verdictForGameOver(pigoff(1), 4), 'apply');
  });
  test('read off the wire: only drawing paths, and a Pig Off with two players or more', () => {
    assert.deepEqual(asStrokes(['M 1 2 Q 3 4 5 6 L 7 8', 'javascript:alert(1)', 42]), ['M 1 2 Q 3 4 5 6 L 7 8']);
    assert.equal(asPigOff({ attempt: 1, players: ['Ann'], entry: 3 }), null);
    assert.deepEqual(asPigOff({ attempt: 1, players: ['Ann', 'Bo'], entry: 3 })?.matches, null);
  });
});
