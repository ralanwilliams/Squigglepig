import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import Svg, { G, Path, Text as SvgText } from 'react-native-svg';
import { font } from '../theme/tokens';
import { useMorph, useReducedMotion, useSkin, useTheme } from '../theme/theme';
import { PROPS, type Prop, type TextSlot } from '../theme/skins/props';
import { morphPlacement, morphProp, nightProp, shownAt } from '../theme/skins/morph';
import { onThePig } from '../theme/skins/layout';
import { DIGITS, DIGIT_EM, emWidth } from '../theme/skins/glyphs';
import type { ArtName, Placement } from '../theme/skins';

// The season's props on one piece of pig artwork: Logo and WorkStage lay this
// over the image's box. Positions come from the skin (src/theme/skins), as
// fractions of the light-mode image; `window` is the part of the image the box
// shows, when it isn't the whole thing (Logo's ImageWindow). Purely
// decorative: it takes no touches and is hidden from screen readers. Props
// marked `behind` (Easter's ear outlines, Cupid's quiver) are drawn by a
// second SkinDecor with layer="behind", mounted under the image.
//
// Line weights are fractions of the image width, so a prop's outline matches
// the art's at any size; on the dark palette each prop gets the same light
// sticker rim scripts/dark-art.py gives the artwork. A prop with a night
// form (Lukas's) is drawn part way to it while the light changes
// (skins/morph.ts), swelling a little and rocking as it turns (unless it
// passes through a form of its own on the way, Chris's cape blowing, which is
// motion enough); one that's there only by day or by night grows and fades
// in, or shrinks and fades away.
const LINE = 9 / 954; // the art's black outline
const RIM = 5 / 954; // dark-art.py's RADIUS on the 954px stills
const INK = '#000000';
const RIM_COLOR = '#E6EDEE'; // dark-art.py's OUTLINE
const BOB_MS = 1400;
const TWINKLE_MS = 450;
const MORPH_SWELL = 0.14; // how much bigger a prop grows halfway through its morph
const MORPH_ROCK = 7; // and how far it rocks either way, in degrees
const FADE_SHRINK = 0.5; // how much smaller a prop that's fading in or out is while it's all but gone
const PIPE_STROKE = 0.11; // piped letters' stroke, in ems
const PIPE_DROP = 0.07; // how far the icing's shade sits below it, in ems
const LINE_GAP = 1.15; // a two-line slot's line spacing, in ems
const CAP_MID = 0.35; // from a line's middle down to its baseline, in ems
const NATIVE = Platform.OS !== 'web';

// A thrown prop's flight (Placement `toss`), as offsets from where it lands,
// in fractions of the whole image, made for Ash's jersey on the winner art:
// it leaves the pig's chest, flies up and over to the right, tumbling a
// full turn, then flutters down, swaying side to side and rocking like
// cloth, and settles. `x` and `spin` ease between their points (each sway
// slows at its end); `y` is drawn point by point (fast up, a float at the
// top, a steady fall, a soft landing).
const TOSS_MS = 2600;
const TOSS = {
  at: [0, 0.22, 0.4, 0.55, 0.7, 0.85, 1],
  x: [-0.38, -0.12, 0.02, -0.04, 0.03, -0.015, 0],
  spin: [0, 330, 372, 345, 366, 354, 360],
  fallAt: [0, 0.05, 0.12, 0.22, 0.32, 0.5, 0.7, 0.85, 0.94, 1],
  y: [-0.335, -0.56, -0.71, -0.775, -0.74, -0.55, -0.3, -0.11, -0.025, 0],
};
const TOSS_BUNCHED = 0.55; // how small it is, balled up, as it leaves his hooves
const TOSS_FLAT = 0.55; // how tall it is lying on the ground, of its height

// The flight sampled finely, the easing worked in: the native driver runs an
// interpolation straight from point to point (it can't take an easing), so
// the curve is in the points themselves, and it's the same everywhere.
function between(at: number[], to: number[], u: number, eased = false) {
  for (let i = 1; i < at.length; i++) {
    if (u <= at[i]) {
      let k = (u - at[i - 1]) / (at[i] - at[i - 1]);
      if (eased) k = (1 - Math.cos(Math.PI * k)) / 2;
      return to[i - 1] + (to[i] - to[i - 1]) * k;
    }
  }
  return to[to.length - 1];
}
const FLIGHT = Array.from({ length: 61 }, (_, n) => n / 60);
const TOSS_PATH = {
  x: FLIGHT.map((u) => between(TOSS.at, TOSS.x, u, true)),
  y: FLIGHT.map((u) => between(TOSS.fallAt, TOSS.y, u)),
  spin: FLIGHT.map((u) => `${between(TOSS.at, TOSS.spin, u, true)}deg`),
  open: FLIGHT.map((u) => between([0, 0.2, 1], [TOSS_BUNCHED, 1, 1], u)),
  flat: FLIGHT.map((u) => between([0, 0.86, 1], [1, 1, TOSS_FLAT], u)),
};

// A prop that comes and goes (props.ts `appear`: the speech bubbles): on
// for ON_MS, then off for OFF_MS, over and over, each counting its coming
// or going. A bubble that fades comes in over FADE_MS, growing from FADE_FROM
// of its size; one that bubbles pops up over POP_MS from POP_FROM, a little
// past its size and back; the scroll unrolls over UNROLL_MS, after it's been
// seen rolled up for SCROLL_WAIT_MS when it's first put on. Each goes the way
// it came, over its *_OUT_MS. Rolled up, the scroll is SHUT of its length.
const ON_MS = 3000;
const OFF_MS = 3000;
const FADE_MS = 400;
const FADE_OUT_MS = 400;
const FADE_FROM = 0.9;
const POP_MS = 500;
const POP_OUT_MS = 400;
const POP_FROM = 0.2;
const UNROLL_MS = 900;
const UNROLL_OUT_MS = 700;
const SCROLL_WAIT_MS = 600;
const SHUT = 0.02;
const COMING: Record<NonNullable<Prop['appear']>, [number, number]> = {
  fade: [FADE_MS, FADE_OUT_MS],
  bubble: [POP_MS, POP_OUT_MS],
  unroll: [UNROLL_MS, UNROLL_OUT_MS],
};

// How a placement's prop comes and goes, if it does (props.ts `appear`).
const appearOf = (p: Placement) => (PROPS[p.prop] as Prop).appear;

type Window = { x: number; y: number; w: number; h: number };
const FULL: Window = { x: 0, y: 0, w: 1, h: 1 };

export function SkinDecor({
  art,
  width,
  height,
  window = FULL,
  layer = 'front',
  omit,
  extra,
}: {
  art: ArtName;
  width: number;
  height: number;
  window?: Window;
  layer?: 'front' | 'behind';
  // Leave out some of the season's props (a winner's own hat replaces the
  // season's; their speech bubble clears the sky it covers), and add props of
  // the caller's own (that hat, that bubble), drawn after the season's.
  omit?: (p: Placement) => boolean;
  extra?: Placement[];
}) {
  const skin = useSkin();
  // In layers, whatever's held where the hooves are drawn (layout.ts onThePig).
  const placements = onThePig([...(skin?.decor[art] ?? []).filter((p) => !omit?.(p)), ...(extra ?? [])]).filter(
    (p) => !!(PROPS[p.prop] as Prop).behind === (layer === 'behind')
  );
  if (!placements.length || !width || !height) return null;
  // The whole image's size on screen.
  const iw = width / window.w;
  const ih = height / window.h;
  // Each piece is known by its prop (and which of that prop it is), not its
  // place in the list: a bubble put on clears the sky in its corner, and the
  // pieces after those mustn't start over (a jersey thrown again, a float
  // restarted). Nor does changing a bubble's words.
  const seen = new Map<string, number>();
  const keyOf = (p: Placement) => {
    const n = seen.get(p.prop) ?? 0;
    seen.set(p.prop, n + 1);
    return `${p.prop}#${n}`;
  };
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
      {placements.map((p, i) => (
        <Piece key={keyOf(p)} p={p} i={i} window={window} imageW={iw} imageH={ih} />
      ))}
    </View>
  );
}

function Piece({ p: day, i, window, imageW, imageH }: { p: Placement; i: number; window: Window; imageW: number; imageH: number }) {
  const dark = useTheme().name === 'dark';
  const reduced = useReducedMotion();
  // Part way from the day form to the night one, for a prop that has one.
  const dusk = useMorph(!!day.night || !!day.by);
  const p = morphPlacement(day, dusk);
  const via = day.night?.via;
  const prop: Prop = day.night ? morphProp(PROPS[day.prop], PROPS[nightProp(day)], dusk, via && PROPS[via]) : PROPS[day.prop];
  const swell = via ? 0 : Math.sin(Math.PI * dusk); // 0 at either end, 1 halfway
  const fade = shownAt(day, dusk);
  const left = (p.x - window.x) * imageW;
  const top = (p.y - window.y) * imageH;
  const w = p.w * imageW;
  const h = (w * prop.h) / prop.w;
  const unit = prop.w / w; // grid units per dp
  const line = LINE * imageW * unit;
  const rim = RIM * imageW * unit;
  // The outline and the rim reach past the grid's edge, so the drawing gets a
  // margin of its own (react-native-svg clips to its box on some platforms).
  const pad = line / 2 + rim + 1;
  const bw = w + (2 * pad) / unit;
  const bh = h + (2 * pad) / unit;

  // The view turns (and flips) about its centre, so work out where that centre
  // goes for the anchor to land on (left, top).
  const [gx, gy] = prop.anchor ?? [prop.w / 2, prop.h / 2];
  const ax = ((gx - prop.w / 2) / unit) * (p.flip ? -1 : 1);
  const ay = (gy - prop.h / 2) / unit;
  const turn = ((p.rotate ?? 0) * Math.PI) / 180;
  const cx = left - (ax * Math.cos(turn) - ay * Math.sin(turn));
  const cy = top - (ax * Math.sin(turn) + ay * Math.cos(turn));

  // A slow float, or a twinkle, each prop a little out of step with the others.
  const motion = p.bob ? 'bob' : p.twinkle ? 'twinkle' : null;
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!motion || reduced) {
      t.setValue(0);
      return;
    }
    const half = { duration: motion === 'bob' ? BOB_MS : TWINKLE_MS, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE };
    const loop = Animated.loop(Animated.sequence([Animated.timing(t, { toValue: 1, ...half }), Animated.timing(t, { toValue: 0, ...half })]));
    const start = setTimeout(() => loop.start(), i * 350);
    return () => {
      clearTimeout(start);
      loop.stop();
    };
  }, [motion, reduced, t, i]);
  const bobY = t.interpolate({ inputRange: [0, 1], outputRange: [0, motion === 'bob' ? -h * 0.25 : 0] });
  const scale = t.interpolate({ inputRange: [0, 1], outputRange: [1, motion === 'twinkle' ? 0.8 : 1] });
  const opacity = t.interpolate({ inputRange: [0, 1], outputRange: [1, motion === 'twinkle' ? 0.7 : 1] });

  // Thrown (Placement `toss`: Ash's jersey): once, when it's first drawn,
  // it flies up off the pig's chest, tumbling, and flutters down to land
  // where it's placed, flattening as it settles on the ground. Under Reduce
  // motion it's simply lying there.
  const flight = useRef(new Animated.Value(day.toss ? 0 : 1)).current;
  useEffect(() => {
    if (!day.toss || reduced) {
      flight.setValue(1);
      return;
    }
    flight.setValue(0);
    const throwIt = Animated.timing(flight, { toValue: 1, duration: TOSS_MS, easing: Easing.linear, useNativeDriver: NATIVE });
    throwIt.start();
    return () => throwIt.stop();
  }, [day.toss, reduced, flight]);
  const toss = day.toss
    ? {
        x: flight.interpolate({ inputRange: FLIGHT, outputRange: TOSS_PATH.x.map((v) => v * imageW) }),
        y: flight.interpolate({ inputRange: FLIGHT, outputRange: TOSS_PATH.y.map((v) => v * imageH) }),
        spin: flight.interpolate({ inputRange: FLIGHT, outputRange: TOSS_PATH.spin }),
        open: flight.interpolate({ inputRange: FLIGHT, outputRange: TOSS_PATH.open }),
        flat: flight.interpolate({ inputRange: FLIGHT, outputRange: TOSS_PATH.flat }),
      }
    : null;
  const translateY = toss ? toss.y : bobY;

  // Coming and going (props.ts `appear`: the speech bubbles): `shown` runs 0
  // to 1 as it comes on and back as it goes, on ON_MS, off OFF_MS, over and
  // over. Fading, it's as clear as `shown`, growing a little into place;
  // bubbling, it pops up a little past its size and settles, and swells and
  // shrinks away going; the scroll is always there, `shown` how far it's
  // unrolled. Under Reduce motion it just stays on (the scroll unrolled).
  const appear = appearOf(day);
  const shown = useRef(new Animated.Value(appear && !reduced ? 0 : 1)).current;
  useEffect(() => {
    if (!appear) return;
    if (reduced) {
      shown.setValue(1);
      return;
    }
    const [inMs, outMs] = COMING[appear];
    const ease = Easing.inOut(Easing.cubic);
    shown.setValue(0);
    const cycle = Animated.loop(
      Animated.sequence([
        Animated.timing(shown, { toValue: 1, duration: inMs, easing: ease, useNativeDriver: NATIVE }),
        Animated.delay(ON_MS - inMs),
        Animated.timing(shown, { toValue: 0, duration: outMs, easing: ease, useNativeDriver: NATIVE }),
        Animated.delay(OFF_MS - outMs),
      ])
    );
    const start = setTimeout(() => cycle.start(), appear === 'unroll' ? SCROLL_WAIT_MS : 0);
    return () => {
      clearTimeout(start);
      cycle.stop();
    };
  }, [appear, reduced, shown]);
  const appearOpacity =
    appear === 'fade' ? shown : appear === 'bubble' ? shown.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }) : 1;
  const appearScale =
    appear === 'fade'
      ? shown.interpolate({ inputRange: [0, 1], outputRange: [FADE_FROM, 1] })
      : appear === 'bubble'
        ? shown.interpolate({ inputRange: [0, 0.6, 0.82, 1], outputRange: [POP_FROM, 1.1, 0.96, 1] })
        : 1;

  if (fade <= 0) return null;

  const art = (drawn: Prop, words?: string) => (
    <Svg width={bw} height={bh} viewBox={`${-pad} ${-pad} ${prop.w + 2 * pad} ${prop.h + 2 * pad}`}>
      <PropArt prop={drawn} line={line} rim={dark && prop.rim !== false && p.rim !== false ? rim : undefined} text={words} />
    </Svg>
  );

  // The scroll: its paper (and words) seen through a window that opens down
  // from the top roll (the window lengthens while what's in it is shrunk
  // back, so nothing in it stretches), and the bottom roll carried down with
  // the window's edge. Rolled up, the bottom roll is on the top one and
  // there's nothing to read.
  let drawing: React.ReactNode = art(prop, p.text);
  if (appear === 'unroll' && prop.unroll) {
    const toDp = (y: number) => (y + pad) / unit;
    const top = toDp(prop.unroll.top);
    const length = toDp(prop.unroll.bottom) - top;
    const open = shown.interpolate({ inputRange: [0, 1], outputRange: [SHUT, 1] });
    const drop = shown.interpolate({ inputRange: [0, 1], outputRange: [-(1 - SHUT) * length, 0] });
    const part = (roll?: 'top' | 'bottom') => ({ ...prop, text: roll ? undefined : prop.text, shapes: prop.shapes.filter((s) => s.roll === roll) });
    drawing = (
      <View style={{ width: bw, height: bh }}>
        <Animated.View style={{ position: 'absolute', left: 0, top, width: bw, height: length, overflow: 'hidden', transformOrigin: 'top', transform: [{ scaleY: open }] }}>
          <Animated.View
            style={{ position: 'absolute', left: 0, top: -top, width: bw, height: bh, transformOrigin: `50% ${top}px`, transform: [{ scaleY: Animated.divide(1, open) }] }}
          >
            {art(part(), p.text)}
          </Animated.View>
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: drop }] }]}>{art(part('bottom'))}</Animated.View>
        <View style={StyleSheet.absoluteFill}>{art(part('top'))}</View>
      </View>
    );
  }

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: cx - bw / 2,
        top: cy - bh / 2,
        width: bw,
        height: bh,
        opacity: appear && appear !== 'unroll' ? Animated.multiply(opacity, appearOpacity) : opacity,
        transform: [
          { translateX: toss ? toss.x : 0 },
          { translateY },
          { rotate: `${p.rotate ?? 0}deg` },
          { scaleX: p.flip ? -1 : 1 },
          { scale },
          { scale: appearScale },
          { rotate: toss ? toss.spin : '0deg' },
          { scale: toss ? toss.open : 1 },
          { scaleY: toss ? toss.flat : 1 },
        ],
      }}
    >
      {/* The morph's swell, rock and fade change every frame, so they're on a view
          of their own: the float above may run on the native driver, which
          doesn't pick up a change to the plain values beside it. */}
      <View
        style={
          swell || fade < 1
            ? {
                opacity: fade,
                transform: [{ rotate: `${MORPH_ROCK * Math.sin(2 * Math.PI * dusk)}deg` }, { scale: (1 + MORPH_SWELL * swell) * (1 - FADE_SHRINK * (1 - fade)) }],
              }
            : null
        }
      >
        {drawing}
      </View>
    </Animated.View>
  );
}

// The words in a text slot: one line, or for a two-line slot (a speech
// bubble's) long enough to need it, two, broken at the space nearest the
// middle. A long word with no space stays whole, and shrinks instead.
function textLines(text: string, slot: TextSlot): string[] {
  if (slot.lines !== 2 || text.length <= 12) return [text];
  const mid = text.length / 2;
  let at = -1;
  for (let i = 0; i < text.length; i++) if (text[i] === ' ' && (at < 0 || Math.abs(i - mid) < Math.abs(at - mid))) at = i;
  return at < 0 ? [text] : [text.slice(0, at), text.slice(at + 1)];
}

// A number (Ash's jersey) is drawn from Roboto Bold's own outlines
// (glyphs.ts, scripts/glyphs.py) rather than as text: text is drawn with
// whatever font is found at the moment, and the light / dark sweep's photo
// of the screen could fall back to a regular one, so the number would
// briefly change weight. Shapes are the same everywhere.
const isNumber = (l: string) => /^[0-9]+$/.test(l);

// `digits` centred on `x` with its baseline at `y`, `size` grid units to the
// em, filled in `fill` and (piped) stroked `stroke` wide in it, as the text
// would be.
function NumberShapes({ digits, x, y, size, fill, stroke }: { digits: string; x: number; y: number; size: number; fill: string; stroke: number }) {
  const k = size / DIGIT_EM;
  const width = [...digits].reduce((w, c) => w + DIGITS[c].advance, 0) * k;
  let at = x - width / 2;
  return (
    <>
      {[...digits].map((c, i) => {
        const glyph = DIGITS[c];
        const left = at;
        at += glyph.advance * k;
        return (
          <Path
            key={i}
            d={glyph.d}
            transform={`translate(${left} ${y}) scale(${k} ${-k})`}
            fill={fill}
            stroke={stroke ? fill : undefined}
            strokeWidth={stroke ? stroke / k : undefined}
            strokeLinejoin="round"
          />
        );
      })}
    </>
  );
}

// One prop's drawing, on its own grid, for any <Svg> to place: the dark-mode
// rim under it when `rim` is given (its width beyond the outline, in grid
// units), the shapes with a `line`-wide outline, and `text` in its text slot.
// SkinDecor draws the props round the pig with it; the trough fills with it.
export function PropArt({ prop, line, rim, text }: { prop: Prop; line: number; rim?: number; text?: string }) {
  // Words in the prop's text slot (a name on a cake, what a pig says), shrunk
  // to fit its width by what the widest line really measures in Roboto Bold
  // (glyphs.ts), its piping included. A one-line slot's y is the baseline; a
  // two-line slot's is the middle of the block.
  const slot = prop.text;
  const lines = slot && text ? textLines(text, slot) : [];
  const words = lines.length ? text : null;
  const ems = Math.max(0, ...lines.map(emWidth)) + (slot?.shade ? PIPE_STROKE : 0);
  const size = slot && words ? Math.min(slot.size, slot.maxW / ems) : 0;
  const baseline = (j: number) =>
    !slot ? 0 : slot.lines ? slot.y + (j - (lines.length - 1) / 2) * size * LINE_GAP + size * CAP_MID : slot.y;
  return (
    <>
      {rim !== undefined ? (
        <G fill={RIM_COLOR} stroke={RIM_COLOR} strokeWidth={line + 2 * rim} strokeLinejoin="round" strokeLinecap="round">
          {prop.shapes.map((s, k) => (
            <Path key={k} d={s.d} fill={s.fill === 'none' ? 'none' : undefined} />
          ))}
        </G>
      ) : null}
      {prop.shapes.map((s, k) => (
        <Path
          key={k}
          d={s.d}
          fill={s.fill}
          stroke={s.line ? INK : undefined}
          strokeWidth={s.line ? line : undefined}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
      {slot && words
        ? // Piped: a thick rounded stroke plumps each letter like a line of
          // icing; under it the same letters in `shade`, a little lower, and
          // `shine`, a little higher, give it a rounded edge and a gloss.
          [
            slot.shade ? { fill: slot.shade, dy: PIPE_DROP } : null,
            slot.shine ? { fill: slot.shine, dy: -PIPE_DROP * 0.6 } : null,
            { fill: slot.fill, dy: 0 },
          ].map((layer, k) =>
            layer
              ? lines.map((l, j) =>
                  isNumber(l) ? (
                    <NumberShapes
                      key={`${k}.${j}`}
                      digits={l}
                      x={slot.x}
                      y={baseline(j) + layer.dy * size}
                      size={size}
                      fill={layer.fill}
                      stroke={slot.shade ? size * (k === 2 ? PIPE_STROKE * 0.75 : PIPE_STROKE) : 0}
                    />
                  ) : (
                    <SvgText
                      key={`${k}.${j}`}
                      x={slot.x}
                      y={baseline(j) + layer.dy * size}
                      fontSize={size}
                      fontFamily={font.bold}
                      fill={layer.fill}
                      stroke={slot.shade ? layer.fill : undefined}
                      strokeWidth={slot.shade ? size * (k === 2 ? PIPE_STROKE * 0.75 : PIPE_STROKE) : undefined}
                      strokeLinejoin="round"
                      textAnchor="middle"
                    >
                      {l}
                    </SvgText>
                  )
                )
              : null
          )
        : null}
    </>
  );
}
