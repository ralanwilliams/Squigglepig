import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { font, type Theme } from '../theme/tokens';
import { useThemedStyles } from '../theme/theme';
import { FONT_CAP, useUi } from '../theme/responsive';

// A quiet text action under the buttons ("Leave", "Your rewards"): underlined
// in the link color, like LeaveButton, but padded and hit-slopped to a full
// 44dp target.
export function TextLink({ label, onPress }: { label: string; onPress: () => void }) {
  const ui = useUi();
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={8}
      style={[styles.box, { minHeight: ui.sp(36), paddingVertical: ui.sp(8) }]}
    >
      <Text style={[styles.text, { fontSize: ui.f(14) }]} maxFontSizeMultiplier={FONT_CAP}>
        {label}
      </Text>
    </Pressable>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
  text: { color: t.link, fontFamily: font.regular, textDecorationLine: 'underline' },
});
