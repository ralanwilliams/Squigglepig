import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { font } from '../theme/tokens';
import { useReducedMotion } from '../theme/theme';
import { FONT_CAP, useUi } from '../theme/responsive';
import { LADDER, ROUNDS, prizeFor } from './engine';
import { PigTrack, useSliderColors } from './PigTrack';

// The pot ladder (engine.ts LADDER) as a slider, in every solo game's
// rounds: "n of 10 won", a thin track of ROUNDS rounds filled as far as the
// rounds won, with the app's pig face riding along it, a tick at each
// prize's step (filled once reached), and under it only the tier the pot is
// at ("Reward Tier: Common"), since the slider shows the rest. The game's
// intro explains the tiers (RewardPodium.tsx). The track is PigTrack.tsx.
//
// On Stage (RunShell's RoundFrame) it's drawn in the theme's colors, on the
// screen's own background. The `field` look is for a full-screen game
// (FieldFrame.tsx), where it sits on a dark chip over the game's art: the
// same slider in the field's cream and amber (fieldColors.ts).
//
// Where the pig was last shown, so it slides on from there to the new count
// (when a round is won it moves up one); a new run puts it back at the start.
let lastWon = 0;

const SLIDE_MS = 700;

export function PotLadder({ won, look }: { won: number; look?: 'field' }) {
  const ui = useUi();
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

  const c = useSliderColors(look);
  const pig = ui.sp(28);
  const pct = at.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View
      accessible
      accessibilityLabel={`${won} of ${ROUNDS} rounds won. ${prize ? `In the pot: ${prize.label.toLowerCase()} prize.` : 'Nothing in the pot yet.'}`}
      style={{ gap: ui.sp(2) }}
    >
      <Text style={[styles.count, { fontSize: ui.f(11), color: c.muted }]} maxFontSizeMultiplier={FONT_CAP}>
        {won} of {ROUNDS} won
      </Text>
      {/* Inset by half the pig, so at 0 and at ROUNDS it stays inside the rail. */}
      <View style={{ marginHorizontal: pig / 2 }}>
        <PigTrack at={pct} ticks={LADDER.map((step) => ({ key: step.prize, at: step.won / ROUNDS, on: won >= step.won }))} c={c} />
        <Text style={[styles.tier, { fontSize: ui.f(12), color: c.muted }]} maxFontSizeMultiplier={FONT_CAP} numberOfLines={1}>
          Reward Tier:{' '}
          <Text style={prize ? [styles.tierOn, { color: c.strong }] : [styles.tierNone, { color: c.none }]}>
            {prize ? prize.label : 'None yet'}
          </Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  count: { fontFamily: font.regular, textAlign: 'center' },
  tier: { fontFamily: font.regular, textAlign: 'center' },
  tierOn: { fontFamily: font.bold },
  tierNone: { fontFamily: font.medium },
});
