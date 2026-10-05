import React, { useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Stage } from '../src/components/Stage';
import { Logo } from '../src/components/Logo';
import { PigButton } from '../src/components/PigButton';
import { LeaveButton } from '../src/components/LeaveButton';
import { IMAGES } from '../src/assets/assets';
import { useGame, MIN_PLAYERS } from '../src/state/GameContext';
import { roomLink } from '../src/lib/links';
import { font, type Theme } from '../src/theme/tokens';
import { useThemedStyles } from '../src/theme/theme';
import { FONT_CAP, useUi } from '../src/theme/responsive';
import { DevPanel } from '../src/dev'; // local-only tooling (src/dev/local is gitignored)

// A small, fixed palette for player avatars; the color is picked deterministically
// from the name so a given player always keeps the same one.
const AVATAR_COLORS = ['#DB7093', '#4EA8DE', '#F4A259', '#6A4C93', '#2A9D8F', '#E76F51'];
const initialOf = (name: string) => {
  const m = name.match(/[a-z0-9]/i); // skip a leading emoji/space so names like "🤖 Piggo" show a letter
  return (m ? m[0] : name.trim()[0] ?? '?').toUpperCase();
};
const colorFor = (name: string) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
};

// Lobby: the pig fills the left of the stage; on the right a single card groups
// everything the host touches — room code, the points-to-win stepper, Start, and
// the live roster (host = the earliest joiner, players[0]). Nothing scrolls: the
// roster shows as many rows as the pane has room for and collapses the rest to
// "+N more", and Stage's FitBox shrinks the card if it is still too tall.
export default function Lobby() {
  const ui = useUi();
  const styles = useThemedStyles(makeStyles);
  const { room, players, username, isHost, startGame, status, statusDetail } = useGame();
  const [target, setTarget] = useState(5);

  const bump = (delta: number) => setTarget((t) => Math.min(20, Math.max(1, t + delta)));

  // Hands the link to the system share sheet (SMS, Signal, Messenger, …). The
  // code rides along in the text so it still works where the link doesn't open
  // the app. Dismissing the sheet resolves normally; only a real failure throws.
  const shareRoom = () => {
    Share.share({ message: `Join my Squigglepig game! ${roomLink(room)} (room code ${room})` }).catch(() => {});
  };

  const canStart = players.length >= MIN_PLAYERS;
  const connected = status === 'connected';

  const banner =
    status === 'no-keys'
      ? '⚠ Supabase keys not loaded — check .env, then: npx expo start -c'
      : status === 'connecting'
        ? 'Connecting to server…'
        : status === 'error'
          ? `⚠ Connection error: ${statusDetail || 'unknown'}`
          : `Connected · ${players.length} player${players.length === 1 ? '' : 's'}`;

  // Roster rows the pane can hold at full size beneath the card's fixed chrome.
  const visible = Math.max(4, Math.floor((ui.paneH - ui.sp(300)) / ui.sp(34)));
  const shown = players.slice(0, visible);
  const hidden = Math.max(0, players.length - visible);

  const header = (
    <View style={[styles.headerRow, { gap: ui.sp(8) }]}>
      <View
        style={[
          styles.dot,
          { width: ui.sp(8), height: ui.sp(8), borderRadius: ui.sp(4) },
          connected ? styles.dotOk : styles.dotWarn,
        ]}
      />
      <Text
        style={[styles.status, { fontSize: ui.f(13) }, connected ? styles.ok : styles.warn]}
        maxFontSizeMultiplier={FONT_CAP}
        numberOfLines={2}
      >
        {banner}
      </Text>
    </View>
  );

  const focus = <Logo source={IMAGES.lobby} />;

  const step = ui.sp(32);
  const avatar = ui.sp(26);

  const actions = (
    <View style={{ gap: ui.sp(8) }}>
      <View style={[styles.card, { borderRadius: ui.sp(18), padding: ui.sp(14), gap: ui.sp(10) }]}>
        <View
          style={[
            styles.codeChip,
            { borderRadius: ui.sp(12), paddingHorizontal: ui.sp(14), paddingVertical: ui.sp(10) },
          ]}
        >
          <Text style={[styles.codeLabel, { fontSize: ui.f(11) }]} maxFontSizeMultiplier={FONT_CAP}>
            ROOM CODE
          </Text>
          <Text style={[styles.code, { fontSize: ui.f(24) }]} maxFontSizeMultiplier={FONT_CAP}>
            {room}
          </Text>
        </View>

        {isHost ? (
          <>
            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { fontSize: ui.f(14) }]} maxFontSizeMultiplier={FONT_CAP}>
                Points to win
              </Text>
              <View style={[styles.pill, { padding: ui.sp(3), gap: ui.sp(2) }]}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => bump(-1)}
                  style={[styles.step, { width: step, height: step, borderRadius: step / 2 }]}
                  hitSlop={8}
                >
                  <Text style={[styles.stepText, { fontSize: ui.f(20) }]} maxFontSizeMultiplier={FONT_CAP}>−</Text>
                </Pressable>
                <Text
                  style={[styles.stepVal, { minWidth: ui.sp(34), fontSize: ui.f(19) }]}
                  maxFontSizeMultiplier={FONT_CAP}
                >
                  {target}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => bump(1)}
                  style={[styles.step, { width: step, height: step, borderRadius: step / 2 }]}
                  hitSlop={8}
                >
                  <Text style={[styles.stepText, { fontSize: ui.f(20) }]} maxFontSizeMultiplier={FONT_CAP}>+</Text>
                </Pressable>
              </View>
            </View>
            {canStart ? (
              <PigButton name="Start Game" onPress={() => startGame(target)} />
            ) : (
              <View style={[styles.startDisabled, { minHeight: ui.sp(44), borderRadius: ui.sp(8) }]}>
                <Text style={[styles.startDisabledText, { fontSize: ui.f(15) }]} maxFontSizeMultiplier={FONT_CAP}>
                  Need {MIN_PLAYERS}+ players
                </Text>
              </View>
            )}
          </>
        ) : (
          <Text style={[styles.waiting, { fontSize: ui.f(15), paddingVertical: ui.sp(6) }]} maxFontSizeMultiplier={FONT_CAP}>
            Waiting for the host to start…
          </Text>
        )}

        <View style={styles.playersHead}>
          <Text style={[styles.playersLabel, { fontSize: ui.f(11) }]} maxFontSizeMultiplier={FONT_CAP}>PLAYERS</Text>
          <Text style={[styles.playersCount, { fontSize: ui.f(11) }]} maxFontSizeMultiplier={FONT_CAP}>{players.length}</Text>
        </View>
        <View style={{ gap: ui.sp(2) }}>
          {shown.map((p, i) => (
            <View key={i} style={[styles.playerRow, { gap: ui.sp(10), paddingVertical: ui.sp(3) }]}>
              <View
                style={[
                  styles.avatar,
                  { width: avatar, height: avatar, borderRadius: avatar / 2, backgroundColor: colorFor(p) },
                ]}
              >
                <Text style={[styles.avatarText, { fontSize: ui.f(12) }]} maxFontSizeMultiplier={FONT_CAP}>
                  {initialOf(p)}
                </Text>
              </View>
              <Text
                style={[styles.playerName, { fontSize: ui.f(15) }]}
                maxFontSizeMultiplier={FONT_CAP}
                numberOfLines={1}
              >
                {p}
                {p === username ? ' (you)' : ''}
              </Text>
              {i === 0 && (
                <Text
                  style={[styles.hostBadge, { fontSize: ui.f(10), paddingHorizontal: ui.sp(7), paddingVertical: ui.sp(2) }]}
                  maxFontSizeMultiplier={FONT_CAP}
                >
                  HOST
                </Text>
              )}
            </View>
          ))}
          {hidden > 0 && (
            <Text style={[styles.morePlayers, { fontSize: ui.f(12) }]} maxFontSizeMultiplier={FONT_CAP}>
              +{hidden} more
            </Text>
          )}
        </View>
      </View>

      <PigButton name="Share Room Link" onPress={shareRoom} />
      <DevPanel />
      <LeaveButton />
    </View>
  );

  return <Stage header={header} focus={focus} actions={actions} />;
}

const makeStyles = (t: Theme) => StyleSheet.create({
  // Header: a live status dot + the connection banner.
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  dot: {},
  dotOk: { backgroundColor: t.success },
  dotWarn: { backgroundColor: t.accent },
  status: { flex: 1, fontFamily: font.regular },
  ok: { color: t.link },
  warn: { color: t.accent },

  card: {
    backgroundColor: t.surface,
    shadowColor: t.shadow,
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },

  // Room code chip.
  codeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: t.surfaceInset,
  },
  codeLabel: { fontFamily: font.bold, letterSpacing: 1.5, color: t.textMuted },
  code: { fontFamily: font.bold, letterSpacing: 3, color: t.surfaceText },

  // Points-to-win setting row with a pill stepper.
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settingLabel: { fontFamily: font.medium, color: t.surfaceText },
  pill: { flexDirection: 'row', alignItems: 'center', backgroundColor: t.surfaceInset, borderRadius: 999 },
  step: {
    backgroundColor: t.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: t.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  stepText: { color: t.link, fontFamily: font.bold },
  stepVal: { textAlign: 'center', fontFamily: font.bold, color: t.surfaceText },

  // Disabled Start (not enough players yet) — same footprint as PigButton.
  startDisabled: { backgroundColor: t.surfaceInset, alignItems: 'center', justifyContent: 'center' },
  startDisabledText: {
    color: t.textMuted,
    fontFamily: font.medium,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  waiting: { fontFamily: font.regular, color: t.surfaceText, textAlign: 'center' },

  // Players roster.
  playersHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  playersLabel: { fontFamily: font.bold, letterSpacing: 1, color: t.textMuted },
  playersCount: { fontFamily: font.bold, color: t.textMuted },
  playerRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: t.accentText, fontFamily: font.bold },
  playerName: { flex: 1, fontFamily: font.medium, color: t.surfaceText },
  hostBadge: {
    fontFamily: font.bold,
    letterSpacing: 0.5,
    color: t.accentText,
    backgroundColor: t.accent,
    borderRadius: 999,
    overflow: 'hidden',
  },
  morePlayers: { color: t.textMuted, fontFamily: font.regular, textAlign: 'center' },
});
