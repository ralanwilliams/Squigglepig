import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import Svg, { G, Path, Text as SvgText } from 'react-native-svg';
import { font } from '../theme/tokens';
import { useReducedMotion, useSkin, useTheme } from '../theme/theme';
import { PROPS, type Prop } from '../theme/skins/props';
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
// the art's at any size; on the dark palette each prop gets the same teal
// sticker rim scripts/dark-art.py gives the artwork.
const LINE = 9 / 954; // the art's black outline
const RIM = 8 / 954; // dark-art.py's RADIUS on the 954px stills
const INK = '#000000';
const RIM_COLOR = '#4ECDC4';
const BOB_MS = 1400;
const TWINKLE_MS = 450;
const CHAR_W = 0.7; // Roboto Bold's average letter width plus the piping, in ems (for fitting a name)
const PIPE_STROKE = 0.11; // piped letters' stroke, in ems
const PIPE_DROP = 0.07; // how far the icing's shade sits below it, in ems
const NATIVE = Platform.OS !== 'web';

type Window = { x: number; y: number; w: number; h: number };
const FULL: Window = { x: 0, y: 0, w: 1, h: 1 };

export function SkinDecor({
  art,
  width,
  height,
  window = FULL,
  layer = 'front',
}: {
  art: ArtName;
  width: number;
  height: number;
  window?: Window;
  layer?: 'front' | 'behind';
}) {
  const skin = useSkin();
  const placements = skin?.decor[art]?.filter((p) => !!(PROPS[p.prop] as Prop).behind === (layer === 'behind'));
  if (!placements?.length || !width || !height) return null;
  // The whole image's size on screen.
  const iw = width / window.w;
  const ih = height / window.h;
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
      {placements.map((p, i) => (
        <Piece key={i} p={p} i={i} left={(p.x - window.x) * iw} top={(p.y - window.y) * ih} imageW={iw} />
      ))}
    </View>
  );
}

function Piece({ p, i, left, top, imageW }: { p: Placement; i: number; left: number; top: number; imageW: number }) {
  const dark = useTheme().name === 'dark';
  const reduced = useReducedMotion();
  const prop: Prop = PROPS[p.prop];
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
  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [0, motion === 'bob' ? -h * 0.25 : 0] });
  const scale = t.interpolate({ inputRange: [0, 1], outputRange: [1, motion === 'twinkle' ? 0.8 : 1] });
  const opacity = t.interpolate({ inputRange: [0, 1], outputRange: [1, motion === 'twinkle' ? 0.7 : 1] });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: cx - bw / 2,
        top: cy - bh / 2,
        width: bw,
        height: bh,
        opacity,
        transform: [{ translateY }, { rotate: `${p.rotate ?? 0}deg` }, { scaleX: p.flip ? -1 : 1 }, { scale }],
      }}
    >
      <Svg width={bw} height={bh} viewBox={`${-pad} ${-pad} ${prop.w + 2 * pad} ${prop.h + 2 * pad}`}>
        <PropArt prop={prop} line={line} rim={dark && prop.rim !== false && p.rim !== false ? rim : undefined} text={p.text} />
      </Svg>
    </Animated.View>
  );
}

// One prop's drawing, on its own grid, for any <Svg> to place: the dark-mode
// rim under it when `rim` is given (its width beyond the outline, in grid
// units), the shapes with a `line`-wide outline, and `text` in its text slot.
// SkinDecor draws the props round the pig with it; the trough fills with it.
export function PropArt({ prop, line, rim, text }: { prop: Prop; line: number; rim?: number; text?: string }) {
  // Words in the prop's text slot (a name on a cake), shrunk to fit its width.
  const slot = prop.text;
  const words = slot && text ? text : null;
  const size = slot && words ? Math.min(slot.size, slot.maxW / (CHAR_W * words.length)) : 0;
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
            layer ? (
              <SvgText
                key={k}
                x={slot.x}
                y={slot.y + layer.dy * size}
                fontSize={size}
                fontFamily={font.bold}
                fill={layer.fill}
                stroke={slot.shade ? layer.fill : undefined}
                strokeWidth={slot.shade ? size * (k === 2 ? PIPE_STROKE * 0.75 : PIPE_STROKE) : undefined}
                strokeLinejoin="round"
                textAnchor="middle"
              >
                {words}
              </SvgText>
            ) : null
          )
        : null}
    </>
  );
}
