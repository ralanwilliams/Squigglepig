import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DrawingImage } from './DrawingImage';
import { PigFace, PIG_FACE_ASPECT } from './PigRoster';
import { PigShine, fireworkLights, fireworksEnd, useFireworksClock } from './Fireworks';
import { SOUNDS } from '../assets/assets';
import { playSound } from '../lib/sound';
import { SPACE } from '../lib/drawing';
import type { Avatar } from '../avatar/avatar';
import { font, type Theme } from '../theme/tokens';
import { useReducedMotion, useThemedStyles } from '../theme/theme';
import { FONT_CAP, useUi } from '../theme/responsive';

// A Pig Off's results (src/state/rules.ts), as a show: one row a player,
// their pig, their drawing from memory and how well it matched. The rows drop
// in where they stood; the matches count up together, a bar filling behind
// each; then the rows swap places into the order they finished, the winner's
// row rising to the top, where it bursts out bigger in the winner's color with
// a crown and a cheer. Still tied, the tied rows shake together to an "ooh".
//
// The show runs on one clock, from `start` (when the results came in, on this
// phone's clock), so a phone that catches up mid-way joins it where it is;
// with reduced motion it starts at the end.

// The timeline, ms from `start`.
const DROP_MS = 220; // each row dropping in, one after another
const DROP_GAP = 110;
const COUNT_AT = 600;
const COUNT_MS = 2200; // the matches counting up
const SWAP_AT = 3100;
const SWAP_MS = 700; // the rows trading places
const CROWN_AT = 3900; // the winner bursts out (or the tie shakes)
const POP_MS = 500;
export const PIG_OFF_SHOW_MS = CROWN_AT + POP_MS;
// The fireworks for a winner start with the crown (the screen draws them in
// its big pane: PigOffFireworks; their light falls on the winner's pig here).
export const PIG_OFF_FIREWORKS_AT = CROWN_AT;

type Ease = (p: number) => number;
const clamp = (p: number) => Math.max(0, Math.min(1, p));
const out: Ease = (p) => 1 - (1 - p) ** 3;
const inOut: Ease = (p) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2);
const back: Ease = (p) => 1 + 2.7 * (p - 1) ** 3 + 1.7 * (p - 1) ** 2; // overshoots, then settles
const along = (t: number, at: number, ms: number, ease: Ease = out) => ease(clamp((t - at) / ms));

export function PigOffResults({
  players,
  matches,
  drawings,
  winner,
  avatars,
  me,
  start,
}: {
  players: string[]; // in the order they stood (the Pig Off's)
  matches: Record<string, number>;
  drawings: Record<string, string[]>;
  winner: string;
  avatars: Record<string, Avatar>;
  me: string;
  start: number;
}) {
  const ui = useUi();
  const styles = useThemedStyles(makeStyles);
  const reduced = useReducedMotion();
  const t = useShowClock(start, reduced);

  // Where each finishes: best first, ties in the order they stood.
  const ranked = [...players].sort((a, b) => (matches[b] ?? 0) - (matches[a] ?? 0) || players.indexOf(a) - players.indexOf(b));
  const top = matches[ranked[0]] ?? 0;
  const tied = winner ? [] : players.filter((n) => (matches[n] ?? 0) === top);

  // The burst's sounds, once each, as they happen (not for a phone joining
  // after them).
  const cheered = useRef(t >= CROWN_AT);
  useEffect(() => {
    if (cheered.current || t < CROWN_AT) return;
    cheered.current = true;
    playSound(winner ? SOUNDS.cheer : SOUNDS.ooh, 0.4);
  }, [t, winner]);

  const rowH = ui.sp(68);
  const gap = ui.sp(8);
  const pigW = ui.sp(40);
  const thumbW = ui.sp(72);
  const counted = along(t, COUNT_AT, COUNT_MS, inOut);
  const swapped = along(t, SWAP_AT, SWAP_MS, inOut);
  const burst = along(t, CROWN_AT, POP_MS, back);

  // The fireworks' light on the winner's pig, on their own clock from the
  // crown (the same one the screen's fireworks run on). They go off in the
  // whole screen, so each lights the side of the pig facing it: `lightAt` is
  // where the pig is across the screen (0..1). The row's pig sits just past
  // its rank: in the rail on the right with two panes, near the left edge in
  // one column.
  const fw = useFireworksClock(start + PIG_OFF_FIREWORKS_AT, fireworksEnd(), !!winner && !reduced);
  const lights = fw >= 0 ? fireworkLights(fw) : [];
  const pigInRow = ui.sp(10) + ui.sp(28) + ui.sp(10) + pigW / 2; // padding, rank, gap, half the pig
  const lightAt = ((ui.twoPane ? ui.insets.left + ui.w - ui.pad - ui.railW : ui.insets.left + ui.pad) + pigInRow) / (ui.w + ui.insets.left + ui.insets.right);

  return (
    <View style={{ height: players.length * (rowH + gap) - gap }} accessible accessibilityLabel={summary(ranked, matches, winner)}>
      {players.map((name, i) => {
        const finished = ranked.indexOf(name);
        const isWinner = name === winner && t >= CROWN_AT;
        const isTied = tied.includes(name) && t >= CROWN_AT;
        const dropped = along(t, i * DROP_GAP, DROP_MS);
        const y = (i + (finished - i) * swapped) * (rowH + gap) - (1 - dropped) * ui.sp(24);
        // The winner bursts out bigger; a tied row shakes.
        const scale = isWinner ? 1 + 0.06 * burst : 1;
        const shake = isTied ? Math.sin(((t - CROWN_AT) / 60) * Math.PI) * ui.sp(5) * (1 - along(t, CROWN_AT, POP_MS * 1.6, (p) => p)) : 0;
        const pct = Math.round((matches[name] ?? 0) * counted);
        return (
          <View
            key={name}
            style={[
              styles.row,
              isWinner && styles.winnerRow,
              {
                height: rowH,
                top: 0,
                gap: ui.sp(10),
                paddingHorizontal: ui.sp(10),
                borderRadius: ui.sp(12),
                opacity: dropped,
                zIndex: isWinner ? 2 : 1,
                transform: [{ translateY: y }, { translateX: shake }, { scale }],
              },
            ]}
          >
            {/* The bar behind the row, filling to the match as it counts. */}
            <View
              style={[styles.bar, isWinner && styles.winnerBar, { width: `${Math.max(0, Math.min(100, (matches[name] ?? 0) * counted))}%`, borderRadius: ui.sp(12) }]}
            />
            <Text style={[styles.rank, isWinner && styles.winnerText, { width: ui.sp(28), fontSize: ui.f(isWinner ? 22 : 16) }]} maxFontSizeMultiplier={FONT_CAP}>
              {isWinner ? '👑' : t >= SWAP_AT + SWAP_MS ? `${finished + 1}` : ''}
            </Text>
            {name === winner ? (
              <View style={{ width: pigW, height: pigW / PIG_FACE_ASPECT }}>
                <PigFace avatar={avatars[name]} w={pigW} />
                <PigShine w={pigW} h={pigW / PIG_FACE_ASPECT} lights={lights} at={lightAt} />
              </View>
            ) : (
              <PigFace avatar={avatars[name]} w={pigW} />
            )}
            <Text
              style={[styles.name, isWinner && styles.winnerText, { fontSize: ui.f(16) }]}
              maxFontSizeMultiplier={FONT_CAP}
              numberOfLines={1}
            >
              {name === me ? `${name} (you)` : name}
            </Text>
            <View style={[styles.thumb, { width: thumbW, height: (thumbW * SPACE.h) / SPACE.w, borderRadius: ui.sp(6) }]}>
              <DrawingImage data={JSON.stringify({ ...SPACE, strokes: drawings[name] ?? [] })} />
            </View>
            <Text style={[styles.pct, isWinner && styles.winnerText, { width: ui.sp(60), fontSize: ui.f(isWinner ? 24 : 20) }]} maxFontSizeMultiplier={FONT_CAP}>
              {pct}%
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// The show's clock: ms since `start`, every frame until it's over (and at its
// end, with reduced motion or for a phone that joins after it).
function useShowClock(start: number, reduced: boolean) {
  const now = () => (reduced ? PIG_OFF_SHOW_MS : Math.max(0, Date.now() - start));
  const [t, setT] = useState(now);
  useEffect(() => {
    if (reduced) {
      setT(PIG_OFF_SHOW_MS);
      return;
    }
    let frame = 0;
    const tick = () => {
      const e = Math.max(0, Date.now() - start);
      setT(e);
      if (e < PIG_OFF_SHOW_MS + 1500) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [start, reduced]);
  return t;
}

const summary = (ranked: string[], matches: Record<string, number>, winner: string) =>
  ranked.map((n, i) => `${i + 1}. ${n}, ${matches[n] ?? 0}%`).join('; ') + (winner ? `. ${winner} wins.` : '. Still tied.');

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    row: {
      position: 'absolute',
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.surface,
      borderWidth: t.edge,
      borderColor: t.surfaceBorder,
      overflow: 'hidden',
    },
    winnerRow: { backgroundColor: t.button, borderColor: t.accent, borderWidth: 2 },
    // The match, filling the row from the left behind everything in it.
    bar: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: t.surfaceInset },
    winnerBar: { backgroundColor: t.accent, opacity: 0.35 },
    rank: { color: t.surfaceText, fontFamily: font.bold, textAlign: 'center' },
    name: { flex: 1, minWidth: 0, color: t.surfaceText, fontFamily: font.medium },
    thumb: { overflow: 'hidden' },
    pct: { color: t.surfaceText, fontFamily: font.bold, textAlign: 'right' },
    winnerText: { color: t.buttonText },
  });
