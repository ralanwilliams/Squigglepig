import { supabase } from '../../lib/supabase';
import { asClosedReason } from '../../lib/rooms';
import { Joiner } from '../../lib/chunks';
import { cleanAvatar, type Avatar } from '../../avatar/avatar';
import { cleanName } from '../../lib/text';
import { showToast } from '../../components/Toast';
import { PACK } from '../../arcade/games/memory/pack';
import {
  MIN_PLAYERS,
  ROUND_FLOW,
  asRules,
  verdictForAdvance,
  verdictForCell,
  verdictForChainScored,
  verdictForGameOver,
  verdictForPigOff,
  verdictForPigOffTurn,
  verdictForRevealStep,
  verdictForRound,
  verdictForToReveal,
  type Position,
  type Verdict,
} from '../rules';
import {
  asCell,
  asCells,
  asChains,
  asDrawings,
  asIndex,
  asInt,
  asMatches,
  asNames,
  asObj,
  asPackIndex,
  asRoster,
  asRound,
  asRulings,
  asStage,
  asState,
  asStrokes,
  asTarget,
} from '../wire';
import { REOPEN_MS } from './constants';
import type { Engine, EngineFns } from './engine';
import { closedMessage } from './messages';

// Dev builds only: messages between the test tools (src/dev) on the room's
// phones, e.g. the host telling every autopilot phone which scenario it's
// playing. They ride the room's channel as 'dev'; a release build neither
// sends nor listens for them.
type DevListener = (payload: Record<string, unknown>) => void;
const devListeners = new Set<DevListener>();
export const listenForDev = (listener: DevListener) => {
  devListeners.add(listener);
  return () => {
    devListeners.delete(listener);
  };
};
const DEV = typeof __DEV__ !== 'undefined' && __DEV__;

/**
 * The room's LIVE CHANNEL: one Supabase Realtime channel per room, members
 * only. It carries the game (drawings are compact vector JSON, a few KB, so
 * prompts, drawings, captions and scores all flow over broadcast), and its
 * presence says who has the app on screen right now.
 */
export function installChannel(e: Engine) {
  const {
    channelRef,
    subscribedRef,
    reopenTimerRef,
    roomRef,
    userIdRef,
    awakeRef,
    phaseRef,
    roundRef,
    stageRef,
    revealIndexRef,
    revealStepRef,
    chainsRef,
    promptsAtRef,
    presenceRef,
    versionsRef,
    keeperRef,
    setPresentIds,
    setReadyIds,
    setAvatars,
    setStatus,
    setStatusDetail,
  } = e;

  // Where this phone's game is, to hold each game message up against (../rules).
  const position = (): Position => ({
    phase: phaseRef.current,
    round: roundRef.current,
    stage: stageRef.current,
    revealIndex: revealIndexRef.current,
    revealStep: revealStepRef.current,
    chains: chainsRef.current.length,
  });

  // Open room `code`'s channel, hear everything on it, and join it.
  const openChannel = (code: string, userId: string) => {
    const channel = supabase.channel(`room:${code}`, {
      config: { private: true, broadcast: { self: true }, presence: { key: userId } },
    });

    // Any member can send anything (a changed app isn't held to this one's
    // rules), so every message is read through ../wire, and a handler that
    // still throws is caught: a malformed message is ignored, never a crash.
    // A message that came in pieces (src/lib/chunks.ts) is put back together
    // and handed to the same handler as if it had come whole.
    const handlers = new Map<string, (p: Record<string, unknown>) => void>();
    const deliver = (event: string, payload: unknown) => {
      const handle = handlers.get(event);
      if (!handle) return;
      try {
        handle(asObj(payload));
      } catch (err) {
        console.warn(`[realtime] ignored a bad '${event}' message:`, err);
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
    // (../rules, "Messages that come late"): applied, ignored as late, or the
    // cue to catch up.
    const fits = (event: string, verdict: Verdict) => {
      if (verdict === 'apply') return true;
      console.log(`[realtime] '${event}':`, verdict === 'stale' ? 'late, ignored' : 'missed something, catching up');
      if (verdict === 'resync') e.resync();
      return false;
    };
    on('to-prompts', (p) => {
      const t = asTarget(p.target);
      if (t === null) return;
      // Started on an app that plays the old way (a shared trough, a Round 1
      // view): this one can't play that game. It says so and stays where it is.
      if ((asInt(p.v, 1, 1000) ?? 1) < ROUND_FLOW) {
        showToast('This game was started on an older version of Squigglepig. Everyone needs the latest version to play together.', 6000);
        return;
      }
      // Two players tapping New game together send two: the second, a moment
      // after the first, would throw away the prompts everyone has started on.
      if (phaseRef.current === 'prompts' && roundRef.current === 0 && Date.now() - promptsAtRef.current < 10_000) return;
      const roster = asRoster(p.roster) ?? e.orderedNames();
      if (roster.length < MIN_PLAYERS) return;
      promptsAtRef.current = Date.now();
      // The game's scoring rules: whoever started it says.
      e.onToPrompts(t, asRules(asInt(p.rules, 1, 1000)), roster);
    });
    on('round', (p) => {
      const round = asInt(p.round, 0, 100_000);
      const roster = asRoster(p.roster);
      if (round === null || !roster) return;
      if (fits('round', verdictForRound(position(), round))) e.onRound(round, roster, cleanName(p.leader));
    });
    on('cell', (p) => {
      const chain = asIndex(p.chain);
      const stage = asStage(p.stage);
      const cell = asCell(p.cell);
      if (chain === null || stage === null || !cell) return;
      if (fits('cell', verdictForCell(position(), chain, stage, asRound(p.round)))) e.onCell(chain, stage, cell);
    });
    on('advance', (p) => {
      const stage = asStage(p.stage);
      if (!stage) return;
      if (fits('advance', verdictForAdvance(position(), stage, asRound(p.round)))) e.onAdvance(stage, asCells(p.cells));
    });
    on('to-reveal', (p) => {
      const chains = asChains(p.chains);
      if (chains && fits('to-reveal', verdictForToReveal(position(), asRound(p.round)))) e.onToReveal(chains);
    });
    on('reveal-state', (p) => {
      const chain = asIndex(p.chain);
      const step = asStage(p.step);
      if (chain === null || step === null) return;
      if (fits('reveal-state', verdictForRevealStep(position(), chain, step, asRound(p.round)))) {
        e.onRevealState(chain, step, asRulings(p.rulings), cleanName(p.by));
      }
    });
    on('chain-scored', (p) => {
      const chain = asIndex(p.chain);
      if (chain === null) return;
      if (fits('chain-scored', verdictForChainScored(position(), chain, asRound(p.round)))) {
        e.onChainScored(chain, asRulings(p.rulings), asNames(p.missed));
      }
    });
    on('pigoff', (p) => {
      const attempt = asInt(p.attempt, 1, 100);
      const players = asNames(p.players);
      const entry = asPackIndex(p.entry);
      if (attempt === null || entry === null || players.length < 2 || !PACK[entry]) return;
      if (fits('pigoff', verdictForPigOff(position(), attempt, asRound(p.round)))) e.onPigOff(attempt, players, entry);
    });
    on('pigoff-drawing', (p) => {
      const attempt = asInt(p.attempt, 1, 100);
      const name = cleanName(p.name);
      if (attempt === null || !name) return;
      if (fits('pigoff-drawing', verdictForPigOffTurn(position(), attempt, asRound(p.round)))) e.onPigOffDrawing(name, asStrokes(p.strokes));
    });
    on('pigoff-result', (p) => {
      const attempt = asInt(p.attempt, 1, 100);
      if (attempt === null) return;
      if (fits('pigoff-result', verdictForPigOffTurn(position(), attempt, asRound(p.round)))) {
        e.onPigOffResult(asMatches(p.matches), asDrawings(p.drawings), cleanName(p.winner));
      }
    });
    on('game-over', (p) => {
      if (fits('game-over', verdictForGameOver(position(), asRound(p.round)))) e.onGameOver();
    });
    on('request-state', (p) => {
      const who = cleanName(p.username);
      if (who) e.onRequestState(who);
    });
    on('state', (p) => e.onState(asState(p)));
    if (DEV) on('dev', (p) => devListeners.forEach((listener) => listener(p)));
    // From the server: the room's list changed, or the room closed.
    on('members', () => e.refreshMembers());
    on('room-closed', (p) => e.closeLocally(closedMessage(code, asClosedReason(p.reason))));
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
        setReadyIds(presenceRef.current.filter((p) => p.synced).map((p) => p.id));
        const seen: Record<string, Avatar> = {};
        for (const m of latest) {
          const who = cleanName(m.username);
          if (who) seen[who] = cleanAvatar(m.avatar);
          // Which scoring rules this phone knows (../rules gameRules), kept
          // after it goes away: a game started without it still counts it.
          // (2.9.0 says nothing: the first.)
          versionsRef.current.set(String(m.userId), asInt(m.v, 1, 1000) ?? 1);
        }
        setAvatars((was) => ({ ...was, ...seen }));
        e.updateKeeper();
        console.log('[realtime] here:', presenceRef.current.map((p) => p.name), '| clock:', keeperRef.current);
      } catch (err) {
        console.warn('[realtime] ignored a bad presence update:', err);
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
        e.resync(true);
        e.refreshMembers();
      } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') {
        subscribedRef.current = false;
        setStatus('error');
        setStatusDetail(String(err ?? s));
        // Cut off from the room: nobody can hear this phone's clock, and the
        // game will have moved on without it by the time it's back. It stands
        // down until it's back in and caught up (SUBSCRIBED).
        e.standDown();
        // A dropped connection rejoins by itself; a channel the server closed never does.
        if (s === 'CLOSED') ensureChannel();
      } else {
        setStatus('connecting');
      }
    });
  };

  // The room's channel, if it has closed for good, opened again. A dropped
  // connection rejoins by itself, but a channel the server has closed is gone:
  // most often because the sign-in token ran out while the app was off screen,
  // where it isn't refreshed (src/lib/supabase.ts; a hidden browser tab is the
  // same). Without this, a phone back on screen would stay cut off from the
  // room, on whatever screen it last had, while the others played on. Only on
  // screen (comeBack calls it on the way back), where the token can be
  // refreshed: setAuth asks for a fresh one first. Once back in, SUBSCRIBED
  // catches the phone up.
  const ensureChannel = () => {
    if (!roomRef.current || !awakeRef.current || reopenTimerRef.current) return;
    if (channelRef.current && channelRef.current.state !== 'closed') return;
    reopenTimerRef.current = setTimeout(async () => {
      reopenTimerRef.current = null;
      const code = roomRef.current;
      const userId = userIdRef.current;
      const old = channelRef.current;
      if (!code || !awakeRef.current || (old && old.state !== 'closed')) return;
      console.log("[realtime] the room's channel closed: opening it again");
      channelRef.current = null; // its CLOSED, as it goes, is no longer this phone's
      subscribedRef.current = false;
      if (old) void supabase.removeChannel(old);
      await supabase.realtime.setAuth();
      if (roomRef.current !== code || channelRef.current) return;
      openChannel(code, userId);
    }, REOPEN_MS);
  };

  Object.assign(e, { openChannel, ensureChannel } satisfies Partial<EngineFns>);
}
