import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { Glyph, type GlyphName } from './Glyph';
import { zoomLabel } from '../lib/zoom';
import { FONT_CAP, type Ui } from '../theme/responsive';
import { font } from '../theme/tokens';

// The drawing board's controls (DrawingBoard) float on the paper in dark,
// fully rounded pills of white glyphs, the same in light and dark mode (the
// paper is white in both): the brush (BrushPicker) and the stickers
// (StickerPicker) in the top-left corner, the zoom in the top-right, Clear ·
// Undo in the bottom-right, and a selected sticker's controls along the foot
// (StickerControls).

// The zoom and Clear · Undo pills: 30 dp buttons in 2 dp of grey, 34 dp tall
// (the height of the 1× / 2× switch the zoom replaced).
export const PILL = { item: 30, pad: 2 };
export const PILL_H = PILL.item + PILL.pad * 2;
// How far the pills sit in from the paper's edges, base dp.
export const PILL_INSET = 8;

const GAP = 2;

// The pill itself: a row of buttons (or dots, or sticker tiles) `pad` base dp
// in from its edge, its ends rounded by `radius`. `wrap` lets a long row run
// onto more lines (an open tray).
export function CanvasPill({
  ui,
  pad,
  radius,
  wrap,
  style,
  children,
  ...rest
}: ViewProps & { ui: Ui; pad: number; radius: number; wrap?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      {...rest}
      style={[styles.pill, wrap && styles.wrap, { padding: ui.sp(pad), gap: ui.sp(GAP), borderRadius: ui.sp(radius) }, style]}
    >
      {children}
    </View>
  );
}

// A round glyph button in a pill. `lit` is the white one with a black glyph
// (a sticker's Done); a disabled one is dimmed.
export function PillButton({
  glyph,
  label,
  hint,
  onPress,
  disabled,
  lit,
  size,
  glyphSize,
  weight,
  slop,
  ui,
}: {
  glyph: GlyphName;
  label: string;
  hint?: string;
  onPress: () => void;
  disabled?: boolean;
  lit?: boolean;
  size: number; // base dp
  glyphSize: number; // base dp
  weight: number; // the glyph's stroke, in grid units
  slop: number; // base dp of hit area past its edge
  ui: Ui;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={disabled ? { disabled: true } : undefined}
      disabled={disabled}
      onPress={onPress}
      hitSlop={ui.sp(slop)}
      style={({ pressed }) => [
        styles.center,
        lit && styles.lit,
        {
          width: ui.sp(size),
          height: ui.sp(size),
          borderRadius: ui.sp(size / 2),
          opacity: disabled ? 0.35 : pressed ? 0.6 : 1,
        },
      ]}
    >
      <Glyph name={glyph} size={ui.sp(glyphSize)} color={lit ? '#000000' : '#ffffff'} weight={weight} />
    </Pressable>
  );
}

// − zoom +: the level between buttons that step it out and in, each dimmed
// at its end of the range.
export function ZoomControl({
  zoom,
  min,
  max,
  onStep,
  ui,
  style,
}: {
  zoom: number;
  min: number;
  max: number;
  onStep: (dir: 1 | -1) => void;
  ui: Ui;
  style?: StyleProp<ViewStyle>;
}) {
  const shown = zoomLabel(zoom);
  const button = { size: PILL.item, glyphSize: 18, weight: 2.6, slop: 6, ui };
  return (
    <CanvasPill ui={ui} pad={PILL.pad} radius={PILL_H / 2} style={style}>
      <PillButton glyph="minus" label="Zoom out" disabled={zoom <= min} onPress={() => onStep(-1)} {...button} />
      <Text
        style={[styles.readout, { minWidth: ui.sp(34), fontSize: ui.f(13) }]}
        maxFontSizeMultiplier={FONT_CAP}
        accessibilityLabel={`Zoom: ${shown.slice(0, -1)} times`}
      >
        {shown}
      </Text>
      <PillButton glyph="plus" label="Zoom in" disabled={zoom >= max} onPress={() => onStep(1)} {...button} />
    </CanvasPill>
  );
}

// Clear · Undo, for the bottom-right corner of a drawing surface (the drawing
// board, the memory game's pad), where Undo must bring a Clear back. Undo is
// on the outside, in the corner the hand drawing is likeliest to brush: a
// stray tap there only takes back one stroke.
export function ClearUndo({
  onClear,
  onUndo,
  ui,
  style,
}: {
  onClear: () => void;
  onUndo: () => void;
  ui: Ui;
  style?: StyleProp<ViewStyle>;
}) {
  const button = { size: PILL.item, glyphSize: 18, weight: 2.2, slop: 6, ui };
  return (
    <CanvasPill ui={ui} pad={PILL.pad} radius={PILL_H / 2} style={style}>
      <PillButton glyph="trash" label="Clear" hint="Clears the drawing. Undo brings it back" onPress={onClear} {...button} />
      <PillButton glyph="undo" label="Undo" onPress={onUndo} {...button} />
    </CanvasPill>
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.55)' },
  wrap: { flexWrap: 'wrap' },
  center: { alignItems: 'center', justifyContent: 'center' },
  lit: { backgroundColor: '#ffffff' },
  readout: { color: '#ffffff', fontFamily: font.bold, letterSpacing: 0.3, textAlign: 'center' },
});
