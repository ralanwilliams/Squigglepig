import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, Line, Path, RadialGradient, Stop } from 'react-native-svg';
import { useReducedMotion } from '../theme/theme';
import { useUi } from '../theme/responsive';

// Fireworks for a win, and their light on the winner's pig.
//
// Both run off one clock the caller owns (`t`, ms since the fireworks began),
// so they stay in step with each other and with whatever show they're part of
// (a phone that joins late picks them up where they are). Nothing here
// animates on its own: the caller re-renders with a new `t` each frame.
//
// <Fireworks/> draws the rockets and bursts in a box. fireworkLights() says
// how much light each burst is giving off now and where it is, and <PigShine/>
// lays that light over a pig (PigFace's box): a wash of the burst's color over
// its head and body, and the shiny spots the art already has (forehead, cheek,
// flank) flaring in it, brighter on the side the burst is on. So the pig looks
// lit by them rather than just sitting under them.

// x, y: where it bursts, as fractions of the box; size: how far it spreads,
// as a share of the box (its shorter side, roughly).
export type Burst = { at: number; x: number; y: number; color: string; size?: number };

// The default show: a big opening pair, a quick volley left and right, a
// rolling run across the sky, and a finale of five at once, about 4½ s in
// all (the results stay up for 9 s, and this starts 3.9 s in).
const GOLD = '#FFD54A';
const PINK = '#FF5C8A';
const BLUE = '#4FC3F7';
const GREEN = '#9CFF6B';
const PURPLE = '#C08CFF';
const ORANGE = '#FF8A3D';
const RED = '#FF4D4D';
export const WIN_BURSTS: Burst[] = [
  { at: 0, x: 0.3, y: 0.3, color: GOLD, size: 0.5 },
  { at: 120, x: 0.72, y: 0.24, color: PINK, size: 0.5 },
  { at: 520, x: 0.15, y: 0.18, color: BLUE, size: 0.36 },
  { at: 640, x: 0.86, y: 0.36, color: GREEN, size: 0.36 },
  { at: 780, x: 0.5, y: 0.12, color: PURPLE, size: 0.42 },
  { at: 1150, x: 0.22, y: 0.42, color: ORANGE, size: 0.4 },
  { at: 1300, x: 0.62, y: 0.2, color: RED, size: 0.46 },
  { at: 1450, x: 0.9, y: 0.16, color: GOLD, size: 0.34 },
  { at: 1800, x: 0.4, y: 0.3, color: BLUE, size: 0.5 },
  { at: 1950, x: 0.08, y: 0.3, color: PINK, size: 0.32 },
  { at: 2100, x: 0.78, y: 0.4, color: PURPLE, size: 0.4 },
  // The finale.
  { at: 2550, x: 0.5, y: 0.22, color: GOLD, size: 0.62 },
  { at: 2600, x: 0.18, y: 0.26, color: PINK, size: 0.44 },
  { at: 2650, x: 0.82, y: 0.26, color: BLUE, size: 0.44 },
  { at: 2750, x: 0.32, y: 0.12, color: GREEN, size: 0.38 },
  { at: 2800, x: 0.68, y: 0.12, color: RED, size: 0.38 },
];

const LAUNCH_MS = 380; // the rocket climbing to where it bursts
const LIFE_MS = 1500; // the burst spreading, drooping and fading
const OUTER = 44; // sparks in the colored ring
const INNER = 22; // and in the gold heart inside it
const GLOW_MS = 420; // how fast a burst's light dies away

// When the last burst has gone, for a caller deciding how long to keep its clock running.
export const fireworksEnd = (bursts: Burst[] = WIN_BURSTS) => Math.max(0, ...bursts.map((b) => b.at)) + LAUNCH_MS + LIFE_MS;

// A clock for the fireworks: ms since `from` (epoch ms), every frame until
// `until` ms past it, then still. Two of these with the same `from` (the
// fireworks in one place, the pig they light in another) stay in step.
// Off (`on` false, e.g. reduced motion) it reads -1: nothing to show.
export function useFireworksClock(from: number, until: number = fireworksEnd(), on = true) {
  const [t, setT] = useState(-1);
  useEffect(() => {
    if (!on) {
      setT(-1);
      return;
    }
    let frame = 0;
    const tick = () => {
      const e = Date.now() - from;
      setT(e);
      if (e < until) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [from, until, on]);
  return t;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

// A ring of `n` sparks as SVG path data: each spark's streak (from where it
// was a moment ago to where it is), and its head as a dot (a zero-length
// segment, which a round cap draws as a dot). One path for all the streaks and
// one for all the heads, however many sparks: re-drawing a burst every frame
// costs a few elements, not a hundred, so the sky can be full without lag.
// `pick` splits the heads in two (the twinkling half, and the rest).
function ring(n: number, cx: number, cy: number, reach: number, droop: number, p: number, spin: number, pick: (i: number) => boolean) {
  let streaks = '';
  let heads = '';
  let others = '';
  const pos = (q: number, i: number) => {
    const a = (i / n) * Math.PI * 2 + spin;
    const far = reach * (0.82 + 0.18 * (((i * 7) % 5) / 4));
    const d = far * (1 - (1 - q) ** 3);
    return [cx + Math.cos(a) * d, cy + Math.sin(a) * d + droop * q * q];
  };
  for (let i = 0; i < n; i++) {
    const [hx, hy] = pos(p, i);
    const [tx, ty] = pos(Math.max(0, p - 0.14), i);
    streaks += `M${r1(tx)} ${r1(ty)}L${r1(hx)} ${r1(hy)}`;
    const dot = `M${r1(hx)} ${r1(hy)}h0.01`;
    if (pick(i)) heads += dot;
    else others += dot;
  }
  return { streaks, heads, others };
}

// `period` (ms) repeats the bursts every period, for as long as the clock
// runs; it must be longer than a burst lasts (LAUNCH_MS + LIFE_MS).
export function Fireworks({ t, w, h, scale = 1, bursts = WIN_BURSTS, period }: { t: number; w: number; h: number; scale?: number; bursts?: Burst[]; period?: number }) {
  if (w <= 0 || h <= 0 || t < 0 || (!period && t > fireworksEnd(bursts))) return null;
  const span = Math.min(w, h * 1.5); // what a burst's size is a share of
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { width: w, height: h }]}>
      <Svg width={w} height={h}>
        {bursts.map((b, k) => {
          const e = period && t >= b.at ? (t - b.at) % period : t - b.at;
          if (e < 0 || e > LAUNCH_MS + LIFE_MS) return null;
          const cx = b.x * w;
          const cy = b.y * h;
          const reach = span * (b.size ?? 0.4);
          // The rocket: a dot climbing from the bottom with a fading tail.
          if (e < LAUNCH_MS) {
            const p = e / LAUNCH_MS;
            const y = h + (cy - h) * (1 - (1 - p) ** 2);
            return (
              <React.Fragment key={k}>
                <Line x1={cx} y1={y + 28 * scale} x2={cx} y2={y} stroke={b.color} strokeOpacity={0.55} strokeWidth={2.5 * scale} strokeLinecap="round" />
                <Circle cx={cx} cy={y} r={3 * scale} fill="#FFFFFF" />
              </React.Fragment>
            );
          }
          // The burst: a white flash at the heart, then a ring of colored
          // sparks flying out fast and slowing, and a tighter gold ring inside
          // it (gold, not white, so it shows over the white drawing card too),
          // drooping as they fall and fading out, half of the colored ones
          // twinkling at the end.
          const p = (e - LAUNCH_MS) / LIFE_MS;
          const fade = (1 - p) ** 1.3;
          const twinkle = p > 0.5 ? 0.35 + 0.65 * Math.abs(Math.sin(e / 40 + k)) : 1;
          const droop = reach * 0.35;
          const outer = ring(OUTER, cx, cy, reach, droop, p, k * 0.7, (i) => i % 2 === 1);
          const inner = ring(INNER, cx, cy, reach * 0.5, droop * 0.7, Math.min(1, p * 1.15), k * 0.7 + 0.3, () => true);
          return (
            <React.Fragment key={k}>
              {p < 0.22 ? <Circle cx={cx} cy={cy} r={reach * (0.12 + 0.5 * p)} fill="#FFFFFF" fillOpacity={0.85 * (1 - p / 0.22)} /> : null}
              <Path d={outer.streaks} stroke={b.color} strokeOpacity={fade * 0.75} strokeWidth={2.6 * scale} strokeLinecap="round" fill="none" />
              <Path d={outer.others} stroke={b.color} strokeOpacity={fade} strokeWidth={4.4 * scale} strokeLinecap="round" fill="none" />
              <Path d={outer.heads} stroke={b.color} strokeOpacity={fade * twinkle} strokeWidth={4.4 * scale} strokeLinecap="round" fill="none" />
              <Path d={inner.streaks} stroke="#FFD866" strokeOpacity={fade * 0.6} strokeWidth={2 * scale} strokeLinecap="round" fill="none" />
              <Path d={inner.heads} stroke="#FFC21A" strokeOpacity={fade * (p > 0.4 ? twinkle : 1)} strokeWidth={3.4 * scale} strokeLinecap="round" fill="none" />
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

// The encore: a steady show with no finale, on a loop (ENCORE_PERIOD), for
// as long as a screen wants one (the scoreboard after a Pig Off's winner).
export const ENCORE_PERIOD = 3200;
export const ENCORE_BURSTS: Burst[] = [
  { at: 0, x: 0.25, y: 0.28, color: GOLD, size: 0.42 },
  { at: 400, x: 0.75, y: 0.2, color: PINK, size: 0.42 },
  { at: 800, x: 0.5, y: 0.14, color: BLUE, size: 0.36 },
  { at: 1200, x: 0.12, y: 0.36, color: GREEN, size: 0.34 },
  { at: 1600, x: 0.88, y: 0.3, color: PURPLE, size: 0.38 },
  { at: 2000, x: 0.38, y: 0.2, color: ORANGE, size: 0.4 },
  { at: 2400, x: 0.64, y: 0.34, color: RED, size: 0.4 },
  { at: 2800, x: 0.06, y: 0.16, color: BLUE, size: 0.3 },
];

// The night the fireworks are seen against: near-black with an iridescent
// sheen, slow drifting pools of violet, teal and magenta whose hues turn as
// it goes. `fall`: it comes down over the screen `delay` ms after the show
// starts, over FADE_MS, to solid black, and stays. `lift`: the screen starts
// black and it clears at the same rate (a new screen fading in from under
// the same night).
const FADE_MS = 1500;
export type Night = 'fall' | 'lift';
const darkness = (t: number, night: Night, delay: number) => {
  const p = Math.min(1, Math.max(0, (t - delay) / FADE_MS));
  return night === 'fall' ? p : 1 - p;
};

const hex = (hue: number, s: number, l: number) => {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + hue / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

// Gradient ids of its own for each drawing: on the web every <svg> shares one
// document, and the Pig Off fading into the scoreboard shows two nights at once.
let nextId = 0;
function useSvgId() {
  const [id] = useState(() => `fireworks-${++nextId}`);
  return id;
}

export function NightSky({ t, w, h, opacity }: { t: number; w: number; h: number; opacity: number }) {
  const id = useSvgId();
  if (opacity <= 0.01 || w <= 0 || h <= 0) return null;
  const pools = [0, 1, 2].map((i) => ({
    cx: w * (0.5 + 0.38 * Math.sin(t / 2600 + i * 2.1)),
    cy: h * (0.45 + 0.35 * Math.cos(t / 3100 + i * 1.7)),
    color: hex((260 + i * 70 + t / 25) % 360, 0.85, 0.5),
  }));
  const r = Math.max(w, h) * 0.6;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#05040C', opacity }]}>
      <Svg width={w} height={h}>
        <Defs>
          {pools.map((p, i) => (
            <RadialGradient key={i} id={`${id}-pool${i}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={p.color} stopOpacity={0.32} />
              <Stop offset="1" stopColor={p.color} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        {pools.map((p, i) => (
          <Ellipse key={i} cx={p.cx} cy={p.cy} rx={r} ry={r * 0.75} fill={`url(#${id}-pool${i})`} />
        ))}
      </Svg>
    </View>
  );
}

// The fireworks over whatever this sits on (it fills its parent, and lets
// touches through), starting at `from` (epoch ms), with the night behind them
// (`night`, if given, `nightDelay` ms in). `period` loops them (with
// ENCORE_BURSTS, say) until the layer goes; `encore` follows a one-off show
// (the win's) with the encore on a loop, picking up as the show's last
// bursts fade, so the sky never goes quiet. Off with reduced motion, or when
// `on` is false.
export function FireworksLayer({
  from,
  on = true,
  bursts = WIN_BURSTS,
  period,
  encore,
  night,
  nightDelay = 0,
}: {
  from: number;
  on?: boolean;
  bursts?: Burst[];
  period?: number;
  encore?: boolean;
  night?: Night;
  nightDelay?: number;
}) {
  const ui = useUi();
  const reduced = useReducedMotion();
  const [box, setBox] = useState({ w: 0, h: 0 });
  // Looping, or a night that stays, keeps the clock running until the layer goes.
  const until = period || encore || night === 'fall' ? Infinity : Math.max(fireworksEnd(bursts), night === 'lift' ? nightDelay + FADE_MS : 0);
  const t = useFireworksClock(from, until, on && !reduced);
  const encoreAt = fireworksEnd(bursts) - LIFE_MS / 2;
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {t >= 0 && night ? <NightSky t={t} w={box.w} h={box.h} opacity={darkness(t, night, nightDelay)} /> : null}
      {t >= 0 ? <Fireworks t={t} w={box.w} h={box.h} scale={ui.s} bursts={bursts} period={period} /> : null}
      {t >= 0 && encore && !period && t >= encoreAt ? (
        <Fireworks t={t - encoreAt} w={box.w} h={box.h} scale={ui.s} bursts={ENCORE_BURSTS} period={ENCORE_PERIOD} />
      ) : null}
    </View>
  );
}

// The light each burst is giving off at `t`: full as it goes off, dying away
// quickly; x is where it is across the box (0..1).
export type Light = { color: string; x: number; strength: number };
export function fireworkLights(t: number, bursts: Burst[] = WIN_BURSTS): Light[] {
  return bursts
    .map((b) => {
      const e = t - b.at - LAUNCH_MS;
      return { color: b.color, x: b.x, strength: e < 0 ? 0 : Math.exp(-e / GLOW_MS) };
    })
    .filter((l) => l.strength > 0.02)
    // The brightest few: the pig can only show so much light, and each one is
    // a handful of shapes over it, re-drawn every frame.
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 3);
}

// PigFace's window on the art (PigRoster.tsx PIG): the art is 954 × 900, and
// the box shows x from −0.15 to 0.75 of it, y from −0.16 to 1.14. The shapes
// below are in the art's pixels, traced from squigglepig_bare.png.
const VIEW = `${-0.15 * 954} ${-0.16 * 900} ${0.9 * 954} ${1.3 * 900}`;
const HEAD = { cx: 300, cy: 262, rx: 210, ry: 165 };
const BODY = { cx: 290, cy: 600, rx: 265, ry: 195 };
// The art's own shiny spots, and which side of the pig each faces (−1 left, 1 right).
const SPOTS = [
  { cx: 150, cy: 195, rx: 26, ry: 58, rot: 35, side: -1 }, // forehead
  { cx: 488, cy: 295, rx: 16, ry: 40, rot: 0, side: 1 }, // cheek
  { cx: 48, cy: 595, rx: 18, ry: 105, rot: 0, side: -1 }, // flank
  { cx: 410, cy: 70, rx: 14, ry: 26, rot: 30, side: 1 }, // right ear
];

// `lights` as fireworkLights gives them; `at` is where the pig's middle is
// across the same box (0..1), so each burst lights the side facing it.
export function PigShine({ w, h, lights, at }: { w: number; h: number; lights: Light[]; at: number }) {
  const id = useSvgId();
  if (!lights.length) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { width: w, height: h }]}>
      <Svg width={w} height={h} viewBox={VIEW} preserveAspectRatio="none">
        <Defs>
          {lights.map((l, i) => (
            <RadialGradient key={i} id={`${id}-wash${i}`} cx="50%" cy="45%" r="50%" fx={`${50 + 28 * Math.sign(l.x - at)}%`} fy="30%">
              <Stop offset="0" stopColor={l.color} stopOpacity={0.55 * l.strength} />
              <Stop offset="0.7" stopColor={l.color} stopOpacity={0.22 * l.strength} />
              <Stop offset="1" stopColor={l.color} stopOpacity={0} />
            </RadialGradient>
          ))}
          {lights.map((l, i) => (
            <RadialGradient key={`g${i}`} id={`${id}-glint${i}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={1} />
              <Stop offset="0.45" stopColor={l.color} stopOpacity={0.9} />
              <Stop offset="1" stopColor={l.color} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        {lights.map((l, i) => {
          const side = Math.max(-1, Math.min(1, (l.x - at) * 3)); // −1 well to the left … 1 well to the right
          return (
            <React.Fragment key={i}>
              <Ellipse {...HEAD} fill={`url(#${id}-wash${i})`} />
              <Ellipse {...BODY} fill={`url(#${id}-wash${i})`} />
              {SPOTS.map((s, j) => {
                const facing = 0.35 + 0.65 * Math.max(0, side * s.side);
                return (
                  <Ellipse
                    key={j}
                    cx={s.cx}
                    cy={s.cy}
                    rx={s.rx * 1.6}
                    ry={s.ry * 1.3}
                    transform={`rotate(${s.rot} ${s.cx} ${s.cy})`}
                    fill={`url(#${id}-glint${i})`}
                    opacity={Math.min(1, l.strength * facing * 1.2)}
                  />
                );
              })}
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}
