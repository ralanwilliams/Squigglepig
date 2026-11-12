import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { CanvasPill } from './CanvasControls';
import { SizeSlider } from './SizeSlider';
import { WIDTHS, inkFor } from '../lib/drawing';
import type { BrushReward } from '../rewards/catalog';
import type { Ui } from '../theme/responsive';

// The brush on the drawing canvas (DrawingBoard): its ink and, with the Brush
// size reward (catalog.ts BRUSH_SIZE), its width. In the canvas's top-left
// corner (above the sticker button, when there is one), across from the zoom
// and dressed the same: a dark pill floating on the paper (CanvasControls.tsx).
// A player who has won neither a brush color (src/rewards) nor Brush size
// never sees it.
//
// Shut, it's one dot in the ink in use; with Brush size, the dot is as big as
// the brush (DOT, thinnest to thickest), so it says both at a glance. Tapped,
// it opens into rows of dots, black and then every brush won, the one in use
// ringed in white, and with Brush size the size slider under them
// (SizeSlider; its thumb carries the brush). With only colors, picking one
// shuts it again; with the slider it stays open while the brush is set up,
// and drawing shuts it (DrawingBoard). Open, it wraps after PER_ROW dots, so
// it stays clear of the zoom on the narrowest canvas.
//
// The dots are the inks themselves, on a dark pill: each has a faint light
// edge so black still shows.
const BLACK = { id: null, label: 'Black' };
const RING = 30; // a dot with its ring, base dp
const GAP = 2;
const PAD = 3;
const PER_ROW = 5;
// The open picker's width, base dp: a full row of dots.
const PANEL = RING * PER_ROW + GAP * (PER_ROW - 1) + PAD * 2;
// The dot standing for the brush's width, base dp: on the button (inside the
// ring) and on the slider's thumb, thinnest to thickest.
const DOT = { min: 8, max: 22 };
const THUMB_DOT = { min: 4, max: 18 };

const across = (width: number, d: { min: number; max: number }) =>
  d.min + ((width - WIDTHS.min) / (WIDTHS.max - WIDTHS.min)) * (d.max - d.min);

export function BrushPicker({
  brushes,
  ink,
  size,
  open,
  onOpen,
  onPick,
  ui,
}: {
  brushes: BrushReward[];
  ink: string | null; // a brush id, or null for black
  // With Brush size: the width in use, and what the slider tells.
  size?: { width: number; onWidth: (w: number) => void; onSliding: (sliding: boolean) => void };
  open: boolean;
  onOpen: () => void;
  onPick: (id: string | null) => void;
  ui: Ui;
}) {
  const inks = [BLACK, ...brushes.map((b) => ({ id: b.id as string | null, label: b.label }))];
  const current = inks.find((i) => i.id === ink) ?? BLACK;
  const color = inkFor(current.id);

  if (!open) {
    return (
      <CanvasPill ui={ui} pad={PAD} radius={18}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={size ? `Brush: ${current.label}, ${size.width} wide` : `Ink: ${current.label}`}
          accessibilityHint={size ? 'Shows the colors and sizes you can draw with' : 'Shows the colors you can draw in'}
          onPress={onOpen}
          hitSlop={ui.sp(6)}
        >
          <Dot color={color} on={false} across={size ? across(size.width, DOT) : undefined} ui={ui} />
        </Pressable>
      </CanvasPill>
    );
  }

  const dots = inks.map((i) => (
    <Pressable
      key={i.id ?? 'black'}
      accessibilityRole="radio"
      accessibilityLabel={i.label}
      accessibilityState={{ checked: i.id === ink }}
      onPress={() => onPick(i.id)}
      hitSlop={ui.sp(4)}
    >
      <Dot color={inkFor(i.id)} on={i.id === ink} ui={ui} />
    </Pressable>
  ));

  if (!size) {
    return (
      <CanvasPill ui={ui} pad={PAD} radius={18} wrap style={{ maxWidth: ui.sp(PANEL) }} accessibilityRole="radiogroup" accessibilityLabel="Ink">
        {dots}
      </CanvasPill>
    );
  }
  // With the slider: the colors (if there's more than black), then the size.
  const thumb = across(size.width, THUMB_DOT);
  return (
    <CanvasPill ui={ui} pad={PAD} radius={18} style={[styles.panel, { width: ui.sp(PANEL) }]} accessibilityLabel="Brush">
      {brushes.length ? (
        <View style={[styles.row, { gap: ui.sp(GAP) }]} accessibilityRole="radiogroup" accessibilityLabel="Ink">
          {dots}
        </View>
      ) : null}
      <SizeSlider
        value={size.width}
        min={WIDTHS.min}
        max={WIDTHS.max}
        step={WIDTHS.step}
        nudge={1}
        onChange={size.onWidth}
        onSliding={size.onSliding}
        label="Brush size"
        thumb={<View style={[styles.round, { width: ui.sp(thumb), height: ui.sp(thumb), backgroundColor: color }]} />}
        ui={ui}
      />
    </CanvasPill>
  );
}

// A dot in its ring: the whole ring's middle, or `across` base dp wide.
function Dot({ color, on, across: d, ui }: { color: string; on: boolean; across?: number; ui: Ui }) {
  const ring = ui.sp(RING);
  return (
    <View
      style={[
        styles.ring,
        { width: ring, height: ring, borderRadius: ring / 2, borderWidth: ui.sp(2), padding: ui.sp(2) },
        d !== undefined && styles.centred,
        on && styles.ringOn,
      ]}
    >
      <View
        style={[
          styles.dot,
          { backgroundColor: color, borderRadius: ring / 2 },
          d === undefined ? styles.fill : { width: ui.sp(d), height: ui.sp(d) },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { flexDirection: 'column', alignItems: 'stretch' },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  ring: { borderColor: 'transparent' },
  ringOn: { borderColor: '#ffffff' },
  centred: { alignItems: 'center', justifyContent: 'center' },
  dot: { borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.6)' },
  fill: { flex: 1 },
  round: { borderRadius: 999 },
});
