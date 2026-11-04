import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { useGame } from '../state/GameContext';
import { font, type Theme } from '../theme/tokens';
import { useThemedStyles } from '../theme/theme';
import { FONT_CAP, useUi } from '../theme/responsive';

// A small, always-available "leave the game" link — the only way out of a room
// (closing the app just makes the player "away"). Leaving tells the server and
// unsubscribes; mid-game the player is taken out of the rotation, or, if that
// would leave fewer than 3, their turns run out the clock until the round
// ends (their pooled prompts simply go unused). See GameContext.
// Visually a quiet text link, but padded + hit-slopped to a full 44dp target.
export function LeaveButton({ label = 'Leave game' }: { label?: string }) {
  const ui = useUi();
  const styles = useThemedStyles(makeStyles);
  const { leaveRoom } = useGame();
  const leave = () => {
    leaveRoom();
    router.replace('/');
  };
  return (
    <Pressable
      accessibilityRole="button"
      onPress={leave}
      style={[styles.leave, { minHeight: ui.sp(36), paddingVertical: ui.sp(8) }]}
      hitSlop={8}
    >
      <Text style={[styles.leaveText, { fontSize: ui.f(14) }]} maxFontSizeMultiplier={FONT_CAP}>
        {label}
      </Text>
    </Pressable>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  leave: { alignItems: 'center', justifyContent: 'center' },
  leaveText: {
    color: t.link,
    fontFamily: font.regular,
    textDecorationLine: 'underline',
  },
});
