import { Animated, Platform } from 'react-native';

// Props that slide an animated react-native-svg shape along one axis:
//
//   <AnimatedG {...svgShift('y', level)}>
//
// On the phones that's react-native-svg's own translateX / translateY. Its web
// build turns those into an SVG transform too, but also hands them on to the
// DOM element, where React warns about an unknown prop (`translateY`) — so on
// web the move is written as a transform string instead, the animated value
// mapped onto it one to one (Animated interpolates the numbers in a string).
type Motion = Animated.Value | Animated.AnimatedInterpolation<number>;

const FAR = 100000; // any range wider than a move will ever be; it extends beyond it anyway

export function svgShift(axis: 'x' | 'y', by: Motion) {
  if (Platform.OS !== 'web') return axis === 'x' ? { translateX: by } : { translateY: by };
  const at = (n: number) => (axis === 'x' ? `translate(${n} 0)` : `translate(0 ${n})`);
  return { transform: by.interpolate({ inputRange: [-FAR, FAR], outputRange: [at(-FAR), at(FAR)] }) };
}
