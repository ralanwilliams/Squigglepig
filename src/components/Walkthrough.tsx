import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname } from 'expo-router';
import { Stage } from './Stage';
import { PigButton } from './PigButton';
import { PageDots } from './PageDots';
import { useSlideIn } from './SwipePager';
import { useSwipe } from '../lib/useSwipe';
import { ChainScene, DrawScene, GatherScene, HostScene, PromptsScene, ScoreScene } from './WalkthroughScenes';
import { font, type Theme } from '../theme/tokens';
import { useThemedStyles } from '../theme/theme';
import { ANY_WAY_UP, FONT_CAP, useUi } from '../theme/responsive';
import { closeWalkthrough, markTutorialDone, useWalkthroughOpen } from '../lib/tutorial';

// The first-run walkthrough: six steps, each a looping animation with one
// line under it, laid out on the same Stage as every other screen (scene where
// the pig goes, caption and buttons in the controls pane). Next / swipe to go
// on, Skip to leave. It replaces the old "Learn to Squiggle" paragraph.
//
// Mounted once, in the root layout, and opened with showWalkthrough()
// (src/lib/tutorial.ts): by Home on a first launch, and by the menu's "How to
// play" row on any screen with the menu. Finishing or skipping it records
// that it's been seen, so it never opens on its own again. Going to another
// screen closes it without that (the host starting a game while it's open
// over the lobby).
export function WalkthroughOverlay() {
  const visible = useWalkthroughOpen();
  const pathname = usePathname();
  const at = useRef(pathname);
  useEffect(() => {
    if (pathname === at.current) return;
    at.current = pathname;
    closeWalkthrough();
  }, [pathname]);
  const done = () => {
    markTutorialDone();
    closeWalkthrough();
  };
  return <Walkthrough visible={visible} onDone={done} />;
}

const STEPS = [
  { Scene: HostScene, caption: 'The host taps Create Game, then shares the room code.' },
  { Scene: GatherScene, caption: 'Get 3 to 12 players into one room.' },
  { Scene: PromptsScene, caption: 'Everyone writes a prompt. It’s passed on for someone else to draw.' },
  { Scene: DrawScene, caption: 'Draw the prompt you’re handed.' },
  { Scene: ChainScene, caption: 'Guess the drawing you’re passed. Your guess gets drawn next.' },
  { Scene: ScoreScene, caption: 'The prompt’s writer scores the matches. First to the target wins!' },
];
const LAST = STEPS.length - 1;

function Walkthrough({ visible, onDone }: { visible: boolean; onDone: () => void }) {
  const ui = useUi();
  const styles = useThemedStyles(makeStyles);
  const [step, setStep] = useState(0);
  const last = step === LAST;

  // Every opening starts from the first step (the menu's "How to play" replays it).
  useEffect(() => {
    if (visible) setStep(0);
  }, [visible]);

  const go = (to: number) => setStep(Math.max(0, Math.min(LAST, to)));
  const next = () => (last ? onDone() : go(step + 1));

  // Each step slides in from the side it came from (with reduced motion it
  // just appears). Swipe left / right between steps (never past the ends:
  // finishing is a tap).
  const slide = useSlideIn(step);
  const stepRef = useRef(step);
  stepRef.current = step;
  const swipe = useSwipe(
    () => setStep((s) => Math.min(LAST, s + 1)),
    () => setStep((s) => Math.max(0, s - 1))
  );

  const { Scene, caption } = STEPS[step];

  return (
    <Modal
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      supportedOrientations={ANY_WAY_UP}
      // Android back steps back through the walkthrough; it never dismisses it.
      onRequestClose={() => go(stepRef.current - 1)}
    >
      <View style={styles.fill} {...swipe}>
        <Stage
          header={<PageDots count={STEPS.length} index={step} upTo label={`Step ${step + 1} of ${STEPS.length}`} />}
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

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    fill: { flex: 1, minHeight: 0 },
    caption: { color: t.text, fontFamily: font.medium, textAlign: 'center', textAlignVertical: 'center' },
    skip: { alignItems: 'center', justifyContent: 'center' },
    skipText: { color: t.link, fontFamily: font.regular, textDecorationLine: 'underline' },
  });
