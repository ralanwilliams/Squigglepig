import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { font, type Theme } from '../theme/tokens';
import { useThemedStyles } from '../theme/theme';
import { FONT_CAP, useUi } from '../theme/responsive';

// A short note set apart on the background: a small uppercase label ("How to
// play") over a line or two of text, on a translucent chip panel like the
// prompt chips, so it reads as its own thing without competing with the
// buttons around it. `steps`, if given, follow the text as a numbered list,
// each number on a disc in the button color.
export function NoteCard({ label, steps, children }: { label: string; steps?: string[]; children: React.ReactNode }) {
  const ui = useUi();
  const styles = useThemedStyles(makeStyles);
  const disc = ui.sp(24);
  return (
    <View style={[styles.card, { borderRadius: ui.sp(12), paddingVertical: ui.sp(10), paddingHorizontal: ui.sp(14), gap: ui.sp(4) }]}>
      <Text style={[styles.label, { fontSize: ui.f(11) }]} maxFontSizeMultiplier={FONT_CAP}>
        {label}
      </Text>
      <Text style={[styles.text, { fontSize: ui.f(16) }]} maxFontSizeMultiplier={FONT_CAP}>
        {children}
      </Text>
      {steps?.map((step, i) => (
        <View key={step} style={[styles.step, { gap: ui.sp(10), marginTop: ui.sp(8) }]}>
          <View style={[styles.disc, { width: disc, height: disc, borderRadius: disc / 2 }]}>
            <Text style={[styles.num, { fontSize: ui.f(13) }]} maxFontSizeMultiplier={FONT_CAP}>
              {i + 1}
            </Text>
          </View>
          <Text style={[styles.stepText, { fontSize: ui.f(15) }]} maxFontSizeMultiplier={FONT_CAP}>
            {step}
          </Text>
        </View>
      ))}
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    card: { backgroundColor: t.chip, borderWidth: Math.max(1, t.edge), borderColor: t.chipBorder },
    label: { color: t.textMuted, fontFamily: font.bold, letterSpacing: 1.2, textTransform: 'uppercase', textAlign: 'center' },
    text: { color: t.text, fontFamily: font.medium, textAlign: 'center' },
    step: { flexDirection: 'row', alignItems: 'center' },
    disc: { alignItems: 'center', justifyContent: 'center', backgroundColor: t.button },
    num: { color: t.buttonText, fontFamily: font.bold },
    stepText: { flex: 1, color: t.text, fontFamily: font.regular },
  });
