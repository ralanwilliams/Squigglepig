import type { Avatar } from '../../avatar/avatar';
import type { Entry } from '../../lib/rooms';
import type { Cell, Chain, Phase, Prev, Rules } from '../rules';
import type { PigOff } from '../wire';

export type ConnStatus = 'connecting' | 'connected' | 'error';

// One player's turn: the chain they add to at a stage of a round. A screen
// keeps the turn it was opened for, so what it hands in lands there even if
// the game has moved on meanwhile (submitCell).
export type Turn = { round: number; stage: number; chain: number };
export const turnKey = (t: Turn) => `${t.round}:${t.chain}:${t.stage}`;
export const sameTurn = (a: Turn | null, b: Turn | null) =>
  !!a && !!b && a.round === b.round && a.stage === b.stage && a.chain === b.chain;
// A turn this player handed in: whether it has come back from the channel,
// and how many times it has been sent (turns.ts handIn).
export type Handed = Turn & { cell: Cell; echoed: boolean; tries: number };

// How enterRoom went, and what to tell the player when it didn't (messages.ts
// entryMessage).
export type EntryStatus = Entry['status'] | 'no_keys' | 'no_name' | 'no_code' | 'bad_code';

// What the screens see (useGame).
export type Game = {
  username: string;
  room: string;
  // The host (../rules roomHost): the player in the room longest, away or not.
  // It moves only when they tap Leave game.
  host: string;
  // Whether this player can start the game from the lobby: the host, or,
  // while the host is away, anyone here.
  canStart: boolean;
  // Players whose app is too old to play this one's game (../rules
  // outdatedPlayers): while there are any, no game can start.
  outdated: string[];
  // Everyone in the room, oldest first, whether or not they have the app
  // open (players[0] is the longest in). `away` is the ones who don't.
  players: string[];
  // This round's players, in turn order: roster[c] owns chain c (writes its
  // prompt, judges it). Fixed at the round's start.
  roster: string[];
  away: string[];
  // Played in this game but tapped Leave game: still on the scoreboard.
  departed: string[];
  // Each player's pig as they've dressed it (src/avatar), from their presence.
  // Kept for players who have since left, so a winner who drops out before
  // the scoreboard still shows dressed.
  avatars: Record<string, Avatar>;
  status: ConnStatus;
  statusDetail: string;
  // Round state
  phase: Phase;
  stage: number;
  prev: Prev | null; // what to respond to this stage
  chains: Chain[];
  scores: Record<string, number>;
  target: number;
  leader: string;
  revealIndex: number;
  revealStep: number;
  rulings: Record<number, boolean>;
  judge: string;
  isJudge: boolean;
  // The chain's owner, while the reveal waits for them to come back and
  // judge it (JUDGE_WAIT); '' otherwise.
  judgeWait: string;
  // The game's scoring rules (../rules), and under the per-round rule who has
  // lost this round's point and at which turn (`chain:cell`), for the reveal.
  rules: Rules;
  dockedAt: Record<string, string>;
  // The round number, from 0.
  round: number;
  // This player's turn this stage (null between turns, or watching), and when
  // its clock runs out (epoch ms, this phone's time).
  turn: Turn | null;
  turnEndsAt: number;
  // Who in the round is still writing, drawing or guessing this stage, oldest first,
  // this player aside (../rules stillToGo): the waiting screen lists them,
  // with the time they have left (turnEndsAt).
  stillWorking: string[];
  // Back from a trip out of the app and still catching up: a game screen's
  // clock doesn't run out until it has (Countdown `hold`), since its deadline
  // may be about to move.
  resuming: boolean;
  // Actions
  enterRoom: (room: string | null, username: string, rejoin?: boolean) => Promise<EntryStatus>;
  // Back to the room's screen from elsewhere in the app (Home's Back to room).
  returnToRoom: () => void;
  askToLeave: () => void; // Leave game: "Are you sure?", then out of the room
  startGame: (target: number) => void;
  submitCell: (data: string, forTurn?: Turn | null, closing?: boolean) => void;
  passTurn: (forTurn?: Turn | null) => void;
  vote: (correct: boolean) => void;
  // The Pig Off on now (../rules), or null; when its attempt started on this
  // phone's clock (its screen works out from this where it is: the
  // announcement, the drawing shown, the drawing time, the results); and
  // handing in this player's drawing from memory.
  pigOff: PigOff | null;
  stageStart: number;
  submitPigOff: (strokes: string[]) => void;
  // Dev builds only (undefined otherwise): from the lobby, straight into a
  // Pig Off between this player and `name` (devTieWith).
  devTieWith?: (name: string) => void;
  // Dev builds only (undefined otherwise), for the test players in src/dev:
  // act as if the app went to the background ('background') or came back
  // ('active'), leave the room at once, without "Are you sure?", and send
  // and hear messages between the room's dev tools (./channel.ts).
  dev?: DevControls;
};

export type DevControls = {
  setAppState: (state: 'background' | 'active') => void;
  leaveNow: () => void;
  tell: (payload: object) => void;
  listen: (listener: (payload: Record<string, unknown>) => void) => () => void;
};
