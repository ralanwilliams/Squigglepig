import React, { useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { font } from '../theme/tokens';
import { FONT_CAP, useUi } from '../theme/responsive';
import { useFieldColors } from './fieldColors';

// The endless hunt's lock (RunShell.tsx), on a chip's disc beside the light /
// dark switch. A tap locks it. Locked, it's amber, and only holding it for
// HOLD_MS lets go: a ring fills round it as it's held, "Keep holding…" under
// it; let go sooner and the ring empties and it stays locked. A child can tap
// it all they like.
export const HOLD_MS = 3000;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function Padlock({ locked, onLock, onUnlock }: { locked: boolean; onLock: () => void; onUnlock: () => void }) {
  const ui = useUi();
  const fc = useFieldColors();
  const held = useRef(new Animated.Value(0)).current;
  const [holding, setHolding] = useState(false);
  // Whether the press now under way began locked: the tap that ends a hold
  // (unlocked by then) mustn't lock it again.
  const fromLocked = useRef(false);

  const press = () => {
    if (!fromLocked.current) onLock();
  };
  const hold = () => {
    fromLocked.current = locked;
    if (!locked) return;
    setHolding(true);
    held.setValue(0);
    Animated.timing(held, { toValue: 1, duration: HOLD_MS, easing: Easing.linear, useNativeDriver: false }).start(({ finished }) => {
      if (!finished) return;
      setHolding(false);
      held.setValue(0);
      onUnlock();
    });
  };
  const release = () => {
    if (!holding) return;
    held.stopAnimation();
    setHolding(false);
    Animated.timing(held, { toValue: 0, duration: 200, useNativeDriver: false }).start();
  };

  const box = ui.sp(44);
  const disc = ui.sp(36);
  const r = box / 2 - ui.sp(2);
  const round = 2 * Math.PI * r;
  const ink = locked ? fc.amberText : fc.text;
  return (
    <View style={{ width: box, height: box }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={locked ? 'Locked. Hold for 3 seconds to unlock.' : 'Lock the screen'}
        accessibilityActions={locked ? [{ name: 'longpress' }] : undefined}
        onAccessibilityAction={locked ? onUnlock : undefined}
        onPress={press}
        onPressIn={hold}
        onPressOut={release}
        hitSlop={6}
        style={styles.center}
      >
        <View
          style={[
            styles.center,
            { width: disc, height: disc, borderRadius: disc / 2, borderWidth: 1 },
            locked ? { backgroundColor: fc.amber, borderColor: fc.amber } : { backgroundColor: fc.panel, borderColor: fc.line },
            { margin: (box - disc) / 2 },
          ]}
        >
          <Svg width={ui.sp(19)} height={ui.sp(19)} viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <Rect x={5} y={11} width={14} height={10} rx={2} />
            <Path d={locked ? 'M8 11V8a4 4 0 0 1 8 0v3' : 'M8 11V8a4 4 0 0 1 7.6-1.7'} />
          </Svg>
        </View>
      </Pressable>
      {holding ? (
        <>
          <Svg pointerEvents="none" width={box} height={box} style={StyleSheet.absoluteFill}>
            <AnimatedCircle
              cx={box / 2}
              cy={box / 2}
              r={r}
              fill="none"
              stroke={fc.text}
              strokeWidth={ui.sp(3)}
              strokeDasharray={[round, round]}
              strokeDashoffset={held.interpolate({ inputRange: [0, 1], outputRange: [round, 0] })}
              strokeLinecap="round"
              transform={`rotate(-90 ${box / 2} ${box / 2})`}
            />
          </Svg>
          <View
            pointerEvents="none"
            style={[styles.tip, { top: box + ui.sp(4), backgroundColor: fc.panel, borderColor: fc.line, paddingVertical: ui.sp(5), paddingHorizontal: ui.sp(12) }]}
          >
            <Text style={[styles.tipText, { color: fc.text, fontSize: ui.f(12) }]} maxFontSizeMultiplier={FONT_CAP} numberOfLines={1}>
              Keep holding…
            </Text>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  tip: { position: 'absolute', right: 0, borderRadius: 999, borderWidth: 1 },
  tipText: { fontFamily: font.regular },
});
