import React from 'react';
import Svg, { Circle, G, Path } from 'react-native-svg';

// Line icons for the menu drawer and the licenses screen: round-capped strokes
// on a 24-unit grid, no fill, drawn in whatever color the caller passes (the
// theme's `link`, so they follow light / dark mode).
const GLYPHS = {
  menu: <Path d="M4 7h16M4 12h16M4 17h16" />,
  back: <Path d="M15 5l-7 7 7 7" />,
  close: <Path d="M6 6l12 12M18 6L6 18" />,
  play: (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M10 8.5v7l6-3.5z" />
    </>
  ),
  feedback: <Path d="M4 5.5h16v10.5H9l-5 4zM8 9.5h8M8 12.5h5" />,
  star: <Path d="M12 3.6l2.55 5.2 5.75.83-4.16 4.05.98 5.72L12 16.7l-5.12 2.7.98-5.72L3.7 9.63l5.75-.83z" />,
  help: (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M9.6 9.4a2.5 2.5 0 1 1 3.5 2.3c-.7.35-1.1.8-1.1 1.6v.3M12 16.8v.01" />
    </>
  ),
  shield: <Path d="M12 3l7 3v5.2c0 4.4-2.9 8.2-7 9.8-4.1-1.6-7-5.4-7-9.8V6zM9 12l2 2 4-4" />,
  doc: <Path d="M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5" />,
  code: <Path d="M9 7l-5 5 5 5M15 7l5 5-5 5" />,
  person: (
    <>
      <Circle cx="12" cy="8.5" r="3.5" />
      <Path d="M5 20c.8-3.6 3.7-5.5 7-5.5s6.2 1.9 7 5.5" />
    </>
  ),
  globe: (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M3 12h18M12 3c2.4 2.6 3.6 5.6 3.6 9s-1.2 6.4-3.6 9c-2.4-2.6-3.6-5.6-3.6-9S9.6 5.6 12 3z" />
    </>
  ),
  contrast: (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 3v18M12 7.5h5M12 11h6.6M12 14.5h6.3M12 18h4" />
    </>
  ),
  motion: (
    <>
      <Circle cx="16.5" cy="12" r="4.5" />
      <Path d="M3 8.5h7M2 12h6M3 15.5h7" />
    </>
  ),
  chevron: <Path d="M9 6l6 6-6 6" />, // opens a screen in the app
  external: <Path d="M14 4h6v6M20 4l-8.5 8.5M18 14v6H4V6h6" />, // leaves the app
};

export type GlyphName = keyof typeof GLYPHS;

export function Glyph({
  name,
  size,
  color,
  weight = 2,
}: {
  name: GlyphName;
  size: number;
  color: string;
  weight?: number; // stroke width, in grid units
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <G fill="none" stroke={color} strokeWidth={weight} strokeLinecap="round" strokeLinejoin="round">
        {GLYPHS[name]}
      </G>
    </Svg>
  );
}
