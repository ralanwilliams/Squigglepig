import React, { useEffect } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, Text, View } from 'react-native';
import { font, type Theme } from '../theme/tokens';
import { useThemedStyles } from '../theme/theme';
import { FONT_CAP, useUi } from '../theme/responsive';

// A message in a button's place: the lobby's "Need 3+ players" where Start
// Game goes, and Round 1's "Player ready" once Got it is tapped. The same
// size as a PigButton, so nothing around it moves, but recessed and muted, so
// it doesn't read as something to tap. `live` has a screen reader say it as
// it appears (a live region on Android, an announcement on iOS, like the
// toasts).
export function ButtonNote({ text, live }: { text: string; live?: boolean }) {
  const ui = useUi();
  const styles = useThemedStyles(makeStyles);
  useEffect(() => {
    if (live && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(text);
  }, [live, text]);
  return (
    <View
      accessibilityLiveRegion={live ? 'polite' : undefined}
      style={[
        styles.note,
        {
          minHeight: ui.sp(44),
          paddingVertical: ui.sp(10),
          paddingHorizontal: ui.sp(16),
          borderRadius: ui.sp(8),
        },
      ]}
    >
      <Text
        style={[styles.text, { fontSize: ui.f(15) }]}
        maxFontSizeMultiplier={FONT_CAP}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {text}
      </Text>
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  note: { width: '100%', backgroundColor: t.surfaceInset, alignItems: 'center', justifyContent: 'center' },
  text: {
    color: t.textMuted,
    fontFamily: font.medium,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
