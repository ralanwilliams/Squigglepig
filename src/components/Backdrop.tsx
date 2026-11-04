import React, { useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';
import { useTheme, useThemeMode } from '../theme/theme';
import { useUi } from '../theme/responsive';

// The pattern on every screen's background: polka dots, a soft staggered grid
// of small dots in the theme's own text colour at a whisper, so it's the same
// pattern on every theme and in dark mode, only its colours change. Drawn
// first in each screen's container (Stage, WorkStage, the licenses screen,
// the menu drawer), behind everything; every container starts at the screen's
// corner, so the dots line up from one screen to the next. Off in high
// contrast, where the background stays plain.
//
// `style` shapes it to a container that isn't square-cornered (the menu
// drawer's rounded edge), clipping the dots to it.
//
// A TILE-dp square (scaled with the UI) holds two dots, one a quarter of the
// way in and one three quarters, which staggers them.
const TILE = 36;
const DOT = 2.4; // radius, base dp
const ALPHA = 0.09;

// Each backdrop's pattern has an id of its own: on the web every <svg> shares
// one document, and screens fading into each other draw two at once.
let next = 0;

export function Backdrop({ style }: { style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const { highContrast } = useThemeMode();
  const ui = useUi();
  const [id] = useState(() => `backdrop-dots-${++next}`);
  if (highContrast) return null;
  const tile = ui.sp(TILE);
  const r = ui.sp(DOT);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style && styles.clip, style]}>
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id={id} patternUnits="userSpaceOnUse" width={tile} height={tile}>
            <Circle cx={tile / 4} cy={tile / 4} r={r} fill={theme.text} />
            <Circle cx={(tile * 3) / 4} cy={(tile * 3) / 4} r={r} fill={theme.text} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} opacity={ALPHA} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
});
