import React, { memo, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { Backdrop } from './Backdrop';
import { SOUNDS } from '../assets/assets';
import { playSound } from '../lib/sound';
import { font } from '../theme/tokens';
import { useReducedMotion, useTheme } from '../theme/theme';
import { useUi } from '../theme/responsive';

// A title that arrives as a fight: `left` charges in from the left edge of the
// screen and `right` from the right, and they butt heads in the middle like
// two rams: a first clash (a grunt, both squash and reel back), a second
// charge, a harder clash (a grunt, sparks, the screen shakes), and they
// settle side by side. Then it fades, showing the screen underneath. The Pig
// Off's "PIG" "OFF!" (app/pigoff.tsx), in Stage's `overlay`.
//
// The words are drawn as the pig is: pig pink, a thick black outline (the
// word drawn in black a little way out in every direction, under it), a soft
// drop shadow, leaning into each other. Their letters are about a third of
// the screen's height; on a screen too narrow for that (a phone held
// upright), as big as fits across, outline, lean and all (useWordsFit).
//
// On one clock from `start` (epoch ms), so every phone sees the same moment
// and one opening late joins it part way. Nothing with reduced motion.

const T_IN = 520; // the first charge lands
const T_BACK = 820; // reeled back
const T_HIT = 1060; // the second charge lands
const FALL_AT = T_HIT + 180; // they fall back level
const FALL_MS = 300;
const T_FADE = 2200; // settled; the title starts to fade
export const CLASH_TITLE_MS = 2600;

const PINK = '#F7A1B6'; // the pig's own pink (squigglepig_bare.png)
const OUTLINE = '#111111';
const CAP = 0.72; // Roboto's capitals are this tall for their font size
const LEAN = 6; // degrees each word leans in, heads down, while they fight
const RINGS = 16; // directions the outline is drawn in (fewer leave its corners stepped)
// Of the width, for the settled words: room for the outline and shadow,
// which spill past the letters, and for the lean while they fight.
const TITLE_ROOM = 0.86;

const clamp = (p: number) => Math.max(0, Math.min(1, p));
const outCubic = (p: number) => 1 - (1 - p) ** 3;
const kick = (t: number, at: number, ms = 90) => (t < at ? 0 : Math.exp(-(t - at) / ms));

export function ClashTitle({ left, right, start }: { left: string; right: string; start: number }) {
  const ui = useUi();
  const theme = useTheme();
  const reduced = useReducedMotion();
  const t = useClock(start, CLASH_TITLE_MS, !reduced);
  const words = useWordsFit(left, right);

  // The grunts as the heads meet, once each (not for a phone joining after).
  const heard = useRef({ a: t >= T_IN, b: t >= T_HIT });
  useEffect(() => {
    if (!heard.current.a && t >= T_IN) {
      heard.current.a = true;
      playSound(SOUNDS.grunt, 0.35);
    }
    if (!heard.current.b && t >= T_HIT) {
      heard.current.b = true;
      playSound(SOUNDS.grunt, 0.6);
    }
  }, [t]);

  if (reduced || t < 0 || t >= CLASH_TITLE_MS) return null;

  const W = ui.w + ui.insets.left + ui.insets.right;
  // A third of the height, or as big as fits across, whichever is smaller.
  const size = Math.min(Math.round((ui.h * 0.33) / CAP), words.sizeFor((W - ui.pad * 2) * TITLE_ROOM));
  const gap = size * GAP;

  // How far each word is pushed out from where it settles (negative: in,
  // past it, heads overlapping a little at a clash).
  const contact = -gap / 2 - size * 0.04;
  const startX = W * 0.8;
  const back = size * 0.6;
  let dx: number;
  if (t < T_IN) dx = startX + (contact - startX) * clamp(t / T_IN) ** 2;
  else if (t < T_BACK) dx = contact + (back - contact) * outCubic(clamp((t - T_IN) / (T_BACK - T_IN)));
  else if (t < T_HIT) dx = back + (contact - back) * clamp((t - T_BACK) / (T_HIT - T_BACK)) ** 2;
  else dx = contact * Math.exp(-(t - T_HIT) / 140) * Math.cos((t - T_HIT) / 45);

  // The squash of each impact, the second the harder; it shakes the screen.
  const impact = 0.6 * kick(t, T_IN) + kick(t, T_HIT);
  const squashX = 1 - 0.22 * impact;
  const squashY = 1 + 0.12 * impact;
  const jolt = kick(t, T_HIT, 160) + 0.4 * kick(t, T_IN, 120);
  const shakeX = size * 0.05 * jolt * Math.sin(t / 13);
  const shakeY = size * 0.035 * jolt * Math.cos(t / 17);
  const fade = t < T_FADE ? 1 : 1 - clamp((t - T_FADE) / (CLASH_TITLE_MS - T_FADE));
  // Heads down into each other while they fight; after the second clash they
  // fall back level, dropping like a weight, with a small rebound as they land.
  let lean = LEAN + 6 * impact;
  if (t >= FALL_AT) {
    const q = clamp((t - FALL_AT) / FALL_MS);
    const landed = t - FALL_AT - FALL_MS;
    lean = 6 * impact + LEAN * (1 - q * q) + (landed > 0 ? LEAN * 0.25 * Math.exp(-landed / 90) * Math.sin(landed / 35) : 0);
  }

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { opacity: fade }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.background }]} />
      <Backdrop />
      {words.measure}
      <View style={[StyleSheet.absoluteFill, styles.center, { opacity: words.ready ? 1 : 0, transform: [{ translateX: shakeX }, { translateY: shakeY }] }]}>
        <View style={[styles.row, { gap }]}>
          <View style={{ transformOrigin: 'right center', transform: [{ translateX: -dx }, { rotate: `${lean}deg` }, { scaleX: squashX }, { scaleY: squashY }] }}>
            <Word text={left} size={size} />
          </View>
          <View style={{ transformOrigin: 'left center', transform: [{ translateX: dx }, { rotate: `${-lean}deg` }, { scaleX: squashX }, { scaleY: squashY }] }}>
            <Word text={right} size={size} />
          </View>
        </View>
        <Sparks t={t} at={T_IN} size={size * 0.6} />
        <Sparks t={t} at={T_HIT} size={size} />
      </View>
    </View>
  );
}

// The two words as the clash leaves them, side by side and level, at
// `size`: the same title kept on screen afterwards (the Pig Off's header).
// One header to a screen reader, read as `label`.
//
// At `size` if they fit across the width they're given; smaller if not (a
// phone held upright, between the header's corner buttons), so they're never
// cut off (useWordsFit). Hidden until they've been measured.
const FIT_ROOM = 0.94; // of the width: room for the outline and shadow, which spill past the letters
export function ClashWords({ left, right, size, label }: { left: string; right: string; size: number; label: string }) {
  const [room, setRoom] = useState(0); // the width they're given
  const words = useWordsFit(left, right);
  const fitted = room > 0 ? Math.min(size, words.sizeFor(room * FIT_ROOM)) : size;
  return (
    <View
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (Math.abs(w - room) > 0.5) setRoom(w);
      }}
    >
      {words.measure}
      <View
        accessible
        accessibilityRole="header"
        accessibilityLabel={label}
        style={[styles.row, styles.middle, { gap: fitted * GAP, opacity: room > 0 && words.ready ? 1 : 0 }]}
      >
        <Word text={left} size={fitted} />
        <Word text={right} size={fitted} />
      </View>
    </View>
  );
}

// How big the two words can be to fit in a width. They're measured once,
// side by side, at a small size any screen has room for, out of sight: their
// width grows in step with their size, so that one measurement says it for
// any width. (Measured at full size instead, they'd be squeezed to the
// screen's width before they could be seen not to fit.) Until it's in,
// `ready` is false and `sizeFor` says any size fits.
const MEASURE_AT = 20;
const GAP = 0.12; // between the words, of their size
function useWordsFit(left: string, right: string) {
  const [perSize, setPerSize] = useState(0); // their width for each dp of size
  const measure = (
    <View
      pointerEvents="none"
      style={[styles.row, styles.measure, { gap: MEASURE_AT * GAP }]}
      onLayout={(e) => {
        const p = e.nativeEvent.layout.width / MEASURE_AT;
        // Only a real change: rounding alone would set it again every layout.
        if (Math.abs(p - perSize) > perSize * 0.005) setPerSize(p);
      }}
    >
      <Word text={left} size={MEASURE_AT} />
      <Word text={right} size={MEASURE_AT} />
    </View>
  );
  return {
    ready: perSize > 0,
    sizeFor: (width: number) => (perSize > 0 ? width / perSize : Infinity),
    measure,
  };
}

// One word, drawn as the pig is. Memoised: only its frame moves each tick.
const Word = memo(function Word({ text, size }: { text: string; size: number }) {
  const line = Math.round(size * 1.02);
  const edge = Math.max(2, size * 0.055);
  const base = { fontSize: size, lineHeight: line, fontFamily: font.bold, letterSpacing: size * 0.01, includeFontPadding: false } as const;
  return (
    <View>
      <Text allowFontScaling={false} style={[base, styles.abs, { color: 'rgba(0,0,0,0.28)', left: edge * 1.4, top: edge * 2 }]}>
        {text}
      </Text>
      {Array.from({ length: RINGS }, (_, i) => {
        const a = (i / RINGS) * Math.PI * 2;
        return (
          <Text key={i} allowFontScaling={false} style={[base, styles.abs, { color: OUTLINE, left: Math.cos(a) * edge, top: Math.sin(a) * edge }]}>
            {text}
          </Text>
        );
      })}
      <Text allowFontScaling={false} style={[base, { color: PINK }]}>
        {text}
      </Text>
    </View>
  );
});

// A clash's sparks: short gold and white rays flying out from where the heads met.
function Sparks({ t, at, size }: { t: number; at: number; size: number }) {
  const e = t - at;
  if (e < 0 || e > 380) return null;
  const p = e / 380;
  const box = size * 2.4;
  const c = box / 2;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', width: box, height: box }}>
      <Svg width={box} height={box}>
        {Array.from({ length: 10 }, (_, i) => {
          const a = (i / 10) * Math.PI * 2 + 0.3;
          const r1 = size * (0.25 + 0.7 * outCubic(p));
          const r2 = r1 + size * 0.28 * (1 - p);
          return (
            <Line
              key={i}
              x1={c + Math.cos(a) * r1}
              y1={c + Math.sin(a) * r1}
              x2={c + Math.cos(a) * r2}
              y2={c + Math.sin(a) * r2}
              stroke={i % 2 ? '#FFFFFF' : '#FFD54A'}
              strokeOpacity={1 - p}
              strokeWidth={Math.max(2, size * 0.06)}
              strokeLinecap="round"
            />
          );
        })}
      </Svg>
    </View>
  );
}

// ms since `start`, every frame until `until`; -1 while off.
function useClock(start: number, until: number, on: boolean) {
  const [t, setT] = useState(() => (on ? Date.now() - start : -1));
  useEffect(() => {
    if (!on) return;
    let frame = 0;
    const tick = () => {
      const e = Date.now() - start;
      setT(e);
      if (e < until) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [start, until, on]);
  return t;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  middle: { alignSelf: 'center' },
  abs: { position: 'absolute' },
  // Laid out but never seen: the words measured for useWordsFit.
  measure: { position: 'absolute', left: 0, top: 0, opacity: 0 },
});
