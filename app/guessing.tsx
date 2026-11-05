import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
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
// sit exactly where "Draw this" and Submit were a moment ago.
export default function Guessing() {
  const { submitCell, prev } = useGame();
  const [guess, setGuess] = useState('');
  const drawing = prev && prev.kind === 'drawing' ? prev.data : '';
  const blank = prev?.kind === 'blank';

  const handle = () => {
    if (guess.trim()) submitCell(guess.trim());
  };

  // Time's up: submit whatever was typed, or bow out of this pass if empty.
  const onExpire = () => {
    if (guess.trim()) submitCell(guess.trim());
    else router.replace('/waiting');
  };

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
      onExpire={onExpire}
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
