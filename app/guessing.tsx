import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WorkStage } from '../src/components/WorkStage';
import { Logo } from '../src/components/Logo';
import { DrawingImage } from '../src/components/DrawingImage';
import { Heading } from '../src/components/Heading';
import { PigButton } from '../src/components/PigButton';
import { PigInput } from '../src/components/PigInput';
import { LeaveButton } from '../src/components/LeaveButton';
import { IMAGES } from '../src/assets/assets';
import { useGame } from '../src/state/GameContext';
import { PHRASE_MAX } from '../src/lib/text';
import { TIMERS } from '../src/lib/timers';

// Everyone captions simultaneously — each writes what they think the drawing
// they were handed depicts. That caption becomes the next player's prompt.
// A drawing that came back blank is passed over for the last real one in the
// chain; if every one so far was blank (prev 'blank'), the player writes
// something for the next player to draw instead, so the chain carries on.
// Shares WorkStage with the drawing screen, so the pig, timer, input and Submit
// sit exactly where "Draw this" and Submit were a moment ago. Like the drawing
// screen it keeps the turn it opened on, and a guess typed but not handed in
// when the game moves on is handed in as the screen closes.
export default function Guessing() {
  const { submitCell, passTurn, prev, turn, turnEndsAt, resuming } = useGame();
  const [myTurn] = useState(turn);
  const [guess, setGuess] = useState('');
  const drawing = prev && prev.kind === 'drawing' ? prev.data : '';
  const blank = prev?.kind === 'blank';
  const typed = useRef('');
  typed.current = guess.trim();
  const sent = useRef(false);

  const handle = () => {
    if (!typed.current || sent.current) return;
    sent.current = true;
    submitCell(typed.current, myTurn);
  };

  // Time's up: submit whatever was typed, or bow out of this pass if empty.
  const onExpire = () => {
    if (typed.current) handle();
    else passTurn(myTurn);
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

  // The drawing you're captioning is the focus. With nothing to guess, the pig
  // fills the pane, under what to write instead.
  const focus = drawing ? (
    <DrawingImage data={drawing} />
  ) : blank ? (
    <View style={styles.fill}>
      <Heading size="h4">The drawings came back blank. Write something for the next player to draw!</Heading>
      <View style={styles.fill}>
        <Logo source={IMAGES.cell} />
      </View>
    </View>
  ) : (
    <Logo source={IMAGES.cell} />
  );

  return (
    <WorkStage
      focus={focus}
      timeLimit={TIMERS.caption}
      until={turnEndsAt}
      onExpire={onExpire}
      hold={resuming}
      top={
        <PigInput
          style={styles.fill}
          placeholder={blank ? 'Something to draw' : 'Your guess'}
          value={guess}
          onChangeText={setGuess}
          maxLength={PHRASE_MAX}
          onSubmitEditing={handle}
          returnKeyType="done"
          autoCapitalize="sentences"
        />
      }
      primary={<PigButton name="Submit" onPress={handle} />}
      footer={<LeaveButton />}
    />
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
