import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { type Theme } from '../theme/tokens';
import { useReducedMotion, useThemedStyles } from '../theme/theme';
import { useUi } from '../theme/responsive';

// One dot per page; the current one stretches into a pill. With `upTo` every
// dot up to the current one is filled (progress: the walkthrough's steps);
// without, only the current one (a pager: SwipePager). With `onPick` each dot
// is a tap target too, for a mouse, which can't swipe, and a screen reader
// swipes up or down on the row to move a page. The count may change
// while it's on screen (the reveal's pages grow as the chain is judged).
export function PageDots({
  count,
  index,
  upTo,
  label,
  onPick,
}: {
  count: number;
  index: number;
  upTo?: boolean;
  label: string;
  onPick?: (i: number) => void;
}) {
  const ui = useUi();
  const styles = useThemedStyles(makeStyles);
  const d = ui.sp(8);
  return (
    <View
      style={[styles.dots, { gap: ui.sp(8), minHeight: d }]}
      accessible
      accessibilityRole={onPick ? 'adjustable' : 'progressbar'}
      accessibilityLabel={label}
      accessibilityActions={onPick ? [{ name: 'increment' }, { name: 'decrement' }] : undefined}
      onAccessibilityAction={(e) => {
        if (!onPick) return;
        if (e.nativeEvent.actionName === 'increment' && index < count - 1) onPick(index + 1);
        else if (e.nativeEvent.actionName === 'decrement' && index > 0) onPick(index - 1);
      }}
    >
      {Array.from({ length: count }, (_, i) => (
        <Dot key={i} size={d} current={i === index} filled={upTo ? i <= index : i === index} onPress={onPick && (() => onPick(i))} />
      ))}
    </View>
  );
}

function Dot({ size, current, filled, onPress }: { size: number; current: boolean; filled: boolean; onPress?: () => void }) {
  const styles = useThemedStyles(makeStyles);
  const reduced = useReducedMotion();
  const w = useRef(new Animated.Value(current ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) {
      w.setValue(current ? 1 : 0);
      return;
    }
    Animated.timing(w, { toValue: current ? 1 : 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [current, w, reduced]);
  const dot = (
    <Animated.View
      style={[
        styles.dot,
        filled && styles.dotDone,
        { height: size, borderRadius: size / 2, width: w.interpolate({ inputRange: [0, 1], outputRange: [size, size * 3] }) },
      ]}
    />
  );
  return onPress ? (
    <Pressable onPress={onPress} hitSlop={size} importantForAccessibility="no">
      {dot}
    </Pressable>
  ) : (
    dot
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
    dot: { backgroundColor: t.divider },
    dotDone: { backgroundColor: t.link },
  });
