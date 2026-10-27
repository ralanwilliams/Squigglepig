import { useTheme } from '../theme/theme';

// The colors of a full-screen game's chips, card and slider (FieldFrame.tsx,
// PotLadder's `field` look). Deliberately NOT the theme's: they float over
// the game's own art (a forest floor), so they're quiet, see-through dark
// panels in cream with one muted amber, the same in light and dark mode, so
// the art stays the loudest thing on screen. High contrast makes them solid.
export type FieldColors = {
  panel: string; // a chip's fill
  card: string; // the end-of-round card's fill, a little more solid
  line: string; // their hairline edge
  text: string;
  muted: string;
  amber: string; // what counts: the slider's fill, a tier reached, the main button
  amberText: string; // text on amber
  urgent: string; // the clock's last seconds
  track: string; // the slider's empty track
  tick: string; // a prize's tick not yet reached
};

const NORMAL: FieldColors = {
  panel: 'rgba(30, 20, 12, 0.58)',
  card: 'rgba(30, 20, 12, 0.84)',
  line: 'rgba(255, 244, 228, 0.16)',
  text: '#F4EAD9',
  muted: 'rgba(244, 234, 217, 0.7)',
  amber: '#E2B06A',
  amberText: '#2A1A0E',
  urgent: '#FF9C8A',
  track: 'rgba(255, 244, 228, 0.16)',
  tick: 'rgba(30, 20, 12, 0.9)',
};

const HIGH: FieldColors = {
  panel: '#000000',
  card: '#000000',
  line: '#ffffff',
  text: '#ffffff',
  muted: '#ffffff',
  amber: '#FFD08A',
  amberText: '#000000',
  urgent: '#FF8FB3',
  track: 'rgba(255, 255, 255, 0.4)',
  tick: '#000000',
};

export function useFieldColors(): FieldColors {
  return useTheme().contrast === 'high' ? HIGH : NORMAL;
}
