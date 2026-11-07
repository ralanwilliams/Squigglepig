// Big messages on the room's live channel, sent in pieces.
//
// Supabase turns away a broadcast bigger than its payload limit (256 KB on
// the free plan), silently: nobody receives it, the sender included. Most of
// the game's messages are tiny, but drawings travel as JSON, and some
// messages carry many of them: the host's next-stage message has every
// drawing of the stage, the reveal's has every chain, and a player catching
// up gets the whole game. A detailed drawing, or a big room, goes past the
// limit, and that message is simply lost — a drawing handed in that never
// reached the host (who fills the turn in blank), or a stage that never
// arrives.
//
// So a message bigger than CHUNK_AT goes out as numbered 'chunk' messages,
// each well under the limit, and every phone puts them back together and
// hands the whole message to its usual handler. Small messages go as they
// always have, so apps from before this still read everything they could
// before (a message too big for them was lost to them anyway).

// Sent whole up to this many characters of JSON; in pieces above it.
export const CHUNK_AT = 180_000;
// Characters of the message's JSON in each piece.
export const CHUNK_SIZE = 90_000;
// The most pieces one message may come in (~9 MB), and how many messages
// may be half-arrived at once; a piece of anything past either is dropped.
export const MAX_PARTS = 100;
const MAX_OPEN = 16;
// A message still missing pieces after this long is given up on.
const GIVE_UP_MS = 60_000;
// The pause between one piece and the next: the app asks the channel for at
// most 20 messages a second (src/lib/supabase.ts, eventsPerSecond).
export const CHUNK_GAP_MS = 60;

export type Chunk = { id: string; event: string; i: number; n: number; part: string };

// The pieces of `payload`, or null if it goes whole (or is past even
// MAX_PARTS pieces, when it goes whole and is lost, as it always was).
export function split(event: string, payload: unknown, id: string): Chunk[] | null {
  const json = JSON.stringify(payload ?? {});
  if (json.length <= CHUNK_AT) return null;
  const n = Math.ceil(json.length / CHUNK_SIZE);
  if (n > MAX_PARTS) return null;
  return Array.from({ length: n }, (_, i) => ({ id, event, i, n, part: json.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE) }));
}

// Puts pieces back together. `add` takes a piece as it arrived (anything at
// all: a member could send junk) and gives back the whole message once its
// last piece is in, or null.
export class Joiner {
  private open = new Map<string, { event: string; n: number; parts: (string | undefined)[]; got: number; at: number }>();

  constructor(private now: () => number = Date.now) {}

  add(raw: unknown): { event: string; payload: unknown } | null {
    const c = (raw && typeof raw === 'object' ? raw : {}) as Partial<Chunk>;
    const { id, event, i, n, part } = c;
    if (typeof id !== 'string' || !id || id.length > 64) return null;
    if (typeof event !== 'string' || !event || event.length > 40) return null;
    if (!Number.isInteger(n) || !Number.isInteger(i) || n! < 1 || n! > MAX_PARTS || i! < 0 || i! >= n!) return null;
    if (typeof part !== 'string' || part.length > CHUNK_SIZE) return null;
    this.sweep();
    let msg = this.open.get(id);
    if (!msg) {
      if (this.open.size >= MAX_OPEN) return null;
      msg = { event, n: n!, parts: new Array(n!), got: 0, at: this.now() };
      this.open.set(id, msg);
    }
    if (msg.event !== event || msg.n !== n) return null;
    if (msg.parts[i!] === undefined) {
      msg.parts[i!] = part;
      msg.got += 1;
    }
    if (msg.got < msg.n) return null;
    this.open.delete(id);
    try {
      return { event, payload: JSON.parse(msg.parts.join('')) };
    } catch {
      return null;
    }
  }

  // How many messages are waiting on pieces (for the tests).
  get waiting() {
    return this.open.size;
  }

  private sweep() {
    const t = this.now();
    for (const [id, msg] of this.open) if (t - msg.at > GIVE_UP_MS) this.open.delete(id);
  }
}

// A message id, unique enough among one room's messages in flight.
export const chunkId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
