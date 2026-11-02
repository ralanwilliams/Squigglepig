import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useReducedMotion } from '../theme/theme';
import { useUi } from '../theme/responsive';

// A run's lives in reserve (engine.ts LIVES), as hearts beside the clock
// (FieldFrame.tsx, and RunShell's RoundFrame): `left` of `of` filled red, the
// used ones an outline in `line`. The heart just used gives a throb as it
// empties.

const RED = '#E53950';
const HEART = 'M12 21C5 15.6 2 12.3 2 8.6 2 5.6 4.4 3.3 7.3 3.3c1.9 0 3.7 1 4.7 2.6 1-1.6 2.8-2.6 4.7-2.6 2.9 0 5.3 2.3 5.3 5.3 0 3.7-3 7-10 12.4Z';
const NATIVE = Platform.OS !== 'web';

export function Lives({ left, of, line, size = 16 }: { left: number; of: number; line: string; size?: number }) {
  const ui = useUi();
  const reduced = useReducedMotion();
  const s = ui.sp(size);
  const throb = useRef(new Animated.Value(1)).current;
  const was = useRef(left);
  useEffect(() => {
    const lost = left < was.current;
    was.current = left;
    if (!lost || reduced) return;
    Animated.sequence([
      Animated.timing(throb, { toValue: 1.45, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }),
      Animated.timing(throb, { toValue: 1, duration: 260, easing: Easing.in(Easing.quad), useNativeDriver: NATIVE }),
    ]).start();
  }, [left, reduced, throb]);

  return (
    <View
      style={[styles.row, { gap: ui.sp(3) }]}
      accessible
      accessibilityLabel={`${left} ${left === 1 ? 'life' : 'lives'} left`}
    >
      {Array.from({ length: of }, (_, i) => (
        <Animated.View key={i} style={i === left ? { transform: [{ scale: throb }] } : null}>
          <Svg width={s} height={s} viewBox="0 0 24 24">
            <Path
              d={HEART}
              fill={i < left ? RED : 'none'}
              stroke={i < left ? RED : line}
              strokeWidth={2}
              strokeLinejoin="round"
            />
          </Svg>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
