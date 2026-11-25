import { endGameOnServer, roomState, saveSnapshot } from '../../lib/rooms';
import { lobbyOnCatchUp } from '../nav';
import { asRules, finalStage, isGameOn, isTurnPhase, mergeChains, type Phase } from '../rules';
import { asState, type GameState } from '../wire';
import { ANSWER_STAGGER_MS, ASK_EVERY_MS, ASK_TRIES } from './constants';
import type { Engine, EngineFns, Snapshot } from './engine';
import { closedMessage } from './messages';
import { sameTurn } from './types';

// ---- Catching up, and the snapshot ----
// A phone back on screen catches up (resync), asking until a caught-up phone
// answers, or, with nobody there to, from the snapshot the keeper saves to
// the server at every step.
export function installSync(e: Engine) {
  const {
    roomRef,
    subscribedRef,
    awakeRef,
    lastResyncRef,
    syncedRef,
    askTimerRef,
    usernameRef,
    answersRef,
    snapTimerRef,
    isKeeperRef,
    keeperRef,
    phaseRef,
    stageRef,
    rosterRef,
    chainsRef,
    scoresRef,
    targetRef,
    leaderRef,
    roundRef,
    revealIndexRef,
    revealStepRef,
    rulingsRef,
    talliedRef,
    rulesRef,
    dockedRef,
    dockedAtRef,
    stoodInRef,
    pigOffRef,
    pigOffUsedRef,
    stageStartedAtRef,
    lastChangeRef,
    advancedForRef,
    dbPhaseRef,
    heldRef,
    restoringRef,
    pathRef,
    setTarget,
    setRound,
    setRoster,
    setChains,
    setScores,
    setRevealIndex,
    setRevealStep,
    setRulings,
    setRules,
    setDockedAt,
    setStage,
    setTurn,
    setPhase,
    setStageStart,
    setResuming,
  } = e;

  // Catch up: this phone may have missed something (it was off screen or
  // reconnected, or a message showed it was behind). Until an answer comes
  // (onState) it isn't caught up, so it doesn't keep the clock, and the room
  // elects someone who is. It asks every ASK_EVERY_MS until it's answered (a
  // caught-up phone answers: onRequestState), and after ASK_TRIES with
  // nobody there to answer it picks the game up from the server (restore).
  // At most one catch-up every couple of seconds, unless `now` (a fresh
  // connection always asks). Off screen it waits until it's back (comeBack).
  const resync = (now = false) => {
    if (!roomRef.current || !subscribedRef.current || !awakeRef.current) return; // connecting asks once it's in
    const t = Date.now();
    if (!now && t - lastResyncRef.current < 2000) return;
    lastResyncRef.current = t;
    syncedRef.current = false;
    e.track();
    askForState();
    e.updateKeeper();
  };
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
      if (subscribedRef.current) e.send('request-state', { username: usernameRef.current });
      askTimerRef.current = setTimeout(ask, ASK_EVERY_MS);
    };
    ask();
  };

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
    e.clearClock();
    isKeeperRef.current = false;
    keeperRef.current = ''; // so keeping it again later arms a fresh clock (updateKeeper)
    syncedRef.current = false;
    stopAsking();
    forgetAnswers();
  };

  // ---- Snapshot (keeper) ----
  // Every change to the game, on every phone, marks the time; the keeper also
  // saves the whole game to the server, at most once every 0.8 s, so the room
  // can pick up from it if everyone closes the app at once.
  const buildState = (): Snapshot => ({
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
    rules: rulesRef.current,
    docked: [...dockedRef.current],
    dockedAt: dockedAtRef.current,
    stoodIn: stoodInRef.current,
    pigOff: pigOffRef.current,
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

  // ---- Reconnect / late-join state sync ----
  // A phone catching up asks for the game: the keeper answers at once, and in
  // case it has gone quiet, the other caught-up phones on screen answer a
  // moment apart after it (clockRank), each standing down when it sees an
  // answer go first (onState). `sentAt` is the sender's clock as it sends, so
  // the phone catching up can tell how far into the stage the game is without
  // the two clocks agreeing.
  const onRequestState = (who: string) => {
    if (who === usernameRef.current || !syncedRef.current) return;
    const rank = e.clockRank();
    if (rank < 0) return;
    const answer = () => {
      answersRef.current.delete(who);
      if (!roomRef.current || !syncedRef.current || !awakeRef.current) return;
      e.send('state', { to: who, ...buildState(), sentAt: Date.now() });
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
    if (sameRound) e.mendAll(incoming, p === 'reveal' ? finalStage(st.roster?.length ?? 0) : (st.stage ?? 0) - 1);
    targetRef.current = st.target ?? 5;
    setTarget(targetRef.current);
    leaderRef.current = st.leader ?? '';
    roundRef.current = st.round ?? 0;
    setRound(roundRef.current);
    rosterRef.current = st.roster ?? [];
    setRoster(rosterRef.current);
    chainsRef.current = sameRound ? mergeChains(chainsRef.current, incoming) : incoming;
    setChains(chainsRef.current);
    scoresRef.current = st.scores ?? {};
    setScores({ ...scoresRef.current });
    e.addGameNames(rosterRef.current, Object.keys(scoresRef.current));
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
    e.setPigOffBoth(st.pigOff);
    if (st.pigOff && !pigOffUsedRef.current.includes(st.pigOff.entry)) pigOffUsedRef.current.push(st.pigOff.entry);
    advancedForRef.current = (st.stage ?? 0) - 1;
    if (p !== 'lobby' && p !== 'gameover') dbPhaseRef.current = 'playing';

    if (same) {
      // Stay put (the clock is re-armed below).
    } else if (isTurnPhase(p)) {
      e.routeForStage(st.stage ?? 0);
    } else if (p === 'reveal') {
      e.go('/reveal');
      e.beginStage('reveal');
    } else if (p === 'pigoff') {
      stageRef.current = st.stage ?? 1;
      setStage(stageRef.current);
      setTurn(null);
      e.go('/pigoff');
      e.beginStage('pigoff');
    } else if (p === 'gameover') {
      e.go('/scoreboard');
      e.beginStage('gameover');
    } else {
      // The lobby: only if this phone isn't in it already (../nav lobbyOnCatchUp).
      const was = phaseRef.current;
      phaseRef.current = 'lobby';
      setPhase('lobby');
      if (lobbyOnCatchUp(was, pathRef.current)) e.go('/lobby');
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
      setStageStart(stageStartedAtRef.current);
      e.setEndsAt(stageStartedAtRef.current + e.durationFor(p) * 1000);
      if (isKeeperRef.current) e.armForCurrentStage(false);
      e.armJudgeWait(); // a chain at the reveal came up that long ago
    }
    lastChangeRef.current = Math.max(lastChangeRef.current, Number(st.savedAt) || 0);
    e.computeSkips();
  };

  const markSynced = () => {
    syncedRef.current = true;
    stopAsking();
    if (awakeRef.current) setResuming(false); // on screen and caught up: the clocks can run out again
    e.track();
    e.updateKeeper();
    // A turn handed in late while this phone was catching up (submitCell):
    // now it knows whether its stage is still open. If it isn't, the turn was
    // missed.
    const held = heldRef.current;
    heldRef.current = null;
    if (held && sameTurn(held.turn, e.currentTurn())) e.submitCell(held.data, held.turn, held.closing);
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
      if (res.status === 'closed') return e.closeLocally(closedMessage(code, res.reason));
      if (res.status !== 'ok') return keepAsking();
      dbPhaseRef.current = res.phase;
      e.setMembers(res.members, false);
      if (!mine()) return keepAsking();
      const local = phaseRef.current;
      const midGame = local !== 'lobby' && local !== 'gameover';
      if (res.phase !== 'playing') {
        // No game on (or it ended while this phone was away): the lobby, unless
        // this phone is already looking at the final scores.
        if (lobbyOnCatchUp(local, pathRef.current)) {
          e.clearClock();
          phaseRef.current = 'lobby';
          setPhase('lobby');
          e.go('/lobby');
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
        e.armForCurrentStage(false);
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
      e.send('state', { to: '*', ...buildState(), sentAt: Date.now() });
      changed();
      e.maybeAdvanceStage();
      e.maybePigOffDone();
      e.maybeAutoRule();
    }, force ? 0 : 1200);
  };

  Object.assign(e, {
    resync,
    stopAsking,
    askForState,
    forgetAnswers,
    standDown,
    buildState,
    changed,
    onRequestState,
    applyState,
    markSynced,
    onState,
    restore,
  } satisfies Partial<EngineFns>);
}
