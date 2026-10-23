import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PigButton } from '../../../components/PigButton';
import { Heading } from '../../../components/Heading';
import { font, type Theme } from '../../../theme/tokens';
import { useThemedStyles } from '../../../theme/theme';
import { FONT_CAP, useUi } from '../../../theme/responsive';
import { ROUNDS } from '../../engine';
import type { Game, RoundProps } from '../index';

// A test game for development builds: tap the bigger of two numbers. The
// numbers get closer every round. It exists to play the whole run (timer, pot,
// banking, payout) before a real game is built; it never ships.

type Spec = { left: number; right: number };

function makeRun(): Spec[] {
  return Array.from({ length: ROUNDS }, (_, i) => {
    const gap = Math.max(1, Math.round(40 / (i + 1)));
    const low = 10 + Math.floor(Math.random() * (89 - gap));
    return Math.random() < 0.5 ? { left: low, right: low + gap } : { left: low + gap, right: low };
  });
}

function Round({ spec, onResult, Frame }: RoundProps<Spec>) {
  const ui = useUi();
  const styles = useThemedStyles(makeStyles);
  const big = Math.max(spec.left, spec.right);
  const pick = (n: number) => onResult(n === big, `${big} was bigger`);
  return (
    <Frame
      focus={
        <View style={[styles.focus, { gap: ui.gap }]}>
          <Heading size="h3">Which is bigger?</Heading>
          <Text style={[styles.pair, { fontSize: ui.f(44) }]} maxFontSizeMultiplier={FONT_CAP}>
            {spec.left} · {spec.right}
          </Text>
        </View>
      }
      controls={
        <View style={[styles.row, { gap: ui.sp(10) }]}>
          <View style={styles.flex}>
            <PigButton name={String(spec.left)} onPress={() => pick(spec.left)} />
          </View>
          <View style={styles.flex}>
            <PigButton name={String(spec.right)} onPress={() => pick(spec.right)} />
          </View>
        </View>
      }
    />
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  focus: { alignItems: 'center', justifyContent: 'center' },
  pair: { color: t.text, fontFamily: font.bold, textAlign: 'center' },
  row: { flexDirection: 'row' },
  flex: { flex: 1 },
});

export const bigger: Game<Spec> = {
  id: 'bigger',
  label: 'Bigger number',
  glyph: 'code',
  blurb: 'Tap the bigger number. They get closer every round.',
  makeRun,
  Round,
  dev: true,
};
