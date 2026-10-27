import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { SOUNDS } from '../../../assets/assets';
import { playSound } from '../../../lib/sound';
import type { Spot } from './art';

// The little pig that trots to each truffle found and snuffles it up. It's
// drawn side on, facing right, in the app pig's pink and black line, on a
// 62 × 44 grid; the head is a drawing of its own so it can dip.
//
// usePigWalk keeps the queue: a find goes on it at once (the tap has already
// marked the truffle), and the pig works through them in order, walking over
// so its snout is at the truffle, snuffling, and only then moving on. With
// reduced motion it's simply there.

const W = 62;
const H = 44;
const LEN = 58; // dp, nose to tail, before the UI scale
const INK = '#1a1a1a';
const PINK = '#F6A0B5';
const PINK_DARK = '#E3879E';
const STEP_MS = 110; // each swap of the legs while walking
const SPEED = 300; // dp a second, before the UI scale
const SNUFFLE_MS = 520;
const EAT_AT = 180; // into the snuffle, the truffle goes
const REST_MS = 560; // from arriving to setting off for the next
const NATIVE = Platform.OS !== 'web';

function Leg({ x, swing, color }: { x: number; swing: number; color: string }) {
  return (
    <G transform={`rotate(${swing} ${x + 2.3} 27)`}>
      <Rect x={x} y={27} width={4.6} height={14} rx={1.6} fill={color} stroke={INK} strokeWidth={1.4} />
      <Rect x={x} y={38.6} width={4.6} height={3} rx={1} fill={INK} />
    </G>
  );
}

export function PigSprite({ walking, facing, head, scale }: { walking: boolean; facing: 1 | -1; head: Animated.Value; scale: number }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!walking) {
      setStep(0);
      return;
    }
    const id = setInterval(() => setStep((s) => s + 1), STEP_MS);
    return () => clearInterval(id);
  }, [walking]);
  // Diagonal pairs swing together; the body bobs on each step.
  const a = walking ? (step % 2 ? 24 : -24) : 0;
  const bob = walking && step % 2 ? -1.2 : 0;
  const w = W * scale;
  const h = H * scale;
  return (
    <View style={{ width: w, height: h, transform: [{ scaleX: facing }, { translateY: bob * scale }] }}>
      <Svg width={w} height={h} viewBox={`0 0 ${W} ${H}`}>
        <Path d="M11 21c-5 0-7-4-5-7s5-1 4 2-3 3-5 2" fill="none" stroke={INK} strokeWidth={1.5} strokeLinecap="round" />
        <Leg x={19} swing={-a} color={PINK_DARK} />
        <Leg x={41} swing={a} color={PINK_DARK} />
        <Leg x={13} swing={a} color={PINK} />
        <Leg x={35} swing={-a} color={PINK} />
        <Ellipse cx={29} cy={23} rx={19} ry={11.5} fill={PINK} stroke={INK} strokeWidth={1.6} />
        <Ellipse cx={25} cy={17} rx={9} ry={3} fill="#ffffff" opacity={0.35} />
      </Svg>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            transformOrigin: `${(42 / W) * 100}% ${(22 / H) * 100}%`,
            transform: [{ rotate: head.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '16deg'] }) }],
          },
        ]}
      >
        <Svg width={w} height={h} viewBox={`0 0 ${W} ${H}`}>
          <Path d="M45 9L50 2L53 11Z" fill={PINK_DARK} stroke={INK} strokeWidth={1.3} strokeLinejoin="round" />
          <Circle cx={47} cy={18} r={10.5} fill={PINK} stroke={INK} strokeWidth={1.6} />
          <Path d="M41 10L42 1L49 8Z" fill={PINK} stroke={INK} strokeWidth={1.3} strokeLinejoin="round" />
          <Circle cx={46} cy={22} r={2.4} fill={PINK_DARK} opacity={0.7} />
          <Circle cx={50} cy={14.5} r={1.3} fill={INK} />
          <Ellipse cx={57} cy={19.5} rx={3.8} ry={5} fill="#F9BCCB" stroke={INK} strokeWidth={1.5} />
          <Ellipse cx={57.6} cy={17.8} rx={0.7} ry={1.1} fill={INK} />
          <Ellipse cx={57.6} cy={21.4} rx={0.7} ry={1.1} fill={INK} />
        </Svg>
      </Animated.View>
    </View>
  );
}

// The pig's walk through the finds. `spots` are the truffles; `onEat(i)` is
// called as the pig snuffles truffle i up. `s` is the UI scale.
export function usePigWalk(spots: Spot[], start: { x: number; y: number }, s: number, reduced: boolean, onEat: (i: number) => void) {
  const scale = (LEN * s) / W;
  const place = (p: { x: number; y: number }) => ({ x: p.x - (W / 2) * scale, y: p.y - 26 * scale });
  const pos = useRef(new Animated.ValueXY(place(start))).current;
  const head = useRef(new Animated.Value(0)).current;
  const at = useRef(start);
  const queue = useRef<number[]>([]);
  const busy = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [facing, setFacing] = useState<1 | -1>(1);
  const [walking, setWalking] = useState(false);
  const eat = useRef(onEat);
  eat.current = onEat;
  const live = useRef({ spots, reduced, s });
  live.current = { spots, reduced, s };

  // A new field (the phone turned, so the truffles moved): start over from
  // the middle, the queue kept.
  const startKey = `${Math.round(start.x)},${Math.round(start.y)}`;
  useEffect(() => {
    at.current = start;
    pos.setValue(place(start));
  }, [startKey]);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      pos.stopAnimation();
      head.stopAnimation();
    },
    [pos, head]
  );

  const later = (ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  };

  const next = () => {
    const i = queue.current.shift();
    if (i === undefined) {
      busy.current = false;
      return;
    }
    busy.current = true;
    const { spots: list, reduced: still, s: k } = live.current;
    const t = list[i];
    if (!t) return next();
    const dir: 1 | -1 = t.x >= at.current.x ? 1 : -1;
    // Stop with the snout (27 grid units ahead of the middle) at the truffle's edge.
    const to = { x: t.x - dir * (t.r * 0.6 + 27 * scale), y: t.y + 7 * scale };
    const ms = still ? 0 : Math.max(280, Math.min(1100, (Math.hypot(to.x - at.current.x, to.y - at.current.y) / (SPEED * k)) * 1000));
    at.current = to;
    setFacing(dir);
    setWalking(!still);
    Animated.timing(pos, { toValue: place(to), duration: ms, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE }).start(({ finished }) => {
      if (!finished) return;
      setWalking(false);
      if (!still) {
        playSound(SOUNDS.grunt, 0.15);
        Animated.sequence(
          [1, 0.25, 1, 0].map((v) => Animated.timing(head, { toValue: v, duration: SNUFFLE_MS / 4, useNativeDriver: NATIVE }))
        ).start();
      }
      later(still ? 0 : EAT_AT, () => eat.current(i));
      later(still ? 0 : REST_MS, next);
    });
  };

  const go = (i: number) => {
    queue.current.push(i);
    if (!busy.current) next();
  };

  return { go, pos, head, facing, walking, scale };
}
