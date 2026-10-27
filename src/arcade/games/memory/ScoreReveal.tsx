import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import { Strokes } from '../../../components/DrawingArt';
import { Heading } from '../../../components/Heading';
import { PigButton } from '../../../components/PigButton';
import { RuleBadge } from '../../../components/RuleBadge';
import { SPACE, STROKE } from '../../../lib/drawing';
import { FONT_CAP, useUi } from '../../../theme/responsive';
import { useReducedMotion, useThemedStyles } from '../../../theme/theme';
import { canvas as paper, font, layout, verdict, type Theme } from '../../../theme/tokens';
import type { Frame } from '../index';
import { fitAspect } from './DrawPad';
import { fit, inkLength } from './score';

// After Done (or the clock running out): how the drawing did, before the run
// moves on. The clock stops. The pad stays where it was, now still, and the
// drawing that was flashed comes back over the player's as a ghost, in a
// color of the rainbow, that draws itself on, laid over theirs the way
// score.ts compared them (same centre of ink, same spread), so what lines up
// is what was scored. In the rail a flag drops onto the bar at the pass mark
// and the bar fills to the score in bursts, each pause longer than the last,
// the number shaking harder the nearer it gets. Then the ✓ or ✗ lands on the
// drawing (RuleBadge, as on the reveal screen) and a pass throws confetti. Then a pass goes to the run
// by itself, which leaves this up, with its choice under it at a new tier
// (keep going, or bank it: RunShell.tsx), else for a moment before the next
// round; a miss waits for Continue. Tapping the drawing
// skips to the end; with reduced motion it starts there.
//
// The show runs on one clock, `start`: each part works out where it is from
// the time since, so skipping is just moving `start` back.

// The timeline, ms from Done.
const DIM_MS = 300; // the player's ink fades back so the ghost shows
const GHOST_AT = 100;
const GHOST_MS = 1000; // the ghost drawing itself on, all its strokes in turn
const FLAG_AT = 1100;
const FLAG_MS = 320;
const BAR_AT = 1400; // the bar starts to fill; barKeys from here
const SETTLE_MS = 80; // the bar at rest, then the verdict
const POP_MS = 450; // the number's pop (and a miss's shake) at the verdict
const CONTINUE_MS = 700; // the verdict, then the end: a miss's Continue, a pass's handover

// The ghost's ink: a color of the rainbow, a different one each time. It's
// on white paper in every palette, so these aren't themed; each is deep
// enough (yellow is an amber) to show over the player's black ink.
const GHOSTS = [
  'rgba(229, 57, 53, 0.7)', // red
  'rgba(251, 140, 0, 0.7)', // orange
  'rgba(244, 180, 0, 0.75)', // yellow
  'rgba(67, 160, 71, 0.7)', // green
  'rgba(30, 136, 229, 0.7)', // blue
  'rgba(57, 73, 171, 0.7)', // indigo
  'rgba(142, 36, 170, 0.7)', // violet
];
const GHOST_W = 7; // drawing units, over the pen's STROKE

type Ease = (p: number) => number;
const out: Ease = (p) => 1 - (1 - p) ** 3;
const inOut: Ease = (p) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2);
const back: Ease = (p) => 1 + 2.9 * (p - 1) ** 3 + 1.9 * (p - 1) ** 2; // overshoots, then settles
const clamp = (p: number) => Math.max(0, Math.min(1, p));

// [ms, value, the ease into it]
type Key = [number, number, Ease?];

// The bar's fill, ms from BAR_AT: bursts and pauses, each pause longer, to
// just short of the mark. A pass then breaks through to the score; a miss
// creeps right up to the line, holds, and falls back to its score. Nothing on
// the way passes a miss's score by more than a few points.
function barKeys(score: number, pass: number): Key[] {
  const won = score >= pass;
  const top = won ? score : Math.min(pass - 1, score + 3);
  const v = (n: number) => Math.max(0, Math.min(top, n));
  const run: Key[] = [[0, 0], [300, v(18), out], [650, v(18)], [900, v(33), out], [1350, v(33)], [1650, v(pass - 3), out]];
  return won
    ? [...run, [2500, v(pass - 3)], [3000, score, back]]
    : [...run, [2400, v(pass - 3)], [2700, top, out], [3300, top], [3900, score, inOut]];
}

function along(keys: Key[], t: number) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1, ease] = keys[i];
    if (t < t1) {
      const [t0, v0] = keys[i - 1];
      return v0 + (v1 - v0) * (ease ?? ((p: number) => p))((t - t0) / (t1 - t0));
    }
  }
  return keys[keys.length - 1][1];
}

// When the verdict lands, ms from Done.
const verdictAt = (keys: Key[]) => BAR_AT + keys[keys.length - 1][0] + SETTLE_MS;

// Ms since `start`, up to `end`, re-rendering every frame until then.
function useElapsed(start: number, end: number) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    let id = 0;
    const tick = () => {
      const n = Date.now();
      setNow(n);
      if (n - start < end) id = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(id);
  }, [start, end]);
  return Math.max(0, Math.min(end, now - start));
}

// Whether `at` ms since `start` has come.
function useReached(start: number, at: number) {
  const [reached, setReached] = useState(() => Date.now() >= start + at);
  useEffect(() => {
    const left = start + at - Date.now();
    setReached(left <= 0);
    if (left <= 0) return;
    const t = setTimeout(() => setReached(true), left);
    return () => clearTimeout(t);
  }, [start, at]);
  return reached;
}

export function ScoreReveal({
  Frame,
  shown,
  drawn,
  score,
  pass,
  answer,
  at,
  onContinue,
}: {
  Frame: Frame;
  shown: string[]; // the drawing that was flashed
  drawn: string[]; // the player's
  score: number;
  pass: number;
  answer: string; // "a snowman"
  at: number; // when Done was pressed (epoch ms)
  onContinue: () => void; // ends the round: by itself on a pass, from Continue on a miss
}) {
  const ui = useUi();
  const styles = useThemedStyles(makeStyles);
  const reduced = useReducedMotion();
  const keys = useMemo(() => barKeys(score, pass), [score, pass]);
  const end = verdictAt(keys) + CONTINUE_MS;
  const [start, setStart] = useState(() => (reduced ? at - end : at));
  const over = useReached(start, end);
  const won = score >= pass;
  const passed = useRef(false);
  useEffect(() => {
    if (over && won && !passed.current) {
      passed.current = true;
      onContinue();
    }
  }, [over, won, onContinue]);

  return (
    <Frame
      stoppedAt={at}
      focus={
        <Pressable
          style={styles.fill}
          onPress={() => setStart(Date.now() - end)}
          disabled={over}
          accessibilityRole="button"
          accessibilityLabel="Skip to the score"
        >
          <Ghosted start={start} shown={shown} drawn={drawn} won={won} verdict={verdictAt(keys)} />
        </Pressable>
      }
      controls={
        <View style={{ gap: ui.sp(10) }}>
          <Heading>{over ? `It was ${answer}${won ? '!' : '.'}` : 'How close?'}</Heading>
          <ScoreBar start={start} keys={keys} score={score} pass={pass} />
          {/* A miss's Continue, kept in the layout from the start so the rail
              doesn't move when it shows. */}
          {won ? null : (
            <View
              style={!over && styles.hidden}
              pointerEvents={over ? 'auto' : 'none'}
              importantForAccessibility={over ? 'auto' : 'no-hide-descendants'}
              accessibilityElementsHidden={!over}
            >
              <PigButton name="Continue" onPress={onContinue} />
            </View>
          )}
        </View>
      }
    />
  );
}

// The pad as DrawPad drew it (same size, same place), the ghost over it, and
// at the verdict the ✓ / ✗ and, for a pass, confetti.
function Ghosted({ start, shown, drawn, won, verdict: at }: { start: number; shown: string[]; drawn: string[]; won: boolean; verdict: number }) {
  const ui = useUi();
  const reduced = useReducedMotion();
  const [host, setHost] = useState({ w: 0, h: 0 });
  const [ghost] = useState(() => GHOSTS[Math.floor(Math.random() * GHOSTS.length)]);
  const size = fitAspect(host);
  const lay = useMemo(() => fit(shown, drawn), [shown, drawn]);
  const lens = useMemo(() => shown.map(inkLength), [shown]);
  const t = useElapsed(start, GHOST_AT + GHOST_MS);
  const landed = useReached(start, at);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== host.w || height !== host.h) setHost({ w: width, h: height });
  };

  // The ghost's ink so far, given to its strokes in order.
  let ink = lens.reduce((s, l) => s + l, 0) * clamp((t - GHOST_AT) / GHOST_MS);
  const k = lay?.k ?? 1;
  const badge = Math.min(ui.f(96), Math.round(ui.paneH * 0.45));

  return (
    <View style={styles.host} onLayout={onLayout}>
      <View style={[styles.frame, { width: size.w, height: size.h, borderRadius: ui.sp(layout.imageRadius) }]}>
        <Svg width={size.w} height={size.h} viewBox={`0 0 ${SPACE.w} ${SPACE.h}`}>
          <G opacity={1 - 0.3 * clamp(t / DIM_MS)}>
            <Strokes strokes={drawn} width={STROKE} />
          </G>
          <G transform={lay ? `translate(${lay.to.x} ${lay.to.y}) scale(${k}) translate(${-lay.from.x} ${-lay.from.y})` : undefined}>
            {shown.map((d, i) => {
              const len = lens[i];
              const on = Math.max(0, Math.min(len, ink));
              ink -= len;
              return (
                <Path
                  key={i}
                  d={d}
                  stroke={ghost}
                  strokeWidth={GHOST_W / k}
                  strokeDasharray={[len, len]}
                  strokeDashoffset={len - on}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            })}
          </G>
        </Svg>
      </View>
      {landed ? <RuleBadge correct={won} size={badge} /> : null}
      {landed && won && !reduced ? <Confetti /> : null}
    </View>
  );
}

// The bar, the flag at the pass mark, and the number beside them.
function ScoreBar({ start, keys, score, pass }: { start: number; keys: Key[]; score: number; pass: number }) {
  const ui = useUi();
  const styles = useThemedStyles(makeStyles);
  const fillEnd = keys[keys.length - 1][0];
  const t = useElapsed(start, BAR_AT + fillEnd + SETTLE_MS + POP_MS);
  const bt = t - BAR_AT;
  const v = Math.max(0, Math.min(100, along(keys, bt)));
  const settled = bt >= fillEnd + SETTLE_MS;
  const won = score >= pass;

  const f = clamp((t - FLAG_AT) / FLAG_MS);
  // While it fills the number shakes, harder the nearer the mark.
  const near = Math.max(0, 1 - Math.abs(pass - v) / 22);
  const amp = bt > 0 && !settled ? ui.sp(1 + 4 * near * near) : 0;
  // At the verdict it pops; a miss shakes the bar.
  const q = settled ? clamp((bt - fillEnd - SETTLE_MS) / POP_MS) : 0;
  const shake = settled && !won ? Math.sin(q * Math.PI * 6) * (1 - q) * ui.sp(7) : 0;
  const color = settled ? (won ? verdict.yes : verdict.no) : v >= pass ? verdict.yes : null;

  return (
    <View
      style={[styles.row, { gap: ui.sp(12), transform: [{ translateX: shake }] }]}
      accessible
      accessibilityLabel={settled ? `Your drawing matched ${score}%. It needed ${pass}%.` : `It needs ${pass}%.`}
    >
      <View style={[styles.fill, { paddingTop: ui.sp(18) }]}>
        <View style={[styles.track, { height: ui.sp(22) }]}>
          <View style={[styles.bar, { width: `${v}%` as const }, color ? { backgroundColor: color } : null]}>
            <View style={styles.sheen} />
          </View>
        </View>
        <View
          style={[
            styles.flag,
            {
              left: `${pass}%` as const,
              bottom: -ui.sp(5),
              width: ui.sp(44),
              marginLeft: -ui.sp(22),
              opacity: f > 0 ? 1 : 0,
              transform: [{ translateY: (1 - back(f)) * -ui.sp(14) }],
            },
          ]}
        >
          <Text style={[styles.flagText, { fontSize: ui.f(12) }]} maxFontSizeMultiplier={FONT_CAP} numberOfLines={1}>
            {pass}%
          </Text>
          <View style={[styles.pole, { width: ui.sp(3) }]} />
        </View>
      </View>
      <Text
        style={[
          styles.num,
          { fontSize: ui.f(34), width: ui.sp(84) },
          {
            transform: [
              { translateX: (Math.random() - 0.5) * amp },
              { translateY: (Math.random() - 0.5) * amp },
              { scale: 1 + 0.6 * Math.sin(Math.PI * q) },
            ],
          },
          settled && (won ? styles.yes : styles.no),
        ]}
        maxFontSizeMultiplier={FONT_CAP}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {Math.round(v)}%
      </Text>
    </View>
  );
}

const NATIVE = Platform.OS !== 'web';
const CONFETTI = ['#4ECDC4', '#F4B400', '#AD1457', '#ffffff', '#6FCF7A', '#DB7093'];

// A burst from the middle of the drawing, out and up, then falling.
function Confetti() {
  const ui = useUi();
  const p = useRef(new Animated.Value(0)).current;
  const [pieces] = useState(() =>
    Array.from({ length: 40 }, (_, i) => {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.8;
      const speed = ui.sp(120 + Math.random() * 150);
      return { color: CONFETTI[i % CONFETTI.length], dx: Math.cos(a) * speed, dy: Math.sin(a) * speed, spin: (Math.random() - 0.5) * 900 };
    })
  );
  useEffect(() => {
    Animated.timing(p, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }).start();
  }, [p]);
  const fall = ui.sp(220);
  return (
    <View pointerEvents="none" style={styles.burst}>
      {pieces.map((c, i) => (
        <Animated.View
          key={i}
          style={[
            styles.piece,
            {
              width: ui.sp(6),
              height: ui.sp(10),
              backgroundColor: c.color,
              opacity: p.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
              transform: [
                { translateX: p.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, c.dx * 0.7, c.dx] }) },
                { translateY: p.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, c.dy * 0.7, c.dy + fall] }) },
                { rotate: p.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${c.spin}deg`] }) },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1, minHeight: 0, minWidth: 0, width: '100%', alignItems: 'center', justifyContent: 'center' },
  frame: { borderWidth: 1, borderColor: paper.border, overflow: 'hidden', backgroundColor: paper.fill },
  burst: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  piece: { position: 'absolute', borderRadius: 2 },
});

const makeStyles = (t: Theme) => StyleSheet.create({
  fill: { flex: 1 },
  hidden: { opacity: 0 },
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  track: {
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: t.chip,
    borderWidth: Math.max(1, t.edge),
    borderColor: t.chipBorder,
  },
  bar: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 999, backgroundColor: t.button },
  sheen: { position: 'absolute', left: 0, right: 0, top: 0, height: '50%', backgroundColor: 'rgba(255,255,255,0.25)' },
  flag: { position: 'absolute', top: 0, alignItems: 'center' },
  flagText: { color: t.text, fontFamily: font.bold, textAlign: 'center' },
  pole: { flex: 1, backgroundColor: t.text, borderRadius: 2 },
  num: { color: t.text, fontFamily: font.bold, textAlign: 'right', fontVariant: ['tabular-nums'] },
  yes: { color: t.success },
  no: { color: t.danger },
});
