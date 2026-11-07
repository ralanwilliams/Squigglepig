import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, BackHandler } from 'react-native';
import { router, usePathname } from 'expo-router';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, supabaseReady } from '../lib/supabase';
import { TIMERS, HOST_GRACE, promptsTime } from '../lib/timers';
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
  touchRoom,
  type Entry,
  type Member,
  type RoomPhase,
} from '../lib/rooms';
import { registerForPush } from '../lib/push';
import { CHUNK_GAP_MS, Joiner, chunkId, split } from '../lib/chunks';
import { holdsBack, isRoomScreen, lobbyOnCatchUp, navFor } from './nav';
import { stopMusic, MUSIC_FADE_MS } from '../lib/sound';
import { showToast } from '../components/Toast';
import { cleanAvatar, useMyAvatar, wireAvatar, type Avatar } from '../avatar/avatar';
import { NAME_MAX, ROOM_CODE_LENGTH, cleanName, cleanPhrase, cleanRoomCode, isRoomCode } from '../lib/text';
import {
  asCell,
  asCells,
  asChains,
  asIndex,
  asInt,
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
  activeMembers as activeOf,
  chainForStage,
  drawSeeds as drawSeedsFrom,
  promptKey,
  computeSkips as skipsFor,
  electHost as electHostOf,
  effectiveLeader as leaderOf,
  finalStage,
  isEmptyTurn,
  isGameOn,
  isTurnPhase,
  judgeFor,
  mergeCell,
  mergeChains,
  nextShown,
  phaseForStage,
  playerForChain,
  presentNames as presentOf,
  prevFor,
  promptsNeededFor,
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
  type Phase,
  type Position,
  type Presence,
  type Prev,
  type Prompt,
  type Verdict,
} from './rules';

// The game's rules live in ./rules (tested on their own); the screens take
// what they need of them from here, as they always have.
export { NAME_MAX, MAX_PLAYERS, MIN_PLAYERS, promptsNeededFor };
export { isBlankCell, isEmptyTurn } from './rules';
export type { Cell, Chain, Phase, Prev } from './rules';

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

const closedMessage = (code: string) => `Room ${code} closed after ${IDLE_MINUTES} minutes of inactivity.`;

type Game = {
  username: string;
  room: string;
  isHost: boolean;
  host: string;
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
  promptCount: number; // prompts in the shared pool so far
  promptsNeeded: number; // pool size that auto-starts the game
  // This player's turn this stage (null between turns, or watching), and when
  // its clock runs out (epoch ms, this phone's time).
  turn: Turn | null;
  turnEndsAt: number;
  // Actions
  enterRoom: (room: string | null, username: string, rejoin?: boolean) => Promise<EntryStatus>;
  // Back to the room's screen from elsewhere in the app (Home's Back to room).
  returnToRoom: () => void;
  leaveRoom: () => void;
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
 * over broadcast, and its presence says who has the app open right now.
 *
 * HOST = the player in the room longest who has the app open and is caught up
 * (`synced`), derived live from presence. The host runs the authoritative
 * stage clock, decides transitions, and saves a snapshot of the game to the
 * server at every step. Every client also tallies chains/prompts/scores so a
 * mid-game host handover loses nothing; if everyone closes the app, the first
 * one back picks the game up from the snapshot.
 *
 * Away players stay in the rotation: whatever they haven't handed in when the
 * clock runs out goes in empty. A player who taps Leave game mid-game while 3
 * or more others carry on is taken out of the rotation at once; if fewer would
 * be left, their turns run out the clock like an away player's, and at the
 * next round the game ends as it always has with fewer than MIN_PLAYERS.
 *
 * ROUND LEADER = a separate, game-level role that rotates every round. The
 * leader judges the reveal (awards points). It is independent of the host.
 */
export function GameProvider({ children }: { children: React.ReactNode }) {
  const [username, setUsername] = useState('');
  const [room, setRoom] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [host, setHost] = useState('');
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

  const channelRef = useRef<RealtimeChannel | null>(null);
  const subscribedRef = useRef(false);
  const roomRef = useRef('');
  const usernameRef = useRef('');
  const userIdRef = useRef('');
  const membersRef = useRef<Member[]>([]);
  const presenceRef = useRef<Presence[]>([]);
  const isHostRef = useRef(false);
  const hostRef = useRef(''); // current host's name (for detecting handover)
  // The server's phase for the room: 'playing' from Start until the game ends.
  const dbPhaseRef = useRef<RoomPhase>('lobby');
  // Whether this phone holds the game as it stands. False from (re)connecting
  // until the host sends the state, or until this phone, as host, restores it.
  const syncedRef = useRef(false);
  const restoringRef = useRef(false);
  // When this phone's copy of the game last changed (it rides in the
  // snapshot as savedAt), so a host that comes back can tell whether the
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
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoRuleRef = useRef(''); // the empty turn the judge's phone last marked by itself
  const advancedForRef = useRef(-1); // highest stage we've already emitted an advance for
  // The turns this player has handed in this round, by turnKey: each is sent
  // again if it doesn't come back from the channel (handIn), or if the host's
  // copy of the game turns up with it empty (mend).
  const handedRef = useRef(new Map<string, Handed>());
  // Turns this phone has sent again (or seen sent again) to mend the room's
  // copy of the game, by turnKey; a pending one waits its turn (mend).
  const mendRef = useRef(new Map<string, ReturnType<typeof setTimeout> | null>());

  // Prompt pool (all clients accumulate, for host-handover safety).
  const allPromptsRef = useRef<{ text: string; author: string }[]>([]);
  const poolRef = useRef<{ text: string; author: string }[]>([]);
  // Prompts already handed out this game (every phone notes each round's), so
  // a host taking over doesn't hand one out again (drawSeeds).
  const usedRef = useRef<Map<string, Prompt>>(new Map());
  // When this phone last started a game's prompts (a second start right
  // after is the same tap twice, from two phones: to-prompts).
  const promptsAtRef = useRef(0);
  const viewAcksRef = useRef<Set<string>>(new Set()); // who has tapped through Round 1
  // Whether this player is among them: Round 1 shows Player ready in place of
  // its button (app/view.tsx).
  const [viewReady, setViewReady] = useState(false);

  const hostTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Host: the pause between the prompt pool filling and the first round going
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
  // brings them to its screen wherever they are. During a game Back does
  // nothing (the hardware button here; the swipe is off on those screens in
  // app/_layout.tsx): the only way out is Leave game.
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
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () =>
      holdsBack(!!roomRef.current, phaseRef.current, pathRef.current)
    );
    return () => sub.remove();
  }, []);

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

  const track = () => {
    if (!subscribedRef.current) return;
    channelRef.current?.track({
      userId: userIdRef.current,
      username: usernameRef.current,
      synced: syncedRef.current,
      avatar: wireAvatar(myAvatarRef.current),
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

  // Whether the app is on screen. Off it (another app, a locked phone, a
  // hidden browser tab) the phone can't keep the game's clock, so it doesn't
  // host (pause, updateHost).
  const awakeRef = useRef(AppState.currentState !== 'background');

  // Catch up from the host: this phone may have missed something (it was off
  // screen or reconnected, or a message showed it was behind). Until the
  // host's answer comes (onState) it isn't caught up, so it can't host, and
  // the room elects someone who is. At most one ask every couple of seconds,
  // unless `now` (a fresh connection always asks).
  const lastResyncRef = useRef(0);
  const resync = (now = false) => {
    if (!roomRef.current || !subscribedRef.current) return; // connecting asks once it's in
    const t = Date.now();
    if (!now && t - lastResyncRef.current < 2000) return;
    lastResyncRef.current = t;
    syncedRef.current = false;
    track();
    send('request-state', { username: usernameRef.current });
    updateHost();
  };

  // Off screen mid-game: whatever its timers would do when the phone wakes
  // may be long out of date, so it stops hosting at once (saving the game
  // to the server first, for whoever picks it up), and tells the room it
  // isn't caught up, so the host passes to someone who's here. Back on
  // screen it catches up (resync). In the lobby and on the scoreboard
  // there's no clock to keep, and the host stays put.
  const pause = () => {
    if (!roomRef.current || !isGameOn(phaseRef.current)) return;
    if (snapTimerRef.current) {
      clearTimeout(snapTimerRef.current);
      snapTimerRef.current = null;
    }
    if (isHostRef.current && syncedRef.current) saveSnapshot(roomRef.current, buildState());
    clearHostTimer();
    clearStartDelay();
    isHostRef.current = false;
    hostRef.current = ''; // so hosting again later arms a fresh clock (updateHost)
    syncedRef.current = false;
    track();
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

  // ---- Host authoritative stage clock ----
  const clearHostTimer = () => {
    if (hostTimerRef.current) {
      clearTimeout(hostTimerRef.current);
      hostTimerRef.current = null;
    }
  };
  const startHostTimer = (seconds: number, fn: () => void) => {
    clearHostTimer();
    if (!isHostRef.current) return;
    hostTimerRef.current = setTimeout(fn, Math.max(1, seconds) * 1000);
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
    startHostTimer(remaining + HOST_GRACE, forceFor(p));
  };

  const beginStage = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
    stageStartedAtRef.current = Date.now();
    setTurnEndsAt(stageStartedAtRef.current + durationFor(p) * 1000);
    armForCurrentStage(true);
  };

  // ---- Snapshot (host) ----
  // Every change to the game, on every phone, marks the time; the host also
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
    stageStartedAt: stageStartedAtRef.current,
    savedAt: lastChangeRef.current,
  });

  const changed = () => {
    lastChangeRef.current = Date.now();
    if (!isHostRef.current || !syncedRef.current || snapTimerRef.current) return;
    snapTimerRef.current = setTimeout(() => {
      snapTimerRef.current = null;
      const p = phaseRef.current;
      if (isHostRef.current && roomRef.current && p !== 'lobby' && p !== 'gameover') {
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
    // A new turn: away players in the rotation get a notification (once
    // until they're back; the server keeps count).
    if (isHostRef.current && s > 0) nudge(roomRef.current, p === 'draw' ? 'draw' : 'guess', awayIds(roster));
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
    go(p === 'draw' ? '/drawing' : '/guessing');
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

  // The host's copy of the game (its next-stage message, the reveal's
  // chains, its answer to a phone catching up) has turn `t` empty, but this
  // phone has it with something in it: the turn never reached the host,
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
  // in leaves mendRef alone, so it can still be mended if the host turns
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

  // ---- Round lifecycle (host emits, everyone reacts) ----
  // The roster is rebuilt from the room's players at the start of every round
  // (away ones included), so anyone who has left the room is naturally dropped
  // from the rotation (their already-pooled prompts simply stay unused). If too
  // few remain, end the game.
  const startFirstRound = () => {
    if (!isHostRef.current) return;
    clearHostTimer();
    roundRef.current = 0;
    const roster = orderedNames();
    if (roster.length < MIN_PLAYERS) {
      send('game-over', { round: 0 });
      return;
    }
    send('round', { round: 0, roster, seeds: drawSeeds(roster.length), leader: roster[0] });
  };

  // The round number moves on when the 'round' message comes back (onRound),
  // on every phone alike, the host's included.
  const nextRound = () => {
    if (!isHostRef.current) return;
    const next = roundRef.current + 1;
    const roster = orderedNames();
    if (roster.length < MIN_PLAYERS) {
      send('game-over', { round: roundRef.current });
      return;
    }
    send('round', {
      round: next,
      roster,
      seeds: drawSeeds(roster.length),
      leader: roster[next % roster.length],
    });
  };

  // Who is responsible for chain c this stage (the inverse of chainForStage).
  const assignedPlayer = (c: number, s: number) => playerForChain(rosterRef.current, c, s);

  const forceAdvance = () => {
    if (!isHostRef.current) return;
    const s = stageRef.current;
    const n = rosterRef.current.length;
    // Fill any missing cells so the chains stay well-formed, under the name of
    // the player who owed each one: an empty drawing or guess, or a skipped
    // turn for someone out of the rotation.
    chainsRef.current.forEach((ch, c) => {
      if (ch.cells[s]) return;
      const who = n ? (assignedPlayer(c, s) ?? '') : '';
      const skip = skipRef.current.has(who) ? { skip: true as const } : {};
      ch.cells[s] =
        s % 2 === 1
          ? { kind: 'drawing', data: '', author: who, ...skip }
          : { kind: 'caption', text: '', author: who, ...skip };
    });
    doAdvance();
  };

  // Production runs stages 1..finalStage(n) (./rules).
  const doAdvance = () => {
    if (!isHostRef.current) return;
    const s = stageRef.current;
    if (advancedForRef.current >= s) return; // already advanced past this stage
    advancedForRef.current = s;
    const n = rosterRef.current.length;
    const round = roundRef.current;
    if (s >= finalStage(n)) {
      send('to-reveal', { round, chains: chainsRef.current });
    } else {
      send('advance', { round, stage: s + 1, cells: chainsRef.current.map((ch) => ch.cells[s]) });
    }
  };

  // Host: advance the stage as soon as every chain has its cell for it — or
  // its turn belongs to someone out of the rotation. Away players are waited
  // for until the clock runs out (forceAdvance). Runs both when a cell lands
  // and when the room's list changes.
  const maybeAdvanceStage = () => {
    if (!isHostRef.current) return;
    if (phaseRef.current !== 'draw' && phaseRef.current !== 'caption') return;
    const s = stageRef.current;
    const n = rosterRef.current.length;
    if (n === 0) return;
    const filled = chainsRef.current.filter((ch) => ch.cells[s]).length;
    const settled = chainsRef.current.every(
      (ch, c) => ch.cells[s] || skipRef.current.has(assignedPlayer(c, s) ?? '')
    );
    console.log('[game] stage', s, '—', filled, 'of', n, 'cells in, settled:', settled);
    if (settled) {
      clearHostTimer();
      forceAdvance(); // fills the skipped players' turns, then advances
    }
  };

  // Whether the shared pool holds enough prompts to seed every chain of every
  // round without repeating (and there are enough players). Every device can
  // tell — it is the same broadcast pool — so every device can react the
  // moment it happens, ahead of the host's round broadcast.
  const poolFull = () => {
    if (phaseRef.current !== 'prompts') return false;
    const count = orderedNames().length;
    const needed = promptsNeededFor(count, targetRef.current);
    return count >= MIN_PLAYERS && allPromptsRef.current.length >= needed;
  };

  // Host: start the game once the pool is full — after a short hold, long
  // enough for the theme to fade out on everyone's phone before the round
  // lands. The hold is re-checked when it fires in case the room changed.
  const maybePromptsComplete = () => {
    if (!isHostRef.current || startDelayRef.current) return;
    if (!poolFull()) return;
    startDelayRef.current = setTimeout(() => {
      startDelayRef.current = null;
      if (isHostRef.current && poolFull()) startFirstRound();
    }, MUSIC_FADE_MS);
  };

  // Host: leave Round 1 (view) once everyone in the rotation has tapped
  // through (away players run out its clock), then kick off the first
  // drawing stage.
  const maybeAdvanceView = () => {
    if (!isHostRef.current) return;
    if (phaseRef.current !== 'view') return;
    const waiting = rosterRef.current.filter((nm) => !skipRef.current.has(nm));
    if (waiting.length > 0 && waiting.every((nm) => viewAcksRef.current.has(nm))) {
      clearHostTimer();
      doAdvance();
    }
  };

  // ---- Broadcast handlers (fire on every client, including the sender) ----
  const onToPrompts = (t: number) => {
    targetRef.current = t;
    setTarget(t);
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
    if (!syncedRef.current) {
      syncedRef.current = true;
      track();
    }
    go('/prompts');
    beginStage('prompts');
    changed();
  };

  // One prompt added to the shared pool (every client accumulates, so the live
  // count is consistent and a host handover keeps the pool).
  const onPrompt = (text: string, author: string) => {
    const clean = (text ?? '').trim();
    if (!clean) return;
    allPromptsRef.current.push({ text: clean, author });
    setPromptCount(allPromptsRef.current.length);
    // The prompt that fills the pool is the cue for the music to go: it fades
    // during the host's hold, so the round arrives to silence. (Harmless if
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

  // The host's copy of the stage just played comes with the next one: a
  // turn it has empty that this phone has real is kept (mergeCell), and sent
  // again so the host and everyone else get it too (mend).
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

  // Every phone's copy of each turn, checked against the host's (onAdvance).
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
    go('/reveal');
    beginStage('reveal');
    maybeAutoRule();
    changed();
  };

  // Judge = the chain's original prompt author if they have the app open,
  // else the round leader / host (./rules judgeFor).
  const judgeForChain = (chainIdx: number, names: string[]) =>
    judgeFor(chainsRef.current[chainIdx], names, leaderRef.current);

  // Score rulings as they land (./rules tallyRulings), each cell once.
  const tallyRulings = (chain: Chain, ruled: Record<number, boolean>, final = false) => {
    if (tally(chain, ruled, talliedRef.current, scoresRef.current, final)) setScores({ ...scoresRef.current });
  };

  // Host-only fallback: if the judge stalls, commit whatever rulings exist and move on.
  const forceRevealChain = () => {
    if (!isHostRef.current) return;
    send('chain-scored', { round: roundRef.current, chain: revealIndexRef.current, rulings: rulingsRef.current });
  };

  // Judge stepped the reveal cursor or ruled a guess — mirror it to everyone.
  const onRevealState = (chain: number, step: number, ruled: Record<number, boolean>) => {
    if (chain !== revealIndexRef.current) return;
    revealStepRef.current = step;
    setRevealStep(step);
    rulingsRef.current = ruled ?? {};
    setRulings(ruled ?? {});
    if (chainsRef.current[chain]) tallyRulings(chainsRef.current[chain], ruled ?? {}); // the totals move with the ✓
    maybeAutoRule();
    changed();
  };

  const onChainScored = (chainIdx: number, ruled: Record<number, boolean>) => {
    // Idempotent per chain: only the first commit for the current chain counts,
    // so the judge's finish and the host's timeout fallback can't both advance.
    if (chainIdx !== revealIndexRef.current) return;
    if (chainsRef.current[chainIdx]) tallyRulings(chainsRef.current[chainIdx], ruled ?? {}, true); // anything not yet counted
    const next = revealIndexRef.current + 1;
    revealIndexRef.current = next;
    setRevealIndex(next);
    revealStepRef.current = nextShown(chainsRef.current[next], 0); // next chain: show prompt + first drawing
    setRevealStep(revealStepRef.current);
    rulingsRef.current = {};
    talliedRef.current = {};
    setRulings({});
    if (next >= chainsRef.current.length) {
      if (isHostRef.current) {
        const won = Object.values(scoresRef.current).some((v) => v >= targetRef.current);
        if (won) send('game-over', { round: roundRef.current });
        else nextRound();
      }
    } else {
      beginStage('reveal'); // re-arm the per-chain fallback clock for the next chain
      maybeAutoRule();
    }
    changed();
  };

  const onGameOver = () => {
    clearHostTimer();
    dbPhaseRef.current = 'lobby';
    // The room opens to newcomers again and the server forgets the game.
    if (isHostRef.current) endGameOnServer(roomRef.current);
    go('/scoreboard');
    beginStage('gameover');
  };

  // ---- Reconnect / late-join state sync ----
  // Only a host that is itself caught up answers.
  // `sentAt` is the host's clock as it sends, so the phone catching up can
  // tell how far into the stage the game is without the two clocks agreeing.
  const onRequestState = (who: string) => {
    if (!isHostRef.current || !syncedRef.current) return;
    send('state', { to: who, ...buildState(), sentAt: Date.now() });
  };

  // Take on the game as `st` describes it (the host's answer, or the
  // snapshot a returning host restores) and go to its screen.
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
    // host's copy has them empty, and sent again for everyone (mend).
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
    if (Array.isArray(st.prompts)) allPromptsRef.current = st.prompts;
    if (Array.isArray(st.pool)) poolRef.current = st.pool;
    // The prompts handed out so far (a host from before this was kept sends
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
    // (sentAt). A snapshot has none, and is read as if the clocks agree.
    if (typeof st.stageStartedAt === 'number' && st.stageStartedAt > 0) {
      const elapsed = st.sentAt ? Math.max(0, st.sentAt - st.stageStartedAt) : Date.now() - st.stageStartedAt;
      stageStartedAtRef.current = Date.now() - elapsed;
      if (!same) setTurnEndsAt(stageStartedAtRef.current + durationFor(p) * 1000);
      if (isHostRef.current) armForCurrentStage(false);
    }
    lastChangeRef.current = Math.max(lastChangeRef.current, Number(st.savedAt) || 0);
    computeSkips();
  };

  const markSynced = () => {
    syncedRef.current = true;
    track();
    updateHost();
  };

  // The host's answer to request-state (to one player), or a returning
  // host's restored game (to '*': everyone still catching up).
  const onState = (st: GameState) => {
    const forMe = st.to === usernameRef.current || (st.to === '*' && !syncedRef.current);
    if (!forMe) return;
    applyState(st);
    markSynced();
  };

  // This phone is the host but isn't caught up: nobody who is has the app
  // open. Pick the game up from the server's snapshot — or from this phone's
  // own memory, if that is newer (it was the host a moment ago) — and send it
  // to everyone. Waits a moment first, in case someone caught up appears.
  const restore = () => {
    if (restoringRef.current) return;
    restoringRef.current = true;
    const code = roomRef.current;
    setTimeout(async () => {
      if (code !== roomRef.current || syncedRef.current || !isHostRef.current) {
        restoringRef.current = false;
        return;
      }
      const res = await roomState(code, true);
      restoringRef.current = false;
      if (code !== roomRef.current || syncedRef.current) return;
      if (res.status === 'closed') return closeLocally(closedMessage(code));
      if (res.status !== 'ok') return; // offline: tried again on the next change in the room
      dbPhaseRef.current = res.phase;
      setMembers(res.members, false);
      if (!isHostRef.current) return;
      const local = phaseRef.current;
      const midGame = local !== 'lobby' && local !== 'gameover';
      if (res.phase !== 'playing') {
        // No game on (or it ended while this phone was away): the lobby, unless
        // this phone is already looking at the final scores.
        if (lobbyOnCatchUp(local, pathRef.current)) {
          clearHostTimer();
          phaseRef.current = 'lobby';
          setPhase('lobby');
          go('/lobby');
        }
        return markSynced();
      }
      const snap = res.snapshot;
      if (midGame && lastChangeRef.current >= (Number(snap?.savedAt) || 0)) {
        markSynced();
        armForCurrentStage(false);
      } else if (snap) {
        applyState(asState(snap));
        markSynced();
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
    }, 1200);
  };

  // Elect the host from who's here (./rules electHost).
  const electHost = () => electHostOf(membersRef.current, presenceRef.current);

  const updateHost = () => {
    const hostName = electHost();
    const me = usernameRef.current;
    // Never while off screen (pause): its presence says it isn't caught up,
    // so the rest of the room elects someone else.
    const iAmHostNow = hostName !== '' && hostName === me && (awakeRef.current || !isGameOn(phaseRef.current));
    const becameHost = iAmHostNow && hostRef.current !== me;
    hostRef.current = hostName;
    setHost(hostName);
    isHostRef.current = iAmHostNow;
    setIsHost(iAmHostNow);
    // A phone that hands the host over drops its clock, so it can arm a fresh
    // one if the role comes back to it.
    if (!iAmHostNow) clearHostTimer();
    if (iAmHostNow && !syncedRef.current) {
      restore();
      return;
    }
    if (becameHost && phaseRef.current !== 'lobby' && !hostTimerRef.current) {
      armForCurrentStage(false); // took over mid-round — resume the clock
    }
    // Someone leaving may be exactly what unblocks the current stage (a
    // skipped player is no longer waited for), so re-check completion now.
    maybePromptsComplete();
    maybeAdvanceView();
    maybeAdvanceStage();
    maybeAutoRule();
  };

  const setMembers = (list: Member[], elect = true) => {
    membersRef.current = [...list].sort((a, b) => a.joinedAt - b.joinedAt || a.name.localeCompare(b.name));
    setMembersState(membersRef.current);
    computeSkips();
    if (elect) updateHost();
  };

  // Fetch who's in the room again (the server says when it changes). If the
  // server has a game on and this phone doesn't, or the other way round,
  // this phone missed it starting or ending (it was off screen): catch up.
  const refreshMembers = async () => {
    const code = roomRef.current;
    if (!code) return;
    const res = await roomState(code);
    if (code !== roomRef.current) return;
    if (res.status === 'closed') return closeLocally(closedMessage(code));
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
    // Joining or creating a room already took the server out of every other
    // one, so a Leave game still waiting to be sent has nothing left to do
    // (and sent later, it would take the player out of this room if it's the
    // same one they've come back to).
    takePendingLeave();

    // Who's in the room, before the channel opens, so the first presence sync
    // can already tell who the host is.
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
    // cue to catch up from the host.
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
      onToPrompts(t);
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
        onRevealState(chain, step, asRulings(p.rulings));
      }
    });
    on('chain-scored', (p) => {
      const chain = asIndex(p.chain);
      if (chain === null) return;
      if (fits('chain-scored', verdictForChainScored(position(), chain, asRound(p.round)))) {
        onChainScored(chain, asRulings(p.rulings));
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
    on('room-closed', () => closeLocally(closedMessage(code)));
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
        }
        setAvatars((was) => ({ ...was, ...seen }));
        updateHost();
        console.log('[realtime] here:', presenceRef.current.map((p) => p.name), '| host:', hostRef.current);
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
        // catch up before hosting anything.
        resync(true);
        refreshMembers();
      } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') {
        subscribedRef.current = false;
        setStatus('error');
        setStatusDetail(String(err ?? s));
      } else {
        setStatus('connecting');
      }
    });

    // The lobby goes right over home (Create or Join go, and whatever Join
    // was opened over), so Back from it goes home, still in the room. A game
    // already on (coming back to it
    // after the app closed) shows the waiting screen until the host's answer
    // brings this phone to the game's own screen (applyState): not the lobby
    // first, and then the game.
    go(dbPhaseRef.current === 'playing' ? '/waiting' : '/lobby', true);
    // The first lobby is where the phone asks to send notifications.
    registerForPush(true);
  };

  // Forget the room on this phone (the server is told separately, or already knows).
  const resetLocal = () => {
    clearHostTimer();
    clearStartDelay();
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
    snapTimerRef.current = null;
    forgetTurns();
    outboxRef.current = [];
    clearSession();
    const channel = channelRef.current;
    channelRef.current = null;
    subscribedRef.current = false;
    if (channel) supabase.removeChannel(channel);
    roomRef.current = '';
    membersRef.current = [];
    presenceRef.current = [];
    isHostRef.current = false;
    hostRef.current = '';
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
    setIsHost(false);
    setHost('');
    setRoom('');
    setChains([]);
    setScores({});
    setPrev(null);
    setTurn(null);
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

  // The room closed under us (idle too long): back to the home screen, from
  // the room's screens (a player looking around elsewhere stays there).
  const closeLocally = (message: string) => {
    if (!roomRef.current) return;
    resetLocal();
    goHome();
    showToast(message, 4000);
  };

  // A Leave game the server never heard about is sent now.
  useEffect(() => {
    takePendingLeave().then((code) => {
      if (code) leaveRoomOnServer(code).then((ok) => !ok && savePendingLeave(code));
    });
    registerForPush(false); // keeps the server's copy of the token fresh
  }, []);

  // Off screen mid-game, the phone stops hosting (pause). Back in the app:
  // that counts as activity, the room may have closed (or changed)
  // meanwhile, the connection may need a nudge to come back, and the game
  // may have moved on without this phone, so it catches up (resync; if the
  // game started or ended meanwhile, refreshMembers notices).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') {
        awakeRef.current = false;
        pause();
        return;
      }
      if (s !== 'active') return;
      awakeRef.current = true;
      const code = roomRef.current;
      if (!code) return;
      if (!supabase.realtime.isConnected()) supabase.realtime.connect();
      touchRoom(code, true);
      if (isGameOn(phaseRef.current)) resync();
      refreshMembers();
    });
    return () => sub.remove();
  }, []);

  // In the lobby or on the scoreboard, a room with someone looking at it isn't
  // idle. (Mid-game only what people do counts: the host's clock carrying the
  // game on by itself doesn't keep it open.)
  useEffect(() => {
    if (!room || (phase !== 'lobby' && phase !== 'gameover')) return;
    const id = setInterval(() => {
      if (AppState.currentState === 'active') touchRoom(room);
    }, 2 * 60_000);
    return () => clearInterval(id);
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
      send('to-prompts', { target: Math.max(1, t) });
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
  // round is ready, the host starts the drawing and everyone goes straight to it.
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
  // where it mends the blank the host filled in (mergeCell), and the player
  // stays where the game has taken them. An empty one that late is nothing
  // to send. `closing`: handed in by a screen as it closes, which never
  // moves the player (the screen is going because they're already going
  // somewhere).
  const submitCell = (data: string, forTurn?: Turn | null, closing = false) => {
    const now = currentTurn();
    const t = forTurn ?? now;
    if (!t || t.chain < 0 || t.stage < 1 || !roomRef.current) return;
    const cell: Cell =
      phaseForStage(t.stage) === 'draw'
        ? { kind: 'drawing', data, author: usernameRef.current }
        : { kind: 'caption', text: cleanPhrase(data), author: usernameRef.current };
    const current = sameTurn(t, now);
    if (handedRef.current.has(turnKey(t)) || (!current && (isEmptyTurn(cell) || t.round !== roundRef.current))) return;
    handIn(t, cell);
    if (!isEmptyTurn(cell)) touchRoom(roomRef.current);
    if (current && !closing) go('/waiting');
  };

  // Let a guessing turn go without a guess (the clock ran out on an empty
  // box): the host fills it in empty. Only if it's still that turn.
  const passTurn = (forTurn?: Turn | null) => {
    const now = currentTurn();
    if (!forTurn || sameTurn(forTurn, now)) go('/waiting');
  };

  // The round leader judges the reveal, but if they don't have the app open
  // the role falls to the host (the earliest joiner here) so it never stalls.
  const effectiveLeader = (names: string[]) => leaderOf(leaderRef.current, names);

  const isJudgeNow = () =>
    usernameRef.current === judgeForChain(revealIndexRef.current, presentNames());

  // Judge votes on the cell currently at the frontier (does it match the original
  // prompt?). Two-phase so everyone sees a ✓/✗ beat: first broadcast the ruling
  // (drives the animation), then after ~0.9s auto-advance to the next cell — or,
  // if that was the last cell, commit the chain's scores and move to the next
  // chain. Idempotent: re-voting the same cell is ignored.
  const vote = (correct: boolean, byHand = true) => {
    if (!isJudgeNow()) return;
    const chainIdx = revealIndexRef.current;
    const step = revealStepRef.current;
    const chain = chainsRef.current[chainIdx];
    if (!chain || rulingsRef.current[step] !== undefined) return;
    const rulings = { ...rulingsRef.current, [step]: correct };
    const nextStep = nextShown(chain, step);
    const round = roundRef.current;
    send('reveal-state', { round, chain: chainIdx, step, rulings }); // phase 1: the mark
    if (byHand) touchRoom(roomRef.current);
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = setTimeout(() => {
      // Chain (or round) already moved on.
      if (revealIndexRef.current !== chainIdx || roundRef.current !== round || phaseRef.current !== 'reveal') return;
      if (nextStep >= chain.cells.length) send('chain-scored', { round, chain: chainIdx, rulings });
      else send('reveal-state', { round, chain: chainIdx, step: nextStep, rulings });
    }, 900);
  };

  // The judge's phone marks an empty turn ✗ by itself after a beat (there's
  // nothing to judge, and a blank drawing's −1 shows as it does), and commits a
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
      send('chain-scored', { round: roundRef.current, chain: ci, rulings: rulingsRef.current });
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

  const liveLeader = effectiveLeader(present);
  const currentJudge = (() => {
    const first = chains[revealIndex]?.cells[0];
    const author = first && first.kind === 'prompt' ? first.author : '';
    if (author && present.includes(author)) return author;
    return liveLeader;
  })();
  const promptsNeeded = promptsNeededFor(players.length, target);
  return (
    <GameCtx.Provider
      value={{
        username,
        room,
        isHost,
        host,
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
        promptCount,
        promptsNeeded,
        turn,
        turnEndsAt,
        enterRoom,
        returnToRoom,
        leaveRoom,
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
