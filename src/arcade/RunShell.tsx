import React, { useContext, useEffect, useReducer, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Stage } from '../components/Stage';
import { FitBox } from '../components/FitBox';
import { Logo } from '../components/Logo';
import { Heading } from '../components/Heading';
import { NoteCard } from '../components/NoteCard';
import { PigButton } from '../components/PigButton';
import { TextLink } from '../components/TextLink';
import { Countdown, deadlineIn } from '../components/Countdown';
import { showToast } from '../components/Toast';
import { IMAGES } from '../assets/assets';
import { useUi } from '../theme/responsive';
import { useReducedMotion, useTheme } from '../theme/theme';
import { LADDER, ROUNDS, START, newTier, prizeFor, roundSeconds, runReducer } from './engine';
import { PotLadder } from './PotLadder';
import { RewardPodium } from './RewardPodium';
import { PayoutScreen } from './PayoutScreen';
import { FieldFrame } from './FieldFrame';
import { RoundCard, WON_CARD_DELAY_MS, useCardIn, useStageCardLook } from './RoundCard';
import { COUNT_IN_MS, useStarted } from './RoundCountdown';
import { RoundCtx, type Settled } from './RoundCtx';
import type { Game } from './games';

// One solo run of a game, start to finish (the rules are engine.ts). No
// screen of it has a title; the pot ladder says where the run is.
//
//   ready   — how to play, on a note (NoteCard.tsx), the reward tiers on a
//             podium (RewardPodium.tsx), Start
//   round   — the game's own round, inside RoundFrame: the timer, the game's
//             controls and the ladder in the rail
//   between — round won: the round's screen stays up showing how it went
//             (the answer marked right, the drawing scored), its clock
//             stopped. A win that reaches a new tier brings up a card over
//             it with the choice (RoundCard.tsx): keep going, or bank the
//             pot. Any other win has nothing new to bank: the screen stays
//             up for HOLD_MS (the slider's pig climbs a step), fades out,
//             and the next round fades in
//   lost    — wrong, or out of time: the pot is gone; play again
//   payout  — choose the prize (PayoutScreen.tsx)
//
// A full-screen game (Game.fullScreen) draws its rounds in FieldFrame
// instead. Each of its rounds counts in first (RoundCountdown.tsx: 3, 2, 1,
// Go!), the field under a curtain and the clock waiting, so the deadline is
// set that much later. Its lost round stays up too, with the news on it, so
// the player only leaves the field when the run ends.
//
// Nothing about a run is saved: leaving the screen mid-run (Leave, the back
// button) ends it and loses the pot, and so does the clock running out while
// the app is in the background — the timer goes by the wall clock.
const HOLD_MS = 1800; // a won round with no choice stays up this long (the slider's pig climbs a step in it)
const FADE_MS = 300; // then it fades out, and the next round in
const NATIVE = Platform.OS !== 'web';

export function RunShell({ game }: { game: Game<any> }) {
  const [run, dispatch] = useReducer(runReducer, START);
  const reduced = useReducedMotion();
  const fade = useRef(new Animated.Value(1)).current;
  const seconds = game.seconds ?? roundSeconds;
  // A round's deadline: its seconds from now, after the count in on a full-screen game.
  const deadline = (round: number) => deadlineIn(seconds(round) + (game.fullScreen ? COUNT_IN_MS / 1000 : 0));
  // When the round in play starts, on a full-screen game (else it starts at once).
  const startsAt = run.phase === 'round' && game.fullScreen ? run.until - seconds(run.round) * 1000 : undefined;
  const started = useStarted(startsAt);
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
      dispatch({ type: 'start', until: deadline(1) });
    } catch {
      if (live.current) showToast("Couldn't get the game ready. Try again.", 3000);
    } finally {
      starting.current = false;
      if (live.current) setLoading(false);
    }
  };
  const done = () => (router.canGoBack() ? router.back() : router.replace('/arcade'));
  const again = () => dispatch({ type: 'restart' });
  const keepGoing = (won: number) => dispatch({ type: 'next', until: deadline(won + 1) });

  // A round won short of a new tier: nothing to choose, so after a moment
  // it fades out and the next round fades in.
  const autoNext = run.phase === 'between' && !newTier(run.won) ? run.won : 0;
  useEffect(() => {
    if (!autoNext) return;
    const timer = setTimeout(() => {
      if (reduced) return keepGoing(autoNext);
      Animated.timing(fade, { toValue: 0, duration: FADE_MS, useNativeDriver: NATIVE }).start(({ finished }) => {
        if (!finished || !live.current) return;
        keepGoing(autoNext);
        Animated.timing(fade, { toValue: 1, duration: FADE_MS, useNativeDriver: NATIVE }).start();
      });
    }, HOLD_MS);
    return () => clearTimeout(timer);
  }, [autoNext]);

  if (run.phase === 'ready') {
    return (
      <Plain
        actions={
          <>
            <NoteCard label="How to play">{game.blurb}</NoteCard>
            <RewardPodium />
            <PigButton name={loading ? 'Getting ready…' : 'Start'} onPress={start} />
          </>
        }
      />
    );
  }

  // A round, and once it's won the same round left up (same key, so the
  // game keeps its state: what was picked, the score) with the choice added;
  // a full-screen game's lost round stays up the same way.
  const lostOnField = run.phase === 'lost' && !!game.fullScreen;
  if ((run.phase === 'round' || run.phase === 'between' || lostOnField) && specs) {
    const Round = game.Round;
    const round = run.phase === 'round' ? run.round : run.phase === 'between' ? run.won : run.won + 1;
    const finish = (won: boolean, detail?: string, timedOut?: boolean) =>
      dispatch({ type: 'result', won, detail, timeout: timedOut, at: Date.now() });
    let settled: Settled | undefined;
    if (run.phase === 'between') {
      const won = run.won;
      const prize = newTier(won) ? LADDER.find((s) => s.prize === prizeFor(won)) : undefined;
      settled = prize
        ? {
            at: run.at,
            lost: false,
            lines: [`Bank the ${prize.label.toLowerCase()} prize, or risk it on round ${won + 1}.`],
            actions: [
              { name: 'Keep going', onPress: () => keepGoing(won) },
              { name: 'Bank it', onPress: () => dispatch({ type: 'bank' }) },
            ],
          }
        : { at: run.at, lost: false, lines: [], actions: [] };
    } else if (run.phase === 'lost') {
      settled = { at: run.at, lost: true, ...lostNews(run), actions: [{ name: 'Play again', onPress: again }, { name: 'Done', onPress: done }] };
    }
    return (
      <RoundCtx.Provider
        value={{
          round,
          seconds: seconds(round),
          until: run.until,
          startsAt,
          expire: () => dispatch({ type: 'result', won: false, timeout: true, at: Date.now() }),
          leave: done,
          settled,
        }}
      >
        <Animated.View style={{ flex: 1, opacity: fade }}>
          <Round
            key={round}
            spec={specs[round - 1]}
            round={round}
            onResult={finish}
            Frame={game.fullScreen ? FieldFrame : RoundFrame}
            ended={settled ? { won: !settled.lost, at: settled.at } : undefined}
            held={!started}
          />
        </Animated.View>
      </RoundCtx.Provider>
    );
  }

  if (run.phase === 'lost') {
    const news = lostNews(run);
    return (
      <Plain
        actions={
          <>
            <Heading size="h3">{news.title}</Heading>
            {news.lines.map((line) => (
              <Heading key={line}>{line}</Heading>
            ))}
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

// What a lost run says: wrong or out of time, why, and what went with it.
function lostNews(run: { won: number; timeout: boolean; detail?: string }) {
  const lostPrize = LADDER.find((s) => s.prize === prizeFor(run.won));
  return {
    title: run.timeout ? 'Out of time!' : 'Not quite!',
    lines: [
      ...(run.detail ? [run.detail] : []),
      lostPrize ? `The ${lostPrize.label.toLowerCase()} prize in the pot is gone.` : `You won ${run.won} of ${ROUNDS}.`,
    ],
  };
}

// A screen between rounds: the pig, and the rail. No back arrow on any
// screen: Done and Leave are the way out, or the system back.
function Plain({ actions }: { actions: React.ReactNode }) {
  return <Stage focus={<Logo source={IMAGES.home} />} actions={actions} />;
}

// What a game's round is drawn into (games/index.ts Frame), on Stage; the
// run reaches it through RoundCtx. `settled` is set once the round is won:
// when, and at a new tier the choice, which comes up over the round as the
// same card a full-screen game's field shows (RoundCard.tsx), in the theme's
// colors on a scrim, a beat later so the win shows first. The rail doesn't
// change, so nothing in it moves.
function RoundFrame({
  focus,
  controls,
  fitFocus,
  onExpire,
  stoppedAt,
}: {
  focus: React.ReactNode;
  controls?: React.ReactNode;
  fitFocus?: boolean;
  onExpire?: () => void;
  stoppedAt?: number;
}) {
  const ctx = useContext(RoundCtx);
  if (!ctx) throw new Error('RoundFrame is drawn by RunShell');
  const { settled } = ctx;
  return (
    <View style={styles.fill}>
      <Stage
        focus={focus}
        fitFocus={fitFocus}
        actions={
          <>
            <Countdown
              seconds={ctx.seconds}
              until={ctx.until}
              onExpire={onExpire ?? ctx.expire}
              size={32}
              stoppedAt={stoppedAt ?? settled?.at}
            />
            {controls}
            <PotLadder won={settled ? ctx.round : ctx.round - 1} />
            <TextLink label="Leave" onPress={ctx.leave} />
          </>
        }
      />
      {settled && settled.actions.length ? <Choice settled={settled} /> : null}
    </View>
  );
}

// The card over a Stage round, on the theme's scrim, which takes the taps
// under it: the round is over, the card is the way on.
function Choice({ settled }: { settled: Settled }) {
  const ui = useUi();
  const t = useTheme();
  const look = useStageCardLook();
  const p = useCardIn(WON_CARD_DELAY_MS);
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          paddingTop: ui.insets.top + ui.pad,
          paddingBottom: ui.insets.bottom + ui.pad,
          paddingLeft: ui.insets.left + ui.pad,
          paddingRight: ui.insets.right + ui.pad,
        },
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: t.scrim, opacity: p }]} />
      <FitBox style={styles.fill}>
        <View style={styles.center}>
          <RoundCard look={look} delay={WON_CARD_DELAY_MS} title={settled.title} lines={settled.lines} actions={settled.actions} />
        </View>
      </FitBox>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center' },
});
