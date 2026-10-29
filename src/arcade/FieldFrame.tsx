import React, { createContext, useContext, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { Countdown } from '../components/Countdown';
import { FitBox } from '../components/FitBox';
import { font } from '../theme/tokens';
import { FONT_CAP, useUi } from '../theme/responsive';
import { useFieldColors } from './fieldColors';
import { PotLadder } from './PotLadder';
import { DifficultyMeter } from './DifficultyMeter';
import { Padlock } from './Padlock';
import { LOST_CARD_DELAY_MS, RoundCard, WON_CARD_DELAY_MS, useFieldCardLook } from './RoundCard';
import { RoundCountdown, useStarted } from './RoundCountdown';
import { RoundCtx } from './RoundCtx';
import type { Frame } from './games';

// What a full-screen game's round is drawn into (Game.fullScreen), in place
// of RunShell's RoundFrame on Stage. The game's `focus` fills the whole
// screen, edge to edge and under the system bars; the run's parts float over
// it as quiet chips (fieldColors.ts): the clock top left, the pot ladder
// slider top centre (in portrait, under the clock), the game's `controls`
// bottom left and Leave bottom right. There's no title; the slider says
// where the run is, as on every arcade screen.
//
// Each round counts in first (RoundCountdown.tsx): a curtain over the field,
// under the chips, with 3, 2, 1 and "Go!" on it; the clock shows the
// round's full time, stopped, until it lifts.
//
// When the round ends its screen stays up. Won, the game shows it on the
// field itself; at a new tier the choice to keep going or bank it then comes
// up as a card between the chips (RoundCard.tsx, in the field's look), a
// beat later so the game's celebration plays first (any other win has
// nothing to show here: RunShell moves on by itself). Lost, a card says what
// happened, with Play again / Done, a beat later so the game can show what
// was missed first.
//
// A game with an endless hunt of its own (RoundCtx toEndless) has a way into
// it under the slider: Change to Endless Hunt. In the hunt (RoundCtx
// endless) there's no clock and no count in: the level is in the clock's
// place, and the slider is the difficulty meter (DifficultyMeter.tsx), with
// the way back to the game's run under it. A padlock (Padlock.tsx) sits
// beside the dark-mode toggle. Locked, the meter, Leave and the toggle go
// (still taking up their room, so the field between the chips doesn't move
// and its truffles stay put) and only the game's field takes a tap.
//
// The game learns where it may put things through useFieldArea(): the whole
// field's size, and the box between the chips at the top and the bottom.

export type FieldArea = {
  w: number; // the field, the whole screen
  h: number;
  x0: number; // the clear box between the chips
  y0: number;
  x1: number;
  y1: number;
};

const AreaCtx = createContext<FieldArea | null>(null);

// The field's size and clear box, once the frame has been laid out (null before).
export const useFieldArea = () => useContext(AreaCtx);

export const FieldFrame: Frame = ({ focus, controls, onExpire, stoppedAt }) => {
  const ui = useUi();
  const fc = useFieldColors();
  const look = useFieldCardLook();
  const ctx = useContext(RoundCtx);
  if (!ctx) throw new Error('FieldFrame is drawn by RunShell');
  const { settled } = ctx;
  const started = useStarted(ctx.startsAt);

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [bands, setBands] = useState({ top: 0, bottom: 0 });
  const onRoot = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.w || height !== size.h) setSize({ w: width, h: height });
  };
  const onTop = (e: LayoutChangeEvent) => {
    const { y, height } = e.nativeEvent.layout;
    if (y + height !== bands.top) setBands((b) => ({ ...b, top: y + height }));
  };
  const onBottom = (e: LayoutChangeEvent) => {
    const { y } = e.nativeEvent.layout;
    if (y !== bands.bottom) setBands((b) => ({ ...b, bottom: y }));
  };
  const margin = ui.sp(4);
  const area: FieldArea | null =
    size.w > 0 && bands.top > 0 && bands.bottom > bands.top
      ? {
          w: size.w,
          h: size.h,
          x0: ui.insets.left + ui.pad,
          y0: bands.top + margin,
          x1: size.w - ui.insets.right - ui.pad,
          y1: bands.bottom - margin,
        }
      : null;

  const wide = size.w > size.h;
  const chip = [styles.chip, { backgroundColor: fc.panel, borderColor: fc.line, paddingVertical: ui.sp(5), paddingHorizontal: ui.sp(12), gap: ui.sp(7) }];
  const { endless } = ctx;
  const locked = !!endless?.locked;
  // Still there while locked, but not to be seen or tapped.
  const unlockedOnly = locked ? { opacity: 0 } : null;
  const pill = (label: string, onPress: () => void, quiet?: boolean) => (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={6}
      style={[styles.pill, { minHeight: ui.sp(28), paddingHorizontal: ui.sp(12), marginTop: ui.sp(4), marginBottom: ui.sp(2), borderColor: quiet ? fc.line : fc.amber }]}
    >
      <Text style={[quiet ? styles.pillQuiet : styles.pillText, { color: quiet ? fc.muted : fc.amber, fontSize: ui.f(12) }]} maxFontSizeMultiplier={FONT_CAP} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
  const clock = endless ? (
    <View style={chip} accessible accessibilityLabel={`Level ${endless.level}`}>
      <Text style={[styles.level, { color: fc.muted, fontSize: ui.f(16) }]} maxFontSizeMultiplier={FONT_CAP}>
        Level <Text style={[styles.levelNum, { color: fc.text }]}>{endless.level}</Text>
      </Text>
    </View>
  ) : (
    <View style={chip}>
      <Countdown
        seconds={ctx.seconds}
        until={ctx.until}
        onExpire={onExpire ?? ctx.expire}
        size={18}
        stoppedAt={stoppedAt ?? settled?.at ?? (started ? undefined : ctx.startsAt)}
        colors={{ text: fc.text, urgent: fc.urgent }}
      />
    </View>
  );
  const ladderChip = [chip, styles.ladder, { borderRadius: ui.sp(14), paddingTop: ui.sp(4), paddingBottom: ui.sp(3) }, wide && { width: ui.sp(290) }];
  const ladder = endless ? (
    <View pointerEvents={locked ? 'none' : 'auto'} importantForAccessibility={locked ? 'no-hide-descendants' : 'auto'} style={[ladderChip, unlockedOnly]}>
      <DifficultyMeter value={endless.difficulty} onChange={endless.setDifficulty} />
      {pill(`Back to ${endless.game}`, endless.back, true)}
    </View>
  ) : (
    <View style={ladderChip}>
      <PotLadder look="field" won={settled && !settled.lost ? ctx.round : ctx.round - 1} />
      {ctx.toEndless ? pill('Change to Endless Hunt', ctx.toEndless) : null}
    </View>
  );
  const leave = (
    <Pressable
      accessibilityRole="button"
      onPress={ctx.leave}
      disabled={locked}
      importantForAccessibility={locked ? 'no-hide-descendants' : 'auto'}
      hitSlop={8}
      style={[chip, { minHeight: ui.sp(36) }, unlockedOnly]}
    >
      <Text style={[styles.leave, { color: fc.muted, fontSize: ui.f(13) }]} maxFontSizeMultiplier={FONT_CAP}>
        Leave
      </Text>
    </Pressable>
  );
  const disc = ui.sp(36);

  return (
    <View style={styles.fill} onLayout={onRoot}>
      <View style={StyleSheet.absoluteFill}>
        <AreaCtx.Provider value={area}>{focus}</AreaCtx.Provider>
      </View>
      {ctx.startsAt ? <RoundCountdown startsAt={ctx.startsAt} /> : null}
      {/* Behind the app's dark-mode toggle (ThemeToggleOverlay), a disc like the chips; gone with the toggle while locked. */}
      <View
        pointerEvents="none"
        style={[
          styles.disc,
          unlockedOnly,
          {
            backgroundColor: fc.panel,
            borderColor: fc.line,
            width: disc,
            height: disc,
            borderRadius: disc / 2,
            top: ui.insets.top + ui.sp(5) + (ui.sp(44) - disc) / 2,
            right: ui.insets.right + ui.pad - ui.sp(9) + (ui.sp(44) - disc) / 2,
          },
        ]}
      />
      {endless ? (
        <View style={[styles.padlock, { top: ui.insets.top + ui.sp(5), right: ui.insets.right + ui.pad - ui.sp(9) + ui.sp(44) + ui.sp(2) }]}>
          <Padlock locked={locked} onLock={endless.lock} onUnlock={endless.unlock} />
        </View>
      ) : null}
      <View
        pointerEvents="box-none"
        style={[
          StyleSheet.absoluteFill,
          {
            paddingTop: ui.insets.top + ui.sp(8),
            paddingBottom: ui.insets.bottom + ui.sp(10),
            paddingLeft: ui.insets.left + ui.pad,
            paddingRight: ui.insets.right + ui.pad,
          },
        ]}
      >
        <View pointerEvents="box-none" onLayout={onTop} style={{ gap: ui.sp(8) }}>
          {wide ? (
            <View pointerEvents="box-none" style={styles.row}>
              <View pointerEvents="box-none" style={styles.side}>
                {clock}
              </View>
              {ladder}
              <View pointerEvents="none" style={styles.side} />
            </View>
          ) : (
            <>
              <View pointerEvents="box-none" style={[styles.row, { minHeight: ui.sp(44) }]}>
                {clock}
              </View>
              {ladder}
            </>
          )}
        </View>
        <View pointerEvents="box-none" style={styles.middle}>
          {settled && (settled.lost || settled.actions.length) ? (
            <FitBox style={styles.fill}>
              <View style={styles.center}>
                <RoundCard
                  key={settled.lost ? 'lost' : 'won'}
                  look={look}
                  delay={settled.lost ? LOST_CARD_DELAY_MS : WON_CARD_DELAY_MS}
                  title={settled.title}
                  lines={settled.lines}
                  actions={settled.actions}
                />
              </View>
            </FitBox>
          ) : null}
        </View>
        <View
          pointerEvents="box-none"
          onLayout={onBottom}
          style={wide ? [styles.row, styles.between] : [styles.column, { gap: ui.sp(8) }]}
        >
          {controls ? <View style={chip}>{controls}</View> : <View />}
          {leave}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  column: { alignItems: 'center' },
  between: { justifyContent: 'space-between', alignItems: 'flex-end' },
  side: { flex: 1, alignItems: 'flex-start' },
  middle: { flex: 1, minHeight: 0 },
  center: { alignItems: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', borderRadius: 999, borderWidth: 1 },
  ladder: { flexDirection: 'column', alignItems: 'stretch' },
  disc: { position: 'absolute', borderWidth: 1 },
  leave: { fontFamily: font.regular, textDecorationLine: 'underline' },
  level: { fontFamily: font.medium },
  levelNum: { fontFamily: font.bold },
  pill: { alignSelf: 'center', justifyContent: 'center', borderRadius: 999, borderWidth: 1.5 },
  pillText: { fontFamily: font.bold },
  pillQuiet: { fontFamily: font.medium },
  padlock: { position: 'absolute', zIndex: 10 },
});
