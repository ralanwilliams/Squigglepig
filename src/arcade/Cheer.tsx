import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { font } from '../theme/tokens';
import { useReducedMotion } from '../theme/theme';
import { FONT_CAP, useUi } from '../theme/responsive';

// A full-screen game's win, played on its own field (FieldFrame.tsx) rather
// than on a card: the words stamp down in a burst of sparks and rise away
// (Cheer), and the pig hops for joy (Hop). RunShell moves on 1.8 s after the
// win, so the cheer is over by then.

const CHEER_MS = 1500;
const SPARKS = 14;
const CREAM = '#F4EAD9';
const SPARK_COLORS = ['#E2B06A', CREAM, '#F6A0B5']; // the field's amber and cream, the pig's pink
const NATIVE = Platform.OS !== 'web';

// Wrap the pig in this: once `on`, it hops three times, each lower.
export function Hop({ on, children }: { on: boolean; children: React.ReactNode }) {
  const ui = useUi();
  const reduced = useReducedMotion();
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!on || reduced) return;
    const hop = (h: number) =>
      Animated.sequence([
        Animated.timing(y, { toValue: -ui.sp(h), duration: 170, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }),
        Animated.timing(y, { toValue: 0, duration: 170, easing: Easing.in(Easing.quad), useNativeDriver: NATIVE }),
      ]);
    Animated.sequence([hop(14), hop(9), hop(5)]).start();
  }, [on, reduced]);
  return <Animated.View style={{ transform: [{ translateY: y }] }}>{children}</Animated.View>;
}

// `text` stamps down over the field, centred at x, y, in a burst of sparks,
// then rises away. With reduced motion it simply shows.
export function Cheer({ x, y, text }: { x: number; y: number; text: string }) {
  const ui = useUi();
  const reduced = useReducedMotion();
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!reduced) Animated.timing(p, { toValue: 1, duration: CHEER_MS, easing: Easing.linear, useNativeDriver: NATIVE }).start();
  }, [p, reduced]);
  const w = ui.sp(320);
  const h = ui.sp(48);
  const words = (
    <Text
      style={[styles.cheer, { fontSize: ui.f(34), textShadowRadius: ui.sp(6) }]}
      maxFontSizeMultiplier={FONT_CAP}
      numberOfLines={1}
      adjustsFontSizeToFit
      accessibilityLiveRegion="polite"
    >
      {text}
    </Text>
  );
  const box = { left: x - w / 2, top: y - h / 2, width: w, height: h };
  if (reduced) {
    return (
      <View pointerEvents="none" style={[styles.abs, styles.box, box]}>
        {words}
      </View>
    );
  }
  return (
    <>
      {Array.from({ length: SPARKS }, (_, i) => {
        const a = (i / SPARKS) * 2 * Math.PI + (i % 2) * 0.2;
        const d = ui.sp(i % 2 ? 95 : 135);
        const size = ui.sp(i % 3 === 0 ? 10 : 7);
        const out = (to: number) => p.interpolate({ inputRange: [0, 0.5], outputRange: [0, to], extrapolate: 'clamp', easing: Easing.out(Easing.cubic) });
        return (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={[
              styles.abs,
              {
                left: x - size / 2,
                top: y - size / 2,
                width: size,
                height: size,
                borderRadius: i % 3 === 0 ? ui.sp(2) : size / 2,
                backgroundColor: SPARK_COLORS[i % SPARK_COLORS.length],
                opacity: p.interpolate({ inputRange: [0, 0.05, 0.45, 0.65], outputRange: [0, 1, 1, 0], extrapolate: 'clamp' }),
                transform: [{ translateX: out(Math.cos(a) * d) }, { translateY: out(Math.sin(a) * d) }, { rotate: '45deg' }],
              },
            ]}
          />
        );
      })}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.abs,
          styles.box,
          box,
          {
            opacity: p.interpolate({ inputRange: [0, 0.08, 0.8, 1], outputRange: [0, 1, 1, 0] }),
            transform: [
              { translateY: p.interpolate({ inputRange: [0.8, 1], outputRange: [0, -ui.sp(24)], extrapolate: 'clamp' }) },
              { scale: p.interpolate({ inputRange: [0, 0.12, 0.2], outputRange: [1.8, 0.92, 1], extrapolate: 'clamp' }) },
            ],
          },
        ]}
      >
        {words}
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  box: { alignItems: 'center', justifyContent: 'center' },
  cheer: {
    color: CREAM,
    fontFamily: font.bold,
    textAlign: 'center',
    textShadowColor: 'rgba(42, 26, 14, 0.9)',
    textShadowOffset: { width: 0, height: 2 },
  },
});
