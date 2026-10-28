import React from 'react';
import { Text, type TextProps } from 'react-native';
import { useTheme } from '../theme/theme';

// Text that looks cut into the surface it's on, lit from above: the cut's
// upper wall falls in shadow and its lower edge catches the light. Which of
// the two shows depends on the letters: dark letters (`ink="dark"`) get a lit
// edge under them, light ones (`ink="light"`) a shadow along their tops. The
// letters keep their own color, so they read as well as plain text would.
// High contrast prints them plainly.
const LIT_EDGE = 'rgba(255, 255, 255, 0.6)';
const SHADOW_EDGE = 'rgba(0, 0, 0, 0.6)';

export function CarvedText({ ink, style, ...props }: TextProps & { ink: 'dark' | 'light' }) {
  const plain = useTheme().contrast === 'high';
  const cut = plain
    ? null
    : ink === 'dark'
      ? { textShadowColor: LIT_EDGE, textShadowOffset: { width: 0, height: 1.2 }, textShadowRadius: 0 }
      : { textShadowColor: SHADOW_EDGE, textShadowOffset: { width: 0, height: -1.5 }, textShadowRadius: 0 };
  return <Text {...props} style={[style, cut]} />;
}
