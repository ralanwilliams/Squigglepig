import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useFireworksClock } from './Fireworks';
import { useReducedMotion } from '../theme/theme';
import { useUi } from '../theme/responsive';

// The Rave celebration (catalog.ts CELEBRATIONS): fans of neon lasers from
// the four corners of the screen, switching on one a beat and sweeping back
// and forth across it, a neon glow round the screen's edges that pulses on
// the beat, and glow sticks tumbling down through it all. Over the whole
// screen (Stage's `overlay`), letting touches through.
//
// No strobe, on purpose: flashing faster than three times a second can set
// off a seizure (WCAG 2.3.1). The beat is 128 a minute, just over two a
// second, and what pulses is the glow at the edges, never the whole screen.
//
// One clock from `from` (epoch ms), every phone on the same beat; a few paths
// a frame, however many lasers and sticks. It goes on until the screen does,
// or, given `until` (ms), fades out by then (Your pig's preview). Off with
// reduced motion.

const BEAT = 60000 / 128; // ms
const IN_MS = 600; // coming up
const FADE_MS = 600; // going, with `until`
const NEON = ['#39FF14', '#FF2BD6', '#00F0FF', '#9D4DFF'];
const RAYS = 6; // lasers in each corner's fan (more, and the scores under them get hard to read)
const STICKS = 16;

const clamp = (p: number) => Math.max(0, Math.min(1, p));
const r1 = (n: number) => Math.round(n * 10) / 10;
// A number that looks random but is the same every frame (and on every phone).
const hash = (i: number) => {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

let nextId = 0;

export function RaveLayer({ from, until, on = true }: { from: number; until?: number; on?: boolean }) {
  const ui = useUi();
  const reduced = useReducedMotion();
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [id] = useState(() => `rave-${++nextId}`);
  const t = useFireworksClock(from, until ?? Infinity, on && !reduced);
  const { w, h } = box;
  const show = t >= 0 && w > 0 && h > 0 && (until === undefined || t < until);
  const fade = clamp(t / IN_MS) * (until === undefined ? 1 : clamp((until - t) / FADE_MS));
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {show ? <Scene t={t} w={w} h={h} s={ui.s} id={id} fade={fade} /> : null}
    </View>
  );
}

function Scene({ t, w, h, s, id, fade }: { t: number; w: number; h: number; s: number; id: string; fade: number }) {
  const beat = Math.floor(t / BEAT);
  const pulse = Math.exp(-(t % BEAT) / 160); // 1 on the beat, dying away
  const reach = Math.hypot(w, h) * 1.1;

  // The four corners' fans, each switching on a beat after the last, aimed
  // into the screen and sweeping across it, each its own way. Their color
  // moves on every four beats (a bar).
  const corners = [
    { x: 0, y: 0, aim: Math.PI / 4 },
    { x: w, y: 0, aim: (3 * Math.PI) / 4 },
    { x: 0, y: h, aim: -Math.PI / 4 },
    { x: w, y: h, aim: (-3 * Math.PI) / 4 },
  ];
  const fans = corners.map((c, k) => {
    if (t < k * BEAT) return null;
    const sweep = Math.sin((t / (BEAT * 8)) * Math.PI * 2 + k * 1.3) * 0.55;
    const spread = 0.5 + 0.18 * Math.sin((t / (BEAT * 16)) * Math.PI * 2 + k);
    let d = '';
    for (let i = 0; i < RAYS; i++) {
      const a = c.aim + sweep + (i / (RAYS - 1) - 0.5) * spread;
      d += `M${r1(c.x)} ${r1(c.y)}L${r1(c.x + Math.cos(a) * reach)} ${r1(c.y + Math.sin(a) * reach)}`;
    }
    return { d, color: NEON[(k + Math.floor(beat / 4)) % NEON.length] };
  });

  // Glow sticks: tumbling down the screen at their own speeds, over and over,
  // each one neon; grouped by color so it's a path (and its glow) a color.
  const sticks = NEON.map(() => '');
  const len = 26 * s;
  for (let i = 0; i < STICKS; i++) {
    const speed = 0.06 + hash(i + 3) * 0.06; // dp a ms
    const span = h + len * 2;
    const y = ((hash(i) * span + t * speed * s) % span) - len;
    const x = hash(i + 11) * w + Math.sin(t / 900 + i) * 14 * s;
    const a = t / (500 + hash(i + 5) * 700) + i;
    const dx = (Math.cos(a) * len) / 2;
    const dy = (Math.sin(a) * len) / 2;
    sticks[i % NEON.length] += `M${r1(x - dx)} ${r1(y - dy)}L${r1(x + dx)} ${r1(y + dy)}`;
  }

  const edge = NEON[(Math.floor(beat / 4) + 1) % NEON.length];
  const glow = `${id}-edge`;
  return (
    <Svg width={w} height={h} style={{ opacity: fade }}>
      <Defs>
        <RadialGradient id={glow} cx="50%" cy="50%" r="72%">
          <Stop offset="0.55" stopColor={edge} stopOpacity={0} />
          <Stop offset="1" stopColor={edge} stopOpacity={0.55} />
        </RadialGradient>
      </Defs>
      {/* The edges glowing on the beat. */}
      <Rect x={0} y={0} width={w} height={h} fill={`url(#${glow})`} opacity={0.35 + 0.65 * pulse} />
      {fans.map((f, k) =>
        f ? (
          <React.Fragment key={k}>
            <Path d={f.d} stroke={f.color} strokeOpacity={0.15} strokeWidth={8 * s} strokeLinecap="round" fill="none" />
            <Path d={f.d} stroke={f.color} strokeOpacity={0.45 + 0.25 * pulse} strokeWidth={2 * s} strokeLinecap="round" fill="none" />
          </React.Fragment>
        ) : null
      )}
      {sticks.map((d, k) => (
        <React.Fragment key={k}>
          <Path d={d} stroke={NEON[k]} strokeOpacity={0.3} strokeWidth={12 * s} strokeLinecap="round" fill="none" />
          <Path d={d} stroke={NEON[k]} strokeWidth={5 * s} strokeLinecap="round" fill="none" />
          <Path d={d} stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={1.6 * s} strokeLinecap="round" fill="none" />
        </React.Fragment>
      ))}
    </Svg>
  );
}
