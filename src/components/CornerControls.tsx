import React, { useEffect, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';
import { SoundToggle } from './SoundToggle';
import { ThemeToggle } from './ThemeToggle';
import { useUi, type Ui } from '../theme/responsive';

// The app-wide switches, floating over every screen in the header band's
// top-right corner, where a screen's icon actions usually go: sound on / off
// (SoundToggle) beside light / dark (ThemeToggle), outermost. Each is a 44dp
// box, vertically centred on a one-line title, the outer glyph flush with the
// band's horizontal padding. They're drawn in the theme's link color, like
// the menu's ☰ in the opposite corner, so they follow light / dark, high
// contrast and the seasonal themes. Stage keeps the header's text clear of
// them (cornerReserve), and a full-screen game puts a disc behind each one
// (FieldFrame.tsx, from cornerSlot) and the glyphs in its own color
// (useCornerInk). Gone while a screen hides them (hideCornerControls).

// How many 44dp slots the corner holds, counted from the right edge.
export const CORNER_SLOTS = 2;

// Slot `i`'s 44dp box (0 is the outermost), as offsets from the frame's top
// and right edges.
export function cornerSlot(ui: Ui, i: number) {
  const size = ui.sp(44);
  return { top: ui.insets.top + ui.sp(5), right: ui.insets.right + ui.pad - ui.sp(9) + i * size, size };
}

// How far in from the safe area's edges a header band keeps its text: past
// the corner's innermost glyph, with a little air. Both sides, so a centred
// title stays centred.
export function cornerReserve(ui: Ui) {
  return ui.pad + ui.sp(36) + (CORNER_SLOTS - 1) * ui.sp(44);
}

// Whether the switches are hidden: by a screen that's locked so a child can
// only play (Truffle Hunter's endless hunt, src/arcade/RunShell.tsx).
let hidden = false;
// The glyphs' color while a screen paints its own backdrop behind them;
// null for the theme's link color.
let ink: string | null = null;
const watchers = new Set<() => void>();
const notify = () => watchers.forEach((w) => w());
export function hideCornerControls(on: boolean) {
  if (on === hidden) return;
  hidden = on;
  notify();
}
const watch = (w: () => void) => {
  watchers.add(w);
  return () => {
    watchers.delete(w);
  };
};
export const useCornerControlsHidden = () => useSyncExternalStore(watch, () => hidden);

// While the calling screen is mounted, the switches are drawn in `color`
// (a full-screen game's cream, on its dark discs).
export function useCornerInk(color: string) {
  useEffect(() => {
    ink = color;
    notify();
    return () => {
      if (ink !== color) return;
      ink = null;
      notify();
    };
  }, [color]);
}

// Mounted once, in the root layout. Side by side the boxes touch, so each
// only reaches past its outer edges: neither takes a tap meant for the other.
const SLOP = 6;
export function CornerControlsOverlay() {
  const ui = useUi();
  const color = useSyncExternalStore(watch, () => ink) ?? undefined;
  if (useCornerControlsHidden()) return null;
  const { top, right } = cornerSlot(ui, 0);
  return (
    <View pointerEvents="box-none" style={[styles.overlay, { top, right }]}>
      <SoundToggle color={color} hitSlop={{ top: SLOP, bottom: SLOP, left: SLOP, right: 0 }} />
      <ThemeToggle color={color} hitSlop={{ top: SLOP, bottom: SLOP, left: 0, right: SLOP }} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', zIndex: 10, flexDirection: 'row' },
});
