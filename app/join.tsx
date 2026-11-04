import React, { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Stage } from '../src/components/Stage';
import { Logo } from '../src/components/Logo';
import { PigButton } from '../src/components/PigButton';
import { PigInput } from '../src/components/PigInput';
import { showToast } from '../src/components/Toast';
import { IMAGES } from '../src/assets/assets';
import { NAME_MAX, entryMessage, useGame } from '../src/state/GameContext';
import { loadSession } from '../src/lib/session';

// Join an existing game by room code (was pages/JoinGame.js). The theme music
// heard here is driven by the route in app/_layout.tsx, not by this screen.
// A shared room link (https://squigglepig.app/join?room=ABCD, see lib/links)
// opens this screen with the code filled in and the last-used name restored, so
// the player only has to tap Lobby. The server says no to a game already in
// progress or a name already taken in the room, and this screen says why.
export default function Join() {
  const { enterRoom, room: current } = useGame();
  const params = useLocalSearchParams<{ room?: string }>();
  const linked = typeof params.room === 'string' ? params.room.trim().toUpperCase() : '';
  const [room, setRoom] = useState(linked);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

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
  // here moves the player to the new one, but only once the new room has
  // taken them (the server leaves the old one for them).
  const join = async () => {
    if (busy) return;
    setBusy(true);
    const status = await enterRoom(room, name);
    setBusy(false);
    if (status !== 'ok') showToast(entryMessage(status, room.trim().toUpperCase()), 3500);
  };

  return (
    <Stage
      focus={<Logo source={IMAGES.join} />}
      actions={
        <>
          <PigInput placeholder="Room Code" value={room} onChangeText={setRoom} autoCapitalize="characters" maxLength={8} />
          <PigInput placeholder="Player Name" value={name} onChangeText={setName} maxLength={NAME_MAX} />
          <PigButton name={busy ? 'Joining…' : 'Lobby'} onPress={join} />
        </>
      }
    />
  );
}
