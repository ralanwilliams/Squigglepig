import React, { useEffect, useReducer, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Strokes } from '../../../components/DrawingArt';
import { SPACE, STROKE } from '../../../lib/drawing';
import { useUi } from '../../../theme/responsive';
import { canvas as paper, layout } from '../../../theme/tokens';

// The game's drawing surface: PigCanvas (src/components/PigCanvas.tsx) cut
// down to one finger and black ink, no zoom, no brushes, no stickers, and
// none of WorkStage's timer or buttons; the round has its own. Strokes are in
// drawing units and built the same way, so score.ts reads them like the pack's.
// The round keeps the finished strokes (for Undo, Clear and the score); the
// pad only holds the one under the finger.

type Pt = { x: number; y: number };

const ASPECT = SPACE.w / SPACE.h;
// Points closer than this (units) to the previous one are touch jitter.
const MIN_STEP = 1;

// Largest 4:3 rectangle that fits in a box, as DrawingImage draws the
// flashed drawing: the pad is the same size, in the same place.
const fitAspect = (box: { w: number; h: number }) => {
  if (!box.w || !box.h) return { w: 0, h: 0 };
  let w = box.w;
  let h = w / ASPECT;
  if (h > box.h) {
    h = box.h;
    w = h * ASPECT;
  }
  return { w: Math.round(w), h: Math.round(h) };
};

const px = (n: number) => n.toFixed(1);

export function DrawPad({ strokes, onStroke }: { strokes: string[]; onStroke: (d: string) => void }) {
  const ui = useUi();
  const [host, setHost] = useState({ w: 0, h: 0 });
  const size = fitAspect(host);
  const scale = useRef(1);
  scale.current = size.w ? size.w / SPACE.w : 1;
  const onStrokeRef = useRef(onStroke);
  onStrokeRef.current = onStroke;

  // The stroke under the finger, as PigCanvas builds it: each point is the
  // control of a quadratic ending halfway to the next, for a smooth line.
  const live = useRef<{ d: string; last: Pt; moved: boolean } | null>(null);
  const [, force] = useReducer((n) => n + 1, 0);
  const frame = useRef<number | null>(null);
  const schedule = () => {
    if (frame.current != null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      force();
    });
  };
  useEffect(
    () => () => {
      if (frame.current != null) cancelAnimationFrame(frame.current);
    },
    []
  );

  const toUnits = (x: number, y: number): Pt => ({ x: x / scale.current, y: y / scale.current });

  // A tap that never moved is a dot.
  const commit = () => {
    const s = live.current;
    if (!s) return;
    live.current = null;
    const { x, y } = s.last;
    onStrokeRef.current(s.moved ? `${s.d} L ${px(x)} ${px(y)}` : `${s.d} L ${px(x + 0.1)} ${px(y)}`);
  };

  const draw = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .maxPointers(1)
    .onBegin((e) => {
      const p = toUnits(e.x, e.y);
      live.current = { d: `M ${px(p.x)} ${px(p.y)}`, last: p, moved: false };
      schedule();
    })
    .onUpdate((e) => {
      const s = live.current;
      if (!s) return;
      const p = toUnits(e.x, e.y);
      if (Math.abs(p.x - s.last.x) < MIN_STEP && Math.abs(p.y - s.last.y) < MIN_STEP) return;
      s.d += ` Q ${px(s.last.x)} ${px(s.last.y)} ${px((s.last.x + p.x) / 2)} ${px((s.last.y + p.y) / 2)}`;
      s.last = p;
      s.moved = true;
      schedule();
    })
    .onFinalize(commit);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== host.w || height !== host.h) setHost({ w: width, h: height });
  };

  return (
    <View style={styles.host} onLayout={onLayout}>
      <View style={[styles.frame, { width: size.w, height: size.h, borderRadius: ui.sp(layout.imageRadius) }]}>
        <GestureDetector gesture={draw}>
          <Svg width={size.w} height={size.h} viewBox={`0 0 ${SPACE.w} ${SPACE.h}`}>
            <Strokes strokes={strokes} width={STROKE} />
            {live.current ? (
              <Path d={live.current.d} stroke={paper.ink} strokeWidth={STROKE} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            ) : null}
          </Svg>
        </GestureDetector>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1, minHeight: 0, minWidth: 0, width: '100%', alignItems: 'center', justifyContent: 'center' },
  frame: { borderWidth: 1, borderColor: paper.border, overflow: 'hidden', backgroundColor: paper.fill },
});
