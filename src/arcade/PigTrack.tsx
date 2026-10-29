import React from 'react';
import { Animated, Image, StyleSheet, View } from 'react-native';
import { IMAGES } from '../assets/assets';
import { useTheme } from '../theme/theme';
import { useUi } from '../theme/responsive';
import { useFieldColors } from './fieldColors';

// The slider's track, shared by the pot ladder (PotLadder.tsx) and the
// endless hunt's difficulty meter (DifficultyMeter.tsx): a thin rail filled
// as far as `at`, a tick at each of `ticks` (filled once it's `on`), and the
// app's pig face riding it at `at`, a percentage (or an animated one). Lay it
// in a box inset by half the pig, so at either end it stays inside.
//
// Its colors (useSliderColors): on Stage the theme's, on the screen's own
// background; the `field` look is for a full-screen game's chips, the
// field's cream and amber (fieldColors.ts).
export type SliderColors = {
  muted: string; // the words over and under it
  track: string;
  trackEdge: number;
  trackEdgeColor: string;
  fill: string;
  tick: string;
  tickEdge: string;
  on: string; // a tick reached
  onEdge: string;
  ring: string; // round the pig
  strong: string; // what the words call out (the tier, the difficulty)
  none: string; // a tier not yet reached
};

export function useSliderColors(look?: 'field'): SliderColors {
  const t = useTheme();
  const fc = useFieldColors();
  return look === 'field'
    ? {
        muted: fc.muted,
        track: fc.track,
        trackEdge: 0,
        trackEdgeColor: t.chipBorder,
        fill: fc.amber,
        tick: fc.tick,
        tickEdge: fc.muted,
        on: fc.amber,
        onEdge: fc.amber,
        ring: fc.amber,
        strong: fc.amber,
        none: fc.text,
      }
    : {
        muted: t.textMuted,
        track: t.chip,
        trackEdge: Math.max(1, t.edge),
        trackEdgeColor: t.chipBorder,
        fill: t.button,
        tick: t.chip,
        tickEdge: t.chipBorder,
        on: t.button,
        onEdge: t.buttonPressed,
        ring: t.buttonPressed,
        strong: t.text,
        none: t.text,
      };
}

export type Tick = { key: string; at: number; on: boolean }; // `at` a fraction of the track

export function PigTrack({ at, ticks, c }: { at: Animated.AnimatedInterpolation<string> | `${number}%`; ticks: Tick[]; c: SliderColors }) {
  const ui = useUi();
  const t = useTheme();
  const pig = ui.sp(28);
  const track = ui.sp(5);
  const tick = ui.sp(8);
  const edge = Math.max(1.5, t.edge);
  return (
    <View style={[styles.slot, { height: pig }]}>
      <View
        style={[
          styles.track,
          { height: track, borderRadius: track / 2, backgroundColor: c.track, borderWidth: c.trackEdge, borderColor: c.trackEdgeColor },
        ]}
      >
        <Animated.View style={[styles.fill, { width: at, backgroundColor: c.fill }]} />
      </View>
      {ticks.map((k) => (
        <View
          key={k.key}
          style={[
            styles.tick,
            {
              left: `${100 * k.at}%`,
              width: tick,
              height: tick,
              borderRadius: tick / 2,
              marginLeft: -tick / 2,
              borderWidth: edge,
              backgroundColor: k.on ? c.on : c.tick,
              borderColor: k.on ? c.onEdge : c.tickEdge,
            },
          ]}
        />
      ))}
      <Animated.View
        style={[
          styles.pig,
          { left: at, width: pig, height: pig, borderRadius: pig / 2, marginLeft: -pig / 2, borderWidth: edge, borderColor: c.ring, backgroundColor: t.surface },
        ]}
      >
        <Image source={IMAGES.icon} style={{ width: '100%', height: '100%' }} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { justifyContent: 'center' },
  track: { overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  tick: { position: 'absolute' },
  pig: { position: 'absolute', overflow: 'hidden' },
});
