import React, { useState } from 'react';
import { Stage } from '../src/components/Stage';
import { Logo } from '../src/components/Logo';
import { PigButton } from '../src/components/PigButton';
import { PigInput } from '../src/components/PigInput';
import { IMAGES } from '../src/assets/assets';
import { useGame } from '../src/state/GameContext';

// Create a new game; a room code is generated for the host (was pages/CreateGame.js).
function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// Secret switches typed as the username: an exact phrase (case and outer
// spaces ignored) runs its action instead of becoming the name, and the field
// clears. None at the moment — add entries as `'phrase': () => { … }` (a
// showToast from src/components/Toast is a good way to confirm it worked).
const SWITCHES: Record<string, () => void> = {};

export default function Create() {
  const { enterRoom } = useGame();
  const [name, setName] = useState('');

  const onChangeName = (text: string) => {
    const action = SWITCHES[text.trim().toLowerCase()];
    if (!action) {
      setName(text);
      return;
    }
    setName('');
    action();
  };

  return (
    <Stage
      focus={<Logo source={IMAGES.home} />}
      actions={
        <>
          <PigInput placeholder="Player Name" value={name} onChangeText={onChangeName} />
          <PigButton name="Create" onPress={() => enterRoom(makeCode(), name)} />
        </>
      }
    />
  );
}
