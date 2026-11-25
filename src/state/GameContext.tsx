import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { usePathname } from 'expo-router';
import { leaveRoomOnServer, touchRoom, type Member } from '../lib/rooms';
import { registerForPush } from '../lib/push';
import { savePendingLeave, takePendingLeave } from '../lib/session';
import { useBackGuard } from '../lib/backGuard';
import { useMyAvatar, type Avatar } from '../avatar/avatar';
import { holdsBack, isRoomScreen } from './nav';
import { newGameBrush } from './brush';
import type { Chain, Phase, Prev, Rules } from './rules';
import type { PigOff } from './wire';
import { createEngine, type Engine } from './game/engine';
import { installNavigation } from './game/navigation';
import { installOutbox } from './game/outbox';
import { installPresence } from './game/presence';
import { installClock } from './game/clock';
import { installSync } from './game/sync';
import { installAppState } from './game/appState';
import { installTurns } from './game/turns';
import { installRounds } from './game/rounds';
import { installReveal } from './game/reveal';
import { installPigOff } from './game/pigOff';
import { installChannel } from './game/channel';
import { installRoom } from './game/room';
import { deriveView } from './game/view';
import type { ConnStatus, Game, Turn } from './game/types';

// The game's rules live in ./rules (tested on their own), and the live game
// in ./game (one file per concern); the screens take what they need of them
// from here, as they always have.
export { NAME_MAX } from '../lib/text';
export { MAX_PLAYERS, MIN_PLAYERS, isBlankCell, isEmptyTurn, nextShown, prevFor } from './rules';
export type { Cell, Chain, Phase, Prev, Rules } from './rules';
export type { PigOff } from './wire';
export { entryMessage } from './game/messages';
export type { ConnStatus, EntryStatus, Game, Turn } from './game/types';

const GameCtx = createContext<Game | null>(null);

export function useGame(): Game {
  const ctx = useContext(GameCtx);
  if (!ctx) throw new Error('useGame must be used inside <GameProvider>');
  return ctx;
}

/**
 * Two halves. The SERVER (src/lib/rooms.ts, supabase/rooms.sql) knows who is
 * in the room: a player stays in from create/join until they tap Leave game,
 * or the room closes after IDLE_MINUTES with nobody doing anything. Closing
 * the app only makes them "away". The LIVE CHANNEL (./game/channel.ts: one
 * Supabase Realtime channel per room, members only) carries the game: drawings
 * are compact vector JSON (a few KB), so prompts, drawings, captions and scores
 * all flow over broadcast, and its presence says who has the app on screen
 * right now: a phone that goes off screen leaves presence at once (goAway),
 * so the room never waits on a phone that's asleep.
 *
 * HOST = the player in the room longest, from the server's list (./rules
 * roomHost): it stays theirs while they're away, and passes on only when they
 * tap Leave game. It's the HOST badge and Start Game (anyone here can start
 * while the host is away).
 *
 * KEEPER = whichever phone keeps the game's clock (./game/clock.ts): the
 * longest in who's on screen and caught up (`synced`), derived live from
 * presence (./game/presence.ts), and nothing a player sees. It runs the
 * authoritative stage clock, decides transitions, and saves a snapshot of the
 * game to the server at every step. Every client also tallies
 * chains/prompts/scores so a handover loses nothing, and every caught-up phone
 * stands by in case the keeper goes quiet (the clock's backup: watchClock). If
 * everyone closes the app, the game is paused: the server tells them all so,
 * and the first one back picks the game up from the snapshot, as it was when
 * its clock stopped (`pausedAt`).
 *
 * A phone back on screen catches up (./game/sync.ts resync), asking until a
 * caught-up phone answers, or, with nobody there to, from the snapshot.
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
 * leader judges the reveal (awards points) when a chain's owner can't
 * (./game/reveal.ts). It is independent of the host.
 *
 * The provider itself only holds what the screens see (React state), and
 * hands the game's engine (./game/engine.ts) the app's comings and goings.
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
  const [round, setRound] = useState(0);
  const [roster, setRoster] = useState<string[]>([]);
  const [pigOff, setPigOff] = useState<PigOff | null>(null);
  const [stageStart, setStageStart] = useState(0);
  // This player's turn this stage, and when its clock runs out (this phone's
  // time), for the drawing and guessing screens.
  const [turn, setTurn] = useState<Turn | null>(null);
  const [turnEndsAt, setTurnEndsAt] = useState(0);
  const [judgeWait, setJudgeWait] = useState('');
  const [resuming, setResuming] = useState(false);
  const [rules, setRules] = useState<Rules>(1);
  const [dockedAt, setDockedAt] = useState<Record<string, string>>({});

  const myAvatar = useMyAvatar();
  const pathname = usePathname();

  // The live game, made once: the setters above never change.
  const engineRef = useRef<Engine | null>(null);
  if (!engineRef.current) {
    const e = createEngine(
      {
        setUsername,
        setRoom,
        setMembersState,
        setPresentIds,
        setGameNames,
        setAvatars,
        setStatus,
        setStatusDetail,
        setPhase,
        setStage,
        setPrev,
        setChains,
        setScores,
        setTarget,
        setRevealIndex,
        setRevealStep,
        setRulings,
        setRound,
        setRoster,
        setPigOff,
        setStageStart,
        setTurn,
        setTurnEndsAt,
        setJudgeWait,
        setResuming,
        setRules,
        setDockedAt,
      },
      pathname,
      myAvatar,
    );
    for (const install of [
      installNavigation,
      installOutbox,
      installPresence,
      installClock,
      installSync,
      installAppState,
      installTurns,
      installRounds,
      installReveal,
      installPigOff,
      installChannel,
      installRoom,
    ]) {
      install(e);
    }
    engineRef.current = e;
  }
  const e = engineRef.current;
  // This player's own pig, as their presence sends it.
  e.myAvatarRef.current = myAvatar;

  // Where the player is, for getting around (./game/navigation.ts), and the
  // room's screen as they left it, for Back to room.
  useEffect(() => {
    e.pathRef.current = pathname;
    if (isRoomScreen(pathname)) e.roomScreenRef.current = pathname;
  }, [pathname]);

  useBackGuard(holdsBack(!!room, phase, pathname), e.askToLeave);

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
        if (!e.awakeRef.current) return;
        e.awakeRef.current = false;
        e.goAway();
      } else if (s === 'active' && !e.awakeRef.current) {
        e.awakeRef.current = true;
        e.comeBack();
      }
    });
    return () => sub.remove();
  }, []);

  // The clock's backup (watchClock), once a second while in a room.
  useEffect(() => {
    if (!room) return;
    const id = setInterval(e.watchClock, 1000);
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
  // or its first round's prompts before anyone draws.
  useEffect(() => {
    if (phase === 'lobby' || (phase === 'prompts' && round === 0)) newGameBrush();
  }, [room, phase, round]);

  // A change to the pig (an outfit, a bubble, a theme part) while in a room
  // goes out at once.
  useEffect(() => {
    if (status === 'connected') e.track();
  }, [myAvatar]);

  // What the screens see.
  const view = deriveView({
    username,
    members,
    presentIds,
    status,
    gameNames,
    phase,
    stage,
    chains,
    revealIndex,
    judgeWait,
    roster: e.rosterRef.current,
    skip: e.skipRef.current,
    versions: e.versionsRef.current,
    leader: e.leaderRef.current,
  });
  return (
    <GameCtx.Provider
      value={{
        username,
        room,
        host: view.host,
        canStart: view.canStart,
        outdated: view.outdated,
        players: view.players,
        roster,
        away: view.away,
        departed: view.departed,
        avatars,
        status,
        statusDetail,
        phase,
        stage,
        prev,
        chains,
        scores,
        target,
        leader: view.leader,
        revealIndex,
        revealStep,
        rulings,
        judge: view.judge,
        isJudge: view.isJudge,
        judgeWait,
        rules,
        dockedAt,
        round,
        turn,
        turnEndsAt,
        stillWorking: view.stillWorking,
        resuming,
        enterRoom: e.enterRoom,
        returnToRoom: e.returnToRoom,
        askToLeave: e.askToLeave,
        startGame: e.startGame,
        submitCell: e.submitCell,
        passTurn: e.passTurn,
        vote: e.vote,
        pigOff,
        stageStart,
        submitPigOff: e.submitPigOff,
        devTieWith: e.devTieWith,
      }}
    >
      {children}
    </GameCtx.Provider>
  );
}
