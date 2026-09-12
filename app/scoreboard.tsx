import React, { useEffect } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Stage } from '../src/components/Stage';
import { Logo } from '../src/components/Logo';
import { Heading } from '../src/components/Heading';
import { PigButton } from '../src/components/PigButton';
import { IMAGES, SOUNDS } from '../src/assets/assets';
import { playSound } from '../src/lib/sound';
import { useGame, MIN_PLAYERS } from '../src/state/GameContext';
import { font, type Theme } from '../src/theme/tokens';
import { useThemedStyles } from '../src/theme/theme';
import { FONT_CAP, useUi } from '../src/theme/responsive';

// Game over: final standings. First to the target score wins. From here anyone
// can launch a fresh game (reusing the same points-to-win) — it drops every
// player straight into a new prompts round and clears all history — or drop back
// to the lobby.
export default function Scoreboard() {
  const ui = useUi();
  const styles = useThemedStyles(makeStyles);
  const { players, scores, startGame, target } = useGame();

  useEffect(() => {
    playSound(SOUNDS.winner);
  }, []);

  const canStart = players.length >= MIN_PLAYERS;

  // Reaching the target only ends the game (after the round's last chain is
  // scored); the winner is whoever has the most points then — and several
  // players on the same top score share the win.
  const ranked = [...players]
    .map((name) => ({ name, score: scores[name] ?? 0 }))
    .sort((a, b) => b.score - a.score);
  const top = ranked[0]?.score ?? 0;
  const winners = top > 0 ? ranked.filter((r) => r.score === top).map((r) => r.name) : [];
  const title =
    winners.length === 0
      ? 'Final scores'
      : winners.length === 1
        ? `👑 ${winners[0]} wins!`
        : `👑 ${winners.slice(0, -1).join(', ')} and ${winners[winners.length - 1]} tied!`;

  // Rows the pane can show at full size under the two buttons; beyond that the
  // tail collapses to "+N more" (FitBox shrinks whatever is left to fit).
  const visible = Math.max(4, Math.floor((ui.paneH - ui.sp(150)) / ui.sp(44)));
  const shown = ranked.slice(0, visible);
  const hidden = Math.max(0, ranked.length - visible);

  const header = (
    <Heading size="h3" lines={1}>
      {title}
    </Heading>
  );

  const focus = <Logo source={IMAGES.winner} />;

  const row = {
    borderRadius: ui.sp(8),
    paddingVertical: ui.sp(8),
    paddingHorizontal: ui.sp(14),
    gap: ui.sp(8),
  };

  const actions = (
    <>
      <View style={[styles.list, { gap: ui.sp(6) }]}>
        {shown.map((r, i) => {
          const winner = winners.includes(r.name);
          return (
            <View key={i} style={[styles.row, row, winner && styles.winnerRow]}>
              <Text
                style={[styles.name, { fontSize: ui.f(16) }, winner && styles.winnerText]}
                maxFontSizeMultiplier={FONT_CAP}
                numberOfLines={1}
              >
                {winner ? '👑 ' : ''}
                {r.name}
              </Text>
              <Text
                style={[styles.score, { fontSize: ui.f(16) }, winner && styles.winnerText]}
                maxFontSizeMultiplier={FONT_CAP}
              >
                {r.score}
              </Text>
            </View>
          );
        })}
        {hidden > 0 && (
          <Text style={[styles.more, { fontSize: ui.f(13) }]} maxFontSizeMultiplier={FONT_CAP}>
            +{hidden} more
          </Text>
        )}
      </View>
      <PigButton name="New game" onPress={() => canStart && startGame(target)} />
      {!canStart && <Heading size="h4">Need at least {MIN_PLAYERS} players for a new game.</Heading>}
      <PigButton name="Back to lobby" onPress={() => router.replace('/lobby')} silent />
    </>
  );

  return <Stage header={header} focus={focus} actions={actions} />;
}

const makeStyles = (t: Theme) => StyleSheet.create({
  list: { width: '100%' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.surfaceBorder,
  },
  winnerRow: { backgroundColor: t.button, borderColor: t.buttonPressed },
  name: { color: t.surfaceText, fontFamily: font.medium, flex: 1 },
  score: { color: t.surfaceText, fontFamily: font.bold },
  winnerText: { color: t.buttonText },
  more: { color: t.text, fontFamily: font.regular, textAlign: 'center', opacity: 0.6 },
});
