import React, { useLayoutEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { PageDots } from './PageDots';
import { useSwipe } from '../lib/useSwipe';
import { useReducedMotion } from '../theme/theme';
import { useUi } from '../theme/responsive';

const NATIVE = Platform.OS !== 'web';

// Slides what's on screen in from the side it came from whenever `index`
// changes: from the right going forward, from the left going back (with
// reduced motion it just appears). The walkthrough's steps and SwipePager's
// pages. Spread the result into an Animated.View's style.
export function useSlideIn(index: number) {
  const ui = useUi();
  const reduced = useReducedMotion();
  const enter = useRef(new Animated.Value(1)).current;
  // Which way it came, worked out as it renders, so this render's slide
  // starts from the right side (an effect would only set it for the next).
  const dir = useRef(1);
  const last = useRef(index);
  if (index !== last.current) {
    dir.current = index > last.current ? 1 : -1;
    last.current = index;
  }
  // Before the screen is painted, so the new page never flashes in place
  // before it slides.
  const shown = useRef(index);
  useLayoutEffect(() => {
    if (index === shown.current) return;
    shown.current = index;
    if (reduced) {
      enter.setValue(1);
      return;
    }
    enter.setValue(0);
    Animated.timing(enter, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE }).start();
  }, [index, enter, reduced]);
  return {
    opacity: enter,
    transform: [{ translateX: enter.interpolate({ inputRange: [0, 1], outputRange: [dir.current * ui.sp(28), 0] }) }],
  };
}

// Pages to swipe between, left for the next and right for the one before,
// with a dot for each under them so it's plain there are more (tap a dot to
// go to it; a screen reader swipes up or down on the dots). Only the page on screen is
// drawn: `children`, for page `index` of `count`, which the screen keeps
// (onIndex asks it to move). The reveal's chain, one turn to a page.
export function SwipePager({
  count,
  index,
  onIndex,
  label,
  children,
}: {
  count: number;
  index: number;
  onIndex: (i: number) => void;
  label: string; // what the pages are, for a screen reader ("Turn 2 of 4")
  children: React.ReactNode;
}) {
  const ui = useUi();
  const go = (i: number) => {
    if (i >= 0 && i < count && i !== index) onIndex(i);
  };
  const swipe = useSwipe(
    () => go(index + 1),
    () => go(index - 1)
  );
  const slide = useSlideIn(index);
  return (
    <View style={[styles.fill, { gap: ui.sp(8) }]}>
      <View style={styles.fill} {...swipe}>
        <Animated.View style={[styles.fill, slide]}>{children}</Animated.View>
      </View>
      {/* The dots' row keeps its height with one page too, so nothing moves when a second arrives. */}
      <View style={{ opacity: count > 1 ? 1 : 0 }} importantForAccessibility={count > 1 ? 'auto' : 'no-hide-descendants'}>
        <PageDots count={Math.max(1, count)} index={index} label={label} onPick={go} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, minHeight: 0 },
});
