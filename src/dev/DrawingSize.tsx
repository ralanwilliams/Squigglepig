import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PAYLOAD_LIMIT, cellSize } from './wireSize';
import { font } from '../theme/tokens';
import { FONT_CAP, type Ui } from '../theme/responsive';

// Development builds only (DrawingBoard loads this behind __DEV__, so it
// never reaches a release bundle): how big the drawing on the canvas is as
// it's handed in, against the most one message may carry (256 KB on
// Supabase's free plan), so you can see what a drawing that size looks like.
//
//   DEV · 41 kB of 256 kB (16%)
//   before thinning 73 kB
//
// The first line is what's sent: the drawing with each stroke thinned
// (src/lib/strokes.ts), in its 'cell' message. The bar fills with it, amber
// from 75%, red past 100%; a drawing past CHUNK_AT goes in pieces
// (src/lib/chunks.ts) and the second line says how many. Apps from before
// the pieces (2.9.0) can't receive one that big. The host's next-stage
// message carries every drawing of the stage at once, about this times the
// number of players.
//
// Measured a moment after the drawing stops changing (not mid-stroke, or
// while a sticker is being dragged), and out of the way while the ink or
// sticker tray is open.
const SETTLE_MS = 250;
const WARN_AT = 0.75;

const kb = (bytes: number) => {
  const k = bytes / 1000;
  return `${k < 10 ? k.toFixed(1) : Math.round(k)} kB`;
};

export function DrawingSize({
  changes,
  sent,
  raw,
  hidden,
  top,
  ui,
}: {
  changes: unknown[]; // the drawing's parts; a new one means it changed
  sent: () => string; // the drawing as it's handed in (DrawingBoard drawingData)
  raw: () => string; // the same, strokes not thinned
  hidden?: boolean;
  top: number; // dp from the canvas top: under its top corners' controls
  ui: Ui;
}) {
  const [size, setSize] = useState<{ sent: number; raw: number; pieces: number } | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      const s = cellSize(sent());
      setSize({ sent: s.bytes, pieces: s.pieces, raw: cellSize(raw()).bytes });
    }, SETTLE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, changes);
  if (!size || hidden) return null;

  const share = size.sent / PAYLOAD_LIMIT;
  const color = share > 1 ? '#FF5A5F' : share >= WARN_AT ? '#FFB020' : '#4CD964';
  const detail = `before thinning ${kb(size.raw)}` + (size.pieces > 1 ? ` · goes in ${size.pieces} pieces` : '');

  return (
    <View pointerEvents="none" style={[styles.wrap, { top }]}>
      <View style={[styles.pill, { borderRadius: ui.sp(8), paddingVertical: ui.sp(4), paddingHorizontal: ui.sp(8), gap: ui.sp(2) }]}>
        <Text style={[styles.text, { fontSize: ui.f(11) }]} maxFontSizeMultiplier={FONT_CAP} numberOfLines={1} adjustsFontSizeToFit>
          DEV · {kb(size.sent)} of {kb(PAYLOAD_LIMIT)} ({Math.round(share * 100)}%)
        </Text>
        <Text style={[styles.detail, { fontSize: ui.f(10) }]} maxFontSizeMultiplier={FONT_CAP} numberOfLines={1} adjustsFontSizeToFit>
          {detail}
        </Text>
        <View style={[styles.track, { height: ui.sp(3), borderRadius: ui.sp(2) }]}>
          <View style={[styles.fill, { width: `${Math.min(100, share * 100)}%`, backgroundColor: color, borderRadius: ui.sp(2) }]} />
        </View>
      </View>
    </View>
  );
}

// Its own fixed colours, like the zoom switch beside it: a tool on the
// canvas, not part of the app's look.
const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  pill: { maxWidth: '46%', backgroundColor: 'rgba(0, 0, 0, 0.6)', alignItems: 'stretch' },
  text: { color: '#ffffff', fontFamily: font.bold, textAlign: 'center' },
  detail: { color: 'rgba(255, 255, 255, 0.8)', fontFamily: font.regular, textAlign: 'center' },
  track: { backgroundColor: 'rgba(255, 255, 255, 0.25)', overflow: 'hidden' },
  fill: { height: '100%' },
});
