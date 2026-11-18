import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { G, Path, Rect } from 'react-native-svg';
import { useFireworksClock } from './Fireworks';
import { useReducedMotion } from '../theme/theme';
import { useUi } from '../theme/responsive';

// The Doves celebration (catalog.ts CELEBRATIONS): a box sits in the bottom
// corner of the screen, still; it gives a shake, its lid pops open, and white
// doves burst out of it one after another, flapping, and fly up and away
// across the screen in long arcs and off the top. Once they've gone the lid
// shuts and the box fades away. Over the whole screen (Stage's `overlay`),
// letting touches through; once, not on a loop.
//
// One clock from `from` (epoch ms), every phone at the same moment; the doves
// are three paths a frame (far wings, bodies, near wings) and their beaks,
// however many there are. Off with reduced motion.

const IN_MS = 300; // the box fading in
const SHAKE_AT = 350; // its shake before it opens
const OPEN_AT = 700; // the lid pops open
const LID_MS = 220;
const DOVES = 9;
const OUT_GAP = 110; // ms between doves
const FLY_MS = 2800; // a dove's flight, out of the box and off the screen
const CLOSE_AT = OPEN_AT + DOVES * OUT_GAP + 1600; // the lid shuts
const FADE_AT = CLOSE_AT + 400; // and the box fades
const FADE_MS = 400;
export const DOVES_MS = Math.max(FADE_AT + FADE_MS, OPEN_AT + (DOVES - 1) * OUT_GAP + FLY_MS);

const CREAM = '#FFF4E0';
const GOLD = '#E2B04A';
const LINE = '#6B5A45';

const clamp = (p: number) => Math.max(0, Math.min(1, p));
const out = (p: number) => 1 - (1 - p) ** 3;
const r1 = (n: number) => Math.round(n * 10) / 10;
const hash = (i: number) => {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

export function DovesLayer({ from, on = true }: { from: number; on?: boolean }) {
  const ui = useUi();
  const reduced = useReducedMotion();
  const [box, setBox] = useState({ w: 0, h: 0 });
  const t = useFireworksClock(from, DOVES_MS, on && !reduced);
  const { w, h } = box;
  const show = t >= 0 && t < DOVES_MS && w > 0 && h > 0;
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {show ? <Scene t={t} w={w} h={h} s={ui.s} pad={ui.pad} /> : null}
    </View>
  );
}

function Scene({ t, w, h, s, pad }: { t: number; w: number; h: number; s: number; pad: number }) {
  const bw = Math.min(w, h) * 0.2; // the box
  const bh = bw * 0.72;
  const bx = pad;
  const by = h - pad - bh;
  const lidH = bh * 0.22;
  const u = Math.min(w, h) * 0.16; // a dove's length

  // The shake before it opens, and the lid: popping open on its hinge at the
  // back right (so it swings into the screen, not off its edge), with a little
  // bounce, and later shutting.
  const shake = t > SHAKE_AT && t < OPEN_AT ? Math.sin((t - SHAKE_AT) / 22) * 2.2 * (1 - (t - SHAKE_AT) / (OPEN_AT - SHAKE_AT)) : 0;
  const opening = clamp((t - OPEN_AT) / LID_MS);
  const lidOpen = t < CLOSE_AT ? 1 + 0.12 * Math.sin(opening * Math.PI) - (1 - out(opening)) : 1 - out(clamp((t - CLOSE_AT) / LID_MS));
  const lidAngle = 115 * clamp(lidOpen) + (t >= OPEN_AT && t < CLOSE_AT ? 6 * Math.sin(opening * Math.PI) : 0);
  const boxFade = clamp(t / IN_MS) * (1 - clamp((t - FADE_AT) / FADE_MS));

  // The doves: each out of the box's mouth in turn, up and away along a curve
  // to a point off the top of the screen, its own, growing to full size as it
  // clears the box, wings beating.
  const far: string[] = [];
  const bodies: string[] = [];
  const near: string[] = [];
  const beaks: string[] = [];
  const mouth = { x: bx + bw / 2, y: by };
  for (let i = 0; i < DOVES; i++) {
    const e = t - OPEN_AT - i * OUT_GAP;
    if (e < 0 || e > FLY_MS) continue;
    const p = e / FLY_MS;
    const end = { x: w * (0.15 + 0.95 * hash(i)), y: -u * 2 };
    const ctl = { x: mouth.x + (end.x - mouth.x) * (0.1 + 0.3 * hash(i + 5)), y: h * (0.15 + 0.35 * hash(i + 9)) };
    const q = 1 - (1 - p) ** 1.6; // quick out of the box, easing as it rises
    const x = (1 - q) ** 2 * mouth.x + 2 * (1 - q) * q * ctl.x + q * q * end.x;
    const y = (1 - q) ** 2 * mouth.y + 2 * (1 - q) * q * ctl.y + q * q * end.y;
    const dx = 2 * (1 - q) * (ctl.x - mouth.x) + 2 * q * (end.x - ctl.x);
    const dy = 2 * (1 - q) * (ctl.y - mouth.y) + 2 * q * (end.y - ctl.y);
    const size = u * (0.45 + 0.55 * out(clamp(e / 350)));
    const flap = Math.sin(e / 55 + i * 1.7);
    const d = dove(x, y, Math.atan2(dy, dx), size, flap);
    far.push(d.far);
    bodies.push(d.body);
    near.push(d.near);
    beaks.push(d.beak);
  }

  const lw = Math.max(1, 1.4 * s);
  return (
    <Svg width={w} height={h}>
      {/* The box, behind the doves leaving it. */}
      <G opacity={boxFade} transform={`translate(${r1(shake)} 0)`}>
        <Rect x={bx} y={by} width={bw} height={bh} rx={4 * s} fill={CREAM} stroke={LINE} strokeWidth={lw} />
        <Rect x={bx + bw * 0.42} y={by} width={bw * 0.16} height={bh} fill={GOLD} />
        <Rect x={bx} y={by + bh * 0.45} width={bw} height={bh * 0.12} fill={GOLD} fillOpacity={0.6} />
        <Rect x={bx + 2 * s} y={by - 1} width={bw - 4 * s} height={3 * s} fill="#3A2E24" opacity={clamp(lidOpen)} />
      </G>
      <Path d={far.join('')} fill="#D9DEE5" stroke={LINE} strokeWidth={lw * 0.8} strokeLinejoin="round" />
      <Path d={bodies.join('')} fill="#FFFFFF" stroke={LINE} strokeWidth={lw} strokeLinejoin="round" />
      <Path d={beaks.join('')} fill="#F2A33A" />
      <Path d={near.join('')} fill="#FFFFFF" stroke={LINE} strokeWidth={lw} strokeLinejoin="round" />
      {/* The lid, in front of the doves, hinged at the box's back right. */}
      <G opacity={boxFade} transform={`translate(${r1(shake)} 0)`}>
        <G transform={`rotate(${r1(lidAngle)} ${r1(bx + bw)} ${r1(by)})`}>
          <Rect x={bx - bw * 0.04} y={by - lidH} width={bw * 1.08} height={lidH} rx={3 * s} fill={CREAM} stroke={LINE} strokeWidth={lw} />
          <Rect x={bx + bw * 0.42} y={by - lidH} width={bw * 0.16} height={lidH} fill={GOLD} />
        </G>
      </G>
    </Svg>
  );
}

// One dove as path data, at (x, y), flying toward `heading` (radians), `size`
// long, its wings at `flap` (−1 down … 1 up). Drawn facing right and turned;
// one flying leftward is flipped so it's never upside down.
function dove(x: number, y: number, heading: number, size: number, flap: number) {
  const left = Math.cos(heading) < 0;
  const a = left ? heading - Math.PI : heading;
  const c = Math.cos(a);
  const sn = Math.sin(a);
  const pt = (px: number, py: number) => {
    const lx = (left ? -px : px) * size;
    const ly = py * size;
    return `${r1(x + lx * c - ly * sn)} ${r1(y + lx * sn + ly * c)}`;
  };
  // A plump body: round head, full breast, a fanned tail.
  const body =
    `M${pt(0.48, -0.05)}Q${pt(0.4, -0.27)} ${pt(0.2, -0.14)}Q${pt(-0.06, -0.19)} ${pt(-0.32, -0.03)}` +
    `L${pt(-0.62, -0.16)}L${pt(-0.58, 0.13)}Q${pt(-0.1, 0.25)} ${pt(0.26, 0.09)}Q${pt(0.45, 0.06)} ${pt(0.48, -0.05)}Z`;
  const beak = `M${pt(0.46, -0.1)}L${pt(0.61, -0.05)}L${pt(0.46, -0.02)}Z`;
  // A broad wing from the shoulder, its tip swept back, up or down with the beat.
  const wing = (lift: number, back: number) =>
    `M${pt(0.16 - back, -0.09)}Q${pt(0.28 - back, -0.1 - 0.6 * lift)} ${pt(-0.18 - back, -0.12 - 0.78 * lift)}` +
    `Q${pt(-0.02 - back, -0.12 - 0.22 * lift)} ${pt(-0.22 - back, -0.04)}Z`;
  return { body, beak, near: wing(flap, 0), far: wing(flap * 0.85 + 0.15, 0.08) };
}
