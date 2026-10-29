import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { font, verdict, type Theme } from '../../../theme/tokens';
import { useThemedStyles } from '../../../theme/theme';
import { FONT_CAP, useUi } from '../../../theme/responsive';
import { BOARD_INK, PigBoard } from '../../../components/PigBoard';
import { playSound } from '../../../lib/sound';
import { SOUNDS } from '../../../assets/assets';
import type { Game, RoundProps } from '../index';
import { shuffleAnswers } from './questions';
import { questionsForRun } from './store';

// Multiple-choice trivia: a question, four answers, one right. Easy questions
// first, hard ones last (questions.ts PLAN). The pig holds the question up
// on a board (PigBoard.tsx). The questions come from the Open
// Trivia Database, kept on the phone between runs, with a pack of our own for
// when it can't be reached (store.ts).
//
// Once an answer is picked the answers lock and say how it went: the right
// one green with a ✓, a wrong pick red with a ✗ (the verdict colors, told
// apart by the mark), the rest faded. Out of time with none picked, the right
// one is marked the same way. A right answer leaves the question up, with
// the run's choice over it at a new tier (keep going, or bank it, on a card:
// RunShell.tsx), else for a moment before the next round; a lost round
// leaves it up under the news, on the same card.

type Spec = { text: string; category: string; answers: string[]; correct: number };

async function makeRun(): Promise<Spec[]> {
  return (await questionsForRun()).map((q) => ({ text: q.text, category: q.category, ...shuffleAnswers(q) }));
}

function Round({ spec, onResult, Frame, ended }: RoundProps<Spec>) {
  const ui = useUi();
  const styles = useThemedStyles(makeStyles);
  const [picked, setPicked] = useState<number | null>(null);
  const pick = (i: number) => {
    if (picked !== null || ended) return;
    setPicked(i);
    onResult(i === spec.correct, `The answer was ${spec.answers[spec.correct]}.`);
  };
  const mark = (i: number) => (picked === null && !ended ? undefined : i === spec.correct ? 'right' : i === picked ? 'wrong' : 'other');
  return (
    <Frame
      fitFocus
      focus={
        <PigBoard>
          <Text style={[styles.category, { fontSize: ui.f(13) }]} maxFontSizeMultiplier={FONT_CAP}>
            {spec.category}
          </Text>
          <Text style={[styles.question, { fontSize: ui.f(24) }]} maxFontSizeMultiplier={FONT_CAP} accessibilityRole="header">
            {spec.text}
          </Text>
        </PigBoard>
      }
      controls={
        // Two by two: a long answer gets half the rail and two lines, and the
        // four take two rows instead of four.
        <View style={{ gap: ui.sp(10) }}>
          {[0, 2].map((row) => (
            <View key={row} style={[styles.row, { gap: ui.sp(10) }]}>
              {spec.answers.slice(row, row + 2).map((answer, k) => (
                <Answer key={row + k} label={answer} mark={mark(row + k)} onPress={() => pick(row + k)} />
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
// Once one is picked (`mark` set) none can be pressed again.
function Answer({ label, mark, onPress }: { label: string; mark?: 'right' | 'wrong' | 'other'; onPress: () => void }) {
  const ui = useUi();
  const styles = useThemedStyles(makeStyles);
  const press = () => {
    playSound(SOUNDS.grunt);
    onPress();
  };
  const sign = mark === 'right' ? '✓ ' : mark === 'wrong' ? '✗ ' : '';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={mark === 'right' ? `${label}, the right answer` : mark === 'wrong' ? `${label}, wrong` : label}
      accessibilityState={{ disabled: !!mark }}
      disabled={!!mark}
      onPress={press}
      style={({ pressed }) => [
        styles.answer,
        pressed && styles.pressed,
        mark === 'right' && styles.right,
        mark === 'wrong' && styles.wrong,
        mark === 'other' && styles.other,
        { minHeight: ui.sp(44), paddingVertical: ui.sp(6), paddingHorizontal: ui.sp(10), borderRadius: ui.sp(8) },
      ]}
    >
      <Text
        style={[styles.answerText, (mark === 'right' || mark === 'wrong') && styles.markedText, { fontSize: ui.f(15) }]}
        numberOfLines={2}
        adjustsFontSizeToFit
        maxFontSizeMultiplier={FONT_CAP}
      >
        {sign}
        {label}
      </Text>
    </Pressable>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  // On the board, which is never themed.
  category: { color: BOARD_INK.muted, fontFamily: font.bold, letterSpacing: 1.2, textTransform: 'uppercase', textAlign: 'center' },
  question: { color: BOARD_INK.text, fontFamily: font.medium, textAlign: 'center' },
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
  right: { backgroundColor: verdict.yes, borderColor: verdict.yes },
  wrong: { backgroundColor: verdict.no, borderColor: verdict.no },
  other: { opacity: 0.5 },
  answerText: { color: t.surfaceText, fontFamily: font.medium, textAlign: 'center' },
  markedText: { color: verdict.mark, fontFamily: font.bold },
});

export const trivia: Game<Spec> = {
  id: 'trivia',
  label: 'Trivia',
  glyph: 'help',
  blurb: 'The further you go, the harder it gets.',
  makeRun,
  Round,
};
