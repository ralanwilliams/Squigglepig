import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PigCanvas } from '../src/components/PigCanvas';
import { LeaveButton } from '../src/components/LeaveButton';
import { useGame } from '../src/state/GameContext';
import { font, type Theme } from '../src/theme/tokens';
import { useThemedStyles } from '../src/theme/theme';
import { FONT_CAP, useUi } from '../src/theme/responsive';

// Everyone draws simultaneously, each illustrating the text (a pooled prompt on
// the first pass, or the previous player's caption after that) they were handed.
// The screen keeps the turn it opened on, so the drawing goes to that turn
// whenever it's handed in (GameContext submitCell), and its clock is the
// game's (turnEndsAt).
export default function Drawing() {
  const ui = useUi();
  const styles = useThemedStyles(makeStyles);
<<<<<<< Updated upstream
  const { submitCell, prev, turn, turnEndsAt } = useGame();
  const [myTurn] = useState(turn);
=======
  const { submitCell, prev, stageEndsAt } = useGame();
>>>>>>> Stashed changes
  const text = prev && 'text' in prev ? prev.text : '';

  // Fills WorkStage's fixed-height top slot (same footprint as the guess input),
  // so a long prompt shrinks to fit rather than pushing the buttons down.
  const header = (
    <View
      style={[
        styles.card,
        { borderRadius: ui.sp(8), paddingVertical: ui.sp(6), paddingHorizontal: ui.sp(12), gap: ui.sp(2) },
      ]}
    >
      <Text style={[styles.label, { fontSize: ui.f(12) }]} maxFontSizeMultiplier={FONT_CAP}>
        Draw this:
      </Text>
      <Text
        style={[styles.prompt, { fontSize: ui.f(18) }]}
        maxFontSizeMultiplier={FONT_CAP}
        numberOfLines={2}
        adjustsFontSizeToFit
      >
        {text || '…'}
      </Text>
    </View>
  );

  return (
<<<<<<< Updated upstream
    <PigCanvas
      onSubmit={(data, closing) => submitCell(data, myTurn, closing)}
      timeLimit={TIMERS.draw}
      until={turnEndsAt}
      header={header}
      footer={<LeaveButton />}
    />
=======
    <PigCanvas onSubmit={submitCell} until={stageEndsAt} header={header} footer={<LeaveButton />} />
>>>>>>> Stashed changes
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  card: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: t.surface,
    borderWidth: Math.max(1, t.edge),
    borderColor: t.surfaceBorder,
  },
  label: { color: t.textMuted, fontFamily: font.regular, textAlign: 'center' },
  prompt: { color: t.surfaceText, fontFamily: font.medium, textAlign: 'center' },
});
