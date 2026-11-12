import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { router, usePathname } from 'expo-router';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, supabaseReady } from '../lib/supabase';
import { TIMERS, HOST_GRACE, JUDGE_WAIT, BACKUP_AFTER, BACKUP_STAGGER, promptsTime } from '../lib/timers';
import { saveSession, clearSession, savePendingLeave, takePendingLeave } from '../lib/session';
import {
  IDLE_MINUTES,
  createRoom,
  endGameOnServer,
  joinRoom,
  leaveRoomOnServer,
  nudge,
  roomState,
  saveSnapshot,
  startGameOnServer,
  stepAway,
  touchRoom,
  asClosedReason,
  type ClosedReason,
  type Entry,
  type Member,
  type RoomPhase,
} from '../lib/rooms';
import { clearRoomNotifications, registerForPush } from '../lib/push';
import { CHUNK_GAP_MS, Joiner, chunkId, split } from '../lib/chunks';
import { holdsBack, isRoomScreen, leaveCost, lobbyOnCatchUp, navFor } from './nav';
import { newGameBrush } from './brush';
import { stopMusic, MUSIC_FADE_MS } from '../lib/sound';
import { useBackGuard } from '../lib/backGuard';
import { closeConfirm, confirmLeave } from '../lib/confirm';
import { showToast } from '../components/Toast';
import { cleanAvatar, useMyAvatar, wireAvatar, type Avatar } from '../avatar/avatar';
import { NAME_MAX, ROOM_CODE_LENGTH, cleanName, cleanPhrase, cleanRoomCode, isRoomCode } from '../lib/text';
import {
  asCell,
  asCells,
  asChains,
  asIndex,
  asInt,
  asNames,
  asObj,
  asPrompt,
  asRoster,
  asRound,
  asRulings,
  asSeeds,
  asStage,
  asState,
  asTarget,
  type GameState,
} from './wire';
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  PROTOCOL,
  activeMembers as activeOf,
  asRules,
  chainForStage,
  chainOwner,
  clockLine,
  dock,
  drawSeeds as drawSeedsFrom,
  promptKey,
  computeSkips as skipsFor,
  electKeeper as electKeeperOf,
  effectiveLeader as leaderOf,
  finalStage,
  gameRules,
  isEmptyTurn,
  isGameOn,
  isLate,
  isTurnPhase,
  judgeFor,
  judgingMissed,
  mergeCell,
  mergeChains,
  nextShown,
  phaseForStage,
  playerForChain,
  presentNames as presentOf,
  prevFor,
  promptsNeededFor,
  roomHost,
  stillToGo,
  tallyRulings as tally,
  verdictForAdvance,
  verdictForCell,
  verdictForChainScored,
  verdictForGameOver,
  verdictForRevealStep,
  verdictForRound,
  verdictForToReveal,
  verdictForViewAck,
  type Cell,
  type Chain,
  type Docks,
  type Phase,
  type Position,
  type Presence,
  type Prev,
  type Prompt,
  type Rules,
  type Verdict,
} from './rules';

// The game's rules live in ./rules (tested on their own); the screens take
// what they need of them from here, as they always have.
export { NAME_MAX, MAX_PLAYERS, MIN_PLAYERS, promptsNeededFor };
export { isBlankCell, isEmptyTurn } from './rules';
export type { Cell, Chain, Phase, Prev, Rules } from './rules';

export type ConnStatus = 'connecting' | 'connected' | 'error';

// One player's turn: the chain they add to at a stage of a round. A screen
// keeps the turn it was opened for, so what it hands in lands there even if
// the game has moved on meanwhile (submitCell).
export type Turn = { round: number; stage: number; chain: number };
const turnKey = (t: Turn) => `${t.round}:${t.chain}:${t.stage}`;
const sameTurn = (a: Turn | null, b: Turn | null) =>
  !!a && !!b && a.round === b.round && a.stage === b.stage && a.chain === b.chain;
type Handed = Turn & { cell: Cell; echoed: boolean; tries: number };
// A turn handed in that hasn't come back from the channel after this long is
// sent again, up to HAND_IN_TRIES times in all.
const HAND_IN_RETRY_MS = 4000;
const HAND_IN_TRIES = 3;
// How long the judge's phone waits on an empty turn before marking it ✗, so a
// turn being sent again (mend) can land first.
const AUTO_RULE_MS = 2000;
// Catching up (resync): asks for the game this often, and after this many
// asks with no answer picks it up from the server's copy instead (restore).
const ASK_EVERY_MS = 2000;
const ASK_TRIES = 3;
// Answering a phone that's catching up (onRequestState): the keeper at once,
// the caught-up phones after it this far apart, in case it's gone quiet.
const ANSWER_STAGGER_MS = 700;
// Back on screen (checkConnection): how long a heartbeat has to be answered
// before the connection counts as dead.
const PROBE_MS = 3000;

// Used to seed chains when nobody entered prompts (keeps a game from stalling).
const FALLBACK_PROMPTS = [
  'a cat riding a skateboard',
  'the world’s angriest banana',
  'a robot falling in love',
  'a haunted sandwich',
  'a penguin on vacation',
  'a dragon who is afraid of fire',
];

// How enterRoom went, and what to tell the player when it didn't. The room
// code messages also say where a code comes from: someone who opens Join Game
// first (an app reviewer, say) can take the code box for a login, when all it
// wants is the code from whoever tapped Create Game.
export type EntryStatus = Entry['status'] | 'no_keys' | 'no_name' | 'no_code' | 'bad_code';
const CODE_HELP = 'Get it from the player who created the room, or go back and tap Create Game to start your own.';
export function entryMessage(status: EntryStatus, code = ''): string {
  switch (status) {
    case 'ok':
      return '';
    case 'no_name':
      return 'Type a player name first.';
    case 'no_code':
      return `You need a room code to join a game. ${CODE_HELP}`;
    case 'bad_code':
      return `Room codes are ${ROOM_CODE_LENGTH} letters and numbers. ${CODE_HELP}`;
    case 'bad_name':
      return `Names can be up to ${NAME_MAX} characters.`;
    case 'not_found':
      return code
        ? `There's no room ${code}. Check the code with the player who created the room, or go back and tap Create Game to start your own.`
        : 'That room has closed.';
    case 'in_progress':
      return 'That game has already started. Try again when it ends.';
    case 'room_full':
      return `That room is full: it has the most players a room can hold (${MAX_PLAYERS}). Try again if someone leaves, or go back and tap Create Game to start your own.`;
    case 'name_taken':
      return 'Someone in that room already has that name. Pick another.';
    case 'no_keys':
      return '⚠ Supabase keys not loaded — check .env, then: npx expo start -c';
    default:
      return 'Couldn’t reach the game server. Check your connection and try again.';
  }
}

// Why the room closed under the player (rooms.ts ClosedReason): nobody did
// anything in it for a while, or too few players were left in its game to
// play on (then everyone still in it is out, and starts again).
const closedMessage = (code: string, reason: ClosedReason = 'idle') =>
  reason === 'players'
    ? "There aren't enough players left to keep playing. Create a new game to play again."
    : `Room ${code} closed after ${IDLE_MINUTES} minutes of inactivity.`;

type Game = {
  username: string;
  room: string;
  // The host (./rules roomHost): the player in the room longest, away or not.
  // It moves only when they tap Leave game.
  host: string;
  // Whether this player can start the game from the lobby: the host, or,
  // while the host is away, anyone here.
  canStart: boolean;
  // Everyone in the room, oldest first, whether or not they have the app
  // open (players[0] is the longest in). `away` is the ones who don't.
  players: string[];
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
  // The game's scoring rules (./rules), and under the per-round rule who has
  // lost this round's point and at which turn (`chain:cell`), for the reveal.
  rules: Rules;
  dockedAt: Record<string, string>;
  promptCount: number; // prompts in the shared pool so far
  promptsNeeded: number; // pool size that auto-starts the game
  // This player's turn this stage (null between turns, or watching), and when
  // its clock runs out (epoch ms, this phone's time).
  turn: Turn | null;
  turnEndsAt: number;
  // Who in the round is still drawing or guessing this stage, oldest first,
  // this player aside (./rules stillToGo): the waiting screen lists them,
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
  addPrompt: (text: string) => void;
  readyView: (byHand?: boolean) => void;
  viewReady: boolean; // this player has tapped through Round 1 (or its clock ran out)
  submitCell: (data: string, forTurn?: Turn | null, closing?: boolean) => void;
  passTurn: (forTurn?: Turn | null) => void;
  vote: (correct: boolean) => void;
};

const GameCtx = createContext<Game | null>(null);

export function useGame(): Game {
  const ctx = useContext(GameCtx);
  if (!ctx) throw new Error('useGame must be used inside <GameProvider>');
  return ctx;
}

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/**
 * Two halves. The SERVER (src/lib/rooms.ts, supabase/rooms.sql) knows who is
 * in the room: a player stays in from create/join until they tap Leave game,
 * or the room closes after IDLE_MINUTES with nobody doing anything. Closing
 * the app only makes them "away". The LIVE CHANNEL (one Supabase Realtime
 * channel per room, members only) carries the game: drawings are compact
 * vector JSON (a few KB), so prompts, drawings, captions and scores all flow
 * over broadcast, and its presence says who has the app on screen right now:
 * a phone that goes off screen leaves presence at once (goAway), so the room
 * never waits on a phone that's asleep.
 *
 * HOST = the player in the room longest, from the server's list (./rules
 * roomHost): it stays theirs while they're away, and passes on only when they
 * tap Leave game. It's the HOST badge and Start Game (anyone here can start
 * while the host is away).
 *
 * KEEPER = whichever phone keeps the game's clock: the longest in who's on
 * screen and caught up (`synced`), derived live from presence, and nothing a
 * player sees. It runs the authoritative stage clock, decides transitions,
 * and saves a snapshot of the game to the server at every step. Every client
 * also tallies chains/prompts/scores so a handover loses nothing, and every
 * caught-up phone stands by in case the keeper goes quiet (the clock's
 * backup: watchClock). If everyone closes the app, the game is paused: the
 * server tells them all so, and the first one back picks the game up from
 * the snapshot, as it was when its clock stopped (`pausedAt`).
 *
 * A phone back on screen catches up (resync), asking until a caught-up phone
 * answers, or, with nobody there to, from the snapshot.
 *
 * Away players stay in the rotation, on the same clock as everyone: whatever
 * they haven't handed in when it runs out goes in empty, and counts as missed.
 * A player who taps Leave game mid-game while 3 or more others carry on is
 * taken out of the rotation at once. If fewer would be left, the game can't
 * go on: the server closes the room, and everyone still in it is sent home,
 * told there aren't enough players (rooms.sql leave_room_as). (A server whose
 * rooms.sql hasn't been run again since 2.9.0 doesn't: then the turns of the
 * one who left run out the clock, marked `left`, and at the next round the
 * game ends with fewer than MIN_PLAYERS.)
 *
 * ROUND LEADER = a separate, game-level role that rotates every round. The
 * leader judges the reveal (awards points) when a chain's owner can't. It is
 * independent of the host.
 */
export function GameProvider({ children }: { children: React.ReactNode }) {
  const [username, setUsername] = useState('');
  const [room, setRoom] = useState('');
  const [members, setMembersState] = useState<Member[]>([]);
  const [presentIds, setPresentIds] = useState<string[]>([]);
  const [gameNames, setGameNames] = useState<string[]>([]);
  const [avatars, setAvatars] = useState<Record<string, Avatar>>({});
  const [status, setStatus] = useState<ConnStatus>('connecting');
  const [statusDetail, setStatusDetail] = useState('');

  const [phase, setPhase] = useState<Phase>('lobby');
  const [stage, setStage] = useState(0);
  const [prev, setPrev] = useState<Prev | null>(null);
  const [chains, setChains] = useState<Chain[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [target, setTarget] = useState(5);
  const [revealIndex, setRevealIndex] = useState(0);
  const [revealStep, setRevealStep] = useState(0);
  const [rulings, setRulings] = useState<Record<number, boolean>>({});
  const [promptCount, setPromptCount] = useState(0);
  // This player's turn this stage, and when its clock runs out (this phone's
  // time), for the drawing and guessing screens.
  const [turn, setTurn] = useState<Turn | null>(null);
  const [turnEndsAt, setTurnEndsAt] = useState(0);
  const [judgeWait, setJudgeWait] = useState('');
  const [resuming, setResuming] = useState(false);
  const [rules, setRules] = useState<Rules>(1);
  const [dockedAt, setDockedAt] = useState<Record<string, string>>({});

  const channelRef = useRef<RealtimeChannel | null>(null);
  const subscribedRef = useRef(false);
  const roomRef = useRef('');
  const usernameRef = useRef('');
  const userIdRef = useRef('');
  const membersRef = useRef<Member[]>([]);
  const presenceRef = useRef<Presence[]>([]);
  const isKeeperRef = useRef(false);
  const keeperRef = useRef(''); // the clock's keeper's name (for detecting handover)
  // Which scoring rules each phone in the room knows, by user id, as its
  // presence has said (./rules gameRules; 2.9.0 says nothing: 1).
  const versionsRef = useRef(new Map<string, number>());
  // The server's phase for the room: 'playing' from Start until the game ends.
  const dbPhaseRef = useRef<RoomPhase>('lobby');
  // Whether this phone holds the game as it stands. False from (re)connecting,
  // or going off screen, until a caught-up phone sends the state, or until
  // this phone restores it.
  const syncedRef = useRef(false);
  const restoringRef = useRef(false);
  // When this phone's copy of the game last changed (it rides in the
  // snapshot as savedAt), so a keeper that comes back can tell whether the
  // server's snapshot or its own memory is newer.
  const lastChangeRef = useRef(0);
  const snapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // This player's own avatar, sent in their presence (and sent again if it
  // changes while they're in a room).
  const myAvatar = useMyAvatar();
  const myAvatarRef = useRef(myAvatar);
  myAvatarRef.current = myAvatar;

  const phaseRef = useRef<Phase>('lobby');
  const stageRef = useRef(0);
  const rosterRef = useRef<string[]>([]); // player order fixed for the current round
  const skipRef = useRef<Set<string>>(new Set()); // left mid-round with 3+ carrying on: turns passed over
  const gameNamesRef = useRef<Set<string>>(new Set()); // everyone who has played in this game
  const myChainRef = useRef(-1); // which chain I'm working on this stage
  const chainsRef = useRef<Chain[]>([]);
  const scoresRef = useRef<Record<string, number>>({});
  const targetRef = useRef(5);
  const leaderRef = useRef('');
  const roundRef = useRef(0);
  const revealIndexRef = useRef(0);
  const revealStepRef = useRef(0); // last-revealed cell index within the current chain
  const rulingsRef = useRef<Record<number, boolean>>({}); // cellIndex -> correct?
  const talliedRef = useRef<Record<number, boolean>>({}); // rulings of the current chain already counted into scores
  // The game's scoring rules, and under the per-round one who has lost this
  // round's point and where (./rules Docks), and whether anyone has judged
  // the chain being revealed in its owner's place (judgingMissed).
  const rulesRef = useRef<Rules>(1);
  const dockedRef = useRef<Set<string>>(new Set());
  const dockedAtRef = useRef<Record<string, string>>({});
  const stoodInRef = useRef(false);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoRuleRef = useRef(''); // the empty turn the judge's phone last marked by itself
  const advancedForRef = useRef(-1); // highest stage we've already emitted an advance for
  // The turns this player has handed in this round, by turnKey: each is sent
  // again if it doesn't come back from the channel (handIn), or if the keeper's
  // copy of the game turns up with it empty (mend).
  const handedRef = useRef(new Map<string, Handed>());
  // Turns this phone has sent again (or seen sent again) to mend the room's
  // copy of the game, by turnKey; a pending one waits its turn (mend).
  const mendRef = useRef(new Map<string, ReturnType<typeof setTimeout> | null>());
  // When each of this player's turns this round ran out, on this phone's
  // clock, by turnKey (so a turn handed in long after can be told: isLate);
  // and one handed in that late while the phone was still catching up, held
  // until it knows whether the room still wants it (markSynced).
  const deadlinesRef = useRef(new Map<string, number>());
  const heldRef = useRef<{ turn: Turn; data: string; closing: boolean } | null>(null);

  // Prompt pool (all clients accumulate, for keeper-handover safety).
  const allPromptsRef = useRef<{ text: string; author: string }[]>([]);
  const poolRef = useRef<{ text: string; author: string }[]>([]);
  // Prompts already handed out this game (every phone notes each round's), so
  // a keeper taking over doesn't hand one out again (drawSeeds).
  const usedRef = useRef<Map<string, Prompt>>(new Map());
  // When this phone last started a game's prompts (a second start right
  // after is the same tap twice, from two phones: to-prompts).
  const promptsAtRef = useRef(0);
  const viewAcksRef = useRef<Set<string>>(new Set()); // who has tapped through Round 1
  // Whether this player is among them: Round 1 shows Player ready in place of
  // its button (app/view.tsx).
  const [viewReady, setViewReady] = useState(false);

  const clockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keeper: the pause between the prompt pool filling and the first round going
  // out, so the theme music can fade on every device before the screen changes.
  const startDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearStartDelay = () => {
    if (startDelayRef.current) {
      clearTimeout(startDelayRef.current);
      startDelayRef.current = null;
    }
  };
  const stageStartedAtRef = useRef(0);

  // ---- Getting around ----
  // In the lobby or on the scoreboard, Back goes home and the player stays in
  // the room: they can play solo, dress their pig, and come back with Home's
  // Back to room (returnToRoom). When the game starts, or moves on, `go`
  // brings them to its screen wherever they are. During a game Back asks if
  // they want to leave, the same as Leave game (askToLeave, below).
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  // The room's screen as the game last put it (or the player left it), for
  // Back to room.
  const roomScreenRef = useRef('/lobby');
  useEffect(() => {
    pathRef.current = pathname;
    if (isRoomScreen(pathname)) roomScreenRef.current = pathname;
  }, [pathname]);
  // To the room's screen `path`, however it's reached from here (./nav).
  // The router takes its calls in order, so 'rehome' is one move.
  const go = (path: string, force = false) => {
    roomScreenRef.current = path;
    const how = navFor(pathRef.current, path, force);
    if (how === 'stay') return;
    if (how === 'push') router.push(path);
    else if (how === 'rehome') {
      router.dismissTo('/');
      router.push(path);
    } else router.replace(path);
    pathRef.current = path; // until the navigator says so (two in a row)
  };
  // Home's Back to room, and a link to the room already in. Join opened by
  // a link tapped in the room sits over the room's screen: back down to it,
  // as it was (a drawing in progress and all), not a fresh copy over it. If
  // it isn't there, dismissTo puts it in Join's place.
  const returnToRoom = () => {
    if (!roomRef.current) return;
    const path = roomScreenRef.current;
    const here = pathRef.current;
    if (here === path) return;
    if (here === '/' || isRoomScreen(here)) return go(path, true);
    router.dismissTo(path);
    pathRef.current = path;
  };
  // Out of the room: home, unless the player is somewhere else already.
  const goHome = () => {
    if (isRoomScreen(pathRef.current)) router.dismissTo('/');
  };

  // ---- Who's here ----
  // Everyone still in the room (not left), oldest first: the round roster.
  const activeMembers = () => activeOf(membersRef.current);
  const orderedNames = () => activeMembers().map((m) => m.name);
  // The ones with the app open right now.
  const presentNames = () => presentOf(membersRef.current, presenceRef.current);
  // User ids of players still in the room but away, optionally only those
  // named (this round's roster) — who gets a "your turn" notification.
  const awayIds = (names?: string[]) => {
    const here = new Set(presenceRef.current.map((p) => p.id));
    return activeMembers()
      .filter((m) => !here.has(m.id) && (!names || names.includes(m.name)))
      .map((m) => m.id);
  };

  // Everything goes out in the order it's sent. A message too big for the
  // channel goes in pieces (src/lib/chunks.ts), a moment apart so a burst of
  // them stays inside the channel's rate limit; anything sent meanwhile waits
  // its turn behind them, so nobody gets a stage before the game it belongs to.
  const outboxRef = useRef<{ channel: RealtimeChannel; event: string; payload: unknown }[]>([]);
  const sendingRef = useRef(false);
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

  // Whether the app is on screen. Off it (another app, a locked phone, a
  // hidden browser tab) the phone isn't in presence, can't keep the game's
  // clock, and doesn't catch up until it's back (goAway, comeBack).
  const awakeRef = useRef(AppState.currentState !== 'background');

  // This phone in presence: here, and whether it's caught up. Never while
  // it's off screen: the room sees it as away, and doesn't wait on it.
  const track = () => {
    if (!subscribedRef.current || !awakeRef.current) return;
    channelRef.current?.track({
      userId: userIdRef.current,
      username: usernameRef.current,
      synced: syncedRef.current,
      avatar: wireAvatar(myAvatarRef.current),
      v: PROTOCOL,
    });
  };

  // Where this phone's game is, to hold each game message up against (./rules).
  const position = (): Position => ({
    phase: phaseRef.current,
    round: roundRef.current,
    stage: stageRef.current,
    revealIndex: revealIndexRef.current,
    revealStep: revealStepRef.current,
    chains: chainsRef.current.length,
  });

  // Where this phone stands to step in for the keeper: 0 if it is the keeper,
  // 1, 2, … for the caught-up phones on screen after it (./rules clockLine),
  // -1 if it can't (off screen, or catching up itself).
  const clockRank = () => {
    if (isKeeperRef.current) return 0;
    if (!syncedRef.current || !awakeRef.current) return -1;
    const i = clockLine(membersRef.current, presenceRef.current, keeperRef.current).indexOf(usernameRef.current);
    return i < 0 ? -1 : i + 1;
  };

  // Catch up: this phone may have missed something (it was off screen or
  // reconnected, or a message showed it was behind). Until an answer comes
  // (onState) it isn't caught up, so it doesn't keep the clock, and the room
  // elects someone who is. It asks every ASK_EVERY_MS until it's answered (a
  // caught-up phone answers: onRequestState), and after ASK_TRIES with
  // nobody there to answer it picks the game up from the server (restore).
  // At most one catch-up every couple of seconds, unless `now` (a fresh
  // connection always asks). Off screen it waits until it's back (comeBack).
  const lastResyncRef = useRef(0);
  const resync = (now = false) => {
    if (!roomRef.current || !subscribedRef.current || !awakeRef.current) return; // connecting asks once it's in
    const t = Date.now();
    if (!now && t - lastResyncRef.current < 2000) return;
    lastResyncRef.current = t;
    syncedRef.current = false;
    track();
    askForState();
    updateKeeper();
  };
  const askTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopAsking = () => {
    if (askTimerRef.current) clearTimeout(askTimerRef.current);
    askTimerRef.current = null;
  };
  const askForState = () => {
    stopAsking();
    let tries = 0;
    const ask = () => {
      askTimerRef.current = null;
      if (!roomRef.current || syncedRef.current || !awakeRef.current) return;
      if (tries >= ASK_TRIES) return restore(true);
      tries += 1;
      if (subscribedRef.current) send('request-state', { username: usernameRef.current });
      askTimerRef.current = setTimeout(ask, ASK_EVERY_MS);
    };
    ask();
  };

  // Answers this phone is about to give to phones catching up, by name
  // (onRequestState), each dropped once someone else's answer goes by.
  const answersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const forgetAnswers = () => {
    for (const pending of answersRef.current.values()) clearTimeout(pending);
    answersRef.current.clear();
  };

  // Stop keeping the clock (saving the game to the server first, for whoever
  // picks it up) and stop counting as caught up: whatever this phone's timers
  // would do from here may be long out of date by the time it's back. It
  // catches up then (resync). The game is saved with the time its clock
  // stopped (`pausedAt`): if nobody carries on (everyone's away), whoever's
  // back first picks it up as it was then, its stage's time and all
  // (applyState); if someone does, their copy soon replaces it (updateKeeper).
  const standDown = () => {
    if (snapTimerRef.current) {
      clearTimeout(snapTimerRef.current);
      snapTimerRef.current = null;
    }
    if (roomRef.current && isKeeperRef.current && syncedRef.current && isGameOn(phaseRef.current)) {
      saveSnapshot(roomRef.current, { ...buildState(), pausedAt: Date.now() });
    }
    clearClock();
    clearStartDelay();
    isKeeperRef.current = false;
    keeperRef.current = ''; // so keeping it again later arms a fresh clock (updateKeeper)
    syncedRef.current = false;
    stopAsking();
    forgetAnswers();
  };

  // Off screen: stand down, and leave presence at once, so the room sees this
  // player as away (their notifications start, the next one in line keeps the
  // clock, someone else judges) instead of waiting on a phone that's asleep.
  // Their seat in the game is kept: away players stay in the rotation. The
  // server hears too (stepAway): when everyone in a game is away, it tells
  // them all it's paused. Until it's caught up again, the game screens'
  // clocks don't run out (`resuming`).
  const awayCallRef = useRef<Promise<unknown>>(Promise.resolve());
  const goAway = () => {
    const code = roomRef.current;
    if (!code) return;
    standDown();
    setResuming(true);
    if (subscribedRef.current) void channelRef.current?.untrack();
    awayCallRef.current = stepAway(code);
  };

  // The connection may have died while the phone slept and still look open:
  // the Realtime client only notices after a missed heartbeat, up to ~50 s
  // later, and everything sent meanwhile is lost. So a heartbeat goes now, and
  // if it's still unanswered after PROBE_MS a second one goes, which, with
  // one pending, is the client's heartbeat timeout: it gives up on that
  // connection and opens a fresh one at once, and the room's channel rejoins
  // by itself (its SUBSCRIBED catches up). The heartbeat also brings the
  // connection's sign-in token up to date.
  const checkConnection = () => {
    const realtime = supabase.realtime;
    if (!realtime.isConnected()) {
      realtime.connect();
      return;
    }
    void realtime.sendHeartbeat();
    setTimeout(() => {
      if (realtime.isConnected() && realtime.pendingHeartbeatRef) void realtime.sendHeartbeat();
    }, PROBE_MS);
  };

  // Back on screen: that counts as activity (and says the player is back:
  // after the server has heard they went away, if that's still on its way, so
  // the two can't land the wrong way round), the room's notification is out
  // of date, the connection may have died while the phone slept, and the game
  // may have moved on without this phone, so it rejoins presence (not caught
  // up) and catches up (resync; if the game started or ended meanwhile,
  // refreshMembers notices).
  const comeBack = () => {
    const code = roomRef.current;
    if (!code) return;
    clearRoomNotifications();
    checkConnection();
    void awayCallRef.current.finally(() => {
      if (roomRef.current === code) touchRoom(code, true);
    });
    resync(true);
    refreshMembers();
  };

  const addGameNames = (...lists: string[][]) => {
    let added = false;
    for (const list of lists) {
      for (const n of list) {
        if (n && !gameNamesRef.current.has(n)) {
          gameNamesRef.current.add(n);
          added = true;
        }
      }
    }
    if (added) setGameNames([...gameNamesRef.current]);
  };

  // ---- The keeper's authoritative stage clock ----
  const clearClock = () => {
    if (clockTimerRef.current) {
      clearTimeout(clockTimerRef.current);
      clockTimerRef.current = null;
    }
  };
  const startClock = (seconds: number, fn: () => void) => {
    clearClock();
    if (!isKeeperRef.current) return;
    clockTimerRef.current = setTimeout(fn, Math.max(1, seconds) * 1000);
  };
  // How long each stage lasts. The trough's time follows its size: 30 s for
  // each prompt it needs (the players in the room and the points to win).
  const durationFor = (p: Phase) =>
    p === 'prompts'
      ? promptsTime(promptsNeededFor(orderedNames().length, targetRef.current))
      : p === 'view'
        ? TIMERS.view
        : p === 'draw'
          ? TIMERS.draw
          : p === 'caption'
            ? TIMERS.caption
            : p === 'reveal'
              ? TIMERS.reveal
              : 0;

  const forceFor = (p: Phase) => {
    if (p === 'prompts') return startFirstRound;
    if (p === 'view') return doAdvance; // Round 1 timed out — start drawing anyway
    if (p === 'draw' || p === 'caption') return forceAdvance;
    if (p === 'reveal') return forceRevealChain;
    return () => {};
  };

  const armForCurrentStage = (fullDuration: boolean) => {
    const p = phaseRef.current;
    if (p === 'lobby' || p === 'gameover') return;
    const remaining = fullDuration
      ? durationFor(p)
      : durationFor(p) - (Date.now() - stageStartedAtRef.current) / 1000;
    startClock(remaining + HOST_GRACE, forceFor(p));
  };

  const beginStage = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
    stageStartedAtRef.current = Date.now();
    setEndsAt(stageStartedAtRef.current + durationFor(p) * 1000);
    armForCurrentStage(true);
    armJudgeWait();
  };

  // When the stage on screen runs out, on this phone's clock; noted against
  // this player's turn too, so one handed in long after can be told (isLate).
  const setEndsAt = (endsAt: number) => {
    setTurnEndsAt(endsAt);
    const t = currentTurn();
    if (t) deadlinesRef.current.set(turnKey(t), endsAt);
  };

  // ---- Waiting for a judge ----
  // A chain's owner judges it, but if they're away when it comes up, the
  // reveal waits JUDGE_WAIT for them (they're notified: nudgeJudge) before
  // the round leader, or the first one here, judges it in their place
  // (./rules judgeFor). `judgeWait` says who it's waiting for, on screen.
  const judgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waitingForJudge = () =>
    phaseRef.current === 'reveal' && Date.now() - stageStartedAtRef.current < JUDGE_WAIT * 1000;
  const waitFor = () => (waitingForJudge() ? orderedNames() : []);
  const updateJudgeWait = () => {
    const owner = chainOwner(chainsRef.current[revealIndexRef.current]);
    const waiting = !!owner && waitingForJudge() && !presentNames().includes(owner) && orderedNames().includes(owner);
    setJudgeWait(waiting ? owner : '');
  };
  // Whenever a stage begins (a chain coming up, at the reveal), or this phone
  // learns how long ago it did (applyState), and again once the wait is over,
  // when a stand-in takes over.
  const armJudgeWait = () => {
    if (judgeTimerRef.current) clearTimeout(judgeTimerRef.current);
    judgeTimerRef.current = null;
    updateJudgeWait();
    const left = stageStartedAtRef.current + JUDGE_WAIT * 1000 - Date.now();
    if (phaseRef.current !== 'reveal' || left <= 0) return;
    judgeTimerRef.current = setTimeout(() => {
      judgeTimerRef.current = null;
      updateJudgeWait();
      maybeAutoRule();
    }, left + 50);
  };
  // The keeper tells an away owner their chain is up, and so does the first
  // phone in line after it, in case the keeper has gone quiet (the server
  // sends a player one notification at a time: the second goes nowhere).
  const nudgeJudge = () => {
    const rank = clockRank();
    if (rank < 0 || rank > 1) return;
    const owner = chainOwner(chainsRef.current[revealIndexRef.current]);
    if (owner) nudge(roomRef.current, 'judge', awayIds([owner]));
  };

  // ---- Snapshot (keeper) ----
  // Every change to the game, on every phone, marks the time; the keeper also
  // saves the whole game to the server, at most once every 0.8 s, so the room
  // can pick up from it if everyone closes the app at once.
  const buildState = () => ({
    phase: phaseRef.current,
    stage: stageRef.current,
    roster: rosterRef.current,
    chains: chainsRef.current,
    scores: scoresRef.current,
    target: targetRef.current,
    leader: leaderRef.current,
    round: roundRef.current,
    revealIndex: revealIndexRef.current,
    revealStep: revealStepRef.current,
    rulings: rulingsRef.current,
    promptCount: allPromptsRef.current.length,
    prompts: allPromptsRef.current,
    pool: poolRef.current,
    used: [...usedRef.current.values()],
    viewAcks: [...viewAcksRef.current],
    rules: rulesRef.current,
    docked: [...dockedRef.current],
    dockedAt: dockedAtRef.current,
    stoodIn: stoodInRef.current,
    stageStartedAt: stageStartedAtRef.current,
    savedAt: lastChangeRef.current,
  });

  const changed = () => {
    lastChangeRef.current = Date.now();
    if (!isKeeperRef.current || !syncedRef.current || snapTimerRef.current) return;
    snapTimerRef.current = setTimeout(() => {
      snapTimerRef.current = null;
      const p = phaseRef.current;
      if (isKeeperRef.current && roomRef.current && p !== 'lobby' && p !== 'gameover') {
        saveSnapshot(roomRef.current, buildState());
      }
    }, 800);
  };

  // ---- Chain assignment (./rules: chainForStage, prevFor) ----
  const routeForStage = (s: number) => {
    stageRef.current = s;
    setStage(s);
    const roster = rosterRef.current;
    const n = roster.length;
    // Stage 0 = Round 1 "view": read the prompt for the chain you own + judge.
    const p = phaseForStage(s);
    const myPos = roster.indexOf(usernameRef.current);
    if (myPos < 0 || n === 0) {
      // Not part of this round's roster -> watch.
      myChainRef.current = -1;
      setPrev(null);
      setTurn(null);
      go('/waiting');
      beginStage(p);
      return;
    }
    // chainForStage(pos, 0) === pos, so at the view stage you're handed the very
    // chain you own — the one you'll judge at the end.
    const c = chainForStage(myPos, s, n);
    myChainRef.current = c;
    setTurn({ round: roundRef.current, stage: s, chain: c });
    if (s === 0) {
      const seed = chainsRef.current[c]?.cells[0];
      setPrev(seed && seed.kind !== 'drawing' ? { kind: seed.kind, text: seed.text } : null);
      go('/view');
      beginStage('view');
      return;
    }
    setPrev(prevFor(chainsRef.current[c], s));
    // A turn that's in already (handed in before the app closed, and caught
    // up since): wait with everyone else, rather than be handed it again.
    go(chainsRef.current[c]?.cells[s] ? '/waiting' : p === 'draw' ? '/drawing' : '/guessing');
    beginStage(p);
  };

  // The turn this player is on right now, if any.
  const currentTurn = (): Turn | null =>
    isTurnPhase(phaseRef.current) && myChainRef.current >= 0
      ? { round: roundRef.current, stage: stageRef.current, chain: myChainRef.current }
      : null;

  // ---- Handing a turn in, and mending one that went missing ----
  // A turn goes out on the channel and comes back to this phone too (every
  // phone hears its own messages): back, it reached the room. If it doesn't
  // come back within HAND_IN_RETRY_MS it's sent again, a couple of times,
  // while its round lasts.
  const sendHanded = (h: Handed) => {
    h.tries += 1;
    send('cell', { round: h.round, chain: h.chain, stage: h.stage, cell: h.cell });
    setTimeout(() => {
      if (handedRef.current.get(turnKey(h)) !== h || h.echoed || h.tries >= HAND_IN_TRIES) return;
      if (!roomRef.current || roundRef.current !== h.round || !isGameOn(phaseRef.current)) return;
      sendHanded(h);
    }, HAND_IN_RETRY_MS);
  };
  const handIn = (t: Turn, cell: Cell) => {
    const h: Handed = { ...t, cell, echoed: false, tries: 0 };
    handedRef.current.set(turnKey(t), h);
    sendHanded(h);
  };

  // The keeper's copy of the game (its next-stage message, the reveal's
  // chains, its answer to a phone catching up) has turn `t` empty, but this
  // phone has it with something in it: the turn never reached the keeper,
  // which filled it in blank. Send it again so every phone mends its copy
  // (mergeCell keeps the real one). The player who handed it in sends it at
  // once; anyone else who has it waits a moment and only sends it if nobody
  // has meanwhile (the player may be away). Once per turn.
  const mend = (t: Turn, incoming: Cell | undefined) => {
    if (incoming && !isEmptyTurn(incoming)) return;
    const key = turnKey(t);
    if (mendRef.current.has(key)) return;
    const mine = handedRef.current.get(key);
    const have = mine?.cell ?? chainsRef.current[t.chain]?.cells[t.stage];
    if (!have || isEmptyTurn(have)) return;
    const resend = () => {
      mendRef.current.set(key, null);
      if (!roomRef.current || roundRef.current !== t.round || !isGameOn(phaseRef.current)) return;
      console.log('[game] mending turn', key);
      send('cell', { round: t.round, chain: t.chain, stage: t.stage, cell: have });
    };
    if (mine) resend();
    else mendRef.current.set(key, setTimeout(resend, 400 + Math.random() * 1200));
  };
  // A turn this phone is waiting to send again arrived with something in it
  // (someone else mended it first): nobody else need. (A turn simply handed
  // in leaves mendRef alone, so it can still be mended if the keeper turns
  // out to have missed it.)
  const mended = (key: string) => {
    const pending = mendRef.current.get(key);
    if (pending === undefined) return;
    if (pending) clearTimeout(pending);
    mendRef.current.set(key, null);
  };
  const forgetTurns = () => {
    handedRef.current.clear();
    for (const pending of mendRef.current.values()) if (pending) clearTimeout(pending);
    mendRef.current.clear();
    deadlinesRef.current.clear();
  };

  // Who is out of this round's rotation (./rules computeSkips).
  const computeSkips = () => {
    skipRef.current = skipsFor(phaseRef.current, rosterRef.current, membersRef.current);
  };

  // ---- Prompt pool (./rules drawSeeds) ----
  const drawSeeds = (n: number): Prompt[] => {
    const drawn = drawSeedsFrom(poolRef.current, allPromptsRef.current, new Set(usedRef.current.keys()), n, shuffle, FALLBACK_PROMPTS);
    poolRef.current = drawn.pool;
    return drawn.seeds;
  };
  const noteUsed = (prompts: Prompt[]) => {
    for (const p of prompts) usedRef.current.set(promptKey(p), p);
  };

  // ---- Round lifecycle (the keeper emits, everyone reacts) ----
  // What the keeper does to move the game on, a phone standing in for it can
  // do too (the clock's backup: watchClock sets `acting` while it does).
  const actingRef = useRef(false);
  const actsForClock = () => isKeeperRef.current || actingRef.current;

  // The game is over: everyone to the scoreboard, the room opens to newcomers
  // again and the server forgets the game, and anyone away is told.
  const endGame = (round: number) => {
    send('game-over', { round });
    endGameOnServer(roomRef.current);
    nudge(roomRef.current, 'over', awayIds());
  };

  // The roster is rebuilt from the room's players at the start of every round
  // (away ones included), so anyone who has left the room is naturally dropped
  // from the rotation (their already-pooled prompts simply stay unused). If too
  // few remain, end the game.
  const startFirstRound = () => {
    if (!actsForClock()) return;
    clearClock();
    roundRef.current = 0;
    const roster = orderedNames();
    if (roster.length < MIN_PLAYERS) return endGame(0);
    send('round', { round: 0, roster, seeds: drawSeeds(roster.length), leader: roster[0] });
  };

  // The round number moves on when the 'round' message comes back (onRound),
  // on every phone alike, the keeper's included.
  const nextRound = () => {
    if (!actsForClock()) return;
    const next = roundRef.current + 1;
    const roster = orderedNames();
    if (roster.length < MIN_PLAYERS) return endGame(roundRef.current);
    send('round', {
      round: next,
      roster,
      seeds: drawSeeds(roster.length),
      leader: roster[next % roster.length],
    });
  };

  // The round's last chain is scored: the game is over if anyone has reached
  // the points to win, otherwise the next round.
  const finishRound = () => {
    if (!actsForClock() || revealIndexRef.current < chainsRef.current.length) return;
    const won = Object.values(scoresRef.current).some((v) => v >= targetRef.current);
    if (won) endGame(roundRef.current);
    else nextRound();
  };

  // Who is responsible for chain c this stage (the inverse of chainForStage).
  const assignedPlayer = (c: number, s: number) => playerForChain(rosterRef.current, c, s);
  const hasLeft = (name: string) => membersRef.current.some((m) => m.name === name && m.leftAt != null);

  const forceAdvance = () => {
    if (!actsForClock()) return;
    const s = stageRef.current;
    const n = rosterRef.current.length;
    // Fill any missing cells so the chains stay well-formed, under the name of
    // the player who owed each one: an empty drawing or guess, a skipped turn
    // for someone out of the rotation, or one marked `left` for someone who
    // left when too few would have carried on to take them out of it.
    chainsRef.current.forEach((ch, c) => {
      if (ch.cells[s]) return;
      const who = n ? (assignedPlayer(c, s) ?? '') : '';
      const mark = skipRef.current.has(who) ? { skip: true as const } : hasLeft(who) ? { left: true as const } : {};
      ch.cells[s] =
        s % 2 === 1
          ? { kind: 'drawing', data: '', author: who, ...mark }
          : { kind: 'caption', text: '', author: who, ...mark };
    });
    doAdvance();
  };

  // Production runs stages 1..finalStage(n) (./rules). A new turn: everyone
  // in the rotation who's away is told it's their turn.
  const doAdvance = () => {
    if (!actsForClock()) return;
    const s = stageRef.current;
    if (advancedForRef.current >= s) return; // already advanced past this stage
    advancedForRef.current = s;
    const n = rosterRef.current.length;
    const round = roundRef.current;
    if (s >= finalStage(n)) {
      send('to-reveal', { round, chains: chainsRef.current });
    } else {
      send('advance', { round, stage: s + 1, cells: chainsRef.current.map((ch) => ch.cells[s]) });
      nudge(roomRef.current, phaseForStage(s + 1) === 'draw' ? 'draw' : 'guess', awayIds(rosterRef.current));
    }
  };

  // Whether every chain has its cell for this stage, or its turn belongs to
  // someone out of the rotation: nobody still to go (./rules stillToGo).
  const stageSettled = () =>
    rosterRef.current.length > 0 &&
    stillToGo(rosterRef.current, chainsRef.current, stageRef.current, skipRef.current).length === 0;

  // Keeper: advance the stage as soon as it's settled. Away players are
  // waited for until the clock runs out (forceAdvance). Runs both when a cell
  // lands and when the room's list changes.
  const maybeAdvanceStage = () => {
    if (!isKeeperRef.current) return;
    if (phaseRef.current !== 'draw' && phaseRef.current !== 'caption') return;
    const settled = stageSettled();
    const filled = chainsRef.current.filter((ch) => ch.cells[stageRef.current]).length;
    console.log('[game] stage', stageRef.current, '—', filled, 'of', rosterRef.current.length, 'cells in, settled:', settled);
    if (settled) {
      clearClock();
      forceAdvance(); // fills the skipped players' turns, then advances
    }
  };

  // Whether the shared pool holds enough prompts to seed every chain of every
  // round without repeating (and there are enough players). Every device can
  // tell — it is the same broadcast pool — so every device can react the
  // moment it happens, ahead of the keeper's round broadcast.
  const poolFull = () => {
    if (phaseRef.current !== 'prompts') return false;
    const count = orderedNames().length;
    const needed = promptsNeededFor(count, targetRef.current);
    return count >= MIN_PLAYERS && allPromptsRef.current.length >= needed;
  };

  // Keeper: start the game once the pool is full — after a short hold, long
  // enough for the theme to fade out on everyone's phone before the round
  // lands. The hold is re-checked when it fires in case the room changed.
  const maybePromptsComplete = () => {
    if (!isKeeperRef.current || startDelayRef.current) return;
    if (!poolFull()) return;
    startDelayRef.current = setTimeout(() => {
      startDelayRef.current = null;
      if (isKeeperRef.current && poolFull()) startFirstRound();
    }, MUSIC_FADE_MS);
  };

  // Whether everyone in the rotation has tapped through Round 1.
  const viewDone = () => {
    const waiting = rosterRef.current.filter((nm) => !skipRef.current.has(nm));
    return waiting.length > 0 && waiting.every((nm) => viewAcksRef.current.has(nm));
  };

  // Keeper: leave Round 1 (view) once everyone in the rotation has tapped
  // through (away players run out its clock), then kick off the first
  // drawing stage.
  const maybeAdvanceView = () => {
    if (!isKeeperRef.current) return;
    if (phaseRef.current !== 'view') return;
    if (viewDone()) {
      clearClock();
      doAdvance();
    }
  };

  // ---- The clock's backup ----
  // Every caught-up phone on screen keeps an eye on the clock: when the game
  // is past due to move on (a stage's time is up; the trough is full, everyone
  // has tapped through Round 1, every turn is in, or the round's last chain is
  // scored) and it hasn't, the keeper has gone quiet: it froze before it could
  // hand over, lost its connection, or is a 2.9.0 phone in the background,
  // which never hands over. Then the phones in line (clockRank) do what the
  // keeper would have, BACKUP_AFTER seconds late, BACKUP_STAGGER apart, and
  // again if it still hasn't moved. The keeper watches too, first, in case a
  // message of its own went missing. Two phones moving the game on is
  // harmless: the second message is late, and ignored (./rules).
  const dueRef = useRef({ key: '', since: 0, acted: 0 });
  // What's next for the clock, and from when: a stage's deadline (plus the
  // grace for last-second turns), or, when it's ready now (`at` null), from
  // when this phone first saw it was.
  const clockJob = (): { key: string; at: number | null; act: () => void } | null => {
    const p = phaseRef.current;
    const id = `${p}:${roundRef.current}:${stageRef.current}:${revealIndexRef.current}:${stageStartedAtRef.current}`;
    const timeUp = stageStartedAtRef.current + (durationFor(p) + HOST_GRACE) * 1000;
    const job = (ready: boolean, act: () => void) =>
      ready ? { key: `${id}:ready`, at: null, act } : { key: id, at: timeUp, act };
    if (p === 'prompts') return job(poolFull(), startFirstRound);
    if (p === 'view') return job(viewDone(), doAdvance);
    if (p === 'draw' || p === 'caption') return job(stageSettled(), forceAdvance);
    if (p === 'reveal') {
      return revealIndexRef.current >= chainsRef.current.length ? job(true, finishRound) : job(false, forceRevealChain);
    }
    return null;
  };
  const watchClock = () => {
    if (!roomRef.current || !subscribedRef.current || !syncedRef.current || !awakeRef.current) return;
    if (!isGameOn(phaseRef.current)) return;
    const rank = clockRank();
    const job = rank < 0 ? null : clockJob();
    if (!job) return;
    const now = Date.now();
    if (dueRef.current.key !== job.key) dueRef.current = { key: job.key, since: now, acted: 0 };
    const due = dueRef.current;
    const wait = (BACKUP_AFTER + rank * BACKUP_STAGGER) * 1000;
    if (now < (job.at ?? due.since) + wait || (due.acted && now < due.acted + wait)) return;
    due.acted = now;
    console.log('[game] the clock is late; moving the game on (', job.key, ')');
    // Whatever stopped this stage advancing before, it hasn't: this is the
    // advance it never got.
    advancedForRef.current = Math.min(advancedForRef.current, stageRef.current - 1);
    actingRef.current = true;
    try {
      job.act();
    } finally {
      actingRef.current = false;
    }
  };

  // This round's points lost under the per-round rule, cleared each round.
  const forgetDocks = () => {
    dockedRef.current = new Set();
    dockedAtRef.current = {};
    setDockedAt({});
    stoodInRef.current = false;
  };

  // ---- Broadcast handlers (fire on every client, including the sender) ----
  const onToPrompts = (t: number, playedTo: Rules) => {
    targetRef.current = t;
    setTarget(t);
    rulesRef.current = playedTo;
    setRules(playedTo);
    forgetDocks();
    scoresRef.current = {};
    setScores({});
    allPromptsRef.current = [];
    poolRef.current = [];
    usedRef.current = new Map();
    setPromptCount(0);
    chainsRef.current = [];
    setChains([]);
    roundRef.current = 0;
    forgetTurns();
    gameNamesRef.current = new Set();
    setGameNames([]);
    dbPhaseRef.current = 'playing';
    // A new game is the whole state: anyone who was still catching up is caught up.
    if (!syncedRef.current) markSynced();
    go('/prompts');
    beginStage('prompts');
    changed();
  };

  // One prompt added to the shared pool (every client accumulates, so the live
  // count is consistent and a keeper handover keeps the pool).
  const onPrompt = (text: string, author: string) => {
    const clean = (text ?? '').trim();
    if (!clean) return;
    allPromptsRef.current.push({ text: clean, author });
    setPromptCount(allPromptsRef.current.length);
    // The prompt that fills the pool is the cue for the music to go: it fades
    // during the keeper's hold, so the round arrives to silence. (Harmless if
    // the music is already off.)
    if (poolFull()) stopMusic();
    maybePromptsComplete();
    changed();
  };

  const onViewAck = (name: string) => {
    viewAcksRef.current.add(name);
    if (name === usernameRef.current) setViewReady(true);
    maybeAdvanceView();
    changed();
  };

  const onRound = (round: number, roster: string[], seeds: { text: string; author: string }[], lead: string) => {
    clearStartDelay();
    roundRef.current = round;
    forgetTurns();
    forgetDocks();
    noteUsed(seeds);
    rosterRef.current = roster;
    addGameNames(roster);
    leaderRef.current = lead;
    advancedForRef.current = -1; // stages start at 0 (the Round 1 view) this round
    revealIndexRef.current = 0;
    setRevealIndex(0);
    viewAcksRef.current = new Set();
    setViewReady(false);
    // Chain c is OWNED by roster[c]: they view its prompt in Round 1 and judge it
    // at the reveal (judge = prompt author). The pooled prompt's original writer
    // is irrelevant to ownership.
    chainsRef.current = seeds.map((s, c) => ({
      cells: [{ kind: 'prompt', text: s.text, author: roster[c] ?? s.author } as Cell],
    }));
    setChains(chainsRef.current.map((c) => ({ cells: [...c.cells] })));
    routeForStage(0);
    computeSkips();
    changed();
  };

  // A turn handed in (or sent again to mend the room's copy). One already
  // ruled at the reveal stays as it was judged.
  const onCell = (chain: number, s: number, cell: Cell) => {
    if (!chainsRef.current[chain]) return;
    const key = turnKey({ round: roundRef.current, chain, stage: s });
    const mine = handedRef.current.get(key);
    if (mine && cell.author === usernameRef.current) mine.echoed = true; // it reached the room
    if (!isEmptyTurn(cell)) mended(key);
    if (phaseRef.current === 'reveal' && chain === revealIndexRef.current && rulingsRef.current[s] !== undefined) return;
    chainsRef.current[chain].cells[s] = mergeCell(chainsRef.current[chain].cells[s], cell) as Cell;
    setChains(chainsRef.current.map((c) => ({ cells: [...c.cells] })));
    if (s === stageRef.current) maybeAdvanceStage();
    changed();
  };

  // The keeper's copy of the stage just played comes with the next one: a
  // turn it has empty that this phone has real is kept (mergeCell), and sent
  // again so the keeper and everyone else get it too (mend).
  const onAdvance = (newStage: number, cells: Cell[]) => {
    const round = roundRef.current;
    cells.forEach((cell, i) => {
      if (!chainsRef.current[i] || !cell) return;
      mend({ round, chain: i, stage: newStage - 1 }, cell);
      chainsRef.current[i].cells[newStage - 1] = mergeCell(chainsRef.current[i].cells[newStage - 1], cell) as Cell;
    });
    setChains(chainsRef.current.map((c) => ({ cells: [...c.cells] })));
    routeForStage(newStage);
    changed();
  };

  // Every phone's copy of each turn, checked against the keeper's (onAdvance).
  const mendAll = (incoming: Chain[], upTo: number) => {
    const round = roundRef.current;
    incoming.forEach((chain, c) => {
      for (let s = 1; s <= upTo; s++) mend({ round, chain: c, stage: s }, chain.cells[s]);
    });
  };

  const onToReveal = (incoming: Chain[]) => {
    mendAll(incoming, finalStage(rosterRef.current.length));
    const rvChains = mergeChains(chainsRef.current, incoming);
    chainsRef.current = rvChains;
    setChains(rvChains);
    revealIndexRef.current = 0;
    setRevealIndex(0);
    revealStepRef.current = nextShown(rvChains[0], 0); // show prompt + first drawing; judge votes from there
    setRevealStep(revealStepRef.current);
    rulingsRef.current = {};
    talliedRef.current = {};
    setRulings({});
    stoodInRef.current = false;
    go('/reveal');
    beginStage('reveal');
    nudgeJudge();
    maybeAutoRule();
    changed();
  };

  // Judge = the chain's owner if they have the app open; while the reveal
  // waits for one who's away, nobody; else the round leader or the first one
  // here (./rules judgeFor).
  const judgeForChain = (chainIdx: number, names: string[]) =>
    judgeFor(chainsRef.current[chainIdx], names, leaderRef.current, waitFor());

  // Score rulings as they land (./rules tallyRulings), each cell once; under
  // the per-round rule, a missed turn costs its player this round's point if
  // nothing has yet.
  const tallyRulings = (chain: Chain, ruled: Record<number, boolean>, final = false) => {
    const docks = rulesRef.current >= 2 ? roundDocks() : undefined;
    if (tally(chain, ruled, talliedRef.current, scoresRef.current, final, docks)) {
      setScores({ ...scoresRef.current });
      if (docks) setDockedAt({ ...dockedAtRef.current });
    }
  };
  const roundDocks = (): Docks => ({ docked: dockedRef.current, at: dockedAtRef.current, chain: revealIndexRef.current });

  // Under the per-round rule, who missed judging the chain this phone is
  // committing (./rules judgingMissed): every phone docks whoever it says.
  const missedJudging = (timedOut: boolean) => {
    if (rulesRef.current < 2) return [];
    const owner = chainOwner(chainsRef.current[revealIndexRef.current]);
    return judgingMissed(owner, usernameRef.current, stoodInRef.current, timedOut, orderedNames().includes(owner));
  };

  // Keeper's fallback: if the judge stalls, commit whatever rulings exist and move on.
  const forceRevealChain = () => {
    if (!actsForClock()) return;
    send('chain-scored', {
      round: roundRef.current,
      chain: revealIndexRef.current,
      rulings: rulingsRef.current,
      by: usernameRef.current,
      missed: missedJudging(true),
    });
  };

  // Judge stepped the reveal cursor or ruled a guess — mirror it to everyone.
  // `by` says who judged it (2.9.0 doesn't say): someone other than its owner
  // has stood in for them.
  const onRevealState = (chain: number, step: number, ruled: Record<number, boolean>, by: string) => {
    if (chain !== revealIndexRef.current) return;
    if (by && by !== chainOwner(chainsRef.current[chain])) stoodInRef.current = true;
    revealStepRef.current = step;
    setRevealStep(step);
    rulingsRef.current = ruled ?? {};
    setRulings(ruled ?? {});
    if (chainsRef.current[chain]) tallyRulings(chainsRef.current[chain], ruled ?? {}); // the totals move with the ✓
    maybeAutoRule();
    changed();
  };

  const onChainScored = (chainIdx: number, ruled: Record<number, boolean>, missed: string[]) => {
    // Idempotent per chain: only the first commit for the current chain counts,
    // so the judge's finish and the keeper's timeout fallback can't both advance.
    if (chainIdx !== revealIndexRef.current) return;
    if (chainsRef.current[chainIdx]) tallyRulings(chainsRef.current[chainIdx], ruled ?? {}, true); // anything not yet counted
    // Under the per-round rule, an owner who wasn't there to judge this chain
    // loses this round's point, if nothing else has cost it them.
    if (rulesRef.current >= 2) {
      for (const name of missed) {
        if (dock(roundDocks(), scoresRef.current, name, `${chainIdx}:judge`)) {
          showToast(`−1 ${name}: missed judging their chain`, 3000);
          setScores({ ...scoresRef.current });
          setDockedAt({ ...dockedAtRef.current });
        }
      }
    }
    const next = revealIndexRef.current + 1;
    revealIndexRef.current = next;
    setRevealIndex(next);
    revealStepRef.current = nextShown(chainsRef.current[next], 0); // next chain: show prompt + first drawing
    setRevealStep(revealStepRef.current);
    rulingsRef.current = {};
    talliedRef.current = {};
    setRulings({});
    stoodInRef.current = false;
    if (next >= chainsRef.current.length) {
      finishRound();
    } else {
      beginStage('reveal'); // re-arm the per-chain fallback clock for the next chain
      nudgeJudge();
      maybeAutoRule();
    }
    changed();
  };

  // The game is over. (Whoever sent this has told the server: endGame. A
  // 2.9.0 keeper tells it as its own message comes back.)
  const onGameOver = () => {
    clearClock();
    dbPhaseRef.current = 'lobby';
    go('/scoreboard');
    beginStage('gameover');
  };

  // ---- Reconnect / late-join state sync ----
  // A phone catching up asks for the game: the keeper answers at once, and in
  // case it has gone quiet, the other caught-up phones on screen answer a
  // moment apart after it (clockRank), each standing down when it sees an
  // answer go first (onState). `sentAt` is the sender's clock as it sends, so
  // the phone catching up can tell how far into the stage the game is without
  // the two clocks agreeing.
  const onRequestState = (who: string) => {
    if (who === usernameRef.current || !syncedRef.current) return;
    const rank = clockRank();
    if (rank < 0) return;
    const answer = () => {
      answersRef.current.delete(who);
      if (!roomRef.current || !syncedRef.current || !awakeRef.current) return;
      send('state', { to: who, ...buildState(), sentAt: Date.now() });
    };
    const pending = answersRef.current.get(who);
    if (pending) clearTimeout(pending);
    answersRef.current.delete(who);
    if (rank === 0) answer();
    else answersRef.current.set(who, setTimeout(answer, rank * ANSWER_STAGGER_MS));
  };

  // Take on the game as `st` describes it (an answer from a caught-up phone,
  // or the snapshot a phone restores) and go to its screen.
  const applyState = (st: GameState) => {
    const p: Phase = st.phase ?? 'lobby';
    // Still on the very stage the game is at (back from a short trip out of
    // the app): stay on this screen, so a drawing in progress isn't lost and a
    // turn already handed in isn't offered again.
    const same =
      p !== 'lobby' &&
      p === phaseRef.current &&
      (st.stage ?? 0) === stageRef.current &&
      (st.round ?? 0) === roundRef.current &&
      (st.revealIndex ?? 0) === revealIndexRef.current;
    // The same round of the same game: this phone's turns are kept where the
    // keeper's copy has them empty, and sent again for everyone (mend).
    const sameRound = isGameOn(p) && isGameOn(phaseRef.current) && (st.round ?? 0) === roundRef.current;
    const incoming = st.chains ?? [];
    if (sameRound) mendAll(incoming, p === 'reveal' ? finalStage(st.roster?.length ?? 0) : (st.stage ?? 0) - 1);
    targetRef.current = st.target ?? 5;
    setTarget(targetRef.current);
    leaderRef.current = st.leader ?? '';
    roundRef.current = st.round ?? 0;
    rosterRef.current = st.roster ?? [];
    chainsRef.current = sameRound ? mergeChains(chainsRef.current, incoming) : incoming;
    setChains(chainsRef.current);
    scoresRef.current = st.scores ?? {};
    setScores({ ...scoresRef.current });
    addGameNames(rosterRef.current, Object.keys(scoresRef.current));
    revealIndexRef.current = st.revealIndex ?? 0;
    setRevealIndex(revealIndexRef.current);
    revealStepRef.current = st.revealStep ?? 0;
    setRevealStep(revealStepRef.current);
    rulingsRef.current = st.rulings ?? {};
    talliedRef.current = { ...rulingsRef.current }; // already in st.scores
    setRulings(rulingsRef.current);
    // The game's scoring rules (none from 2.9.0, which only knows the first),
    // and who has already lost this round's point (also in st.scores).
    rulesRef.current = asRules(st.rules);
    setRules(rulesRef.current);
    dockedRef.current = new Set(st.docked);
    dockedAtRef.current = { ...st.dockedAt };
    setDockedAt(dockedAtRef.current);
    stoodInRef.current = st.stoodIn;
    if (Array.isArray(st.prompts)) allPromptsRef.current = st.prompts;
    if (Array.isArray(st.pool)) poolRef.current = st.pool;
    // The prompts handed out so far (a keeper from before this was kept sends
    // none: this round's own are known from its chains, at least).
    usedRef.current = new Map();
    noteUsed(st.used);
    noteUsed(chainsRef.current.map((c) => c.cells[0]).filter((c): c is Extract<Cell, { kind: 'prompt' }> => c?.kind === 'prompt'));
    viewAcksRef.current = new Set(Array.isArray(st.viewAcks) ? st.viewAcks : []);
    setViewReady(viewAcksRef.current.has(usernameRef.current));
    setPromptCount(st.promptCount ?? allPromptsRef.current.length);
    advancedForRef.current = (st.stage ?? 0) - 1;
    if (p !== 'lobby' && p !== 'gameover') dbPhaseRef.current = 'playing';

    if (same) {
      // Stay put (the clock is re-armed below).
    } else if (p === 'view' || p === 'draw' || p === 'caption') {
      routeForStage(st.stage ?? (p === 'view' ? 0 : 1));
    } else if (p === 'reveal') {
      go('/reveal');
      beginStage('reveal');
    } else if (p === 'gameover') {
      go('/scoreboard');
      beginStage('gameover');
    } else if (p === 'prompts') {
      go('/prompts');
      beginStage('prompts');
    } else {
      // The lobby: only if this phone isn't in it already (./nav lobbyOnCatchUp).
      const was = phaseRef.current;
      phaseRef.current = 'lobby';
      setPhase('lobby');
      if (lobbyOnCatchUp(was, pathRef.current)) go('/lobby');
    }
    // The clock carries on from where the stage started, not from now: in
    // this phone's time, from the sender's own reading as it sent this
    // (sentAt). A snapshot has none, and is read as if the clocks agree; one
    // saved as the game was paused (`pausedAt`: everyone went away) carries
    // on from where its stage was then. The screen follows the clock, even one
    // that stayed put (`same`): a paused stage's deadline has moved.
    if (typeof st.stageStartedAt === 'number' && st.stageStartedAt > 0) {
      const elapsed = st.sentAt
        ? Math.max(0, st.sentAt - st.stageStartedAt)
        : st.pausedAt
          ? Math.max(0, st.pausedAt - st.stageStartedAt)
          : Date.now() - st.stageStartedAt;
      stageStartedAtRef.current = Date.now() - elapsed;
      setEndsAt(stageStartedAtRef.current + durationFor(p) * 1000);
      if (isKeeperRef.current) armForCurrentStage(false);
      armJudgeWait(); // a chain at the reveal came up that long ago
    }
    lastChangeRef.current = Math.max(lastChangeRef.current, Number(st.savedAt) || 0);
    computeSkips();
  };

  const markSynced = () => {
    syncedRef.current = true;
    stopAsking();
    if (awakeRef.current) setResuming(false); // on screen and caught up: the clocks can run out again
    track();
    updateKeeper();
    // A turn handed in late while this phone was catching up (submitCell):
    // now it knows whether its stage is still open. If it isn't, the turn was
    // missed.
    const held = heldRef.current;
    heldRef.current = null;
    if (held && sameTurn(held.turn, currentTurn())) submitCell(held.data, held.turn, held.closing);
  };

  // An answer to a phone catching up (to one player), or a restored game
  // (to '*': everyone still catching up). Once this phone is caught up, an
  // answer to it is a second one, no newer than the first: what has happened
  // since has already come in.
  const onState = (st: GameState) => {
    // That phone has its answer: nobody else need send one.
    const pending = answersRef.current.get(st.to);
    if (pending) {
      clearTimeout(pending);
      answersRef.current.delete(st.to);
    }
    if (syncedRef.current || (st.to !== usernameRef.current && st.to !== '*')) return;
    applyState(st);
    markSynced();
  };

  // This phone picks the game up itself: it's the keeper but isn't caught up
  // (nobody who is has the app open), or (`force`) its asks went unanswered
  // (resync), which leaves nobody on screen to ask. From the server's
  // snapshot — or from this phone's own memory, if that is newer (it kept
  // the clock a moment ago) — and it sends that to everyone still catching
  // up. As keeper it waits a moment first, in case someone caught up appears.
  const restore = (force = false) => {
    if (restoringRef.current) return;
    restoringRef.current = true;
    const code = roomRef.current;
    const mine = () => force || isKeeperRef.current;
    // It didn't work out (not this phone's to pick up after all, the server
    // couldn't be reached, or there's nothing saved yet): back to asking the
    // room, so a phone catching up never stops trying.
    const keepAsking = () => {
      if (code === roomRef.current && !syncedRef.current && awakeRef.current && !askTimerRef.current) {
        askTimerRef.current = setTimeout(askForState, ASK_EVERY_MS);
      }
    };
    setTimeout(async () => {
      if (code !== roomRef.current || syncedRef.current || !mine()) {
        restoringRef.current = false;
        return keepAsking();
      }
      const res = await roomState(code, true);
      restoringRef.current = false;
      if (code !== roomRef.current || syncedRef.current) return;
      if (res.status === 'closed') return closeLocally(closedMessage(code, res.reason));
      if (res.status !== 'ok') return keepAsking();
      dbPhaseRef.current = res.phase;
      setMembers(res.members, false);
      if (!mine()) return keepAsking();
      const local = phaseRef.current;
      const midGame = local !== 'lobby' && local !== 'gameover';
      if (res.phase !== 'playing') {
        // No game on (or it ended while this phone was away): the lobby, unless
        // this phone is already looking at the final scores.
        if (lobbyOnCatchUp(local, pathRef.current)) {
          clearClock();
          phaseRef.current = 'lobby';
          setPhase('lobby');
          go('/lobby');
        }
        return markSynced();
      }
      const snap = res.snapshot;
      const savedAt = Number(snap?.savedAt) || 0;
      // This phone's own copy, if it's newer than the server's. But a game
      // saved as it was paused (everyone went away: pausedAt) comes from the
      // server's copy, which knows when its clock stopped (applyState).
      const mineIsNewer = lastChangeRef.current > savedAt || (lastChangeRef.current === savedAt && !snap?.pausedAt);
      if (midGame && mineIsNewer) {
        markSynced();
        armForCurrentStage(false);
      } else if (snap) {
        applyState(asState(snap));
        markSynced();
      } else if (force) {
        // Nothing saved yet (the game has only just started) and someone
        // else is keeping the clock: the room will have it before long.
        return keepAsking();
      } else {
        // A game with nothing saved to resume: start the room over.
        endGameOnServer(code);
        dbPhaseRef.current = 'lobby';
        return markSynced();
      }
      send('state', { to: '*', ...buildState(), sentAt: Date.now() });
      changed();
      maybePromptsComplete();
      maybeAdvanceView();
      maybeAdvanceStage();
      maybeAutoRule();
    }, force ? 0 : 1200);
  };

  // Elect the clock's keeper from who's here (./rules electKeeper).
  const electKeeper = () => electKeeperOf(membersRef.current, presenceRef.current);

  const updateKeeper = () => {
    const name = electKeeper();
    const me = usernameRef.current;
    // Never while off screen (goAway): this phone has left presence, and the
    // room elects someone who's there.
    const keeps = name !== '' && name === me && awakeRef.current;
    const became = keeps && keeperRef.current !== me;
    keeperRef.current = name;
    isKeeperRef.current = keeps;
    // A phone that hands the clock over drops it, so it can arm a fresh one
    // if the role comes back to it.
    if (!keeps) clearClock();
    if (keeps && !syncedRef.current) {
      restore();
      return;
    }
    if (became && phaseRef.current !== 'lobby' && !clockTimerRef.current) {
      armForCurrentStage(false); // took over mid-round — resume the clock
    }
    // A new keeper saves the game at once: the copy on the server may be one a
    // keeper left as it went away, marked paused, which this replaces.
    if (became && isGameOn(phaseRef.current)) changed();
    // Someone leaving may be exactly what unblocks the current stage (a
    // skipped player is no longer waited for), so re-check completion now;
    // and someone coming or going may be the judge the reveal waits for.
    maybePromptsComplete();
    maybeAdvanceView();
    maybeAdvanceStage();
    maybeAutoRule();
    updateJudgeWait();
  };

  const setMembers = (list: Member[], elect = true) => {
    membersRef.current = [...list].sort((a, b) => a.joinedAt - b.joinedAt || a.name.localeCompare(b.name));
    setMembersState(membersRef.current);
    computeSkips();
    if (elect) updateKeeper();
  };

  // Fetch who's in the room again (the server says when it changes). If the
  // server has a game on and this phone doesn't, or the other way round,
  // this phone missed it starting or ending (it was off screen): catch up.
  const refreshMembers = async () => {
    const code = roomRef.current;
    if (!code) return;
    const res = await roomState(code);
    if (code !== roomRef.current) return;
    if (res.status === 'closed') return closeLocally(closedMessage(code, res.reason));
    if (res.status !== 'ok') return;
    dbPhaseRef.current = res.phase;
    setMembers(res.members);
    if ((res.phase === 'playing') !== isGameOn(phaseRef.current)) resync();
  };

  // ---- Public actions ----
  // Create a room (room = null) or join one by its code. `rejoin` only goes
  // back to a room this phone is still in (the home screen, at launch): if
  // it isn't any more, that's 'not_found', never a fresh join of a new room
  // that happens to have the same code. Resolves to how it went;
  // entryMessage says what to tell the player.
  const enterRoom = async (roomCode: string | null, name: string, rejoin = false): Promise<EntryStatus> => {
    const user = cleanName(name);
    const code = roomCode === null ? null : cleanRoomCode(roomCode);
    // The code first: on Join Game, a missing code is the thing to explain.
    if (code === '') return 'no_code';
    if (code !== null && !isRoomCode(code)) return 'bad_code';
    if (!user) return 'no_name';
    if (!supabaseReady) return 'no_keys';
    if (code && code === roomRef.current) {
      // Already in it: back to wherever that game is.
      returnToRoom();
      return 'ok';
    }
    const res = code ? await joinRoom(code, user, rejoin) : await createRoom(user);
    if (res.status !== 'ok') return res.status;
    if (roomRef.current) resetLocal(); // the server has already taken us out of the old room
    await connect(res.room, res.name, res.userId);
    return 'ok';
  };

  const connect = async (code: string, user: string, userId: string) => {
    usernameRef.current = user;
    userIdRef.current = userId;
    roomRef.current = code;
    roundRef.current = 0;
    phaseRef.current = 'lobby';
    syncedRef.current = false;
    setPhase('lobby');
    setUsername(user);
    setRoom(code);
    setStatus('connecting');
    setStatusDetail('');
    saveSession({ room: code, username: user });
    versionsRef.current.set(userId, PROTOCOL);
    // In the room on screen: its notification is out of date.
    clearRoomNotifications();
    // Joining or creating a room already took the server out of every other
    // one, so a Leave game still waiting to be sent has nothing left to do
    // (and sent later, it would take the player out of this room if it's the
    // same one they've come back to).
    takePendingLeave();

    // Who's in the room, before the channel opens, so the host shows at once
    // and the first presence sync can already tell who keeps the clock.
    const st = await roomState(code);
    if (roomRef.current !== code) return;
    if (st.status === 'ok') {
      dbPhaseRef.current = st.phase;
      setMembers(st.members, false);
    }

    // The channel is members-only (supabase/rooms.sql), so it needs the
    // guest's token before it's opened.
    await supabase.realtime.setAuth();
    if (roomRef.current !== code) return;
    const channel = supabase.channel(`room:${code}`, {
      config: { private: true, broadcast: { self: true }, presence: { key: userId } },
    });

    // Any member can send anything (a changed app isn't held to this one's
    // rules), so every message is read through ./wire, and a handler that
    // still throws is caught: a malformed message is ignored, never a crash.
    // A message that came in pieces (src/lib/chunks.ts) is put back together
    // and handed to the same handler as if it had come whole.
    const handlers = new Map<string, (p: Record<string, unknown>) => void>();
    const deliver = (event: string, payload: unknown) => {
      const handle = handlers.get(event);
      if (!handle) return;
      try {
        handle(asObj(payload));
      } catch (e) {
        console.warn(`[realtime] ignored a bad '${event}' message:`, e);
      }
    };
    const on = (event: string, handle: (p: Record<string, unknown>) => void) => {
      handlers.set(event, handle);
      channel.on('broadcast', { event }, ({ payload }) => deliver(event, payload));
    };
    const joiner = new Joiner();
    channel.on('broadcast', { event: 'chunk' }, ({ payload }) => {
      const whole = joiner.add(payload);
      if (whole) deliver(whole.event, whole.payload);
    });
    // Game messages are held up against where this phone's game is first
    // (./rules, "Messages that come late"): applied, ignored as late, or the
    // cue to catch up.
    const fits = (event: string, verdict: Verdict) => {
      if (verdict === 'apply') return true;
      console.log(`[realtime] '${event}':`, verdict === 'stale' ? 'late, ignored' : 'missed something, catching up');
      if (verdict === 'resync') resync();
      return false;
    };
    on('to-prompts', (p) => {
      const t = asTarget(p.target);
      if (t === null) return;
      // Two players tapping New game together send two: the second, a moment
      // after the first, would empty the trough everyone has started filling.
      if (phaseRef.current === 'prompts' && Date.now() - promptsAtRef.current < 10_000) return;
      promptsAtRef.current = Date.now();
      // The game's scoring rules: whoever started it says (2.9.0 doesn't: its own).
      onToPrompts(t, asRules(asInt(p.rules, 1, 1000)));
    });
    on('prompt', (p) => {
      const prompt = asPrompt(p);
      if (prompt) onPrompt(prompt.text, prompt.author);
    });
    on('view-ack', (p) => {
      const who = cleanName(p.username);
      if (who && fits('view-ack', verdictForViewAck(position(), asRound(p.round)))) onViewAck(who);
    });
    on('round', (p) => {
      const round = asInt(p.round, 0, 100_000);
      const roster = asRoster(p.roster);
      const seeds = asSeeds(p.seeds);
      if (round === null || !roster || !seeds) return;
      if (fits('round', verdictForRound(position(), round))) onRound(round, roster, seeds, cleanName(p.leader));
    });
    on('cell', (p) => {
      const chain = asIndex(p.chain);
      const stage = asStage(p.stage);
      const cell = asCell(p.cell);
      if (chain === null || stage === null || !cell) return;
      if (fits('cell', verdictForCell(position(), chain, stage, asRound(p.round)))) onCell(chain, stage, cell);
    });
    on('advance', (p) => {
      const stage = asStage(p.stage);
      if (!stage) return;
      if (fits('advance', verdictForAdvance(position(), stage, asRound(p.round)))) onAdvance(stage, asCells(p.cells));
    });
    on('to-reveal', (p) => {
      const chains = asChains(p.chains);
      if (chains && fits('to-reveal', verdictForToReveal(position(), asRound(p.round)))) onToReveal(chains);
    });
    on('reveal-state', (p) => {
      const chain = asIndex(p.chain);
      const step = asStage(p.step);
      if (chain === null || step === null) return;
      if (fits('reveal-state', verdictForRevealStep(position(), chain, step, asRound(p.round)))) {
        onRevealState(chain, step, asRulings(p.rulings), cleanName(p.by));
      }
    });
    on('chain-scored', (p) => {
      const chain = asIndex(p.chain);
      if (chain === null) return;
      if (fits('chain-scored', verdictForChainScored(position(), chain, asRound(p.round)))) {
        onChainScored(chain, asRulings(p.rulings), asNames(p.missed));
      }
    });
    on('game-over', (p) => {
      if (fits('game-over', verdictForGameOver(position(), asRound(p.round)))) onGameOver();
    });
    on('request-state', (p) => {
      const who = cleanName(p.username);
      if (who) onRequestState(who);
    });
    on('state', (p) => onState(asState(p)));
    // From the server: the room's list changed, or the room closed.
    on('members', () => refreshMembers());
    on('room-closed', (p) => closeLocally(closedMessage(code, asClosedReason(p.reason))));
    channel.on('presence', { event: 'sync' }, () => {
      try {
        const state = channel.presenceState() as Record<string, any[]>;
        const latest = Object.values(state)
          .map((entries) => entries[entries.length - 1])
          .filter((m) => m?.userId);
        presenceRef.current = latest.map((m) => ({
          id: String(m.userId),
          name: cleanName(m.username),
          synced: !!m.synced,
        }));
        setPresentIds(presenceRef.current.map((p) => p.id));
        const seen: Record<string, Avatar> = {};
        for (const m of latest) {
          const who = cleanName(m.username);
          if (who) seen[who] = cleanAvatar(m.avatar);
          // Which scoring rules this phone knows (./rules gameRules), kept
          // after it goes away: a game started without it still counts it.
          const v = asInt(m.v, 1, 1000);
          if (v !== null) versionsRef.current.set(String(m.userId), v);
        }
        setAvatars((was) => ({ ...was, ...seen }));
        updateKeeper();
        console.log('[realtime] here:', presenceRef.current.map((p) => p.name), '| clock:', keeperRef.current);
      } catch (e) {
        console.warn('[realtime] ignored a bad presence update:', e);
      }
    });

    channelRef.current = channel;
    channel.subscribe((s, err) => {
      console.log('[realtime] subscribe status:', s, err ? String(err) : '');
      // A room left (or switched from) reports CLOSED as it goes; by then
      // it's not this phone's channel and must not touch the new one's state.
      if (channelRef.current !== channel) return;
      if (s === 'SUBSCRIBED') {
        subscribedRef.current = true;
        setStatus('connected');
        setStatusDetail('');
        // Connected again after being away: the game may have moved on, so
        // catch up before keeping the clock.
        resync(true);
        refreshMembers();
      } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') {
        subscribedRef.current = false;
        setStatus('error');
        setStatusDetail(String(err ?? s));
        // Cut off from the room: nobody can hear this phone's clock, and the
        // game will have moved on without it by the time it's back. It stands
        // down until it's back in and caught up (SUBSCRIBED).
        standDown();
      } else {
        setStatus('connecting');
      }
    });

    // The lobby goes right over home (Create or Join go, and whatever Join
    // was opened over), so Back from it goes home, still in the room. A game
    // already on (coming back to it
    // after the app closed) shows the waiting screen until the room's answer
    // brings this phone to the game's own screen (applyState): not the lobby
    // first, and then the game.
    go(dbPhaseRef.current === 'playing' ? '/waiting' : '/lobby', true);
    // The first lobby is where the phone asks to send notifications.
    registerForPush(true);
  };

  // Forget the room on this phone (the server is told separately, or already knows).
  const resetLocal = () => {
    // "Leave?" has no room left to ask about. (Elsewhere, the question is a solo
    // game's own, which carries on.)
    if (isRoomScreen(pathRef.current)) closeConfirm();
    clearClock();
    clearStartDelay();
    stopAsking();
    forgetAnswers();
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
    snapTimerRef.current = null;
    if (judgeTimerRef.current) clearTimeout(judgeTimerRef.current);
    judgeTimerRef.current = null;
    forgetTurns();
    forgetDocks();
    heldRef.current = null;
    dueRef.current = { key: '', since: 0, acted: 0 };
    versionsRef.current = new Map();
    rulesRef.current = 1;
    outboxRef.current = [];
    clearSession();
    const channel = channelRef.current;
    channelRef.current = null;
    subscribedRef.current = false;
    if (channel) supabase.removeChannel(channel);
    roomRef.current = '';
    membersRef.current = [];
    presenceRef.current = [];
    isKeeperRef.current = false;
    keeperRef.current = '';
    syncedRef.current = false;
    restoringRef.current = false;
    dbPhaseRef.current = 'lobby';
    phaseRef.current = 'lobby';
    rosterRef.current = [];
    skipRef.current = new Set();
    gameNamesRef.current = new Set();
    chainsRef.current = [];
    scoresRef.current = {};
    allPromptsRef.current = [];
    poolRef.current = [];
    usedRef.current = new Map();
    setPhase('lobby');
    setMembersState([]);
    setPresentIds([]);
    setGameNames([]);
    setAvatars({});
    setRoom('');
    setChains([]);
    setScores({});
    setPrev(null);
    setTurn(null);
    setJudgeWait('');
    setRules(1);
    setResuming(false);
  };

  // Leave game: the only way out of a room, short of it closing. Back to the
  // home screen.
  const leaveRoom = () => {
    const code = roomRef.current;
    if (code) {
      leaveRoomOnServer(code).then((ok) => {
        if (!ok) savePendingLeave(code); // offline: told the next time the app opens
      });
    }
    resetLocal();
    goHome();
  };
  // Leave game, and Back during a game, ask first. The game carries on behind
  // the question: it has other players waiting on it. What it costs goes by the
  // server's phase too: a phone back in a game is in the lobby until it catches
  // up, but the server won't let it rejoin. If too few would be left to play on
  // without this player, the game ends for everyone (rooms.sql leave_room_as),
  // and the question says so.
  const askToLeave = () => {
    const gameOn = isGameOn(phaseRef.current) || dbPhaseRef.current === 'playing';
    confirmLeave(leaveCost(gameOn, gameOn && orderedNames().length - 1 < MIN_PLAYERS), leaveRoom);
  };
  useBackGuard(holdsBack(!!room, phase, pathname), askToLeave);

  // The room closed under us (idle too long, or too few players left in its
  // game to play on): back to the home screen, from the room's screens (a
  // player looking around elsewhere stays there), saying why.
  const closeLocally = (message: string) => {
    if (!roomRef.current) return;
    resetLocal();
    goHome();
    showToast(message, 5000);
  };

  // A Leave game the server never heard about is sent now.
  useEffect(() => {
    takePendingLeave().then((code) => {
      if (code) {
        leaveRoomOnServer(code).then((ok) => {
          if (!ok) savePendingLeave(code);
        });
      }
    });
    registerForPush(false); // keeps the server's copy of the token fresh
  }, []);

  // Off screen, the phone leaves presence and stops keeping the clock
  // (goAway); back on screen it catches up (comeBack). Only a real trip to the
  // background counts: a moment in 'inactive' (an iPhone's Control Center, a
  // Face ID prompt) never left, and nothing changes.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') {
        if (!awakeRef.current) return;
        awakeRef.current = false;
        goAway();
      } else if (s === 'active' && !awakeRef.current) {
        awakeRef.current = true;
        comeBack();
      }
    });
    return () => sub.remove();
  }, []);

  // The clock's backup (watchClock), once a second while in a room.
  useEffect(() => {
    if (!room) return;
    const id = setInterval(watchClock, 1000);
    return () => clearInterval(id);
  }, [room]);

  // In the lobby or on the scoreboard, a room with someone looking at it isn't
  // idle. (Mid-game only what people do counts: the keeper's clock carrying the
  // game on by itself doesn't keep it open.)
  useEffect(() => {
    if (!room || (phase !== 'lobby' && phase !== 'gameover')) return;
    const id = setInterval(() => {
      if (AppState.currentState === 'active') touchRoom(room);
    }, 2 * 60_000);
    return () => clearInterval(id);
  }, [room, phase]);

  // The brush (./brush) lasts the game: a new one, or another room, starts
  // it again in black at the usual width. Every game passes through the lobby
  // or the trough (prompts) before anyone draws.
  useEffect(() => {
    if (phase === 'lobby' || phase === 'prompts') newGameBrush();
  }, [room, phase]);

  // A change to the pig (an outfit, a bubble, a theme part) while in a room
  // goes out at once.
  useEffect(() => {
    if (status === 'connected') track();
  }, [myAvatar]);

  // Once per tap: a second tap while the first is still on its way does
  // nothing (two players tapping New game together is onToPrompts' to sort).
  const startingRef = useRef(false);
  const startGame = async (t: number) => {
    const code = roomRef.current;
    if (!code || startingRef.current || orderedNames().length < MIN_PLAYERS) return;
    startingRef.current = true;
    try {
      // The server closes the room to newcomers first.
      if (!(await startGameOnServer(code))) {
        showToast('Couldn’t start the game. Check your connection and try again.', 3000);
        return;
      }
      if (code !== roomRef.current) return;
      dbPhaseRef.current = 'playing';
      // The scoring rules every phone in the game knows (./rules gameRules).
      const rules = gameRules(membersRef.current, versionsRef.current);
      send('to-prompts', { target: Math.max(1, t), rules });
      nudge(code, 'start', awayIds());
    } finally {
      startingRef.current = false;
    }
  };

  // Add one prompt to the shared pool (broadcast so the live count updates on
  // every device). Players keep adding until the pool is full and the game auto-starts.
  const addPrompt = (text: string) => {
    const clean = cleanPhrase(text);
    if (!clean) return;
    send('prompt', { text: clean, author: usernameRef.current });
    touchRoom(roomRef.current);
  };

  // Round 1: tap through after reading the prompt of the chain you own (or
  // the clock does it for you).
  // Only while Round 1's view is still on: a tap landing as the game moves on
  // mustn't count for the drawing they've just been handed.
  // The player stays on Round 1, which says Player ready at once (the room
  // hears it a moment later, this phone too: onViewAck); once everyone in the
  // round is ready, the keeper starts the drawing and everyone goes straight to it.
  const readyView = (byHand = true) => {
    if (phaseRef.current !== 'view') return;
    setViewReady(true);
    send('view-ack', { round: roundRef.current, username: usernameRef.current });
    if (byHand) touchRoom(roomRef.current);
  };

  // Hand in a turn: a drawing (JSON) on a drawing stage, a guess on a
  // guessing one. `forTurn` is the turn the screen was opened for (its
  // `turn`); without it, the current one. One handed in after its turn has
  // passed (Submit tapped, or the clock running out, just as the stage moved
  // on; or the screen closing with a drawing on it) still goes to that turn,
  // where it mends the blank the keeper filled in (mergeCell), and the player
  // stays where the game has taken them. An empty one that late is nothing
  // to send. `closing`: handed in by a screen as it closes, which never
  // moves the player (the screen is going because they're already going
  // somewhere).
  //
  // But one handed in long after its own clock ran out (isLate) comes from a
  // screen that slept through its deadline, waking before the phone has
  // caught up: it counts only if the room still has that stage open, which
  // the phone can't tell until it has caught up, so it's held until then
  // (markSynced). If the room has moved on, the turn was missed.
  const submitCell = (data: string, forTurn?: Turn | null, closing = false) => {
    // Nothing is handed in from off screen (a screen closing as the game
    // moves on behind the phone's back): a player who isn't there misses the turn.
    if (!awakeRef.current) return;
    const now = currentTurn();
    const t = forTurn ?? now;
    if (!t || t.chain < 0 || t.stage < 1 || !roomRef.current) return;
    const cell: Cell =
      phaseForStage(t.stage) === 'draw'
        ? { kind: 'drawing', data, author: usernameRef.current }
        : { kind: 'caption', text: cleanPhrase(data), author: usernameRef.current };
    const current = sameTurn(t, now);
    if (handedRef.current.has(turnKey(t))) return;
    if (isLate(deadlinesRef.current.get(turnKey(t)) ?? 0, Date.now())) {
      if (!syncedRef.current) {
        heldRef.current = { turn: t, data, closing };
        return;
      }
      if (!current) return;
    }
    if (!current && (isEmptyTurn(cell) || t.round !== roundRef.current)) return;
    handIn(t, cell);
    if (!isEmptyTurn(cell)) touchRoom(roomRef.current);
    if (current && !closing) go('/waiting');
  };

  // Let a guessing turn go without a guess (the clock ran out on an empty
  // box): the keeper fills it in empty. Only if it's still that turn, and not
  // from a screen that slept through its deadline: catching up moves the
  // player on from that one.
  const passTurn = (forTurn?: Turn | null) => {
    const now = currentTurn();
    if (forTurn && !syncedRef.current && isLate(deadlinesRef.current.get(turnKey(forTurn)) ?? 0, Date.now())) return;
    if (!forTurn || sameTurn(forTurn, now)) go('/waiting');
  };

  // The round leader judges the reveal, but if they don't have the app open
  // the role falls to the first one here (the longest in) so it never stalls.
  const effectiveLeader = (names: string[]) => leaderOf(leaderRef.current, names);

  // Not until this phone has caught up: what it would rule on may be out of date.
  const isJudgeNow = () =>
    syncedRef.current && usernameRef.current === judgeForChain(revealIndexRef.current, presentNames());

  // Judge votes on the cell currently at the frontier (does it match the original
  // prompt?). Two-phase so everyone sees a ✓/✗ beat: first broadcast the ruling
  // (drives the animation), then after ~0.9s auto-advance to the next cell — or,
  // if that was the last cell, commit the chain's scores and move to the next
  // chain. Idempotent: re-voting the same cell is ignored. Each message says
  // who judged (`by`), and the commit who missed judging it (missedJudging).
  const vote = (correct: boolean, byHand = true) => {
    if (!isJudgeNow()) return;
    const chainIdx = revealIndexRef.current;
    const step = revealStepRef.current;
    const chain = chainsRef.current[chainIdx];
    if (!chain || rulingsRef.current[step] !== undefined) return;
    const rulings = { ...rulingsRef.current, [step]: correct };
    const nextStep = nextShown(chain, step);
    const round = roundRef.current;
    const by = usernameRef.current;
    send('reveal-state', { round, chain: chainIdx, step, rulings, by }); // phase 1: the mark
    if (byHand) touchRoom(roomRef.current);
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = setTimeout(() => {
      // Chain (or round) already moved on.
      if (revealIndexRef.current !== chainIdx || roundRef.current !== round || phaseRef.current !== 'reveal') return;
      if (nextStep >= chain.cells.length) {
        send('chain-scored', { round, chain: chainIdx, rulings, by, missed: missedJudging(false) });
      } else {
        send('reveal-state', { round, chain: chainIdx, step: nextStep, rulings, by });
      }
    }, 900);
  };

  // The judge's phone marks an empty turn ✗ by itself after a beat (there's
  // nothing to judge, and a missed turn's −1 shows as it does), and commits a
  // chain that has nothing left to show.
  const maybeAutoRule = () => {
    if (phaseRef.current !== 'reveal' || !isJudgeNow()) return;
    const ci = revealIndexRef.current;
    const step = revealStepRef.current;
    const chain = chainsRef.current[ci];
    if (!chain) return;
    const key = `${roundRef.current}:${ci}:${step}`;
    if (autoRuleRef.current === key) return;
    if (step >= chain.cells.length) {
      autoRuleRef.current = key;
      send('chain-scored', {
        round: roundRef.current,
        chain: ci,
        rulings: rulingsRef.current,
        by: usernameRef.current,
        missed: missedJudging(false),
      });
      return;
    }
    if (rulingsRef.current[step] !== undefined || !isEmptyTurn(chain.cells[step])) return;
    autoRuleRef.current = key;
    const round = roundRef.current;
    setTimeout(() => {
      if (roundRef.current !== round || revealIndexRef.current !== ci || revealStepRef.current !== step) return;
      // Still empty: it wasn't mended meanwhile (onCell).
      if (isEmptyTurn(chainsRef.current[ci]?.cells[step])) vote(false, false);
      else autoRuleRef.current = '';
    }, AUTO_RULE_MS);
  };

  // What the screens see.
  const here = new Set(presentIds);
  const active = members.filter((m) => m.leftAt == null);
  const players = active.map((m) => m.name);
  const present = active.filter((m) => here.has(m.id)).map((m) => m.name);
  // Nobody is away until presence has reported at least once (this phone is
  // always in it), or the whole room would flash AWAY on the way in.
  const away =
    status === 'connected' && presentIds.length ? active.filter((m) => !here.has(m.id)).map((m) => m.name) : [];
  const departed = members.length ? gameNames.filter((n) => !players.includes(n)) : [];
  // Who's still at this stage's turn (`chains` moves as each turn comes in).
  const stillWorking =
    phase === 'draw' || phase === 'caption' ? stillToGo(rosterRef.current, chains, stage, skipRef.current, username) : [];

  // The host is the longest in, away or not; while they're away, anyone here
  // can start the game.
  const host = roomHost(members);
  const isHost = username !== '' && username === host;
  const canStart = isHost || (present.includes(username) && !present.includes(host));

  const liveLeader = effectiveLeader(present);
  const currentJudge = (() => {
    const owner = chainOwner(chains[revealIndex]);
    if (owner && present.includes(owner)) return owner;
    if (judgeWait) return ''; // waiting for the owner to come back
    return liveLeader;
  })();
  const promptsNeeded = promptsNeededFor(players.length, target);
  return (
    <GameCtx.Provider
      value={{
        username,
        room,
        host,
        canStart,
        players,
        away,
        departed,
        avatars,
        status,
        statusDetail,
        phase,
        stage,
        prev,
        chains,
        scores,
        target,
        leader: liveLeader,
        revealIndex,
        revealStep,
        rulings,
        judge: currentJudge,
        isJudge: username !== '' && username === currentJudge,
        judgeWait,
        rules,
        dockedAt,
        promptCount,
        promptsNeeded,
        turn,
        turnEndsAt,
        stillWorking,
        resuming,
        enterRoom,
        returnToRoom,
        askToLeave,
        startGame,
        addPrompt,
        readyView,
        viewReady,
        submitCell,
        passTurn,
        vote,
      }}
    >
      {children}
    </GameCtx.Provider>
  );
}
