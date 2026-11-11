import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { font, type Theme } from '../theme/tokens';
import { useThemedStyles } from '../theme/theme';
import { FONT_CAP, useUi } from '../theme/responsive';
import { useKeyboardInset } from './KeyboardLift';

// A transient message pinned to the bottom of the screen, above the safe area,
// or above the keyboard while one is up (so Join's "no such room" isn't hidden
// behind the keyboard that's still open after tapping Lobby).
// `showToast` from anywhere; ToastOverlay (mounted once, in the root layout
// beside CornerControlsOverlay) shows it. A new message replaces the old one at
// once — unlike Android's system toasts, which queue and each hang around for
// two seconds, so a rapid sequence lags well behind whatever caused it.
// Touches pass straight through it.
//
// It's a small card in the app's own card style (the lobby's: the theme's
// surface, outline and soft shadow), the words centred and wrapping onto more
// lines when they need to, never wider than a comfortable read. It fades in
// and out (no movement, so it stays as it is with reduce motion on), and
// screen readers announce it.

type Listener = (msg: string | null) => void;
let listener: Listener | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

export function showToast(msg: string, ms = 1500) {
  listener?.(msg);
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    listener?.(null);
  }, ms);
}

const FADE_MS = 180;
const NATIVE = Platform.OS !== 'web';

export function ToastOverlay() {
  const ui = useUi();
  const styles = useThemedStyles(makeStyles);
  const keyboard = useKeyboardInset();
  // `shown` stays on the last message while it fades out.
  const [shown, setShown] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const show: Listener = (msg) => {
      opacity.stopAnimation();
      if (msg) {
        setShown(msg);
        if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(msg);
        Animated.timing(opacity, { toValue: 1, duration: FADE_MS, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }).start();
      } else {
        Animated.timing(opacity, { toValue: 0, duration: FADE_MS, easing: Easing.in(Easing.quad), useNativeDriver: NATIVE }).start(
          ({ finished }) => finished && setShown(null)
        );
      }
    };
    listener = show;
    return () => {
      if (listener === show) listener = null;
    };
  }, [opacity]);

  if (!shown) return null;
  return (
    <View
      pointerEvents="none"
      style={[
        styles.overlay,
        {
          bottom: Math.max(ui.insets.bottom, keyboard) + ui.pad,
          left: ui.insets.left + ui.pad,
          right: ui.insets.right + ui.pad,
        },
      ]}
    >
      <Animated.View
        accessibilityLiveRegion="polite"
        style={[
          styles.card,
          {
            opacity,
            maxWidth: ui.sp(340),
            paddingHorizontal: ui.sp(16),
            paddingVertical: ui.sp(10),
            borderRadius: ui.sp(12),
          },
        ]}
      >
        <Text style={[styles.text, { fontSize: ui.f(14), lineHeight: ui.f(19) }]} maxFontSizeMultiplier={FONT_CAP}>
          {shown}
        </Text>
      </Animated.View>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    overlay: { position: 'absolute', zIndex: 10, alignItems: 'center' },
    card: {
      backgroundColor: t.surface,
      borderWidth: Math.max(1, t.edge),
      borderColor: t.surfaceBorder,
      shadowColor: t.shadow,
      shadowOpacity: 0.16,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
    text: { color: t.surfaceText, fontFamily: font.medium, textAlign: 'center' },
  });
