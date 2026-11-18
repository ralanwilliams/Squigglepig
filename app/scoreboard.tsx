import React, { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Stage } from '../src/components/Stage';
import { WinnerPig } from '../src/avatar/WinnerPig';
import { AvatarRow } from '../src/components/AvatarRow';
import { NO_AVATAR } from '../src/avatar/avatar';
import { Heading } from '../src/components/Heading';
import { FireworksLayer, ENCORE_BURSTS, ENCORE_PERIOD } from '../src/components/Fireworks';
import { CelebrationLayer } from '../src/components/Celebration';
import { PigButton } from '../src/components/PigButton';
import { SOUNDS } from '../src/assets/assets';
import { playSound } from '../src/lib/sound';
import { useGame, MIN_PLAYERS } from '../src/state/GameContext';
import { font, type Theme } from '../src/theme/tokens';
import { useThemedStyles } from '../src/theme/theme';
import { FONT_CAP, useUi } from '../src/theme/responsive';

// Game over: final standings. First to the target score wins. From here anyone
// can launch a fresh game (reusing the same points-to-win) — it drops every
// player straight into a new prompts round and clears all history — or drop back
// to the lobby.
//
// Players who tapped Leave game during the game are still listed, with their
// score and "left" after their name, but can't take the win.
//
// The winner's pig is dressed as they dressed it (src/avatar): their outfit,
// and their speech bubble saying what they wrote, for everyone in the room to
// see. A tie lines up every winner's pig, each named underneath, as big as
// the pane allows; more than fit scroll sideways (AvatarRow).
//
// The winner art is 480 × 456; a pig in a lineup is never smaller than this
// (base dp, tall), nor bigger than the pane.
const WINNER_ASPECT = 480 / 456;
const LINEUP_MIN_H = 120;
export default function Scoreboard() {
  const ui = useUi();
  const styles = useThemedStyles(makeStyles);
  const { players, departed, scores, startGame, target, avatars, pigOff } = useGame();
  const [openedAt] = useState(Date.now);

  useEffect(() => {
    playSound(SOUNDS.winner);
  }, []);

  const canStart = players.length >= MIN_PLAYERS;

  // Reaching the target only ends the game (after the round's last chain is
  // scored); the winner is whoever has the most points then — and several
  // players on the same top score share the win.
  const ranked = [...players.map((name) => ({ name, left: false })), ...departed.map((name) => ({ name, left: true }))]
    .map((r) => ({ ...r, score: scores[r.name] ?? 0 }))
    .sort((a, b) => b.score - a.score);
  const stayed = ranked.filter((r) => !r.left);
  const top = stayed[0]?.score ?? 0;
  const winners = top > 0 ? stayed.filter((r) => r.score === top).map((r) => r.name) : [];
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

  const focus =
    winners.length > 1 ? (
      <View style={styles.lineup}>
        <AvatarRow
          count={winners.length}
          aspect={WINNER_ASPECT}
          maxH={ui.paneH}
          minH={ui.sp(LINEUP_MIN_H)}
          gap={ui.sp(8)}
          below={ui.sp(4) + ui.f(14) * 1.3}
          label={title}
          item={(i, { w, h }) => (
            <View style={[styles.lineupPig, { gap: ui.sp(4) }]}>
              <View style={{ width: w, height: h }}>
                <WinnerPig avatar={avatars[winners[i]] ?? NO_AVATAR} />
              </View>
              <Text style={[styles.lineupName, { fontSize: ui.f(14), maxWidth: w }]} maxFontSizeMultiplier={FONT_CAP} numberOfLines={1}>
                {winners[i]}
              </Text>
            </View>
          )}
        />
      </View>
    ) : (
      <WinnerPig avatar={(winners[0] && avatars[winners[0]]) || NO_AVATAR} />
    );

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
                {r.left ? ' (left)' : ''}
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

  // Won in a Pig Off: the screen comes in from under the night the Pig Off
  // ended in, and the fireworks keep going until everyone's left it. The
  // winner's own celebration (Your pig) has no say in that, nor after a
  // shared win: it plays only for a game won outright at the end of the
  // regular game (Fireworks, Disco: CelebrationLayer), with no fall to black.
  const pigOffWin = !!pigOff?.winner && winners.includes(pigOff.winner);
  const celebrate = !pigOff && winners.length === 1 ? avatars[winners[0]]?.celebrate : null;
  const overlay = pigOffWin ? (
    <FireworksLayer from={openedAt} bursts={ENCORE_BURSTS} period={ENCORE_PERIOD} night="lift" />
  ) : celebrate ? (
    <CelebrationLayer id={celebrate} from={openedAt} say={avatars[winners[0]]?.cheer} />
  ) : null;
  return <Stage header={header} focus={focus} actions={actions} overlay={overlay} />;
}

const makeStyles = (t: Theme) => StyleSheet.create({
  list: { width: '100%' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: t.surface,
    borderWidth: Math.max(1, t.edge),
    borderColor: t.surfaceBorder,
  },
  winnerRow: { backgroundColor: t.button, borderColor: t.buttonPressed },
  name: { color: t.surfaceText, fontFamily: font.medium, flex: 1 },
  score: { color: t.surfaceText, fontFamily: font.bold },
  winnerText: { color: t.buttonText },
  more: { color: t.textMuted, fontFamily: font.regular, textAlign: 'center' },
  lineup: { flex: 1, minHeight: 0, width: '100%', justifyContent: 'center' },
  lineupPig: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  lineupName: { color: t.text, fontFamily: font.medium, textAlign: 'center' },
});
