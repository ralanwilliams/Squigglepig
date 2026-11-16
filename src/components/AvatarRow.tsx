import React, { useState } from 'react';
import { LayoutChangeEvent, ScrollView, StyleSheet, View } from 'react-native';

// A row of players' avatars that always fits its pane cleanly: each one as
// big as the pane's height allows (up to `maxH`), all of them centred when
// they fit; when they don't, smaller, down to `minH`; and past that, at
// `minH`, the row scrolls sideways, the next one peeking in at the edge so
// it's plain there are more. Nothing spills over what's around it. The
// prompts screen's pigs (PigRoster) and the scoreboard's tied winners.
//
// `aspect` is one avatar's width over its height and `below` the height of
// what goes under each (a name), which doesn't grow with it; `maxH` and
// `minH` are for the avatar alone. `gap` is the space between them, and
// `item(i, size)` draws the i-th, its avatar `size` and what's under it.
export function AvatarRow({
  count,
  aspect,
  maxH,
  minH,
  gap,
  below = 0,
  item,
  label,
}: {
  count: number;
  aspect: number;
  maxH: number;
  minH: number;
  gap: number;
  below?: number;
  item: (i: number, size: { w: number; h: number }) => React.ReactNode;
  label?: string;
}) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (Math.abs(width - box.w) > 0.5 || Math.abs(height - box.h) > 0.5) setBox({ w: width, h: height });
  };

  // As tall as the pane lets it be, then as wide as the row lets every one be.
  const tallest = Math.max(0, Math.min(maxH, box.h - below));
  const widest = count ? (box.w - gap * (count - 1)) / count : 0;
  let h = Math.max(Math.min(minH, tallest), Math.min(tallest, widest / aspect));
  let w = h * aspect;
  const scrolls = count * w + gap * (count - 1) > box.w + 0.5;
  // Scrolling: a little bigger, so the last one in view is cut in half at
  // the edge, never just fitting (a row that ends cleanly looks like all of them).
  if (scrolls && w > 0) {
    const whole = Math.max(1, Math.floor((box.w + gap) / (w + gap) - 0.5));
    w = (box.w - whole * gap) / (whole + 0.5);
    h = Math.min(tallest, w / aspect);
    w = h * aspect;
  }

  return (
    // No taller than its tallest row, so whatever sits above and below it
    // stays close by in a tall pane.
    <View style={[styles.fill, { maxHeight: maxH + below }]} onLayout={onLayout} accessibilityLabel={label}>
      {box.w > 0 && h > 0 ? (
        <ScrollView
          horizontal
          scrollEnabled={scrolls}
          showsHorizontalScrollIndicator={scrolls}
          contentContainerStyle={[styles.row, { gap, minWidth: box.w }]}
        >
          {Array.from({ length: count }, (_, i) => (
            <View key={i} style={{ width: w, height: h + below }}>
              {item(i, { w, h })}
            </View>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, minHeight: 0, width: '100%' },
  // Centred when they fit; from the start when the row scrolls.
  row: { flexGrow: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end' },
});
