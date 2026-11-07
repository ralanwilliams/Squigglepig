import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Stage } from '../src/components/Stage';
import { Logo } from '../src/components/Logo';
import { PigButton } from '../src/components/PigButton';
import { PigInput } from '../src/components/PigInput';
import { showToast } from '../src/components/Toast';
import { IMAGES } from '../src/assets/assets';
import { NAME_MAX, entryMessage, useGame } from '../src/state/GameContext';
import { loadSession } from '../src/lib/session';
import { cleanRoomCode } from '../src/lib/text';

// Join an existing game by room code (was pages/JoinGame.js). The theme music
// heard here is driven by the route in app/_layout.tsx, not by this screen.
// A shared room link (https://squigglepig.app/join?room=ABCD, see lib/links)
// opens this screen with the code filled in and the last-used name restored, so
// the player only has to tap Lobby. The server says no to a game already in
// progress or a name already taken in the room, and this screen says why.
// The code box only takes what a code can be (src/lib/text.ts, cleanRoomCode):
// typed or pasted, it's capitalised, anything else is left out, and it stops
// at four. The server capitalises too, so case never matters.
export default function Join() {
  const { enterRoom, room: current, returnToRoom } = useGame();
  const params = useLocalSearchParams<{ room?: string }>();
  const linked = cleanRoomCode(params.room);
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

  // A link to the room we're already in: back to wherever that game is (the
  // room's own screen, as it was, if this opened over it: returnToRoom).
  // Checked once on arrival only — joining from here sets `current` to the same
  // code, and that must not bounce the player back out of the new lobby.
  useEffect(() => {
    if (linked && linked === current) returnToRoom();
  }, []);

  // A link tapped mid-game opens this screen over the old room; joining from
  // here moves the player to the new one, but only once the new room has
  // taken them (the server leaves the old one for them).
  const join = async () => {
    if (busy) return;
    setBusy(true);
    const status = await enterRoom(room, name);
    setBusy(false);
    // Long enough to read the room code messages, which say what to do next.
    if (status !== 'ok') showToast(entryMessage(status, room), 6000);
  };

  return (
    <Stage
      menu
      focus={<Logo source={IMAGES.join} />}
      actions={
        <>
          <PigInput
            placeholder="Room Code"
            value={room}
            onChangeText={(text) => setRoom(cleanRoomCode(text))}
            // Android keyboards that compose words (suggestions) can repeat
            // letters when the box rewrites what's typed; this keyboard
            // doesn't compose, and puts the number row on screen too.
            keyboardType={Platform.OS === 'android' ? 'visible-password' : 'default'}
            autoCapitalize="characters"
            autoComplete="off"
            importantForAutofill="no"
            spellCheck={false}
          />
          <PigInput placeholder="Player Name" value={name} onChangeText={setName} maxLength={NAME_MAX} />
          <PigButton name={busy ? 'Joining…' : 'Lobby'} onPress={join} />
        </>
      }
    />
  );
}
