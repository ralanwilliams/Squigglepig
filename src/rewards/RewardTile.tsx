import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Glyph } from '../components/Glyph';
import { font, type Theme } from '../theme/tokens';
import { useTheme, useThemedStyles } from '../theme/theme';
import { FONT_CAP, useUi } from '../theme/responsive';
import { RewardThumb } from './RewardThumb';
import type { Reward } from './catalog';

// One reward as a card: its picture, its name and where the player stands
// with it. A reward not yet won is shown, dimmed, so players can see what
// there is to win; a rare one has a star in its corner. The status is spelled
// out in words as well as shown by the lock and the dimming.
export const TILE_W = 84; // base dp, scaled by the UI scale

export function RewardTile({ reward, owned }: { reward: Reward; owned: boolean }) {
  const ui = useUi();
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const status = reward.soon ? 'Coming soon' : owned ? 'Unlocked' : 'Locked';
  const lineH = ui.f(15);
  return (
    <View
      accessible
      accessibilityLabel={`${reward.label}${reward.tier === 'rare' ? ', rare' : ''}, ${status.toLowerCase()}`}
      style={[styles.tile, { width: ui.sp(TILE_W), padding: ui.sp(8), gap: ui.sp(6), borderRadius: ui.sp(12) }]}
    >
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
        <Text style={[styles.statusText, owned && !reward.soon ? styles.ink : styles.muted, { fontSize: ui.f(10) }]} maxFontSizeMultiplier={FONT_CAP} numberOfLines={1}>
          {status}
        </Text>
      </View>
      {reward.tier === 'rare' ? (
        <View style={[styles.corner, { top: ui.sp(5), right: ui.sp(5) }]}>
          <Glyph name="star" size={ui.sp(14)} color={theme.accent} weight={2.4} />
        </View>
      ) : null}
    </View>
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
  corner: { position: 'absolute' },
});
