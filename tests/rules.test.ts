import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  asRules,
  chainForStage,
  clockLine,
  computeSkips,
  electKeeper,
  finalStage,
  gameRules,
  isBlankCell,
  isEmptyTurn,
  isLate,
  isMissedTurn,
  judgeFor,
  judgingMissed,
  nextShown,
  phaseForStage,
  playerForChain,
  presentNames,
  prevFor,
  promptsNeededFor,
  roomHost,
  stillToGo,
  tallyRulings,
  type Docks,
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

  // The waiting screen says who's still at it, and the keeper moves on once
  // nobody is: whose chain has nothing for the stage yet.
  test('who is still drawing or guessing', () => {
    const roster = ['Ann', 'Bo', 'Cy', 'Di'];
    const chains = roster.map((n) => chain(prompt(`${n}'s`, n)));
    // Stage 1: Bo is on chain 0, Cy on chain 1 (chainForStage); both are in.
    chains[chainForStage(1, 1, 4)].cells[1] = drawing('Bo');
    chains[chainForStage(2, 1, 4)].cells[1] = blankDrawing('Cy'); // an empty canvas handed in is in
    assert.deepEqual(stillToGo(roster, chains, 1, new Set()), ['Ann', 'Di']);
    assert.deepEqual(stillToGo(roster, chains, 1, new Set(), 'Ann'), ['Di'], 'not the one waiting');
    assert.deepEqual(stillToGo(roster, chains, 1, new Set(['Di'])), ['Ann'], 'not anyone out of the rotation');
    chains[chainForStage(0, 1, 4)].cells[1] = drawing('Ann');
    chains[chainForStage(3, 1, 4)].cells[1] = drawing('Di');
    assert.deepEqual(stillToGo(roster, chains, 1, new Set()), [], 'everyone is in');
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

// Bug: a phone in the background stayed in presence (only "not caught up"),
// and when nobody on screen was caught up, the longest in who was "here" got
// the clock: the sleeping phone, which wouldn't keep it. Nobody ran the game
// or answered the phone coming back. Now the host is the room's longest in,
// away or not, and the clock goes only to phones on screen (a phone leaves
// presence when it goes off screen), with the others lined up behind it.
describe('the host, and who keeps the clock', () => {
  const room = members(['Ann', 'Bo', 'Cy']);

  test('the host is the longest in, whether or not they have the app open', () => {
    assert.equal(roomHost(room), 'Ann');
    assert.equal(roomHost(members(['Ann', 'Bo', 'Cy'])), 'Ann'); // nobody here at all
  });

  test('only Leave game passes the host on, to whoever has been in longest after them', () => {
    assert.equal(roomHost(members(['Ann', 'Bo', 'Cy'], { Ann: 5000 })), 'Bo');
    assert.equal(roomHost(members(['Ann', 'Bo', 'Cy'], { Ann: 5000, Bo: 6000 })), 'Cy');
    assert.equal(roomHost([]), '');
  });

  test('the longest in who is here and caught up keeps the clock', () => {
    assert.equal(electKeeper(room, here(['Ann', 'Bo', 'Cy'])), 'Ann');
    assert.equal(electKeeper(room, here(['Bo', 'Cy'])), 'Bo');
    assert.equal(electKeeper(room, here(['Ann', 'Bo', 'Cy'], ['Cy'])), 'Cy');
  });

  test('if nobody is caught up, the longest in here keeps it (and restores the game)', () => {
    assert.equal(electKeeper(room, here(['Bo', 'Cy'], [])), 'Bo');
    assert.equal(electKeeper(room, []), '');
  });

  test('the one phone back on screen keeps it: phones off screen are not in presence', () => {
    // Ann and Cy went off screen (left presence); Bo is back, catching up.
    assert.equal(electKeeper(room, here(['Bo'], [])), 'Bo');
  });

  test('a player who left the game does not keep it', () => {
    assert.equal(electKeeper(members(['Ann', 'Bo', 'Cy'], { Ann: 1 }), here(['Ann', 'Bo', 'Cy'])), 'Bo');
  });

  test("the keeper's backups: everyone here and caught up, longest in first", () => {
    const four = members(['Ann', 'Bo', 'Cy', 'Di']);
    assert.deepEqual(clockLine(four, here(['Ann', 'Bo', 'Cy', 'Di']), 'Ann'), ['Bo', 'Cy', 'Di']);
    assert.deepEqual(clockLine(four, here(['Ann', 'Bo', 'Cy', 'Di'], ['Ann', 'Di']), 'Ann'), ['Di']);
    assert.deepEqual(clockLine(four, here(['Bo', 'Cy']), 'Ann'), ['Bo', 'Cy']); // a keeper that has gone quiet
    assert.deepEqual(clockLine(members(['Ann', 'Bo', 'Cy'], { Bo: 1 }), here(['Ann', 'Bo', 'Cy']), 'Ann'), ['Cy']);
  });
});

describe('who judges', () => {
  const room = members(['Ann', 'Bo', 'Cy']);

  test('the chain owner judges when here, else the leader, else the first one here', () => {
    const c = chain(prompt('a cat', 'Cy'));
    const names = presentNames(room, here(['Ann', 'Bo', 'Cy']));
    assert.equal(judgeFor(c, names, 'Bo'), 'Cy');
    assert.equal(judgeFor(c, ['Ann', 'Bo'], 'Bo'), 'Bo');
    assert.equal(judgeFor(c, ['Ann', 'Bo'], 'Di'), 'Ann');
  });

  test('an owner who is away is waited for while the chain has only just come up', () => {
    const c = chain(prompt('a cat', 'Cy'));
    assert.equal(judgeFor(c, ['Ann', 'Bo'], 'Bo', ['Ann', 'Bo', 'Cy']), '');
    assert.equal(judgeFor(c, ['Ann', 'Bo', 'Cy'], 'Bo', ['Ann', 'Bo', 'Cy']), 'Cy'); // back in time
    assert.equal(judgeFor(c, ['Ann', 'Bo'], 'Bo', []), 'Bo'); // the wait is over
    assert.equal(judgeFor(c, ['Ann', 'Bo'], 'Bo', ['Ann', 'Bo']), 'Bo'); // they left the game: no wait
  });

  test('the owner missed judging unless they judged all of it, and have not left', () => {
    assert.deepEqual(judgingMissed('Cy', 'Cy', false, false, true), []);
    assert.deepEqual(judgingMissed('Cy', 'Bo', false, false, true), ['Cy']); // a stand-in committed it
    assert.deepEqual(judgingMissed('Cy', 'Cy', true, false, true), ['Cy']); // came back part way
    assert.deepEqual(judgingMissed('Cy', 'Ann', false, true, true), ['Cy']); // ran out of time
    assert.deepEqual(judgingMissed('Cy', 'Bo', true, true, false), []); // left the game
  });
});

// Missing anything in a round costs one point for that round, however much
// was missed, and backgrounding the app doesn't get out of it. Only in a game
// where every phone knows the rule: a 2.9.0 phone scores a point for every
// blank drawing, and every phone in its game does the same.
describe('a point a round for anything missed (rules 2)', () => {
  const docks = (chainIdx = 0): Docks => ({ docked: new Set(), at: {}, chain: chainIdx });

  test('a player who misses three turns in a round loses one point', () => {
    const d = docks();
    const scores: Record<string, number> = {};
    const one = chain(prompt('a cat', 'Ann'), blankDrawing('Bo'), caption('Cy', ''), blankDrawing('Bo'));
    tallyRulings(one, {}, {}, scores, true, d);
    const two = chain(prompt('a dog', 'Cy'), blankDrawing('Bo'));
    tallyRulings(two, {}, {}, scores, true, { ...d, chain: 1 });
    assert.deepEqual(scores, { Bo: -1, Cy: -1 });
    assert.equal(d.at.Bo, '0:1', 'the −1 shows at the first one the reveal reaches');
  });

  test('an empty guess costs the point too', () => {
    const scores: Record<string, number> = {};
    tallyRulings(chain(prompt('a cat', 'Ann'), drawing('Bo'), caption('Cy', '  ')), { 1: true, 2: false }, {}, scores, false, docks());
    assert.deepEqual(scores, { Bo: 1, Cy: -1 });
  });

  test('a ✓ still scores as before', () => {
    const scores: Record<string, number> = {};
    tallyRulings(chain(prompt('a cat', 'Ann'), drawing('Bo'), caption('Cy', 'a cat')), { 1: true, 2: true }, {}, scores, true, docks());
    assert.deepEqual(scores, { Bo: 1, Cy: 1 });
  });

  test('a turn taken out of the rotation, or filled in after the player left, costs nothing', () => {
    const scores: Record<string, number> = {};
    const c = chain(
      prompt('a cat', 'Ann'),
      { kind: 'drawing', data: '', author: 'Bo', skip: true },
      { kind: 'caption', text: '', author: 'Cy', left: true }
    );
    tallyRulings(c, {}, {}, scores, true, docks());
    assert.deepEqual(scores, {});
    assert.ok(!isMissedTurn(c.cells[1]) && !isMissedTurn(c.cells[2]));
  });

  test('2.9.0 rules still cost a point for every blank drawing, and nothing for an empty guess', () => {
    const scores: Record<string, number> = {};
    const c = chain(prompt('a cat', 'Ann'), blankDrawing('Bo'), caption('Cy', ''), blankDrawing('Bo'));
    tallyRulings(c, {}, {}, scores, true);
    assert.deepEqual(scores, { Bo: -2 });
  });

  test('a game is played to the new rule only if every player is known to have it', () => {
    const room = members(['Ann', 'Bo', 'Cy']);
    const all = new Map([['id-Ann', 2], ['id-Bo', 2], ['id-Cy', 2]]);
    assert.equal(gameRules(room, all), 2);
    assert.equal(gameRules(room, new Map([['id-Ann', 2], ['id-Bo', 2]])), 1); // Cy never said: 2.9.0
    assert.equal(gameRules(members(['Ann', 'Bo', 'Cy'], { Cy: 1 }), new Map([['id-Ann', 2], ['id-Bo', 2]])), 2); // Cy left
    assert.equal(asRules(null), 1);
    assert.equal(asRules(2), 2);
    assert.equal(asRules(7), 2); // a later app's rules: the most this one knows
  });
});

// Bug: a drawing screen that slept through its deadline woke before the phone
// had caught up, handed in its turn and went to "Please wait", and the drawing
// turned up in a chain the next player had already moved on from.
describe('a turn handed in long after its time was up', () => {
  test('late only past the grace for last-second turns', () => {
    assert.equal(isLate(10_000, 12_000), false);
    assert.equal(isLate(10_000, 13_000), false);
    assert.equal(isLate(10_000, 13_001), true);
    assert.equal(isLate(0, 99_000), false); // no deadline known
  });
});
