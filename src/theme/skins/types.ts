import type { Theme } from '../tokens';
import type { IMAGES } from '../../assets/assets';
import type { PropName } from './props';

// A seasonal skin: a palette laid over the classic one, plus vector props drawn
// on the pig artwork. The artwork itself, the sounds, the drawing paper and the
// judge's marks are never skinned — they are Squigglepig.

// The roles a skin may recolor. Any it leaves out keep the classic value, so
// a role added to Theme later never breaks an older skin. High contrast
// ignores skin palettes entirely (its palettes are tuned by hand) and keeps
// only the props.
export type Palette = Partial<Omit<Theme, 'name' | 'contrast' | 'edge' | 'overlayBorder'>>;

export type ArtName = keyof typeof IMAGES;

// One prop on one image. x / y are where its anchor goes (its centre unless
// the prop says otherwise) and w its width, as fractions of the light-mode
// image; rotate is in degrees, clockwise, about the anchor; flip mirrors it;
// bob floats it gently up and down and twinkle pulses it (both still under
// Reduce motion). text fills the prop's text slot (the name on a cake).
// rim: false leaves it out of the dark-mode sticker rim (things the pig
// holds sit in front of it, inside its outline, where the art has none).
export type Placement = {
  prop: PropName;
  x: number;
  y: number;
  w: number;
  rotate?: number;
  flip?: boolean;
  bob?: boolean;
  twinkle?: boolean;
  text?: string;
  rim?: false;
};

// [month, day], 1-based months, local time.
export type MonthDay = [number, number];
// Shown from `from` to `to` inclusive. `to` may come before `from` to span New
// Year. Holidays that move (Easter, Thanksgiving) work theirs out per year.
export type Season = { from: MonthDay; to: MonthDay };

export type Skin = {
  id: string;
  label: string; // for people: the previews' theme menu
  season: Season | ((year: number) => Season);
  light: Palette;
  dark: Palette;
  decor: Partial<Record<ArtName, Placement[]>>;
  // What fills the prompts screen's trough in place of mud (trough.ts), the
  // list repeated across its slots: usually what the pig holds. Without one
  // the trough keeps its mud.
  trough?: PropName[];
};
