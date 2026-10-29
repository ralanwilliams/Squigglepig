import React, { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { CarvedText } from '../components/CarvedText';
import { Logo } from '../components/Logo';
import { IMAGES } from '../assets/assets';
import { assetSize } from '../lib/assetSize';
import type { Placement } from '../theme/skins';
import type { PropName } from '../theme/skins/props';
import { useMyAvatar } from '../avatar/avatar';
import { OUTFITS } from '../avatar/outfits';
import { onHead, partOf } from '../avatar/themeParts';
import { font, type Theme } from '../theme/tokens';
import { useTheme, useThemedStyles } from '../theme/theme';
import { FONT_CAP, useUi } from '../theme/responsive';
import { BASE_VEINS, HATS, PODIUM, PODIUM_PIG, hatOn, type Vein } from './podium';

// The reward tiers (engine.ts LADDER), for a game's intro: a winners'
// podium, Premium on top in the middle, Rare second, Common third. Each
// step's front says its tier, and on it stands a pig holding up a sign with
// the wins in a row it takes (podium.ts). The pig in first place is the
// player's, wearing what their pig has on its head (src/avatar) and the
// season's hat if it has none of its own; the other two wear a hat each,
// picked at random from the hats there are to win, none the same as another
// pig's, and nothing of the season's. Explains the run before it
// starts; once it has, the pot ladder slider (PotLadder.tsx) shows where
// it's up to.
//
// The steps stand on one base, in the theme's colors (first place in the
// button color), each with a lit cap overhanging its sides. Second and third
// stand a little apart from first place, their caps reaching across the gap
// to touch it, so each cap overhangs its step evenly. It's polished marble:
// the fronts and the base are veined (podium.ts) under a soft gloss that's
// brightest at the top left, where the light falls. The words are carved
// into it (CarvedText): each step's tier, and "Consecutive Wins" on the
// base, under the signs it explains. High contrast drops the marble and the
// gloss, and prints the words plainly.
//
// `scale` draws all of it bigger or smaller (the intro draws it half as big
// again, as the screen's picture).

const omitAll = () => true;
const ART_DP = 100; // the pig art's height on a step, base dp (its window is taller: room for a hat)
// First place, holding its sign, wears only what's on its head.
const offHead = (p: Placement) => !onHead(partOf(p));

// Two different hats for second and third, at random, neither the one the
// player's pig has on.
function pickHats(theirs: string[]): (PropName | null)[] {
  const worn = theirs.map((id) => OUTFITS[id]?.prop);
  const pool = HATS.filter((h) => !worn.includes(h));
  const first = pool.splice(Math.floor(Math.random() * pool.length), 1)[0] ?? null;
  return [first, pool[Math.floor(Math.random() * pool.length)] ?? null];
}
const LIGHT = 'rgba(255, 255, 255, 0.35)'; // over a step's color: its cap, lit from above
// The marble, over a face's color: grey veins and white ones, each a thin
// line in a faint halo, and the gloss.
const VEIN = { dark: ['rgba(0, 0, 0, 0.16)', 'rgba(0, 0, 0, 0.05)'], light: ['rgba(255, 255, 255, 0.32)', 'rgba(255, 255, 255, 0.09)'] };
const GLOSS = '#ffffff';

export function RewardPodium({ scale = 1 }: { scale?: number }) {
  const ui = useUi();
  const styles = useThemedStyles(makeStyles);
  const t = useTheme();
  const marble = t.contrast !== 'high';
  const base = ui.sp(52 * scale);
  const cap = ui.sp(7 * scale);
  const over = ui.sp(3 * scale); // how far a cap overhangs its step, and the gap between second or third and first
  const firstAt = PODIUM.findIndex((s) => s.first);
  const { outfits } = useMyAvatar();
  // Picked once: the hats don't change while the screen is up.
  const [hats] = useState(() => pickHats(outfits));
  return (
    <View
      accessible
      accessibilityLabel={`Win rounds in a row. ${[...PODIUM]
        .sort((a, b) => a.won - b.won)
        .map((s) => `${s.won} wins: a ${s.label.toLowerCase()} prize.`)
        .join(' ')}`}
    >
      <View style={[styles.podium, { paddingHorizontal: ui.sp(10 * scale) }]}>
        {PODIUM.map((s, i) => (
          <View key={s.prize} style={styles.column}>
            <Pig decor={s.decor} hat={s.first ? undefined : hats[i < firstAt ? 0 : 1]} height={ui.sp(ART_DP * PODIUM_PIG.h * scale)} />
            <View
              style={[
                styles.face,
                s.first && styles.first,
                // Across the gap to first place, else out past the step.
                { height: cap, marginLeft: i > firstAt ? 0 : -over, marginRight: i < firstAt ? 0 : -over, borderRadius: ui.sp(3 * scale) },
              ]}
            >
              <View style={[StyleSheet.absoluteFill, { backgroundColor: LIGHT }]} />
            </View>
            <View
              style={[
                styles.face,
                s.first && styles.first,
                styles.front,
                { height: base * s.rise, paddingTop: ui.sp(5 * scale), marginLeft: i > firstAt ? over : 0, marginRight: i < firstAt ? over : 0 },
              ]}
            >
              {marble ? <Marble id={s.prize} veins={s.veins} /> : null}
              <CarvedText
                ink={s.first || t.name === 'dark' ? 'light' : 'dark'}
                style={[styles.tier, s.first && styles.firstText, { fontSize: ui.f(14 * scale) }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                maxFontSizeMultiplier={FONT_CAP}
              >
                {s.label}
              </CarvedText>
            </View>
          </View>
        ))}
      </View>
      <View style={[styles.base, { minHeight: ui.sp(25 * scale), paddingVertical: ui.sp(3 * scale), paddingHorizontal: ui.sp(8 * scale), borderRadius: ui.sp(4 * scale) }]}>
        {marble ? <Marble id="base" veins={BASE_VEINS} /> : null}
        <CarvedText ink="light" style={[styles.carved, { fontSize: ui.f(15 * scale) }]} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={FONT_CAP}>
          Consecutive Wins
        </CarvedText>
      </View>
    </View>
  );
}

// A face's marble, filling it: its veins (fractions of the face, drawn at
// its size once it's laid out) and the gloss over them.
function Marble({ id, veins }: { id: string; veins: Vein[] }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.w || height !== size.h) setSize({ w: width, h: height });
  };
  const { w, h } = size;
  const gloss = `pd-gloss-${id}`;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={onLayout}>
      {w > 0 ? (
        <Svg width={w} height={h}>
          <Defs>
            <LinearGradient id={gloss} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={GLOSS} stopOpacity={0.3} />
              <Stop offset="0.38" stopColor={GLOSS} stopOpacity={0.06} />
              <Stop offset="0.5" stopColor={GLOSS} stopOpacity={0.14} />
              <Stop offset="0.64" stopColor={GLOSS} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {veins.map((v, i) => {
            const d = veinPath(v.pts, w, h);
            const [line, halo] = v.light ? VEIN.light : VEIN.dark;
            return (
              <React.Fragment key={i}>
                <Path d={d} stroke={halo} strokeWidth={v.w * 3} fill="none" strokeLinecap="round" />
                <Path d={d} stroke={line} strokeWidth={v.w} fill="none" strokeLinecap="round" />
              </React.Fragment>
            );
          })}
          <Rect width={w} height={h} fill={`url(#${gloss})`} />
        </Svg>
      ) : null}
    </View>
  );
}

// A vein's points, scaled to the face, as a smooth curve through their midpoints.
function veinPath(pts: [number, number][], w: number, h: number) {
  const p = pts.map(([x, y]) => [Math.round(x * w * 10) / 10, Math.round(y * h * 10) / 10]);
  let d = `M${p[0][0]} ${p[0][1]}`;
  for (let i = 1; i < p.length - 1; i++) d += ` Q${p[i][0]} ${p[i][1]} ${(p[i][0] + p[i + 1][0]) / 2} ${(p[i][1] + p[i + 1][1]) / 2}`;
  const last = p[p.length - 1];
  return d + ` L${last[0]} ${last[1]}`;
}

// The join art's pig in the podium's window (podium.ts), clipped to it so
// the wordmark doesn't spill: with `decor` (its sign), and a `hat`, or with
// none given, the player's pig.
function Pig({ decor, hat, height }: { decor: Placement[]; hat?: PropName | null; height: number }) {
  const { width: srcW, height: srcH } = assetSize(IMAGES.join);
  const width = (height * PODIUM_PIG.w * srcW) / (PODIUM_PIG.h * srcH);
  return (
    <View style={{ width, height, overflow: 'hidden' }}>
      {hat === undefined ? (
        <Logo source={IMAGES.join} window={PODIUM_PIG} omit={offHead} extra={decor} headOnly />
      ) : (
        <Logo source={IMAGES.join} window={PODIUM_PIG} omit={omitAll} extra={hat ? [hatOn(hat), ...decor] : decor} avatar={null} />
      )}
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  podium: { flexDirection: 'row', alignItems: 'flex-end' },
  column: { flex: 1, alignItems: 'center' },
  face: {
    alignSelf: 'stretch',
    overflow: 'hidden',
    backgroundColor: t.chip,
    borderWidth: Math.max(1, t.edge),
    borderColor: t.chipBorder,
  },
  front: { alignItems: 'center', borderTopWidth: 0, borderBottomWidth: 0 },
  first: { backgroundColor: t.button, borderColor: t.buttonPressed },
  tier: { color: t.text, fontFamily: font.medium },
  firstText: { color: t.buttonText, fontFamily: font.bold },
  base: { backgroundColor: t.buttonPressed, justifyContent: 'center', overflow: 'hidden' },
  carved: { color: t.buttonText, fontFamily: font.bold, letterSpacing: 1, textAlign: 'center' },
});
