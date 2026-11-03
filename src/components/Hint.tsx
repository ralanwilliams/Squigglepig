import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { font, type Theme } from '../theme/tokens';
import { useThemedStyles } from '../theme/theme';
import { FONT_CAP, useUi } from '../theme/responsive';

// A quiet line under a heading: a pointer the player may want later, such as
// where something is kept (the payout's "Your rewards are always in the ☰
// menu"). Centered, smaller than a Heading and in the muted text color. Wrap
// the words that matter in <Hint.Strong> to set them in the full text color.
export function Hint({ children }: { children: React.ReactNode }) {
  const ui = useUi();
  const styles = useThemedStyles(makeStyles);
  return (
    <Text style={[styles.hint, { fontSize: ui.f(14) }]} maxFontSizeMultiplier={FONT_CAP}>
      {children}
    </Text>
  );
}

Hint.Strong = function Strong({ children }: { children: React.ReactNode }) {
  const styles = useThemedStyles(makeStyles);
  return <Text style={styles.strong}>{children}</Text>;
};

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    hint: { color: t.textMuted, fontFamily: font.regular, textAlign: 'center' },
    strong: { color: t.text, fontFamily: font.bold },
  });
