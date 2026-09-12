import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Mask, Path, Rect } from 'react-native-svg';
import { glyph } from '../theme/tokens';
import { useThemeMode } from '../theme/theme';
import { useUi } from '../theme/responsive';

// The dark-mode switch: one amber glyph in the top-right corner. A sun with
// eight triangular rays; tap it and the rays spin away as they fade, the disc
// swells and a hole slides in from the top-right to carve it into a thick
// crescent, then two stars pop into the opening one after the other. The
// screen follows with the wipe in ThemeProvider (night rises from the bottom,
// day comes down from the top). Same amber on both palettes, so it reads as a
// sun and a moon rather than as text. Sized from the UI
// scale, 44dp hit target.
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);

const RAY = 'M10.6 5.4 L13.4 5.4 L12 1.4 Z';
const RAYS = [0, 45, 90, 135, 180, 225, 270, 315];
// a four-point star centred on the origin
const star = (s: number) => {
  const b = +(s * 0.22).toFixed(2);
  return `M0 -${s} Q${b} -${b} ${s} 0 Q${b} ${b} 0 ${s} Q-${b} ${b} -${s} 0 Q-${b} -${b} 0 -${s} Z`;
};
const STAR_A = star(2.2);
const STAR_B = star(1.5);

const MORPH_MS = 450;
const NO_NATIVE = { useNativeDriver: false }; // SVG attributes can't go through the native driver

export function ThemeToggle({ size = 26 }: { size?: number }) {
  const ui = useUi();
  const { showing, toggle } = useThemeMode();
  const dark = showing === 'dark';

  const t = useRef(new Animated.Value(dark ? 1 : 0)).current;
  const starA = useRef(new Animated.Value(dark ? 1 : 0)).current;
  const starB = useRef(new Animated.Value(dark ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(t, { toValue: dark ? 1 : 0, duration: MORPH_MS, easing: Easing.out(Easing.cubic), ...NO_NATIVE }).start();
    // in: pop with a little overshoot, once the crescent has formed; out: a plain quick shrink
    const pop = (v: Animated.Value, delay: number) =>
      dark
        ? Animated.timing(v, { toValue: 1, duration: 250, delay, easing: Easing.out(Easing.back(2)), ...NO_NATIVE })
        : Animated.timing(v, { toValue: 0, duration: 200, easing: Easing.in(Easing.quad), ...NO_NATIVE });
    pop(starA, 300).start();
    pop(starB, 420).start();
  }, [dark, t, starA, starB]);

  const disc = t.interpolate({ inputRange: [0, 1], outputRange: [5, 8.5] });
  const discX = t.interpolate({ inputRange: [0, 1], outputRange: [12, 11.5] });
  const holeX = t.interpolate({ inputRange: [0, 1], outputRange: [32, 16.2] });
  const holeY = t.interpolate({ inputRange: [0, 1], outputRange: [6, 10.4] });
  const rays = t.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 0, 0] });
  const raySpin = t.interpolate({ inputRange: [0, 1], outputRange: [0, 60] });
  const rayScale = t.interpolate({ inputRange: [0, 1], outputRange: [1, 0.3] });

  const px = ui.sp(size);
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel="Dark mode"
      accessibilityState={{ checked: dark }}
      onPress={toggle}
      hitSlop={6}
      style={({ pressed }) => [styles.hit, { width: ui.sp(44), height: ui.sp(44), opacity: pressed ? 0.6 : 1 }]}
    >
      <View>
        <Svg width={px} height={px} viewBox="0 0 24 24" fill={glyph.sun}>
          <Mask id="moon-hole">
            <Rect width="24" height="24" fill="#fff" />
            <AnimatedCircle cx={holeX} cy={holeY} r={7.2} fill="#000" />
          </Mask>
          <AnimatedG opacity={rays} rotation={raySpin} scale={rayScale} originX={12} originY={12}>
            {RAYS.map((deg) => (
              <Path key={deg} d={RAY} fill={glyph.sun} transform={`rotate(${deg} 12 12)`} />
            ))}
          </AnimatedG>
          <AnimatedCircle cx={discX} cy={12} r={disc} fill={glyph.sun} mask="url(#moon-hole)" />
          {/* Position with a transform on a plain group, scale on an inner one:
              react-native-svg drops x/y from a group on a normal render (they are
              text props there) while its animation fast path honours them, so
              a group carrying both would jump once an animation settled. */}
          <G transform="translate(17.4 7.2)">
            <AnimatedG scale={starA}>
              <Path d={STAR_A} fill={glyph.sun} />
            </AnimatedG>
          </G>
          <G transform="translate(20.2 11.6)">
            <AnimatedG scale={starB}>
              <Path d={STAR_B} fill={glyph.sun} />
            </AnimatedG>
          </G>
        </Svg>
      </View>
    </Pressable>
  );
}

// Floats the toggle over every screen, in the header band's top-right corner:
// vertically centred on a one-line title, its icon flush with the band's
// horizontal padding. Stage reserves that corner so header text never runs
// underneath it (whether or not the toggle is showing, so nothing shifts
// when dark mode is unlocked).
export function ThemeToggleOverlay() {
  const ui = useUi();
  const { unlocked } = useThemeMode();
  if (!unlocked) return null;
  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.overlay,
        { top: ui.insets.top + ui.sp(5), right: ui.insets.right + ui.pad - ui.sp(9) },
      ]}
    >
      <ThemeToggle />
    </View>
  );
}

const styles = StyleSheet.create({
  hit: { alignItems: 'center', justifyContent: 'center' },
  overlay: { position: 'absolute', zIndex: 10 },
});
