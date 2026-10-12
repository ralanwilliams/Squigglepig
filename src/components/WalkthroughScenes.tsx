import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Trough } from './Trough';
import { canvas, font, verdict, type Theme } from '../theme/tokens';
import { useReducedMotion, useTheme, useThemedStyles } from '../theme/theme';

// The first-run walkthrough's illustrations (src/components/Walkthrough.tsx):
// one looping animation per step, built from the game's own pieces (phones,
// the room code, avatars, the trough, the white canvas) so the motion explains
// the step and the caption can stay one line. Prompts and guesses are short
// phrases, as in the game: the fun is in how the words drift.
//
// Every scene is drawn in a fixed 320 × 220 box that SceneBox scales to fit
// its pane, so the coordinates below are the same on every device. Each scene
// runs off ONE value, t, looping 0 → 1; every element is an interpolation of
// it, so a scene is a timeline: 0 – 0.9 plays, 0.9 – 0.98 fades out, repeat.
// With reduced motion on (the OS setting, or the menu's), t is parked on a
// still frame that shows the whole idea and nothing moves.

const W = 320;
const H = 220;
// SVG attributes (the sketch strokes) can't use the native driver, and every
// scene shares its one value across all elements, so the scenes animate in JS.
const JS = { useNativeDriver: false };

// The lobby's avatar palette (app/lobby.tsx).
const AVATAR = ['#DB7093', '#4EA8DE', '#F4A259', '#6A4C93', '#2A9D8F'];

type T = Animated.Value;
const ease = Easing.inOut(Easing.cubic);
const ramp = (t: T, a: number, b: number, from = 0, to = 1, easing = ease) =>
  t.interpolate({ inputRange: [a, b], outputRange: [from, to], extrapolate: 'clamp', easing });
// Scale in with a little overshoot, starting at `a`.
const pop = (t: T, a: number, d = 0.08) =>
  t.interpolate({ inputRange: [a, a + d * 0.7, a + d], outputRange: [0, 1.12, 1], extrapolate: 'clamp' });
// The whole scene: in quickly at the top of the loop, out at the end.
const sceneOpacity = (t: T) =>
  t.interpolate({ inputRange: [0, 0.03, 0.9, 0.98, 1], outputRange: [0, 1, 1, 0, 0] });


// The scene's clock: loops 0 → 1 over `ms`, or rests on `still` when the
// player has reduced motion on.
function useLoop(ms: number, still: number) {
  const t = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) {
      t.setValue(still);
      return;
    }
    t.setValue(0);
    const loop = Animated.loop(Animated.timing(t, { toValue: 1, duration: ms, easing: Easing.linear, ...JS }));
    loop.start();
    return () => loop.stop();
  }, [reduced, t, ms, still]);
  return { t, reduced };
}

// Fits the fixed W × H drawing into whatever space the pane has.
function SceneBox({ t, children }: { t: T; children: React.ReactNode }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== box.w || height !== box.h) setBox({ w: width, h: height });
  };
  const scale = box.w && box.h ? Math.min(box.w / W, box.h / H, 2.4) : 0;
  return (
    <View style={styles.host} onLayout={onLayout} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {scale ? (
        <Animated.View style={[styles.stage, { opacity: sceneOpacity(t), transform: [{ scale }] }]}>{children}</Animated.View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

// A prompt or a guess: a white pill with a short phrase in it.
function Chip({ children, width = 84, style }: { children: string; width?: number; style?: object }) {
  const s = useThemedStyles(makeStyles);
  return (
    <View style={[s.chip, { width }, style]}>
      <Text style={s.chipText} allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit>
        {children}
      </Text>
    </View>
  );
}

function Avatar({ color, size = 26 }: { color: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

// Two drawings, in a 160 × 120 sketch space: the pig in a hat everyone gets
// asked to draw, and the pig in a crown it drifts into down the chain.
// [path, length] — the length lets a stroke draw itself (dash offset).
const HEAD: [string, number][] = [
  ['M46 70a34 34 0 1 0 68 0a34 34 0 1 0 -68 0', 214],
  ['M56 46 L52 30 L68 40', 36],
  ['M104 46 L108 30 L92 40', 36],
  ['M66 78a14 10 0 1 0 28 0a14 10 0 1 0 -28 0', 76],
  ['M75 75v5', 5],
  ['M85 75v5', 5],
  ['M68 60v3', 3],
  ['M92 60v3', 3],
];
const SKETCH = {
  hat: [...HEAD, ['M58 38 H102', 44], ['M68 38 V14 H92 V38', 72]] as [string, number][],
  crown: [...HEAD, ['M62 38 L64 18 L72 28 L80 14 L88 28 L96 18 L98 38 Z', 134]] as [string, number][],
};

const AnimatedPath = Animated.createAnimatedComponent(Path);

// A drawing on the white canvas. With `draw` (0 → 1) it sketches itself one
// stroke after another; without it, it's finished.
function Sketch({ variant, width, draw }: { variant: keyof typeof SKETCH; width: number; draw?: Animated.AnimatedInterpolation<number> }) {
  const s = useThemedStyles(makeStyles);
  const strokes = SKETCH[variant];
  const total = strokes.reduce((n, [, len]) => n + len, 0);
  let done = 0;
  return (
    <View style={[s.canvas, { width, height: (width * 3) / 4, borderRadius: width * 0.06 }]}>
      <Svg width="100%" height="100%" viewBox="0 0 160 120">
        {strokes.map(([d, len], i) => {
          const a = done / total;
          done += len;
          const b = done / total;
          const offset = draw
            ? draw.interpolate({ inputRange: [a, b], outputRange: [len, 0], extrapolate: 'clamp' })
            : 0;
          return (
            <AnimatedPath
              key={i}
              d={d}
              stroke={canvas.ink}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              strokeDasharray={[len, len]}
              strokeDashoffset={offset}
            />
          );
        })}
      </Svg>
    </View>
  );
}

// ---------------------------------------------------------------------------
// 1 · Gather: three phones appear, the room code on the first one flies to the
// others, and a player pops in under each.
// ---------------------------------------------------------------------------
export function GatherScene() {
  const s = useThemedStyles(makeStyles);
  const { t } = useLoop(4200, 0.8);
  const X = [70, 160, 250];
  return (
    <SceneBox t={t}>
      {X.map((cx, i) => (
        <Animated.View key={`p${i}`} style={[s.phone, { left: cx - 31, top: 34, transform: [{ scale: pop(t, 0.02 + i * 0.06, 0.1) }] }]}>
          <View style={s.notch} />
        </Animated.View>
      ))}
      {X.map((cx, i) => {
        // The first phone shows the code; copies fly from it to the others.
        const start = 0.34 + (i - 1) * 0.1;
        const style =
          i === 0
            ? { transform: [{ scale: pop(t, 0.24) }] }
            : { opacity: ramp(t, start, start + 0.02), transform: [{ translateX: ramp(t, start, start + 0.12, X[0] - cx, 0) }] };
        return (
          <Animated.View key={`c${i}`} style={[s.code, { left: cx - 25, top: 76 }, style]}>
            <Text style={s.codeText} allowFontScaling={false}>
              OINK
            </Text>
          </Animated.View>
        );
      })}
      {X.map((cx, i) => (
        <Animated.View key={`a${i}`} style={{ position: 'absolute', left: cx - 14, top: 152, transform: [{ scale: pop(t, 0.62 + i * 0.07) }] }}>
          <Avatar color={AVATAR[i]} size={28} />
        </Animated.View>
      ))}
    </SceneBox>
  );
}

// ---------------------------------------------------------------------------
// 2 · Prompts: prompts drop into the trough one by one and the mud rises.
// ---------------------------------------------------------------------------
const DROPS = [
  { x: 92, text: 'pig in a hat', start: 0.18 },
  { x: 228, text: 'dancing chicken', start: 0.3 },
  { x: 132, text: 'sad unicorn', start: 0.42 },
  { x: 196, text: 'frog on a bike', start: 0.54 },
  { x: 160, text: 'giant pizza', start: 0.66 },
].map((d) => ({ ...d, end: d.start + 0.13 }));

export function PromptsScene() {
  const { t, reduced } = useLoop(4800, 0.86);
  const [landed, setLanded] = useState(0);
  useEffect(() => {
    const id = t.addListener(({ value }) => {
      const n = DROPS.filter((d) => value >= d.end).length;
      setLanded((c) => (c === n ? c : n));
    });
    return () => t.removeListener(id);
  }, [t]);
  return (
    <SceneBox t={t}>
      <View style={{ position: 'absolute', left: 40, top: 112, width: 240 }}>
        <Trough count={reduced ? DROPS.length : landed} target={DROPS.length} labels={false} />
      </View>
      {DROPS.map((d, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: d.x - 54,
            top: 0,
            opacity: t.interpolate({
              inputRange: [d.start, d.start + 0.02, d.end - 0.03, d.end],
              outputRange: [0, 1, 1, 0],
              extrapolate: 'clamp',
            }),
            transform: [
              { translateY: ramp(t, d.start, d.end, -10, 128, Easing.in(Easing.quad)) },
              { rotate: ramp(t, d.start, d.end, 0, i % 2 ? 8 : -8).interpolate({ inputRange: [-8, 8], outputRange: ['-8deg', '8deg'] }) },
            ],
          }}
        >
          <Chip width={108}>{d.text}</Chip>
        </Animated.View>
      ))}
    </SceneBox>
  );
}

// ---------------------------------------------------------------------------
// 3 · Draw: the prompt pops up and the pig in a hat sketches itself.
// ---------------------------------------------------------------------------
export function DrawScene() {
  const { t } = useLoop(5000, 0.86);
  return (
    <SceneBox t={t}>
      <Animated.View style={{ position: 'absolute', left: 108, top: 0, transform: [{ scale: pop(t, 0.03) }] }}>
        <Chip width={104}>pig in a hat</Chip>
      </Animated.View>
      <View style={{ position: 'absolute', left: 74, top: 48 }}>
        <Sketch variant="hat" width={172} draw={ramp(t, 0.14, 0.8, 0, 1, Easing.linear)} />
      </View>
    </SceneBox>
  );
}

// ---------------------------------------------------------------------------
// 4 · Pass it on: the chain slides along, each step by a different player:
// prompt → drawing → guess → drawing → guess. The meaning drifts.
// ---------------------------------------------------------------------------
const CHAIN = [
  { kind: 'chip', text: 'pig in a hat' },
  { kind: 'draw', variant: 'hat' },
  { kind: 'chip', text: 'fancy pig' },
  { kind: 'draw', variant: 'crown' },
  { kind: 'chip', text: 'pig king' },
] as const;
const CELL = 104;
const STEP = 132; // cell + the arrow between cells
const ARRIVE = [0, 0.2, 0.4, 0.6, 0.8]; // when each step slides to the middle

export function ChainScene() {
  const s = useThemedStyles(makeStyles);
  const theme = useTheme();
  const { t } = useLoop(6400, 0.42);
  const tx = (k: number) => W / 2 - CELL / 2 - k * STEP;
  const slide = t.interpolate({
    inputRange: [0, 0.14, 0.2, 0.34, 0.4, 0.54, 0.6, 0.74, 0.8, 1],
    outputRange: [tx(0), tx(0), tx(1), tx(1), tx(2), tx(2), tx(3), tx(3), tx(4), tx(4)],
    easing: ease,
  });
  return (
    <SceneBox t={t}>
      <View style={s.window}>
        <Animated.View style={[s.chain, { transform: [{ translateX: slide }] }]}>
          {CHAIN.map((c, k) => {
            const at = ARRIVE[k];
            return (
              <React.Fragment key={k}>
                {k > 0 ? (
                  <Animated.View style={[s.arrow, { opacity: ramp(t, at - 0.05, at) }]}>
                    <Svg width={20} height={20} viewBox="0 0 24 24">
                      <Path d="M4 12h15M13 6l6 6-6 6" stroke={theme.link} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    </Svg>
                  </Animated.View>
                ) : null}
                <Animated.View style={[s.cell, { opacity: k === 0 ? 1 : ramp(t, at - 0.04, at) }]}>
                  <Animated.View style={{ transform: [{ scale: k === 0 ? 1 : pop(t, at - 0.04) }] }}>
                    <Avatar color={AVATAR[k]} size={24} />
                  </Animated.View>
                  <View style={s.cellBody}>
                    {c.kind === 'chip' ? (
                      <Animated.View style={{ transform: [{ scale: k === 0 ? 1 : pop(t, at + 0.02) }] }}>
                        <Chip width={CELL - 4}>{c.text}</Chip>
                      </Animated.View>
                    ) : (
                      <Sketch variant={c.variant} width={CELL} draw={ramp(t, at, at + 0.13, 0, 1, Easing.linear)} />
                    )}
                  </View>
                </Animated.View>
              </React.Fragment>
            );
          })}
        </Animated.View>
      </View>
    </SceneBox>
  );
}

// ---------------------------------------------------------------------------
// 5 · Score: the prompt's writer (pink, with their prompt, underneath) rules
// on each step of the chain above: two matches pop ✓ and float +1, the
// drifted crown gets ✗ and dims; then the judge makes way for the trophy.
// ---------------------------------------------------------------------------
const ROW_TOP = 52;
const RULINGS = [
  { x: 6, match: true, at: 0.16 },
  { x: 112, match: true, at: 0.3 },
  { x: 218, match: false, at: 0.44 },
];

export function ScoreScene() {
  const s = useThemedStyles(makeStyles);
  const { t } = useLoop(5200, 0.56);
  return (
    <SceneBox t={t}>
      <Animated.View style={[s.judge, { opacity: ramp(t, 0.6, 0.64, 1, 0) }]}>
        <Avatar color={AVATAR[0]} size={26} />
        <Chip width={104}>pig in a hat</Chip>
      </Animated.View>
      {RULINGS.map((r, i) => (
        <Animated.View key={i} style={{ position: 'absolute', left: r.x, top: ROW_TOP, width: 96, height: 72, justifyContent: 'center', alignItems: 'center', opacity: r.match ? 1 : ramp(t, r.at, r.at + 0.04, 1, 0.45) }}>
          {i === 1 ? <Chip width={96}>fancy pig</Chip> : <Sketch variant={i === 0 ? 'hat' : 'crown'} width={96} />}
        </Animated.View>
      ))}
      {RULINGS.map((r, i) => (
        <React.Fragment key={`r${i}`}>
          <Animated.View style={[s.badge, { left: r.x + 80, top: ROW_TOP - 12 }, r.match ? s.yes : s.no, { transform: [{ scale: pop(t, r.at) }] }]}>
            <Text style={s.badgeText} allowFontScaling={false}>
              {r.match ? '✓' : '✕'}
            </Text>
          </Animated.View>
          {r.match ? (
            <Animated.Text
              allowFontScaling={false}
              style={[
                s.plus,
                {
                  left: r.x + 58,
                  top: ROW_TOP - 30,
                  opacity: t.interpolate({ inputRange: [r.at, r.at + 0.04, r.at + 0.14, r.at + 0.2], outputRange: [0, 1, 1, 0], extrapolate: 'clamp' }),
                  transform: [{ translateY: ramp(t, r.at, r.at + 0.2, 0, -22, Easing.out(Easing.quad)) }],
                },
              ]}
            >
              +1
            </Animated.Text>
          ) : null}
        </React.Fragment>
      ))}
      <Animated.Text allowFontScaling={false} style={[s.trophy, { transform: [{ scale: pop(t, 0.64, 0.1) }] }]}>
        🏆
      </Animated.Text>
    </SceneBox>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1, minHeight: 0, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  stage: { width: W, height: H },
});

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    chip: {
      height: 32,
      paddingHorizontal: 8,
      borderRadius: 16,
      backgroundColor: t.surface,
      borderWidth: Math.max(1, t.edge),
      borderColor: t.surfaceBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipText: { fontSize: 13, lineHeight: 17, fontFamily: font.medium, color: t.surfaceText },
    canvas: {
      backgroundColor: canvas.fill,
      borderWidth: 1,
      borderColor: canvas.border,
      overflow: 'hidden',
    },
    phone: {
      position: 'absolute',
      width: 62,
      height: 104,
      borderRadius: 12,
      borderWidth: 3,
      borderColor: t.link,
      backgroundColor: t.surface,
      alignItems: 'center',
    },
    notch: { marginTop: 5, width: 18, height: 4, borderRadius: 2, backgroundColor: t.surfaceBorder },
    code: {
      position: 'absolute',
      width: 50,
      height: 24,
      borderRadius: 6,
      backgroundColor: t.surfaceInset,
      alignItems: 'center',
      justifyContent: 'center',
    },
    codeText: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: t.surfaceText },
    window: { position: 'absolute', left: 0, top: 24, width: W, height: 150, overflow: 'hidden' },
    chain: { flexDirection: 'row', alignItems: 'flex-start' },
    cell: { width: CELL, alignItems: 'center', gap: 10 },
    cellBody: { height: 78, justifyContent: 'center' },
    arrow: { width: STEP - CELL, height: 112, alignItems: 'center', justifyContent: 'flex-end' },
    judge: { position: 'absolute', left: 0, right: 0, top: 158, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
    badge: { position: 'absolute', width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
    yes: { backgroundColor: verdict.yes },
    no: { backgroundColor: verdict.no },
    badgeText: { color: verdict.mark, fontSize: 15, fontWeight: '700', lineHeight: 18 },

    plus: { position: 'absolute', fontSize: 18, fontWeight: '700', color: t.accent },
    trophy: { position: 'absolute', left: 0, right: 0, top: 146, textAlign: 'center', fontSize: 46, lineHeight: 58 },
  });
