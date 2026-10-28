import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet } from 'react-native';
import { font } from '../theme/tokens';
import { useReducedMotion } from '../theme/theme';
import { FONT_CAP, useUi } from '../theme/responsive';
import { useFieldColors } from './fieldColors';

// The count in to a full-screen game's round (FieldFrame.tsx): the field
// waits under a curtain in the field's own dark brown while 3, 2, 1 stamp
// down in the middle, then "Go!" as the curtain lifts and the round's clock
// starts. Under the curtain the field can't be studied or played, so no one
// gets a head start; the chips (the clock, the slider, Leave) stay over it.
//
// It goes by the wall clock, from `startsAt` (epoch ms, when the round
// starts), so a remount (the phone turning) picks it up where it was.

export const STEP_MS = 700; // each of 3, 2, 1
export const COUNT_IN_MS = 3 * STEP_MS; // from the curtain to "Go!"
const GO_MS = 600; // "Go!" stays this long, the curtain lifting under it
const NATIVE = Platform.OS !== 'web';

// Whether the round has started (`startsAt` passed): false through the count
// in, then true from then on. Rerenders at the moment it turns.
export function useStarted(startsAt?: number) {
  const [now, setNow] = useState(Date.now);
  const started = !startsAt || now >= startsAt;
  useEffect(() => {
    if (started) return;
    const timer = setTimeout(() => setNow(Date.now()), startsAt! - Date.now() + 10);
    return () => clearTimeout(timer);
  }, [started, startsAt, now]);
  return started;
}

// Which step is showing: 3, 2, 1, 0 for "Go!", or null once it's over.
function useStep(startsAt: number) {
  const step = () => {
    const left = startsAt - Date.now();
    if (left > 0) return Math.min(3, Math.ceil(left / STEP_MS));
    return -left < GO_MS ? 0 : null;
  };
  const [tick, setTick] = useState(0);
  const shown = step();
  useEffect(() => {
    if (shown === null) return;
    const left = startsAt - Date.now();
    const next = left > 0 ? left - (Math.ceil(left / STEP_MS) - 1) * STEP_MS : left + GO_MS;
    const timer = setTimeout(() => setTick((n) => n + 1), Math.max(0, next) + 10);
    return () => clearTimeout(timer);
  }, [shown, startsAt, tick]);
  return shown;
}

export function RoundCountdown({ startsAt }: { startsAt: number }) {
  const step = useStep(startsAt);
  const fc = useFieldColors();
  const reduced = useReducedMotion();
  // The curtain, and "Go!" on it, fade out together as it lifts.
  const shown = useRef(new Animated.Value(step === null ? 0 : 1)).current;
  const lifting = step === 0;
  useEffect(() => {
    if (!lifting) return;
    Animated.timing(shown, { toValue: 0, duration: reduced ? 0 : GO_MS, easing: Easing.in(Easing.quad), useNativeDriver: NATIVE }).start();
  }, [lifting, shown, reduced]);
  if (step === null) return null;
  return (
    <Animated.View
      pointerEvents={lifting ? 'none' : 'auto'}
      style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: fc.curtain, opacity: shown }]}
    >
      <Stamp key={step} text={step ? String(step) : 'Go!'} color={step ? fc.text : fc.amber} />
    </Animated.View>
  );
}

// One step: it stamps down from big and faint, then holds.
function Stamp({ text, color }: { text: string; color: string }) {
  const ui = useUi();
  const reduced = useReducedMotion();
  const p = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (!reduced) Animated.timing(p, { toValue: 1, duration: 260, easing: Easing.out(Easing.back(1.8)), useNativeDriver: NATIVE }).start();
  }, [p, reduced]);
  return (
    <Animated.Text
      accessibilityLiveRegion="assertive"
      style={[
        styles.stamp,
        {
          color,
          fontSize: ui.f(96),
          textShadowRadius: ui.sp(10),
          opacity: p,
          transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [1.8, 1] }) }],
        },
      ]}
      maxFontSizeMultiplier={FONT_CAP}
    >
      {text}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  stamp: { fontFamily: font.bold, textShadowColor: 'rgba(0, 0, 0, 0.45)', textShadowOffset: { width: 0, height: 3 } },
});
