import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { SOUNDS } from '../../../assets/assets';
import { playSound } from '../../../lib/sound';
import { PIG, standAt, type Spot } from './layout';

// The little pig that trots to each truffle found and snuffles it up. It's
// drawn side on, facing right, in the app pig's pink and black line, on a
// 62 × 44 grid; the head is a group of its own so it can dip. The dip runs
// on the JS driver (SVG can't take the native one), a frame at a time for
// half a second.
//
// usePigWalk keeps the queue: a find goes on it at once (the tap has already
// marked the truffle), and the pig works through them in order, walking over
// so its snout is at the truffle, snuffling, and only then moving on (its
// size, pace and where it stops are layout.ts PIG and standAt, which the
// round's timing is worked out from). With
// reduced motion it doesn't walk or dip its head, but it takes as long: it
// waits out the walk where it is, then it's there, so the route the taps
// make costs the same time either way.

const W = 62;
const H = 44;
const INK = '#1a1a1a';
const PINK = '#F6A0B5';
const PINK_DARK = '#E3879E';
const STEP_MS = 110; // each swap of the legs while walking
const SNUFFLE_MS = 520;
const NATIVE = Platform.OS !== 'web';
const NECK = { x: 42, y: 22 }; // where the head turns, on the grid
const DIP = 16; // degrees, the head all the way down

function Leg({ x, swing, color }: { x: number; swing: number; color: string }) {
  return (
    <G transform={`rotate(${swing} ${x + 2.3} 27)`}>
      <Rect x={x} y={27} width={4.6} height={14} rx={1.6} fill={color} stroke={INK} strokeWidth={1.4} />
      <Rect x={x} y={38.6} width={4.6} height={3} rx={1} fill={INK} />
    </G>
  );
}

// The head's dip, in degrees, followed from `head` (0 up, 1 down) on the JS
// side so the head can stay in the body's drawing: rotating a separate layer
// over it lost the head on device.
function useTilt(head: Animated.Value) {
  const [tilt, setTilt] = useState(0);
  useEffect(() => {
    const id = head.addListener(({ value }) => setTilt(value * DIP));
    return () => head.removeListener(id);
  }, [head]);
  return tilt;
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
  const tilt = useTilt(head);
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
        <G transform={`rotate(${tilt} ${NECK.x} ${NECK.y})`}>
          <Path d="M45 9L50 2L53 11Z" fill={PINK_DARK} stroke={INK} strokeWidth={1.3} strokeLinejoin="round" />
          <Circle cx={47} cy={18} r={10.5} fill={PINK} stroke={INK} strokeWidth={1.6} />
          <Path d="M41 10L42 1L49 8Z" fill={PINK} stroke={INK} strokeWidth={1.3} strokeLinejoin="round" />
          <Circle cx={46} cy={22} r={2.4} fill={PINK_DARK} opacity={0.7} />
          <Circle cx={50} cy={14.5} r={1.3} fill={INK} />
          <Ellipse cx={57} cy={19.5} rx={3.8} ry={5} fill="#F9BCCB" stroke={INK} strokeWidth={1.5} />
          <Ellipse cx={57.6} cy={17.8} rx={0.7} ry={1.1} fill={INK} />
          <Ellipse cx={57.6} cy={21.4} rx={0.7} ry={1.1} fill={INK} />
        </G>
      </Svg>
    </View>
  );
}

// The pig's walk through the finds. `spots` are where it may be sent (the
// truffles, then any empty piles); `onEat(i)` is called as the pig snuffles
// spot i up (or noses through it). `s` is the UI scale, `speed` its trot in
// dp a second before it. `stand` is where it's standing, once it's there.
export function usePigWalk(
  spots: Spot[],
  start: { x: number; y: number },
  s: number,
  reduced: boolean,
  onEat: (i: number) => void,
  speed = PIG.speed
) {
  const scale = (PIG.len * s) / W;
  const place = (p: { x: number; y: number }) => ({ x: p.x - (W / 2) * scale, y: p.y - 26 * scale });
  const pos = useRef(new Animated.ValueXY(place(start))).current;
  const head = useRef(new Animated.Value(0)).current;
  const at = useRef(start);
  const [stand, setStand] = useState(start);
  const queue = useRef<number[]>([]);
  const busy = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [facing, setFacing] = useState<1 | -1>(1);
  const [walking, setWalking] = useState(false);
  const eat = useRef(onEat);
  eat.current = onEat;
  const live = useRef({ spots, reduced, s, speed });
  live.current = { spots, reduced, s, speed };

  // A new field (the phone turned, so the truffles moved): start over from
  // the middle, the queue kept.
  const startKey = `${Math.round(start.x)},${Math.round(start.y)}`;
  useEffect(() => {
    at.current = start;
    setStand(start);
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
    const { spots: list, reduced: still, s: k, speed: v } = live.current;
    const t = list[i];
    if (!t) return next();
    const { dir, ...to } = standAt(at.current, t, k);
    const ms = Math.max(PIG.minWalk, Math.hypot(to.x - at.current.x, to.y - at.current.y) / (v * k)) * 1000;
    at.current = to;
    setFacing(dir);
    const arrive = () => {
      setWalking(false);
      setStand(to);
      playSound(SOUNDS.grunt, 0.15);
      if (!still) {
        Animated.sequence(
          [1, 0.25, 1, 0].map((v) => Animated.timing(head, { toValue: v, duration: SNUFFLE_MS / 4, useNativeDriver: false }))
        ).start();
      }
      later(PIG.eatAt * 1000, () => eat.current(i));
      later(PIG.rest * 1000, next);
    };
    if (still) {
      later(ms, () => {
        pos.setValue(place(to));
        arrive();
      });
      return;
    }
    setWalking(true);
    Animated.timing(pos, { toValue: place(to), duration: ms, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE }).start(({ finished }) => {
      if (finished) arrive();
    });
  };

  const go = (i: number) => {
    queue.current.push(i);
    if (!busy.current) next();
  };

  return { go, pos, head, facing, walking, scale, stand };
}
