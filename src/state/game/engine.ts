import type { Dispatch, SetStateAction } from 'react';
import { AppState } from 'react-native';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Avatar } from '../../avatar/avatar';
import type { Member, RoomPhase } from '../../lib/rooms';
import type { Cell, Chain, Phase, Presence, Prev, Rules } from '../rules';
import type { GameState, PigOff } from '../wire';
import type { ConnStatus, EntryStatus, Handed, Turn } from './types';

/**
 * The live game on this phone, as one object shared by the modules in this
 * folder (one per concern: turns.ts, reveal.ts, sync.ts, …). GameProvider
 * creates it once; each module's install function adds its functions to it.
 *
 * Two rules keep it working:
 *  - Modules call each other only through the engine (`e.beginStage()`), never
 *    by importing one another, so it doesn't matter which is installed first
 *    and there are no circular imports. A module's own functions call each
 *    other directly.
 *  - Engine functions read the game from its refs (`e.phaseRef.current`),
 *    never from React state: the channel's handlers and the timers keep the
 *    functions they were given, so anything they read has to be current
 *    through a ref. The React state (the setters here) is only what the
 *    screens see.
 */

type Ref<T> = { current: T };
type Timer = ReturnType<typeof setTimeout>;
type Setter<T> = Dispatch<SetStateAction<T>>;

const ref = <T,>(current: T): Ref<T> => ({ current });

function createRefs(path: string, avatar: Avatar) {
  return {
    // ---- The room and the channel ----
    channelRef: ref<RealtimeChannel | null>(null),
    subscribedRef: ref(false),
    // A new channel on its way in place of one that closed for good (channel.ts ensureChannel).
    reopenTimerRef: ref<Timer | null>(null),
    roomRef: ref(''),
    usernameRef: ref(''),
    userIdRef: ref(''),
    membersRef: ref<Member[]>([]),
    presenceRef: ref<Presence[]>([]),
    // This player's own avatar, sent in their presence (and sent again if it
    // changes while they're in a room). GameProvider keeps it current.
    myAvatarRef: ref(avatar),
    // Which scoring rules each phone in the room knows, by user id, as its
    // presence has said (../rules gameRules; 2.9.0 says nothing: 1).
    versionsRef: ref(new Map<string, number>()),
    // The server's phase for the room: 'playing' from Start until the game ends.
    dbPhaseRef: ref<RoomPhase>('lobby'),
    // Everything sent goes out in order (outbox.ts).
    outboxRef: ref<{ channel: RealtimeChannel; event: string; payload: unknown }[]>([]),
    sendingRef: ref(false),

    // ---- Keeping the clock, and catching up ----
    isKeeperRef: ref(false),
    keeperRef: ref(''), // the clock's keeper's name (for detecting handover)
    // Whether this phone holds the game as it stands. False from (re)connecting,
    // or going off screen, until a caught-up phone sends the state, or until
    // this phone restores it.
    syncedRef: ref(false),
    restoringRef: ref(false),
    // When this phone's copy of the game last changed (it rides in the
    // snapshot as savedAt), so a keeper that comes back can tell whether the
    // server's snapshot or its own memory is newer.
    lastChangeRef: ref(0),
    snapTimerRef: ref<Timer | null>(null),
    lastResyncRef: ref(0),
    askTimerRef: ref<Timer | null>(null),
    // Answers this phone is about to give to phones catching up, by name
    // (sync.ts onRequestState), each dropped once someone else's answer goes by.
    answersRef: ref(new Map<string, Timer>()),
    // Whether the app is on screen. Off it (another app, a locked phone, a
    // hidden browser tab) the phone isn't in presence, can't keep the game's
    // clock, and doesn't catch up until it's back (appState.ts).
    awakeRef: ref(AppState.currentState !== 'background'),
    awayCallRef: ref<Promise<unknown>>(Promise.resolve()),
    clockTimerRef: ref<Timer | null>(null),
    stageStartedAtRef: ref(0),
    // What the keeper does to move the game on, a phone standing in for it can
    // do too (the clock's backup: clock.ts watchClock sets `acting` while it does).
    actingRef: ref(false),
    dueRef: ref({ key: '', since: 0, acted: 0 }),

    // ---- The game ----
    phaseRef: ref<Phase>('lobby'),
    stageRef: ref(0),
    rosterRef: ref<string[]>([]), // player order fixed for the current round
    skipRef: ref<Set<string>>(new Set()), // left mid-round with 3+ carrying on: turns passed over
    gameNamesRef: ref<Set<string>>(new Set()), // everyone who has played in this game
    myChainRef: ref(-1), // which chain I'm working on this stage
    chainsRef: ref<Chain[]>([]),
    scoresRef: ref<Record<string, number>>({}),
    targetRef: ref(5),
    leaderRef: ref(''),
    roundRef: ref(0),
    advancedForRef: ref(-1), // highest stage we've already emitted an advance for
    // When this phone last started a game (a second start right after is the
    // same tap twice, from two phones: to-prompts).
    promptsAtRef: ref(0),
    // Once per tap: a second tap while the first is still on its way does
    // nothing (startGame, devTieWith).
    startingRef: ref(false),

    // ---- Turns ----
    // The turns this player has handed in this round, by turnKey: each is sent
    // again if it doesn't come back from the channel (handIn), or if the keeper's
    // copy of the game turns up with it empty (mend).
    handedRef: ref(new Map<string, Handed>()),
    // Turns this phone has sent again (or seen sent again) to mend the room's
    // copy of the game, by turnKey; a pending one waits its turn (mend).
    mendRef: ref(new Map<string, Timer | null>()),
    // When each of this player's turns this round ran out, on this phone's
    // clock, by turnKey (so a turn handed in long after can be told: isLate);
    // and one handed in that late while the phone was still catching up, held
    // until it knows whether the room still wants it (markSynced).
    deadlinesRef: ref(new Map<string, number>()),
    heldRef: ref<{ turn: Turn; data: string; closing: boolean } | null>(null),

    // ---- The reveal ----
    revealIndexRef: ref(0),
    revealStepRef: ref(0), // last-revealed cell index within the current chain
    rulingsRef: ref<Record<number, boolean>>({}), // cellIndex -> correct?
    talliedRef: ref<Record<number, boolean>>({}), // rulings of the current chain already counted into scores
    // The game's scoring rules, and under the per-round one who has lost this
    // round's point and where (../rules Docks), and whether anyone has judged
    // the chain being revealed in its owner's place (judgingMissed).
    rulesRef: ref<Rules>(1),
    dockedRef: ref<Set<string>>(new Set()),
    dockedAtRef: ref<Record<string, string>>({}),
    stoodInRef: ref(false),
    advanceTimerRef: ref<Timer | null>(null),
    autoRuleRef: ref(''), // the empty turn the judge's phone last marked by itself
    judgeTimerRef: ref<Timer | null>(null),

    // ---- Pig Off ----
    // The Pig Off on now, as every phone has it; set with setPigOffBoth.
    pigOffRef: ref<PigOff | null>(null),
    // The pack's drawings used in this game's Pig Offs so far, so a replay gets a new one.
    pigOffUsedRef: ref<number[]>([]),

    // ---- Getting around ----
    pathRef: ref(path),
    // The room's screen as the game last put it (or the player left it), for
    // Back to room.
    roomScreenRef: ref('/lobby'),
  };
}

// GameProvider's state setters: what the screens see.
export type Setters = {
  setUsername: Setter<string>;
  setRoom: Setter<string>;
  setMembersState: Setter<Member[]>;
  setPresentIds: Setter<string[]>;
  setReadyIds: Setter<string[]>;
  setGameNames: Setter<string[]>;
  setAvatars: Setter<Record<string, Avatar>>;
  setStatus: Setter<ConnStatus>;
  setStatusDetail: Setter<string>;
  setPhase: Setter<Phase>;
  setStage: Setter<number>;
  setPrev: Setter<Prev | null>;
  setChains: Setter<Chain[]>;
  setScores: Setter<Record<string, number>>;
  setTarget: Setter<number>;
  setRevealIndex: Setter<number>;
  setRevealStep: Setter<number>;
  setRulings: Setter<Record<number, boolean>>;
  setRound: Setter<number>;
  setRoster: Setter<string[]>;
  setPigOff: Setter<PigOff | null>;
  setStageStart: Setter<number>;
  setTurn: Setter<Turn | null>;
  setTurnEndsAt: Setter<number>;
  setJudgeWait: Setter<string>;
  setResuming: Setter<boolean>;
  setRules: Setter<Rules>;
  setDockedAt: Setter<Record<string, string>>;
};

// The whole game as this phone has it (sync.ts buildState): what the keeper
// saves to the server, and what a caught-up phone sends one catching up.
export type Snapshot = {
  phase: Phase;
  stage: number;
  roster: string[];
  chains: Chain[];
  scores: Record<string, number>;
  target: number;
  leader: string;
  round: number;
  revealIndex: number;
  revealStep: number;
  rulings: Record<number, boolean>;
  rules: Rules;
  docked: string[];
  dockedAt: Record<string, string>;
  stoodIn: boolean;
  pigOff: PigOff | null;
  stageStartedAt: number;
  savedAt: number;
};

// Every function a module puts on the engine for the others, by module.
export type EngineFns = {
  // navigation.ts
  go: (path: string, force?: boolean) => void;
  returnToRoom: () => void;
  goHome: () => void;
  // outbox.ts
  send: (event: string, payload?: any) => void;
  // presence.ts
  track: () => void;
  orderedNames: () => string[];
  presentNames: () => string[];
  readyNames: () => string[];
  awayIds: (names?: string[]) => string[];
  hasLeft: (name: string) => boolean;
  clockRank: () => number;
  addGameNames: (...lists: string[][]) => void;
  computeSkips: () => void;
  updateKeeper: () => void;
  setMembers: (list: Member[], elect?: boolean) => void;
  refreshMembers: () => Promise<void>;
  // clock.ts
  actsForClock: () => boolean;
  clearClock: () => void;
  durationFor: (p: Phase) => number;
  armForCurrentStage: (fullDuration: boolean) => void;
  beginStage: (p: Phase) => void;
  setEndsAt: (endsAt: number) => void;
  watchClock: () => void;
  // sync.ts
  resync: (now?: boolean) => void;
  stopAsking: () => void;
  askForState: () => void;
  forgetAnswers: () => void;
  standDown: () => void;
  buildState: () => Snapshot;
  changed: () => void;
  onRequestState: (who: string) => void;
  applyState: (st: GameState) => void;
  markSynced: () => void;
  onState: (st: GameState) => void;
  restore: (force?: boolean) => void;
  // appState.ts
  goAway: () => void;
  comeBack: () => void;
  onAppStateChange: (state: string) => void;
  // turns.ts
  routeForStage: (s: number) => void;
  currentTurn: () => Turn | null;
  mendAll: (incoming: Chain[], upTo: number) => void;
  forgetTurns: () => void;
  stageSettled: () => boolean;
  maybeAdvanceStage: () => void;
  forceAdvance: () => void;
  onCell: (chain: number, s: number, cell: Cell) => void;
  onAdvance: (newStage: number, cells: Cell[]) => void;
  submitCell: (data: string, forTurn?: Turn | null, closing?: boolean) => void;
  passTurn: (forTurn?: Turn | null) => void;
  // rounds.ts
  endGame: (round: number) => void;
  finishRound: () => void;
  onToPrompts: (t: number, playedTo: Rules, roster: string[]) => void;
  onRound: (r: number, roster: string[], lead: string) => void;
  onGameOver: () => void;
  startGame: (t: number) => Promise<void>;
  // reveal.ts
  updateJudgeWait: () => void;
  armJudgeWait: () => void;
  forgetDocks: () => void;
  onToReveal: (incoming: Chain[]) => void;
  forceRevealChain: () => void;
  onRevealState: (chain: number, step: number, ruled: Record<number, boolean>, by: string) => void;
  onChainScored: (chainIdx: number, ruled: Record<number, boolean>, missed: string[]) => void;
  vote: (correct: boolean, byHand?: boolean) => void;
  maybeAutoRule: () => void;
  // pigOff.ts
  setPigOffBoth: (p: PigOff | null) => void;
  startPigOff: (players: string[], attempt: number) => void;
  onPigOff: (attempt: number, players: string[], entry: number) => void;
  onPigOffDrawing: (name: string, strokes: string[]) => void;
  onPigOffResult: (matches: Record<string, number>, drawings: Record<string, string[]>, winner: string) => void;
  pigOffAllIn: () => boolean;
  maybePigOffDone: () => void;
  sendPigOffResult: () => void;
  pigOffNext: () => void;
  pigOffTimeUp: () => void;
  submitPigOff: (strokes: string[]) => void;
  devTieWith: ((name: string) => Promise<void>) | undefined;
  // channel.ts
  openChannel: (code: string, userId: string) => void;
  ensureChannel: () => void;
  // room.ts
  enterRoom: (roomCode: string | null, name: string, rejoin?: boolean) => Promise<EntryStatus>;
  resetLocal: () => void;
  leaveRoom: () => void;
  askToLeave: () => void;
  closeLocally: (message: string) => void;
};

export type Engine = ReturnType<typeof createRefs> & Setters & EngineFns;

// The refs and setters; the modules fill in the functions (GameProvider
// installs every one before anything can call them).
export function createEngine(setters: Setters, path: string, avatar: Avatar): Engine {
  return { ...createRefs(path, avatar), ...setters } as Engine;
}
