import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Glyph } from '../components/Glyph';
import { canvas } from '../theme/tokens';
import { useTheme } from '../theme/theme';
import { UNLOCKABLE, paletteFor } from '../theme/skins';
import { PROPS, type Prop, type PropName } from '../theme/skins/props';
import { PropArt } from '../components/SkinDecor';
import { OUTFITS } from '../avatar/outfits';
import { BUBBLES } from '../avatar/bubbles';
import { STICKER_ART } from '../stickers/art';
import { BALLOON, BRUSH_SIZE, DISCO, DOVES, FIREWORKS, KINDS, RAVE, isNone, type Kind, type Reward } from './catalog';

// A small picture of a reward, `size` dp square. A kind without a drawing of
// its own here, or a reward with no art (a default card, No outfit), shows
// the kind's glyph (catalog.ts KINDS); give a kind a picture by adding it to
// THUMBS.
type Thumb<K extends Kind> = (reward: Extract<Reward, { kind: K }>, size: number, edge: string) => React.ReactNode | null;

// A prop's own drawing (props.ts), fitted to the square with room for its
// outline: an outfit, a speech bubble, a sticker, a theme's part on Your pig.
export function propThumb(name: PropName, size: number) {
  const prop: Prop = PROPS[name];
  const side = Math.max(prop.w, prop.h);
  const line = side / 24;
  const pad = line;
  const box = side + 2 * pad;
  return (
    <Svg width={size} height={size} viewBox={`${(prop.w - side) / 2 - pad} ${(prop.h - side) / 2 - pad} ${box} ${box}`}>
      <PropArt prop={prop} line={line} text={prop.text ? '…' : undefined} />
    </Svg>
  );
}

const THUMBS: { [K in Kind]?: Thumb<K> } = {
  // The theme's two backgrounds, day on the left and night on the right, with
  // its accent in the middle. The default card is classic.
  theme: (r, size, edge) => {
    const skin = isNone(r) ? null : UNLOCKABLE[r.id];
    if (skin === undefined) return null;
    const day = paletteFor(skin, 'light', false);
    const night = paletteFor(skin, 'dark', false);
    return (
      <Svg width={size} height={size} viewBox="0 0 40 40">
        <Path d="M20 2A18 18 0 0 0 20 38Z" fill={day.background} />
        <Path d="M20 2A18 18 0 0 1 20 38Z" fill={night.background} />
        <Circle cx="20" cy="20" r="7" fill={day.accent} />
        <Circle cx="20" cy="20" r="18" fill="none" stroke={edge} strokeWidth={1.5} />
      </Svg>
    );
  },
  // An outfit's own drawing; a long thin one (the magic wand) on the slant,
  // as it's carried, and smaller so its ends stay in the square, or it's a dash.
  outfit: (r, size) => {
    const outfit = OUTFITS[r.id];
    if (!outfit) return null;
    const prop = PROPS[outfit.prop];
    if (prop.w < prop.h * 4) return propThumb(outfit.prop, size);
    return <View style={{ width: size, height: size, transform: [{ rotate: '-35deg' }, { scale: 0.8 }] }}>{propThumb(outfit.prop, size)}</View>;
  },
  bubble: (r, size) => (BUBBLES[r.id] ? propThumb(BUBBLES[r.id], size) : null),
  // Fireworks: a burst in the win's colors, rays round a gold heart. Disco: a
  // mirror ball throwing beams. Rave: crossing lasers and a glow stick.
  // Balloon: the balloon on its string. Doves: the box, a dove flying out.
  celebration: (r, size, edge) =>
    r.id === FIREWORKS ? (
      <Svg width={size} height={size} viewBox="0 0 40 40">
        {['#FFD54A', '#FF5C8A', '#4FC3F7', '#9CFF6B', '#C08CFF', '#FF8A3D', '#FF4D4D', '#4FC3F7'].map((c, i) => {
          const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
          return (
            <Path
              key={i}
              d={`M${20 + Math.cos(a) * 8} ${20 + Math.sin(a) * 8}L${20 + Math.cos(a) * 17} ${20 + Math.sin(a) * 17}`}
              stroke={c}
              strokeWidth={3}
              strokeLinecap="round"
            />
          );
        })}
        <Circle cx="20" cy="20" r="4" fill="#FFC21A" />
      </Svg>
    ) : r.id === DISCO ? (
      // A mirror ball on its cord, its mirrors in a grid, throwing two beams.
      <Svg width={size} height={size} viewBox="0 0 40 40">
        <Path d="M20 22L6 40H13Z" fill="#FF3FA4" fillOpacity={0.55} />
        <Path d="M20 22L34 40H27Z" fill="#3FE0FF" fillOpacity={0.55} />
        <Path d="M20 2V10" stroke={edge} strokeWidth={1.5} />
        <Circle cx="20" cy="20" r="10" fill="#C3CBD3" stroke={edge} strokeWidth={1.5} />
        <Path d="M10.6 16.5h18.8M10 20h20M10.6 23.5h18.8M16 10.8c-2 5.5-2 12.9 0 18.4M24 10.8c2 5.5 2 12.9 0 18.4M20 10v20" stroke="#5A646E" strokeWidth={0.9} fill="none" />
        <Path d="M14.5 14.5h3v3h-3z" fill="#FFFFFF" />
      </Svg>
    ) : r.id === BALLOON ? (
      // The balloon on its string, a highlight on it.
      <Svg width={size} height={size} viewBox="0 0 40 40">
        <Path d="M20 29c2 3-2 5 0 9" stroke={edge} strokeWidth={1.2} fill="none" />
        <Path d="M18.5 29.5h3L20 27.5z" fill="#D93762" />
        <Path d="M20 28C12 26 8 20 8 14.5 8 8 13.5 3 20 3s12 5 12 11.5C32 20 28 26 20 28z" fill="#FF4F7B" stroke="#D93762" strokeWidth={1.2} />
        <Path d="M13.5 9.5c-1.5 1.5-2 3.5-2 5" stroke="#FFFFFF" strokeOpacity={0.6} strokeWidth={2} strokeLinecap="round" fill="none" />
      </Svg>
    ) : r.id === DOVES ? (
      // The box, its lid up, and a dove flying out of it.
      <Svg width={size} height={size} viewBox="0 0 40 40">
        <Path d="M8 26h18v11H8z" fill="#FFF4E0" stroke={edge} strokeWidth={1.2} />
        <Path d="M15.5 26h3v11h-3z" fill="#E2B04A" />
        <Path d="M8 26L4 16l3-1 4 10z" fill="#FFF4E0" stroke={edge} strokeWidth={1.2} />
        <Path d="M36 9q-2-2-4-1-5 0-9 4l-4-1 1 3q4 3 9 0 3-1 4-3z" fill="#FFFFFF" stroke={edge} strokeWidth={1.1} strokeLinejoin="round" />
        <Path d="M29 10q-1-6-6-8 1 5 2 8z" fill="#FFFFFF" stroke={edge} strokeWidth={1.1} strokeLinejoin="round" />
      </Svg>
    ) : r.id === RAVE ? (
      // Two laser fans crossing from the bottom corners, and a glow stick.
      <Svg width={size} height={size} viewBox="0 0 40 40">
        <Path d="M2 38L14 2M2 38L24 4M2 38L34 10" stroke="#39FF14" strokeWidth={1.6} strokeLinecap="round" />
        <Path d="M38 38L26 2M38 38L16 4M38 38L6 10" stroke="#FF2BD6" strokeWidth={1.6} strokeLinecap="round" />
        <Path d="M14 28L26 20" stroke="#00F0FF" strokeOpacity={0.35} strokeWidth={7} strokeLinecap="round" />
        <Path d="M14 28L26 20" stroke="#00F0FF" strokeWidth={3.5} strokeLinecap="round" />
        <Path d="M14 28L26 20" stroke="#FFFFFF" strokeWidth={1.2} strokeLinecap="round" />
      </Svg>
    ) : null,
  // A sticker pack shows its first sticker.
  sticker: (r, size) => {
    const first = Object.values(STICKER_ART).find((s) => s.pack === r.id);
    return first ? propThumb(first.prop, size) : null;
  },
  // A squiggle of the color on a disc of the drawing paper, which is white on
  // every palette, so the swatch looks as it will on the canvas.
  brush: (r, size) => (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: canvas.fill, overflow: 'hidden' }}>
      <Svg width={size} height={size} viewBox="0 0 40 40">
        <Path d="M8 25c3-9 7-11 10-5s7 7 10-1 4-5 5-3" fill="none" stroke={r.color} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  ),
  // Brush size: three lines on the drawing paper, thin to thick.
  tool: (r, size) =>
    r.id === BRUSH_SIZE ? (
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: canvas.fill, overflow: 'hidden' }}>
        <Svg width={size} height={size} viewBox="0 0 40 40">
          <Path d="M11 12.5h18" stroke={canvas.ink} strokeWidth={1.5} strokeLinecap="round" />
          <Path d="M11 19.5h18" stroke={canvas.ink} strokeWidth={3.5} strokeLinecap="round" />
          <Path d="M11 27.5h18" stroke={canvas.ink} strokeWidth={6} strokeLinecap="round" />
        </Svg>
      </View>
    ) : null,
};

export function RewardThumb({ reward, size }: { reward: Reward; size: number }) {
  const theme = useTheme();
  const draw = THUMBS[reward.kind] as Thumb<Kind> | undefined;
  const picture = draw?.(reward as never, size, theme.surfaceBorder);
  if (picture) return <>{picture}</>;
  return <Glyph name={KINDS[reward.kind].glyph} size={size} color={theme.surfaceText} weight={1.6} />;
}
