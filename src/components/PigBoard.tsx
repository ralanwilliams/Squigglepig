import React, { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Logo } from './Logo';
import { IMAGES } from '../assets/assets';
import { useUi } from '../theme/responsive';
import { useTheme } from '../theme/theme';
import type { Placement } from '../theme/skins';
import { HAT_ROOM } from '../theme/skins/layout';

// The whole pig (Home's art, its wordmark cut off as on the reward podium),
// the player's own wearing what their pig has on its head (Logo.tsx),
// standing behind a board it holds up with `children` on it: the board from
// just under its chin, over its arms, so its head shows above and its belly
// and legs below, its hooves over the board's top edge. The board fits what's
// on it and grows downward, never shorter than the pig's arms. Trivia's
// question goes on it.
//
// The board is a whiteboard like the join art's sign, never themed (write on
// it in BOARD_INK), outlined in the art's black, or on the dark palette in
// the light rim the dark art has (SkinDecor's RIM_COLOR).
//
// Everything is in fractions of the pig's width (pw), from the art: the
// pig is 70% of the board's width, its body centred on it, so its window's
// left edge is PIG_LEFT of pw in.

export const BOARD_INK = { text: '#1A1A1A', muted: '#5C5C5C' };
const BOARD = { fill: '#F2F2F0', inner: '#D9D9D6', line: '#1A1A1A', rim: '#E6EDEE' };

const MAX_W = 380; // the board's widest, base dp
const PIG = 0.7; // the pig's width, of the board's
// Home's pig and its tail, short of the wordmark, with room above it for the
// tallest hat (layout.ts HAT_ROOM), so nothing on its head is cut off.
const HEADROOM = HAT_ROOM;
const WINDOW = { x: 0, y: -HEADROOM, w: 634 / 954, h: 1 + HEADROOM };
const ART_H = 900 / 634; // the art's height, of pw
const PIG_H = WINDOW.h * ART_H; // the window's height, of pw
const below = (y: number) => (y + HEADROOM) * ART_H; // from the window's top down to `y` (of the art's height), of pw
const PIG_LEFT = (1 / PIG - 1) / 2 + 0.05; // nudged right: the tail is in the window, so its body is left of centre
const TOP_Y = 0.42; // the board's top edge, of the art's height: just under the chin
const TOP = below(TOP_Y);
const MIN_H = 0.31 * ART_H; // down past the hooves at its belly

// Its hooves over the board's edge: the peeking pig's own (canvas_pig.png,
// x 100–160 and 553–613, y 262–363), a little bigger than this pig's scale
// so they read. Each stands just outside the side of its face (13% and 80%
// across it at the board's edge), its inside edge only grazing it, leaning
// out 16° from where it goes behind the board, which hides its lower third.
const HOOF = { w: 0.1464, h: 0.2465, lean: 16 };
const HOOVES = [
  { x: 0.0168, window: { x: 100 / 737, y: 262 / 363, w: 60 / 737, h: 101 / 363 }, lean: -HOOF.lean },
  { x: 0.7668, window: { x: 553 / 737, y: 262 / 363, w: 60 / 737, h: 101 / 363 }, lean: HOOF.lean },
];
const HOOF_TOP = TOP - (HOOF.h * 2) / 3;

const omitAll = () => true;
// Of the season's props, what it wears on its head. What's below the board's
// top edge is held at its belly, and behind the board would only poke out
// under it; the sky props (layout.ts dress: each bobs or twinkles) are off
// to the side, where the window would cut them in half, and crowd its hooves.
const hatOnly = (p: Placement) => p.y > TOP_Y || !!p.bob || !!p.twinkle;

export function PigBoard({ children }: { children: React.ReactNode }) {
  const ui = useUi();
  const t = useTheme();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w !== width) setWidth(w);
  };
  const bw = Math.min(width, ui.sp(MAX_W));
  const pw = bw * PIG;
  const at = (n: number) => Math.round(n * pw);
  return (
    <View style={styles.host} onLayout={onLayout}>
      {bw > 0 ? (
        <View style={{ width: bw, minHeight: at(PIG_H) }}>
          <View style={[styles.abs, { left: at(PIG_LEFT), width: at(1), height: at(PIG_H), overflow: 'hidden' }]}>
            <Logo source={IMAGES.home} window={WINDOW} omit={hatOnly} headOnly />
          </View>
          {HOOVES.map((h) => (
            <View
              key={h.x}
              style={[
                styles.abs,
                {
                  left: at(PIG_LEFT + h.x),
                  top: at(HOOF_TOP),
                  width: at(HOOF.w),
                  height: at(HOOF.h),
                  overflow: 'hidden',
                  transformOrigin: '50% 66.7%',
                  transform: [{ rotate: `${h.lean}deg` }],
                },
              ]}
            >
              <Logo source={IMAGES.canvasPig} window={h.window} omit={omitAll} avatar={null} />
            </View>
          ))}
          <View
            style={[
              styles.board,
              {
                marginTop: at(TOP),
                minHeight: at(MIN_H),
                gap: ui.sp(4),
                paddingVertical: ui.sp(10),
                paddingHorizontal: ui.sp(14),
                borderRadius: ui.sp(12),
                borderWidth: ui.sp(3),
                borderColor: t.name === 'dark' ? BOARD.rim : BOARD.line,
              },
            ]}
          >
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.inner, { borderRadius: ui.sp(9), borderWidth: ui.sp(4) }]} />
            {children}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { width: '100%', alignItems: 'center' },
  abs: { position: 'absolute', top: 0 },
  board: { backgroundColor: BOARD.fill, justifyContent: 'center' },
  inner: { borderColor: BOARD.inner },
});
