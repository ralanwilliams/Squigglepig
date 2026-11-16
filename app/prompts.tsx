import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WorkStage } from '../src/components/WorkStage';
import { FitBox } from '../src/components/FitBox';
import { PigRoster } from '../src/components/PigRoster';
import { PigInput } from '../src/components/PigInput';
import { PigButton } from '../src/components/PigButton';
import { ButtonNote } from '../src/components/ButtonNote';
import { LeaveButton } from '../src/components/LeaveButton';
import { useGame } from '../src/state/GameContext';
import { useMyAvatar } from '../src/avatar/avatar';
import { TIMERS } from '../src/lib/timers';
import { PHRASE_MAX } from '../src/lib/text';
import { font, type Theme } from '../src/theme/tokens';
import { useThemedStyles } from '../src/theme/theme';
import { FONT_CAP, useUi } from '../src/theme/responsive';

// Names listed before the rest are counted ("and 3 more").
const NAMES = 3;

// Every round starts here: each player writes one prompt. It starts the chain
// they own (and judge at the reveal), and goes to another player to draw:
// nobody is ever handed their own. The focus is who's in: the round's
// players as their own pigs, dressed as they've dressed them, each with a ✓
// once their prompt is in (PigRoster). Once this player's is in, Submit gives
// way to Player ready and the line under the pigs says who's still writing;
// when everyone's prompt is in (or the clock runs out, and a stand-in takes
// the place of any that aren't) the drawing starts for everyone at once.
//
// Same WorkStage frame as drawing and guessing: the pig peeks over the prompt
// box with the timer beside it, and Submit sits where it does on those, so
// the round reads as one continuous place. Like guessing, it keeps the turn it
// opened on, and a prompt typed but not handed in when the clock runs out (or
// the game moves on) is handed in then.
export default function Prompts() {
  const ui = useUi();
  const styles = useThemedStyles(makeStyles);
  const { submitCell, turn, turnEndsAt, resuming, round, roster, players: inRoom, chains, username, avatars, away } = useGame();
  const myAvatar = useMyAvatar();
  const [myTurn] = useState(turn);
  const [draft, setDraft] = useState('');
  const [sentText, setSentText] = useState('');
  const typed = useRef('');
  typed.current = draft.trim();
  const sent = useRef(false);

  // Whose prompt is in: roster[c]'s starts chain c.
  const promptOf = (c: number) => {
    const cell = chains[c]?.cells[0];
    return cell?.kind === 'prompt' ? cell : undefined;
  };
  // In already: handed in on this screen, or before the phone went away and
  // caught up again (the room's copy has it).
  const mine = myTurn ? promptOf(myTurn.chain) : undefined;
  const roomHasIt = !!mine && mine.author === username;
  const ready = !!sentText || roomHasIt;
  const shown = sentText || (roomHasIt ? mine.text : '');

  const handle = () => {
    if (!typed.current || sent.current || ready) return;
    sent.current = true;
    setSentText(typed.current);
    submitCell(typed.current, myTurn);
  };

  useEffect(
    () => () => {
      if (!sent.current && typed.current) {
        sent.current = true;
        submitCell(typed.current, myTurn, true);
      }
    },
    []
  );

  // The round's players still in the room (one who tapped Leave game isn't
  // waited for: a stand-in takes their prompt's place), each by the chain
  // their prompt starts. This phone's own pig as it's dressed here, before its
  // presence has come back round.
  const players = roster
    .map((name, c) => ({
      name,
      avatar: name === username ? (avatars[name] ?? myAvatar) : avatars[name],
      me: name === username,
      done: name === username ? ready : !!promptOf(c),
    }))
    .filter((p) => p.me || inRoom.includes(p.name));
  const waiting = players.filter((p) => !p.done && !p.me).map((p) => (away.includes(p.name) ? `${p.name} (away)` : p.name));
  const more = waiting.length - NAMES;
  const line = !ready
    ? 'Write a prompt for someone else to draw'
    : waiting.length === 0
      ? 'Everyone’s in. Time to draw…'
      : `Waiting on ${waiting.slice(0, NAMES).join(', ')}${more > 0 ? ` and ${more} more` : ''}…`;

  // The round, who's in, and what's happening, shrunk as one if the pane is short.
  const focus = (
    <FitBox style={styles.fill}>
      <View style={[styles.wrap, { gap: ui.sp(18) }]}>
        <Text style={[styles.round, { fontSize: ui.f(20) }]} maxFontSizeMultiplier={FONT_CAP} accessibilityRole="header">
          Round {round + 1}
        </Text>
        <PigRoster players={players} />
        <Text style={[styles.line, { fontSize: ui.f(16) }]} maxFontSizeMultiplier={FONT_CAP} accessibilityLiveRegion="polite">
          {line}
        </Text>
      </View>
    </FitBox>
  );

  return (
    <WorkStage
      focus={focus}
      timeLimit={TIMERS.prompt}
      until={turnEndsAt}
      onExpire={handle}
      hold={resuming}
      top={
        <PigInput
          style={[styles.fill, ready && styles.done]}
          placeholder="A puffin drinking hot chocolate"
          value={ready ? shown : draft}
          onChangeText={setDraft}
          editable={!ready}
          maxLength={PHRASE_MAX}
          onSubmitEditing={handle}
          returnKeyType="done"
          autoCapitalize="sentences"
          autoCorrect
        />
      }
      primary={ready ? <ButtonNote text="Player ready" live /> : <PigButton name="Submit" onPress={handle} />}
      footer={<LeaveButton />}
    />
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    fill: { flex: 1, width: '100%' },
    wrap: { width: '100%', alignItems: 'center', justifyContent: 'center' },
    round: { color: t.text, fontFamily: font.medium, textAlign: 'center' },
    line: { color: t.textMuted, fontFamily: font.regular, textAlign: 'center' },
    // The box once the prompt's in: it keeps it, locked and recessed.
    done: { backgroundColor: t.surfaceInset, color: t.textMuted },
  });
