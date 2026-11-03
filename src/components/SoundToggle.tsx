import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Insets, View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import { GlyphSwitch } from './GlyphSwitch';
import { useReducedMotion, useTheme } from '../theme/theme';
import { useUi } from '../theme/responsive';
import { setSoundOn, useSoundOn } from '../lib/sound';

// The sound switch: one glyph beside the dark-mode toggle
// (CornerControls.tsx), in the same color so the two read as a pair. A speaker
// with two waves; tap it and the waves fade back into the speaker, outer one
// first, and an ✕ pops in where they were. Tap again and the ✕ shrinks away
// and the waves come back out one after the other. Off silences the clips and
// the theme music, and is remembered (src/lib/sound.ts). Drawn in `color`,
// by default the theme's link color like the menu's ☰. Sized from the UI
// scale, 44dp hit target. With reduced motion it jumps straight to the other
// glyph.
const AnimatedG = Animated.createAnimatedComponent(G);

const SPEAKER = 'M3.4 9.4h3.5l4.7-4v13.2l-4.7-4H3.4z';
const WAVE_A = 'M14.6 9.4a3.6 3.6 0 0 1 0 5.2';
const WAVE_B = 'M17.4 6.6a7.4 7.4 0 0 1 0 10.8';
const CROSS = 'M-2.3 -2.3L2.3 2.3M2.3 -2.3L-2.3 2.3';
const MOUTH = { originX: 11.6, originY: 12 }; // the waves grow out of the speaker

const NO_NATIVE = { useNativeDriver: false }; // SVG attributes can't go through the native driver

export function SoundToggle({ size = 26, hitSlop, color }: { size?: number; hitSlop?: number | Insets; color?: string }) {
  const ui = useUi();
  const on = useSoundOn();
  const theme = useTheme();
  const ink = color ?? theme.link;
  // Until the saved choice has loaded, an empty box holds the slot: drawing
  // "on" first would flip to "off" at launch for a player who chose quiet.
  if (on === null) return <View style={{ width: ui.sp(44), height: ui.sp(44) }} />;
  return (
    <GlyphSwitch label="Sound" on={on} onPress={() => setSoundOn(!on)} hitSlop={hitSlop}>
      <SpeakerGlyph on={on} px={ui.sp(size)} ink={ink} />
    </GlyphSwitch>
  );
}

function SpeakerGlyph({ on, px, ink }: { on: boolean; px: number; ink: string }) {
  const reduced = useReducedMotion();
  const waveA = useRef(new Animated.Value(on ? 1 : 0)).current;
  const waveB = useRef(new Animated.Value(on ? 1 : 0)).current;
  const cross = useRef(new Animated.Value(on ? 0 : 1)).current;
  useEffect(() => {
    if (reduced) {
      waveA.setValue(on ? 1 : 0);
      waveB.setValue(on ? 1 : 0);
      cross.setValue(on ? 0 : 1);
      return;
    }
    // in: pop with a little overshoot; out: a plain quick shrink
    const grow = (v: Animated.Value, delay: number) =>
      Animated.timing(v, { toValue: 1, duration: 250, delay, easing: Easing.out(Easing.back(2)), ...NO_NATIVE });
    const shrink = (v: Animated.Value, delay: number) =>
      Animated.timing(v, { toValue: 0, duration: 180, delay, easing: Easing.in(Easing.quad), ...NO_NATIVE });
    const run = on
      ? [shrink(cross, 0), grow(waveA, 120), grow(waveB, 240)]
      : [shrink(waveB, 0), shrink(waveA, 80), grow(cross, 200)];
    run.forEach((a) => a.start());
  }, [on, reduced, waveA, waveB, cross]);

  return (
    <View>
      <Svg width={px} height={px} viewBox="0 0 24 24">
        <Path d={SPEAKER} fill={ink} stroke={ink} strokeWidth={1.4} strokeLinejoin="round" />
        <G fill="none" stroke={ink} strokeWidth={2.2} strokeLinecap="round">
          <AnimatedG opacity={waveA} scale={waveA} {...MOUTH}>
            <Path d={WAVE_A} />
          </AnimatedG>
          <AnimatedG opacity={waveB} scale={waveB} {...MOUTH}>
            <Path d={WAVE_B} />
          </AnimatedG>
          {/* Position on a plain group, scale on an inner one (see ThemeToggle's stars). */}
          <G transform="translate(18.2 12)">
            <AnimatedG scale={cross}>
              <Path d={CROSS} />
            </AnimatedG>
          </G>
        </G>
      </Svg>
    </View>
  );
}
