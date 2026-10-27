import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Countdown } from '../components/Countdown';
import { FitBox } from '../components/FitBox';
import { SOUNDS } from '../assets/assets';
import { playSound } from '../lib/sound';
import { font } from '../theme/tokens';
import { useReducedMotion } from '../theme/theme';
import { FONT_CAP, useUi } from '../theme/responsive';
import { useFieldColors, type FieldColors } from './fieldColors';
import { PotLadder } from './PotLadder';
import { RoundCtx } from './RoundCtx';
import type { Frame } from './games';

// What a full-screen game's round is drawn into (Game.fullScreen), in place
// of RunShell's RoundFrame on Stage. The game's `focus` fills the whole
// screen, edge to edge and under the system bars; the run's parts float over
// it as quiet chips (fieldColors.ts): the clock top left, the pot ladder
// slider top centre (in portrait, under the clock), the game's `controls`
// bottom left and Leave bottom right. There's no title; the slider says
// where the run is, as on every arcade screen.
//
// When the round ends its screen stays up. Won, the game shows it on the
// field itself; at a new tier the choice to keep going or bank it then comes
// up as a card between the chips, a beat later so the game's celebration
// plays first (any other win has nothing to show here: RunShell moves on by
// itself). Lost, a card says what happened, with Play again / Done, a beat
// later so the game can show what was missed first.
//
// The game learns where it may put things through useFieldArea(): the whole
// field's size, and the box between the chips at the top and the bottom.

export type FieldArea = {
  w: number; // the field, the whole screen
  h: number;
  x0: number; // the clear box between the chips
  y0: number;
  x1: number;
  y1: number;
};

const AreaCtx = createContext<FieldArea | null>(null);

// The field's size and clear box, once the frame has been laid out (null before).
export const useFieldArea = () => useContext(AreaCtx);

const CARD_IN_MS = 380;
const LOST_CARD_DELAY_MS = 1400; // the game rings what was missed first
const WON_CARD_DELAY_MS = 1300; // the game celebrates first
const NATIVE = Platform.OS !== 'web';

export const FieldFrame: Frame = ({ focus, controls, onExpire, stoppedAt }) => {
  const ui = useUi();
  const fc = useFieldColors();
  const ctx = useContext(RoundCtx);
  if (!ctx) throw new Error('FieldFrame is drawn by RunShell');
  const { settled } = ctx;

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [bands, setBands] = useState({ top: 0, bottom: 0 });
  const onRoot = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.w || height !== size.h) setSize({ w: width, h: height });
  };
  const onTop = (e: LayoutChangeEvent) => {
    const { y, height } = e.nativeEvent.layout;
    if (y + height !== bands.top) setBands((b) => ({ ...b, top: y + height }));
  };
  const onBottom = (e: LayoutChangeEvent) => {
    const { y } = e.nativeEvent.layout;
    if (y !== bands.bottom) setBands((b) => ({ ...b, bottom: y }));
  };
  const margin = ui.sp(4);
  const area: FieldArea | null =
    size.w > 0 && bands.top > 0 && bands.bottom > bands.top
      ? {
          w: size.w,
          h: size.h,
          x0: ui.insets.left + ui.pad,
          y0: bands.top + margin,
          x1: size.w - ui.insets.right - ui.pad,
          y1: bands.bottom - margin,
        }
      : null;

  const wide = size.w > size.h;
  const chip = [styles.chip, { backgroundColor: fc.panel, borderColor: fc.line, paddingVertical: ui.sp(5), paddingHorizontal: ui.sp(12), gap: ui.sp(7) }];
  const clock = (
    <View style={chip}>
      <Countdown
        seconds={ctx.seconds}
        until={ctx.until}
        onExpire={onExpire ?? ctx.expire}
        size={18}
        stoppedAt={stoppedAt ?? settled?.at}
        colors={{ text: fc.text, urgent: fc.urgent }}
      />
    </View>
  );
  const ladder = (
    <View style={[chip, styles.ladder, { borderRadius: ui.sp(14), paddingTop: ui.sp(4), paddingBottom: ui.sp(3) }, wide && { width: ui.sp(290) }]}>
      <PotLadder look="field" won={settled && !settled.lost ? ctx.round : ctx.round - 1} />
    </View>
  );
  const leave = (
    <Pressable accessibilityRole="button" onPress={ctx.leave} hitSlop={8} style={[chip, { minHeight: ui.sp(36) }]}>
      <Text style={[styles.leave, { color: fc.muted, fontSize: ui.f(13) }]} maxFontSizeMultiplier={FONT_CAP}>
        Leave
      </Text>
    </Pressable>
  );
  const disc = ui.sp(36);

  return (
    <View style={styles.fill} onLayout={onRoot}>
      <View style={StyleSheet.absoluteFill}>
        <AreaCtx.Provider value={area}>{focus}</AreaCtx.Provider>
      </View>
      {/* Behind the app's dark-mode toggle (ThemeToggleOverlay), a disc like the chips. */}
      <View
        pointerEvents="none"
        style={[
          styles.disc,
          {
            backgroundColor: fc.panel,
            borderColor: fc.line,
            width: disc,
            height: disc,
            borderRadius: disc / 2,
            top: ui.insets.top + ui.sp(5) + (ui.sp(44) - disc) / 2,
            right: ui.insets.right + ui.pad - ui.sp(9) + (ui.sp(44) - disc) / 2,
          },
        ]}
      />
      <View
        pointerEvents="box-none"
        style={[
          StyleSheet.absoluteFill,
          {
            paddingTop: ui.insets.top + ui.sp(8),
            paddingBottom: ui.insets.bottom + ui.sp(10),
            paddingLeft: ui.insets.left + ui.pad,
            paddingRight: ui.insets.right + ui.pad,
          },
        ]}
      >
        <View pointerEvents="box-none" onLayout={onTop} style={{ gap: ui.sp(8) }}>
          {wide ? (
            <View pointerEvents="box-none" style={styles.row}>
              <View pointerEvents="box-none" style={styles.side}>
                {clock}
              </View>
              {ladder}
              <View pointerEvents="none" style={styles.side} />
            </View>
          ) : (
            <>
              <View pointerEvents="box-none" style={[styles.row, { minHeight: ui.sp(44) }]}>
                {clock}
              </View>
              {ladder}
            </>
          )}
        </View>
        <View pointerEvents="box-none" style={styles.middle}>
          {settled && (settled.lost || settled.actions.length) ? (
            <FitBox style={styles.fill}>
              <View style={styles.center}>
                <Card
                  key={settled.lost ? 'lost' : 'won'}
                  colors={fc}
                  delay={settled.lost ? LOST_CARD_DELAY_MS : WON_CARD_DELAY_MS}
                  title={settled.title}
                  lines={settled.lines}
                  actions={settled.actions}
                />
              </View>
            </FitBox>
          ) : null}
        </View>
        <View
          pointerEvents="box-none"
          onLayout={onBottom}
          style={wide ? [styles.row, styles.between] : [styles.column, { gap: ui.sp(8) }]}
        >
          {controls ? <View style={chip}>{controls}</View> : <View />}
          {leave}
        </View>
      </View>
    </View>
  );
};

// The news at the end of the round, popping up between the chips.
function Card({
  colors: fc,
  delay,
  title,
  lines,
  actions,
}: {
  colors: FieldColors;
  delay: number;
  title?: string;
  lines: string[];
  actions: { name: string; onPress: () => void }[];
}) {
  const ui = useUi();
  const reduced = useReducedMotion();
  const p = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) return;
    Animated.timing(p, { toValue: 1, duration: CARD_IN_MS, delay, easing: Easing.out(Easing.back(1.4)), useNativeDriver: NATIVE }).start();
  }, [p, delay, reduced]);
  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      style={[
        styles.card,
        {
          backgroundColor: fc.card,
          borderColor: fc.line,
          width: ui.sp(290),
          padding: ui.sp(14),
          paddingHorizontal: ui.sp(16),
          gap: ui.sp(6),
          borderRadius: ui.sp(16),
          opacity: p,
          transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
        },
      ]}
    >
      {title ? (
        <Text style={[styles.title, { color: fc.text, fontSize: ui.f(21) }]} maxFontSizeMultiplier={FONT_CAP}>
          {title}
        </Text>
      ) : null}
      {lines.map((line) => (
        <Text key={line} style={[styles.line, { color: fc.muted, fontSize: ui.f(14) }]} maxFontSizeMultiplier={FONT_CAP}>
          {line}
        </Text>
      ))}
      {actions.length ? (
        <View style={[styles.row, { gap: ui.sp(8), marginTop: ui.sp(6) }]}>
          {actions.map((a, i) => (
            <FieldButton key={a.name} name={a.name} onPress={a.onPress} main={i === 0} colors={fc} />
          ))}
        </View>
      ) : null}
    </Animated.View>
  );
}

// The card's buttons: the first filled amber, the rest outlined. Like
// PigButton they grunt.
function FieldButton({ name, onPress, main, colors: fc }: { name: string; onPress: () => void; main: boolean; colors: FieldColors }) {
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
          backgroundColor: main ? fc.amber : 'transparent',
          borderColor: main ? fc.amber : fc.line,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Text
        style={[styles.buttonText, { color: main ? fc.amberText : fc.text, fontSize: ui.f(14) }]}
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
  fill: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  column: { alignItems: 'center' },
  between: { justifyContent: 'space-between', alignItems: 'flex-end' },
  side: { flex: 1, alignItems: 'flex-start' },
  middle: { flex: 1, minHeight: 0 },
  center: { alignItems: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', borderRadius: 999, borderWidth: 1 },
  ladder: { flexDirection: 'column', alignItems: 'stretch' },
  disc: { position: 'absolute', borderWidth: 1 },
  leave: { fontFamily: font.regular, textDecorationLine: 'underline' },
  card: { borderWidth: 1 },
  title: { fontFamily: font.bold, textAlign: 'center' },
  line: { fontFamily: font.regular, textAlign: 'center' },
  button: { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  buttonText: { fontFamily: font.medium, letterSpacing: 0.3 },
});
