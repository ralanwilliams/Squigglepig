import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg from 'react-native-svg';
import { type GlyphName } from './Glyph';
import { CanvasPill, PillButton } from './CanvasControls';
import { PropArt } from './SkinDecor';
import { STICKER_ART } from '../stickers/art';
import { PROPS, type Prop } from '../theme/skins/props';
import type { Ui } from '../theme/responsive';

// Stickers on the drawing canvas (DrawingBoard), for a player who has won a
// sticker pack (src/rewards): a button under the ink picker, dressed like it
// (a dark pill on the paper, CanvasControls.tsx), that opens a tray of their stickers, one pack to
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
  if (!open) {
    return (
      <CanvasPill ui={ui} pad={3} radius={18}>
        <PillButton
          glyph="sticker"
          label="Stickers"
          hint="Shows the stickers you can stamp on your drawing"
          onPress={onOpen}
          size={30}
          glyphSize={22}
          weight={1.8}
          slop={6}
          ui={ui}
        />
      </CanvasPill>
    );
  }
  return (
    <CanvasPill
      ui={ui}
      pad={3}
      radius={18}
      wrap
      style={{ maxWidth: ui.sp(CELL) * PER_ROW + ui.sp(2) * (PER_ROW - 1) + ui.sp(3) * 2 }}
      accessibilityLabel="Stickers"
    >
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
    </CanvasPill>
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
      <CanvasPill ui={ui} pad={3} radius={22} wrap style={styles.centred}>
        {CONTROLS.map((c) => (
          <PillButton
            key={c.act}
            glyph={c.glyph}
            label={c.label}
            onPress={() => onAct(c.act)}
            lit={c.act === 'done'}
            size={38}
            glyphSize={20}
            weight={2.2}
            slop={2}
            ui={ui}
          />
        ))}
      </CanvasPill>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  cell: { backgroundColor: 'rgba(255, 255, 255, 0.92)' },
  foot: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  centred: { alignSelf: 'center' }, // a pill keeps to the start of its row otherwise
});
