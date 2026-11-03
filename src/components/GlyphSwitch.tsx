import React from 'react';
import { Insets, Pressable, StyleSheet } from 'react-native';
import { useUi } from '../theme/responsive';

// A switch that's only a glyph: a 44dp hit box (the minimum tap target, sized
// from the UI scale) that dims while pressed and tells a screen reader its
// state. The light / dark and sound switches in the top-right corner
// (CornerControls.tsx) are both one; the glyph is the caller's.
export function GlyphSwitch({
  label,
  on,
  onPress,
  hitSlop = 6,
  children,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
  hitSlop?: number | Insets;
  children: React.ReactNode;
}) {
  const ui = useUi();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: on }}
      onPress={onPress}
      hitSlop={hitSlop}
      style={({ pressed }) => [styles.hit, { width: ui.sp(44), height: ui.sp(44), opacity: pressed ? 0.6 : 1 }]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: { alignItems: 'center', justifyContent: 'center' },
});
