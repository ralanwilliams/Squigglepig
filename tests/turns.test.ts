import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeCell, mergeChains, prevFor, tallyRulings, verdictForCell, type Position } from '../src/state/rules';
import { DRAWN, blankDrawing, caption, chain, drawing, prompt } from './helpers/game';

// Bug: Bo drew, handed it in, and the reveal showed a blank canvas (−1).
// The host never got the drawing, filled Bo's turn in blank when the clock
// ran out, and its next-stage message overwrote the drawing on every phone
// that did have it. Now a blank never overwrites a real turn, and the real
// one, sent again, mends the blank everywhere.

describe('two copies of the same turn (mergeCell)', () => {
  test("the host's blank doesn't overwrite a drawing that was handed in", () => {
    assert.equal(mergeCell(drawing('Bo'), blankDrawing('Bo'))?.kind === 'drawing' && (mergeCell(drawing('Bo'), blankDrawing('Bo')) as { data: string }).data, DRAWN);
  });
  test('the real drawing, sent again, mends the blank', () => {
    assert.deepEqual(mergeCell(blankDrawing('Bo'), drawing('Bo')), drawing('Bo'));
  });
  test('an empty guess gives way to a real one, not the other way round', () => {
    assert.deepEqual(mergeCell(caption('Cy', ''), caption('Cy', 'a cat')), caption('Cy', 'a cat'));
    assert.deepEqual(mergeCell(caption('Cy', 'a cat'), caption('Cy', '')), caption('Cy', 'a cat'));
  });
  test('a turn not here yet is taken as it comes', () => {
    assert.deepEqual(mergeCell(undefined, blankDrawing('Bo')), blankDrawing('Bo'));
    assert.deepEqual(mergeCell(drawing('Bo'), undefined), drawing('Bo'));
  });
});

describe("the reveal's chains against this phone's (mergeChains)", () => {
  test("a drawing this phone has is kept where the host's copy has it blank", () => {
    const mine = [chain(prompt('a cat', 'Ann'), drawing('Bo'), caption('Cy', 'a cat'))];
    const hosts = [chain(prompt('a cat', 'Ann'), blankDrawing('Bo'), caption('Cy', 'a cat'))];
    assert.deepEqual(mergeChains(mine, hosts), mine);
  });
  test("another round's chains are not mixed in", () => {
    const mine = [chain(prompt('a dog', 'Ann'), drawing('Bo'))];
    const hosts = [chain(prompt('a cat', 'Ann'), blankDrawing('Bo'))];
    assert.deepEqual(mergeChains(mine, hosts), hosts);
  });
});

describe('the whole story: a drawing that missed the host', () => {
  test('Bo keeps it, sends it again, and everyone ends up with it — no −1', () => {
    // Stage 1: Bo hands in a drawing for chain 0; the host misses it.
    const onBos = [chain(prompt('a cat', 'Ann'), drawing('Bo'))];
    const onHost = [chain(prompt('a cat', 'Ann'))];
    // The clock runs out; the host fills the turn in blank and moves on.
    onHost[0].cells[1] = blankDrawing('Bo');
    // Bo's phone gets the host's blank with the next stage: it keeps its own.
    onBos[0].cells[1] = mergeCell(onBos[0].cells[1], onHost[0].cells[1])!;
    assert.equal(onBos[0].cells[1].kind === 'drawing' && onBos[0].cells[1].data, DRAWN);
    // Bo sends it again; mid-round it's taken, and mends the host's blank.
    const turns: Position = { phase: 'caption', round: 0, stage: 2, revealIndex: 0, revealStep: 0, chains: 3 };
    assert.equal(verdictForCell(turns, 0, 1, 0), 'apply');
    onHost[0].cells[1] = mergeCell(onHost[0].cells[1], onBos[0].cells[1])!;
    // At the reveal the drawing is there, and nobody loses a point for it.
    const scores: Record<string, number> = {};
    tallyRulings(onHost[0], { 1: true }, {}, scores, true);
    assert.deepEqual(scores, { Bo: 1 });
  });

  test("a turn being shown at the reveal can still be mended until it's ruled", () => {
    const reveal: Position = { phase: 'reveal', round: 0, stage: 2, revealIndex: 1, revealStep: 1, chains: 3 };
    assert.equal(verdictForCell(reveal, 1, 1, 0), 'apply'); // on screen now
    assert.equal(verdictForCell(reveal, 2, 1, 0), 'apply'); // not shown yet
    assert.equal(verdictForCell(reveal, 0, 2, 0), 'stale'); // already scored
  });

  test('the next player still gets something to work from when a drawing is blank', () => {
    const c = chain(prompt('a cat', 'Ann'), blankDrawing('Bo'));
    assert.deepEqual(prevFor(c, 2), { kind: 'blank' });
  });
});
