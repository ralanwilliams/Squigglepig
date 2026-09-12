import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { font, type Theme } from '../theme/tokens';
import { useThemedStyles } from '../theme/theme';
import { FONT_CAP, useUi } from '../theme/responsive';
import { playSound } from '../lib/sound';
import { SOUNDS } from '../assets/assets';

// Reproduces the original `.btn.btn-outline-dark`: full-width flat teal button,
// whitesmoke uppercase label, darker teal when pressed. Plays the pig grunt.
// Sized from the UI scale so it stays a comfortable 44dp+ target everywhere.
export function PigButton({
  name,
  onPress,
  silent,
}: {
  name: string;
  onPress?: () => void;
  silent?: boolean;
}) {
  const ui = useUi();
  const styles = useThemedStyles(makeStyles);
  const handle = () => {
    if (!silent) playSound(SOUNDS.grunt);
    onPress?.();
  };
  return (
    <Pressable
      accessibilityRole="button"
      onPress={handle}
      style={({ pressed }) => [
        styles.btn,
        {
          minHeight: ui.sp(44),
          paddingVertical: ui.sp(10),
          paddingHorizontal: ui.sp(16),
          borderRadius: ui.sp(8),
        },
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[styles.label, { fontSize: ui.f(15) }]}
        maxFontSizeMultiplier={FONT_CAP}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {name}
      </Text>
    </Pressable>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  btn: {
    backgroundColor: t.button,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { backgroundColor: t.buttonPressed },
  label: {
    color: t.buttonText,
    fontFamily: font.medium,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
