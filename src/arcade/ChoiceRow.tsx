import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { font } from '../theme/tokens';
import { FONT_CAP, useUi } from '../theme/responsive';
import { useFieldColors } from './fieldColors';

// A short row of choices on a full-screen game's chip (FieldFrame.tsx), in
// the field's look (fieldColors.ts): "Play time  Off 10 15 20 30 min", the
// one chosen filled amber, the others outlined. A tap chooses (`onChange`),
// the one already chosen too (the endless hunt's play time starts over). It
// wraps onto a second line rather than squeeze, at a large font.
export type Choice = { value: number; label: string; spoken?: string };

export function ChoiceRow({
  label,
  unit,
  choices,
  value,
  onChange,
}: {
  label: string;
  unit?: string; // after the choices ("min")
  choices: Choice[];
  value: number;
  onChange: (v: number) => void;
}) {
  const ui = useUi();
  const fc = useFieldColors();
  const words = [styles.words, { color: fc.muted, fontSize: ui.f(11) }];
  return (
    <View style={[styles.row, { gap: ui.sp(4), rowGap: ui.sp(4) }]} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Text style={[words, { marginRight: ui.sp(2) }]} maxFontSizeMultiplier={FONT_CAP} numberOfLines={1}>
        {label}
      </Text>
      {choices.map((c) => {
        const on = c.value === value;
        return (
          <Pressable
            key={c.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={c.spoken ?? c.label}
            onPress={() => onChange(c.value)}
            hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
            style={[
              styles.choice,
              { minHeight: ui.sp(24), minWidth: ui.sp(30), paddingHorizontal: ui.sp(7) },
              on ? { backgroundColor: fc.amber, borderColor: fc.amber } : { borderColor: fc.line },
            ]}
          >
            <Text
              style={[on ? styles.on : styles.off, { color: on ? fc.amberText : fc.text, fontSize: ui.f(12) }]}
              maxFontSizeMultiplier={FONT_CAP}
              numberOfLines={1}
            >
              {c.label}
            </Text>
          </Pressable>
        );
      })}
      {unit ? (
        <Text style={[words, { marginLeft: ui.sp(1) }]} maxFontSizeMultiplier={FONT_CAP} numberOfLines={1}>
          {unit}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' },
  words: { fontFamily: font.regular },
  choice: { alignItems: 'center', justifyContent: 'center', borderRadius: 999, borderWidth: 1.5 },
  on: { fontFamily: font.bold },
  off: { fontFamily: font.medium },
});
