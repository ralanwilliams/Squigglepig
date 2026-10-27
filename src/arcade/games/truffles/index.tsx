import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, GestureResponderEvent, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { font } from '../../../theme/tokens';
import { useReducedMotion } from '../../../theme/theme';
import { FONT_CAP, useUi } from '../../../theme/responsive';
import { ROUNDS } from '../../engine';
import { useFieldArea } from '../../FieldFrame';
import { useFieldColors } from '../../fieldColors';
import type { Game, RoundProps } from '../index';
import { PIP, Truffle, makeField, type Look, type TruffleArt } from './art';
import { PigSprite, usePigWalk } from './Pig';

// Truffle Hunter: each round scatters truffles over a forest floor that
// fills the screen (art.tsx), and the player taps them all before the clock
// runs out. A tap on bare ground does nothing. A tap marks its truffle at
// once, and a little pig (Pig.tsx) trots over and snuffles it up, in the
// order they were tapped. The clock runs until the pig has eaten the last
// one, so the tapping order is the pig's route: in the last rounds a
// wasteful one runs out of time. Then the round is won: the pig hops for joy
// and "Found them all!" stamps down over the field in a burst of sparks.
// Running out of time loses it, and the ones not found are ringed.
//
// Later rounds bring more truffles, smaller, closer to the soil's color,
// with more clutter, leaves over their edges, and look-alike stones. The
// round fills the screen (Game.fullScreen): the run's clock, pot and Leave
// float over the field (FieldFrame.tsx), with the count here bottom left.

type Spec = Look;

const ease = (round: number) => (round - 1) / (ROUNDS - 1); // 0 on round 1, 1 on the last
// The round's own clock: 25 s for round 1, down to 16 on the last (the
// engine's 23 down to 6 is too short to find nine and walk the pig to them).
// Measured on random fields (Pig.tsx SPEED): on the last rounds a route that
// goes to the nearest truffle next fits with time to spot them, and one that
// zigzags and doubles back runs out.
const seconds = (round: number) => Math.max(16, 26 - round);

function makeRun(): Spec[] {
  return Array.from({ length: ROUNDS }, (_, i) => {
    const e = ease(i + 1);
    return {
      seed: Math.floor(Math.random() * 2 ** 31),
      e,
      count: 3 + Math.round(6 * e), // 3 … 9
      r: 26 - 15 * e, // radius in dp: 26 … 11, each ±20%
      contrast: 1 - 0.5 * e, // how far the truffles' browns are from the soil's
      decoys: Math.round(8 * Math.max(0, e - 0.3)), // look-alike stones from round 5, up to 6
    };
  });
}

const NATIVE = Platform.OS !== 'web';
const HIT_DP = 22; // a tap counts this near a truffle's centre at least (a 44 dp target)
const WON_AFTER_MS = 300; // the last truffle eaten, then the round is won
const CREAM = '#F4EAD9';
const AMBER = '#E2B06A';
const AMBER_TEXT = '#2A1A0E';
const MISSED = '#FF8FB3';
const CELEBRATE_MS = 1500; // the win's cheer, start to finish (RunShell moves on at 1.8 s)
const SPARKS = 14;
const SPARK_COLORS = [AMBER, CREAM, '#F6A0B5'];

const uneaten = (n: number) => `${n} ${n === 1 ? 'truffle was' : 'truffles were'} still on the ground.`;

function Round({ spec, onResult, Frame, ended }: RoundProps<Spec>) {
  const ui = useUi();
  const fc = useFieldColors();
  const [found, setFound] = useState<number[]>([]); // truffles, in the order found
  const [eaten, setEaten] = useState<number[]>([]); // the ones the pig has snuffled up
  const [total, setTotal] = useState(spec.count); // as placed (a cramped field may fit fewer)
  const [stoppedAt, setStoppedAt] = useState<number>();
  const left = useRef(spec.count);
  left.current = total - eaten.length;
  const reported = useRef(false);
  const report = (won: boolean, detail?: string, timedOut?: boolean) => {
    if (reported.current) return;
    reported.current = true;
    onResult(won, detail, timedOut);
  };

  const find = (i: number) => setFound((f) => (f.includes(i) ? f : [...f, i]));
  const eat = useCallback((i: number) => setEaten((e) => (e.includes(i) ? e : [...e, i])), []);
  // The last one eaten: the clock stops there, and a moment later the round
  // is won (unless the clock ran out first).
  const all = total > 0 && eaten.length >= total;
  useEffect(() => {
    if (!all || reported.current) return;
    setStoppedAt(Date.now());
    const timer = setTimeout(() => report(true), WON_AFTER_MS);
    return () => clearTimeout(timer);
  }, [all]);

  return (
    <Frame
      stoppedAt={stoppedAt}
      onExpire={() => report(false, uneaten(left.current), true)}
      focus={<Hunt spec={spec} found={found} eaten={eaten} ended={ended} onPlaced={setTotal} onFind={find} onEat={eat} />}
      controls={
        <View style={[styles.row, { gap: ui.sp(7) }]} accessible accessibilityLabel={`${found.length} of ${total} truffles found`}>
          <Text style={[styles.count, { color: fc.muted, fontSize: ui.f(14) }]} maxFontSizeMultiplier={FONT_CAP}>
            <Text style={[styles.countNum, { color: fc.text }]}>{found.length}</Text> of {total} found
          </Text>
          <View style={[styles.row, { gap: ui.sp(3) }]}>
            {Array.from({ length: total }, (_, i) => (
              <Svg key={i} width={ui.sp(17)} height={ui.sp(14)} viewBox="-12 -10 24 20">
                <Path
                  d={PIP}
                  fill={i < found.length ? fc.amber : 'none'}
                  stroke={i < found.length ? fc.amber : fc.muted}
                  strokeWidth={1.3}
                  strokeDasharray={i < found.length ? undefined : [3, 2.4]}
                />
              </Svg>
            ))}
          </View>
        </View>
      }
    />
  );
}

// The field and everything on it: the floor, the truffles, the leaves over
// them, the marks, the pig, and over it all the layer that takes the taps.
function Hunt({
  spec,
  found,
  eaten,
  ended,
  onPlaced,
  onFind,
  onEat,
}: {
  spec: Spec;
  found: number[];
  eaten: number[];
  ended?: { won: boolean; at: number };
  onPlaced: (n: number) => void;
  onFind: (i: number) => void;
  onEat: (i: number) => void;
}) {
  const ui = useUi();
  const reduced = useReducedMotion();
  const area = useFieldArea();
  // Drawn once per field size: a new one only when the phone turns.
  const box = area && `${Math.round(area.w)},${Math.round(area.h)},${Math.round(area.x0)},${Math.round(area.y0)},${Math.round(area.x1)},${Math.round(area.y1)}`;
  const field = useMemo(() => (area ? makeField(area.w, area.h, area, spec, ui.s) : null), [box, spec, ui.s]);
  const spots = field?.truffles ?? [];
  useEffect(() => {
    if (field) onPlaced(field.truffles.length);
  }, [field]);

  const start = area ? { x: (area.x0 + area.x1) / 2, y: (area.y0 + area.y1) / 2 + ui.sp(30) } : { x: 0, y: 0 };
  const pig = usePigWalk(spots, start, ui.s, reduced, onEat);

  // Taps: the nearest truffle not yet found within reach, else nothing.
  // `claimed` holds the finds at once, so two taps before the next render
  // can't send the pig to one truffle twice.
  const [taps, setTaps] = useState<{ id: number; x: number; y: number; hit: boolean }[]>([]);
  const tapId = useRef(0);
  const claimed = useRef(new Set<number>());
  const tap = (e: GestureResponderEvent) => {
    if (ended || !field) return;
    const { locationX: x, locationY: y } = e.nativeEvent;
    if (x === undefined || y === undefined) return;
    let best = -1;
    let bestD = Infinity;
    spots.forEach((t, i) => {
      if (claimed.current.has(i)) return;
      const d = Math.hypot(t.x - x, t.y - y);
      if (d <= Math.max(t.r * 1.3, ui.sp(HIT_DP)) && d < bestD) {
        best = i;
        bestD = d;
      }
    });
    if (!reduced) {
      const id = ++tapId.current;
      setTaps((list) => [...list.slice(-4), { id, x, y, hit: best >= 0 }]);
    }
    if (best >= 0) {
      claimed.current.add(best);
      onFind(best);
      pig.go(best);
    }
  };

  if (!field || !area) return <View style={[styles.fill, styles.soil]} />;
  const lost = ended && !ended.won;
  return (
    <View style={styles.fill}>
      {field.ground}
      {spots.map((t, i) => (
        <TruffleView key={i} t={t} found={found.includes(i)} gone={eaten.includes(i)} />
      ))}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {field.over}
      </View>
      {spots.map((t, i) =>
        eaten.includes(i) ? (
          <Dug key={i} t={t} />
        ) : found.includes(i) ? (
          <Found key={i} t={t} />
        ) : lost ? (
          <Missed key={i} t={t} />
        ) : null
      )}
      <Animated.View pointerEvents="none" style={[styles.pig, { transform: pig.pos.getTranslateTransform() }]}>
        <Hop on={!!ended?.won}>
          <PigSprite walking={pig.walking} facing={pig.facing} head={pig.head} scale={pig.scale} />
        </Hop>
      </Animated.View>
      {taps.map((t) => (
        <TapRing key={t.id} x={t.x} y={t.y} hit={t.hit} />
      ))}
      {ended?.won ? <Celebrate x={(area.x0 + area.x1) / 2} y={area.y0 + (area.y1 - area.y0) * 0.38} /> : null}
      {/* The taps, as soon as a finger lands. A responder rather than a
          Pressable: its grant comes while the touch is being handled, so
          locationX is there on the web too (a press arrives a moment later,
          when it no longer is). */}
      <View
        style={StyleSheet.absoluteFill}
        onStartShouldSetResponder={() => !ended}
        onResponderGrant={tap}
        accessible
        accessibilityLabel="The forest floor. Tap each truffle you spot."
      />
    </View>
  );
}

// A truffle in its place: it pops when found and fades once eaten.
function TruffleView({ t, found, gone }: { t: TruffleArt; found: boolean; gone: boolean }) {
  const reduced = useReducedMotion();
  const pop = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!found || reduced) return;
    Animated.sequence([
      Animated.timing(pop, { toValue: 1, duration: 150, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }),
      Animated.timing(pop, { toValue: 0.3, duration: 230, useNativeDriver: NATIVE }),
    ]).start();
  }, [found, reduced, pop]);
  useEffect(() => {
    if (gone) Animated.timing(fade, { toValue: 0, duration: reduced ? 0 : 350, useNativeDriver: NATIVE }).start();
  }, [gone, reduced, fade]);
  const R = t.r * 1.4;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.abs,
        { left: t.x - R, top: t.y - R, opacity: fade, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.3] }) }] },
      ]}
    >
      <Truffle t={t} />
    </Animated.View>
  );
}

// Found, waiting for the pig: a cream ring and an amber tick.
function Found({ t }: { t: TruffleArt }) {
  const ui = useUi();
  const reduced = useReducedMotion();
  const p = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (!reduced) Animated.timing(p, { toValue: 1, duration: 320, delay: 120, easing: Easing.out(Easing.back(2)), useNativeDriver: NATIVE }).start();
  }, [p, reduced]);
  const R = t.r * 1.35;
  const tick = ui.sp(14);
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.abs, { left: t.x - R, top: t.y - R, width: 2 * R, height: 2 * R, opacity: p, transform: [{ scale: p }] }]}
    >
      <View style={[styles.ring, { borderRadius: R, borderWidth: ui.sp(2), borderColor: 'rgba(244, 234, 217, 0.85)' }]} />
      <View style={[styles.tick, { width: tick, height: tick, borderRadius: tick / 2, right: R * 0.02, top: R * 0.02 }]}>
        <Svg width={tick * 0.7} height={tick * 0.7} viewBox="0 0 24 24">
          <Path d="M5 12l5 5 9-10" fill="none" stroke={AMBER_TEXT} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </View>
    </Animated.View>
  );
}

// Where the pig has been: a patch of turned earth.
function Dug({ t }: { t: TruffleArt }) {
  const r = t.r;
  return (
    <View pointerEvents="none" style={[styles.abs, { left: t.x - r * 1.3, top: t.y - r * 1.3 }]}>
      <Svg width={r * 2.6} height={r * 2.6} viewBox={`${-r * 1.3} ${-r * 1.3} ${r * 2.6} ${r * 2.6}`}>
        <Ellipse rx={r * 0.9} ry={r * 0.55} fill="#2e1f14" opacity={0.6} />
        {[0, 1, 2, 3, 4, 5].map((j) => {
          const a = j * 1.05 + 0.3;
          return <Circle key={j} cx={Math.cos(a) * r * 1.05} cy={Math.sin(a) * r * 0.65} r={r * 0.12} fill="#4a3426" />;
        })}
      </Svg>
    </View>
  );
}

// Out of time: one that was missed, ringed in pink, pulsing.
function Missed({ t }: { t: TruffleArt }) {
  const ui = useUi();
  const reduced = useReducedMotion();
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(p, { toValue: 1, duration: 450, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE }),
        Animated.timing(p, { toValue: 0, duration: 450, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [p, reduced]);
  const R = t.r * 1.4;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.abs,
        {
          left: t.x - R,
          top: t.y - R,
          width: 2 * R,
          height: 2 * R,
          borderRadius: R,
          borderWidth: ui.sp(3),
          borderColor: MISSED,
          opacity: p.interpolate({ inputRange: [0, 1], outputRange: [1, 0.5] }),
          transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] }) }],
        },
      ]}
    />
  );
}

// Won: the pig hops for joy where it stands, three times, each lower.
function Hop({ on, children }: { on: boolean; children: React.ReactNode }) {
  const ui = useUi();
  const reduced = useReducedMotion();
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!on || reduced) return;
    const hop = (h: number) =>
      Animated.sequence([
        Animated.timing(y, { toValue: -ui.sp(h), duration: 170, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }),
        Animated.timing(y, { toValue: 0, duration: 170, easing: Easing.in(Easing.quad), useNativeDriver: NATIVE }),
      ]);
    Animated.sequence([hop(14), hop(9), hop(5)]).start();
  }, [on, reduced]);
  return <Animated.View style={{ transform: [{ translateY: y }] }}>{children}</Animated.View>;
}

// Won: "Found them all!" stamps down over the field, centred at x, y, in a
// burst of sparks in the field's amber and cream and the pig's pink, then
// rises away. With reduced motion it simply shows.
function Celebrate({ x, y }: { x: number; y: number }) {
  const ui = useUi();
  const reduced = useReducedMotion();
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!reduced) Animated.timing(p, { toValue: 1, duration: CELEBRATE_MS, easing: Easing.linear, useNativeDriver: NATIVE }).start();
  }, [p, reduced]);
  const w = ui.sp(320);
  const h = ui.sp(48);
  const cheer = (
    <Text
      style={[styles.cheer, { fontSize: ui.f(34), textShadowRadius: ui.sp(6) }]}
      maxFontSizeMultiplier={FONT_CAP}
      numberOfLines={1}
      adjustsFontSizeToFit
      accessibilityLiveRegion="polite"
    >
      Found them all!
    </Text>
  );
  const box = { left: x - w / 2, top: y - h / 2, width: w, height: h };
  if (reduced) {
    return (
      <View pointerEvents="none" style={[styles.abs, styles.cheerBox, box]}>
        {cheer}
      </View>
    );
  }
  return (
    <>
      {Array.from({ length: SPARKS }, (_, i) => {
        const a = (i / SPARKS) * 2 * Math.PI + (i % 2) * 0.2;
        const d = ui.sp(i % 2 ? 95 : 135);
        const size = ui.sp(i % 3 === 0 ? 10 : 7);
        const out = (to: number) => p.interpolate({ inputRange: [0, 0.5], outputRange: [0, to], extrapolate: 'clamp', easing: Easing.out(Easing.cubic) });
        return (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={[
              styles.abs,
              {
                left: x - size / 2,
                top: y - size / 2,
                width: size,
                height: size,
                borderRadius: i % 3 === 0 ? ui.sp(2) : size / 2,
                backgroundColor: SPARK_COLORS[i % SPARK_COLORS.length],
                opacity: p.interpolate({ inputRange: [0, 0.05, 0.45, 0.65], outputRange: [0, 1, 1, 0], extrapolate: 'clamp' }),
                transform: [{ translateX: out(Math.cos(a) * d) }, { translateY: out(Math.sin(a) * d) }, { rotate: '45deg' }],
              },
            ]}
          />
        );
      })}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.abs,
          styles.cheerBox,
          box,
          {
            opacity: p.interpolate({ inputRange: [0, 0.08, 0.8, 1], outputRange: [0, 1, 1, 0] }),
            transform: [
              { translateY: p.interpolate({ inputRange: [0.8, 1], outputRange: [0, -ui.sp(24)], extrapolate: 'clamp' }) },
              { scale: p.interpolate({ inputRange: [0, 0.12, 0.2], outputRange: [1.8, 0.92, 1], extrapolate: 'clamp' }) },
            ],
          },
        ]}
      >
        {cheer}
      </Animated.View>
    </>
  );
}

// Where a tap landed: a ring, and on bare ground a little dust.
function TapRing({ x, y, hit }: { x: number; y: number; hit: boolean }) {
  const ui = useUi();
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(p, { toValue: 1, duration: 450, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }).start();
  }, [p]);
  const R = ui.sp(20);
  const fadeOut = p.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] });
  return (
    <View pointerEvents="none" style={[styles.abs, { left: x, top: y }]}>
      <Animated.View
        style={[
          styles.abs,
          {
            left: -R,
            top: -R,
            width: 2 * R,
            height: 2 * R,
            borderRadius: R,
            borderWidth: ui.sp(2.5),
            borderColor: hit ? CREAM : 'rgba(244, 234, 217, 0.5)',
            opacity: fadeOut,
            transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.4] }) }],
          },
        ]}
      />
      {hit
        ? null
        : [0, 1, 2, 3, 4, 5].map((j) => {
            const a = (j / 6) * 2 * Math.PI;
            const d = ui.sp(16);
            const size = ui.sp(5);
            return (
              <Animated.View
                key={j}
                style={[
                  styles.abs,
                  {
                    left: -size / 2,
                    top: -size / 2,
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: j % 2 ? '#c9a272' : '#e0c49a',
                    opacity: fadeOut,
                    transform: [
                      { translateX: p.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(a) * d] }) },
                      { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(a) * d] }) },
                    ],
                  },
                ]}
              />
            );
          })}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  soil: { backgroundColor: '#7b5b3d' },
  abs: { position: 'absolute' },
  pig: { position: 'absolute', left: 0, top: 0 },
  row: { flexDirection: 'row', alignItems: 'center' },
  count: { fontFamily: font.medium },
  countNum: { fontFamily: font.bold },
  ring: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: 'rgba(244, 234, 217, 0.12)' },
  tick: { position: 'absolute', alignItems: 'center', justifyContent: 'center', backgroundColor: AMBER, borderWidth: 1, borderColor: AMBER_TEXT },
  cheerBox: { alignItems: 'center', justifyContent: 'center' },
  cheer: {
    color: CREAM,
    fontFamily: font.bold,
    textAlign: 'center',
    textShadowColor: 'rgba(42, 26, 14, 0.9)',
    textShadowOffset: { width: 0, height: 2 },
  },
});

export const truffles: Game<Spec> = {
  id: 'truffles',
  label: 'Truffle Hunter',
  glyph: 'truffle',
  blurb: 'Tap every truffle on the forest floor before the clock runs out.',
  makeRun,
  Round,
  seconds,
  fullScreen: true,
};
