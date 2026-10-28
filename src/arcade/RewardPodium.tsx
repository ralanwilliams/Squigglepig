import React, { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { CarvedText } from '../components/CarvedText';
import { Logo } from '../components/Logo';
import { IMAGES } from '../assets/assets';
import { assetSize } from '../lib/assetSize';
import type { Placement } from '../theme/skins';
import { font, type Theme } from '../theme/tokens';
import { useTheme, useThemedStyles } from '../theme/theme';
import { FONT_CAP, useUi } from '../theme/responsive';
import { BASE_VEINS, PODIUM, PODIUM_PIG, type Vein } from './podium';

// The reward tiers (engine.ts LADDER), for a game's intro: a winners'
// podium, Premium on top in the middle, Rare second, Common third. Each
// step's front says its tier, and on it stands a pig dressed for it holding
// up a sign with the wins in a row it takes (podium.ts). The season's props
// stay off these pigs: each wears its own. Explains the run before it
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

const omitAll = () => true;
const LIGHT = 'rgba(255, 255, 255, 0.35)'; // over a step's color: its cap, lit from above
// The marble, over a face's color: grey veins and white ones, each a thin
// line in a faint halo, and the gloss.
const VEIN = { dark: ['rgba(0, 0, 0, 0.16)', 'rgba(0, 0, 0, 0.05)'], light: ['rgba(255, 255, 255, 0.32)', 'rgba(255, 255, 255, 0.09)'] };
const GLOSS = '#ffffff';

export function RewardPodium() {
  const ui = useUi();
  const styles = useThemedStyles(makeStyles);
  const t = useTheme();
  const marble = t.contrast !== 'high';
  const base = ui.sp(52);
  const cap = ui.sp(7);
  const over = ui.sp(3); // how far a cap overhangs its step, and the gap between second or third and first
  const firstAt = PODIUM.findIndex((s) => s.first);
  return (
    <View
      accessible
      accessibilityLabel={`Win rounds in a row. ${[...PODIUM]
        .sort((a, b) => a.won - b.won)
        .map((s) => `${s.won} wins: a ${s.label.toLowerCase()} prize.`)
        .join(' ')}`}
    >
      <View style={[styles.podium, { paddingHorizontal: ui.sp(10) }]}>
        {PODIUM.map((s, i) => (
          <View key={s.prize} style={styles.column}>
            <Pig decor={s.decor} height={ui.sp(118)} />
            <View
              style={[
                styles.face,
                s.first && styles.first,
                // Across the gap to first place, else out past the step.
                { height: cap, marginLeft: i > firstAt ? 0 : -over, marginRight: i < firstAt ? 0 : -over, borderRadius: ui.sp(3) },
              ]}
            >
              <View style={[StyleSheet.absoluteFill, { backgroundColor: LIGHT }]} />
            </View>
            <View
              style={[
                styles.face,
                s.first && styles.first,
                styles.front,
                { height: base * s.rise, paddingTop: ui.sp(5), marginLeft: i > firstAt ? over : 0, marginRight: i < firstAt ? over : 0 },
              ]}
            >
              {marble ? <Marble id={s.prize} veins={s.veins} /> : null}
              <CarvedText
                ink={s.first || t.name === 'dark' ? 'light' : 'dark'}
                style={[styles.tier, s.first && styles.firstText, { fontSize: ui.f(14) }]}
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
      <View style={[styles.base, { minHeight: ui.sp(25), paddingVertical: ui.sp(3), paddingHorizontal: ui.sp(8), borderRadius: ui.sp(4) }]}>
        {marble ? <Marble id="base" veins={BASE_VEINS} /> : null}
        <CarvedText ink="light" style={[styles.carved, { fontSize: ui.f(15) }]} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={FONT_CAP}>
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
