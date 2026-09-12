import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stage } from '../src/components/Stage';
import { Logo } from '../src/components/Logo';
import { Countdown, deadlineIn } from '../src/components/Countdown';
import { PigButton } from '../src/components/PigButton';
import { LeaveButton } from '../src/components/LeaveButton';
import { IMAGES } from '../src/assets/assets';
import { useGame } from '../src/state/GameContext';
import { TIMERS } from '../src/lib/timers';
import { font, type Theme } from '../src/theme/tokens';
import { useThemedStyles } from '../src/theme/theme';
import { FONT_CAP, useUi } from '../src/theme/responsive';

// Round 1: you're shown the prompt of the chain you OWN. You don't draw it —
// everyone else does — but you'll be the judge of this chain at scoring. Read it,
// then tap to move on to drawing everyone else's prompts.
export default function RoundOne() {
  const ui = useUi();
  const styles = useThemedStyles(makeStyles);
  const { prev, readyView } = useGame();
  const text = prev && prev.kind !== 'drawing' ? prev.text : '';

  // Fixed once per screen: Stage rebuilds its panes (remounting the Countdown)
  // when the layout flips between one and two panes, and the clock must not
  // restart when the phone turns.
  const [until] = useState(() => deadlineIn(TIMERS.view));
  const expired = useRef(false);
  const expire = () => {
    if (expired.current) return;
    expired.current = true;
    readyView();
  };

  const focus = <Logo source={IMAGES.lobby} />;

  const actions = (
    <>
      <Countdown seconds={TIMERS.view} until={until} onExpire={expire} />
      <Text style={[styles.label, { fontSize: ui.f(12) }]} maxFontSizeMultiplier={FONT_CAP}>
        YOUR CHAIN — YOU'LL JUDGE THIS ONE
      </Text>
      <View
        style={[
          styles.card,
          { borderRadius: ui.sp(8), paddingVertical: ui.sp(18), paddingHorizontal: ui.sp(16) },
        ]}
      >
        <Text
          style={[styles.prompt, { fontSize: ui.f(22) }]}
          maxFontSizeMultiplier={FONT_CAP}
          numberOfLines={3}
          adjustsFontSizeToFit
        >
          {text || '…'}
        </Text>
      </View>
      <PigButton name="Got it — let's draw!" onPress={readyView} />
      <LeaveButton />
    </>
  );

  return <Stage focus={focus} actions={actions} />;
}

const makeStyles = (t: Theme) => StyleSheet.create({
  label: {
    color: t.accent,
    fontFamily: font.bold,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  card: { backgroundColor: t.overlay },
  prompt: { color: t.overlayText, fontFamily: font.medium, textAlign: 'center' },
});
