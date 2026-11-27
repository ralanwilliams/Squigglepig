import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { PigCanvas } from '../src/components/PigCanvas';
import { FitText } from '../src/components/FitText';
import { LeaveButton } from '../src/components/LeaveButton';
import { useGame } from '../src/state/GameContext';
import { TIMERS } from '../src/lib/timers';
import { font, type Theme } from '../src/theme/tokens';
import { useThemedStyles } from '../src/theme/theme';
import { useUi } from '../src/theme/responsive';

// Everyone draws simultaneously, each illustrating the text (a pooled prompt on
// the first pass, or the previous player's caption after that) they were handed.
// The screen keeps the turn it opened on, so the drawing goes to that turn
// whenever it's handed in (state/game/turns.ts submitCell), and its clock is the
// game's (turnEndsAt), held while the phone catches up after a trip out of
// the app (`resuming`).
export default function Drawing() {
  const ui = useUi();
  const styles = useThemedStyles(makeStyles);
  const { submitCell, prev, turn, turnEndsAt, resuming } = useGame();
  const [myTurn] = useState(turn);
  const text = prev && 'text' in prev ? prev.text : '';

  // Fills WorkStage's fixed-height top slot (same footprint as the prompt and
  // guess inputs). Just the prompt, on up to two lines, shrinking from 16 to
  // 13 (× scale) so a 60-character one still fits readably; the canvas below
  // says what it's for, and a screen reader hears "Draw this:" first.
  const header = (
    <View style={[styles.card, { borderRadius: ui.sp(8), paddingVertical: ui.sp(4), paddingHorizontal: ui.sp(12) }]}>
      <FitText style={styles.prompt} max={ui.f(16)} min={ui.f(13)} accessibilityLabel={`Draw this: ${text}`}>
        {text || '…'}
      </FitText>
    </View>
  );

  return (
    <PigCanvas
      onSubmit={(data, closing) => submitCell(data, myTurn, closing)}
      timeLimit={TIMERS.draw}
      until={turnEndsAt}
      hold={resuming}
      header={header}
      footer={<LeaveButton />}
    />
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
  prompt: { color: t.surfaceText, fontFamily: font.medium, textAlign: 'center' },
});
