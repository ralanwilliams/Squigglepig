import { JUDGE_WAIT } from '../../lib/timers';
import { nudge, touchRoom } from '../../lib/rooms';
import { showToast } from '../../components/Toast';
import {
  chainOwner,
  dock,
  finalStage,
  isEmptyTurn,
  judgeFor,
  judgingMissed,
  mergeChains,
  nextShown,
  tallyRulings as tally,
  type Chain,
  type Docks,
} from '../rules';
import { AUTO_RULE_MS } from './constants';
import type { Engine, EngineFns } from './engine';

// ---- The reveal: each chain shown, and judged by its owner ----
export function installReveal(e: Engine) {
  const {
    phaseRef,
    stageStartedAtRef,
    chainsRef,
    revealIndexRef,
    revealStepRef,
    rulingsRef,
    talliedRef,
    rulesRef,
    dockedRef,
    dockedAtRef,
    stoodInRef,
    scoresRef,
    leaderRef,
    usernameRef,
    roundRef,
    roomRef,
    rosterRef,
    syncedRef,
    judgeTimerRef,
    advanceTimerRef,
    autoRuleRef,
    setJudgeWait,
    setChains,
    setRevealIndex,
    setRevealStep,
    setRulings,
    setScores,
    setDockedAt,
  } = e;

  // ---- Waiting for a judge ----
  // A chain's owner judges it, but if they're away when it comes up, the
  // reveal waits JUDGE_WAIT for them (they're notified: nudgeJudge) before
  // the round leader, or the first one here, judges it in their place
  // (../rules judgeFor). `judgeWait` says who it's waiting for, on screen.
  const waitingForJudge = () =>
    phaseRef.current === 'reveal' && Date.now() - stageStartedAtRef.current < JUDGE_WAIT * 1000;
  const waitFor = () => (waitingForJudge() ? e.orderedNames() : []);
  const updateJudgeWait = () => {
    const owner = chainOwner(chainsRef.current[revealIndexRef.current]);
    // Back on screen but still catching up counts as not back yet: they can't judge until they are (isJudgeNow).
    const waiting = !!owner && waitingForJudge() && !e.readyNames().includes(owner) && e.orderedNames().includes(owner);
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
    const rank = e.clockRank();
    if (rank < 0 || rank > 1) return;
    const owner = chainOwner(chainsRef.current[revealIndexRef.current]);
    if (owner) nudge(roomRef.current, 'judge', e.awayIds([owner]));
  };

  // This round's points lost under the per-round rule, cleared each round.
  const forgetDocks = () => {
    dockedRef.current = new Set();
    dockedAtRef.current = {};
    setDockedAt({});
    stoodInRef.current = false;
  };

  const onToReveal = (incoming: Chain[]) => {
    e.mendAll(incoming, finalStage(rosterRef.current.length));
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
    e.go('/reveal');
    e.beginStage('reveal');
    nudgeJudge();
    maybeAutoRule();
    e.changed();
  };

  // Judge = the chain's owner if they have the app open; while the reveal
  // waits for one who's away, nobody; else the round leader or the first one
  // here (../rules judgeFor).
  const judgeForChain = (chainIdx: number, names: string[]) =>
    judgeFor(chainsRef.current[chainIdx], names, leaderRef.current, waitFor());

  // Score rulings as they land (../rules tallyRulings), each cell once; under
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
  // committing (../rules judgingMissed): every phone docks whoever it says.
  const missedJudging = (timedOut: boolean) => {
    if (rulesRef.current < 2) return [];
    const owner = chainOwner(chainsRef.current[revealIndexRef.current]);
    return judgingMissed(owner, usernameRef.current, stoodInRef.current, timedOut, e.orderedNames().includes(owner));
  };

  // Keeper's fallback: if the judge stalls, commit whatever rulings exist and move on.
  const forceRevealChain = () => {
    if (!e.actsForClock()) return;
    e.send('chain-scored', {
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
    e.changed();
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
      e.finishRound();
    } else {
      e.beginStage('reveal'); // re-arm the per-chain fallback clock for the next chain
      nudgeJudge();
      maybeAutoRule();
    }
    e.changed();
  };

  // Not until this phone has caught up: what it would rule on may be out of
  // date. Every phone picks the judge from who's here and caught up as
  // presence says (readyNames), so they all agree on one, and one just back
  // on screen takes the judging over only once it can use it.
  const isJudgeNow = () =>
    syncedRef.current && usernameRef.current === judgeForChain(revealIndexRef.current, e.readyNames());

  // Still at this turn of this chain of this round's reveal.
  const stillAt = (round: number, chainIdx: number, step: number) =>
    phaseRef.current === 'reveal' &&
    roundRef.current === round &&
    revealIndexRef.current === chainIdx &&
    revealStepRef.current === step;

  // Move the reveal on from a ruled turn: to the next turn shown, or, after
  // the chain's last, commit the chain's scores.
  const stepOn = (round: number, chainIdx: number, step: number, rulings: Record<number, boolean>) => {
    const chain = chainsRef.current[chainIdx];
    if (!chain) return;
    const nextStep = nextShown(chain, step);
    const by = usernameRef.current;
    if (nextStep >= chain.cells.length) {
      e.send('chain-scored', { round, chain: chainIdx, rulings, by, missed: missedJudging(false) });
    } else {
      e.send('reveal-state', { round, chain: chainIdx, step: nextStep, rulings, by });
    }
  };

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
    const round = roundRef.current;
    e.send('reveal-state', { round, chain: chainIdx, step, rulings, by: usernameRef.current }); // phase 1: the mark
    if (byHand) touchRoom(roomRef.current);
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = setTimeout(() => {
      advanceTimerRef.current = null;
      // The reveal already moved on; or this phone went off screen (or
      // started catching up) since the mark, so what it has may be out of
      // date: whoever judges now moves it on instead (maybeAutoRule).
      if (!stillAt(round, chainIdx, step) || !syncedRef.current) return;
      stepOn(round, chainIdx, step, rulings);
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
      e.send('chain-scored', {
        round: roundRef.current,
        chain: ci,
        rulings: rulingsRef.current,
        by: usernameRef.current,
        missed: missedJudging(false),
      });
      return;
    }
    const round = roundRef.current;
    if (rulingsRef.current[step] !== undefined) {
      // Ruled but not moved on: the judge's phone does that a moment after its
      // mark (vote), unless it went off screen, or handed the judging over,
      // first. Then the one judging now does it, after a longer beat.
      const on = `${key}:on`;
      if (autoRuleRef.current === on) return;
      autoRuleRef.current = on;
      setTimeout(() => {
        if (!stillAt(round, ci, step) || rulingsRef.current[step] === undefined) return;
        if (isJudgeNow()) stepOn(round, ci, step, rulingsRef.current);
        else autoRuleRef.current = ''; // not this phone's after all: free to try again
      }, AUTO_RULE_MS);
      return;
    }
    if (!isEmptyTurn(chain.cells[step])) return;
    autoRuleRef.current = key;
    setTimeout(() => {
      if (roundRef.current !== round || revealIndexRef.current !== ci || revealStepRef.current !== step) return;
      // Still empty: it wasn't mended meanwhile (onCell).
      if (isEmptyTurn(chainsRef.current[ci]?.cells[step])) vote(false, false);
      else autoRuleRef.current = '';
    }, AUTO_RULE_MS);
  };

  Object.assign(e, {
    updateJudgeWait,
    armJudgeWait,
    forgetDocks,
    onToReveal,
    forceRevealChain,
    onRevealState,
    onChainScored,
    vote,
    maybeAutoRule,
  } satisfies Partial<EngineFns>);
}
