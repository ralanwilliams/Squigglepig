import React, { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { Ui } from '../theme/responsive';

// A slider for a size, on a dark pill (the drawing board's brush,
// BrushPicker): a track that widens from left to right, thin to thick, lit
// up to the thumb, and a white thumb carrying whatever the caller hands in
// (`thumb`: the brush itself). Dragged or tapped along, it moves in `step`s
// from `min` to `max`, telling `onSliding` when a finger lands and lifts. To
// a screen reader it's adjustable: swiping up or down moves it a `nudge`.

const THUMB = 26; // base dp
const HALF = { thin: 1, thick: 6 }; // the track's half-height at each end, base dp

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function SizeSlider({
  value,
  min,
  max,
  step,
  nudge = step,
  onChange,
  onSliding,
  thumb,
  label,
  ui,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  nudge?: number;
  onChange: (v: number) => void;
  onSliding?: (sliding: boolean) => void;
  thumb?: React.ReactNode;
  label: string;
  ui: Ui;
}) {
  const [w, setW] = useState(0);
  const h = ui.sp(30);
  const inset = ui.sp(THUMB) / 2; // the thumb's middle never leaves the track
  const span = Math.max(1, w - inset * 2);
  const share = (clamp(value, min, max) - min) / (max - min);
  const x = inset + share * span;

  const to = (v: number) => {
    const next = clamp(Math.round(v / step) * step, min, max);
    if (next !== value) onChange(next);
  };
  const at = (px: number) => to(min + clamp((px - inset) / span, 0, 1) * (max - min));

  const drag = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .onBegin((e) => {
      onSliding?.(true);
      at(e.x);
    })
    .onUpdate((e) => at(e.x))
    .onFinalize(() => onSliding?.(false));

  const onLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    if (width !== w) setW(width);
  };

  // The track's edge at a share of the way along it.
  const half = (t: number) => ui.sp(HALF.thin + (HALF.thick - HALF.thin) * t);
  const mid = h / 2;
  const wedge = (t: number) =>
    `${inset},${mid - half(0)} ${inset + t * span},${mid - half(t)} ${inset + t * span},${mid + half(t)} ${inset},${mid + half(0)}`;

  return (
    <GestureDetector gesture={drag}>
      <View
        onLayout={onLayout}
        style={{ height: h }}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min, max, now: value, text: `${value} of ${max}` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => to(value + (e.nativeEvent.actionName === 'increment' ? nudge : -nudge))}
      >
        {w ? (
          <>
            <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
              <Polygon points={wedge(1)} fill="rgba(255, 255, 255, 0.3)" />
              <Polygon points={wedge(share)} fill="#ffffff" />
            </Svg>
            <View
              pointerEvents="none"
              style={[
                styles.thumb,
                { width: ui.sp(THUMB), height: ui.sp(THUMB), borderRadius: ui.sp(THUMB) / 2, left: x - ui.sp(THUMB) / 2, top: mid - ui.sp(THUMB) / 2 },
              ]}
            >
              {thumb}
            </View>
          </>
        ) : null}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  thumb: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOpacity: 0.4,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
});
