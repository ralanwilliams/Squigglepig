import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { IMAGES } from '../assets/assets';
import { font, type Theme } from '../theme/tokens';
import { useReducedMotion, useThemedStyles } from '../theme/theme';
import { FONT_CAP, useUi } from '../theme/responsive';
import { LADDER, ROUNDS, prizeFor } from './engine';

// The pot ladder (engine.ts LADDER) as a slider: a track of ROUNDS rounds,
// filled in the button color as far as the rounds won, with the app's pig
// face riding along it. A tick marks each prize's step, with the prize and
// the wins it needs under it; a step reached has a filled tick and a ✓, so
// it's told apart by the mark, not by color alone. All the colors are the
// theme's.
//
// Where the pig was last shown, so it slides on from there to the new count
// (when a round is won it moves up one); a new run puts it back at the start.
let lastWon = 0;

const SLIDE_MS = 700;

export function PotLadder({ won }: { won: number }) {
  const ui = useUi();
  const styles = useThemedStyles(makeStyles);
  const reduced = useReducedMotion();
  const prize = LADDER.find((s) => s.prize === prizeFor(won));
  const from = !reduced && won > lastWon ? lastWon : won;
  const at = useRef(new Animated.Value(from / ROUNDS)).current;
  useEffect(() => {
    lastWon = won;
    Animated.timing(at, {
      toValue: won / ROUNDS,
      duration: reduced ? 0 : SLIDE_MS,
      delay: reduced ? 0 : 250,
      easing: Easing.out(Easing.back(1.6)),
      useNativeDriver: false, // `left` and `width` can't go through the native driver
    }).start();
  }, [at, won, reduced]);

  const pig = ui.sp(39);
  const track = ui.sp(10);
  const tick = ui.sp(12);
  const pct = at.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View
      accessible
      accessibilityLabel={`${won} of ${ROUNDS} rounds won. ${prize ? `In the pot: ${prize.label.toLowerCase()} prize.` : 'Nothing in the pot yet.'}`}
      style={{ gap: ui.sp(4) }}
    >
      <Text style={[styles.count, { fontSize: ui.f(13) }]} maxFontSizeMultiplier={FONT_CAP}>
        {won} of {ROUNDS} won
      </Text>
      {/* Inset by half the pig, so at 0 and at ROUNDS it stays inside the rail. */}
      <View style={{ marginHorizontal: pig / 2 }}>
        <View style={[styles.slot, { height: pig }]}>
          <View style={[styles.track, { height: track, borderRadius: track / 2 }]}>
            <Animated.View style={[styles.fill, { width: pct }]} />
          </View>
          {LADDER.map((step) => (
            <View
              key={step.prize}
              style={[
                styles.tick,
                won >= step.won && styles.tickOn,
                { left: `${(100 * step.won) / ROUNDS}%`, width: tick, height: tick, borderRadius: tick / 2, marginLeft: -tick / 2 },
              ]}
            />
          ))}
          <Animated.View style={[styles.pig, { left: pct, width: pig, height: pig, borderRadius: pig / 2, marginLeft: -pig / 2 }]}>
            <Image source={IMAGES.icon} style={{ width: '100%', height: '100%' }} />
          </Animated.View>
        </View>
        <View style={{ height: ui.f(13) * 1.25 + ui.f(11) * 1.25 }}>
          {LADDER.map((step) => {
            const reached = won >= step.won;
            const last = step.won === ROUNDS;
            const w = ui.sp(80);
            return (
              <View
                key={step.prize}
                style={[
                  styles.label,
                  // The last step is flush with the end of the track; the rest centre on their tick.
                  last ? { right: -pig / 2, alignItems: 'flex-end' } : { left: `${(100 * step.won) / ROUNDS}%`, marginLeft: -w / 2 },
                  { width: w },
                ]}
              >
                <Text style={[styles.name, reached && styles.nameOn, { fontSize: ui.f(13) }]} numberOfLines={1} maxFontSizeMultiplier={FONT_CAP}>
                  {reached ? '✓ ' : ''}
                  {step.label}
                </Text>
                <Text style={[styles.need, { fontSize: ui.f(11) }]} numberOfLines={1} maxFontSizeMultiplier={FONT_CAP}>
                  {last ? `All ${ROUNDS}` : `${step.won} wins`}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  count: { color: t.textMuted, fontFamily: font.regular, textAlign: 'center' },
  slot: { justifyContent: 'center' },
  track: { overflow: 'hidden', backgroundColor: t.chip, borderWidth: Math.max(1, t.edge), borderColor: t.chipBorder },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: t.button },
  tick: { position: 'absolute', backgroundColor: t.chip, borderWidth: Math.max(1, t.edge), borderColor: t.chipBorder },
  tickOn: { backgroundColor: t.button, borderColor: t.buttonPressed },
  pig: { position: 'absolute', overflow: 'hidden', borderWidth: 2, borderColor: t.buttonPressed, backgroundColor: t.surface },
  label: { position: 'absolute', top: 0, alignItems: 'center' },
  name: { color: t.text, fontFamily: font.medium },
  nameOn: { fontFamily: font.bold },
  need: { color: t.textMuted, fontFamily: font.regular },
});
