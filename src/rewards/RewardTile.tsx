import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Glyph } from '../components/Glyph';
import { font, type Theme } from '../theme/tokens';
import { useTheme, useThemedStyles } from '../theme/theme';
import { FONT_CAP, useUi } from '../theme/responsive';
import { RewardThumb } from './RewardThumb';
import { KINDS, type Reward } from './catalog';

// One reward as a card: its picture, its name and where the player stands
// with it. A reward not yet won is shown, dimmed, so players can see what
// there is to win; a rare one has a star in its corner. The status is spelled
// out in words as well as shown by the lock and the dimming.
//
// Of a kind the player picks one of (catalog.ts KINDS `pick: 'one'`), an owned
// card can be tapped (`onPress`) to use it; the one in use is ringed. A screen
// showing cards for another reason (a prize on offer) passes its own `status`.
export const TILE_W = 84; // base dp, scaled by the UI scale

export function RewardTile({
  reward,
  owned,
  chosen = false,
  onPress,
  status: statusText,
}: {
  reward: Reward;
  owned: boolean;
  chosen?: boolean;
  onPress?: () => void;
  status?: string;
}) {
  const ui = useUi();
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const pickOne = KINDS[reward.kind].pick === 'one';
  const status =
    statusText ?? (reward.soon ? 'Coming soon' : !owned ? 'Locked' : !pickOne ? 'Unlocked' : chosen ? 'In use' : 'Tap to use');
  const lineH = ui.f(15);
  const radius = ui.sp(12);

  const body = (
    <>
      <View style={{ opacity: owned ? 1 : 0.35 }}>
        <RewardThumb reward={reward} size={ui.sp(40)} />
      </View>
      <Text
        style={[styles.label, !owned && styles.muted, { fontSize: ui.f(12), lineHeight: lineH, height: lineH * 2 }]}
        numberOfLines={2}
        maxFontSizeMultiplier={FONT_CAP}
      >
        {reward.label}
      </Text>
      <View style={[styles.status, { gap: ui.sp(3) }]}>
        {!owned && !reward.soon ? <Glyph name="lock" size={ui.sp(11)} color={theme.textMuted} weight={2.4} /> : null}
        <Text
          style={[styles.statusText, owned && !reward.soon ? styles.ink : styles.muted, chosen && styles.chosenText, { fontSize: ui.f(10) }]}
          maxFontSizeMultiplier={FONT_CAP}
          numberOfLines={1}
        >
          {status}
        </Text>
      </View>
      {reward.tier === 'rare' ? (
        <View style={[styles.corner, { top: ui.sp(5), right: ui.sp(5) }]}>
          <Glyph name="star" size={ui.sp(14)} color={theme.accent} weight={2.4} />
        </View>
      ) : null}
      {/* Drawn over the card rather than as its border, so choosing one
          doesn't nudge its contents. */}
      {chosen ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.ring, { borderRadius: radius, borderWidth: ui.sp(2.5) }]} /> : null}
    </>
  );

  const box = [styles.tile, { width: ui.sp(TILE_W), padding: ui.sp(8), gap: ui.sp(6), borderRadius: radius }];
  const label = `${reward.label}${reward.tier === 'rare' ? ', rare' : ''}, ${status.toLowerCase()}`;
  if (!onPress) {
    return (
      <View accessible accessibilityLabel={label} style={box}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: chosen }}
      onPress={onPress}
      style={({ pressed }) => [box, { opacity: pressed ? 0.6 : 1 }]}
    >
      {body}
    </Pressable>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  tile: {
    alignItems: 'center',
    backgroundColor: t.surface,
    borderWidth: t.edge,
    borderColor: t.surfaceBorder,
  },
  label: { color: t.surfaceText, fontFamily: font.medium, textAlign: 'center' },
  ink: { color: t.surfaceText },
  muted: { color: t.textMuted },
  status: { flexDirection: 'row', alignItems: 'center' },
  statusText: { fontFamily: font.regular },
  chosenText: { fontFamily: font.bold },
  corner: { position: 'absolute' },
  ring: { borderColor: t.link },
});
