import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { font, type Theme } from '../theme/tokens';
import { useThemedStyles } from '../theme/theme';
import { FONT_CAP, useUi } from '../theme/responsive';

// A short note set apart on the background: a small uppercase label ("How to
// play") over a line or two of text, on a translucent chip panel like the
// prompt chips, so it reads as its own thing without competing with the
// buttons around it.
export function NoteCard({ label, children }: { label: string; children: React.ReactNode }) {
  const ui = useUi();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.card, { borderRadius: ui.sp(12), paddingVertical: ui.sp(10), paddingHorizontal: ui.sp(14), gap: ui.sp(4) }]}>
      <Text style={[styles.label, { fontSize: ui.f(11) }]} maxFontSizeMultiplier={FONT_CAP}>
        {label}
      </Text>
      <Text style={[styles.text, { fontSize: ui.f(16) }]} maxFontSizeMultiplier={FONT_CAP}>
        {children}
      </Text>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    card: { backgroundColor: t.chip, borderWidth: Math.max(1, t.edge), borderColor: t.chipBorder },
    label: { color: t.textMuted, fontFamily: font.bold, letterSpacing: 1.2, textTransform: 'uppercase', textAlign: 'center' },
    text: { color: t.text, fontFamily: font.medium, textAlign: 'center' },
  });
