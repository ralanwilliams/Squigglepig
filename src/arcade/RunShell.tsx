import React, { createContext, useContext, useEffect, useReducer, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Stage } from '../components/Stage';
import { Logo } from '../components/Logo';
import { Heading } from '../components/Heading';
import { PigButton } from '../components/PigButton';
import { BackButton } from '../components/BackButton';
import { TextLink } from '../components/TextLink';
import { Countdown, deadlineIn } from '../components/Countdown';
import { showToast } from '../components/Toast';
import { IMAGES } from '../assets/assets';
import { LADDER, ROUNDS, START, nextStep, prizeFor, roundSeconds, runReducer } from './engine';
import { PotLadder } from './PotLadder';
import { PayoutScreen } from './PayoutScreen';
import type { Game } from './games';

// One solo run of a game, start to finish (the rules are engine.ts):
//
//   ready   — the game's name and what to do, the pot ladder, Start
//   round   — the game's own round, inside RoundFrame: the round count up
//             top, the timer, the game's controls and the ladder in the rail
//   between — round won: bank the pot, or keep going (Bank only once there's
//             a prize in it)
//   lost    — wrong, or out of time: the pot is gone; play again
//   payout  — choose the prize (PayoutScreen.tsx)
//
// Nothing about a run is saved: leaving the screen mid-run (Leave, the back
// button) ends it and loses the pot, and so does the clock running out while
// the app is in the background — the timer goes by the wall clock.
export function RunShell({ game }: { game: Game<any> }) {
  const [run, dispatch] = useReducer(runReducer, START);
  const seconds = game.seconds ?? roundSeconds;
  const [specs, setSpecs] = useState<unknown[] | null>(null);
  const [loading, setLoading] = useState(false);
  const starting = useRef(false); // a ref, not `loading`: two taps in one frame both see the old state
  const live = useRef(true);
  useEffect(
    () => () => {
      live.current = false;
    },
    []
  );

  // Make the run's rounds, then start round 1. A game that can't make all
  // ROUNDS of them (a question list that came back short) doesn't start.
  const start = async () => {
    if (starting.current) return;
    starting.current = true;
    setLoading(true);
    try {
      const made = await game.makeRun();
      if (!live.current) return;
      if (made.length < ROUNDS) throw new Error(`${game.id}: ${made.length} of ${ROUNDS} rounds`);
      setSpecs(made);
      dispatch({ type: 'start', until: deadlineIn(seconds(1)) });
    } catch {
      if (live.current) showToast("Couldn't get the game ready. Try again.", 3000);
    } finally {
      starting.current = false;
      if (live.current) setLoading(false);
    }
  };
  const done = () => (router.canGoBack() ? router.back() : router.replace('/arcade'));
  const again = () => dispatch({ type: 'restart' });

  if (run.phase === 'ready') {
    return (
      <Plain
        title={game.label}
        back
        actions={
          <>
            <Heading>{game.blurb}</Heading>
            <PotLadder won={0} />
            <PigButton name={loading ? 'Getting ready…' : 'Start'} onPress={start} />
          </>
        }
      />
    );
  }

  if (run.phase === 'round' && specs) {
    const Round = game.Round;
    const finish = (won: boolean, detail?: string) => dispatch({ type: 'result', won, detail });
    return (
      <RoundCtx.Provider value={{ round: run.round, seconds: seconds(run.round), until: run.until, expire: () => dispatch({ type: 'result', won: false, timeout: true }), leave: done }}>
        <Round key={run.round} spec={specs[run.round - 1]} round={run.round} onResult={finish} Frame={RoundFrame} />
      </RoundCtx.Provider>
    );
  }

  if (run.phase === 'between') {
    const prize = LADDER.find((s) => s.prize === prizeFor(run.won));
    const next = nextStep(run.won);
    return (
      <Plain
        title={`Round ${run.won} won!`}
        actions={
          <>
            <PotLadder won={run.won} />
            <Heading>
              {prize
                ? `Bank the ${prize.label.toLowerCase()} prize, or risk it on round ${run.won + 1}.`
                : `Win ${next ? next.won - run.won : 0} more to put a prize in the pot.`}
            </Heading>
            <PigButton name="Keep going" onPress={() => dispatch({ type: 'next', until: deadlineIn(seconds(run.won + 1)) })} />
            {prize ? <PigButton name="Bank it" onPress={() => dispatch({ type: 'bank' })} /> : null}
          </>
        }
      />
    );
  }

  if (run.phase === 'lost') {
    const lostPrize = LADDER.find((s) => s.prize === prizeFor(run.won));
    return (
      <Plain
        title={run.timeout ? 'Out of time!' : 'Not quite!'}
        back
        actions={
          <>
            {run.detail ? <Heading>{run.detail}</Heading> : null}
            <Heading>
              {lostPrize ? `The ${lostPrize.label.toLowerCase()} prize in the pot is gone.` : `You won ${run.won} of ${ROUNDS}.`}
            </Heading>
            <PigButton name="Play again" onPress={again} />
            <PigButton name="Done" onPress={done} />
          </>
        }
      />
    );
  }

  if (run.phase === 'payout') return <PayoutScreen prize={run.prize} onAgain={again} onDone={done} />;
  return null;
}

// A screen between rounds: the title, the pig, and the rail. `back` adds the
// corner ‹ (only where leaving loses nothing).
function Plain({ title, actions, back }: { title: string; actions: React.ReactNode; back?: boolean }) {
  return (
    <View style={styles.fill}>
      <Stage header={<Heading size="h3" lines={1}>{title}</Heading>} focus={<Logo source={IMAGES.home} />} actions={actions} />
      {back ? <BackButton /> : null}
    </View>
  );
}

// What a game's round is drawn into (games/index.ts Frame). A component of
// its own rather than one made inside RunShell, so it keeps its identity from
// render to render and the round's content isn't remounted; the run reaches
// it through RoundCtx.
const RoundCtx = createContext<{ round: number; seconds: number; until: number; expire: () => void; leave: () => void } | null>(null);

function RoundFrame({
  focus,
  controls,
  fitFocus,
  onExpire,
}: {
  focus: React.ReactNode;
  controls?: React.ReactNode;
  fitFocus?: boolean;
  onExpire?: () => void;
}) {
  const ctx = useContext(RoundCtx);
  if (!ctx) throw new Error('RoundFrame is drawn by RunShell');
  return (
    <Stage
      header={<Heading size="h3" lines={1}>Round {ctx.round} of {ROUNDS}</Heading>}
      focus={focus}
      fitFocus={fitFocus}
      actions={
        <>
          <Countdown seconds={ctx.seconds} until={ctx.until} onExpire={onExpire ?? ctx.expire} size={32} />
          {controls}
          <PotLadder won={ctx.round - 1} />
          <TextLink label="Leave" onPress={ctx.leave} />
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
