import React, { useLayoutEffect, useState } from 'react';
import { Text, View, type LayoutChangeEvent, type StyleProp, type TextStyle } from 'react-native';

// Text that shrinks to fit a number of lines, from `max` down to `min` (both
// in final dp, already scaled), and is cut off with "…" only if it still
// doesn't fit at `min`. The same on every platform: React Native's own
// adjustsFontSizeToFit does nothing on web and ignores a floor on Android.
//
// It steps down by measuring: the text is laid out unclamped with an explicit
// line height, so its height says how many lines it took. Hidden while it
// settles (a frame or two), and it starts over from `max` when the text or the
// width it has changes.
const LINE = 1.2;
const STEP = 0.5;

export function FitText({
  children,
  max,
  min,
  lines = 2,
  style,
  accessibilityLabel,
}: {
  children: string;
  max: number;
  min: number;
  lines?: number;
  style?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
}) {
  const [width, setWidth] = useState(0);
  const [size, setSize] = useState(max);
  const [done, setDone] = useState(false);

  useLayoutEffect(() => {
    setSize(max);
    setDone(false);
  }, [children, width, max, min, lines]);

  const onBox = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w !== width) setWidth(w);
  };
  const onText = (e: LayoutChangeEvent) => {
    if (done) return;
    const used = Math.round(e.nativeEvent.layout.height / (size * LINE));
    if (used <= lines) setDone(true);
    else if (size - STEP >= min) setSize(size - STEP);
    else {
      setSize(min);
      setDone(true);
    }
  };

  return (
    <View onLayout={onBox} style={{ alignSelf: 'stretch' }}>
      {width > 0 ? (
        <Text
          onLayout={onText}
          numberOfLines={done ? lines : undefined}
          ellipsizeMode="tail"
          // The OS text size is left out: the box is a fixed size and the text
          // already fills it, so a larger setting would only be shrunk back.
          allowFontScaling={false}
          accessibilityLabel={accessibilityLabel}
          style={[style, { fontSize: size, lineHeight: Math.round(size * LINE * 10) / 10, opacity: done ? 1 : 0 }]}
        >
          {children}
        </Text>
      ) : null}
    </View>
  );
}
