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
//
// `compact` is a smaller card for a rail holding many (Your pig): smaller
// picture and name, and no status line. The lock, the ring and the star still
// show where the player stands, and a screen reader still hears the status.
export const TILE_W = 84; // base dp, scaled by the UI scale
const COMPACT_W = 66;

export function RewardTile({
  reward,
  owned,
  chosen = false,
  onPress,
  status: statusText,
  compact = false,
}: {
  reward: Reward;
  owned: boolean;
  chosen?: boolean;
  onPress?: () => void;
  status?: string;
  compact?: boolean;
}) {
  const ui = useUi();
  const pickOne = KINDS[reward.kind].pick === 'one';
  const status =
    statusText ?? (reward.soon ? 'Coming soon' : !owned ? 'Locked' : !pickOne ? 'Unlocked' : chosen ? 'In use' : 'Tap to use');
  return (
    <Card
      picture={<RewardThumb reward={reward} size={ui.sp(compact ? 32 : 40)} />}
      name={reward.label}
      status={status}
      owned={owned}
      locked={!owned && !reward.soon}
      rare={reward.tier === 'rare'}
      chosen={chosen}
      onPress={onPress}
      compact={compact}
    />
  );
}

// The card itself, for anything shown like a reward: Your pig's cards for
// themes' parts (app/pig.tsx) are cards like these, though they're no reward.
// `picture` is sized by the caller (40 dp, or 32 compact, scaled); `owned`
// dims the picture and name when false, `locked` adds the lock.
export function Card({
  picture,
  name,
  status,
  owned,
  locked = false,
  rare = false,
  chosen = false,
  onPress,
  compact = false,
}: {
  picture: React.ReactNode;
  name: string;
  status: string;
  owned: boolean;
  locked?: boolean;
  rare?: boolean;
  chosen?: boolean;
  onPress?: () => void;
  compact?: boolean;
}) {
  const ui = useUi();
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const lineH = ui.f(compact ? 13 : 15);
  const radius = ui.sp(compact ? 10 : 12);
  const lock = <Glyph name="lock" size={ui.sp(11)} color={theme.textMuted} weight={2.4} />;

  const body = (
    <>
      <View style={{ opacity: owned ? 1 : 0.35 }}>{picture}</View>
      <Text
        style={[styles.label, !owned && styles.muted, { fontSize: ui.f(compact ? 11 : 12), lineHeight: lineH, height: lineH * 2 }]}
        numberOfLines={2}
        maxFontSizeMultiplier={FONT_CAP}
      >
        {name}
      </Text>
      {compact ? (
        locked ? <View style={[styles.corner, { top: ui.sp(5), left: ui.sp(5) }]}>{lock}</View> : null
      ) : (
        <View style={[styles.status, { gap: ui.sp(3) }]}>
          {locked ? lock : null}
          <Text
            style={[styles.statusText, owned ? styles.ink : styles.muted, chosen && styles.chosenText, { fontSize: ui.f(10) }]}
            maxFontSizeMultiplier={FONT_CAP}
            numberOfLines={1}
          >
            {status}
          </Text>
        </View>
      )}
      {rare ? (
        <View style={[styles.corner, { top: ui.sp(5), right: ui.sp(5) }]}>
          <Glyph name="star" size={ui.sp(compact ? 12 : 14)} color={theme.accent} weight={2.4} />
        </View>
      ) : null}
      {/* Drawn over the card rather than as its border, so choosing one
          doesn't nudge its contents. */}
      {chosen ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.ring, { borderRadius: radius, borderWidth: ui.sp(2.5) }]} /> : null}
    </>
  );

  const box = [
    styles.tile,
    {
      width: ui.sp(compact ? COMPACT_W : TILE_W),
      paddingVertical: ui.sp(compact ? 6 : 8),
      paddingHorizontal: ui.sp(compact ? 3 : 8), // the name gets all the width it can
      gap: ui.sp(compact ? 4 : 6),
      borderRadius: radius,
    },
  ];
  const label = `${name}${rare ? ', rare' : ''}, ${status.toLowerCase()}`;
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
