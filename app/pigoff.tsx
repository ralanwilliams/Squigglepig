import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stage } from '../src/components/Stage';
import { Heading } from '../src/components/Heading';
import { NoteCard } from '../src/components/NoteCard';
import { Countdown } from '../src/components/Countdown';
import { DrawingImage } from '../src/components/DrawingImage';
import { PeekOver } from '../src/components/PeekPig';
import { PigButton } from '../src/components/PigButton';
import { ButtonNote } from '../src/components/ButtonNote';
import { LeaveButton } from '../src/components/LeaveButton';
import { PigRoster } from '../src/components/PigRoster';
import { PigOffResults, PIG_OFF_SHOW_MS, PIG_OFF_FIREWORKS_AT } from '../src/components/PigOffResults';
import { FireworksLayer } from '../src/components/Fireworks';
import { ClashTitle, ClashWords } from '../src/components/ClashTitle';
import { DrawPad, useStrokes } from '../src/arcade/games/memory/DrawPad';
import { PACK, answerFor } from '../src/arcade/games/memory/pack';
import { useMyAvatar } from '../src/avatar/avatar';
import { useGame } from '../src/state/GameContext';
import { PIG_OFF, pigOffIntro } from '../src/lib/timers';
import { PIG_OFF_TRIES } from '../src/state/rules';
import { SPACE } from '../src/lib/drawing';
import { type Theme } from '../src/theme/tokens';
import { useThemedStyles } from '../src/theme/theme';
import { useUi } from '../src/theme/responsive';

// The game ended tied: a Pig Off (src/state/rules.ts). Everyone in the room
// is here, the tied players and everyone watching, and sees each part as it
// comes, on the game's clock (stageStart):
//   1. The announcement: "Pig Off!", the tied players' pigs, and how it goes.
//      Again after a tie on that too, with just the ones still tied.
//   2. The drawing, shown to everyone for a moment (as the solo game's).
//   3. The tied players draw it from memory on the solo game's pad (one
//      finger, black ink, Clear · Undo; no brushes or stickers), Done or the
//      clock handing it in. Everyone else watches their pigs get their ✓.
//   4. The results (PigOffResults): the rows swap into the order they
//      finished and the winner bursts out; the winner takes a point. Then the
//      scoreboard, or another go.
// Leave game is always there, as on every game screen.
export default function PigOffScreen() {
  const ui = useUi();
  const styles = useThemedStyles(makeStyles);
  const { pigOff, stageStart, username, avatars, submitPigOff, resuming, players: inRoom } = useGame();
  const myAvatar = useMyAvatar();
  const now = useNow(250);

  const entry = pigOff ? PACK[pigOff.entry] : undefined;
  const shown = useMemo(() => (entry ? JSON.stringify({ ...SPACE, strokes: entry.strokes }) : ''), [entry]);

  // Whether this player is in it, and has handed in their drawing on this attempt.
  const attempt = pigOff?.attempt ?? 0;
  const [sent, setSent] = useState(0); // the attempt this player has handed in
  const playing = !!pigOff && pigOff.players.includes(username);
  const drawn = !!pigOff?.drawings[username] || sent === attempt;
  const handIn = (strokes: string[]) => {
    if (!playing || drawn) return;
    setSent(attempt);
    submitPigOff(strokes);
  };

  if (!pigOff || !entry) return <Stage focus={<Heading>Pig Off!</Heading>} />;

  const players = pigOff.players.map((name) => ({
    name,
    avatar: name === username ? (avatars[name] ?? myAvatar) : avatars[name],
    me: name === username,
  }));
  const names = list(pigOff.players.map((n) => (n === username ? 'you' : n)));
  const t = now - stageStart;
  const introMs = pigOffIntro(attempt) * 1000;
  const drawFrom = introMs + PIG_OFF.flash * 1000;
  const drawUntil = stageStart + drawFrom + PIG_OFF.draw * 1000;
  const part = pigOff.matches ? 'results' : t < introMs ? 'intro' : t < drawFrom ? 'flash' : 'draw';

  // In the clash title's style (ClashTitle): the words as it leaves them.
  const title = <ClashWords left="PIG" right="OFF!" size={ui.f(30)} label="Pig Off!" />;

  if (part === 'intro') {
    return (
      <Stage
        header={title}
        // The first time: PIG and OFF! charge in from either side and butt
        // heads, then fade to show this (ClashTitle).
        overlay={attempt === 1 ? <ClashTitle left="PIG" right="OFF!" start={stageStart} /> : null}
        focus={<PigRoster players={players} />}
        actions={
          <>
            <NoteCard label={attempt > 1 ? 'Still tied!' : 'It’s a tie!'}>
              {attempt > 1
                ? `Once more, just ${names}: a new drawing, the same rules.`
                : `${capital(names)} each see a drawing for a moment, then draw it from memory. The closest match wins!`}
            </NoteCard>
            {/* Not `live`: it changes every second, and a screen reader
                would read out each one. */}
            <ButtonNote text={`Starts in ${Math.max(1, Math.ceil((introMs - t) / 1000))}`} />
            <LeaveButton />
          </>
        }
      />
    );
  }

  if (part === 'flash') {
    return (
      <Stage
        header={title}
        focus={
          <PeekOver>
            <DrawingImage data={shown} />
          </PeekOver>
        }
        actions={
          <>
            <Heading size="h3">{playing ? 'Remember this!' : `${capital(names)} ${pigOff.players.length === 2 ? 'are' : 'are all'} memorizing this…`}</Heading>
            <LeaveButton />
          </>
        }
      />
    );
  }

  if (part === 'draw') {
    if (playing && !drawn) {
      return <DrawTurn key={attempt} title={title} until={drawUntil} hold={resuming} onHandIn={handIn} />;
    }
    const clock = <Countdown seconds={PIG_OFF.draw} until={drawUntil} hold={resuming} />;
    // Watching (or done): the tied players' pigs, each with its ✓ once drawn.
    return (
      <Stage
        header={title}
        focus={<PigRoster players={players.map((p) => ({ ...p, done: !!pigOff.drawings[p.name] || (p.me && drawn) }))} status={['drawn', 'still drawing']} />}
        actions={
          <>
            {clock}
            <Heading lines={2}>{drawn ? 'Drawn! Waiting for the others…' : `${capital(names)} ${pigOff.players.length === 2 ? 'are' : 'are all'} drawing from memory…`}</Heading>
            <LeaveButton />
          </>
        }
      />
    );
  }

  // The results.
  const showing = now - stageStart >= PIG_OFF_SHOW_MS;
  const matches = pigOff.matches ?? {};
  const top = Math.max(0, ...pigOff.players.map((n) => matches[n] ?? 0));
  // Still tied, as the game will see it: only those still in the room go
  // again (state/game/pigOff.ts pigOffNext). With one left, they win; once the tries
  // run out, they share it.
  const still = pigOff.players.filter((n) => (matches[n] ?? 0) === top && inRoom.includes(n));
  const verdict = pigOff.winner
    ? `${pigOff.winner === username ? 'You win' : `${pigOff.winner} wins`} the Pig Off! +1 point`
    : still.length === 1
      ? `${still[0] === username ? 'You win' : `${still[0]} wins`}: the others have left.`
      : attempt >= PIG_OFF_TRIES || still.length === 0
        ? `Still tied at ${top}%! ${capital(list(still.length ? still : pigOff.players))} share the win.`
        : `Still tied at ${top}%! ${capital(list(still))} go again…`;
  return (
    <Stage
      header={title}
      // A winner: as the crown goes on, fireworks over the whole screen, their
      // light on the winner's pig in the results (PigOffResults). 3 s in, the
      // screen fades slowly to an iridescent black and stays there, the
      // fireworks rolling on, until the scoreboard fades in from under the
      // same night at the same rate, the fireworks still going.
      overlay={<FireworksLayer from={stageStart + PIG_OFF_FIREWORKS_AT} on={!!pigOff.winner} encore night="fall" nightDelay={3000} />}
      focus={
        <View style={[styles.fill, { gap: ui.sp(6) }]}>
          <Heading size="h4" lines={1}>
            It was {answerFor(entry.word)}
          </Heading>
          <View style={styles.fill}>
            <DrawingImage data={shown} />
          </View>
        </View>
      }
      actions={
        <>
          <PigOffResults
            players={pigOff.players}
            matches={matches}
            drawings={pigOff.drawings}
            winner={pigOff.winner}
            avatars={{ ...avatars, [username]: avatars[username] ?? myAvatar }}
            me={username}
            start={stageStart}
          />
          <Heading size="h4" lines={2}>
            {showing ? verdict : ' '}
          </Heading>
          <LeaveButton />
        </>
      }
    />
  );
}

// A tied player drawing from memory: the solo game's pad (a fresh one each
// attempt: the screen keys this by it), handed in by Done or the clock, or,
// if the screen moves on first with something drawn, as it closes.
function DrawTurn({
  title,
  until,
  hold,
  onHandIn,
}: {
  title: React.ReactNode;
  until: number;
  hold: boolean;
  onHandIn: (strokes: string[]) => void;
}) {
  const { latest, pad } = useStrokes();
  const sent = useRef(false);
  const handIn = () => {
    if (sent.current) return;
    sent.current = true;
    onHandIn(latest());
  };
  const handInRef = useRef(handIn);
  handInRef.current = handIn;
  useEffect(
    () => () => {
      if (latest().length) handInRef.current();
    },
    []
  );
  return (
    <Stage
      header={title}
      focus={
        <PeekOver>
          <DrawPad {...pad} />
        </PeekOver>
      }
      actions={
        <>
          <Countdown seconds={PIG_OFF.draw} until={until} onExpire={handIn} hold={hold} />
          <Heading>Now draw it!</Heading>
          <PigButton name="Done" onPress={handIn} />
          <LeaveButton />
        </>
      }
    />
  );
}

// The time, every `ms`, for working out which part of the Pig Off is on.
function useNow(ms: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

const list = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const makeStyles = (_t: Theme) =>
  StyleSheet.create({
    fill: { flex: 1, minHeight: 0 },
  });
