import React, { useEffect, useId, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { font, type Theme } from '../theme/tokens';
import { useReducedMotion, useSkin, useThemedStyles } from '../theme/theme';
import { FONT_CAP, useUi } from '../theme/responsive';
import { TROUGH_FLOOD, TROUGH_SLOTS, troughFilled } from '../theme/skins/trough';
import { PileArt, dropEasing, showFalling, type FallingProp } from './TroughDrops';
import { svgShift } from '../lib/svgShift';

// The trough: a pig trough filling with mud, one step per pooled prompt. Pure
// vector (react-native-svg) driven by RN's Animated, so it scales with the UI
// like everything else and needs no image assets.
//   - the mud level eases to count / target
//   - two wave layers drift in opposite directions so the surface never sits still
//   - a few bubbles rise now and then
// With reduced motion the mud steps straight to its level and lies flat:
// no waves, no bubbles.
//
// In season the mud gives way to a pile of the skin's props (its `trough`
// list: what the pig is holding, presents on a birthday). A slot fills each
// time the level would rise (src/theme/skins/trough.ts): each prop drops in
// from the top of the screen (TroughDrops.tsx draws the fall), bounces and
// lands any which way, and once the trough is full a shower of extras packs
// it to the brim. In the walkthrough, a modal over everything, they fall from
// the top of the trough's own drawing instead. With reduced motion they
// simply appear.

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Drawing space is 400 × 168. The cavity (where mud shows) spans y 52 → 128.
const CAVITY_H = 76;
const CAVITY = 'M62 52 H338 L318 128 H82 Z';
// The rim: the band of wood across the top (y 40 → 52), and its outer edge.
// Redrawn over a seasonal pile so the pile sits behind it, in the trough.
const RIM = 'M48 40 H352 a8 8 0 0 1 7.6 10.4 L359 52 H41 L40.4 50.4 A8 8 0 0 1 48 40 Z';
const RIM_EDGE = 'M41 52 L40.4 50.4 A8 8 0 0 1 48 40 H352 a8 8 0 0 1 7.6 10.4 L359 52';
const BODY =
  'M48 40 H352 a8 8 0 0 1 7.6 10.4 L332 130 a10 10 0 0 1 -9.6 7 H77.6 a10 10 0 0 1 -9.6 -7 L40.4 50.4 A8 8 0 0 1 48 40 Z';
// A wave 80 units long, repeated past both edges so it can scroll seamlessly.
const WAVE = 'M-80 52 q20 -7 40 0 ' + 't40 0 '.repeat(13) + 'V240 H-80 Z';
const WAVE_BACK = 'M-80 50 q20 -9 40 0 ' + 't40 0 '.repeat(13) + 'V240 H-80 Z';
const DROP_FROM = 140; // in the walkthrough, how far above its spot a prop starts (off the top of the drawing)
const DROP_MS = 900;
const FLOOD_GAP_MS = 70; // between the shower's drops
const BUBBLES = [
  { cx: 120, cy: 84, r: 3.2, delay: 0, dur: 2600 },
  { cx: 212, cy: 88, r: 2.4, delay: 900, dur: 3100 },
  { cx: 271, cy: 82, r: 3.6, delay: 1700, dur: 2300 },
  { cx: 165, cy: 90, r: 2.0, delay: 400, dur: 3600 },
];

export function Trough({
  count,
  target,
  labels = true,
  fallFrom = 'screen',
}: {
  count: number;
  target: number;
  labels?: boolean; // the "count / target" line and the hint under it (off in the walkthrough)
  fallFrom?: 'screen' | 'trough'; // where a seasonal prop drops from ('trough' in a modal, over the drop layer)
}) {
  const ui = useUi();
  const styles = useThemedStyles(makeStyles);
  // 0 = brim, 1 = empty (it's the fraction of the cavity the mud is shifted down by).
  const empty = useRef(new Animated.Value(1)).current;
  const wave = useRef(new Animated.Value(0)).current;
  const waveBack = useRef(new Animated.Value(-80)).current;
  const bubbles = useRef(BUBBLES.map(() => new Animated.Value(0))).current;
  const reduced = useReducedMotion();
  const pile = useSkin()?.trough;
  const filled = pile?.length ? troughFilled(count, target) : 0;
  const flooded = filled === TROUGH_SLOTS.length;
  const drops = useRef(TROUGH_SLOTS.map(() => new Animated.Value(0))).current;
  const floods = useRef(TROUGH_FLOOD.map(() => new Animated.Value(0))).current;
  const landed = useRef(0); // how many are in already
  const id = useId();
  const box = useRef<View>(null); // the drawing, measured to hand falls to the drop layer
  const fromScreen = fallFrom === 'screen' && !reduced;

  // New props drop one after another; ones no longer counted (a new round) go.
  useEffect(() => {
    drops.forEach((v, i) => {
      if (i >= filled) v.setValue(0);
      else if (reduced) v.setValue(1);
      else if (i >= landed.current) {
        const delay = 120 * (i - landed.current);
        Animated.timing(v, { toValue: 1, delay, duration: DROP_MS, easing: dropEasing, useNativeDriver: false }).start();
      }
    });
    landed.current = filled;
  }, [filled, reduced, drops]);

  // A full trough: the shower, one after another once the last slot has
  // landed.
  useEffect(() => {
    if (!flooded) {
      floods.forEach((v) => v.setValue(0));
      return;
    }
    if (reduced) {
      floods.forEach((v) => v.setValue(1));
      return;
    }
    const shower = Animated.stagger(
      FLOOD_GAP_MS,
      floods.map((v) => Animated.timing(v, { toValue: 1, duration: DROP_MS, easing: dropEasing, useNativeDriver: false }))
    );
    const start = setTimeout(() => shower.start(), DROP_MS);
    return () => {
      clearTimeout(start);
      shower.stop();
    };
  }, [flooded, reduced, floods]);

  // Everything in the pile now: its slot, which prop, its animation.
  const items: FallingProp[] = pile?.length
    ? [
        ...TROUGH_SLOTS.slice(0, filled).map((slot, i) => ({ slot, key: `s${i}`, v: drops[i] })),
        ...(flooded ? TROUGH_FLOOD.map((slot, i) => ({ slot, key: `f${i}`, v: floods[i] })) : []),
      ].map((it) => ({ ...it, name: pile[it.slot.v % pile.length] }))
    : [];

  // Falling from the top of the screen: tell the drop layer where this trough
  // is and what's in it (measured now, as it may have moved or been scaled).
  const itemKeys = items.map((it) => it.key + it.name).join();
  useEffect(() => {
    if (!fromScreen || !items.length) {
      showFalling(id, null);
      return;
    }
    box.current?.measureInWindow((x, y, w) => showFalling(id, { frame: { x, y, w }, items }));
  }, [fromScreen, itemKeys, id]); // itemKeys stands for items, which is new every render
  useEffect(() => () => showFalling(id, null), [id]);

  useEffect(() => {
    const fill = target > 0 ? Math.min(1, count / target) : 0;
    if (reduced) {
      empty.setValue(1 - fill);
      return;
    }
    Animated.timing(empty, {
      toValue: 1 - fill,
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [count, target, empty, reduced]);

  useEffect(() => {
    if (reduced) {
      wave.setValue(0);
      waveBack.setValue(-80);
      bubbles.forEach((b) => b.setValue(0));
      return;
    }
    const linear = { easing: Easing.linear, useNativeDriver: false };
    const loops = [
      Animated.loop(Animated.timing(wave, { toValue: -80, duration: 2800, ...linear })),
      Animated.loop(Animated.timing(waveBack, { toValue: 0, duration: 4100, ...linear })),
      ...bubbles.map((b, i) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(BUBBLES[i].delay),
            Animated.timing(b, { toValue: 1, duration: BUBBLES[i].dur, easing: Easing.in(Easing.quad), useNativeDriver: false }),
            Animated.timing(b, { toValue: 0, duration: 0, useNativeDriver: false }),
          ])
        )
      ),
    ];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [wave, waveBack, bubbles, reduced]);


  const levelY = empty.interpolate({ inputRange: [0, 1], outputRange: [0, CAVITY_H] });
  const remaining = Math.max(0, target - count);

  return (
    <View style={[styles.wrap, { gap: ui.sp(4) }]}>
      <View ref={box} collapsable={false}>
        <Svg viewBox="0 0 400 168" style={styles.svg}>
          <Defs>
            <ClipPath id="cavity">
              <Path d={CAVITY} />
            </ClipPath>
            <LinearGradient id="wood" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#CFA066" />
              <Stop offset="1" stopColor="#A57541" />
            </LinearGradient>
            <LinearGradient id="mud" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#8E5C34" />
              <Stop offset="0.25" stopColor="#6E4526" />
              <Stop offset="1" stopColor="#4A2C16" />
            </LinearGradient>
          </Defs>

          {/* legs */}
          <Rect x="88" y="126" width="16" height="32" rx="3" fill="#7E5228" />
          <Rect x="296" y="126" width="16" height="32" rx="3" fill="#7E5228" />
          {/* body, then the cutaway cavity */}
          <Path d={BODY} fill="url(#wood)" stroke="#6A4320" strokeWidth="3" strokeLinejoin="round" />
          <Path d={CAVITY} fill="#33200F" />
          <Path d={CAVITY} fill="none" stroke="#24150A" strokeWidth="3" strokeLinejoin="round" />

          {pile?.length ? (
            <>
              {/* the heap peeking over the rim, then the rows inside, upper first */}
              {items
                .filter((it) => it.slot.heap)
                .map((it) => (
                  <Piled key={it.key} it={it} fromScreen={fromScreen} />
                ))}
              <G clipPath="url(#cavity)">
                {items
                  .filter((it) => !it.slot.heap)
                  .sort((a, b) => a.slot.y - b.slot.y)
                  .map((it) => (
                    <Piled key={it.key} it={it} fromScreen={fromScreen} />
                  ))}
              </G>
              {/* the rim in front of it all, so the pile is in the trough, not on it */}
              <Path d={RIM} fill="url(#wood)" />
              <Path d={RIM_EDGE} fill="none" stroke="#6A4320" strokeWidth="3" strokeLinejoin="round" />
              <Path d="M62 52 H338" stroke="#24150A" strokeWidth="3" />
              <Path d="M50 41 H350" stroke="#EAC38C" strokeWidth="3" strokeLinecap="round" />
            </>
          ) : (
            <>
              {/* mud */}
              <G clipPath="url(#cavity)">
                <AnimatedG {...svgShift('y', levelY)}>
                  <AnimatedPath d={WAVE_BACK} fill="#5A381D" opacity={0.55} {...svgShift('x', waveBack)} />
                  <AnimatedPath d={WAVE} fill="url(#mud)" {...svgShift('x', wave)} />
                  {BUBBLES.map((b, i) => (
                    <AnimatedCircle
                      key={i}
                      cx={b.cx}
                      cy={b.cy}
                      r={b.r}
                      fill="#B98A5F"
                      {...svgShift('y', bubbles[i].interpolate({ inputRange: [0, 1], outputRange: [34, -3] }))}
                      opacity={bubbles[i].interpolate({ inputRange: [0, 0.25, 0.9, 1], outputRange: [0, 0.75, 0.5, 0] })}
                    />
                  ))}
                </AnimatedG>
              </G>

              {/* rim highlight */}
              <Path d="M50 41 H350" stroke="#EAC38C" strokeWidth="3" strokeLinecap="round" />
            </>
          )}
        </Svg>
      </View>

      {labels ? (
        <>
          <Text style={[styles.count, { fontSize: ui.f(22) }]} maxFontSizeMultiplier={FONT_CAP}>
            {count} / {target}
          </Text>
          <Text style={[styles.sub, { fontSize: ui.f(13) }]} maxFontSizeMultiplier={FONT_CAP} numberOfLines={2}>
            {remaining > 0
              ? `${remaining} more and the game starts — anyone can add.`
              : 'Trough full — starting the game!'}
          </Text>
        </>
      ) : null}
    </View>
  );
}

// One prop in the pile. `v` runs 0 → 1 as it lands (dropEasing, so it
// touches 1 and bounces back a little twice). Falling from the screen, the drop
// layer draws the fall and this copy only shows once it's down; in the
// walkthrough this copy falls itself, from just above the drawing.
function Piled({ it, fromScreen }: { it: FallingProp; fromScreen: boolean }) {
  const art = <PileArt slot={it.slot} name={it.name} />;
  return fromScreen ? (
    <AnimatedG opacity={it.v.interpolate({ inputRange: [0, 0.999, 1], outputRange: [0, 0, 1] })}>{art}</AnimatedG>
  ) : (
    <AnimatedG {...svgShift('y', it.v.interpolate({ inputRange: [0, 1], outputRange: [-DROP_FROM, 0] }))}>{art}</AnimatedG>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  // No card behind it — the trough sits straight on the teal.
  wrap: { width: '100%' },
  svg: { width: '100%', aspectRatio: 400 / 168 },
  count: { color: t.link, fontFamily: font.bold, textAlign: 'center', letterSpacing: 1 },
  sub: { color: t.text, fontFamily: font.regular, textAlign: 'center' },
});
