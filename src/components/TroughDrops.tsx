import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { ClipPath, Defs, G, Path } from 'react-native-svg';
import { PROPS, type Prop, type PropName } from '../theme/skins/props';
import { TROUGH_ITEM, troughScale, troughShaft, type TroughSlot } from '../theme/skins/trough';
import { PropArt } from './SkinDecor';

// Props falling into the trough from the top of the screen. The trough sits
// deep inside clipped containers (FitBox), so a prop can't fall from above it
// in its own drawing: instead the trough hands its falling props here — with
// where its drawing is on screen — and TroughDropLayer, mounted once over
// every screen (app/_layout.tsx, like the toasts), draws each one dropping
// from above the top of the screen into its spot. A falling prop and its copy
// in the pile share one animated value: this one shows while it falls, the
// pile's the moment it lands. Clipped to the trough's cavity and the column
// of air above it, so a prop never crosses the trough's wooden sides.

export const TROUGH_LINE = 2.4; // a piled prop's outline, in trough units (the trough's own strokes are 3)

// A drop's timing: it falls (speeding up) for the first 70%, then settles
// with two small bounces. Easing.bounce bounces back a quarter of the way up,
// which from the top of the screen would throw a prop halfway back up it.
export function dropEasing(t: number) {
  if (t < 0.7) return (t / 0.7) ** 2;
  const u = (t - 0.7) / 0.3;
  return u < 0.6 ? 1 - 0.05 * Math.sin((Math.PI * u) / 0.6) : 1 - 0.015 * Math.sin((Math.PI * (u - 0.6)) / 0.4);
}

// Where a trough's drawing (400 × 168 units) is in the window: left, top, width.
export type TroughFrame = { x: number; y: number; w: number };
export type FallingProp = { key: string; slot: TroughSlot; name: PropName; v: Animated.Value };

const troughs = new Map<string, { frame: TroughFrame; items: FallingProp[] }>();
let redraw: (() => void) | null = null;

// A trough's props now falling (or null when it goes).
export function showFalling(trough: string, falling: { frame: TroughFrame; items: FallingProp[] } | null) {
  if (falling) troughs.set(trough, falling);
  else troughs.delete(trough);
  redraw?.();
}

const AnimatedG = Animated.createAnimatedComponent(G);

export function TroughDropLayer() {
  const [, setTick] = useState(0);
  // The layer's own place in the window (on web the app sits in a centred frame).
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const ref = useRef<View>(null);
  useEffect(() => {
    redraw = () => setTick((n) => n + 1);
    return () => {
      redraw = null;
    };
  }, []);
  const onLayout = () => ref.current?.measureInWindow((x, y) => setOrigin({ x, y }));

  return (
    <View ref={ref} onLayout={onLayout} pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
        {[...troughs.entries()].map(([id, { frame, items }]) => {
          const k = frame.w / 400;
          // Where falls start: off the top of the screen by two props' height
          // (they're up to 1.25 × TROUGH_ITEM long, and tumbled), in the trough's units.
          const start = -(frame.y - origin.y) / k - 2 * TROUGH_ITEM;
          const clip = `shaft-${id.replace(/[^\w-]/g, '')}`;
          return (
            <G key={id} transform={`translate(${frame.x - origin.x} ${frame.y - origin.y}) scale(${k})`}>
              <Defs>
                <ClipPath id={clip}>
                  <Path d={troughShaft(start - TROUGH_ITEM)} />
                </ClipPath>
              </Defs>
              <G clipPath={`url(#${clip})`}>
                {items.map((it) => (
                  <AnimatedG
                    key={it.key}
                    translateY={it.v.interpolate({ inputRange: [0, 1], outputRange: [start - it.slot.y, 0] })}
                    opacity={it.v.interpolate({ inputRange: [0, 0.999, 1], outputRange: [1, 1, 0] })}
                  >
                    <PileArt slot={it.slot} name={it.name} />
                  </AnimatedG>
                ))}
              </G>
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

// One prop at its spot in the pile: sized by troughScale and tipped
// by the slot's lean (a plain group: react-native-svg drops a group's x / y on
// a normal render, so animation goes on a group around this one).
export function PileArt({ slot, name }: { slot: TroughSlot; name: PropName }) {
  const prop: Prop = PROPS[name];
  const k = troughScale(prop.w, prop.h) * (prop.pile ?? 1); // trough units per grid unit
  return (
    <G transform={`translate(${slot.x} ${slot.y}) rotate(${slot.rotate}) scale(${k}) translate(${-prop.w / 2} ${-prop.h / 2})`}>
      <PropArt prop={prop} line={TROUGH_LINE / k} />
    </G>
  );
}
