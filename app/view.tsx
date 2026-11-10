import React, { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stage } from '../src/components/Stage';
import { Logo } from '../src/components/Logo';
import { Countdown, useDeadline } from '../src/components/Countdown';
import { PigButton } from '../src/components/PigButton';
import { ButtonNote } from '../src/components/ButtonNote';
import { LeaveButton } from '../src/components/LeaveButton';
import { IMAGES } from '../src/assets/assets';
import { useGame } from '../src/state/GameContext';
import { TIMERS } from '../src/lib/timers';
import { font, type Theme } from '../src/theme/tokens';
import { useThemedStyles } from '../src/theme/theme';
import { FONT_CAP, useUi } from '../src/theme/responsive';

// Round 1: you're shown the prompt of the chain you OWN. You don't draw it —
// everyone else does — but you'll be the judge of this chain at scoring. Read
// it, then tap Got it: the button turns into Player ready, the prompt stays
// up, and once everyone in the round is ready (or the clock runs out) the
// drawing starts for all of you at once.
export default function RoundOne() {
  const ui = useUi();
  const styles = useThemedStyles(makeStyles);
  const { prev, readyView, viewReady, turnEndsAt, resuming } = useGame();
  const text = prev && 'text' in prev ? prev.text : '';

  // Kept here (useDeadline): Stage rebuilds its panes (remounting the
  // Countdown) when the layout flips between one and two panes, and the clock
  // must not restart when the phone turns. The game's deadline, so a phone
  // back in the room mid-way shows only what's left, moved when the game's
  // moves, and held while the phone catches up (`resuming`: a paused game
  // picks up where it was).
  const until = useDeadline(TIMERS.view, turnEndsAt);
  const expired = useRef(false);
  const expire = () => {
    if (expired.current) return;
    expired.current = true;
    readyView(false); // the clock, not the player: doesn't count as activity
  };

  const focus = <Logo source={IMAGES.home} />;

  const actions = (
    <>
      <Countdown seconds={TIMERS.view} until={until} onExpire={expire} hold={resuming} />
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
      {viewReady ? (
        <ButtonNote text="Player ready" live />
      ) : (
        <PigButton name="Got it — let's draw!" onPress={() => readyView()} />
      )}
      <LeaveButton />
    </>
  );

  return <Stage focus={focus} actions={actions} />;
}

const makeStyles = (t: Theme) => StyleSheet.create({
  label: {
    color: t.overlayLabel,
    fontFamily: font.bold,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  card: { backgroundColor: t.overlay, borderWidth: t.edge, borderColor: t.overlayBorder },
  prompt: { color: t.overlayText, fontFamily: font.medium, textAlign: 'center' },
});
