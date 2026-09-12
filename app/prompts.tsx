import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WorkStage } from '../src/components/WorkStage';
import { FitBox } from '../src/components/FitBox';
import { Trough } from '../src/components/Trough';
import { PigInput } from '../src/components/PigInput';
import { PigButton } from '../src/components/PigButton';
import { LeaveButton } from '../src/components/LeaveButton';
import { useGame } from '../src/state/GameContext';
import { TIMERS } from '../src/lib/timers';
import { font, type Theme } from '../src/theme/tokens';
import { useThemedStyles } from '../src/theme/theme';
import { FONT_CAP, useUi } from '../src/theme/responsive';

// How many of your own prompts to show as chips before the oldest collapse.
const VISIBLE = 6;

// Setup: everyone drops prompts into the shared trough. It fills one step per
// prompt (a live count — enough to seed every chain of every round without
// repeats) and the game auto-starts the instant it's full.
//
// Same WorkStage frame as drawing and guessing: the pig peeks over the prompt
// input with the timer beside it, and "Add" sits where Submit does — so the
// round reads as one continuous place from here on. The trough itself is the
// focus, with your own prompts collecting as chips beneath it.
export default function Prompts() {
  const ui = useUi();
  const styles = useThemedStyles(makeStyles);
  const { addPrompt, promptCount, promptsNeeded } = useGame();
  const [mine, setMine] = useState<string[]>([]);
  const [draft, setDraft] = useState('');

  const add = () => {
    const clean = draft.trim();
    if (!clean) return;
    addPrompt(clean); // broadcasts → everyone's trough fills a step
    setMine((m) => [...m, clean]);
    setDraft('');
  };

  const hidden = Math.max(0, mine.length - VISIBLE);
  const recent = mine.slice(-VISIBLE);
  const others = Math.max(0, promptCount - mine.length);

  const chip = (text: string, you?: boolean, ghost?: boolean) => (
    <View
      key={text + (you ? '+' : '')}
      style={[
        styles.chip,
        { borderRadius: 999, paddingVertical: ui.sp(6), paddingHorizontal: ui.sp(12), gap: ui.sp(6) },
        ghost && styles.chipGhost,
      ]}
    >
      <Text
        style={[styles.chipText, { fontSize: ui.f(15) }, ghost && styles.chipGhostText]}
        maxFontSizeMultiplier={FONT_CAP}
        numberOfLines={1}
      >
        {text}
      </Text>
      {you ? (
        <Text style={[styles.you, { fontSize: ui.f(10), paddingHorizontal: ui.sp(7) }]} maxFontSizeMultiplier={FONT_CAP}>
          YOU
        </Text>
      ) : null}
    </View>
  );

  // The trough card plus chips shrink as a unit if the pane is short (portrait).
  const focus = (
    <FitBox style={styles.fill}>
      <View style={[styles.wrap, { gap: ui.sp(12) }]}>
        <Trough count={promptCount} target={promptsNeeded} />
        {mine.length > 0 || others > 0 ? (
          <View style={[styles.chips, { gap: ui.sp(8) }]}>
            {hidden > 0 ? chip(`+${hidden} earlier`, false, true) : null}
            {recent.map((p, i) => (
              <React.Fragment key={i}>{chip(p, true)}</React.Fragment>
            ))}
            {others > 0 ? chip(`+${others} from the others`, false, true) : null}
          </View>
        ) : (
          <Text style={[styles.empty, { fontSize: ui.f(14) }]} maxFontSizeMultiplier={FONT_CAP}>
            Your prompts show up here — type one and tap Add.
          </Text>
        )}
      </View>
    </FitBox>
  );

  return (
    <WorkStage
      focus={focus}
      timeLimit={TIMERS.prompts}
      top={
        <PigInput
          style={styles.fill}
          placeholder="a cat riding a skateboard…"
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={add}
          blurOnSubmit={false}
          returnKeyType="done"
          autoCapitalize="sentences"
          autoCorrect
        />
      }
      primary={<PigButton name="Add to the trough" onPress={add} />}
      footer={<LeaveButton />}
    />
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  fill: { flex: 1, width: '100%' },
  wrap: { width: '100%', alignSelf: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.chip,
    borderWidth: 1,
    borderColor: t.chipBorder,
  },
  chipGhost: { backgroundColor: 'transparent', borderStyle: 'dashed' },
  chipText: { color: t.text, fontFamily: font.medium },
  chipGhostText: { color: t.link, opacity: 0.6 },
  you: {
    color: t.accentText,
    backgroundColor: t.accent,
    fontFamily: font.bold,
    letterSpacing: 0.5,
    borderRadius: 999,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  empty: { color: t.text, opacity: 0.6, fontFamily: font.regular, textAlign: 'center' },
});
