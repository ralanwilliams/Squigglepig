import React, { createContext, useContext, useRef, useState } from 'react';
import { router } from 'expo-router';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, supabaseReady } from '../lib/supabase';
import { TIMERS, HOST_GRACE } from '../lib/timers';
import { saveSession, clearSession } from '../lib/session';
import { stopMusic, MUSIC_FADE_MS } from '../lib/sound';

// ---- Game model: the "telephone" chain (a Telestrations booklet) ----
//
// A Chain is an alternating list of cells. cells[0] is always a text prompt
// (drawn from the shared pool). Odd indices are drawings, even indices (>=2)
// are captions. Every stage advances every chain by exactly one cell, so all
// players are doing the SAME action each stage (all drawing, or all captioning).
export type Cell =
  | { kind: 'prompt'; text: string; author: string }
  | { kind: 'drawing'; data: string; author: string }
  | { kind: 'caption'; text: string; author: string };
export type Chain = { cells: Cell[] };

// What the local player must respond to this stage (the previous cell of their
// assigned chain): text to illustrate, or a drawing to caption.
export type Prev = { kind: 'prompt' | 'caption'; text: string } | { kind: 'drawing'; data: string };

type Player = { username: string; joinedAt: number };
export type ConnStatus = 'connecting' | 'connected' | 'error' | 'no-keys';
export type Phase = 'lobby' | 'prompts' | 'view' | 'draw' | 'caption' | 'reveal' | 'gameover';

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

type Game = {
  username: string;
  room: string;
  isHost: boolean;
  players: string[];
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
  enterRoom: (room: string, username: string) => void;
  leaveRoom: () => void;
  startGame: (target: number) => void;
  addPrompt: (text: string) => void;
  readyView: () => void;
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
 * Single Supabase Realtime channel per room. Drawings are compact vector JSON
 * (a few KB), so everything — prompts, drawings, captions, scores — flows over
 * Realtime broadcast and lives only in memory. Nothing is persisted server-side,
 * so ending a game (or leaving the room) is all the cleanup there is.
 *
 * HOST = the player who has been in the room longest (earliest joinedAt),
 * derived live from presence. The host runs the authoritative stage clock and
 * decides transitions. Every client also tallies chains/prompts/scores so a
 * mid-game host handover loses nothing.
 *
 * ROUND LEADER = a separate, game-level role that rotates every round. The
 * leader judges the reveal (awards points). It is independent of the host.
 */
export function GameProvider({ children }: { children: React.ReactNode }) {
  const [username, setUsername] = useState('');
  const [room, setRoom] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [players, setPlayers] = useState<string[]>([]);
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
  const playersRef = useRef<Player[]>([]);
  const usernameRef = useRef('');
  const isHostRef = useRef(false);
  const hostRef = useRef(''); // current host's name (for detecting handover)
  const joinedAtRef = useRef(0);

  const phaseRef = useRef<Phase>('lobby');
  const stageRef = useRef(0);
  const rosterRef = useRef<string[]>([]); // player order fixed for the current round
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

  const orderedNames = () =>
    [...playersRef.current]
      .sort((a, b) => a.joinedAt - b.joinedAt || a.username.localeCompare(b.username))
      .map((p) => p.username);

  const send = (event: string, payload: any = {}) =>
    channelRef.current?.send({ type: 'broadcast', event, payload });

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

  // ---- Chain assignment (pure, computed on every client) ----
  // At stage s, player at roster position `pos` handles chain (pos - s) mod N.
  // Over stages 1..N-1 this hands each chain to every player except (implicitly)
  // never lets anyone touch the same chain twice.
  const chainForStage = (pos: number, s: number, n: number) => ((pos - s) % n + n) % n;

  const routeForStage = (s: number) => {
    stageRef.current = s;
    setStage(s);
    const roster = rosterRef.current;
    const n = roster.length;
    // Stage 0 = Round 1 "view": read the prompt for the chain you own + judge.
    const p: Phase = s === 0 ? 'view' : s % 2 === 1 ? 'draw' : 'caption';
    const myPos = roster.indexOf(usernameRef.current);
    if (myPos < 0 || n === 0) {
      // Not part of this round's roster (e.g. joined mid-round) -> spectate.
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
    const cell = chainsRef.current[c]?.cells[s - 1];
    if (!cell) setPrev(null);
    else if (cell.kind === 'drawing') setPrev({ kind: 'drawing', data: cell.data });
    else setPrev({ kind: cell.kind, text: cell.text });
    router.replace(p === 'draw' ? '/drawing' : '/guessing');
    beginStage(p);
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
  // The roster is rebuilt from live presence at the start of every round, so any
  // player who has left the room is naturally dropped from the rotation (their
  // already-pooled prompts simply stay unused). If too few remain, end the game.
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

  const forceAdvance = () => {
    if (!isHostRef.current) return;
    const s = stageRef.current;
    // Fill any missing cells so the chains stay well-formed.
    chainsRef.current.forEach((ch) => {
      if (!ch.cells[s]) {
        ch.cells[s] =
          s % 2 === 1
            ? { kind: 'drawing', data: '', author: '' }
            : { kind: 'caption', text: '(no answer)', author: '' };
      }
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

  // Which roster position is responsible for chain c this stage (inverse of the
  // chainForStage assignment): pos = (c + s) mod n.
  const assignedPlayer = (c: number, s: number, n: number) => rosterRef.current[(c + s) % n];

  // Host: advance the stage as soon as every chain is settled — meaning it has a
  // cell, OR the player who owes it has left the room (we never block on someone
  // who is gone). Runs both when a cell lands and when presence changes.
  const maybeAdvanceStage = () => {
    if (!isHostRef.current) return;
    if (phaseRef.current !== 'draw' && phaseRef.current !== 'caption') return;
    const s = stageRef.current;
    const n = rosterRef.current.length;
    if (n === 0) return;
    const present = new Set(orderedNames());
    const filled = chainsRef.current.filter((ch) => ch.cells[s]).length;
    const settled = chainsRef.current.every(
      (ch, c) => ch.cells[s] || !present.has(assignedPlayer(c, s, n))
    );
    console.log('[game] stage', s, '—', filled, 'of', n, 'cells in, settled:', settled);
    if (settled) {
      clearHostTimer();
      forceAdvance(); // fills the absent players' chains with blanks, then advances
    }
  };

  // Whether the shared pool holds enough prompts to seed every chain of every
  // round without repeating (and there are enough players). Every device can
  // tell — it is the same broadcast pool — so every device can react the
  // moment it happens, ahead of the host's round broadcast.
  const poolFull = () => {
    if (phaseRef.current !== 'prompts') return false;
    const present = orderedNames();
    const needed = promptsNeededFor(present.length, targetRef.current);
    return present.length >= MIN_PLAYERS && allPromptsRef.current.length >= needed;
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

  // Host: leave Round 1 (view) once everyone still present has tapped through,
  // then kick off the first drawing stage.
  const maybeAdvanceView = () => {
    if (!isHostRef.current) return;
    if (phaseRef.current !== 'view') return;
    const present = new Set(orderedNames());
    const waiting = rosterRef.current.filter((nm) => present.has(nm));
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
    router.replace('/prompts');
    beginStage('prompts');
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
  };

  const onViewAck = (name: string) => {
    viewAcksRef.current.add(name);
    maybeAdvanceView();
  };

  const onRound = (round: number, roster: string[], seeds: { text: string; author: string }[], lead: string) => {
    clearStartDelay();
    roundRef.current = round;
    rosterRef.current = roster;
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
  };

  const onCell = (chain: number, s: number, cell: Cell) => {
    if (!chainsRef.current[chain]) return;
    chainsRef.current[chain].cells[s] = cell;
    setChains(chainsRef.current.map((c) => ({ cells: [...c.cells] })));
    if (s === stageRef.current) maybeAdvanceStage();
  };

  const onAdvance = (newStage: number, cells: Cell[]) => {
    cells.forEach((cell, i) => {
      if (chainsRef.current[i] && cell) chainsRef.current[i].cells[newStage - 1] = cell;
    });
    setChains(chainsRef.current.map((c) => ({ cells: [...c.cells] })));
    routeForStage(newStage);
  };

  const onToReveal = (rvChains: Chain[]) => {
    chainsRef.current = rvChains;
    setChains(rvChains);
    revealIndexRef.current = 0;
    setRevealIndex(0);
    revealStepRef.current = 1; // show prompt + first drawing; judge votes from cell 1
    setRevealStep(1);
    rulingsRef.current = {};
    talliedRef.current = {};
    setRulings({});
    router.replace('/reveal');
    beginStage('reveal');
  };

  // Judge = the chain's original prompt author, if still present; otherwise the
  // round leader / host takes over so a chain never stalls on someone who left.
  const judgeForChain = (chainIdx: number, names: string[]) => {
    const first = chainsRef.current[chainIdx]?.cells[0];
    const author = first && first.kind === 'prompt' ? first.author : '';
    if (author && names.includes(author)) return author;
    return effectiveLeader(names);
  };

  // Score rulings as they land: every drawing or guess the judge marked as
  // matching the ORIGINAL PROMPT earns that cell's author +1, the moment the
  // judge rules it. (So both correct guesses and the drawings that faithfully
  // carried the prompt score.) Each ruling is counted once — talliedRef
  // remembers which of the current chain's cells are already in the totals —
  // so the ✓ beat, the chain's final commit and the host's timeout fallback
  // all pass through here without double-counting.
  const tallyRulings = (chain: Chain, ruled: Record<number, boolean>) => {
    let changed = false;
    chain.cells.forEach((c, i) => {
      if (ruled[i] === undefined || talliedRef.current[i] !== undefined) return;
      talliedRef.current[i] = ruled[i];
      if (c && c.kind !== 'prompt' && ruled[i] && c.author) {
        changed = true;
        scoresRef.current[c.author] = (scoresRef.current[c.author] ?? 0) + 1;
      }
    });
    if (changed) setScores({ ...scoresRef.current });
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
  };

  const onChainScored = (chainIdx: number, ruled: Record<number, boolean>) => {
    // Idempotent per chain: only the first commit for the current chain counts,
    // so the judge's finish and the host's timeout fallback can't both advance.
    if (chainIdx !== revealIndexRef.current) return;
    if (chainsRef.current[chainIdx]) tallyRulings(chainsRef.current[chainIdx], ruled ?? {}); // anything not yet counted
    const next = revealIndexRef.current + 1;
    revealIndexRef.current = next;
    setRevealIndex(next);
    revealStepRef.current = 1; // next chain: show prompt + first drawing
    setRevealStep(1);
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
    }
  };

  const onGameOver = () => {
    clearHostTimer();
    router.replace('/scoreboard');
    beginStage('gameover');
  };

  // ---- Reconnect / late-join state sync ----
  const onRequestState = (who: string) => {
    if (!isHostRef.current) return;
    send('state', {
      to: who,
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
    });
  };

  const onState = (st: any) => {
    if (st.to !== usernameRef.current) return;
    const p: Phase = st.phase ?? 'lobby';
    targetRef.current = st.target ?? 5;
    setTarget(targetRef.current);
    leaderRef.current = st.leader ?? '';
    roundRef.current = st.round ?? 0;
    rosterRef.current = st.roster ?? [];
    chainsRef.current = st.chains ?? [];
    setChains(chainsRef.current);
    scoresRef.current = st.scores ?? {};
    setScores({ ...scoresRef.current });
    revealIndexRef.current = st.revealIndex ?? 0;
    setRevealIndex(revealIndexRef.current);
    revealStepRef.current = st.revealStep ?? 0;
    setRevealStep(revealStepRef.current);
    rulingsRef.current = st.rulings ?? {};
    talliedRef.current = { ...rulingsRef.current }; // already in st.scores
    setRulings(rulingsRef.current);
    setPromptCount(st.promptCount ?? 0);

    if (p === 'view' || p === 'draw' || p === 'caption') {
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
      router.replace('/lobby');
    }
  };

  // ---- Public actions ----
  const enterRoom = (roomCode: string, name: string) => {
    const code = roomCode.trim().toUpperCase();
    const user = name.trim();
    if (!code || !user) return;

    usernameRef.current = user;
    joinedAtRef.current = Date.now();
    roundRef.current = 0;
    phaseRef.current = 'lobby';
    setPhase('lobby');
    setUsername(user);
    setRoom(code);
    setStatus(supabaseReady ? 'connecting' : 'no-keys');
    setStatusDetail('');
    saveSession({ room: code, username: user });

    if (!supabaseReady) {
      router.push('/lobby');
      return;
    }

    const channel = supabase.channel(`room-${code}`, {
      config: { broadcast: { self: true }, presence: { key: user } },
    });

    channel
      .on('broadcast', { event: 'to-prompts' }, ({ payload }) => onToPrompts(payload.target))
      .on('broadcast', { event: 'prompt' }, ({ payload }) => onPrompt(payload.text, payload.author))
      .on('broadcast', { event: 'view-ack' }, ({ payload }) => onViewAck(payload.username))
      .on('broadcast', { event: 'round' }, ({ payload }) =>
        onRound(payload.round, payload.roster, payload.seeds, payload.leader)
      )
      .on('broadcast', { event: 'cell' }, ({ payload }) => onCell(payload.chain, payload.stage, payload.cell))
      .on('broadcast', { event: 'advance' }, ({ payload }) => onAdvance(payload.stage, payload.cells))
      .on('broadcast', { event: 'to-reveal' }, ({ payload }) => onToReveal(payload.chains))
      .on('broadcast', { event: 'reveal-state' }, ({ payload }) =>
        onRevealState(payload.chain, payload.step, payload.rulings)
      )
      .on('broadcast', { event: 'chain-scored' }, ({ payload }) =>
        onChainScored(payload.chain, payload.rulings)
      )
      .on('broadcast', { event: 'game-over' }, () => onGameOver())
      .on('broadcast', { event: 'request-state' }, ({ payload }) => onRequestState(payload.username))
      .on('broadcast', { event: 'state' }, ({ payload }) => onState(payload))
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState() as Record<string, any[]>;
        const list: Player[] = Object.values(state)
          .map((entries) => entries[0])
          .filter(Boolean)
          .map((m) => ({ username: m.username, joinedAt: m.joinedAt }));
        playersRef.current = list;
        setPlayers([...list].sort((a, b) => a.joinedAt - b.joinedAt).map((p) => p.username));

        const hostName = orderedNames()[0] ?? '';
        const iAmHostNow = hostName === usernameRef.current && hostName !== '';
        const becameHost = iAmHostNow && hostRef.current !== usernameRef.current;
        hostRef.current = hostName;
        isHostRef.current = iAmHostNow;
        setIsHost(iAmHostNow);
        if (becameHost && phaseRef.current !== 'lobby' && !hostTimerRef.current) {
          armForCurrentStage(false); // took over mid-round — resume the clock
        }
        // A player leaving may be exactly what unblocks the current stage (we no
        // longer wait on someone who is gone), so re-check completion now.
        maybePromptsComplete();
        maybeAdvanceView();
        maybeAdvanceStage();
        console.log('[realtime] players:', list.map((p) => p.username), '| host:', hostName);
      });

    channel.subscribe((s, err) => {
      console.log('[realtime] subscribe status:', s, err ? String(err) : '');
      if (s === 'SUBSCRIBED') {
        setStatus('connected');
        setStatusDetail('');
        channel.track({ username: user, joinedAt: joinedAtRef.current });
        channel.send({ type: 'broadcast', event: 'request-state', payload: { username: user } });
      } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') {
        setStatus('error');
        setStatusDetail(String(err ?? s));
      } else {
        setStatus('connecting');
      }
    });

    channelRef.current = channel;
    router.push('/lobby');
  };

  const leaveRoom = () => {
    clearHostTimer();
    clearStartDelay();
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    clearSession();
    channelRef.current?.unsubscribe();
    channelRef.current = null;
    playersRef.current = [];
    isHostRef.current = false;
    hostRef.current = '';
    phaseRef.current = 'lobby';
    chainsRef.current = [];
    scoresRef.current = {};
    allPromptsRef.current = [];
    poolRef.current = [];
    setPhase('lobby');
    setPlayers([]);
    setIsHost(false);
    setRoom('');
    setChains([]);
    setScores({});
    setPrev(null);
  };

  const startGame = (t: number) => {
    if (playersRef.current.length < MIN_PLAYERS) return;
    send('to-prompts', { target: Math.max(1, t) });
  };

  // Add one prompt to the shared pool (broadcast so the live count updates on
  // every device). Players keep adding until the pool is full and the game auto-starts.
  const addPrompt = (text: string) => {
    const clean = text.trim();
    if (clean) send('prompt', { text: clean, author: usernameRef.current });
  };

  // Round 1: tap through after reading the prompt of the chain you own.
  const readyView = () => {
    send('view-ack', { username: usernameRef.current });
    router.replace('/waiting');
  };

  const submitCell = (data: string) => {
    const c = myChainRef.current;
    if (c < 0) return;
    const s = stageRef.current;
    const cell: Cell =
      phaseRef.current === 'draw'
        ? { kind: 'drawing', data, author: usernameRef.current }
        : { kind: 'caption', text: data, author: usernameRef.current };
    send('cell', { chain: c, stage: s, cell });
    router.replace('/waiting');
  };

  // The round leader judges the reveal, but if they have left the room the role
  // falls to the host (the earliest joiner still present) so it never stalls.
  const effectiveLeader = (names: string[]) =>
    leaderRef.current && names.includes(leaderRef.current) ? leaderRef.current : (names[0] ?? '');

  const isJudgeNow = () =>
    usernameRef.current === judgeForChain(revealIndexRef.current, orderedNames());

  // Judge votes on the cell currently at the frontier (does it match the original
  // prompt?). Two-phase so everyone sees a ✓/✗ beat: first broadcast the ruling
  // (drives the animation), then after ~0.9s auto-advance to the next cell — or,
  // if that was the last cell, commit the chain's scores and move to the next
  // chain. Idempotent: re-voting the same cell is ignored.
  const vote = (correct: boolean) => {
    if (!isJudgeNow()) return;
    const chainIdx = revealIndexRef.current;
    const step = revealStepRef.current;
    const chain = chainsRef.current[chainIdx];
    if (!chain || rulingsRef.current[step] !== undefined) return;
    const rulings = { ...rulingsRef.current, [step]: correct };
    const last = chain.cells.length - 1;
    send('reveal-state', { chain: chainIdx, step, rulings }); // phase 1: the mark
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = setTimeout(() => {
      if (revealIndexRef.current !== chainIdx) return; // chain already moved on
      if (step >= last) send('chain-scored', { chain: chainIdx, rulings });
      else send('reveal-state', { chain: chainIdx, step: step + 1, rulings });
    }, 900);
  };

  const liveLeader = effectiveLeader(players);
  const currentJudge = (() => {
    const first = chains[revealIndex]?.cells[0];
    const author = first && first.kind === 'prompt' ? first.author : '';
    if (author && players.includes(author)) return author;
    return liveLeader;
  })();
  const promptsNeeded = promptsNeededFor(players.length, target);
  return (
    <GameCtx.Provider
      value={{
        username,
        room,
        isHost,
        players,
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
