import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { router } from 'expo-router';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, supabaseReady } from '../lib/supabase';
import { TIMERS, HOST_GRACE } from '../lib/timers';
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
import { isBlankDrawing } from '../lib/drawing';
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
  asRulings,
  asSeeds,
  asStage,
  asState,
  asTarget,
  type GameState,
} from './wire';

export { NAME_MAX };

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

export type ConnStatus = 'connecting' | 'connected' | 'error';
export type Phase = 'lobby' | 'prompts' | 'view' | 'draw' | 'caption' | 'reveal' | 'gameover';

// A blank drawing — an empty canvas handed in, or the clock running out —
// costs the player who owed it a point, whether they were here or away.
export const isBlankCell = (c: Cell | undefined) => !!c && c.kind === 'drawing' && !c.skip && isBlankDrawing(c.data);

// A turn with nothing in it: skipped, a blank drawing, or an empty guess. The
// reveal marks it ✗ by itself (there's nothing to judge), or passes over it if
// it was skipped, and the next player in the chain is handed the last turn
// before it that has something in it (prevFor).
export const isEmptyTurn = (c: Cell | undefined) =>
  !!c && c.kind !== 'prompt' && (!!c.skip || (c.kind === 'drawing' ? isBlankDrawing(c.data) : !(c.text ?? '').trim()));

const isSkipped = (c: Cell | undefined) => !!c && c.kind !== 'prompt' && !!c.skip;

// Prompts needed to seed every chain of every round without ever repeating one.
// Worst case is the "all players maxed, one winner" scenario: a player scores at
// most (N-1) per round, so ⌈target ÷ (N-1)⌉ rounds, each seeding N chains.
export const promptsNeededFor = (players: number, target: number) =>
  players >= 2 ? Math.ceil(target / (players - 1)) * players : Math.max(1, players);

// The telephone flow needs at least 3 players: with 2, the only person who could
// write a chain's final caption is whoever wrote its prompt, so there is nothing
// to actually guess.
export const MIN_PLAYERS = 3;

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
    case 'name_taken':
      return 'Someone in that room already has that name. Pick another.';
    case 'no_keys':
      return '⚠ Supabase keys not loaded — check .env, then: npx expo start -c';
    default:
      return 'Couldn’t reach the game server. Check your connection and try again.';
  }
}

const closedMessage = (code: string) => `Room ${code} closed after ${IDLE_MINUTES} minutes of inactivity.`;

// The live channel's view of a player: they have the app open right now.
// `synced` says their phone holds the game as it stands (it isn't still
// catching up after coming back), which is what makes them fit to host.
type Presence = { id: string; name: string; synced: boolean };

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
  // Actions
  enterRoom: (room: string | null, username: string, rejoin?: boolean) => Promise<EntryStatus>;
  leaveRoom: () => void;
  startGame: (target: number) => void;
  addPrompt: (text: string) => void;
  readyView: (byHand?: boolean) => void;
  submitCell: (data: string) => void;
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

  // Prompt pool (all clients accumulate, for host-handover safety).
  const allPromptsRef = useRef<{ text: string; author: string }[]>([]);
  const poolRef = useRef<{ text: string; author: string }[]>([]);
  const viewAcksRef = useRef<Set<string>>(new Set()); // who has tapped through Round 1

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

  // ---- Who's here ----
  // Everyone still in the room (not left), oldest first: the round roster.
  const activeMembers = () => membersRef.current.filter((m) => m.leftAt == null);
  const orderedNames = () => activeMembers().map((m) => m.name);
  // The ones with the app open right now.
  const presentNames = () => {
    const here = new Set(presenceRef.current.map((p) => p.id));
    return activeMembers()
      .filter((m) => here.has(m.id))
      .map((m) => m.name);
  };
  // User ids of players still in the room but away, optionally only those
  // named (this round's roster) — who gets a "your turn" notification.
  const awayIds = (names?: string[]) => {
    const here = new Set(presenceRef.current.map((p) => p.id));
    return activeMembers()
      .filter((m) => !here.has(m.id) && (!names || names.includes(m.name)))
      .map((m) => m.id);
  };

  const send = (event: string, payload: any = {}) =>
    channelRef.current?.send({ type: 'broadcast', event, payload });

  const track = () => {
    if (!subscribedRef.current) return;
    channelRef.current?.track({
      userId: userIdRef.current,
      username: usernameRef.current,
      synced: syncedRef.current,
      avatar: wireAvatar(myAvatarRef.current),
    });
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
  const durationFor = (p: Phase) =>
    p === 'prompts'
      ? TIMERS.prompts
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

  // ---- Chain assignment (pure, computed on every client) ----
  // At stage s, player at roster position `pos` handles chain (pos - s) mod N.
  // Over stages 1..N-1 this hands each chain to every player except (implicitly)
  // never lets anyone touch the same chain twice.
  const chainForStage = (pos: number, s: number, n: number) => ((pos - s) % n + n) % n;

  // What the player handed `chain` at stage s responds to: the cell before
  // theirs, or, when that turn came back empty, the last one before it that
  // has something in it, so a chain never dies on a blank. A drawing turn
  // always finds text (the prompt at worst); a guessing turn with no drawing
  // anywhere before it gets 'blank'.
  const prevFor = (chain: Chain | undefined, s: number): Prev | null => {
    if (!chain) return null;
    const wantDrawing = s % 2 === 0;
    for (let i = s - 1; i >= 0; i--) {
      const c = chain.cells[i];
      if (!c || isEmptyTurn(c)) continue;
      if (wantDrawing && c.kind === 'drawing') return { kind: 'drawing', data: c.data };
      if (!wantDrawing && c.kind !== 'drawing') return { kind: c.kind, text: c.text };
    }
    return wantDrawing ? { kind: 'blank' } : null;
  };

  const routeForStage = (s: number) => {
    stageRef.current = s;
    setStage(s);
    const roster = rosterRef.current;
    const n = roster.length;
    // Stage 0 = Round 1 "view": read the prompt for the chain you own + judge.
    const p: Phase = s === 0 ? 'view' : s % 2 === 1 ? 'draw' : 'caption';
    const myPos = roster.indexOf(usernameRef.current);
    // A new turn: away players in the rotation get a notification (once
    // until they're back; the server keeps count).
    if (isHostRef.current && s > 0) nudge(roomRef.current, p === 'draw' ? 'draw' : 'guess', awayIds(roster));
    if (myPos < 0 || n === 0) {
      // Not part of this round's roster -> watch.
      myChainRef.current = -1;
      setPrev(null);
      router.replace('/waiting');
      beginStage(p);
      return;
    }
    // chainForStage(pos, 0) === pos, so at the view stage you're handed the very
    // chain you own — the one you'll judge at the end.
    const c = chainForStage(myPos, s, n);
    myChainRef.current = c;
    if (s === 0) {
      const seed = chainsRef.current[c]?.cells[0];
      setPrev(seed && seed.kind !== 'drawing' ? { kind: seed.kind, text: seed.text } : null);
      router.replace('/view');
      beginStage('view');
      return;
    }
    setPrev(prevFor(chainsRef.current[c], s));
    router.replace(p === 'draw' ? '/drawing' : '/guessing');
    beginStage(p);
  };

  // Who is out of this round's rotation: roster players who tapped Leave game,
  // taken in the order they left, while 3 or more of the roster were still in
  // after them. Worked out from the server's list on every phone alike, so a
  // host handover agrees on it.
  const computeSkips = () => {
    const skip = new Set<string>();
    const p = phaseRef.current;
    if (p === 'view' || p === 'draw' || p === 'caption') {
      const roster = rosterRef.current;
      const leftAt = new Map(membersRef.current.filter((m) => m.leftAt != null).map((m) => [m.name, m.leftAt as number]));
      const gone = roster.filter((nm) => leftAt.has(nm)).sort((a, b) => leftAt.get(a)! - leftAt.get(b)!);
      let remaining = roster.length;
      for (const nm of gone) {
        remaining -= 1;
        if (remaining >= MIN_PLAYERS) skip.add(nm);
      }
    }
    skipRef.current = skip;
  };

  // ---- Prompt pool ----
  const drawSeeds = (n: number): { text: string; author: string }[] => {
    if (poolRef.current.length < n) {
      const source = allPromptsRef.current.length
        ? allPromptsRef.current
        : FALLBACK_PROMPTS.map((t) => ({ text: t, author: '' }));
      poolRef.current = shuffle(source);
    }
    const seeds: { text: string; author: string }[] = [];
    for (let i = 0; i < n; i++) {
      seeds.push(poolRef.current.shift() ?? { text: FALLBACK_PROMPTS[i % FALLBACK_PROMPTS.length], author: '' });
    }
    return seeds;
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
      send('game-over', {});
      return;
    }
    send('round', { round: 0, roster, seeds: drawSeeds(roster.length), leader: roster[0] });
  };

  const nextRound = () => {
    if (!isHostRef.current) return;
    roundRef.current += 1;
    const roster = orderedNames();
    if (roster.length < MIN_PLAYERS) {
      send('game-over', {});
      return;
    }
    send('round', {
      round: roundRef.current,
      roster,
      seeds: drawSeeds(roster.length),
      leader: roster[roundRef.current % roster.length],
    });
  };

  // Which roster position is responsible for chain c this stage (inverse of the
  // chainForStage assignment): pos = (c + s) mod n.
  const assignedPlayer = (c: number, s: number, n: number) => rosterRef.current[(c + s) % n];

  const forceAdvance = () => {
    if (!isHostRef.current) return;
    const s = stageRef.current;
    const n = rosterRef.current.length;
    // Fill any missing cells so the chains stay well-formed, under the name of
    // the player who owed each one: an empty drawing or guess, or a skipped
    // turn for someone out of the rotation.
    chainsRef.current.forEach((ch, c) => {
      if (ch.cells[s]) return;
      const who = n ? (assignedPlayer(c, s, n) ?? '') : '';
      const skip = skipRef.current.has(who) ? { skip: true as const } : {};
      ch.cells[s] =
        s % 2 === 1
          ? { kind: 'drawing', data: '', author: who, ...skip }
          : { kind: 'caption', text: '', author: who, ...skip };
    });
    doAdvance();
  };

  // Production runs stages 1..(n-1): each of the n-1 players who don't OWN a chain
  // adds exactly one cell to it, so by the end everyone has touched every chain
  // (the owner via the Round 1 view). Scoring judges every cell against the
  // original prompt, so it doesn't matter whether the last cell is a drawing.
  const finalStage = (n: number) => Math.max(1, n - 1);

  const doAdvance = () => {
    if (!isHostRef.current) return;
    const s = stageRef.current;
    if (advancedForRef.current >= s) return; // already advanced past this stage
    advancedForRef.current = s;
    const n = rosterRef.current.length;
    if (s >= finalStage(n)) {
      send('to-reveal', { chains: chainsRef.current });
    } else {
      send('advance', { stage: s + 1, cells: chainsRef.current.map((ch) => ch.cells[s]) });
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
      (ch, c) => ch.cells[s] || skipRef.current.has(assignedPlayer(c, s, n))
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
    setPromptCount(0);
    chainsRef.current = [];
    setChains([]);
    roundRef.current = 0;
    gameNamesRef.current = new Set();
    setGameNames([]);
    dbPhaseRef.current = 'playing';
    // A new game is the whole state: anyone who was still catching up is caught up.
    if (!syncedRef.current) {
      syncedRef.current = true;
      track();
    }
    router.replace('/prompts');
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
    maybeAdvanceView();
    changed();
  };

  const onRound = (round: number, roster: string[], seeds: { text: string; author: string }[], lead: string) => {
    clearStartDelay();
    roundRef.current = round;
    rosterRef.current = roster;
    addGameNames(roster);
    leaderRef.current = lead;
    advancedForRef.current = -1; // stages start at 0 (the Round 1 view) this round
    revealIndexRef.current = 0;
    setRevealIndex(0);
    viewAcksRef.current = new Set();
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

  const onCell = (chain: number, s: number, cell: Cell) => {
    if (!chainsRef.current[chain]) return;
    chainsRef.current[chain].cells[s] = cell;
    setChains(chainsRef.current.map((c) => ({ cells: [...c.cells] })));
    if (s === stageRef.current) maybeAdvanceStage();
    changed();
  };

  const onAdvance = (newStage: number, cells: Cell[]) => {
    cells.forEach((cell, i) => {
      if (chainsRef.current[i] && cell) chainsRef.current[i].cells[newStage - 1] = cell;
    });
    setChains(chainsRef.current.map((c) => ({ cells: [...c.cells] })));
    routeForStage(newStage);
    changed();
  };

  // The reveal shows a chain's cells from 1 on, passing over skipped turns.
  // The first one shown after `from`; past the end means nothing is left.
  const nextShown = (chain: Chain | undefined, from: number) => {
    let i = from + 1;
    while (chain && i < chain.cells.length && isSkipped(chain.cells[i])) i++;
    return i;
  };

  const onToReveal = (rvChains: Chain[]) => {
    chainsRef.current = rvChains;
    setChains(rvChains);
    revealIndexRef.current = 0;
    setRevealIndex(0);
    revealStepRef.current = nextShown(rvChains[0], 0); // show prompt + first drawing; judge votes from there
    setRevealStep(revealStepRef.current);
    rulingsRef.current = {};
    talliedRef.current = {};
    setRulings({});
    router.replace('/reveal');
    beginStage('reveal');
    maybeAutoRule();
    changed();
  };

  // Judge = the chain's original prompt author, if they have the app open;
  // otherwise the round leader / host takes over so a chain never stalls on
  // someone who isn't there.
  const judgeForChain = (chainIdx: number, names: string[]) => {
    const first = chainsRef.current[chainIdx]?.cells[0];
    const author = first && first.kind === 'prompt' ? first.author : '';
    if (author && names.includes(author)) return author;
    return effectiveLeader(names);
  };

  // Score rulings as they land: every drawing or guess the judge marked as
  // matching the ORIGINAL PROMPT earns that cell's author +1, the moment the
  // judge rules it. (So both correct guesses and the drawings that faithfully
  // carried the prompt score.) Every blank drawing costs its author 1, when
  // the reveal reaches it or, at the latest, when its chain is committed
  // (`final`). Each cell is counted once — talliedRef remembers which of the
  // current chain's cells are already in the totals — so the ✓ beat, the
  // chain's final commit and the host's timeout fallback all pass through
  // here without double-counting.
  const tallyRulings = (chain: Chain, ruled: Record<number, boolean>, final = false) => {
    let changedScores = false;
    chain.cells.forEach((c, i) => {
      if (!c || c.kind === 'prompt' || talliedRef.current[i] !== undefined) return;
      const blank = isBlankCell(c);
      if (ruled[i] === undefined && !(final && blank)) return;
      talliedRef.current[i] = ruled[i] ?? false;
      if (!c.author) return;
      if (blank) {
        scoresRef.current[c.author] = (scoresRef.current[c.author] ?? 0) - 1;
        changedScores = true;
      } else if (ruled[i] && !c.skip) {
        scoresRef.current[c.author] = (scoresRef.current[c.author] ?? 0) + 1;
        changedScores = true;
      }
    });
    if (changedScores) setScores({ ...scoresRef.current });
  };

  // Host-only fallback: if the judge stalls, commit whatever rulings exist and move on.
  const forceRevealChain = () => {
    if (!isHostRef.current) return;
    send('chain-scored', { chain: revealIndexRef.current, rulings: rulingsRef.current });
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
        if (won) send('game-over', {});
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
    router.replace('/scoreboard');
    beginStage('gameover');
  };

  // ---- Reconnect / late-join state sync ----
  // Only a host that is itself caught up answers.
  const onRequestState = (who: string) => {
    if (!isHostRef.current || !syncedRef.current) return;
    send('state', { to: who, ...buildState() });
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
    targetRef.current = st.target ?? 5;
    setTarget(targetRef.current);
    leaderRef.current = st.leader ?? '';
    roundRef.current = st.round ?? 0;
    rosterRef.current = st.roster ?? [];
    chainsRef.current = st.chains ?? [];
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
    viewAcksRef.current = new Set(Array.isArray(st.viewAcks) ? st.viewAcks : []);
    setPromptCount(st.promptCount ?? allPromptsRef.current.length);
    advancedForRef.current = (st.stage ?? 0) - 1;
    if (p !== 'lobby' && p !== 'gameover') dbPhaseRef.current = 'playing';

    if (same) {
      // Stay put (the clock is re-armed below).
    } else if (p === 'view' || p === 'draw' || p === 'caption') {
      routeForStage(st.stage ?? (p === 'view' ? 0 : 1));
    } else if (p === 'reveal') {
      router.replace('/reveal');
      beginStage('reveal');
    } else if (p === 'gameover') {
      router.replace('/scoreboard');
      beginStage('gameover');
    } else if (p === 'prompts') {
      router.replace('/prompts');
      beginStage('prompts');
    } else {
      phaseRef.current = 'lobby';
      setPhase('lobby');
      router.replace('/lobby');
    }
    // The clock carries on from where the stage started, not from now.
    if (typeof st.stageStartedAt === 'number' && st.stageStartedAt > 0) {
      stageStartedAtRef.current = st.stageStartedAt;
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
        if (midGame) {
          clearHostTimer();
          phaseRef.current = 'lobby';
          setPhase('lobby');
          router.replace('/lobby');
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
      send('state', { to: '*', ...buildState() });
      changed();
      maybePromptsComplete();
      maybeAdvanceView();
      maybeAdvanceStage();
      maybeAutoRule();
    }, 1200);
  };

  // Elect the host from who's here: the longest in among those caught up,
  // or, if nobody is, the longest in (who then restores the game).
  const electHost = () => {
    const here = new Map(presenceRef.current.map((p) => [p.id, p]));
    const present = activeMembers().filter((m) => here.has(m.id));
    const synced = present.filter((m) => here.get(m.id)!.synced);
    return (synced[0] ?? present[0])?.name ?? '';
  };

  const updateHost = () => {
    const hostName = electHost();
    const me = usernameRef.current;
    const iAmHostNow = hostName !== '' && hostName === me;
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

  // Fetch who's in the room again (the server says when it changes).
  const refreshMembers = async () => {
    const code = roomRef.current;
    if (!code) return;
    const res = await roomState(code);
    if (code !== roomRef.current) return;
    if (res.status === 'closed') return closeLocally(closedMessage(code));
    if (res.status !== 'ok') return;
    dbPhaseRef.current = res.phase;
    setMembers(res.members);
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
      if (router.canGoBack()) router.back();
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
    const on = (event: string, handle: (p: Record<string, unknown>) => void) =>
      channel.on('broadcast', { event }, ({ payload }) => {
        try {
          handle(asObj(payload));
        } catch (e) {
          console.warn(`[realtime] ignored a bad '${event}' message:`, e);
        }
      });
    on('to-prompts', (p) => {
      const t = asTarget(p.target);
      if (t !== null) onToPrompts(t);
    });
    on('prompt', (p) => {
      const prompt = asPrompt(p);
      if (prompt) onPrompt(prompt.text, prompt.author);
    });
    on('view-ack', (p) => {
      const who = cleanName(p.username);
      if (who) onViewAck(who);
    });
    on('round', (p) => {
      const round = asInt(p.round, 0, 100_000);
      const roster = asRoster(p.roster);
      const seeds = asSeeds(p.seeds);
      if (round !== null && roster && seeds) onRound(round, roster, seeds, cleanName(p.leader));
    });
    on('cell', (p) => {
      const chain = asIndex(p.chain);
      const stage = asStage(p.stage);
      const cell = asCell(p.cell);
      if (chain !== null && stage !== null && cell) onCell(chain, stage, cell);
    });
    on('advance', (p) => {
      const stage = asStage(p.stage);
      if (stage) onAdvance(stage, asCells(p.cells));
    });
    on('to-reveal', (p) => {
      const chains = asChains(p.chains);
      if (chains) onToReveal(chains);
    });
    on('reveal-state', (p) => {
      const chain = asIndex(p.chain);
      const step = asStage(p.step);
      if (chain !== null && step !== null) onRevealState(chain, step, asRulings(p.rulings));
    });
    on('chain-scored', (p) => {
      const chain = asIndex(p.chain);
      if (chain !== null) onChainScored(chain, asRulings(p.rulings));
    });
    on('game-over', () => onGameOver());
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
        syncedRef.current = false;
        track();
        channel.send({ type: 'broadcast', event: 'request-state', payload: { username: user } });
        refreshMembers();
      } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') {
        subscribedRef.current = false;
        setStatus('error');
        setStatusDetail(String(err ?? s));
      } else {
        setStatus('connecting');
      }
    });

    router.push('/lobby');
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
  };

  // Leave game: the only way out of a room, short of it closing.
  const leaveRoom = () => {
    const code = roomRef.current;
    if (code) {
      leaveRoomOnServer(code).then((ok) => {
        if (!ok) savePendingLeave(code); // offline: told the next time the app opens
      });
    }
    resetLocal();
  };

  // The room closed under us (idle too long): back to the home screen.
  const closeLocally = (message: string) => {
    if (!roomRef.current) return;
    resetLocal();
    router.replace('/');
    showToast(message, 4000);
  };

  // A Leave game the server never heard about is sent now.
  useEffect(() => {
    takePendingLeave().then((code) => {
      if (code) leaveRoomOnServer(code).then((ok) => !ok && savePendingLeave(code));
    });
    registerForPush(false); // keeps the server's copy of the token fresh
  }, []);

  // Back in the app: that counts as activity, the room may have closed (or
  // changed) meanwhile, and the connection may need a nudge to come back.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      const code = roomRef.current;
      if (s !== 'active' || !code) return;
      if (!supabase.realtime.isConnected()) supabase.realtime.connect();
      touchRoom(code, true);
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

  const startGame = async (t: number) => {
    const code = roomRef.current;
    if (!code || orderedNames().length < MIN_PLAYERS) return;
    // The server closes the room to newcomers first.
    if (!(await startGameOnServer(code))) {
      showToast('Couldn’t start the game. Check your connection and try again.', 3000);
      return;
    }
    dbPhaseRef.current = 'playing';
    send('to-prompts', { target: Math.max(1, t) });
    nudge(code, 'start', awayIds());
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
  const readyView = (byHand = true) => {
    send('view-ack', { username: usernameRef.current });
    if (byHand) touchRoom(roomRef.current);
    router.replace('/waiting');
  };

  const submitCell = (data: string) => {
    const c = myChainRef.current;
    if (c < 0) return;
    const s = stageRef.current;
    const cell: Cell =
      phaseRef.current === 'draw'
        ? { kind: 'drawing', data, author: usernameRef.current }
        : { kind: 'caption', text: cleanPhrase(data), author: usernameRef.current };
    send('cell', { chain: c, stage: s, cell });
    if (!isEmptyTurn(cell)) touchRoom(roomRef.current);
    router.replace('/waiting');
  };

  // The round leader judges the reveal, but if they don't have the app open
  // the role falls to the host (the earliest joiner here) so it never stalls.
  const effectiveLeader = (names: string[]) =>
    leaderRef.current && names.includes(leaderRef.current) ? leaderRef.current : (names[0] ?? '');

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
    send('reveal-state', { chain: chainIdx, step, rulings }); // phase 1: the mark
    if (byHand) touchRoom(roomRef.current);
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = setTimeout(() => {
      if (revealIndexRef.current !== chainIdx) return; // chain already moved on
      if (nextStep >= chain.cells.length) send('chain-scored', { chain: chainIdx, rulings });
      else send('reveal-state', { chain: chainIdx, step: nextStep, rulings });
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
      send('chain-scored', { chain: ci, rulings: rulingsRef.current });
      return;
    }
    if (rulingsRef.current[step] !== undefined || !isEmptyTurn(chain.cells[step])) return;
    autoRuleRef.current = key;
    setTimeout(() => {
      if (revealIndexRef.current === ci && revealStepRef.current === step) vote(false, false);
    }, 1200);
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
        enterRoom,
        leaveRoom,
        startGame,
        addPrompt,
        readyView,
        submitCell,
        vote,
      }}
    >
      {children}
    </GameCtx.Provider>
  );
}
