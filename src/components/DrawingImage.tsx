import React, { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { canvas, layout } from '../theme/tokens';
import { STROKE, type Drawing } from './PigCanvas';

// Renders a submitted drawing (serialized vector strokes) in the original
// `.image-class` frame: white, rounded, black border. It takes the pane it is
// given and draws the largest frame of the drawing's own aspect ratio that fits,
// so a drawing looks the same on every device and orientation regardless of
// where it was drawn (and never overflows). `frameStyle` decorates the frame —
// the reveal screen uses it for the ✓/✗ ruling border.
export function DrawingImage({ data, frameStyle }: { data: string; frameStyle?: StyleProp<ViewStyle> }) {
  const [host, setHost] = useState({ w: 0, h: 0 });
  if (!data) return null;
  let drawing: Drawing;
  try {
    drawing = JSON.parse(data);
  } catch {
    return null;
  }
  const { w, h, strokes } = drawing;

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== host.w || height !== host.h) setHost({ w: width, h: height });
  };
  const aspect = w > 0 && h > 0 ? w / h : 4 / 3;
  let fw = host.w;
  let fh = fw / aspect;
  if (fh > host.h) {
    fh = host.h;
    fw = fh * aspect;
  }

  return (
    <View style={styles.host} onLayout={onLayout}>
      {host.w > 0 && host.h > 0 ? (
        <View style={[styles.frame, { width: Math.round(fw), height: Math.round(fh) }, frameStyle]}>
          <Svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet">
            {strokes.map((d, i) => (
              <Path
                key={i}
                d={d}
                stroke={canvas.ink}
                strokeWidth={STROKE}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </Svg>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1, minHeight: 0, width: '100%', alignItems: 'center', justifyContent: 'center' },
  frame: {
    backgroundColor: canvas.fill,
    borderRadius: layout.imageRadius,
    borderWidth: 1,
    borderColor: canvas.border,
    overflow: 'hidden',
  },
});
