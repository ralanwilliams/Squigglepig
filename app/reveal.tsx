import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Stage } from '../src/components/Stage';
import { Heading } from '../src/components/Heading';
import { Countdown, deadlineIn } from '../src/components/Countdown';
import { DrawingImage } from '../src/components/DrawingImage';
import { PigButton } from '../src/components/PigButton';
import { LeaveButton } from '../src/components/LeaveButton';
import { useGame } from '../src/state/GameContext';
import { TIMERS } from '../src/lib/timers';
import { font, layout, type Theme } from '../src/theme/tokens';
import { useTheme, useThemedStyles } from '../src/theme/theme';
import { FONT_CAP, useUi } from '../src/theme/responsive';

// A big ✓/✗ that springs in over a cell the moment it's ruled. Because it mounts
// when the ruling first appears, every player's screen animates it in sync.
function RuleBadge({ correct, size }: { correct: boolean; size: number }) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(a, { toValue: 1, useNativeDriver: true, friction: 5, tension: 90 }).start();
  }, [a]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.badge,
        { opacity: a, transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }] },
      ]}
    >
      <Text
        style={[styles.badgeText, { fontSize: size, lineHeight: size, color: correct ? theme.success : theme.danger }]}
        maxFontSizeMultiplier={1}
      >
        {correct ? '✓' : '✗'}
      </Text>
    </Animated.View>
  );
}

// End-of-round scoring. The chain is judged by its ORIGINAL PROMPT AUTHOR, who
// votes the current cell (drawing/guess) against the original prompt. The cell
// under judgement fills the left; the prompt, verdict buttons and running scores
// sit on the right. Everyone's screen mirrors the same cell + ✓/✗ animation.
export default function Reveal() {
  const ui = useUi();
  const styles = useThemedStyles(makeStyles);
  const { chains, revealIndex, revealStep, rulings, judge, isJudge, scores, players, vote } =
    useGame();

  const chain = chains[revealIndex];
  const step = chain ? Math.min(revealStep, chain.cells.length - 1) : 0;

  // One deadline per chain, fixed when the chain comes up: Stage rebuilds its
  // panes (remounting the Countdown) when the phone turns, and the clock must
  // not restart mid-reveal. Changing chains does start a fresh one.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const revealUntil = useMemo(() => deadlineIn(TIMERS.reveal), [revealIndex]);

  if (!chain) {
    return <Stage focus={<Heading>Tallying…</Heading>} />;
  }

  const cells = chain.cells;
  const prompt = cells[0];
  const frontier = cells[step];
  const frontierRuled = rulings[step] !== undefined;
  const ruled = rulings[step];
  const isDrawing = frontier?.kind === 'drawing';
  const author = frontier?.author || 'someone';

  const board = [...players].sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0));
  // Score rows the rail can show at full size under the prompt + vote buttons.
  const visible = Math.max(4, Math.floor((ui.paneH - ui.sp(260)) / ui.sp(21)));
  const shownBoard = board.slice(0, visible);
  const hiddenScores = Math.max(0, board.length - visible);

  // The badge is sized to the pane so it never spills out of it.
  const badge = Math.min(ui.f(96), Math.round(ui.paneH * 0.45));

  // Left: the single cell currently under judgement, with its ✓/✗ badge. The
  // drawing fills the pane; a caption bubble sits centred in the same space.
  const focus = (
    <View style={[styles.cellArea, { gap: ui.sp(4) }]}>
      <Text style={[styles.author, { fontSize: ui.f(13) }]} maxFontSizeMultiplier={FONT_CAP} numberOfLines={1}>
        {author + (isDrawing ? ' drew' : ' guessed')}
      </Text>
      <View style={styles.overlayHost}>
        {isDrawing ? (
          <DrawingImage
            data={frontier.data}
            frameStyle={[ruled === true && styles.good, ruled === false && styles.bad]}
          />
        ) : (
          <View
            style={[
              styles.bubble,
              { borderRadius: ui.sp(8), paddingVertical: ui.sp(10), paddingHorizontal: ui.sp(14) },
              ruled === true && styles.good,
              ruled === false && styles.bad,
            ]}
          >
            <Text
              style={[styles.bubbleText, { fontSize: ui.f(18) }]}
              maxFontSizeMultiplier={FONT_CAP}
              numberOfLines={4}
              adjustsFontSizeToFit
            >
              {frontier?.kind === 'caption' ? frontier.text : ''}
            </Text>
          </View>
        )}
        {ruled !== undefined && <RuleBadge correct={ruled} size={badge} />}
      </View>
      <Text style={[styles.awarded, { fontSize: ui.f(13) }]} maxFontSizeMultiplier={FONT_CAP} numberOfLines={1}>
        {ruled === true && frontier?.author ? `+1 ${frontier.author}` : ' '}
      </Text>
    </View>
  );

  // Right: chain progress, the prompt to judge against, the verdict, and scores.
  const actions = (
    <>
      <View style={[styles.progress, { gap: ui.sp(2) }]}>
        <Heading size="h4">
          Chain {revealIndex + 1} of {chains.length}
        </Heading>
        <Countdown seconds={TIMERS.reveal} until={revealUntil} />
      </View>

      <View style={[styles.darkCard, { borderRadius: ui.sp(8), padding: ui.sp(12), gap: ui.sp(4) }]}>
        <Text style={[styles.label, { fontSize: ui.f(12) }]} maxFontSizeMultiplier={FONT_CAP}>
          DOES IT MATCH THIS PROMPT?
        </Text>
        <Text
          style={[styles.promptText, { fontSize: ui.f(18) }]}
          maxFontSizeMultiplier={FONT_CAP}
          numberOfLines={3}
          adjustsFontSizeToFit
        >
          {prompt?.kind === 'prompt' ? prompt.text : ''}
        </Text>
      </View>

      {isJudge ? (
        !frontierRuled && frontier ? (
          <View style={[styles.votes, { gap: ui.sp(10) }]}>
            <View style={styles.flex}>
              <PigButton name="✓ Yes" onPress={() => vote(true)} />
            </View>
            <View style={styles.flex}>
              <PigButton name="✗ No" onPress={() => vote(false)} silent />
            </View>
          </View>
        ) : (
          <Heading size="h4">…</Heading>
        )
      ) : (
        <Heading size="h4" lines={1}>{judge || 'The judge'} is scoring…</Heading>
      )}

      <View style={[styles.darkCard, { borderRadius: ui.sp(8), padding: ui.sp(12), gap: ui.sp(4) }]}>
        <Text style={[styles.label, { fontSize: ui.f(12) }]} maxFontSizeMultiplier={FONT_CAP}>
          SCORES
        </Text>
        {shownBoard.map((name) => (
          <View key={name} style={[styles.scoreRow, { paddingHorizontal: ui.sp(4), gap: ui.sp(8) }]}>
            <Text style={[styles.scoreName, { fontSize: ui.f(14) }]} maxFontSizeMultiplier={FONT_CAP} numberOfLines={1}>
              {name === judge ? `${name} ⚖️` : name}
            </Text>
            <Text style={[styles.scoreVal, { fontSize: ui.f(14) }]} maxFontSizeMultiplier={FONT_CAP}>
              {scores[name] ?? 0}
            </Text>
          </View>
        ))}
        {hiddenScores > 0 && (
          <Text style={[styles.moreScores, { fontSize: ui.f(12) }]} maxFontSizeMultiplier={FONT_CAP}>
            +{hiddenScores} more
          </Text>
        )}
      </View>

      <LeaveButton />
    </>
  );

  return <Stage focus={focus} actions={actions} />;
}

const makeStyles = (t: Theme) => StyleSheet.create({
  flex: { flex: 1 },
  cellArea: { flex: 1, minHeight: 0 },
  author: { color: t.text, fontFamily: font.regular, textAlign: 'center' },
  // Fills the pane; the cell is centred inside it so the badge lands over the
  // middle of a drawing OR a short caption bubble.
  overlayHost: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'center',
    alignItems: 'stretch',
    overflow: 'visible',
  },
  good: { borderWidth: 3, borderColor: t.success, borderRadius: layout.imageRadius },
  bad: { opacity: 0.5 },
  bubble: {
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.surfaceBorder,
  },
  bubbleText: { color: t.surfaceText, fontFamily: font.medium, textAlign: 'center' },
  awarded: { color: t.success, fontFamily: font.bold, textAlign: 'center' },
  badge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
    fontFamily: font.bold,
    // A pale halo so the badge reads over the ink of a drawing (always white paper).
    textShadowColor: 'rgba(255,255,255,0.9)',
    textShadowRadius: 8,
  },
  progress: { alignItems: 'center' },
  darkCard: { backgroundColor: t.overlay },
  label: { color: t.overlayLabel, fontFamily: font.bold, textAlign: 'center', letterSpacing: 0.5 },
  promptText: { color: t.overlayText, fontFamily: font.medium, textAlign: 'center' },
  votes: { flexDirection: 'row' },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between' },
  scoreName: { color: t.overlayText, fontFamily: font.regular, flex: 1 },
  scoreVal: { color: t.overlayText, fontFamily: font.bold },
  moreScores: { color: t.overlayText, fontFamily: font.regular, textAlign: 'center', opacity: 0.7 },
});
