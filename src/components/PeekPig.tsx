import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { SkinDecor } from './SkinDecor';
import { avatarDecor, useMyAvatar } from '../avatar/avatar';
import { IMAGES, artFor, darkInset } from '../assets/assets';
import { assetSize } from '../lib/assetSize';
import { useTheme } from '../theme/theme';

// The pig peeking up from behind something (canvas_pig.png): its head, and
// its hoof tips over the edge. Whatever it peeks over is drawn after it, so
// it covers the bottom of the art and only the tips come over. In season it
// wears the skin's hat, with the sky props round it (SkinDecor); it holds
// nothing. It's the player's pig, so it wears what their pig has on its head
// (src/avatar: a hat, sunglasses), in place of the season's. On the dark
// palette it's the art's dark version, its margin
// hanging outside the box (assets.ts darkInset), so the pig lands where the
// light one does.
//
// Drawn over the drawing screen's card and the guess box (WorkStage.tsx),
// and over the pad in Draw from memory (PeekOver, below).

const size = assetSize(IMAGES.canvasPig);
export const PEEK_PIG_ASPECT = size.width / size.height;

// The pig's height at `width`, as it's drawn.
export const peekPigHeight = (width: number) => Math.round(width / PEEK_PIG_ASPECT);

export function PeekPig({ width }: { width: number }) {
  const height = peekPigHeight(width);
  const art = artFor(IMAGES.canvasPig, useTheme().name === 'dark');
  const pad = darkInset(IMAGES.canvasPig, art);
  const mine = useMyAvatar();
  const { omit, extra } = useMemo(() => avatarDecor(mine, 'canvasPig', true), [mine]);
  return (
    <View style={{ width, height }}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <SkinDecor art="canvasPig" width={width} height={height} layer="behind" omit={omit} extra={extra} />
      </View>
      <Image
        source={art}
        style={{
          width: width * (pad.width / pad.src.width),
          height: height * (pad.height / pad.src.height),
          // The dark version's margin (for its border) hangs outside the pig's box.
          marginLeft: -width * (pad.x / pad.src.width),
          marginTop: -height * (pad.y / pad.src.height),
        }}
        contentFit="fill"
      />
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <SkinDecor art="canvasPig" width={width} height={height} omit={omit} extra={extra} />
      </View>
    </View>
  );
}

// A 4:3 pad (a drawing, the drawing pad) with the pig peeking over its top
// edge toward the left, as on the drawing screen: half the pad's width, in
// from its left edge by INSET of it, its hoof tips over the edge. It takes
// the pane it's given and draws the largest pad that fits with the pig above
// it, the two centred together; `children` fill the pad's box exactly, so
// anything that fits a 4:3 frame into its box (DrawingImage, DrawPad) lands
// on it.
const SHARE = 0.5; // the pig's width, of the pad's
const INSET = 0.06; // how far in from the pad's left edge
const OVERLAP = 0.028; // how far the pad covers the pig's hooves, of the pad's width
const PAD = 3 / 4; // the pad's height, of its width (drawing.ts SPACE)
const PEEK = SHARE / PEEK_PIG_ASPECT - OVERLAP; // the pig above the pad, of its width

export function PeekOver({ children }: { children: React.ReactNode }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== box.w || height !== box.h) setBox({ w: width, h: height });
  };
  const w = Math.floor(Math.min(box.w, box.h / (PAD + PEEK)));
  const pigW = Math.round(w * SHARE);
  const top = peekPigHeight(pigW) - Math.round(w * OVERLAP);
  return (
    <View style={styles.host} onLayout={onLayout}>
      {w > 0 ? (
        <View style={{ width: w, height: top + Math.round(w * PAD) }}>
          <View style={[styles.pig, { left: Math.round(w * INSET) }]}>
            <PeekPig width={pigW} />
          </View>
          <View style={[styles.pad, { top, width: w, height: Math.round(w * PAD) }]}>{children}</View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1, minHeight: 0, minWidth: 0, width: '100%', alignItems: 'center', justifyContent: 'center' },
  pig: { position: 'absolute', top: 0 },
  pad: { position: 'absolute', left: 0 },
});
