import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Glyph } from '../components/Glyph';
import { canvas } from '../theme/tokens';
import { useTheme } from '../theme/theme';
import { KINDS, type Kind, type Reward } from './catalog';

// A small picture of a reward, `size` dp square. A kind without a drawing of
// its own here shows its glyph (catalog.ts KINDS); give it one by adding it to
// THUMBS — a theme's colors, an outfit's prop, a sticker.
type Thumb<K extends Kind> = (reward: Extract<Reward, { kind: K }>, size: number) => React.ReactNode;

const THUMBS: { [K in Kind]?: Thumb<K> } = {
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
  if (draw) return <>{draw(reward as never, size)}</>;
  return <Glyph name={KINDS[reward.kind].glyph} size={size} color={theme.surfaceText} weight={1.6} />;
}
