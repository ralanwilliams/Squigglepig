import { isBlankDrawing } from '../lib/drawing';
import { HOST_GRACE } from '../lib/timers';
import type { Member } from '../lib/rooms';

// The game's rules, apart from React, the router and the network, so they
// can be tested on their own (tests/rules.test.ts). GameContext holds the
// game and calls these; nothing here changes anything it isn't handed.

// ---- Game model: the "telephone" chain (a Telestrations booklet) ----
//
// A Chain is an alternating list of cells. cells[0] is always a text prompt,
// written by the chain's owner at the start of the round (stage 0). Odd
// indices are drawings, even indices (>=2) are captions. Every stage advances every chain by exactly one cell, so all
// players are doing the SAME action each stage (all drawing, or all captioning).
//
// `skip` marks the turn of a player who tapped Leave game while 3 or more
// others carried on: they're out of the rotation, so their turn is passed
// over (not shown at the reveal, no penalty). `left` marks one filled in
// empty for a player who left when fewer would have carried on: shown at the
// reveal as theirs ("left the game"), and, under the per-round rule, no
// penalty. Every other missed turn is filled in empty, under the name of the
// player who owed it. (2.9.0 reads neither `left` nor the per-round rule:
// gameRules keeps a game with it in on 2.9.0's scoring.)
export type Cell =
  | { kind: 'prompt'; text: string; author: string }
  | { kind: 'drawing'; data: string; author: string; skip?: true; left?: true }
  | { kind: 'caption'; text: string; author: string; skip?: true; left?: true };
export type Chain = { cells: Cell[] };

// What the local player must respond to this stage (the previous cell of their
// assigned chain): text to illustrate, or a drawing to caption. 'blank' is a
// guessing turn with no drawing anywhere before it in the chain (they all came
// back empty): the player writes something for the next one to draw instead.
export type Prev =
  | { kind: 'prompt' | 'caption'; text: string }
  | { kind: 'drawing'; data: string }
  | { kind: 'blank' };

// 'prompts' is every round's first stage (stage 0): each player writes the
// prompt their own chain starts from.
export type Phase = 'lobby' | 'prompts' | 'draw' | 'caption' | 'reveal' | 'gameover';

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

// A turn the player owed and didn't hand in while they were still in the
// game: a blank drawing or an empty guess, whether the canvas was handed in
// empty, the clock ran out, or they were away. Not a turn they were taken out
// of, or one filled in after they left.
export const isMissedTurn = (c: Cell | undefined) =>
  !!c && c.kind !== 'prompt' && !c.skip && !c.left && isEmptyTurn(c);

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
// prompt doesn't match is another round's, and the incoming one stands. While
// the round's prompts are still coming in, a chain may have none yet on
// either side: then it's merged like any other turn. One with a prompt and
// nothing after it may meet one with no prompt yet (the room's copy is
// missing it); one that has gone further than its prompt is another game's.
export function mergeChains(have: Chain[], incoming: Chain[]): Chain[] {
  return incoming.map((chain, c) => {
    const mine = have[c];
    const a = mine?.cells[0];
    const b = chain.cells[0];
    const same =
      !!mine &&
      (a && b
        ? a.kind === 'prompt' && b.kind === 'prompt' && a.text === b.text
        : !b
          ? mine.cells.length <= 1
          : chain.cells.length <= 1);
    if (!same) return chain;
    const length = Math.max(mine.cells.length, chain.cells.length);
    return { cells: Array.from({ length }, (_, i) => mergeCell(mine.cells[i], chain.cells[i])) as Cell[] };
  });
}

// ---- Stages ----
// Stage 0 is the round's prompts (each player writes the one their own chain
// starts from); after that odd stages draw and even ones caption.
export const phaseForStage = (s: number): Phase => (s === 0 ? 'prompts' : s % 2 === 1 ? 'draw' : 'caption');

// The phases a round is played in, turn by turn (the reveal comes after).
export const isTurnPhase = (p: Phase) => p === 'prompts' || p === 'draw' || p === 'caption';

// A game is on from the prompts to the last chain's reveal.
export const isGameOn = (p: Phase) => p !== 'lobby' && p !== 'gameover';

// At stage s, player at roster position `pos` handles chain (pos - s) mod N.
// Over stages 1..N-1 this hands each chain to every player except (implicitly)
// never lets anyone touch the same chain twice. chainForStage(pos, 0) === pos:
// the prompt you write starts the very chain you own, and nobody draws their
// own prompt (stage 1 hands chain c to the player after its owner).
export const chainForStage = (pos: number, s: number, n: number) => (((pos - s) % n) + n) % n;

// Who is responsible for chain c at stage s (the inverse of chainForStage).
export const playerForChain = (roster: string[], c: number, s: number) =>
  roster.length ? roster[(c + s) % roster.length] : undefined;

// Who in the round still owes stage s's turn (still drawing, or still
// guessing), in roster order: the chain they're on has nothing for the stage
// yet. Not anyone out of the rotation (`skip`), nor `me`. Nobody left means
// the stage is settled (the keeper moves on); the waiting screen lists them.
export function stillToGo(roster: string[], chains: Chain[], s: number, skip: Set<string>, me = ''): string[] {
  return roster.filter(
    (name, pos) => name !== me && !skip.has(name) && !chains[chainForStage(pos, s, roster.length)]?.cells[s]
  );
}

// Production runs stages 1..(n-1): each of the n-1 players who don't OWN a chain
// adds exactly one cell to it, so by the end everyone has touched every chain
// (the owner by writing its prompt). Scoring judges every cell against the
// original prompt, so it doesn't matter whether the last cell is a drawing.
export const finalStage = (n: number) => Math.max(1, n - 1);

// What the player handed `chain` at stage s responds to: the cell before
// theirs, or, when that turn came back empty, the last one before it that
// has something in it, so a chain never dies on a blank. A drawing turn
// always finds text (the prompt at worst); a guessing turn with no drawing
// anywhere before it gets 'blank'.
export function prevFor(chain: Chain | undefined, s: number): Prev | null {
  if (!chain || s < 1) return null;
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
// keeper handover agrees on it. (One that would leave fewer ends the game:
// the server closes the room. Only a server still on 2.9.0's rooms.sql lets
// the round play on without them.)
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

// ---- Scoring ----
// Two sets of rules, because phones on 2.9.0 still play in the same rooms:
//   1 — 2.9.0's: every blank drawing costs its artist a point.
//   2 — a point a round: anyone who missed anything in a round (a blank
//       drawing, an empty guess, or not being there to judge their own
//       chain) loses one point for that round, however much they missed.
// Every phone scores the game itself, as the reveal goes, so a game is only
// played to rules 2 if every player in it has an app that knows them; each
// phone says which rules it knows in its presence (PROTOCOL; 2.9.0 says
// nothing). Whoever starts the game decides, and it travels with the game.
//
// 3 is the round flow: every round starts with each player writing a prompt
// (stage 0), with no shared pool and no Round 1 view. A phone that knows only
// 2 or less plays a different game (it waits on a trough nobody fills), so a
// game can't be started while one is in the room (outdatedPlayers), and a
// game started by one is refused (GameContext to-prompts).
export const PROTOCOL = 3;
export const ROUND_FLOW = 3;

// Who in the room has an app too old for this one's game (ROUND_FLOW), by
// name: those whose presence has said which version they are, or, said
// nothing (2.9.0). A player never seen here (away the whole time) isn't
// known, and doesn't hold the game up.
export function outdatedPlayers(members: Member[], versions: Map<string, number>): string[] {
  return activeMembers(members)
    .filter((m) => versions.has(m.id) && (versions.get(m.id) ?? 1) < ROUND_FLOW)
    .map((m) => m.name);
}
export type Rules = 1 | 2;
export function gameRules(members: Member[], versions: Map<string, number>): Rules {
  const all = activeMembers(members);
  return all.length > 0 && all.every((m) => (versions.get(m.id) ?? 1) >= 2) ? 2 : 1;
}
// Rules a game message names, kept to ones this app knows (none: 2.9.0's).
export const asRules = (n: number | null): Rules => (n !== null && n >= 2 ? 2 : 1);

// Under rules 2, who has already lost this round's point, and where (which
// turn, `chain:cell`, or `chain:judge` for a chain they missed judging), so
// the reveal shows the −1 there and nowhere else.
export type Docks = { docked: Set<string>; at: Record<string, string>; chain: number };

// Take this round's point off `name`, unless it's gone already. Says whether it went.
export function dock(docks: Docks, scores: Record<string, number>, name: string, where: string): boolean {
  if (!name || docks.docked.has(name)) return false;
  docks.docked.add(name);
  docks.at[name] = where;
  scores[name] = (scores[name] ?? 0) - 1;
  return true;
}

// Score rulings as they land: every drawing or guess the judge marked as
// matching the ORIGINAL PROMPT earns that cell's author +1, the moment the
// judge rules it. (So both correct guesses and the drawings that faithfully
// carried the prompt score.) A turn that costs a point — a blank drawing
// (rules 1), or any missed turn (rules 2: `docks`, at most once a round)
// costs it when the reveal reaches it or, at the latest, when its chain is
// committed (`final`). Each cell is counted once — `tallied` remembers which
// of the current chain's cells are already in the totals — so the ✓ beat, the
// chain's final commit and the keeper's timeout fallback all pass through
// here without double-counting. Changes `tallied`, `scores` and `docks` in
// place, and says whether any score moved.
export function tallyRulings(
  chain: Chain,
  ruled: Record<number, boolean>,
  tallied: Record<number, boolean>,
  scores: Record<string, number>,
  final = false,
  docks?: Docks
): boolean {
  let moved = false;
  chain.cells.forEach((c, i) => {
    if (!c || c.kind === 'prompt' || tallied[i] !== undefined) return;
    const costs = docks ? isMissedTurn(c) : isBlankCell(c);
    if (ruled[i] === undefined && !(final && costs)) return;
    tallied[i] = ruled[i] ?? false;
    if (!c.author) return;
    if (costs) {
      if (!docks) {
        scores[c.author] = (scores[c.author] ?? 0) - 1;
        moved = true;
      } else if (dock(docks, scores, c.author, `${docks.chain}:${i}`)) {
        moved = true;
      }
    } else if (ruled[i] && !c.skip) {
      scores[c.author] = (scores[c.author] ?? 0) + 1;
      moved = true;
    }
  });
  return moved;
}

// Whether a chain's owner missed judging it (rules 2), as whoever commits the
// chain sees it, and says in their message so every phone docks the same:
// they did unless they judged all of it themselves — nobody stood in for
// them (`stoodIn`, `by`), and it didn't run out of time — or they've left.
export function judgingMissed(owner: string, by: string, stoodIn: boolean, timedOut: boolean, stillIn: boolean): string[] {
  return owner && stillIn && (timedOut || stoodIn || by !== owner) ? [owner] : [];
}

// ---- A turn handed in too late ----
// One handed in this long after its time was up (past the keeper's grace for
// last-second turns) comes from a screen that slept through its deadline:
// the room may well have moved past it.
export const isLate = (endsAt: number, now: number) => endsAt > 0 && now > endsAt + (HOST_GRACE + 1) * 1000;

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
// from the room ('resync', which is always safe: the answer is the game as it
// stands). A message without a round that could be either late or ahead is a
// resync. It's also why two phones moving the game on at once (the keeper and
// a phone standing in for it) is harmless: the second message is late.
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

// 'round': the next round starts, once the last chain of a reveal is scored.
// (Round 0 comes with the game's start: 'to-prompts'.)
export function verdictForRound(at: Position, round: number): Verdict {
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
// leaves one that's already been ruled alone). A prompt only while the round's
// prompts are still open: once the drawing has started, a stand-in has taken
// its place (one that came too late), and the drawing is of that.
export function verdictForCell(at: Position, chain: number, stage: number, round: number | null): Verdict {
  const r = byRound(at, round);
  if (r) return r;
  if (stage === 0) return at.phase === 'prompts' ? 'apply' : 'stale';
  if (isTurnPhase(at.phase)) return 'apply';
  if (at.phase === 'reveal') {
    return chain > at.revealIndex || (chain === at.revealIndex && stage >= at.revealStep) ? 'apply' : 'stale';
  }
  return 'stale'; // no round's chains to put it in
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

// The HOST: the player in the room longest, whether or not they have the app
// open. It's the room's server-side list, so closing the app or losing signal
// never moves it; tapping Leave game does, to whoever has been in longest
// after them. (While the host is away, anyone here can start the game:
// GameContext canStart.)
export const roomHost = (members: Member[]) => activeMembers(members)[0]?.name ?? '';

// The KEEPER of the game's clock, apart from the host: one phone that has to
// be on screen to run the stage timers, move the game on and save it to the
// server. The longest in among those here and caught up, or, if nobody is,
// the longest in who's here (who then restores the game). Players never see
// it. (2.9.0 elects its "host" the same way, so mixed rooms agree on it.)
export function electKeeper(members: Member[], presence: Presence[]): string {
  const here = new Map(presence.map((p) => [p.id, p]));
  const present = activeMembers(members).filter((m) => here.has(m.id));
  const synced = present.filter((m) => here.get(m.id)!.synced);
  return (synced[0] ?? present[0])?.name ?? '';
}

// The phones that step in for the keeper when it goes quiet (moving the game
// on, answering a phone that's catching up), in the order they do: everyone
// here and caught up, longest in first, the keeper aside.
export function clockLine(members: Member[], presence: Presence[], keeper: string): string[] {
  const here = new Map(presence.map((p) => [p.id, p]));
  return activeMembers(members)
    .filter((m) => here.get(m.id)?.synced && m.name !== keeper)
    .map((m) => m.name);
}

// The round leader judges the reveal, but if they don't have the app open
// the role falls to the first one here (the longest in) so it never stalls.
export const effectiveLeader = (leader: string, names: string[]) =>
  leader && names.includes(leader) ? leader : (names[0] ?? '');

// Who owns a chain: the player whose prompt it starts from (they judge it).
export function chainOwner(chain: Chain | undefined): string {
  const first = chain?.cells[0];
  return first && first.kind === 'prompt' ? first.author : '';
}

// Judge = the chain's owner, if they have the app open (`names`). If they're
// away but still in the game, and the chain has only just come up, nobody
// yet: the reveal waits for them (`waitFor`, everyone still in the room until
// the wait is over). Otherwise the round leader, or the first one here, judges
// in their place, so a chain never stalls on someone who isn't there.
export function judgeFor(chain: Chain | undefined, names: string[], leader: string, waitFor: string[] = []): string {
  const owner = chainOwner(chain);
  if (owner && names.includes(owner)) return owner;
  if (owner && waitFor.includes(owner)) return '';
  return effectiveLeader(leader, names);
}
