import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Logo } from '../components/Logo';
import { IMAGES } from '../assets/assets';
import { assetSize } from '../lib/assetSize';
import type { Placement } from '../theme/skins';
import { font, type Theme } from '../theme/tokens';
import { useThemedStyles } from '../theme/theme';
import { FONT_CAP, useUi } from '../theme/responsive';
import { PODIUM, PODIUM_PIG } from './podium';

// The reward tiers (engine.ts LADDER), for a game's intro: a winners'
// podium, Premium on top in the middle, Rare second, Common third. Each
// step's front says its tier, and on it stands a pig dressed for it holding
// up a sign with the wins in a row it takes (podium.ts). The season's props
// stay off these pigs: each wears its own. Explains the run before it
// starts; once it has, the pot ladder slider (PotLadder.tsx) shows where
// it's up to.
//
// The steps stand on one base, each with a lit cap overhanging its sides and
// a shadow low on its front, in the theme's colors (first place in the
// button color), so the podium reads as a thing standing on the floor.

const omitAll = () => true;
const LIGHT = 'rgba(255, 255, 255, 0.35)'; // over a step's color: its cap, lit from above
const SHADE = 'rgba(0, 0, 0, 0.1)'; // over a step's color: its foot, in shadow

export function RewardPodium() {
  const ui = useUi();
  const styles = useThemedStyles(makeStyles);
  const base = ui.sp(52);
  const cap = ui.sp(7);
  const over = ui.sp(3); // how far a cap overhangs its step
  return (
    <View
      accessible
      accessibilityLabel={`Win rounds in a row. ${[...PODIUM]
        .sort((a, b) => a.won - b.won)
        .map((s) => `${s.won} wins: a ${s.label.toLowerCase()} prize.`)
        .join(' ')}`}
      style={{ gap: ui.sp(6) }}
    >
      <Text style={[styles.caption, { fontSize: ui.f(13) }]} maxFontSizeMultiplier={FONT_CAP}>
        Wins in a row
      </Text>
      <View>
        <View style={[styles.podium, { paddingHorizontal: ui.sp(10) }]}>
          {PODIUM.map((s) => (
            <View key={s.prize} style={styles.column}>
              <Pig decor={s.decor} height={ui.sp(118)} />
              <View style={[styles.face, s.first && styles.first, { height: cap, marginHorizontal: -over, borderRadius: ui.sp(3) }]}>
                <View style={[StyleSheet.absoluteFill, { backgroundColor: LIGHT }]} />
              </View>
              <View style={[styles.face, s.first && styles.first, styles.front, { height: base * s.rise, paddingTop: ui.sp(5) }]}>
                <View style={[styles.foot, { height: ui.sp(8), backgroundColor: SHADE }]} />
                <Text
                  style={[styles.tier, s.first && styles.firstText, { fontSize: ui.f(14) }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  maxFontSizeMultiplier={FONT_CAP}
                >
                  {s.label}
                </Text>
              </View>
            </View>
          ))}
        </View>
        <View style={[styles.base, { height: ui.sp(9), borderRadius: ui.sp(4) }]} />
      </View>
    </View>
  );
}

// The join art's pig, dressed, in the podium's window (podium.ts), clipped
// to it so the wordmark doesn't spill.
function Pig({ decor, height }: { decor: Placement[]; height: number }) {
  const { width: srcW, height: srcH } = assetSize(IMAGES.join);
  const width = (height * PODIUM_PIG.w * srcW) / (PODIUM_PIG.h * srcH);
  return (
    <View style={{ width, height, overflow: 'hidden' }}>
      <Logo source={IMAGES.join} window={PODIUM_PIG} omit={omitAll} extra={decor} />
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  caption: { color: t.textMuted, fontFamily: font.regular, textAlign: 'center' },
  podium: { flexDirection: 'row', alignItems: 'flex-end' },
  column: { flex: 1, alignItems: 'center' },
  face: {
    alignSelf: 'stretch',
    overflow: 'hidden',
    backgroundColor: t.chip,
    borderWidth: Math.max(1, t.edge),
    borderColor: t.chipBorder,
  },
  front: { alignItems: 'center', borderTopWidth: 0 },
  foot: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  first: { backgroundColor: t.button, borderColor: t.buttonPressed },
  tier: { color: t.text, fontFamily: font.medium },
  firstText: { color: t.buttonText, fontFamily: font.bold },
  base: { backgroundColor: t.buttonPressed },
});
