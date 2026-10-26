import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg from 'react-native-svg';
import { Glyph, type GlyphName } from './Glyph';
import { PropArt } from './SkinDecor';
import { STICKER_ART } from '../stickers/art';
import { PROPS, type Prop } from '../theme/skins/props';
import type { Ui } from '../theme/responsive';

// Stickers on the drawing canvas (PigCanvas), for a player who has won a
// sticker pack (src/rewards): a button under the ink picker, dressed like it
// (a dark pill on the paper), that opens a tray of their stickers, one pack to
// a row. A tapped sticker lands in the middle of the view, selected; while it
// is, StickerControls (along the canvas's foot) resize, turn and remove it,
// and Done goes back to drawing.

const CELL = 36; // a sticker in the tray, with its padding, base dp
const PER_ROW = 4; // a pack's worth

export function StickerPicker({
  stickers,
  open,
  onOpen,
  onPick,
  ui,
}: {
  stickers: string[]; // sticker ids the player can use
  open: boolean;
  onOpen: () => void;
  onPick: (id: string) => void;
  ui: Ui;
}) {
  const box = [styles.pill, { padding: ui.sp(3), borderRadius: ui.sp(18), gap: ui.sp(2) }];
  if (!open) {
    return (
      <View style={box}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Stickers"
          accessibilityHint="Shows the stickers you can stamp on your drawing"
          onPress={onOpen}
          hitSlop={ui.sp(6)}
          style={[styles.center, { width: ui.sp(30), height: ui.sp(30) }]}
        >
          <Glyph name="sticker" size={ui.sp(22)} color="#ffffff" weight={1.8} />
        </Pressable>
      </View>
    );
  }
  return (
    <View style={[box, styles.row, { maxWidth: ui.sp(CELL) * PER_ROW + ui.sp(2) * (PER_ROW - 1) + ui.sp(3) * 2 }]} accessibilityLabel="Stickers">
      {stickers.map((id) => (
        <Pressable
          key={id}
          accessibilityRole="button"
          accessibilityLabel={STICKER_ART[id]?.label ?? 'Sticker'}
          onPress={() => onPick(id)}
          hitSlop={ui.sp(2)}
          style={({ pressed }) => [styles.center, styles.cell, { width: ui.sp(CELL), height: ui.sp(CELL), borderRadius: ui.sp(8), opacity: pressed ? 0.6 : 1 }]}
        >
          <StickerIcon id={id} size={ui.sp(CELL - 6)} />
        </Pressable>
      ))}
    </View>
  );
}

// A sticker's drawing fitted to a square: the tray, the reward card of its
// pack (RewardThumb).
export function StickerIcon({ id, size }: { id: string; size: number }) {
  const name = STICKER_ART[id]?.prop;
  if (!name) return null;
  const prop: Prop = PROPS[name];
  const side = Math.max(prop.w, prop.h);
  const line = side / 24;
  const box = side + 2 * line;
  return (
    <Svg width={size} height={size} viewBox={`${(prop.w - side) / 2 - line} ${(prop.h - side) / 2 - line} ${box} ${box}`}>
      <PropArt prop={prop} line={line} />
    </Svg>
  );
}

// The selected sticker's controls, along the foot of the canvas.
const CONTROLS: { glyph: GlyphName; label: string; act: 'smaller' | 'bigger' | 'left' | 'right' | 'remove' | 'done' }[] = [
  { glyph: 'minus', label: 'Smaller', act: 'smaller' },
  { glyph: 'plus', label: 'Bigger', act: 'bigger' },
  { glyph: 'turnLeft', label: 'Turn left', act: 'left' },
  { glyph: 'turnRight', label: 'Turn right', act: 'right' },
  { glyph: 'trash', label: 'Remove sticker', act: 'remove' },
  { glyph: 'check', label: 'Done', act: 'done' },
];
export type StickerAct = (typeof CONTROLS)[number]['act'];

export function StickerControls({ onAct, ui }: { onAct: (act: StickerAct) => void; ui: Ui }) {
  return (
    <View pointerEvents="box-none" style={[styles.foot, { bottom: ui.sp(8) }]}>
      <View style={[styles.pill, styles.row, { padding: ui.sp(3), borderRadius: ui.sp(22), gap: ui.sp(2) }]}>
        {CONTROLS.map((c) => (
          <Pressable
            key={c.act}
            accessibilityRole="button"
            accessibilityLabel={c.label}
            onPress={() => onAct(c.act)}
            hitSlop={ui.sp(2)}
            style={({ pressed }) => [
              styles.center,
              c.act === 'done' && styles.done,
              { width: ui.sp(38), height: ui.sp(38), borderRadius: ui.sp(19), opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Glyph name={c.glyph} size={ui.sp(20)} color={c.act === 'done' ? '#000000' : '#ffffff'} weight={2.2} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: 'flex-start', backgroundColor: 'rgba(0, 0, 0, 0.55)' },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  center: { alignItems: 'center', justifyContent: 'center' },
  cell: { backgroundColor: 'rgba(255, 255, 255, 0.92)' },
  foot: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  done: { backgroundColor: '#ffffff' },
});
