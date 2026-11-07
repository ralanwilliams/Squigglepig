import { isBlankDrawing } from '../lib/drawing';
import type { Member } from '../lib/rooms';

// The game's rules, apart from React, the router and the network, so they
// can be tested on their own (tests/rules.test.ts). GameContext holds the
// game and calls these; nothing here changes anything it isn't handed.

// ---- Game model: the "telephone" chain (a Telestrations booklet) ----
//
// A Chain is an alternating list of cells. cells[0] is always a text prompt
// (drawn from the shared pool). Odd indices are drawings, even indices (>=2)
// are captions. Every stage advances every chain by exactly one cell, so all
// players are doing the SAME action each stage (all drawing, or all captioning).
//
// `skip` marks the turn of a player who tapped Leave game while 3 or more
// others carried on: they're out of the rotation, so their turn is passed
// over (not shown at the reveal, no penalty). Every other missed turn is
// filled in empty, under the name of the player who owed it.
export type Cell =
  | { kind: 'prompt'; text: string; author: string }
  | { kind: 'drawing'; data: string; author: string; skip?: true }
  | { kind: 'caption'; text: string; author: string; skip?: true };
export type Chain = { cells: Cell[] };

// What the local player must respond to this stage (the previous cell of their
// assigned chain): text to illustrate, or a drawing to caption. 'blank' is a
// guessing turn with no drawing anywhere before it in the chain (they all came
// back empty): the player writes something for the next one to draw instead.
export type Prev =
  | { kind: 'prompt' | 'caption'; text: string }
  | { kind: 'drawing'; data: string }
  | { kind: 'blank' };

export type Phase = 'lobby' | 'prompts' | 'view' | 'draw' | 'caption' | 'reveal' | 'gameover';

// The live channel's view of a player: they have the app open right now.
// `synced` says their phone holds the game as it stands (it isn't still
// catching up after coming back), which is what makes them fit to host.
export type Presence = { id: string; name: string; synced: boolean };

// The telephone flow needs at least 3 players: with 2, the only person who could
// write a chain's final caption is whoever wrote its prompt, so there is nothing
// to actually guess.
export const MIN_PLAYERS = 3;
// The most a room holds. The server turns away a 13th ('room_full', join_room
// in supabase/rooms.sql, which has the same number).
export const MAX_PLAYERS = 12;

// Prompts needed to seed every chain of every round without ever repeating one.
// Worst case is the "all players maxed, one winner" scenario: a player scores at
// most (N-1) per round, so ⌈target ÷ (N-1)⌉ rounds, each seeding N chains.
export const promptsNeededFor = (players: number, target: number) =>
  players >= 2 ? Math.ceil(target / (players - 1)) * players : Math.max(1, players);

// ---- Prompts ----
// A prompt in the shared pool, and who wrote it.
export type Prompt = { text: string; author: string };
export const promptKey = (p: Prompt) => `${p.author}\u0000${p.text}`;

// The seeds for a round of n chains, taken from the front of the pool. When
// it runs short it's refilled, shuffled, from the prompts not handed out yet
// this game (`used`, which every phone keeps, so a host taking over mid-game
// draws as the last one would have); once every prompt has been used, from
// all of them again (a game that runs long: blank canvases cost points, so
// it can need more rounds than the trough was filled for). With no prompts
// at all, the fallbacks.
export function drawSeeds(
  pool: Prompt[],
  all: Prompt[],
  used: Set<string>,
  n: number,
  shuffle: <T>(a: T[]) => T[],
  fallback: string[]
): { seeds: Prompt[]; pool: Prompt[] } {
  let next = pool.filter((p) => !used.has(promptKey(p)));
  if (next.length < n) {
    const source = all.length ? all : fallback.map((text) => ({ text, author: '' }));
    const fresh = source.filter((p) => !used.has(promptKey(p)));
    next = shuffle(fresh.length >= n ? fresh : source);
  }
  const seeds: Prompt[] = [];
  for (let i = 0; i < n; i++) seeds.push(next.shift() ?? { text: fallback[i % fallback.length], author: '' });
  return { seeds, pool: next };
}

// A blank drawing — an empty canvas handed in, or the clock running out —
// costs the player who owed it a point, whether they were here or away.
export const isBlankCell = (c: Cell | undefined) => !!c && c.kind === 'drawing' && !c.skip && isBlankDrawing(c.data);

// A turn with nothing in it: skipped, a blank drawing, or an empty guess. The
// reveal marks it ✗ by itself (there's nothing to judge), or passes over it if
// it was skipped, and the next player in the chain is handed the last turn
// before it that has something in it (prevFor).
export const isEmptyTurn = (c: Cell | undefined) =>
  !!c && c.kind !== 'prompt' && (!!c.skip || (c.kind === 'drawing' ? isBlankDrawing(c.data) : !(c.text ?? '').trim()));

export const isSkipped = (c: Cell | undefined) => !!c && c.kind !== 'prompt' && !!c.skip;

// ---- Two copies of the same turn ----
// The one this phone has and one arriving (the host's next-stage message, the
// reveal's chains, the host's answer when catching up, or the player handing
// it in again): whichever has something in it. A turn handed in is never
// replaced by an empty one — the host fills a turn it never received with a
// blank, and that blank mustn't wipe the drawing every other phone did
// receive. An empty one gives way to a real one, which is how a turn that
// went missing on its way to the host is mended when it's handed in again.
export function mergeCell(have: Cell | undefined, incoming: Cell | undefined): Cell | undefined {
  if (!incoming) return have;
  if (!have || have.kind === 'prompt' || incoming.kind === 'prompt') return incoming;
  return isEmptyTurn(incoming) && !isEmptyTurn(have) ? have : incoming;
}

// The same for whole chains, when they're the same round's: a chain whose
// prompt doesn't match is another round's, and the incoming one stands.
export function mergeChains(have: Chain[], incoming: Chain[]): Chain[] {
  return incoming.map((chain, c) => {
    const mine = have[c];
    const same = mine?.cells[0]?.kind === 'prompt' && chain.cells[0]?.kind === 'prompt' && mine.cells[0].text === chain.cells[0].text;
    if (!same) return chain;
    const length = Math.max(mine.cells.length, chain.cells.length);
    return { cells: Array.from({ length }, (_, i) => mergeCell(mine.cells[i], chain.cells[i])) as Cell[] };
  });
}

// ---- Stages ----
// Stage 0 is Round 1's "view" (read the prompt of the chain you own); after
// that odd stages draw and even ones caption.
export const phaseForStage = (s: number): Phase => (s === 0 ? 'view' : s % 2 === 1 ? 'draw' : 'caption');

// The phases a round is played in, turn by turn (the reveal comes after).
export const isTurnPhase = (p: Phase) => p === 'view' || p === 'draw' || p === 'caption';

// A game is on from the prompts to the last chain's reveal.
export const isGameOn = (p: Phase) => p !== 'lobby' && p !== 'gameover';

// At stage s, player at roster position `pos` handles chain (pos - s) mod N.
// Over stages 1..N-1 this hands each chain to every player except (implicitly)
// never lets anyone touch the same chain twice. chainForStage(pos, 0) === pos:
// at the view stage you're handed the very chain you own.
export const chainForStage = (pos: number, s: number, n: number) => (((pos - s) % n) + n) % n;

// Who is responsible for chain c at stage s (the inverse of chainForStage).
export const playerForChain = (roster: string[], c: number, s: number) =>
  roster.length ? roster[(c + s) % roster.length] : undefined;

// Production runs stages 1..(n-1): each of the n-1 players who don't OWN a chain
// adds exactly one cell to it, so by the end everyone has touched every chain
// (the owner via the Round 1 view). Scoring judges every cell against the
// original prompt, so it doesn't matter whether the last cell is a drawing.
export const finalStage = (n: number) => Math.max(1, n - 1);

// What the player handed `chain` at stage s responds to: the cell before
// theirs, or, when that turn came back empty, the last one before it that
// has something in it, so a chain never dies on a blank. A drawing turn
// always finds text (the prompt at worst); a guessing turn with no drawing
// anywhere before it gets 'blank'.
export function prevFor(chain: Chain | undefined, s: number): Prev | null {
  if (!chain) return null;
  const wantDrawing = s % 2 === 0;
  for (let i = s - 1; i >= 0; i--) {
    const c = chain.cells[i];
    if (!c || isEmptyTurn(c)) continue;
    if (wantDrawing && c.kind === 'drawing') return { kind: 'drawing', data: c.data };
    if (!wantDrawing && c.kind !== 'drawing') return { kind: c.kind, text: c.text };
  }
  return wantDrawing ? { kind: 'blank' } : null;
}

// The reveal shows a chain's cells from 1 on, passing over skipped turns.
// The first one shown after `from`; past the end means nothing is left.
export function nextShown(chain: Chain | undefined, from: number) {
  let i = from + 1;
  while (chain && i < chain.cells.length && isSkipped(chain.cells[i])) i++;
  return i;
}

// Who is out of this round's rotation: roster players who tapped Leave game,
// taken in the order they left, while 3 or more of the roster were still in
// after them. Worked out from the server's list on every phone alike, so a
// host handover agrees on it.
export function computeSkips(phase: Phase, roster: string[], members: Member[]): Set<string> {
  const skip = new Set<string>();
  if (!isTurnPhase(phase)) return skip;
  const leftAt = new Map(members.filter((m) => m.leftAt != null).map((m) => [m.name, m.leftAt as number]));
  const gone = roster.filter((nm) => leftAt.has(nm)).sort((a, b) => leftAt.get(a)! - leftAt.get(b)!);
  let remaining = roster.length;
  for (const nm of gone) {
    remaining -= 1;
    if (remaining >= MIN_PLAYERS) skip.add(nm);
  }
  return skip;
}

// Score rulings as they land: every drawing or guess the judge marked as
// matching the ORIGINAL PROMPT earns that cell's author +1, the moment the
// judge rules it. (So both correct guesses and the drawings that faithfully
// carried the prompt score.) Every blank drawing costs its author 1, when
// the reveal reaches it or, at the latest, when its chain is committed
// (`final`). Each cell is counted once — `tallied` remembers which of the
// current chain's cells are already in the totals — so the ✓ beat, the
// chain's final commit and the host's timeout fallback all pass through
// here without double-counting. Changes `tallied` and `scores` in place, and
// says whether any score moved.
export function tallyRulings(
  chain: Chain,
  ruled: Record<number, boolean>,
  tallied: Record<number, boolean>,
  scores: Record<string, number>,
  final = false
): boolean {
  let moved = false;
  chain.cells.forEach((c, i) => {
    if (!c || c.kind === 'prompt' || tallied[i] !== undefined) return;
    const blank = isBlankCell(c);
    if (ruled[i] === undefined && !(final && blank)) return;
    tallied[i] = ruled[i] ?? false;
    if (!c.author) return;
    if (blank) {
      scores[c.author] = (scores[c.author] ?? 0) - 1;
      moved = true;
    } else if (ruled[i] && !c.skip) {
      scores[c.author] = (scores[c.author] ?? 0) + 1;
      moved = true;
    }
  });
  return moved;
}

// ---- Messages that come late ----
// The live channel delivers in order, but a phone that was off screen (another
// app, a locked phone, a hidden browser tab) can wake with timers that fire
// before it has caught up, and what it sends then still goes out (over the web
// when its connection is down). Such a message belongs to a moment the room
// has moved past. Applied, it would wind every phone back: a reveal starting
// over and scoring again, a stage handed out twice, a drawing overwritten by
// an older blank. So every game message carries the round it belongs to (apps
// from before this was added send none: null), and each phone holds it up
// against where its own game is, and either applies it, ignores it as late
// ('stale'), or, when it shows this phone has missed something, catches up
// from the host ('resync', which is always safe: the host's answer is the
// game as it stands). A message without a round that could be either late or
// ahead is a resync.
export type Position = {
  phase: Phase;
  round: number;
  stage: number;
  revealIndex: number;
  revealStep: number;
  chains: number; // how many chains this round has
};
export type Verdict = 'apply' | 'stale' | 'resync';

const byRound = (at: Position, round: number | null): Verdict | null =>
  round === null ? null : round < at.round ? 'stale' : round > at.round ? 'resync' : null;

// 'round': a round starts (the first from the prompts, the next once the
// last chain of a reveal is scored).
export function verdictForRound(at: Position, round: number): Verdict {
  if (at.phase === 'prompts') return round === 0 ? 'apply' : 'resync';
  if (at.phase === 'lobby' || at.phase === 'gameover') return 'resync'; // missed the game starting
  if (round <= at.round) return 'stale';
  // Straight on from a finished reveal; anything else skipped scoring.
  return at.phase === 'reveal' && round === at.round + 1 && at.revealIndex >= at.chains ? 'apply' : 'resync';
}

// 'advance': the next stage of the round, with the cells of the last.
export function verdictForAdvance(at: Position, stage: number, round: number | null): Verdict {
  const r = byRound(at, round);
  if (r) return r;
  if (isTurnPhase(at.phase)) return stage === at.stage + 1 ? 'apply' : stage <= at.stage ? 'stale' : 'resync';
  if (round === null) return 'resync';
  return at.phase === 'reveal' || at.phase === 'gameover' ? 'stale' : 'resync';
}

// 'to-reveal': the round's last stage is in; the chains as they ended.
export function verdictForToReveal(at: Position, round: number | null): Verdict {
  const r = byRound(at, round);
  if (r) return r;
  if (isTurnPhase(at.phase)) return 'apply';
  if (round === null) return 'resync';
  return at.phase === 'reveal' || at.phase === 'gameover' ? 'stale' : 'resync';
}

// 'cell': a turn handed in (or handed in again, see mergeCell). In the reveal
// only one not shown yet, or the one on screen, can still change (GameContext
// leaves one that's already been ruled alone).
export function verdictForCell(at: Position, chain: number, stage: number, round: number | null): Verdict {
  const r = byRound(at, round);
  if (r) return r;
  if (isTurnPhase(at.phase)) return 'apply';
  if (at.phase === 'reveal') {
    return chain > at.revealIndex || (chain === at.revealIndex && stage >= at.revealStep) ? 'apply' : 'stale';
  }
  return 'stale'; // no round's chains to put it in
}

// 'view-ack': a player has read their Round 1 prompt.
export function verdictForViewAck(at: Position, round: number | null): Verdict {
  if (round !== null && round !== at.round) return 'stale';
  return at.phase === 'view' ? 'apply' : 'stale';
}

// 'reveal-state': the judge moved the reveal on, or ruled the cell shown.
export function verdictForRevealStep(at: Position, chain: number, step: number, round: number | null): Verdict {
  const r = byRound(at, round);
  if (r) return r;
  if (at.phase !== 'reveal') return isTurnPhase(at.phase) ? 'resync' : 'stale';
  if (chain !== at.revealIndex) return chain < at.revealIndex ? 'stale' : 'resync';
  return step >= at.revealStep ? 'apply' : 'stale';
}

// 'chain-scored': the chain being revealed is done.
export function verdictForChainScored(at: Position, chain: number, round: number | null): Verdict {
  const r = byRound(at, round);
  if (r) return r;
  if (at.phase !== 'reveal') return isTurnPhase(at.phase) ? 'resync' : 'stale';
  if (chain === at.revealIndex) return 'apply';
  return chain < at.revealIndex ? 'stale' : 'resync';
}

// 'game-over'.
export function verdictForGameOver(at: Position, round: number | null): Verdict {
  const r = byRound(at, round);
  if (r) return r;
  return at.phase === 'gameover' ? 'stale' : 'apply';
}

// ---- Who's who ----
// Everyone still in the room (not left), oldest first: the round roster.
export const activeMembers = (members: Member[]) => members.filter((m) => m.leftAt == null);

// The ones with the app open right now.
export function presentNames(members: Member[], presence: Presence[]): string[] {
  const here = new Set(presence.map((p) => p.id));
  return activeMembers(members)
    .filter((m) => here.has(m.id))
    .map((m) => m.name);
}

// The host: the longest in among those here and caught up, or, if nobody
// is, the longest in who's here (who then restores the game).
export function electHost(members: Member[], presence: Presence[]): string {
  const here = new Map(presence.map((p) => [p.id, p]));
  const present = activeMembers(members).filter((m) => here.has(m.id));
  const synced = present.filter((m) => here.get(m.id)!.synced);
  return (synced[0] ?? present[0])?.name ?? '';
}

// The round leader judges the reveal, but if they don't have the app open
// the role falls to the host (the earliest joiner here) so it never stalls.
export const effectiveLeader = (leader: string, names: string[]) =>
  leader && names.includes(leader) ? leader : (names[0] ?? '');

// Judge = the chain's original prompt author, if they have the app open;
// otherwise the round leader / host takes over so a chain never stalls on
// someone who isn't there.
export function judgeFor(chain: Chain | undefined, names: string[], leader: string): string {
  const first = chain?.cells[0];
  const author = first && first.kind === 'prompt' ? first.author : '';
  if (author && names.includes(author)) return author;
  return effectiveLeader(leader, names);
}
