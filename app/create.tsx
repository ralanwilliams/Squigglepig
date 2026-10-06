import React, { useState } from 'react';
import { Stage } from '../src/components/Stage';
import { Logo } from '../src/components/Logo';
import { PigButton } from '../src/components/PigButton';
import { PigInput } from '../src/components/PigInput';
import { showToast } from '../src/components/Toast';
import { IMAGES } from '../src/assets/assets';
import { useGame } from '../src/state/GameContext';
import { useThemeMode } from '../src/theme/theme';

// Create a new game; a room code is generated for the host (was pages/CreateGame.js).
function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// Secret switches typed as the username. Dark mode ships hidden (see
// src/theme/theme.tsx); these reveal it again, or put it away.
const SWITCHES: Record<string, boolean> = {
  'activate dark mode': true,
  'deactivate dark mode': false,
};

export default function Create() {
  const { enterRoom } = useGame();
  const { setUnlocked } = useThemeMode();
  const [name, setName] = useState('');

  const onChangeName = (text: string) => {
    const on = SWITCHES[text.trim().toLowerCase()];
    if (on === undefined) {
      setName(text);
      return;
    }
    setUnlocked(on);
    setName('');
    showToast(on ? 'Dark mode activated.' : 'Dark mode deactivated.', 2000);
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
