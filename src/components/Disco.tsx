import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Line, Path, RadialGradient, Stop } from 'react-native-svg';
import { useFireworksClock } from './Fireworks';
import { useReducedMotion } from '../theme/theme';
import { useUi } from '../theme/responsive';

// The Disco celebration (catalog.ts CELEBRATIONS): a mirror ball drops in on
// its cord from the top of the screen, bounces and settles, and turns. Beams
// of colored light swing from it back and forth across the screen, and the
// spots of light its mirrors throw slide across everything as it turns. Over
// the whole screen (Stage's `overlay`), letting touches through.
//
// Like the fireworks it runs on one clock from `from` (epoch ms), every
// phone at the same moment, and draws each frame as a few paths, however many
// mirrors and spots, so it doesn't lag. It goes on until the screen does,
// or, given `until` (ms), fades out by then (Your pig's preview). Off with
// reduced motion.

const DROP_MS = 900; // the ball falling in
const LIGHTS_AT = 700; // the beams come up as it lands
const LIGHTS_MS = 700;
const FADE_MS = 600; // going, with `until`
const BEAMS = ['#FF3FA4', '#3FE0FF', '#FFD54A', '#B57BFF', '#7CFF6B', '#FF8A3D'];
const ROWS = 9; // the ball's bands of mirrors
const COLS = 16; // and mirrors round each band
const SPOTS = 42;

const clamp = (p: number) => Math.max(0, Math.min(1, p));
const r1 = (n: number) => Math.round(n * 10) / 10;
// Falls, overshoots its rest a little, and swings back up to it.
const drop = (p: number) => (p < 0.7 ? (p / 0.7) ** 2 : 1 + 0.08 * Math.sin(((p - 0.7) / 0.3) * Math.PI) * (1 - p) * 3.3);

// A number that looks random but is the same every frame (and on every phone).
const hash = (i: number) => {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

let nextId = 0;

export function DiscoLayer({ from, until, on = true }: { from: number; until?: number; on?: boolean }) {
  const ui = useUi();
  const reduced = useReducedMotion();
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [id] = useState(() => `disco-${++nextId}`);
  const t = useFireworksClock(from, until ?? Infinity, on && !reduced);
  const { w, h } = box;
  const show = t >= 0 && w > 0 && h > 0 && (until === undefined || t < until);

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {show ? <Scene t={t} w={w} h={h} s={ui.s} id={id} fade={until === undefined ? 1 : clamp((until - t) / FADE_MS)} /> : null}
    </View>
  );
}

function Scene({ t, w, h, s, id, fade }: { t: number; w: number; h: number; s: number; id: string; fade: number }) {
  const R = Math.min(w, h) * 0.13;
  const rest = Math.min(h * 0.2, R * 2.6); // where the ball's middle hangs
  const sway = Math.sin(t / 900) * R * 0.12 * clamp((t - DROP_MS) / 400);
  const cx = w / 2 + sway;
  const cy = -R + (rest + R) * drop(clamp(t / DROP_MS));
  const spin = t / 1400; // radians the ball has turned
  const lights = clamp((t - LIGHTS_AT) / LIGHTS_MS) * fade;

  // The mirrors: a grid on the sphere, turning, each facing the light more
  // or less, sorted into three shades so they're three paths.
  const shades = ['', '', ''];
  for (let i = 0; i < ROWS; i++) {
    const lat0 = -Math.PI / 2 + (i / ROWS) * Math.PI;
    const lat1 = -Math.PI / 2 + ((i + 1) / ROWS) * Math.PI;
    for (let j = 0; j < COLS; j++) {
      const lon0 = (j / COLS) * Math.PI * 2 + spin;
      const lon1 = ((j + 1) / COLS) * Math.PI * 2 + spin;
      const mid = (lon0 + lon1) / 2;
      if (Math.cos(mid) <= 0.05) continue; // round the back
      const pt = (lat: number, lon: number) => `${r1(cx + R * Math.cos(lat) * Math.sin(lon))} ${r1(cy + R * Math.sin(lat))}`;
      const quad = `M${pt(lat0, lon0)}L${pt(lat0, lon1)}L${pt(lat1, lon1)}L${pt(lat1, lon0)}Z`;
      // Lit from up and to the left; a few mirrors catch it full on and flash.
      const facing = Math.cos(mid - 0.5) * Math.cos((lat0 + lat1) / 2 + 0.35);
      const flash = hash(i * COLS + j + Math.floor(t / 180)) > 0.93;
      shades[flash || facing > 0.75 ? 0 : facing > 0.4 ? 1 : 2] += quad;
    }
  }

  // The beams: long thin wedges from the ball, each swinging on its own.
  const reach = Math.hypot(w, h) * 1.2;
  const beams = BEAMS.map((color, k) => {
    const a = Math.PI / 2 + Math.sin(t / (1500 + k * 230) + k * 1.9) * 1.25; // pointing down, swinging side to side
    const half = 0.07 + 0.025 * Math.sin(t / 700 + k);
    const end = (d: number) => `${r1(cx + Math.cos(a + d) * reach)} ${r1(cy + Math.sin(a + d) * reach)}`;
    return { color, d: `M${r1(cx)} ${r1(cy)}L${end(-half)}L${end(half)}Z`, core: `M${r1(cx)} ${r1(cy)}L${end(-half * 0.35)}L${end(half * 0.35)}Z` };
  });

  // The spots the mirrors throw: scattered over the screen, sliding sideways
  // as the ball turns and wrapping round, each twinkling.
  let spots = '';
  let bright = '';
  for (let i = 0; i < SPOTS; i++) {
    const x = (((hash(i) * w + t * (0.05 + hash(i + 99) * 0.05) * s) % w) + w) % w;
    const y = rest + R + hash(i + 7) * (h - rest - R);
    const dot = `M${r1(x)} ${r1(y)}h0.01`;
    if (Math.sin(t / 160 + i * 2.3) > 0.6) bright += dot;
    else spots += dot;
  }

  const gloss = `${id}-gloss`;
  const glow = `${id}-glow`;
  return (
    <Svg width={w} height={h} style={{ opacity: fade }}>
      <Defs>
        <RadialGradient id={gloss} cx="38%" cy="32%" r="70%">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="0.5" stopColor="#B9C2CC" />
          <Stop offset="1" stopColor="#4B5560" />
        </RadialGradient>
        <RadialGradient id={glow} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.55} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {beams.map((b, k) => (
        <React.Fragment key={k}>
          <Path d={b.d} fill={b.color} fillOpacity={0.24 * lights} />
          <Path d={b.core} fill={b.color} fillOpacity={0.4 * lights} />
        </React.Fragment>
      ))}
      <Path d={spots} stroke="#FFFFFF" strokeOpacity={0.75 * lights} strokeWidth={6 * s} strokeLinecap="round" fill="none" />
      <Path d={bright} stroke="#FFF6C8" strokeOpacity={0.95 * lights} strokeWidth={9 * s} strokeLinecap="round" fill="none" />
      {/* The cord, the glow round the ball once the lights are up, and the ball. */}
      <Line x1={w / 2} y1={0} x2={cx} y2={cy - R} stroke="#2B2B2B" strokeWidth={2 * s} />
      <Circle cx={cx} cy={cy} r={R * 1.9} fill={`url(#${glow})`} opacity={lights} />
      <Circle cx={cx} cy={cy} r={R} fill={`url(#${gloss})`} />
      <Path d={shades[2]} fill="#6E7883" stroke="#3A424B" strokeWidth={0.6 * s} />
      <Path d={shades[1]} fill="#C3CBD3" stroke="#3A424B" strokeWidth={0.6 * s} />
      <Path d={shades[0]} fill="#FFFFFF" stroke="#3A424B" strokeWidth={0.6 * s} />
      <Circle cx={cx} cy={cy - R - 2 * s} r={3 * s} fill="#2B2B2B" />
    </Svg>
  );
}
