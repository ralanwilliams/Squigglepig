import React, { useState } from 'react';
import { Image as RNImage, LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

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

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== box.w || height !== box.h) setBox({ w: width, h: height });
  };

  const meta = RNImage.resolveAssetSource(source);
  const srcW = meta?.width || 1;
  const srcH = meta?.height || 1;

  // Fit a frame of the window's aspect ratio into the pane (what "contain" would
  // do for a full-frame pig), then scale the image so the window fills that frame.
  const aspect = (window.w * srcW) / (window.h * srcH);
  let fw = box.w;
  let fh = fw / aspect;
  if (fh > box.h) {
    fh = box.h;
    fw = fh * aspect;
  }
  const iw = fw / window.w;
  const ih = fh / window.h;

  return (
    <View style={styles.host} onLayout={onLayout}>
      {box.w > 0 && box.h > 0 ? (
        <View style={[styles.frame, { width: Math.round(fw), height: Math.round(fh) }]}>
          <Image
            source={source}
            style={{
              position: 'absolute',
              left: -Math.round(window.x * iw),
              top: -Math.round(window.y * ih),
              width: Math.round(iw),
              height: Math.round(ih),
            }}
            contentFit="fill"
          />
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
