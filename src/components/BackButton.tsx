import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Glyph } from './Glyph';
import { useTheme } from '../theme/theme';
import { useUi } from '../theme/responsive';

// A ‹ in the header band's top-left corner, where Home has its ☰ (Stage keeps
// both corners clear), for the screens opened from the menu. Goes back, or
// Home if there is nothing to go back to (a reload on the web).
export function BackButton() {
  const ui = useUi();
  const theme = useTheme();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <View
      pointerEvents="box-none"
      style={[styles.corner, { top: ui.insets.top + ui.sp(5), left: ui.insets.left + ui.pad - ui.sp(9) }]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={back}
        hitSlop={6}
        style={({ pressed }) => [styles.hit, { width: ui.sp(44), height: ui.sp(44), opacity: pressed ? 0.6 : 1 }]}
      >
        <Glyph name="back" size={ui.sp(26)} color={theme.link} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  corner: { position: 'absolute', zIndex: 10 },
  hit: { alignItems: 'center', justifyContent: 'center' },
});
