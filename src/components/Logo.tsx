import React, { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { assetSize } from '../lib/assetSize';
import { artFor, artName, darkInset } from '../assets/assets';
import { useTheme } from '../theme/theme';
import { SkinDecor } from './SkinDecor';

// A window into the source image, as fractions of its width/height. Used for
// assets whose pig doesn't fill the frame (the waiting GIF has a wide teal
// margin around it): the window — not the whole image — is what gets fitted
// into the pane, so the pig lands at the same size and position as the pigs
// that do fill their frames. The image is NOT clipped to the window: whatever
// lies outside it (that GIF's animated thought cloud, its teal margin) simply
// spills over the surrounding background.
export type ImageWindow = { x: number; y: number; w: number; h: number };

const FULL: ImageWindow = { x: 0, y: 0, w: 1, h: 1 };

// The brand pig. It fills whatever pane Stage gives it, preserving aspect
// ratio, so it is as large as the screen allows and never overflows — the
// pane does the sizing, not the window.
//
// `children` are rendered inside the fitted frame (the rectangle the window
// occupies on screen), so an absolutely-positioned child with percentage
// offsets lands on the same part of the pig at every screen size.
//
// On the dark palette it shows the image's dark version (assets.ts artFor),
// which has a teal border so the line art stands off the background. That
// version has a transparent margin for the border; the window is moved into
// it, so the frame (and anything in `children`) lands exactly where it does
// in light mode and the border spills just past it.
//
// In season, the skin's props are drawn over the frame (SkinDecor), under
// `children` so hotspots like the snout stay on top; any meant to peek out
// from behind the pig are drawn under the image.
export function Logo({
  source,
  window = FULL,
  children,
}: {
  source: number;
  window?: ImageWindow;
  children?: React.ReactNode;
}) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const art = artFor(source, useTheme().name === 'dark');
  const name = artName(source);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== box.w || height !== box.h) setBox({ w: width, h: height });
  };

  // The window in the shown image's own fractions (unchanged without a margin).
  const pad = darkInset(source, art);
  const { width: srcW, height: srcH } = assetSize(art);
  const win: ImageWindow = {
    x: (window.x * pad.src.width + pad.x) / srcW,
    y: (window.y * pad.src.height + pad.y) / srcH,
    w: (window.w * pad.src.width) / srcW,
    h: (window.h * pad.src.height) / srcH,
  };

  // Fit a frame of the window's aspect ratio into the pane (what "contain" would
  // do for a full-frame pig), then scale the image so the window fills that frame.
  const aspect = (win.w * srcW) / (win.h * srcH);
  let fw = box.w;
  let fh = fw / aspect;
  if (fh > box.h) {
    fh = box.h;
    fw = fh * aspect;
  }
  const iw = fw / win.w;
  const ih = fh / win.h;

  return (
    <View style={styles.host} onLayout={onLayout}>
      {box.w > 0 && box.h > 0 ? (
        <View style={[styles.frame, { width: Math.round(fw), height: Math.round(fh) }]}>
          {name ? <SkinDecor art={name} width={fw} height={fh} window={window} layer="behind" /> : null}
          <Image
            source={art}
            style={{
              position: 'absolute',
              left: -Math.round(win.x * iw),
              top: -Math.round(win.y * ih),
              width: Math.round(iw),
              height: Math.round(ih),
            }}
            contentFit="fill"
          />
          {name ? <SkinDecor art={name} width={fw} height={fh} window={window} /> : null}
          {children}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1, width: '100%', minHeight: 0, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  frame: { overflow: 'visible' },
});
