import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { WorkStage } from '../src/components/WorkStage';
import { Logo } from '../src/components/Logo';
import { DrawingImage } from '../src/components/DrawingImage';
import { PigButton } from '../src/components/PigButton';
import { PigInput } from '../src/components/PigInput';
import { LeaveButton } from '../src/components/LeaveButton';
import { IMAGES } from '../src/assets/assets';
import { useGame } from '../src/state/GameContext';
import { TIMERS } from '../src/lib/timers';

// Everyone captions simultaneously — each writes what they think the drawing
// they were handed depicts. That caption becomes the next player's prompt.
// Shares WorkStage with the drawing screen, so the pig, timer, input and Submit
// sit exactly where "Draw this" and Submit were a moment ago.
export default function Guessing() {
  const { submitCell, prev } = useGame();
  const [guess, setGuess] = useState('');
  const drawing = prev && prev.kind === 'drawing' ? prev.data : '';

  const handle = () => {
    if (guess.trim()) submitCell(guess.trim());
  };

  // Time's up: submit whatever was typed, or bow out of this pass if empty.
  const onExpire = () => {
    if (guess.trim()) submitCell(guess.trim());
    else router.replace('/waiting');
  };

  // The drawing you're captioning is the focus. If it's missing (rare: a
  // blank/absent submission) fall back to the pig so the pane isn't empty.
  const focus = drawing ? <DrawingImage data={drawing} /> : <Logo source={IMAGES.cell} />;

  return (
    <WorkStage
      focus={focus}
      timeLimit={TIMERS.caption}
      onExpire={onExpire}
      top={
        <PigInput
          style={styles.fill}
          placeholder="your guess"
          value={guess}
          onChangeText={setGuess}
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
