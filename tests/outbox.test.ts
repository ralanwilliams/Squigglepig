import { afterEach, beforeEach, describe, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { installOutbox } from '../src/state/game/outbox';
import { CHUNK_AT, CHUNK_GAP_MS } from '../src/lib/chunks';

// Everything sent on the room's channel goes out in the order it was sent,
// a message too big for the channel in pieces, a moment apart
// (src/state/game/outbox.ts).

type Sent = { event: string; payload: any };
const fakeChannel = () => {
  const sent: Sent[] = [];
  return { sent, send: (m: { event: string; payload: unknown }) => sent.push({ event: m.event, payload: m.payload }) };
};

const outbox = (channel: ReturnType<typeof fakeChannel> | null) => {
  const e: any = { channelRef: { current: channel }, outboxRef: { current: [] }, sendingRef: { current: false } };
  installOutbox(e);
  return e as { channelRef: { current: unknown }; send: (event: string, payload?: unknown) => void };
};

const big = () => ({ data: 'x'.repeat(CHUNK_AT + 10) });

describe('the outbox', () => {
  beforeEach(() => mock.timers.enable({ apis: ['setTimeout'] }));
  afterEach(() => mock.timers.reset());

  test('a small message goes at once', () => {
    const ch = fakeChannel();
    outbox(ch).send('cell', { a: 1 });
    assert.deepEqual(ch.sent, [{ event: 'cell', payload: { a: 1 } }]);
  });

  test('nothing goes without a channel', () => {
    outbox(null).send('cell', { a: 1 }); // no throw
  });

  test('a big message goes in pieces, a moment apart, and what follows waits behind it', () => {
    const ch = fakeChannel();
    const o = outbox(ch);
    o.send('to-reveal', big());
    o.send('advance', { stage: 2 });
    assert.equal(ch.sent.length, 1);
    assert.equal(ch.sent[0].event, 'chunk');
    // Drain: each piece CHUNK_GAP_MS after the last.
    for (let i = 0; i < 10 && ch.sent.at(-1)?.event !== 'advance'; i++) mock.timers.tick(CHUNK_GAP_MS);
    const events = ch.sent.map((s) => s.event);
    assert.ok(events.length >= 3, 'two or more pieces, then the next message');
    assert.ok(events.slice(0, -1).every((ev) => ev === 'chunk'));
    assert.equal(events.at(-1), 'advance');
  });

  test("what's still waiting for a room this phone has left is dropped", () => {
    const ch = fakeChannel();
    const o = outbox(ch);
    o.send('to-reveal', big());
    o.send('advance', { stage: 2 });
    o.channelRef.current = fakeChannel();
    for (let i = 0; i < 10; i++) mock.timers.tick(CHUNK_GAP_MS);
    assert.equal(ch.sent.length, 1);
  });
});
