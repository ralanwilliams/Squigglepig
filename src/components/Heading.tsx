import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { font, type Theme } from '../theme/tokens';
import { useThemedStyles } from '../theme/theme';
import { FONT_CAP, useUi } from '../theme/responsive';

// Centered headings on the teal background (equivalent to the original's
// <h3>/<h4> with `.text-center`, dark bootstrap text color).
export function Heading({
  children,
  size = 'h4',
  lines,
}: {
  children: React.ReactNode;
  size?: 'h3' | 'h4';
  lines?: number; // cap the height; shrinks the text to fit instead of growing
}) {
  const ui = useUi();
  const styles = useThemedStyles(makeStyles);
  return (
    <Text
      style={[
        size === 'h3' ? styles.h3 : styles.h4,
        { fontSize: ui.f(size === 'h3' ? 24 : 18) },
      ]}
      maxFontSizeMultiplier={FONT_CAP}
      numberOfLines={lines}
      adjustsFontSizeToFit={!!lines}
    >
      {children}
    </Text>
  );
}

const makeStyles = (t: Theme) => {
  const base = { color: t.text, textAlign: 'center' as const };
  return StyleSheet.create({
    h3: { ...base, fontFamily: font.medium },
    h4: { ...base, fontFamily: font.regular },
  });
};
