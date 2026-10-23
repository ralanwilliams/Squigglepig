import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { font, type Theme } from '../theme/tokens';
import { useThemedStyles } from '../theme/theme';
import { FONT_CAP, useUi } from '../theme/responsive';
import { LADDER, ROUNDS, prizeFor } from './engine';

// The pot ladder (engine.ts LADDER) as three chips, one per prize, and how many
// rounds are won so far. A step reached is filled in the button color and
// ticked; the rest are plain chips saying how many wins they need. Told
// apart by the tick and the fill, not by color alone.
export function PotLadder({ won }: { won: number }) {
  const ui = useUi();
  const styles = useThemedStyles(makeStyles);
  const prize = LADDER.find((s) => s.prize === prizeFor(won));
  return (
    <View
      accessible
      accessibilityLabel={`${won} of ${ROUNDS} rounds won. ${prize ? `In the pot: ${prize.label.toLowerCase()} prize.` : 'Nothing in the pot yet.'}`}
      style={{ gap: ui.sp(6) }}
    >
      <Text style={[styles.count, { fontSize: ui.f(13) }]} maxFontSizeMultiplier={FONT_CAP}>
        {won} of {ROUNDS} won
      </Text>
      <View style={[styles.row, { gap: ui.sp(8) }]}>
        {LADDER.map((step) => {
          const reached = won >= step.won;
          return (
            <View
              key={step.prize}
              style={[styles.chip, reached && styles.reached, { paddingVertical: ui.sp(6), paddingHorizontal: ui.sp(4), borderRadius: ui.sp(8) }]}
            >
              <Text style={[styles.label, reached && styles.labelOn, { fontSize: ui.f(13) }]} numberOfLines={1} maxFontSizeMultiplier={FONT_CAP}>
                {reached ? '✓ ' : ''}
                {step.label}
              </Text>
              <Text style={[styles.need, reached && styles.labelOn, { fontSize: ui.f(11) }]} numberOfLines={1} maxFontSizeMultiplier={FONT_CAP}>
                {step.won === ROUNDS ? `All ${ROUNDS}` : `${step.won} wins`}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  count: { color: t.textMuted, fontFamily: font.regular, textAlign: 'center' },
  row: { flexDirection: 'row' },
  chip: { flex: 1, alignItems: 'center', backgroundColor: t.chip, borderWidth: Math.max(1, t.edge), borderColor: t.chipBorder },
  reached: { backgroundColor: t.button, borderColor: t.buttonPressed },
  label: { color: t.text, fontFamily: font.medium },
  labelOn: { color: t.buttonText },
  need: { color: t.textMuted, fontFamily: font.regular },
});
