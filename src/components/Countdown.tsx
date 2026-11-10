import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { font, type Theme } from '../theme/tokens';
import { useThemedStyles } from '../theme/theme';
import { FONT_CAP, useUi } from '../theme/responsive';
import { URGENT_AT } from '../lib/timers';

// A visible per-stage countdown. Calls `onExpire` once when it hits zero.
// Uses wall-clock time so it stays accurate even if the interval is throttled.
//
// `until` (epoch ms) pins the deadline OUTSIDE this component. Screens whose
// layout rebuilds itself when the phone turns (Stage's panes, WorkStage's rail)
// remount the countdown, and without a fixed deadline it would start over at
// `seconds` every time. Callers that hold state across the flip compute the
// deadline once and pass it in; the clock then just reads it. Without `until`
// the clock starts from `seconds` at mount, which suits a countdown that is
// meant to restart with its parent (keyed per reveal step, say).
//
// `stoppedAt` (epoch ms) stops the clock there: it shows what was left at that
// moment, dimmed, and never expires — a solo round once it's answered (the
// memory game's once Done is pressed, any game's once won). A time, not a
// flag, so a remount while stopped shows the same.
//
// `colors` replaces the theme's text and urgent colors, for a clock over a
// game's own art (FieldFrame.tsx).
//
// `hold` keeps it from running out: it still counts down, but `onExpire`
// waits until it's let go, and comes at once then if the time is up by
// `until` as it is then. A game screen holds its clock while its phone
// catches up after a trip out of the app: the deadline it slept through may
// be about to move (a game everyone was away from is paused, and picks up
// where it was).
const secondsLeft = (deadline: number, now = Date.now()) => Math.max(0, Math.ceil((deadline - now) / 1000));

export function Countdown({
  seconds,
  until,
  onExpire,
  size = 20,
  stoppedAt,
  colors,
  hold = false,
}: {
  seconds: number;
  until?: number;
  onExpire?: () => void;
  size?: number; // base font size, scaled by the UI scale
  stoppedAt?: number;
  colors?: { text: string; urgent: string };
  hold?: boolean;
}) {
  const ui = useUi();
  const styles = useThemedStyles(makeStyles);
  const [remaining, setRemaining] = useState(() => (until ? secondsLeft(until, stoppedAt) : seconds));
  const fired = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (stoppedAt) {
      if (until) setRemaining(secondsLeft(until, stoppedAt));
      return;
    }
    const deadline = until ?? Date.now() + seconds * 1000;
    fired.current = false;
    const tick = () => {
      const left = secondsLeft(deadline);
      setRemaining(left);
      if (left <= 0 && !fired.current && !hold) {
        fired.current = true;
        clearInterval(id);
        onExpireRef.current?.();
      }
    };
    const id = setInterval(tick, 250);
    tick();
    return () => clearInterval(id);
  }, [seconds, until, stoppedAt, hold]);

  const mm = Math.floor(remaining / 60);
  const ss = remaining % 60;
  const label = mm > 0 ? `${mm}:${ss.toString().padStart(2, '0')}` : `${ss}s`;
  const urgent = remaining <= URGENT_AT;

  return (
    <Text
      style={[
        styles.text,
        { fontSize: ui.f(size) },
        urgent && styles.urgent,
        colors && { color: urgent ? colors.urgent : colors.text },
        !!stoppedAt && styles.stopped,
      ]}
      maxFontSizeMultiplier={FONT_CAP}
      numberOfLines={1}
    >
      ⏱ {label}
    </Text>
  );
}

// The deadline for a `seconds`-long countdown starting now. Keep the result in
// state (or a ref) so it is computed once per screen, not once per render.
export const deadlineIn = (seconds: number) => Date.now() + seconds * 1000;

// A game screen's deadline: the game's own for the stage (GameContext
// turnEndsAt), so a screen that opened late, or a phone back in the room
// mid-stage, counts down only what's left. If that has already passed, or is
// further off than the whole `seconds` (a clock out of step), the whole
// `seconds` from now instead: the host's clock moves the game on either way.
export const deadlineFor = (seconds: number, endsAt?: number) =>
  isComing(seconds, endsAt) ? endsAt! : deadlineIn(seconds);
const isComing = (seconds: number, endsAt?: number) => !!endsAt && endsAt > Date.now() && endsAt <= deadlineIn(seconds);

// A game screen's deadline (deadlineFor), set when the screen opens and kept
// while the phone turns (its panes rebuild, remounting the Countdown). It
// moves when the game's does, to a time still to come: the game's clock put
// right after catching up, or a paused game picked up again. One already
// past is no news (the game is about to move on), and the clock never jumps
// back up to the whole time for it.
export function useDeadline(seconds: number, endsAt?: number) {
  const [until, setUntil] = useState(() => deadlineFor(seconds, endsAt));
  useEffect(() => {
    if (isComing(seconds, endsAt)) setUntil(endsAt!);
  }, [seconds, endsAt]);
  return until;
}

const makeStyles = (t: Theme) => StyleSheet.create({
  text: {
    textAlign: 'center',
    fontFamily: font.medium,
    color: t.text,
  },
  urgent: { color: t.accent, fontFamily: font.bold },
  stopped: { opacity: 0.45 },
});
