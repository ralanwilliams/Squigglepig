import React, { useState } from 'react';
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
//
// Each try is a Text of its own (keyed by what it's measuring and at what
// size), so every one reports its layout, and only its own: words the same
// size as the last ("…" turning into a short prompt) would otherwise change
// nothing, report nothing and stay hidden, and a late report from a bigger
// try can't be read as this one's.
const LINE = 1.2;
const STEP = 0.5;

type Fit = { sig: string; size: number; done: boolean };

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
  const sig = `${width}|${max}|${min}|${lines}|${children}`;
  const [state, setState] = useState<Fit>({ sig, size: max, done: false });
  // Something changed: start over from `max`, in this render (not after it,
  // which would measure one try at the old size first).
  const fit = state.sig === sig ? state : { sig, size: max, done: false };
  if (fit !== state) setState(fit);

  const onBox = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w !== width) setWidth(w);
  };
  const onText = (e: LayoutChangeEvent) => {
    if (fit.done) return;
    const used = Math.round(e.nativeEvent.layout.height / (fit.size * LINE));
    if (used <= lines) setState({ ...fit, done: true });
    else if (fit.size - STEP >= min) setState({ ...fit, size: fit.size - STEP });
    else setState({ ...fit, size: min, done: true });
  };

  return (
    <View onLayout={onBox} style={{ alignSelf: 'stretch' }}>
      {width > 0 ? (
        <Text
          key={`${sig}|${fit.size}`}
          onLayout={onText}
          numberOfLines={fit.done ? lines : undefined}
          ellipsizeMode="tail"
          // The OS text size is left out: the box is a fixed size and the text
          // already fills it, so a larger setting would only be shrunk back.
          allowFontScaling={false}
          accessibilityLabel={accessibilityLabel}
          style={[style, { fontSize: fit.size, lineHeight: Math.round(fit.size * LINE * 10) / 10, opacity: fit.done ? 1 : 0 }]}
        >
          {children}
        </Text>
      ) : null}
    </View>
  );
}
