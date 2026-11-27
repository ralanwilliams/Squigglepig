import { CHUNK_GAP_MS, chunkId, split } from '../../lib/chunks';
import type { Engine, EngineFns } from './engine';

// Everything goes out in the order it's sent. A message too big for the
// channel goes in pieces (src/lib/chunks.ts), a moment apart so a burst of
// them stays inside the channel's rate limit; anything sent meanwhile waits
// its turn behind them, so nobody gets a stage before the game it belongs to.
// (Tested: tests/outbox.test.ts.)
export function installOutbox(e: Pick<Engine, 'channelRef' | 'outboxRef' | 'sendingRef'> & Partial<EngineFns>) {
  const { channelRef, outboxRef, sendingRef } = e;

  const pump = () => {
    if (sendingRef.current) return;
    const next = outboxRef.current.shift();
    if (!next) return;
    if (next.channel !== channelRef.current) return pump(); // left that room
    sendingRef.current = true;
    next.channel.send({ type: 'broadcast', event: next.event, payload: next.payload });
    setTimeout(() => {
      sendingRef.current = false;
      pump();
    }, next.event === 'chunk' ? CHUNK_GAP_MS : 0);
  };
  const send = (event: string, payload: any = {}) => {
    const channel = channelRef.current;
    if (!channel) return;
    const pieces = split(event, payload, chunkId());
    if (!pieces && !sendingRef.current && !outboxRef.current.length) {
      channel.send({ type: 'broadcast', event, payload });
      return;
    }
    if (pieces) for (const piece of pieces) outboxRef.current.push({ channel, event: 'chunk', payload: piece });
    else outboxRef.current.push({ channel, event, payload });
    pump();
  };

  Object.assign(e, { send } satisfies Partial<EngineFns>);
}
