import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { font, type Theme } from '../theme/tokens';
import { useThemedStyles } from '../theme/theme';
import { FONT_CAP, useUi } from '../theme/responsive';

// A transient message pinned to the bottom of the screen, above the safe area.
// `showToast` from anywhere; ToastOverlay (mounted once, in the root layout
// beside ThemeToggleOverlay) shows it. A new message replaces the old one at
// once — unlike Android's system toasts, which queue and each hang around for
// two seconds, so a rapid sequence lags well behind whatever caused it.
// Touches pass straight through it.

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

export function ToastOverlay() {
  const ui = useUi();
  const styles = useThemedStyles(makeStyles);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    listener = setMsg;
    return () => {
      if (listener === setMsg) listener = null;
    };
  }, []);

  if (!msg) return null;
  return (
    <View
      pointerEvents="none"
      style={[
        styles.overlay,
        {
          bottom: ui.insets.bottom + ui.pad,
          left: ui.insets.left + ui.pad,
          right: ui.insets.right + ui.pad,
        },
      ]}
    >
      <Text
        style={[
          styles.pill,
          {
            fontSize: ui.f(13),
            paddingHorizontal: ui.sp(14),
            paddingVertical: ui.sp(8),
            borderRadius: ui.sp(999),
          },
        ]}
        maxFontSizeMultiplier={FONT_CAP}
      >
        {msg}
      </Text>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    overlay: { position: 'absolute', zIndex: 10, alignItems: 'center' },
    pill: {
      color: t.overlayText,
      backgroundColor: t.overlay,
      fontFamily: font.medium,
      overflow: 'hidden',
      textAlign: 'center',
    },
  });
