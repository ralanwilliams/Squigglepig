import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, GestureResponderEvent, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { SOUNDS } from '../../../assets/assets';
import { playSound } from '../../../lib/sound';
import { font } from '../../../theme/tokens';
import { useFadesWithTheme, useReducedMotion } from '../../../theme/theme';
import { FONT_CAP, useUi } from '../../../theme/responsive';
import { ROUNDS } from '../../engine';
import { useFieldArea } from '../../FieldFrame';
import { useFieldColors } from '../../fieldColors';
import { FieldLight } from '../../FieldLight';
import { Cheer, Hop } from '../../Cheer';
import { rng } from '../../rng';
import type { Game, RoundProps } from '../index';
import { PigSprite } from '../truffles/Pig';
import { makePen, type Look, type Pen } from './art';
import { corridor, makeMaze, paces, route, type Cell, type Dir, type Maze, type Pace } from './maze';

// Pigpen: each round is a pasture fenced into a maze (art.tsx, maze.ts), and
// the player gets the pig from the open gate at the top left to the basket
// of apples, somewhere in the pen, before the clock runs out. A swipe anywhere
// sends the pig trotting that way along the corridor, round its bends, until
// it branches, ends, or reaches the basket; a swipe made while it trots is
// kept for when it stops, except one straight back the way it's going,
// which turns it round there and then, mid-step, to put a wrong turn right
// (on the web the arrow keys work too). It leaves
// muddy hoofprints. At the basket the clock stops, the pig snuffles the
// apples, hops for joy and "Made it!" stamps down (Cheer.tsx). Out of time,
// the rest of the way to the basket is drawn in.
//
// Every round has the same clock; later rounds are bigger mazes and a
// quicker pig. Each round's maze is the same size on every phone (only its
// cells' size changes), so the clock means the same everywhere, and the
// basket goes where the round's difficulty wants it (maze.ts paces): on
// round 1 somewhere a steady player reaches with about 5 s left, on the last
// somewhere only a player who plays ahead (swipes the next turn while the
// pig still trots) reaches in time, with little to spare, and each round
// between an even step from one to the other (SPARE). Run out of time with
// a life in reserve (engine.ts LIVES) and the round starts again, the same
// pen; the way to the basket is drawn in only when time runs out with none
// left. Once waiting for
// the pig at every stop isn't fast enough, the hint says to swipe ahead. The
// round fills the screen (Game.fullScreen) under
// the run's chips (FieldFrame.tsx). In dark mode it's night in the pasture,
// and switching fades the light (FieldLight.tsx) rather than sweeping the
// screen.

type Spec = Look & {
  step: number; // ms the pig takes a cell
  ahead: boolean; // waiting for the pig at every stop is too slow: it needs playing ahead
};

// Each round's maze, columns × rows, upright.
const GRIDS: [number, number][] = [
  [5, 8],
  [5, 9],
  [6, 9],
  [6, 10],
  [7, 11],
  [7, 12],
  [8, 13],
  [9, 14],
  [10, 16],
  [11, 18],
];
const CLOCK = 15; // s, every round
const seconds = () => CLOCK;
// The seconds left at the basket, on round 1 and on the last, for a steady
// player and for one playing ahead (maze.ts PLAYER); each round between is
// an even step along. A steady player is out of time from round 5 or so.
const SPARE = { steady: [5, -7], ahead: [7.4, 1.4] };
const SLACK = 0.75; // s either way a basket's place may be from those
const TRIES = 40; // mazes made before taking the nearest fit

// Round n's maze and basket. A maze with nowhere that fits (they rarely
// don't) is made again from the next seed; failing that, the nearest.
function makeSpec(round: number, seed0: number): Spec {
  const e = (round - 1) / (ROUNDS - 1); // 0 on round 1, 1 on the last
  const step = Math.round(250 - 130 * e);
  const along = ([a, b]: number[]) => a + (b - a) * e;
  const steady = CLOCK - along(SPARE.steady); // the times wanted
  const ahead = CLOCK - along(SPARE.ahead);
  const [cols, rows] = GRIDS[round - 1];
  const miss = (p: Pace) => Math.max(Math.abs(p.steady - steady), Math.abs(p.ahead - ahead));
  const spec = (seed: number, maze: Maze, p: Pace): Spec => ({ seed, maze, goal: p.cell, step, ahead: p.waiting > CLOCK });
  let nearest: Spec | null = null;
  let least = Infinity;
  for (let i = 0; i < TRIES; i++) {
    const seed = (seed0 + i * 7919) % 2 ** 31;
    const maze = makeMaze(cols, rows, rng(seed));
    const all = paces(maze, step / 1000);
    const fits = all.filter((p) => miss(p) <= SLACK);
    if (fits.length) return spec(seed, maze, fits[Math.floor(rng(seed + 1)() * fits.length)]);
    for (const p of all) {
      if (miss(p) >= least) continue;
      least = miss(p);
      nearest = spec(seed, maze, p);
    }
  }
  return nearest!;
}

function makeRun(): Spec[] {
  return Array.from({ length: ROUNDS }, (_, i) => makeSpec(i + 1, Math.floor(Math.random() * 2 ** 31)));
}

const NATIVE = Platform.OS !== 'web';
const SWIPE_DP = 16; // a finger moving this far is a swipe
const WON_AFTER_MS = 600; // at the basket: a snuffle of the apples, then the round is won
const MISSED = '#FF8FB3'; // the way that was left, out of time (as Truffle Hunter's missed rings)
const PIG_W = 62; // the sprite's grid (truffles/Pig.tsx)

const away = (n: number) => `The apples were ${n} ${n === 1 ? 'step' : 'steps'} away.`;

function Round({ spec, onResult, Frame, ended, held }: RoundProps<Spec>) {
  const ui = useUi();
  const fc = useFieldColors();
  const [stoppedAt, setStoppedAt] = useState<number>();
  const left = useRef(0); // steps from the pig to the basket
  const reported = useRef(false);
  const report = (won: boolean, detail?: string, timedOut?: boolean) => {
    if (reported.current) return;
    reported.current = true;
    onResult(won, detail, timedOut);
  };
  const reach = () => {
    if (reported.current) return;
    setStoppedAt(Date.now());
    setTimeout(() => report(true), WON_AFTER_MS);
  };

  return (
    <Frame
      stoppedAt={stoppedAt}
      onExpire={() => report(false, away(left.current), true)}
      focus={<Pasture spec={spec} ended={ended} held={held} onMove={(n) => (left.current = n)} onReach={reach} />}
      controls={
        <Text style={[styles.hint, { color: fc.muted, fontSize: ui.f(13) }]} maxFontSizeMultiplier={FONT_CAP}>
          {spec.ahead ? (
            <>
              <Text style={[styles.hintKey, { color: fc.text }]}>Swipe ahead</Text> while it trots
            </>
          ) : (
            <>
              <Text style={[styles.hintKey, { color: fc.text }]}>Swipe</Text> to trot
            </>
          )}
        </Text>
      }
    />
  );
}

// The pen and the pig in it, and over it all the layer that takes the swipes.
function Pasture({
  spec,
  ended,
  held,
  onMove,
  onReach,
}: {
  spec: Spec;
  ended?: RoundProps<Spec>['ended'];
  held?: boolean; // counting in: no moves yet
  onMove: (stepsLeft: number) => void;
  onReach: () => void;
}) {
  const ui = useUi();
  const reduced = useReducedMotion();
  const area = useFieldArea();
  useFadesWithTheme();
  // Drawn once per field size: a new one only when the phone turns.
  const box = area && `${Math.round(area.w)},${Math.round(area.h)},${Math.round(area.x0)},${Math.round(area.y0)},${Math.round(area.x1)},${Math.round(area.y1)}`;
  const pen = useMemo(() => (area ? makePen(area.w, area.h, area, spec, ui.s) : null), [box, spec, ui.s]);

  const pig = usePigTrot(pen, spec.step, reduced, onMove, onReach);
  const stop = pig.stop;
  useEffect(() => {
    if (ended) stop();
  }, [ended, stop]);

  // Swipes: the direction a finger has moved SWIPE_DP in, once per touch.
  const touch = useRef<{ x: number; y: number; done: boolean } | null>(null);
  const onGrant = (e: GestureResponderEvent) => {
    touch.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, done: false };
  };
  const onMoveTouch = (e: GestureResponderEvent) => {
    const t = touch.current;
    if (!t || t.done || ended || held) return;
    const dx = e.nativeEvent.pageX - t.x;
    const dy = e.nativeEvent.pageY - t.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < ui.sp(SWIPE_DP)) return;
    t.done = true;
    pig.go(Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)]);
  };

  // On the web, the arrow keys.
  const go = pig.go;
  useEffect(() => {
    if (Platform.OS !== 'web' || ended || held) return;
    const KEYS: Record<string, Dir> = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };
    const onKey = (e: KeyboardEvent) => {
      const d = KEYS[e.key];
      if (!d) return;
      e.preventDefault();
      go(d);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ended, held, go]);

  if (!pen || !area) return <View style={[styles.fill, styles.grass]} />;
  const lost = ended && !ended.won && !ended.again;
  const g = pen.centre(pen.goal);
  return (
    <View style={styles.fill}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {pen.day}
      </View>
      <FieldLight w={area.w} h={area.h} seed={spec.seed} night={pen.night} />
      <Prints pen={pen} cells={pig.trail} w={area.w} h={area.h} />
      {lost ? <WayLeft pen={pen} from={pig.at()} w={area.w} h={area.h} /> : null}
      <Animated.View pointerEvents="none" style={[styles.abs, { left: 0, top: 0, transform: pig.pos.getTranslateTransform() }]}>
        <Hop on={!!ended?.won}>
          <PigSprite walking={pig.walking} facing={pig.facing} head={pig.head} scale={pig.scale} />
        </Hop>
      </Animated.View>
      {ended?.won ? <Cheer x={(area.x0 + area.x1) / 2} y={Math.min(g.y - pen.cell * 1.4, area.y0 + (area.y1 - area.y0) * 0.38)} text="Made it!" /> : null}
      <View
        style={StyleSheet.absoluteFill}
        onStartShouldSetResponder={() => !ended && !held}
        onMoveShouldSetResponder={() => !ended && !held}
        onResponderGrant={onGrant}
        onResponderMove={onMoveTouch}
        onResponderRelease={() => (touch.current = null)}
        accessible
        accessibilityLabel="The pen. Swipe to trot the pig along the paths to the basket of apples."
      />
    </View>
  );
}

// The pig's trot through the pen: `go(dir)` sends it down that corridor
// (maze.ts corridor), `step` ms a cell; a swipe while it trots waits for it
// to stop, and the pig sets off on it at once. It reports the steps left to the basket as it goes, and
// `onReach` at the basket. With reduced motion it doesn't trot, but takes as
// long: it waits out the run where it is, then it's there, so the time a
// route costs is the same either way.
function usePigTrot(
  pen: Pen | null,
  step: number,
  reduced: boolean,
  onMove: (stepsLeft: number) => void,
  onReach: () => void
) {
  const scale = pen ? (pen.cell * 0.95) / PIG_W : 1;
  const place = (p: { x: number; y: number }) => ({ x: p.x - (PIG_W / 2) * scale, y: p.y - 26 * scale });
  const pos = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const head = useRef(new Animated.Value(0)).current;
  const at = useRef<Cell>([0, 0]);
  const moving = useRef(false);
  const queued = useRef<Dir | null>(null);
  const leg = useRef<{ from: Cell; to: Cell; t0: number } | null>(null); // the step under way, and when it set off
  const unseen = useRef<Cell[]>([]); // with reduced motion, the cells reached this run
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [trail, setTrail] = useState<Cell[]>([]);
  const [facing, setFacing] = useState<1 | -1>(1);
  const faces = useRef<1 | -1>(1); // `facing`, for the run being planned
  const [walking, setWalking] = useState(false);
  const live = useRef({ pen, reduced, step, onMove, onReach, place });
  live.current = { pen, reduced, step, onMove, onReach, place };

  // A new pen (a new round, or the phone turned): the pig back at the gate.
  useEffect(() => {
    if (!pen) return;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    pos.stopAnimation();
    at.current = pen.start;
    moving.current = false;
    queued.current = null;
    leg.current = null;
    unseen.current = [];
    pos.setValue(place(pen.centre(pen.start)));
    setTrail([]);
    setWalking(false);
    setFacing(1);
    faces.current = 1;
    onMove(route(pen.maze, pen.start, pen.goal).length);
  }, [pen]);

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

  const go = (dir: Dir) => {
    const { pen: p, step } = live.current;
    if (!p) return;
    if (moving.current) {
      // Straight back the way it's trotting: a wrong turn put right. It
      // turns round mid-step, back to the cell it left (as long as it took
      // to get this far), and on down that corridor; a swipe kept for later
      // is dropped.
      const l = leg.current;
      if (l && dir[0] === l.from[0] - l.to[0] && dir[1] === l.from[1] - l.to[1]) {
        const done = Math.min(1, (Date.now() - l.t0) / step);
        halt();
        trot(l.to, corridor(p.maze, l.to, dir, p.goal), done);
        return;
      }
      queued.current = dir;
      return;
    }
    const cells = corridor(p.maze, at.current, dir, p.goal);
    if (cells.length) trot(at.current, cells, 1);
  };

  // The pig's run through `cells` from `start`, its first step `first` of a
  // whole one (less when it turns round mid-step).
  const trot = (start: Cell, cells: Cell[], first: number) => {
    const { pen: p, reduced: still, step, place: to } = live.current;
    if (!p) return;
    moving.current = true;
    // Which way it faces at the end of the run, and where it stands: at the
    // basket, its snout at the apples rather than on top of them.
    let x0 = start[0];
    for (const c of cells) {
      if (c[0] !== x0) faces.current = c[0] > x0 ? 1 : -1;
      x0 = c[0];
    }
    const spot = (c: Cell) => {
      const centre = p.centre(c);
      const atGoal = c[0] === p.goal[0] && c[1] === p.goal[1];
      return to(atGoal ? { x: centre.x - faces.current * p.cell * 0.38, y: centre.y } : centre);
    };
    const ms = (i: number) => (i ? first * step + (i - 1) * step : 0); // from setting off to step i
    if (!still) {
      setWalking(true);
      Animated.sequence(
        cells.map((c, i) =>
          Animated.timing(pos, { toValue: spot(c), duration: ms(i + 1) - ms(i), easing: Easing.linear, useNativeDriver: NATIVE })
        )
      ).start();
    }
    const t0 = Date.now();
    let prev = start;
    cells.forEach((c, i) => {
      const from = prev;
      later(ms(i), () => {
        leg.current = { from, to: c, t0: t0 + ms(i) };
        if (c[0] !== from[0]) setFacing(c[0] > from[0] ? 1 : -1);
      });
      later(ms(i + 1), () => {
        at.current = c;
        if (still) unseen.current.push(c);
        else setTrail((t) => [...t, c]);
        live.current.onMove(route(p.maze, c, p.goal).length);
      });
      prev = c;
    });
    later(ms(cells.length), () => {
      moving.current = false;
      leg.current = null;
      setWalking(false);
      const end = cells[cells.length - 1];
      if (still) {
        pos.setValue(spot(end));
        setFacing(faces.current);
        showUnseen();
      }
      if (end[0] === p.goal[0] && end[1] === p.goal[1]) {
        // At the basket: a snuffle of the apples.
        playSound(SOUNDS.grunt, 0.15);
        if (!still) {
          Animated.sequence([1, 0.25, 1, 0].map((v) => Animated.timing(head, { toValue: v, duration: 130, useNativeDriver: false }))).start();
        }
        live.current.onReach();
        return;
      }
      const next = queued.current;
      queued.current = null;
      if (next) go(next);
    });
  };

  // With reduced motion the pig shows where it is only when a run ends: the
  // prints it left on the way go down then too.
  const showUnseen = () => {
    const cells = unseen.current;
    unseen.current = [];
    if (cells.length) setTrail((t) => [...t, ...cells]);
  };

  // The run under way given up, the pig where it's got to (with reduced
  // motion, the last cell it reached).
  const halt = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    pos.stopAnimation();
    queued.current = null;
    leg.current = null;
    const { pen: p, reduced: still, place: to } = live.current;
    if (still && p) {
      pos.setValue(to(p.centre(at.current)));
      showUnseen();
    }
  };

  // The round is over: the pig stops where it is.
  const stop = () => {
    halt();
    moving.current = false;
    setWalking(false);
  };
  const stopRef = useRef(stop);
  stopRef.current = stop;
  const stableStop = useRef(() => stopRef.current()).current;

  const goRef = useRef(go);
  goRef.current = go;
  const stableGo = useRef((d: Dir) => goRef.current(d)).current;

  return { go: stableGo, stop: stableStop, pos, head, facing, walking, scale, trail, at: () => at.current };
}

// Muddy hoofprints between each cell the pig has trotted through and the
// last, just behind its feet. A cell the same as the last (the pig turned
// round mid-step, back into it) leaves none.
function Prints({ pen, cells, w, h }: { pen: Pen; cells: Cell[]; w: number; h: number }) {
  const r = pen.cell * 0.06;
  let d = '';
  let prev = pen.centre(pen.start);
  for (const c of cells) {
    const p = pen.centre(c);
    if (p.x === prev.x && p.y === prev.y) continue;
    const x = (prev.x + p.x) / 2;
    const y = (prev.y + p.y) / 2 + pen.cell * 0.18;
    for (const dx of [-r * 1.6, r * 1.6]) {
      d += `M${(x + dx - r).toFixed(1)} ${y.toFixed(1)}a${r.toFixed(1)} ${(r * 0.7).toFixed(1)} 0 1 0 ${(2 * r).toFixed(1)} 0a${r.toFixed(1)} ${(r * 0.7).toFixed(1)} 0 1 0 ${(-2 * r).toFixed(1)} 0Z`;
    }
    prev = p;
  }
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={w} height={h}>
        <Path d={d} fill="#3E2715" opacity={0.45} />
      </Svg>
    </View>
  );
}

// Out of time: the way that was left to the basket, dashed in pink, and a
// ring round the basket.
function WayLeft({ pen, from, w, h }: { pen: Pen; from: Cell; w: number; h: number }) {
  const ui = useUi();
  const way = [from, ...route(pen.maze, from, pen.goal)].map((c) => pen.centre(c));
  const d = way.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('');
  const g = pen.centre(pen.goal);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={w} height={h}>
        <Path d={d} stroke={MISSED} strokeWidth={ui.sp(3)} strokeDasharray={[ui.sp(2), ui.sp(7)]} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <Circle cx={g.x} cy={g.y} r={pen.cell * 0.46} stroke={MISSED} strokeWidth={ui.sp(3)} fill="none" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  grass: { backgroundColor: '#7FA24C' },
  abs: { position: 'absolute' },
  hint: { fontFamily: font.regular },
  hintKey: { fontFamily: font.medium },
});

export const pigpen: Game<Spec> = {
  id: 'pigpen',
  label: 'Pigpen',
  glyph: 'fence',
  blurb: 'Swipe the pig through the maze to the basket of apples before the clock runs out.',
  makeRun,
  Round,
  seconds,
  fullScreen: true,
};
