import React, { memo } from 'react';
import { G, Path } from 'react-native-svg';
import { PropArt } from './SkinDecor';
import { STICKER_ART } from '../stickers/art';
import { PROPS, type Prop } from '../theme/skins/props';
import { inkColor, type Sticker } from '../lib/drawing';

// A drawing's parts (src/lib/drawing.ts), for any <Svg> whose viewBox is in
// drawing units: the canvas while it's drawn on (PigCanvas), and the finished
// drawing wherever it's shown (DrawingImage).

// The strokes, each in its own ink (black unless a brush says otherwise).
// Memoized: on the canvas the live stroke re-renders every frame while the
// finger moves, and it mustn't drag every earlier path through React with it
// (that lag was the wobble in long drawings). The caller hands in a new array
// exactly when there's something new to draw.
export const Strokes = memo(function Strokes({ strokes, inks, width }: { strokes: string[]; inks?: (string | null)[]; width: number }) {
  return (
    <>
      {strokes.map((d, i) => (
        <Path key={i} d={d} stroke={inkColor(inks, i)} strokeWidth={width} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </>
  );
});

// A sticker's outline, in drawing units: a shade under the pen's, so a
// sticker sits with the lines drawn round it.
const STICKER_LINE = 2.5;

// The stickers, on top of the strokes, each centred on its x / y, s units
// wide, turned r degrees. One this app has no art for is left out.
export function Stickers({ stickers }: { stickers?: Sticker[] }) {
  if (!stickers?.length) return null;
  return (
    <>
      {stickers.map((s, i) => {
        const name = STICKER_ART[s.id]?.prop;
        if (!name) return null;
        const art: Prop = PROPS[name];
        const k = s.s / art.w; // drawing units per grid unit
        return (
          <G key={i} transform={`translate(${s.x} ${s.y}) rotate(${s.r}) scale(${k}) translate(${-art.w / 2} ${-art.h / 2})`}>
            <PropArt prop={art} line={STICKER_LINE / k} />
          </G>
        );
      })}
    </>
  );
}
