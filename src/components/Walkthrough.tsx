import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Modal, PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stage } from './Stage';
import { PigButton } from './PigButton';
import { ChainScene, DrawScene, GatherScene, PromptsScene, ScoreScene } from './WalkthroughScenes';
import { font, type Theme } from '../theme/tokens';
import { useReducedMotion, useThemedStyles } from '../theme/theme';
import { FONT_CAP, useUi } from '../theme/responsive';

// The first-run walkthrough: five steps, each a looping animation with one
// line under it, laid out on the same Stage as every other screen (scene where
// the pig goes, caption and buttons in the controls pane). Next / swipe to go
// on, Skip to leave; finishing or skipping calls onDone, which Home records
// (src/lib/tutorial.ts) so it never opens on its own again; the menu's "How to
// play" row replays it. It replaces the old "Learn to Squiggle" paragraph.
const STEPS = [
  { Scene: GatherScene, caption: 'Get 3 or more players into one room.' },
  { Scene: PromptsScene, caption: 'Everyone fills the trough with prompts.' },
  { Scene: DrawScene, caption: 'Draw the prompt you’re handed.' },
  { Scene: ChainScene, caption: 'Guess the drawing you’re passed. Your guess gets drawn next.' },
  { Scene: ScoreScene, caption: 'The prompt’s writer scores the matches. First to the target wins!' },
];
const LAST = STEPS.length - 1;
const NATIVE = Platform.OS !== 'web';

export function Walkthrough({ visible, onDone }: { visible: boolean; onDone: () => void }) {
  const ui = useUi();
  const styles = useThemedStyles(makeStyles);
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);
  const last = step === LAST;

  // Every opening starts from the first step (the menu's "How to play" replays it).
  useEffect(() => {
    if (visible) setStep(0);
  }, [visible]);

  const go = (to: number) => setStep(Math.max(0, Math.min(LAST, to)));
  const next = () => (last ? onDone() : go(step + 1));

  // Each step slides in from the side it came from (with reduced motion it
  // just appears).
  const enter = useRef(new Animated.Value(1)).current;
  const dir = useRef(1);
  const prev = useRef(step);
  useEffect(() => {
    dir.current = step >= prev.current ? 1 : -1;
    prev.current = step;
    if (reduced) {
      enter.setValue(1);
      return;
    }
    enter.setValue(0);
    Animated.timing(enter, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE }).start();
  }, [step, enter, reduced]);

  // Swipe left / right between steps (never past the ends: finishing is a tap).
  const stepRef = useRef(step);
  stepRef.current = step;
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 16 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderRelease: (_, g) => {
          if (g.dx < -48) setStep((s) => Math.min(LAST, s + 1));
          else if (g.dx > 48) setStep((s) => Math.max(0, s - 1));
        },
      }),
    []
  );

  const { Scene, caption } = STEPS[step];
  const slide = {
    opacity: enter,
    transform: [{ translateX: enter.interpolate({ inputRange: [0, 1], outputRange: [dir.current * ui.sp(28), 0] }) }],
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      // Android back steps back through the walkthrough; it never dismisses it.
      onRequestClose={() => go(stepRef.current - 1)}
    >
      <View style={styles.fill} {...pan.panHandlers}>
        <Stage
          header={<Dots step={step} />}
          focus={
            <Animated.View key={step} style={[styles.fill, slide]}>
              <Scene />
            </Animated.View>
          }
          actions={
            <>
              <Animated.View style={slide}>
                <Text
                  style={[styles.caption, { fontSize: ui.f(18), lineHeight: ui.f(25), minHeight: ui.f(25) * 2 }]}
                  maxFontSizeMultiplier={FONT_CAP}
                  accessibilityLiveRegion="polite"
                >
                  {caption}
                </Text>
              </Animated.View>
              <PigButton name={last ? 'Let’s play!' : 'Next'} onPress={next} silent={!last} />
              {/* Kept on the last step (just hidden) so the button doesn't jump. */}
              <Pressable
                accessibilityRole="button"
                accessibilityElementsHidden={last}
                importantForAccessibility={last ? 'no-hide-descendants' : 'auto'}
                disabled={last}
                onPress={onDone}
                hitSlop={8}
                style={[styles.skip, { minHeight: ui.sp(36), paddingVertical: ui.sp(8), opacity: last ? 0 : 1 }]}
              >
                <Text style={[styles.skipText, { fontSize: ui.f(14) }]} maxFontSizeMultiplier={FONT_CAP}>
                  Skip
                </Text>
              </Pressable>
            </>
          }
        />
      </View>
    </Modal>
  );
}

// Progress: one dot per step; the current one stretches into a pill.
function Dots({ step }: { step: number }) {
  const ui = useUi();
  const styles = useThemedStyles(makeStyles);
  const reduced = useReducedMotion();
  const widths = useRef(STEPS.map((_, i) => new Animated.Value(i === step ? 1 : 0))).current;
  useEffect(() => {
    if (reduced) {
      widths.forEach((w, i) => w.setValue(i === step ? 1 : 0));
      return;
    }
    Animated.parallel(
      widths.map((w, i) =>
        Animated.timing(w, { toValue: i === step ? 1 : 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: false })
      )
    ).start();
  }, [step, widths, reduced]);

  const d = ui.sp(8);
  return (
    <View
      style={[styles.dots, { gap: ui.sp(8) }]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${step + 1} of ${STEPS.length}`}
    >
      {widths.map((w, i) => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            i <= step && styles.dotDone,
            { height: d, borderRadius: d / 2, width: w.interpolate({ inputRange: [0, 1], outputRange: [d, d * 3] }) },
          ]}
        />
      ))}
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    fill: { flex: 1, minHeight: 0 },
    caption: { color: t.text, fontFamily: font.medium, textAlign: 'center', textAlignVertical: 'center' },
    skip: { alignItems: 'center', justifyContent: 'center' },
    skipText: { color: t.link, fontFamily: font.regular, textDecorationLine: 'underline' },
    dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
    dot: { backgroundColor: t.divider },
    dotDone: { backgroundColor: t.link },
  });
