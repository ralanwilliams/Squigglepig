import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { font, type Theme } from '../theme/tokens';
import { useThemedStyles } from '../theme/theme';
import { FONT_CAP, useUi } from '../theme/responsive';

// A quiet text action ("Leave" under a run's buttons; Privacy Policy and Terms
// of Service across the foot of the menu): underlined in the link color, like
// LeaveButton, but padded and hit-slopped to a full 44dp target. `size` is the
// text size before the UI scale (14 by default); `role` is 'link' for one that
// opens a web page, so a screen reader says so; `spoken` is a fuller name for
// a short label ("Terms" → "Terms of Service"), starting with the label's own
// words so voice control still finds it by what's on screen (WCAG 2.5.3).
// `dense` packs it into a 24dp line, the least WCAG 2.2 AA allows a target
// (2.5.8), for a row of small links tight against the text around it (the
// menu's foot). Its margin reaches above and to the sides (where the phone
// allows: Android keeps taps inside the row) but not below, so it never
// takes a tap meant for the line under it.
export function TextLink({
  label,
  onPress,
  size = 14,
  role = 'button',
  spoken,
  dense,
}: {
  label: string;
  onPress: () => void;
  size?: number;
  role?: 'button' | 'link';
  spoken?: string;
  dense?: boolean;
}) {
  const ui = useUi();
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={spoken}
      onPress={onPress}
      hitSlop={dense ? { top: 8, bottom: 0, left: 6, right: 6 } : 8}
      style={({ pressed }) => [
        styles.box,
        { minHeight: ui.sp(dense ? 24 : 36), paddingVertical: ui.sp(dense ? 2 : 8), opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <Text style={[styles.text, { fontSize: ui.f(size) }]} maxFontSizeMultiplier={FONT_CAP}>
        {label}
      </Text>
    </Pressable>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
  text: { color: t.link, fontFamily: font.regular, textDecorationLine: 'underline' },
});
