import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { useGame } from '../state/GameContext';
import { font, type Theme } from '../theme/tokens';
import { useThemedStyles } from '../theme/theme';
import { FONT_CAP, useUi } from '../theme/responsive';

// A small, always-available "leave the game" link. Leaving unsubscribes from the
// room, so the player drops out of presence and is removed from the rotation at
// the next round (their pooled prompts simply go unused). See GameContext.
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
