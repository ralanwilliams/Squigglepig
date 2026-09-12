import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { font, type Theme } from '../theme/tokens';
import { useThemedStyles } from '../theme/theme';
import { FONT_CAP, useUi } from '../theme/responsive';

// The trough: a pig trough filling with mud, one step per pooled prompt. Pure
// vector (react-native-svg) driven by RN's Animated, so it scales with the UI
// like everything else and needs no image assets.
//   - the mud level eases to count / target
//   - two wave layers drift in opposite directions so the surface never sits still
//   - a few bubbles rise now and then

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Drawing space is 400 × 168. The cavity (where mud shows) spans y 52 → 128.
const CAVITY_H = 76;
const CAVITY = 'M62 52 H338 L318 128 H82 Z';
const BODY =
  'M48 40 H352 a8 8 0 0 1 7.6 10.4 L332 130 a10 10 0 0 1 -9.6 7 H77.6 a10 10 0 0 1 -9.6 -7 L40.4 50.4 A8 8 0 0 1 48 40 Z';
// A wave 80 units long, repeated past both edges so it can scroll seamlessly.
const WAVE = 'M-80 52 q20 -7 40 0 ' + 't40 0 '.repeat(13) + 'V240 H-80 Z';
const WAVE_BACK = 'M-80 50 q20 -9 40 0 ' + 't40 0 '.repeat(13) + 'V240 H-80 Z';
const BUBBLES = [
  { cx: 120, cy: 84, r: 3.2, delay: 0, dur: 2600 },
  { cx: 212, cy: 88, r: 2.4, delay: 900, dur: 3100 },
  { cx: 271, cy: 82, r: 3.6, delay: 1700, dur: 2300 },
  { cx: 165, cy: 90, r: 2.0, delay: 400, dur: 3600 },
];

export function Trough({ count, target }: { count: number; target: number }) {
  const ui = useUi();
  const styles = useThemedStyles(makeStyles);
  // 0 = brim, 1 = empty (it's the fraction of the cavity the mud is shifted down by).
  const empty = useRef(new Animated.Value(1)).current;
  const wave = useRef(new Animated.Value(0)).current;
  const waveBack = useRef(new Animated.Value(-80)).current;
  const bubbles = useRef(BUBBLES.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const fill = target > 0 ? Math.min(1, count / target) : 0;
    Animated.timing(empty, {
      toValue: 1 - fill,
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [count, target, empty]);

  useEffect(() => {
    const linear = { easing: Easing.linear, useNativeDriver: false };
    const loops = [
      Animated.loop(Animated.timing(wave, { toValue: -80, duration: 2800, ...linear })),
      Animated.loop(Animated.timing(waveBack, { toValue: 0, duration: 4100, ...linear })),
      ...bubbles.map((b, i) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(BUBBLES[i].delay),
            Animated.timing(b, { toValue: 1, duration: BUBBLES[i].dur, easing: Easing.in(Easing.quad), useNativeDriver: false }),
            Animated.timing(b, { toValue: 0, duration: 0, useNativeDriver: false }),
          ])
        )
      ),
    ];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [wave, waveBack, bubbles]);

  const levelY = empty.interpolate({ inputRange: [0, 1], outputRange: [0, CAVITY_H] });
  const remaining = Math.max(0, target - count);

  return (
    <View style={[styles.wrap, { gap: ui.sp(4) }]}>
      <Svg viewBox="0 0 400 168" style={styles.svg}>
        <Defs>
          <ClipPath id="cavity">
            <Path d={CAVITY} />
          </ClipPath>
          <LinearGradient id="wood" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#CFA066" />
            <Stop offset="1" stopColor="#A57541" />
          </LinearGradient>
          <LinearGradient id="mud" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#8E5C34" />
            <Stop offset="0.25" stopColor="#6E4526" />
            <Stop offset="1" stopColor="#4A2C16" />
          </LinearGradient>
        </Defs>

        {/* legs */}
        <Rect x="88" y="126" width="16" height="32" rx="3" fill="#7E5228" />
        <Rect x="296" y="126" width="16" height="32" rx="3" fill="#7E5228" />
        {/* body, then the cutaway cavity */}
        <Path d={BODY} fill="url(#wood)" stroke="#6A4320" strokeWidth="3" strokeLinejoin="round" />
        <Path d={CAVITY} fill="#33200F" />
        <Path d={CAVITY} fill="none" stroke="#24150A" strokeWidth="3" strokeLinejoin="round" />

        {/* mud */}
        <G clipPath="url(#cavity)">
          <AnimatedG translateY={levelY}>
            <AnimatedPath d={WAVE_BACK} fill="#5A381D" opacity={0.55} translateX={waveBack} />
            <AnimatedPath d={WAVE} fill="url(#mud)" translateX={wave} />
            {BUBBLES.map((b, i) => (
              <AnimatedCircle
                key={i}
                cx={b.cx}
                cy={b.cy}
                r={b.r}
                fill="#B98A5F"
                translateY={bubbles[i].interpolate({ inputRange: [0, 1], outputRange: [34, -3] })}
                opacity={bubbles[i].interpolate({ inputRange: [0, 0.25, 0.9, 1], outputRange: [0, 0.75, 0.5, 0] })}
              />
            ))}
          </AnimatedG>
        </G>

        {/* rim highlight */}
        <Path d="M50 41 H350" stroke="#EAC38C" strokeWidth="3" strokeLinecap="round" />
      </Svg>

      <Text style={[styles.count, { fontSize: ui.f(22) }]} maxFontSizeMultiplier={FONT_CAP}>
        {count} / {target}
      </Text>
      <Text style={[styles.sub, { fontSize: ui.f(13) }]} maxFontSizeMultiplier={FONT_CAP} numberOfLines={2}>
        {remaining > 0
          ? `${remaining} more and the game starts — anyone can add.`
          : 'Trough full — starting the game!'}
      </Text>
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  // No card behind it — the trough sits straight on the teal.
  wrap: { width: '100%' },
  svg: { width: '100%', aspectRatio: 400 / 168 },
  count: { color: t.link, fontFamily: font.bold, textAlign: 'center', letterSpacing: 1 },
  sub: { color: t.text, fontFamily: font.regular, textAlign: 'center' },
});
