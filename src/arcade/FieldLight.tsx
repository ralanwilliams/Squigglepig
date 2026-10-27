import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useReducedMotion, useTheme } from '../theme/theme';
import { rng } from './rng';

// The light over a full-screen game's field, day or night with the app's
// light / dark mode: by day a warm glow from the top left; by night the
// field's night (`night`, the game's own night-time drawing of it, or else a
// deep blue wash over the day's) with a cool moon glow from the top right and
// fireflies blinking over it. Switching fades between them over FADE_MS (the
// screen skips the app's sweep: useFadesWithTheme): the daylight drains, the
// night comes up, then the moonlight grows and the fireflies come out; going
// back, the reverse. With reduced motion it simply switches.
//
// Draw it over the field's day drawing and under what should keep its own
// colors at night (the pig, the marks, the taps).

const FADE_MS = 1800;
const NIGHT_WASH = 'rgba(6, 22, 62, 0.52)';
const NATIVE = Platform.OS !== 'web';

export function FieldLight({ w, h, seed, night: nightArt }: { w: number; h: number; seed: number; night?: React.ReactNode }) {
  const dark = useTheme().name === 'dark';
  const reduced = useReducedMotion();
  const night = useRef(new Animated.Value(dark ? 1 : 0)).current; // 0 day, 1 night
  useEffect(() => {
    const to = dark ? 1 : 0;
    if (reduced) {
      night.setValue(to);
      return;
    }
    const fade = Animated.timing(night, { toValue: to, duration: FADE_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE });
    fade.start();
    return () => fade.stop();
  }, [dark, reduced, night]);

  const flies = useMemo(() => {
    const r = rng(seed + 1);
    return Array.from({ length: Math.round((w * h) / 30000) }, () => ({
      x: r() * w,
      y: r() * h,
      size: 4 + r() * 3,
      period: 1600 + r() * 1600,
      phase: r(),
    }));
  }, [w, h, seed]);

  // Each layer over its own stretch of the fade.
  const stage = (from: number, to: number, a: number, b: number) =>
    night.interpolate({ inputRange: [from, to], outputRange: [a, b], extrapolate: 'clamp' });
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: stage(0, 0.5, 1, 0) }]}>
        <Glow w={w} h={h} id="fl-sun" cx="10%" color="#FFF1C2" strength={0.38} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, !nightArt && { backgroundColor: NIGHT_WASH }, { opacity: stage(0.2, 0.8, 0, 1) }]}>
        {nightArt}
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: stage(0.5, 1, 0, 1) }]}>
        <Glow w={w} h={h} id="fl-moon" cx="85%" color="#CFE3FF" strength={0.24} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: stage(0.7, 1, 0, 1) }]}>
        {flies.map((f, i) => (
          <Firefly key={i} {...f} still={reduced} />
        ))}
      </Animated.View>
    </View>
  );
}

// Light falling from the top of the field, `cx` across it, fading out.
function Glow({ w, h, id, cx, color, strength }: { w: number; h: number; id: string; cx: string; color: string; strength: number }) {
  return (
    <Svg width={w} height={h}>
      <Defs>
        <RadialGradient id={id} cx={cx} cy="0%" r="95%">
          <Stop offset="0" stopColor={color} stopOpacity={strength} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width={w} height={h} fill={`url(#${id})`} />
    </Svg>
  );
}

// A firefly: a pale yellow dot in a soft glow, slowly blinking (or, with
// reduced motion, just glowing).
function Firefly({ x, y, size, period, phase, still }: { x: number; y: number; size: number; period: number; phase: number; still: boolean }) {
  const p = useRef(new Animated.Value(still ? 1 : phase)).current;
  useEffect(() => {
    if (still) {
      p.setValue(1);
      return;
    }
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(p, { toValue: 1, duration: period / 2, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE }),
        Animated.timing(p, { toValue: 0, duration: period / 2, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE }),
      ])
    );
    blink.start();
    return () => blink.stop();
  }, [p, period, still]);
  const glow = size * 3;
  return (
    <Animated.View
      style={[
        styles.fly,
        { left: x - glow / 2, top: y - glow / 2, width: glow, height: glow, borderRadius: glow / 2, opacity: p.interpolate({ inputRange: [0, 1], outputRange: [0.15, 1] }) },
      ]}
    >
      <View style={[styles.core, { width: size, height: size, borderRadius: size / 2 }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fly: { position: 'absolute', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(247, 229, 138, 0.22)' },
  core: { backgroundColor: '#FFF6B0' },
});
