import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { CHUNK_AT, Joiner, MAX_PARTS, split } from '../src/lib/chunks';
import { detailedDrawing } from './helpers/draw';

// Bug: a drawing handed in came out blank. Supabase drops a broadcast over
// 256 KB (free plan) without a word, so a detailed drawing never reached the
// host, which filled the turn in blank; and the host's next-stage message
// (every drawing of the stage) or the reveal's (every chain) could be lost
// the same way. Big messages now go in pieces.

const LIMIT = 256 * 1024;
// The bytes a broadcast takes on the wire, near enough: its JSON, UTF-8.
const wireSize = (event: string, payload: unknown) =>
  Buffer.byteLength(JSON.stringify({ type: 'broadcast', event, payload }), 'utf8');

// A drawing as heavy as a minute of careful shading (the kind that went missing).
const heavy = JSON.stringify({ w: 400, h: 300, strokes: detailedDrawing(7, 120, 300) });

describe('big messages go in pieces', () => {
  test('a heavy drawing really is past the limit as one message', () => {
    const cell = { round: 0, chain: 1, stage: 1, cell: { kind: 'drawing', data: heavy, author: 'Bo' } };
    assert.ok(wireSize('cell', cell) > LIMIT, `only ${wireSize('cell', cell)} bytes`);
  });

  test('small messages go whole, as they always have', () => {
    assert.equal(split('view-ack', { round: 0, username: 'Bo' }, 'x'), null);
  });

  test('a next-stage message with three heavy drawings arrives whole, every piece under the limit', () => {
    const cells = ['Ann', 'Bo', 'Cy'].map((author) => ({ kind: 'drawing', data: heavy, author }));
    const payload = { round: 0, stage: 2, cells };
    const pieces = split('advance', payload, 'adv1');
    assert.ok(pieces && pieces.length > 1);
    for (const p of pieces) assert.ok(wireSize('chunk', p) < LIMIT, `a piece is ${wireSize('chunk', p)} bytes`);
    const joiner = new Joiner();
    let whole: ReturnType<Joiner['add']> = null;
    for (const p of pieces) whole = joiner.add(p) ?? whole;
    assert.deepEqual(whole, { event: 'advance', payload });
    assert.equal(joiner.waiting, 0);
  });

  test('pieces may arrive out of order or twice', () => {
    const payload = { blob: 'x'.repeat(CHUNK_AT * 2) };
    const pieces = split('state', payload, 'st1')!;
    assert.ok(pieces.length >= 3);
    const joiner = new Joiner();
    // Backwards, with the first one twice: whole only when the last is in.
    const arrivals = [...pieces].reverse();
    arrivals.splice(1, 0, pieces[pieces.length - 1]);
    const results = arrivals.map((p) => joiner.add(p));
    assert.ok(results.slice(0, -1).every((r) => r === null));
    assert.deepEqual(results[results.length - 1], { event: 'state', payload });
  });

  test('two messages in pieces at once are kept apart', () => {
    const a = split('state', { who: 'a', blob: 'a'.repeat(CHUNK_AT) }, 'a')!;
    const b = split('state', { who: 'b', blob: 'b'.repeat(CHUNK_AT) }, 'b')!;
    assert.equal(a.length, 3);
    assert.equal(b.length, 3);
    const joiner = new Joiner();
    // Interleaved; b's last piece comes in last, so a is whole first.
    const got = [a[0], b[0], b[1], a[1], a[2], b[2]].map((p) => joiner.add(p)).filter(Boolean);
    assert.deepEqual(got.map((g) => (g!.payload as { who: string }).who), ['a', 'b']);
  });

  test('anything that is not a sound piece is ignored', () => {
    const joiner = new Joiner();
    for (const junk of [null, 'x', 42, {}, { id: 'a', event: 'state', i: 0, n: 0, part: '' }, { id: 'a', event: 'state', i: 2, n: 2, part: '' },
      { id: 'a', event: 'state', i: 0, n: MAX_PARTS + 1, part: '' }, { id: '', event: 'state', i: 0, n: 1, part: '{}' }]) {
      assert.equal(joiner.add(junk), null);
    }
    // A complete message that isn't JSON comes to nothing too.
    assert.equal(joiner.add({ id: 'b', event: 'state', i: 0, n: 1, part: '{nope' }), null);
  });

  test('a message whose pieces never all arrive is given up on', () => {
    let now = 0;
    const joiner = new Joiner(() => now);
    joiner.add({ id: 'lost', event: 'state', i: 0, n: 2, part: '{"a":' });
    assert.equal(joiner.waiting, 1);
    now = 61_000;
    joiner.add({ id: 'next', event: 'state', i: 0, n: 2, part: '{"b":' });
    assert.equal(joiner.waiting, 1);
  });
});
