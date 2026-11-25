import React, { forwardRef, type ComponentType } from 'react';
import { Animated, Platform } from 'react-native';

// An Animated version of a react-native-svg shape (G, Circle, Path, Rect, …):
//
//   const AnimatedG = animatedSvg(G);
//
// On the phones that's just Animated.createAnimatedComponent. On web, Animated
// marks every animated component `collapsable={false}` (a hint for the native
// view tree), and react-native-svg's web build hands that on to the DOM
// element, where React warns about it ("Received `false` for a non-boolean
// attribute"). So on web it's dropped on the way. (The same web build turns
// originX / originY into a `transform-origin` prop React warns about too:
// scale or turn a group about a point by nesting it between two translates
// instead, as SoundToggle and ThemeToggle do.)
export function animatedSvg<C extends ComponentType<any>>(Shape: C) {
  if (Platform.OS !== 'web') return Animated.createAnimatedComponent(Shape);
  const Clean = forwardRef<unknown, { collapsable?: boolean }>(({ collapsable: _native, ...rest }, ref) => {
    const S = Shape as ComponentType<any>;
    return <S {...rest} ref={ref} />;
  });
  Clean.displayName = `Svg(${Shape.displayName ?? Shape.name ?? 'Shape'})`;
  return Animated.createAnimatedComponent(Clean as unknown as C);
}
