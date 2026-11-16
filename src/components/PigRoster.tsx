import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Logo, type ImageWindow } from './Logo';
import { Glyph } from './Glyph';
import { BARE_PIG } from '../assets/assets';
import { NO_AVATAR, type Avatar } from '../avatar/avatar';
import { partOf } from '../avatar/themeParts';
import { font, type Theme } from '../theme/tokens';
import { useTheme, useThemedStyles } from '../theme/theme';
import { FONT_CAP, useUi } from '../theme/responsive';
import type { Placement } from '../theme/skins';

// A row of players as their own pigs, each dressed as its player has
// dressed it (src/avatar: their outfits, the theme parts they've put on, the
// theme showing less what they've taken off), but for what floats in the sky
// round the pig (ships, stars, balloons: a row of pigs has no sky of its
// own), with a ✓ on each one that's `done`. One not done yet is faded;
// the player on this phone (`me`) is tagged YOU. The prompts screen's "who's
// in"; any screen waiting on everyone can use it.
//
// Each pig is the Home pig without its wordmark (assets.ts BARE_PIG: it
// stands with its hooves free, so it wears all of an avatar). The window is
// the pig (the left 560 of the art's 954) with room for what it wears: a tall
// hat above, a blaster to its left, something at its feet to its right. Only
// a cape reaches further, past both sides; nothing is clipped, so it spills
// into the gap between pigs. Faces shrink
// as the room grows, so 12 fit in two rows.
export type RosterPlayer = { name: string; avatar?: Avatar | null; done: boolean; me?: boolean };

const PIG: ImageWindow = { x: -0.15, y: -0.16, w: 0.9, h: 1.3 };
const ASPECT = (PIG.w * 954) / (PIG.h * 900);
// Where the pig's lower right is in that box (its body ends 560 px in, its
// feet at the art's foot), for the ✓.
const TICK_AT = { x: (560 / 954 - PIG.x) / PIG.w, y: (0.86 - PIG.y) / PIG.h };

// The sky round the pig (themeParts.ts partOf: what bobs or twinkles), left
// off the theme showing and off the parts a player has put on.
const inSky = (p: Placement) => partOf(p) === 'sky';
const groundOnly = (a: Avatar | null | undefined): Avatar => {
  const avatar = a ?? NO_AVATAR;
  const theme = avatar.theme.filter((id) => !id.endsWith(':sky'));
  return theme.length === avatar.theme.length ? avatar : { ...avatar, theme };
};

export function PigRoster({ players }: { players: RosterPlayer[] }) {
  const ui = useUi();
  const styles = useThemedStyles(makeStyles);
  const n = players.length;
  // The box's width (the pig is about two thirds of it).
  const base = n <= 4 ? 88 : n <= 6 ? 74 : n <= 8 ? 62 : 52;
  const w = ui.sp(base);
  const h = w / ASPECT;
  const gap = ui.sp(n <= 4 ? 6 : 2);
  return (
    <View style={[styles.row, { columnGap: gap, rowGap: ui.sp(12) }]}>
      {players.map((p) => (
        <Face key={p.name} player={p} w={w} h={h} />
      ))}
    </View>
  );
}

function Face({ player, w, h }: { player: RosterPlayer; w: number; h: number }) {
  const ui = useUi();
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const tick = ui.sp(22);
  const avatar = useMemo(() => groundOnly(player.avatar), [player.avatar]);
  return (
    <View
      style={[styles.player, { gap: ui.sp(4) }]}
      accessible
      accessibilityLabel={`${player.me ? 'You' : player.name}, ${player.done ? 'ready' : 'still writing'}`}
    >
      <View style={{ width: w, height: h }}>
        <View style={[{ width: w, height: h }, !player.done && styles.waiting]}>
          <Logo source={BARE_PIG} window={PIG} avatar={avatar} headOnly={false} omit={inSky} />
        </View>
        {player.done ? (
          <View
            style={[
              styles.tick,
              { width: tick, height: tick, borderRadius: tick / 2, left: w * TICK_AT.x - tick * 0.7, top: h * TICK_AT.y - tick / 2 },
            ]}
          >
            <Glyph name="check" size={tick * 0.62} color={theme.background} weight={3.2} />
          </View>
        ) : null}
      </View>
      <Text style={[styles.name, player.me && styles.meName, { fontSize: ui.f(14) }]} maxFontSizeMultiplier={FONT_CAP} numberOfLines={1}>
        {player.me ? 'You' : player.name}
      </Text>
      <Text
        style={[styles.you, { fontSize: ui.f(10), paddingHorizontal: ui.sp(7) }, !player.me && styles.hidden]}
        maxFontSizeMultiplier={FONT_CAP}
        importantForAccessibility="no"
      >
        YOU
      </Text>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-end', maxWidth: '100%' },
    player: { alignItems: 'center' },
    // Still writing: faded into the background.
    waiting: { opacity: 0.5 },
    // The ✓ once they're done: a disc in the link color, ringed in the background.
    tick: {
      position: 'absolute',
      backgroundColor: t.link,
      borderWidth: 2,
      borderColor: t.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    name: { color: t.text, fontFamily: font.medium },
    meName: { fontFamily: font.bold },
    you: {
      color: t.accentText,
      backgroundColor: t.accent,
      fontFamily: font.bold,
      letterSpacing: 0.5,
      borderRadius: 999,
      paddingVertical: 2,
      overflow: 'hidden',
    },
    hidden: { opacity: 0 },
  });
