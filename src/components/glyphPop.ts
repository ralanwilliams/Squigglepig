import { Animated } from 'react-native';

// Props for a part of an SVG glyph that pops in and shrinks away on `v`
// (0 = gone, 1 = full size; an overshoot past 1 is kept). Spread them on an
// Animated <G>: the sound switch's ✕ (SoundToggle) and the moon's stars
// (ThemeToggle).
//
// Scale alone isn't enough: react-native-svg reads a scale of exactly 0 as
// "no scale" and draws the part full size (on the phones; the web build
// doesn't), so a part at rest at 0 never disappears. The scale here stops a
// hair above 0, and the part fades out as it reaches 0, so it's gone either way.
export const glyphPop = (v: Animated.Value) => ({
  scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.001, 1] }),
  opacity: v.interpolate({ inputRange: [0, 0.001, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' }),
});
