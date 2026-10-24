import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Glyph } from '../components/Glyph';
import { canvas } from '../theme/tokens';
import { useTheme } from '../theme/theme';
import { UNLOCKABLE, paletteFor } from '../theme/skins';
import { KINDS, isNone, type Kind, type Reward } from './catalog';

// A small picture of a reward, `size` dp square. A kind without a drawing of
// its own here, or a reward its drawing can't show yet (a theme still coming
// soon has no skin), shows the kind's glyph (catalog.ts KINDS); give a kind a
// picture by adding it to THUMBS.
type Thumb<K extends Kind> = (reward: Extract<Reward, { kind: K }>, size: number, edge: string) => React.ReactNode | null;

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
  // A squiggle of the color on a disc of the drawing paper, which is white on
  // every palette, so the swatch looks as it will on the canvas.
  brush: (r, size) => (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: canvas.fill, overflow: 'hidden' }}>
      <Svg width={size} height={size} viewBox="0 0 40 40">
        <Path d="M8 25c3-9 7-11 10-5s7 7 10-1 4-5 5-3" fill="none" stroke={r.color} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  ),
};

export function RewardThumb({ reward, size }: { reward: Reward; size: number }) {
  const theme = useTheme();
  const draw = THUMBS[reward.kind] as Thumb<Kind> | undefined;
  const picture = draw?.(reward as never, size, theme.surfaceBorder);
  if (picture) return <>{picture}</>;
  return <Glyph name={KINDS[reward.kind].glyph} size={size} color={theme.surfaceText} weight={1.6} />;
}
