import React, { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Stage } from '../src/components/Stage';
import { Logo } from '../src/components/Logo';
import { PigButton } from '../src/components/PigButton';
import { PigInput } from '../src/components/PigInput';
import { IMAGES } from '../src/assets/assets';
import { useGame } from '../src/state/GameContext';
import { loadSession } from '../src/lib/session';

// Join an existing game by room code (was pages/JoinGame.js). The theme music
// heard here is driven by the route in app/_layout.tsx, not by this screen.
// A shared room link (https://squigglepig.app/join?room=ABCD, see lib/links)
// opens this screen with the code filled in and the last-used name restored, so
// the player only has to tap Lobby.
export default function Join() {
  const { enterRoom, leaveRoom, room: current } = useGame();
  const params = useLocalSearchParams<{ room?: string }>();
  const linked = typeof params.room === 'string' ? params.room.trim().toUpperCase() : '';
  const [room, setRoom] = useState(linked);
  const [name, setName] = useState('');

  useEffect(() => {
    let active = true;
    loadSession().then((s) => {
      if (active && s) setName((n) => n || s.username);
    });
    return () => {
      active = false;
    };
  }, []);

  // A link to the room we're already in: drop back to wherever that game is.
  // Checked once on arrival only — joining from here sets `current` to the same
  // code, and that must not bounce the player back out of the new lobby.
  useEffect(() => {
    if (linked && linked === current && router.canGoBack()) router.back();
  }, []);

  // A link tapped mid-game opens this screen over the old room; joining from
  // here leaves that one first (enterRoom doesn't close an existing channel).
  const join = () => {
    if (current) leaveRoom();
    enterRoom(room, name);
  };

  return (
    <Stage
      focus={<Logo source={IMAGES.join} />}
      actions={
        <>
          <PigInput placeholder="room code" value={room} onChangeText={setRoom} />
          <PigInput placeholder="username" value={name} onChangeText={setName} />
          <PigButton name="Lobby" onPress={join} />
        </>
      }
    />
  );
}
