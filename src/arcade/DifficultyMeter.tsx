import React, { useState } from 'react';
import { GestureResponderEvent, LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { font } from '../theme/tokens';
import { FONT_CAP, useUi } from '../theme/responsive';
import { PigTrack, useSliderColors } from './PigTrack';

// The endless hunt's difficulty (RunShell.tsx), in the pot ladder slider's
// place on the field: "How hidden: A little tricky" over the slider's track,
// a stop for each difficulty and the pig on the one chosen, Easy and Very
// tricky at its ends. Tap a stop or drag the pig; letting go chooses it
// (`onChange`), and the level is dealt again at once. In the field's look
// (PigTrack.tsx useSliderColors).
export const DIFFICULTIES = ['Easy', 'A little tricky', 'Medium', 'Tricky', 'Very tricky'];
const LAST = DIFFICULTIES.length - 1;

export function DifficultyMeter({ value, onChange }: { value: number; onChange: (d: number) => void }) {
  const ui = useUi();
  const c = useSliderColors('field');
  // Where the pig is while a finger moves it; chosen when it lets go.
  const [moving, setMoving] = useState<number | null>(null);
  const [width, setWidth] = useState(0);
  const shown = moving ?? value;
  const pig = ui.sp(28);

  const stopAt = (e: GestureResponderEvent) => {
    const x = e.nativeEvent.locationX;
    return width > 0 ? Math.max(0, Math.min(LAST, Math.round((x / width) * LAST))) : value;
  };
  const choose = (d: number) => {
    setMoving(null);
    if (d !== value) onChange(d);
  };

  return (
    <View
      style={{ gap: ui.sp(2) }}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="How hidden the truffles are"
      accessibilityValue={{ text: DIFFICULTIES[value] }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => choose(Math.max(0, Math.min(LAST, value + (e.nativeEvent.actionName === 'increment' ? 1 : -1))))}
    >
      <Text style={[styles.words, { fontSize: ui.f(11), color: c.muted }]} maxFontSizeMultiplier={FONT_CAP} numberOfLines={1}>
        How hidden: <Text style={[styles.strong, { color: c.none }]}>{DIFFICULTIES[shown]}</Text>
      </Text>
      {/* Inset by half the pig, so at either end it stays inside the chip. */}
      <View style={{ marginHorizontal: pig / 2 }} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
        <PigTrack
          at={`${(100 * shown) / LAST}%`}
          ticks={DIFFICULTIES.map((name, k) => ({ key: name, at: k / LAST, on: k <= shown }))}
          c={c}
        />
        <View style={styles.ends}>
          <Text style={[styles.end, { fontSize: ui.f(11), color: c.muted }]} maxFontSizeMultiplier={FONT_CAP}>
            {DIFFICULTIES[0]}
          </Text>
          <Text style={[styles.end, { fontSize: ui.f(11), color: c.muted }]} maxFontSizeMultiplier={FONT_CAP}>
            {DIFFICULTIES[LAST]}
          </Text>
        </View>
        {/* The finger on the track, from where it lands to where it lets go. */}
        <View
          style={[StyleSheet.absoluteFill, { top: -ui.sp(6), bottom: -ui.sp(6) }]}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderTerminationRequest={() => false}
          onResponderGrant={(e) => setMoving(stopAt(e))}
          onResponderMove={(e) => setMoving(stopAt(e))}
          onResponderRelease={(e) => choose(stopAt(e))}
          onResponderTerminate={() => setMoving(null)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  words: { fontFamily: font.regular, textAlign: 'center' },
  strong: { fontFamily: font.bold },
  ends: { flexDirection: 'row', justifyContent: 'space-between' },
  end: { fontFamily: font.regular },
});
