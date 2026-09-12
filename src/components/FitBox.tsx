import React, { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

// Never scroll, never clip: content that is taller than the box it was given is
// scaled down (as one unit) until it fits, and content that is shorter is
// centred so the slack becomes breathing room. Used for every pane whose
// content can vary — rosters, score lists, long prompts, the help text.
//
// The box must have a bounded height (flex: 1 or an explicit height) because
// the content is laid out absolutely so it can be measured at its natural size.
// Transforms don't affect layout in RN, so the measured height stays natural
// and there is no feedback loop.

const MIN_SCALE = 0.45; // below this it's unreadable anyway; clip instead

export function FitBox({
  children,
  style,
  align = 'center',
  minContentH,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  // 'center' shares the slack above and below; 'top' pins content to the top
  // so elements keep the same position from one screen to the next.
  align?: 'center' | 'top';
  // Scale as if the content were at least this tall. Sibling screens that share
  // a layout pass the taller one's height so they pick the same scale.
  minContentH?: number;
}) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [contentH, setContentH] = useState(0);

  const onBox = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== box.w || height !== box.h) setBox({ w: width, h: height });
  };
  const onContent = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (Math.abs(h - contentH) > 0.5) setContentH(h);
  };

  const effectiveH = Math.max(contentH, minContentH ?? 0);
  const scale = box.h > 0 && effectiveH > 0 ? Math.max(MIN_SCALE, Math.min(1, box.h / effectiveH)) : 1;
  const top = align === 'top' ? 0 : Math.max(0, (box.h - contentH * scale) / 2);

  return (
    <View style={[styles.box, style]} onLayout={onBox}>
      {box.w > 0 ? (
        <View
          onLayout={onContent}
          style={[
            styles.content,
            { width: box.w, top, opacity: contentH ? 1 : 0, transform: [{ scale }] },
          ]}
        >
          {children}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: 'hidden', minHeight: 0 },
  content: { position: 'absolute', left: 0, transformOrigin: 'top center' },
});
