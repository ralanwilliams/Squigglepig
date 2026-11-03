import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Insets, View } from 'react-native';
import Svg, { Circle, G, Mask, Path, Rect } from 'react-native-svg';
import { GlyphSwitch } from './GlyphSwitch';
import { useReducedMotion, useTheme, useThemeMode } from '../theme/theme';
import { useUi } from '../theme/responsive';

// The dark-mode switch: one glyph in the top-right corner, outermost of the
// corner's switches (CornerControls.tsx). A sun with
// eight triangular rays; tap it and the rays spin away as they fade, the disc
// swells and a hole slides in from the top-right to carve it into a thick
// crescent, then two stars pop into the opening one after the other. The
// screen follows with the wipe in ThemeProvider (night rises from the bottom,
// day comes down from the top). Drawn in `color`, by default the theme's
// link color like the menu's ☰, so it shows on every palette and seasonal
// theme. Sized from the UI scale, 44dp hit target. With reduced motion it
// jumps straight to the other glyph.
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

export function ThemeToggle({ size = 26, hitSlop, color }: { size?: number; hitSlop?: number | Insets; color?: string }) {
  const ui = useUi();
  const theme = useTheme();
  const ink = color ?? theme.link;
  const { showing, toggle } = useThemeMode();
  const reduced = useReducedMotion();
  const dark = showing === 'dark';

  const t = useRef(new Animated.Value(dark ? 1 : 0)).current;
  const starA = useRef(new Animated.Value(dark ? 1 : 0)).current;
  const starB = useRef(new Animated.Value(dark ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) {
      [t, starA, starB].forEach((v) => v.setValue(dark ? 1 : 0));
      return;
    }
    Animated.timing(t, { toValue: dark ? 1 : 0, duration: MORPH_MS, easing: Easing.out(Easing.cubic), ...NO_NATIVE }).start();
    // in: pop with a little overshoot, once the crescent has formed; out: a plain quick shrink
    const pop = (v: Animated.Value, delay: number) =>
      dark
        ? Animated.timing(v, { toValue: 1, duration: 250, delay, easing: Easing.out(Easing.back(2)), ...NO_NATIVE })
        : Animated.timing(v, { toValue: 0, duration: 200, easing: Easing.in(Easing.quad), ...NO_NATIVE });
    pop(starA, 300).start();
    pop(starB, 420).start();
  }, [dark, reduced, t, starA, starB]);


  const disc = t.interpolate({ inputRange: [0, 1], outputRange: [5, 8.5] });
  const discX = t.interpolate({ inputRange: [0, 1], outputRange: [12, 11.5] });
  const holeX = t.interpolate({ inputRange: [0, 1], outputRange: [32, 16.2] });
  const holeY = t.interpolate({ inputRange: [0, 1], outputRange: [6, 10.4] });
  const rays = t.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 0, 0] });
  const raySpin = t.interpolate({ inputRange: [0, 1], outputRange: [0, 60] });
  const rayScale = t.interpolate({ inputRange: [0, 1], outputRange: [1, 0.3] });

  const px = ui.sp(size);
  return (
    <GlyphSwitch label="Dark mode" on={dark} onPress={toggle} hitSlop={hitSlop}>
      <View>
        <Svg width={px} height={px} viewBox="0 0 24 24" fill={ink}>
          <Mask id="moon-hole">
            <Rect width="24" height="24" fill="#fff" />
            <AnimatedCircle cx={holeX} cy={holeY} r={7.2} fill="#000" />
          </Mask>
          <AnimatedG opacity={rays} rotation={raySpin} scale={rayScale} originX={12} originY={12}>
            {RAYS.map((deg) => (
              <Path key={deg} d={RAY} fill={ink} transform={`rotate(${deg} 12 12)`} />
            ))}
          </AnimatedG>
          <AnimatedCircle cx={discX} cy={12} r={disc} fill={ink} mask="url(#moon-hole)" />
          {/* Position with a transform on a plain group, scale on an inner one:
              react-native-svg drops x/y from a group on a normal render (they are
              text props there) while its animation fast path honours them, so
              a group carrying both would jump once an animation settled. */}
          <G transform="translate(17.4 7.2)">
            <AnimatedG scale={starA}>
              <Path d={STAR_A} fill={ink} />
            </AnimatedG>
          </G>
          <G transform="translate(20.2 11.6)">
            <AnimatedG scale={starB}>
              <Path d={STAR_B} fill={ink} />
            </AnimatedG>
          </G>
        </Svg>
      </View>
    </GlyphSwitch>
  );
}
