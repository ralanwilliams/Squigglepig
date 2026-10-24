import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { font, type Theme } from '../../../theme/tokens';
import { useThemedStyles } from '../../../theme/theme';
import { FONT_CAP, useUi } from '../../../theme/responsive';
import { playSound } from '../../../lib/sound';
import { SOUNDS } from '../../../assets/assets';
import type { Game, RoundProps } from '../index';
import { shuffleAnswers } from './questions';
import { questionsForRun } from './store';

// Multiple-choice trivia: a question, four answers, one right. Easy questions
// first, hard ones last (questions.ts PLAN). The questions come from the Open
// Trivia Database, kept on the phone between runs, with a pack of our own for
// when it can't be reached (store.ts).

type Spec = { text: string; category: string; answers: string[]; correct: number };

async function makeRun(): Promise<Spec[]> {
  return (await questionsForRun()).map((q) => ({ text: q.text, category: q.category, ...shuffleAnswers(q) }));
}

function Round({ spec, onResult, Frame }: RoundProps<Spec>) {
  const ui = useUi();
  const styles = useThemedStyles(makeStyles);
  const pick = (i: number) => onResult(i === spec.correct, `The answer was ${spec.answers[spec.correct]}.`);
  return (
    <Frame
      fitFocus
      focus={
        <View style={{ gap: ui.sp(10) }}>
          <Text style={[styles.category, { fontSize: ui.f(13) }]} maxFontSizeMultiplier={FONT_CAP}>
            {spec.category}
          </Text>
          <Text style={[styles.question, { fontSize: ui.f(22) }]} maxFontSizeMultiplier={FONT_CAP} accessibilityRole="header">
            {spec.text}
          </Text>
        </View>
      }
      controls={
        // Two by two: a long answer gets half the rail and two lines, and the
        // four take two rows instead of four.
        <View style={{ gap: ui.sp(10) }}>
          {[0, 2].map((row) => (
            <View key={row} style={[styles.row, { gap: ui.sp(10) }]}>
              {spec.answers.slice(row, row + 2).map((answer, k) => (
                <Answer key={row + k} label={answer} onPress={() => pick(row + k)} />
              ))}
            </View>
          ))}
        </View>
      }
    />
  );
}

// One answer: a card-like button (a surface, not PigButton's uppercase single
// line), since answers can run to a few words.
function Answer({ label, onPress }: { label: string; onPress: () => void }) {
  const ui = useUi();
  const styles = useThemedStyles(makeStyles);
  const press = () => {
    playSound(SOUNDS.grunt);
    onPress();
  };
  return (
    <Pressable
      accessibilityRole="button"
      onPress={press}
      style={({ pressed }) => [
        styles.answer,
        pressed && styles.pressed,
        { minHeight: ui.sp(44), paddingVertical: ui.sp(6), paddingHorizontal: ui.sp(10), borderRadius: ui.sp(8) },
      ]}
    >
      <Text style={[styles.answerText, { fontSize: ui.f(15) }]} numberOfLines={2} adjustsFontSizeToFit maxFontSizeMultiplier={FONT_CAP}>
        {label}
      </Text>
    </Pressable>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  category: { color: t.textMuted, fontFamily: font.bold, letterSpacing: 1.2, textTransform: 'uppercase', textAlign: 'center' },
  question: { color: t.text, fontFamily: font.medium, textAlign: 'center' },
  row: { flexDirection: 'row' },
  answer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.surface,
    borderWidth: Math.max(1, t.edge),
    borderColor: t.surfaceBorder,
  },
  pressed: { backgroundColor: t.surfaceInset },
  answerText: { color: t.surfaceText, fontFamily: font.medium, textAlign: 'center' },
});

export const trivia: Game<Spec> = {
  id: 'trivia',
  label: 'Trivia',
  glyph: 'help',
  blurb: 'Four answers, one right. Easy questions first, hard ones last.',
  makeRun,
  Round,
};
