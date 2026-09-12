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
const secondsLeft = (deadline: number) => Math.max(0, Math.ceil((deadline - Date.now()) / 1000));

export function Countdown({
  seconds,
  until,
  onExpire,
  size = 20,
}: {
  seconds: number;
  until?: number;
  onExpire?: () => void;
  size?: number; // base font size, scaled by the UI scale
}) {
  const ui = useUi();
  const styles = useThemedStyles(makeStyles);
  const [remaining, setRemaining] = useState(() => (until ? secondsLeft(until) : seconds));
  const fired = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    const deadline = until ?? Date.now() + seconds * 1000;
    fired.current = false;
    const tick = () => {
      const left = secondsLeft(deadline);
      setRemaining(left);
      if (left <= 0 && !fired.current) {
        fired.current = true;
        clearInterval(id);
        onExpireRef.current?.();
      }
    };
    const id = setInterval(tick, 250);
    tick();
    return () => clearInterval(id);
  }, [seconds, until]);

  const mm = Math.floor(remaining / 60);
  const ss = remaining % 60;
  const label = mm > 0 ? `${mm}:${ss.toString().padStart(2, '0')}` : `${ss}s`;

  return (
    <Text
      style={[styles.text, { fontSize: ui.f(size) }, remaining <= URGENT_AT && styles.urgent]}
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

const makeStyles = (t: Theme) => StyleSheet.create({
  text: {
    textAlign: 'center',
    fontFamily: font.medium,
    color: t.text,
  },
  urgent: { color: t.accent, fontFamily: font.bold },
});
