import React from 'react';
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';
import { font, type Theme } from '../theme/tokens';
import { useTheme, useThemedStyles } from '../theme/theme';
import { FONT_CAP, useUi } from '../theme/responsive';

// Reproduces the bootstrap `.form-control` inputs: white, rounded, subtle border.
// Nothing scrolls when the keyboard opens: the window resizes (Android `resize`
// mode / iOS KeyboardAvoidingView) and the surrounding FitBox re-fits the pane,
// so the field simply stays where it is, above the keyboard.
export function PigInput(props: TextInputProps) {
  const ui = useUi();
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <TextInput
      placeholderTextColor={theme.placeholder}
      autoCapitalize="none"
      autoCorrect={false}
      maxFontSizeMultiplier={FONT_CAP}
      {...props}
      style={[
        styles.input,
        {
          minHeight: ui.sp(44),
          paddingHorizontal: ui.sp(12),
          paddingVertical: ui.sp(8),
          borderRadius: ui.sp(8),
          fontSize: ui.f(16),
        },
        props.style,
      ]}
    />
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  input: {
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.surfaceBorder,
    color: t.surfaceText,
    fontFamily: font.regular,
    textAlignVertical: 'center', // Android: keep the text centred in a taller slot
  },
});
