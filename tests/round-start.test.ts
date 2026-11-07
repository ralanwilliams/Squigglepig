import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { drawSeeds, promptKey, verdictForRound, type Prompt } from '../src/state/rules';
import { lobbyOnCatchUp } from '../src/state/nav';

// Bug: going back into the lobby, the screen jumped: it showed, and then,
// once the host's copy of the room arrived, was swapped for a fresh copy of
// itself. Now a phone already in the lobby stays put when it catches up.
// Also around the start of a round: a prompt is never handed out twice in a
// game until every prompt has been, even when the host changes mid-game.

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

describe("the first round starts once, whoever's host", () => {
  const prompts = { phase: 'prompts' as const, round: 0, stage: 0, revealIndex: 0, revealStep: 0, chains: 0 };
  test('round 0 from the trough starts the game', () => {
    assert.equal(verdictForRound(prompts, 0), 'apply');
  });
  test('a second round 0 (two phones hosting for a moment) is ignored', () => {
    assert.equal(verdictForRound({ ...prompts, phase: 'view', chains: 3 }, 0), 'stale');
  });
});

describe('prompts are handed out once a game (drawSeeds)', () => {
  const pool = (n: number): Prompt[] => Array.from({ length: n }, (_, i) => ({ text: `prompt ${i}`, author: `P${i % 3}` }));
  const keep = <T,>(a: T[]) => [...a]; // no shuffle, so the order can be followed
  const FALLBACK = ['a cat on a skateboard'];

  test('rounds draw different prompts until the trough is used up', () => {
    const all = pool(9);
    const used = new Set<string>();
    let p: Prompt[] = [];
    const seen: string[] = [];
    for (let round = 0; round < 3; round++) {
      const drawn = drawSeeds(p, all, used, 3, keep, FALLBACK);
      p = drawn.pool;
      for (const s of drawn.seeds) {
        seen.push(s.text);
        used.add(promptKey(s));
      }
    }
    assert.equal(new Set(seen).size, 9);
  });

  test('a host taking over mid-game (its own pool empty) carries on with the unused ones', () => {
    const all = pool(9);
    // Round 0 was drawn by the old host; every phone noted its seeds.
    const used = new Set(all.slice(0, 3).map(promptKey));
    const drawn = drawSeeds([], all, used, 3, keep, FALLBACK);
    assert.deepEqual(drawn.seeds.map((s) => s.text), ['prompt 3', 'prompt 4', 'prompt 5']);
  });

  test('a stale pool (from a snapshot) never hands out a used prompt again', () => {
    const all = pool(9);
    const used = new Set(all.slice(0, 6).map(promptKey));
    const drawn = drawSeeds(all.slice(3), all, used, 3, keep, FALLBACK);
    assert.deepEqual(drawn.seeds.map((s) => s.text), ['prompt 6', 'prompt 7', 'prompt 8']);
  });

  test('a game that runs long starts over on all of them, rather than stalling', () => {
    const all = pool(3);
    const used = new Set(all.map(promptKey));
    const drawn = drawSeeds([], all, used, 3, keep, FALLBACK);
    assert.equal(drawn.seeds.length, 3);
  });

  test('with no prompts at all, the fallbacks', () => {
    const drawn = drawSeeds([], [], new Set(), 2, keep, FALLBACK);
    assert.deepEqual(drawn.seeds.map((s) => s.text), FALLBACK.concat(FALLBACK).slice(0, 2));
  });
});
