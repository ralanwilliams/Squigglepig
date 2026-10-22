import React from 'react';
import Svg, { Circle, G, Path } from 'react-native-svg';

// Line icons for the menu drawer and the licenses and rewards screens:
// round-capped strokes on a 24-unit grid, no fill, drawn in whatever color the
// caller passes (the theme's `link`, so they follow light / dark mode).
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
  season: <Path d="M4 6h16v14H4zM4 10h16M8 3.5v4M16 3.5v4M12 12.6l1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2-1.6-1.5 2.2-.3z" />, // a calendar with a star
  gift: <Path d="M4 11h16v9H4zM3 7.5h18V11H3zM12 7.5V20M12 7.5C10.8 4.6 7 4.1 7 6s3.4 1.5 5 1.5zM12 7.5c1.2-2.9 5-3.4 5-1.5s-3.4 1.5-5 1.5z" />, // the Rewards screen
  lock: <Path d="M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3" />, // a reward not yet won
  // One per kind of reward (src/rewards/catalog.ts KINDS).
  palette: (
    <>
      <Path d="M12 3.5c-5 0-9 3.8-9 8.5s4 8.5 9 8.5c1.4 0 2.1-1 1.6-2.1-.5-1.2.3-2.4 1.6-2.4H17c2.2 0 4-1.8 4-4 0-4.7-4-8.5-9-8.5z" />
      <Circle cx="7.6" cy="11.4" r=".6" />
      <Circle cx="10" cy="7.6" r=".6" />
      <Circle cx="14.6" cy="7.6" r=".6" />
    </>
  ),
  brush: <Path d="M19.5 4.5l-7.2 7.2M10.6 10.6l2.8 2.8M10.6 10.6c-2.4-.5-4.6 1.2-4.6 3.9 0 1.5-.9 2.7-2.5 3.4 3.4 1.8 7.9.7 9.2-2.4.5-1.3.4-2.5-.3-3.5" />,
  sticker: <Path d="M5 4h14v9l-7 7H5zM19 13h-5.5a1.5 1.5 0 0 0-1.5 1.5V20M9 9.5v.01M14 9.5v.01" />, // a sticker peeling at one corner
  hat: <Path d="M8 4.5h8V16H8zM4 16h16M8 12.5h8" />, // a top hat
  bubble: <Path d="M4 5h16v11H10.5L6 20v-4H4z" />, // the pig's speech bubble
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
