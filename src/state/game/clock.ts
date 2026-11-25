import { BACKUP_AFTER, BACKUP_STAGGER, HOST_GRACE, PIG_OFF, TIMERS, pigOffTime } from '../../lib/timers';
import { isGameOn, isTurnPhase, type Phase } from '../rules';
import type { Engine, EngineFns } from './engine';
import { turnKey } from './types';

// ---- The keeper's authoritative stage clock, and its backup ----
export function installClock(e: Engine) {
  const {
    isKeeperRef,
    actingRef,
    clockTimerRef,
    pigOffRef,
    phaseRef,
    stageStartedAtRef,
    deadlinesRef,
    dueRef,
    roomRef,
    subscribedRef,
    syncedRef,
    awakeRef,
    roundRef,
    stageRef,
    revealIndexRef,
    chainsRef,
    advancedForRef,
    setPhase,
    setStageStart,
    setTurnEndsAt,
  } = e;

  // What the keeper does to move the game on, a phone standing in for it can
  // do too (the clock's backup: watchClock sets `acting` while it does).
  const actsForClock = () => isKeeperRef.current || actingRef.current;

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
  // How long each stage lasts.
  const durationFor = (p: Phase) =>
    p === 'prompts'
      ? TIMERS.prompt
      : p === 'draw'
        ? TIMERS.draw
        : p === 'caption'
          ? TIMERS.caption
          : p === 'reveal'
            ? TIMERS.reveal
            : p === 'pigoff'
              ? pigOffRef.current?.matches
                ? PIG_OFF.results
                : pigOffTime(pigOffRef.current?.attempt ?? 1)
              : 0;

  const forceFor = (p: Phase) => {
    if (isTurnPhase(p)) return e.forceAdvance;
    if (p === 'reveal') return e.forceRevealChain;
    if (p === 'pigoff') return e.pigOffTimeUp;
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
    setStageStart(stageStartedAtRef.current);
    setEndsAt(stageStartedAtRef.current + durationFor(p) * 1000);
    armForCurrentStage(true);
    e.armJudgeWait();
  };

  // When the stage on screen runs out, on this phone's clock; noted against
  // this player's turn too, so one handed in long after can be told (isLate).
  const setEndsAt = (endsAt: number) => {
    setTurnEndsAt(endsAt);
    const t = e.currentTurn();
    if (t) deadlinesRef.current.set(turnKey(t), endsAt);
  };

  // ---- The clock's backup ----
  // Every caught-up phone on screen keeps an eye on the clock: when the game
  // is past due to move on (a stage's time is up; every prompt or turn is in,
  // or the round's last chain is scored) and it hasn't, the keeper has gone quiet: it froze before it could
  // hand over, lost its connection, or is a 2.9.0 phone in the background,
  // which never hands over. Then the phones in line (clockRank) do what the
  // keeper would have, BACKUP_AFTER seconds late, BACKUP_STAGGER apart, and
  // again if it still hasn't moved. The keeper watches too, first, in case a
  // message of its own went missing. Two phones moving the game on is
  // harmless: the second message is late, and ignored (../rules).
  //
  // What's next for the clock, and from when: a stage's deadline (plus the
  // grace for last-second turns), or, when it's ready now (`at` null), from
  // when this phone first saw it was.
  const clockJob = (): { key: string; at: number | null; act: () => void } | null => {
    const p = phaseRef.current;
    const id = `${p}:${roundRef.current}:${stageRef.current}:${revealIndexRef.current}:${stageStartedAtRef.current}`;
    const timeUp = stageStartedAtRef.current + (durationFor(p) + HOST_GRACE) * 1000;
    const job = (ready: boolean, act: () => void) =>
      ready ? { key: `${id}:ready`, at: null, act } : { key: id, at: timeUp, act };
    if (isTurnPhase(p)) return job(e.stageSettled(), e.forceAdvance);
    if (p === 'pigoff') return pigOffRef.current?.matches ? job(false, e.pigOffNext) : job(e.pigOffAllIn(), e.sendPigOffResult);
    if (p === 'reveal') {
      return revealIndexRef.current >= chainsRef.current.length ? job(true, e.finishRound) : job(false, e.forceRevealChain);
    }
    return null;
  };
  const watchClock = () => {
    if (!roomRef.current || !subscribedRef.current || !syncedRef.current || !awakeRef.current) return;
    if (!isGameOn(phaseRef.current)) return;
    const rank = e.clockRank();
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

  Object.assign(e, {
    actsForClock,
    clearClock,
    durationFor,
    armForCurrentStage,
    beginStage,
    setEndsAt,
    watchClock,
  } satisfies Partial<EngineFns>);
}
