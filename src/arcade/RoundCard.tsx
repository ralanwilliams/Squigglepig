import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SOUNDS } from '../assets/assets';
import { playSound } from '../lib/sound';
import { font } from '../theme/tokens';
import { useReducedMotion, useTheme } from '../theme/theme';
import { FONT_CAP, useUi } from '../theme/responsive';
import { useFieldColors } from './fieldColors';

// The news at the end of a round, popping up as a card: at a new tier the
// choice to keep going or bank it, and a lost round's news, with Play again
// and Done. Every game draws the same card, in one of two looks: over
// a full-screen game's art, the field's quiet dark panel and amber
// (fieldColors.ts; FieldFrame.tsx); over a Stage round (RunShell's
// RoundFrame), the theme's overlay panel and button colors, the app's own
// modal, on a scrim.

export type CardLook = {
  card: string; // the card's fill
  under?: string; // laid under a translucent fill, so what's behind doesn't show through
  border: string; // its edge
  edge: number; // the edge's width
  line: string; // an outlined button's edge
  text: string; // the title, an outlined button's label
  muted: string; // the lines under the title
  main: string; // the first button's fill
  mainText: string; // its label
};

export function useFieldCardLook(): CardLook {
  const fc = useFieldColors();
  return { card: fc.card, border: fc.line, edge: 1, line: fc.line, text: fc.text, muted: fc.muted, main: fc.amber, mainText: fc.amberText };
}

// The theme's overlay (the how-to modal's panel) is a dark panel in every
// palette, its text light, so an outlined button's edge is that text, faint;
// high contrast makes it solid. Translucent, it's laid on the screen's
// background as it is everywhere else, not over the round's answers.
export function useStageCardLook(): CardLook {
  const t = useTheme();
  return {
    card: t.overlay,
    under: t.background,
    border: t.overlayBorder,
    edge: t.edge,
    line: t.contrast === 'high' ? t.overlayText : 'rgba(255, 255, 255, 0.28)',
    text: t.overlayText,
    muted: t.overlayText,
    main: t.button,
    mainText: t.buttonText,
  };
}

const CARD_IN_MS = 380;
export const WON_CARD_DELAY_MS = 1300; // the round's win shows first (a cheer, the answer marked right)
export const LOST_CARD_DELAY_MS = 1400; // the game rings what was missed first (the right answer, the truffles left)
const NATIVE = Platform.OS !== 'web';

// 0 → 1 over CARD_IN_MS after `delay`, for the card and anything that comes
// in with it (RoundFrame's scrim; its overshoot only clamps an opacity).
// With reduced motion it starts at 1.
export function useCardIn(delay: number) {
  const reduced = useReducedMotion();
  const p = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) return;
    Animated.timing(p, { toValue: 1, duration: CARD_IN_MS, delay, easing: Easing.out(Easing.back(1.4)), useNativeDriver: NATIVE }).start();
  }, [p, delay, reduced]);
  return p;
}

export function RoundCard({
  look,
  delay,
  title,
  lines,
  actions,
}: {
  look: CardLook;
  delay: number;
  title?: string;
  lines: string[];
  actions: { name: string; onPress: () => void }[];
}) {
  const ui = useUi();
  const p = useCardIn(delay);
  const radius = ui.sp(16);
  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      style={{
        backgroundColor: look.under,
        width: ui.sp(290),
        borderRadius: radius,
        opacity: p,
        transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
      }}
    >
      <View
        style={{
          backgroundColor: look.card,
          borderColor: look.border,
          borderWidth: look.edge,
          padding: ui.sp(14),
          paddingHorizontal: ui.sp(16),
          gap: ui.sp(6),
          borderRadius: radius,
        }}
      >
        {title ? (
          <Text style={[styles.title, { color: look.text, fontSize: ui.f(21) }]} maxFontSizeMultiplier={FONT_CAP}>
            {title}
          </Text>
        ) : null}
        {lines.map((line) => (
          <Text key={line} style={[styles.line, { color: look.muted, fontSize: ui.f(14) }]} maxFontSizeMultiplier={FONT_CAP}>
            {line}
          </Text>
        ))}
        {actions.length ? (
          <View style={[styles.row, { gap: ui.sp(8), marginTop: ui.sp(6) }]}>
            {actions.map((a, i) => (
              <CardButton key={a.name} name={a.name} onPress={a.onPress} main={i === 0} look={look} />
            ))}
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

// The card's buttons: the first filled, the rest outlined. Like PigButton
// they grunt.
function CardButton({ name, onPress, main, look }: { name: string; onPress: () => void; main: boolean; look: CardLook }) {
  const ui = useUi();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        playSound(SOUNDS.grunt);
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        {
          minHeight: ui.sp(44),
          paddingHorizontal: ui.sp(10),
          borderRadius: ui.sp(8),
          backgroundColor: main ? look.main : 'transparent',
          borderColor: main ? look.main : look.line,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Text
        style={[styles.buttonText, { color: main ? look.mainText : look.text, fontSize: ui.f(14) }]}
        maxFontSizeMultiplier={FONT_CAP}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  title: { fontFamily: font.bold, textAlign: 'center' },
  line: { fontFamily: font.regular, textAlign: 'center' },
  button: { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  buttonText: { fontFamily: font.medium, letterSpacing: 0.3 },
});
