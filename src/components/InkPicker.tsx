import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { inkFor } from '../lib/drawing';
import type { BrushReward } from '../rewards/catalog';
import type { Ui } from '../theme/responsive';

// The ink on the drawing canvas (PigCanvas), in its top-left corner (above
// the sticker button, when there is one), across from the 1× / 2× switch and
// dressed the same: a dark pill floating on the
// paper. Shut, it's one dot in the ink in use; tapped, it opens into rows of
// dots, black and then every brush the player has won (src/rewards), and
// picking one shuts it again. A player who hasn't won a brush never sees it.
//
// The dots are the inks themselves, on a dark pill: each has a faint light
// edge so black still shows, and the one in use a white ring with a gap.
// Open, it wraps after PER_ROW dots, so it stays clear of the 1× / 2× switch
// on the narrowest canvas.
const BLACK = { id: null, label: 'Black' };
const RING = 30; // a dot with its ring, base dp
const GAP = 2;
const PAD = 3;
const PER_ROW = 5;

export function InkPicker({
  brushes,
  ink,
  open,
  onOpen,
  onPick,
  ui,
}: {
  brushes: BrushReward[];
  ink: string | null; // a brush id, or null for black
  open: boolean;
  onOpen: () => void;
  onPick: (id: string | null) => void;
  ui: Ui;
}) {
  const inks = [BLACK, ...brushes.map((b) => ({ id: b.id as string | null, label: b.label }))];
  const current = inks.find((i) => i.id === ink) ?? BLACK;
  const box = [styles.pill, { padding: ui.sp(PAD), borderRadius: ui.sp(18), gap: ui.sp(GAP) }];

  if (!open) {
    return (
      <View style={box}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Ink: ${current.label}`}
          accessibilityHint="Shows the colors you can draw in"
          onPress={onOpen}
          hitSlop={ui.sp(6)}
        >
          <Dot color={inkFor(current.id)} on={false} ui={ui} />
        </Pressable>
      </View>
    );
  }
  return (
    <View
      style={[box, styles.row, { maxWidth: ui.sp(RING) * PER_ROW + ui.sp(GAP) * (PER_ROW - 1) + ui.sp(PAD) * 2 }]}
      accessibilityRole="radiogroup"
      accessibilityLabel="Ink"
    >
      {inks.map((i) => (
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
      ))}
    </View>
  );
}

function Dot({ color, on, ui }: { color: string; on: boolean; ui: Ui }) {
  const ring = ui.sp(RING);
  return (
    <View style={[styles.ring, { width: ring, height: ring, borderRadius: ring / 2, borderWidth: ui.sp(2), padding: ui.sp(2) }, on && styles.ringOn]}>
      <View style={[styles.dot, { backgroundColor: color, borderRadius: ring / 2 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: 'flex-start', backgroundColor: 'rgba(0, 0, 0, 0.55)' },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  ring: { borderColor: 'transparent' },
  ringOn: { borderColor: '#ffffff' },
  dot: { flex: 1, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.6)' },
});
