import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { font, verdict } from '../theme/tokens';
import { useReducedMotion } from '../theme/theme';

// A big ✓/✗ that springs in over whatever it's laid on, the moment it mounts:
// a ruled cell on the reveal screen (app/reveal.tsx), a scored drawing in the
// memory game. Mounting it when the ruling first appears is what makes every
// player's screen animate it in sync (with reduced motion it is simply there).
// It is a solid disc with a white mark in the fixed verdict colors, so it reads
// the same over a drawing's white paper, a caption bubble or the screen, in
// every palette; the mark — not the color — says which it is. It fills its
// parent and centres the disc there.
export function RuleBadge({ correct, size }: { correct: boolean; size: number }) {
  const reduced = useReducedMotion();
  const a = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) return;
    Animated.spring(a, { toValue: 1, useNativeDriver: true, friction: 5, tension: 90 }).start();
  }, [a, reduced]);
  const disc = Math.round(size * 1.1);
  return (
    <Animated.View
      pointerEvents="none"
      accessible
      accessibilityLabel={correct ? 'Match' : 'No match'}
      style={[
        styles.badge,
        { opacity: a, transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }] },
      ]}
    >
      <View
        style={[
          styles.disc,
          { width: disc, height: disc, borderRadius: disc / 2, borderWidth: Math.max(2, Math.round(disc * 0.05)) },
          { backgroundColor: correct ? verdict.yes : verdict.no },
        ]}
      >
        <Text style={[styles.badgeText, { fontSize: size * 0.7, lineHeight: size * 0.8 }]} maxFontSizeMultiplier={1}>
          {correct ? '✓' : '✗'}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disc: {
    alignItems: 'center',
    justifyContent: 'center',
    // A white ring lifts the disc off the drawing's ink and off the screen.
    borderColor: verdict.mark,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  badgeText: {
    color: verdict.mark,
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
    fontFamily: font.bold,
  },
});
