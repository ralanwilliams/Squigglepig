import React, { memo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Ellipse, Line, Path } from 'react-native-svg';
import { FitText } from './FitText';
import { useFireworksClock } from './Fireworks';
import { font } from '../theme/tokens';
import { useReducedMotion } from '../theme/theme';
import { useUi } from '../theme/responsive';

// The Balloon celebration (catalog.ts CELEBRATIONS): the doors of a trap door
// just above the top of the screen swing open down into view, a balloon drops
// out, catches the air and drifts down the screen, swaying, its string
// trailing, with the winner's words on it (Your pig: the avatar's `cheer`,
// BALLOON_SAY when they wrote none); the doors swing shut behind it, back up
// out of sight. Over the
// whole screen (Stage's `overlay`), letting touches through; once, not on a
// loop, so it doesn't sit over the scores.
//
// One clock from `from` (epoch ms), every phone at the same moment. With
// reduced motion there's no fall: the balloon is simply there for a while,
// where it would have caught the air, and goes.

export const BALLOON_SAY = 'Hooray!';

const OPEN_AT = 0; // the doors swinging open
const OPEN_MS = 300;
const DROP_AT = 200; // the balloon drops out
const CATCH_MS = 600; // and catches the air
const CLOSE_AT = 1250; // the doors swing shut, back up out of sight
const STILL_MS = 6000; // with reduced motion, how long it's there

const PINK = '#FF4F7B';
const KNOT = '#D93762';
const WOOD = '#8B5A2B';

const clamp = (p: number) => Math.max(0, Math.min(1, p));
const out = (p: number) => 1 - (1 - p) ** 3;

export function BalloonLayer({ from, text, until }: { from: number; text: string; until?: number }) {
  const ui = useUi();
  const reduced = useReducedMotion();
  const [box, setBox] = useState({ w: 0, h: 0 });
  const end = until ?? 20000;
  const t = useFireworksClock(from, end, true);
  const { w, h } = box;

  const bw = Math.min(w, h) * 0.34; // the balloon
  const bh = bw * 1.2;
  const string = bh * 0.9;
  const s = ui.s;

  // Where the balloon is: dropping out fast, catching the air at about a
  // fifth of the way down, then drifting on down and away, swaying.
  const caught = h * 0.18;
  const drift = (h * 0.1) / 1000; // dp a ms
  let y = -bh;
  if (t >= DROP_AT) {
    const e = t - DROP_AT;
    y = e < CATCH_MS ? -bh + (caught + bh) * out(e / CATCH_MS) : caught + (e - CATCH_MS) * drift;
  }
  const sway = Math.sin((t - DROP_AT) / 1100);
  let x = w / 2 + sway * w * 0.12 * clamp((t - DROP_AT) / 900);
  let tilt = Math.cos((t - DROP_AT) / 1100) * 8 * clamp((t - DROP_AT) / 900);
  if (reduced) {
    y = caught;
    x = w / 2;
    tilt = 0;
  }
  const gone = reduced ? t > STILL_MS : y > h + string;
  const show = t >= 0 && w > 0 && h > 0 && !gone && t < end;

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {show ? (
        <>
          <View
            style={{
              position: 'absolute',
              left: x - bw / 2,
              top: y,
              width: bw,
              transformOrigin: 'top center',
              transform: [{ rotate: `${tilt}deg` }],
              opacity: reduced ? clamp(t / 400) * clamp((STILL_MS - t) / 400) : 1,
            }}
          >
            <Body w={bw} h={bh} string={string} text={text || BALLOON_SAY} s={s} />
          </View>
          {reduced ? null : <Hatch t={t} w={w} width={bw * 1.5} s={s} />}
        </>
      ) : null}
    </View>
  );
}

// The balloon, its knot, its string and its words; drawn once (memo): only
// where it is changes each frame.
const Body = memo(function Body({ w, h, string, text, s }: { w: number; h: number; string: number; text: string; s: number }) {
  const knot = h * 0.07;
  return (
    <View style={{ width: w, height: h + knot + string }}>
      <Svg width={w} height={h + knot + string}>
        {/* The string: a lazy squiggle down from the knot. */}
        <Path
          d={`M${w / 2} ${h + knot}c${w * 0.12} ${string * 0.25} ${-w * 0.12} ${string * 0.5} 0 ${string * 0.75}s${-w * 0.08} ${string * 0.2} 0 ${string * 0.25}`}
          stroke="#555555"
          strokeWidth={1.5 * s}
          fill="none"
        />
        <Path d={`M${w / 2 - knot * 0.7} ${h + knot}L${w / 2 + knot * 0.7} ${h + knot}L${w / 2} ${h - knot * 0.4}Z`} fill={KNOT} />
        {/* The balloon: rounder at the top, narrowing to the knot. */}
        <Path
          d={`M${w / 2} ${h}C${w * 0.18} ${h * 0.88} 0 ${h * 0.62} 0 ${h * 0.42}C0 ${h * 0.16} ${w * 0.22} 0 ${w / 2} 0S${w} ${h * 0.16} ${w} ${h * 0.42}C${w} ${h * 0.62} ${w * 0.82} ${h * 0.88} ${w / 2} ${h}Z`}
          fill={PINK}
          stroke={KNOT}
          strokeWidth={1.5 * s}
        />
        <Ellipse cx={w * 0.3} cy={h * 0.24} rx={w * 0.08} ry={h * 0.12} fill="#FFFFFF" fillOpacity={0.45} transform={`rotate(-25 ${w * 0.3} ${h * 0.24})`} />
      </Svg>
      {/* The words, on its widest part. */}
      <View style={[styles.words, { left: w * 0.14, right: w * 0.14, top: h * 0.2, height: h * 0.48 }]}>
        <FitText style={styles.text} max={Math.round(w * 0.16)} min={Math.round(w * 0.09)} lines={3}>
          {text}
        </FitText>
      </View>
    </View>
  );
});

// The trap door's two doors, hinged at either end just above the top of the
// screen: shut, they're out of sight; they swing down into view as they open,
// and back up out of it as they shut.
function Hatch({ t, w, width, s }: { t: number; w: number; width: number; s: number }) {
  if (t > CLOSE_AT + OPEN_MS) return null;
  const thick = 12 * s;
  const y = -thick * 0.6; // the hinges' line, far enough up that a shut door doesn't show
  const open = t < CLOSE_AT ? out(clamp((t - OPEN_AT) / OPEN_MS)) : 1 - out(clamp((t - CLOSE_AT) / OPEN_MS));
  const a = open * (85 * Math.PI) / 180; // each door swings down this far
  const half = width / 2;
  const left = w / 2 - half;
  const right = w / 2 + half;
  return (
    <Svg width={w} height={half + thick} style={StyleSheet.absoluteFill}>
      <Line x1={left} y1={y} x2={left + Math.cos(a) * half} y2={y + Math.sin(a) * half} stroke={WOOD} strokeWidth={thick * 0.8} />
      <Line x1={right} y1={y} x2={right - Math.cos(a) * half} y2={y + Math.sin(a) * half} stroke={WOOD} strokeWidth={thick * 0.8} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  words: { position: 'absolute', justifyContent: 'center' },
  text: {
    color: '#FFFFFF',
    fontFamily: font.bold,
    textAlign: 'center',
    textShadowColor: 'rgba(120, 20, 50, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
