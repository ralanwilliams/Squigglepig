import React, { useState } from 'react';
import { Stage } from '../src/components/Stage';
import { Logo } from '../src/components/Logo';
import { PigButton } from '../src/components/PigButton';
import { PigInput } from '../src/components/PigInput';
import { IMAGES } from '../src/assets/assets';
import { useGame } from '../src/state/GameContext';

// Join an existing game by room code (was pages/JoinGame.js). The theme music
// heard here is driven by the route in app/_layout.tsx, not by this screen.
export default function Join() {
  const { enterRoom } = useGame();
  const [room, setRoom] = useState('');
  const [name, setName] = useState('');

  return (
    <Stage
      focus={<Logo source={IMAGES.join} />}
      actions={
        <>
          <PigInput placeholder="room code" value={room} onChangeText={setRoom} />
          <PigInput placeholder="username" value={name} onChangeText={setName} />
          <PigButton name="Lobby" onPress={() => enterRoom(room, name)} />
        </>
      }
    />
  );
}
