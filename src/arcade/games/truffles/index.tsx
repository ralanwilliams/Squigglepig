import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, GestureResponderEvent, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { font } from '../../../theme/tokens';
import { useFadesWithTheme, useReducedMotion } from '../../../theme/theme';
import { FONT_CAP, useUi } from '../../../theme/responsive';
import { ROUNDS } from '../../engine';
import { useFieldArea } from '../../FieldFrame';
import { useFieldColors } from '../../fieldColors';
import type { Game, RoundProps } from '../index';
import { PIP, Truffle, makeField, type Look, type PileArt, type TruffleArt } from './art';
import { fit, nearness, PIG, PILE, scentEvery, type Spot } from './layout';
import { PigSprite, usePigWalk } from './Pig';
import { FieldLight } from '../../FieldLight';
import { Cheer, Hop } from '../../Cheer';

// Truffle Hunter: each round scatters truffles over a forest floor that
// fills the screen (art.tsx), and the player taps them all before the clock
// runs out. A tap on bare ground does nothing. A tap marks its truffle at
// once, and a little pig (Pig.tsx) trots over and snuffles it up, in the
// order they were tapped. The clock runs until the pig has eaten the last
// one, so the tapping order is the pig's route: in the last rounds a
// wasteful one runs out of time. Then the round is won: the pig hops for joy
// and "Found them all!" stamps down over the field in a burst of sparks.
// Running out of time loses it, and the ones not found are ringed, the
// piles over any swept aside to show them; with a life to spare (engine.ts
// LIVES) the same field is played again instead, so they're not given away.
//
// Later rounds bring more truffles, smaller, closer to the soil's color,
// with more clutter, leaves over their edges, and look-alike stones. From
// round 5 there are piles of leaves, and from round 6 some truffles lie
// under them, among empty piles just like them (look). A pile with a
// truffle under it gives off wisps of
// scent, often and plain near the pig, now and then and faint far from it
// (Scent; layout.ts scentEvery). A tap on a pile sends the pig to nose
// through it. A truffle under it counts as found at once, as one in sight
// does, and the pig snuffles it up; an empty one is only ringed, and the pig
// walks there for nothing, so it pays to read the scent rather than try
// every pile.
//
// Every round has the same clock. A round's field is laid out on the phone
// it's played on, and fitted to the clock there (layout.ts fit): the pig's
// pace is set for that field, near the round's (SPEED), so a steady player
// is done with SPARE seconds to spare, an even step less each round: 5 s on
// round 1, out of time from round 9, while on the last a quick player who
// plans the route and reads the scent at once has two or so left. A run
// stops two thirds of the way up the ramp (TOP); the endless hunt's hardest
// goes all the way.
//
// It has an endless hunt too (Game.endless), for younger players: level n
// hides n truffles, with no end, no clock and no prizes, and the difficulty
// picks where on that ramp they are (how big, how close to the soil's
// colour, the clutter, the look-alikes, how many under piles: none at the
// easiest). A crowded field draws them smaller
// to fit them all (art.tsx). The
// round fills the screen (Game.fullScreen): the run's clock, pot and Leave
// float over the field (FieldFrame.tsx), with the count here bottom left.
// In dark mode it's night in the woods, and switching fades the light
// (FieldLight.tsx) rather than sweeping the screen. A win is cheered on the
// field (Cheer.tsx).

// A round's field, and in a run what it's fitted to (layout.ts fit): the
// clock, the seconds a steady player should have to spare, and the pig's pace
// to start from. The endless hunt has no clock, so nothing to fit.
type Spec = Look & { pace?: { clock: number; spare: number; speed: number } };

// How far up the ramp below (e, 0 … 1) a run's rounds go: 0 on round 1, TOP
// on the last. The endless hunt's hardest goes all the way.
const TOP = 2 / 3;
const ease = (round: number) => (TOP * (round - 1)) / (ROUNDS - 1);
const along = ([a, b]: number[], e: number) => a + (b - a) * e;
const CLOCK = 12; // s, every round
const seconds = () => CLOCK;
const SPARE = [5, -4]; // s a steady player has left, at e 0 and 1 (5 … -1 over a run)
const SPEED = [110, 240]; // the pig's trot at e 0 and 1, dp a second (each field's within layout.ts REACH)

// A field at e (0 easiest … 1 hardest) with `count` truffles; about one in
// three of them under a pile by the hardest, with as many empty piles and
// more again.
function look(e: number, count: number): Spec {
  return {
    seed: Math.floor(Math.random() * 2 ** 31),
    e,
    count,
    r: 26 - 15 * e, // radius in dp: 26 … 11, each ±20%
    contrast: 1 - 0.5 * e, // how far the truffles' browns are from the soil's
    decoys: Math.round(8 * Math.max(0, e - 0.3)), // look-alike stones past e 0.3, up to 6
    hidden: Math.round((e * count) / 3), // under a pile: none at e 0, a third at e 1
    piles: Math.round((5 * e * count) / 9), // empty piles
  };
}

function makeRun(): Spec[] {
  return Array.from({ length: ROUNDS }, (_, i) => {
    const e = ease(i + 1);
    return { ...look(e, 3 + Math.round(6 * e)), pace: { clock: CLOCK, spare: along(SPARE, e), speed: along(SPEED, e) } }; // 3 … 7 truffles
  });
}

// The endless hunt: level n's n truffles, at difficulty 0 … 4 (none hidden
// at the easiest); among only a few truffles, fewer look-alikes than a round
// of nine would have.
function endless(level: number, difficulty: number): Spec {
  const field = look(difficulty / 4, level);
  return { ...field, decoys: Math.round((field.decoys * Math.min(field.count, 9)) / 9) };
}

// Pips for the count while they fit in its chip; past that, just the count.
const MAX_PIPS = 12;

const NATIVE = Platform.OS !== 'web';
const HIT_DP = 22; // a tap counts this near a truffle's centre at least (a 44 dp target)
const WON_AFTER_MS = 300; // the last truffle eaten, then the round is won
const CREAM = '#F4EAD9';
const AMBER = '#E2B06A';
const AMBER_TEXT = '#2A1A0E';
const MISSED = '#FF8FB3';

const uneaten = (n: number) => `${n} ${n === 1 ? 'truffle was' : 'truffles were'} still on the ground.`;

function Round({ spec, onResult, Frame, ended, held }: RoundProps<Spec>) {
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
      focus={<Hunt spec={spec} found={found} eaten={eaten} ended={ended} held={held} onPlaced={setTotal} onFind={find} onEat={eat} />}
      controls={
        <View style={[styles.row, { gap: ui.sp(7) }]} accessible accessibilityLabel={`${found.length} of ${total} truffles found`}>
          <Text style={[styles.count, { color: fc.muted, fontSize: ui.f(14) }]} maxFontSizeMultiplier={FONT_CAP}>
            <Text style={[styles.countNum, { color: fc.text }]}>{found.length}</Text> of {total} found
          </Text>
          <View style={[styles.row, { gap: ui.sp(3) }]}>
            {Array.from({ length: total <= MAX_PIPS ? total : 0 }, (_, i) => (
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
  held,
  onPlaced,
  onFind,
  onEat,
}: {
  spec: Spec;
  found: number[];
  eaten: number[];
  ended?: RoundProps<Spec>['ended'];
  held?: boolean; // counting in: no taps yet
  onPlaced: (n: number) => void;
  onFind: (i: number) => void;
  onEat: (i: number) => void;
}) {
  const ui = useUi();
  const reduced = useReducedMotion();
  const area = useFieldArea();
  useFadesWithTheme();
  // Laid out, fitted to the clock and drawn once per field size: again only
  // when the phone turns.
  const box = area && `${Math.round(area.w)},${Math.round(area.h)},${Math.round(area.x0)},${Math.round(area.y0)},${Math.round(area.x1)},${Math.round(area.y1)}`;
  const start = area ? { x: (area.x0 + area.x1) / 2, y: (area.y0 + area.y1) / 2 + ui.sp(30) } : { x: 0, y: 0 };
  const laid = useMemo(() => {
    if (!area) return null;
    const { pace } = spec;
    const fitted = pace ? fit(area, spec, ui.s, start, pace.clock, pace.spare, pace.speed) : { seed: spec.seed, speed: PIG.speed };
    const field = makeField(area.w, area.h, area, { ...spec, seed: fitted.seed }, ui.s);
    // Where the pig may be sent: each truffle, then each empty pile; and
    // each pile's place in that list, and back.
    const empties = field.piles.filter((p) => p.truffle === null);
    const targets: Spot[] = [...field.truffles, ...empties.map((p) => ({ x: p.x, y: p.y, r: p.r / PILE }))];
    const aim = field.piles.map((p) => p.truffle ?? field.truffles.length + empties.indexOf(p));
    const pileAt = new Map(aim.map((t, k) => [t, k]));
    return { field, speed: fitted.speed, targets, aim, pileAt };
  }, [box, spec, ui.s]);
  const field = laid?.field ?? null;
  const spots = field?.truffles ?? [];
  const piles = field?.piles ?? [];
  useEffect(() => {
    if (field) onPlaced(field.truffles.length);
  }, [field]);

  // The empty piles the pig's been sent to, and the piles it's nosed apart.
  const [sent, setSent] = useState<number[]>([]);
  const [opened, setOpened] = useState<number[]>([]);
  // The pig at spot i: a truffle's snuffled up, under its pile or not; an
  // empty pile's just nosed apart.
  const reach = (i: number) => {
    const k = laid?.pileAt.get(i);
    if (k !== undefined) setOpened((o) => [...o, k]);
    if (i < spots.length) onEat(i);
  };
  const pig = usePigWalk(laid?.targets ?? [], start, ui.s, reduced, reach, laid?.speed);

  // Taps: the nearest truffle in sight not yet found, or pile not yet tried,
  // within reach, else nothing. `claimed` holds them at once, so two taps
  // before the next render can't send the pig to one twice. A truffle counts
  // as found when it's tapped, under a pile or not; an empty pile is just
  // ringed, and the pig goes all the same.
  const [taps, setTaps] = useState<{ id: number; x: number; y: number; hit: boolean }[]>([]);
  const tapId = useRef(0);
  const claimed = useRef(new Set<number>());
  const tap = (e: GestureResponderEvent) => {
    if (ended || !laid) return;
    const { locationX: x, locationY: y } = e.nativeEvent;
    if (x === undefined || y === undefined) return;
    let best: { target: number; pile?: number } | null = null;
    let bestD = Infinity;
    const consider = (s: Spot, within: number, target: number, pile?: number) => {
      if (claimed.current.has(target)) return;
      const d = Math.hypot(s.x - x, s.y - y);
      if (d <= Math.max(within, ui.sp(HIT_DP)) && d < bestD) {
        best = { target, pile };
        bestD = d;
      }
    };
    spots.forEach((t, i) => {
      if (!laid.pileAt.has(i)) consider(t, t.r * 1.3, i);
    });
    piles.forEach((p, k) => consider(p, p.r, laid.aim[k], k));
    const hit = best as { target: number; pile?: number } | null; // set in `consider`, which the checker can't follow
    if (!reduced) {
      const id = ++tapId.current;
      setTaps((list) => [...list.slice(-4), { id, x, y, hit: !!hit }]);
    }
    if (!hit) return;
    claimed.current.add(hit.target);
    if (hit.target < spots.length) onFind(hit.target);
    else setSent((s) => [...s, hit.pile!]);
    pig.go(hit.target);
  };

  if (!field || !area) return <View style={[styles.fill, styles.soil]} />;
  // Lost for good: the piles over the truffles not found are swept aside, so
  // they show in their rings. (A life used leaves them, for the same field
  // again.)
  const lost = ended && !ended.won && !ended.again;
  const open = (k: number) => opened.includes(k) || (!!lost && piles[k].truffle !== null && !found.includes(piles[k].truffle!));
  const covered = (i: number) => {
    const k = laid?.pileAt.get(i);
    return k !== undefined && !open(k);
  };
  // A mark's size: a pile's, for a truffle still under one.
  const markFor = (t: Spot, i: number): Spot => (covered(i) ? { x: t.x, y: t.y, r: t.r * PILE * 0.8 } : t);
  return (
    <View style={styles.fill}>
      {field.ground}
      {spots.map((t, i) => (covered(i) ? null : <TruffleView key={i} t={t} found={found.includes(i)} gone={eaten.includes(i)} />))}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {field.over}
      </View>
      {piles.map((p, k) => (
        <PileView key={k} p={p} open={open(k)} />
      ))}
      <FieldLight w={area.w} h={area.h} seed={spec.seed} />
      {spots.map((t, i) =>
        eaten.includes(i) ? (
          <Dug key={i} t={t} />
        ) : found.includes(i) ? (
          <Found key={i} t={markFor(t, i)} />
        ) : lost ? (
          <Missed key={i} t={t} />
        ) : null
      )}
      {piles.map((p, k) =>
        p.truffle !== null ? null : opened.includes(k) ? (
          <Dug key={`p${k}`} t={{ x: p.x, y: p.y, r: p.r / PILE }} />
        ) : null
      )}
      {piles.map((p, k) =>
        sent.includes(k) && !opened.includes(k) ? <Found key={`s${k}`} t={{ x: p.x, y: p.y, r: p.r * 0.8 }} tick={false} /> : null
      )}
      {ended
        ? null
        : piles.map((p, k) => {
            if (p.truffle === null || opened.includes(k)) return null;
            const d = Math.hypot(p.x - pig.stand.x, p.y - pig.stand.y);
            const near = nearness(d, ui.s);
            return (
              <Scent
                key={`w${k}`}
                p={p}
                every={Math.round(scentEvery(d, spec.e, ui.s) * 10) / 10}
                peak={0.3 + 0.6 * Math.max(near, 1 - spec.e)}
              />
            );
          })}
      <Animated.View pointerEvents="none" style={[styles.pig, { transform: pig.pos.getTranslateTransform() }]}>
        <Hop on={!!ended?.won}>
          <PigSprite walking={pig.walking} facing={pig.facing} head={pig.head} scale={pig.scale} />
        </Hop>
      </Animated.View>
      {taps.map((t) => (
        <TapRing key={t.id} x={t.x} y={t.y} hit={t.hit} />
      ))}
      {ended?.won ? <Cheer x={(area.x0 + area.x1) / 2} y={area.y0 + (area.y1 - area.y0) * 0.38} text="Found them all!" /> : null}
      {/* The taps, as soon as a finger lands. A responder rather than a
          Pressable: its grant comes while the touch is being handled, so
          locationX is there on the web too (a press arrives a moment later,
          when it no longer is). */}
      <View
        style={StyleSheet.absoluteFill}
        onStartShouldSetResponder={() => !ended && !held}
        onResponderGrant={tap}
        accessible
        accessibilityLabel="The forest floor. Tap each truffle you spot, and each pile of leaves you see scent rising from."
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

// Found, waiting for the pig: a cream ring and an amber tick. A pile the pig's
// been sent to gets the ring alone (`tick` false): what's under it isn't
// known yet.
function Found({ t, tick: ticked = true }: { t: Spot; tick?: boolean }) {
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
      {ticked ? (
        <View style={[styles.tick, { width: tick, height: tick, borderRadius: tick / 2, right: R * 0.02, top: R * 0.02 }]}>
          <Svg width={tick * 0.7} height={tick * 0.7} viewBox="0 0 24 24">
            <Path d="M5 12l5 5 9-10" fill="none" stroke={AMBER_TEXT} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </View>
      ) : null}
    </Animated.View>
  );
}

// A pile of leaves: once the pig noses it apart, its leaves spread and fade.
function PileView({ p, open }: { p: PileArt; open: boolean }) {
  const reduced = useReducedMotion();
  const out = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (open) Animated.timing(out, { toValue: 1, duration: reduced ? 0 : 420, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }).start();
  }, [open, reduced, out]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.abs,
        {
          left: p.x - p.R,
          top: p.y - p.R,
          opacity: out.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
          transform: [{ scale: out.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }],
        },
      ]}
    >
      {p.art}
    </Animated.View>
  );
}

// Scent over a pile with a truffle under it: two pale wisps that curl up out
// of it and fade, one every `every` s, as bright as `peak` at their
// brightest (layout.ts scentEvery; both from how near the pig is). Over the
// night's dark, so they show by night too. With reduced motion they hang
// there, still, as bright as they'd get.
const WISP_MS = 700;
function Scent({ p, every, peak }: { p: Spot; every: number; peak: number }) {
  const ui = useUi();
  const reduced = useReducedMotion();
  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) return;
    // Each pile's wisps a little out of step with the rest's.
    const lag = ((Math.abs(p.x * 7 + p.y * 13) % 100) / 100) * every * 1000;
    rise.setValue(0);
    const loop = Animated.sequence([
      Animated.delay(lag),
      Animated.loop(
        Animated.sequence([
          Animated.timing(rise, { toValue: 1, duration: WISP_MS, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }),
          Animated.timing(rise, { toValue: 0, duration: 0, useNativeDriver: NATIVE }),
          Animated.delay(Math.max(0, every * 1000 - WISP_MS)),
        ])
      ),
    ]);
    loop.start();
    return () => loop.stop();
  }, [rise, reduced, every]);
  const w = p.r * 1.2;
  const h = p.r * 1.8;
  const strands =
    `M${w * 0.4} ${h}C${w * 0.1} ${h * 0.7} ${w * 0.7} ${h * 0.45} ${w * 0.35} 0` +
    `M${w * 0.62} ${h * 0.9}C${w * 0.9} ${h * 0.65} ${w * 0.4} ${h * 0.4} ${w * 0.68} ${h * 0.1}`;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.abs,
        {
          left: p.x - w / 2,
          top: p.y - p.r * 0.4 - h,
          opacity: reduced ? peak : rise.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, peak, 0] }),
          transform: reduced ? [] : [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [h * 0.35, -h * 0.15] }) }],
        },
      ]}
    >
      <Svg width={w} height={h}>
        <Path d={strands} fill="none" stroke={CREAM} strokeWidth={Math.max(1.5, ui.sp(2.2))} strokeLinecap="round" />
      </Svg>
    </Animated.View>
  );
}

// Where the pig has been: a patch of turned earth.
function Dug({ t }: { t: Spot }) {
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
function Missed({ t }: { t: Spot }) {
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
  endless,
};
