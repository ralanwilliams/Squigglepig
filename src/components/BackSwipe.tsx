import React, { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { pressBack, useBackHeld } from '../lib/backGuard';

// The swipe back from the left edge on an iPhone or iPad, while Back is held
// (src/lib/backGuard.ts): the screen's own swipe is off then, so nothing would
// happen. This takes its place around the navigator, and asks instead of
// sliding the screen away.
//
// It's around the screens rather than a strip over the edge so taps there still
// reach what's under them, and it only starts on a swipe: a stroke begun at the
// edge of a canvas is the canvas's, which takes it straight away.
const EDGE = 20; // how close to the edge it starts: about what the system's does
const SWIPE = 30; // how far it has to go right, before going that far up or down
const IOS = Platform.OS === 'ios';

export function BackSwipe({ children }: { children: React.ReactNode }) {
  const held = useBackHeld();
  const swipe = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .enabled(held)
        .hitSlop({ left: 0, width: EDGE })
        .activeOffsetX(SWIPE)
        .failOffsetY([-SWIPE, SWIPE])
        .onStart(pressBack),
    [held]
  );
  if (!IOS) return <>{children}</>;
  return (
    <GestureDetector gesture={swipe}>
      <View collapsable={false} style={styles.fill}>
        {children}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
