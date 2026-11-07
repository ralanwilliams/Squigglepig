import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chainForStage,
  computeSkips,
  electHost,
  finalStage,
  isBlankCell,
  isEmptyTurn,
  judgeFor,
  nextShown,
  phaseForStage,
  playerForChain,
  presentNames,
  prevFor,
  promptsNeededFor,
  tallyRulings,
} from '../src/state/rules';
import { DRAWN, EMPTY_CANVAS, blankDrawing, caption, chain, drawing, here, members, prompt } from './helpers/game';

describe('stages and chains', () => {
  test('stage 0 views, then drawing and guessing take turns', () => {
    assert.deepEqual([0, 1, 2, 3, 4].map(phaseForStage), ['view', 'draw', 'caption', 'draw', 'caption']);
  });

  test('every stage hands each player a different chain, and nobody gets the same chain twice', () => {
    for (let n = 3; n <= 12; n++) {
      for (let s = 0; s <= finalStage(n); s++) {
        const chains = Array.from({ length: n }, (_, pos) => chainForStage(pos, s, n));
        assert.equal(new Set(chains).size, n, `stage ${s} of ${n} players`);
      }
      for (let pos = 0; pos < n; pos++) {
        const seen = Array.from({ length: finalStage(n) + 1 }, (_, s) => chainForStage(pos, s, n));
        assert.equal(new Set(seen).size, seen.length, `player ${pos} of ${n}`);
      }
    }
  });

  test('playerForChain is the inverse of chainForStage', () => {
    const roster = ['Ann', 'Bo', 'Cy', 'Di', 'Ed'];
    for (let s = 0; s < 5; s++) {
      roster.forEach((name, pos) => assert.equal(playerForChain(roster, chainForStage(pos, s, 5), s), name));
    }
    assert.equal(playerForChain([], 0, 1), undefined);
  });

  test('prompts needed covers every chain of every round', () => {
    assert.equal(promptsNeededFor(3, 5), 9); // ⌈5/2⌉ rounds × 3 chains
    assert.equal(promptsNeededFor(12, 5), 12);
    assert.equal(promptsNeededFor(1, 5), 1);
  });
});

describe('what a player is handed (prevFor)', () => {
  test('a drawing turn gets the text before it', () => {
    assert.deepEqual(prevFor(chain(prompt('a cat')), 1), { kind: 'prompt', text: 'a cat' });
  });

  test('a guessing turn gets the drawing before it', () => {
    assert.deepEqual(prevFor(chain(prompt('a cat'), drawing('Bo')), 2), { kind: 'drawing', data: DRAWN });
  });

  test('a blank drawing is passed over for the last text', () => {
    const c = chain(prompt('a cat'), drawing('Bo'), caption('Cy', 'a dog'), blankDrawing('Di'));
    assert.deepEqual(prevFor(c, 4), { kind: 'drawing', data: DRAWN });
    assert.deepEqual(prevFor(c, 5), { kind: 'caption', text: 'a dog' });
  });

  test('a guess with no drawing anywhere before it is blank', () => {
    assert.deepEqual(prevFor(chain(prompt('a cat'), blankDrawing('Bo')), 2), { kind: 'blank' });
  });
});

describe('empty turns', () => {
  test('blank drawings and empty guesses are empty, real ones are not', () => {
    assert.ok(isEmptyTurn(blankDrawing('Bo')));
    assert.ok(isEmptyTurn(drawing('Bo', EMPTY_CANVAS)));
    assert.ok(isEmptyTurn(caption('Bo', '  ')));
    assert.ok(!isEmptyTurn(drawing('Bo')));
    assert.ok(!isEmptyTurn(caption('Bo', 'a dog')));
    assert.ok(!isEmptyTurn(prompt('a cat')));
  });

  test('a skipped turn is empty but not a blank drawing (no penalty)', () => {
    const skipped = { kind: 'drawing' as const, data: '', author: 'Bo', skip: true as const };
    assert.ok(isEmptyTurn(skipped));
    assert.ok(!isBlankCell(skipped));
  });

  test('the reveal passes over skipped turns', () => {
    const c = chain(prompt('a cat'), { kind: 'drawing', data: '', author: 'Bo', skip: true }, caption('Cy', 'cat'));
    assert.equal(nextShown(c, 0), 2);
    assert.equal(nextShown(c, 2), 3);
  });
});

describe('leaving mid-round (computeSkips)', () => {
  const roster = ['Ann', 'Bo', 'Cy', 'Di'];
  test('a player who leaves while 3 carry on is passed over', () => {
    assert.deepEqual([...computeSkips('draw', roster, members(roster, { Di: 5000 }))], ['Di']);
  });
  test('the one whose leaving would drop it under 3 keeps their turns (they run out the clock)', () => {
    assert.deepEqual([...computeSkips('draw', roster, members(roster, { Di: 5000, Cy: 6000 }))], ['Di']);
  });
  test('only during a round', () => {
    assert.equal(computeSkips('reveal', roster, members(roster, { Di: 5000 })).size, 0);
  });
});

describe('scoring (tallyRulings)', () => {
  test('a ✓ scores its author once, however often it is tallied', () => {
    const c = chain(prompt('a cat', 'Ann'), drawing('Bo'), caption('Cy', 'a cat'));
    const tallied = {};
    const scores: Record<string, number> = {};
    assert.ok(tallyRulings(c, { 1: true }, tallied, scores));
    assert.ok(!tallyRulings(c, { 1: true }, tallied, scores));
    tallyRulings(c, { 1: true, 2: true }, tallied, scores, true);
    assert.deepEqual(scores, { Bo: 1, Cy: 1 });
  });

  test('a blank canvas costs its artist a point when the chain is committed', () => {
    const c = chain(prompt('a cat', 'Ann'), blankDrawing('Bo'), caption('Cy', 'a cat'));
    const scores: Record<string, number> = {};
    tallyRulings(c, {}, {}, scores, true);
    assert.deepEqual(scores, { Bo: -1 });
  });

  test('a skipped turn neither scores nor costs', () => {
    const c = chain(prompt('a cat', 'Ann'), { kind: 'drawing', data: '', author: 'Bo', skip: true });
    const scores: Record<string, number> = {};
    tallyRulings(c, { 1: true }, {}, scores, true);
    assert.deepEqual(scores, {});
  });
});

describe('who hosts and who judges', () => {
  const room = members(['Ann', 'Bo', 'Cy']);

  test('the longest in who is here and caught up hosts', () => {
    assert.equal(electHost(room, here(['Ann', 'Bo', 'Cy'])), 'Ann');
    assert.equal(electHost(room, here(['Bo', 'Cy'])), 'Bo');
    assert.equal(electHost(room, here(['Ann', 'Bo', 'Cy'], ['Cy'])), 'Cy');
  });

  test('if nobody is caught up, the longest in hosts (and restores the game)', () => {
    assert.equal(electHost(room, here(['Bo', 'Cy'], [])), 'Bo');
    assert.equal(electHost(room, []), '');
  });

  test('a player who left the game does not host', () => {
    assert.equal(electHost(members(['Ann', 'Bo', 'Cy'], { Ann: 1 }), here(['Ann', 'Bo', 'Cy'])), 'Bo');
  });

  test('the chain owner judges when here, else the leader, else the first one here', () => {
    const c = chain(prompt('a cat', 'Cy'));
    const names = presentNames(room, here(['Ann', 'Bo', 'Cy']));
    assert.equal(judgeFor(c, names, 'Bo'), 'Cy');
    assert.equal(judgeFor(c, ['Ann', 'Bo'], 'Bo'), 'Bo');
    assert.equal(judgeFor(c, ['Ann', 'Bo'], 'Di'), 'Ann');
  });
});
