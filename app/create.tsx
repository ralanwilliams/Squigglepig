import React, { useState } from 'react';
import { Stage } from '../src/components/Stage';
import { Logo } from '../src/components/Logo';
import { PigButton } from '../src/components/PigButton';
import { PigInput } from '../src/components/PigInput';
import { showToast } from '../src/components/Toast';
import { IMAGES } from '../src/assets/assets';
import { NAME_MAX, entryMessage, useGame } from '../src/state/GameContext';

// Create a new game (was pages/CreateGame.js). The server makes the room and
// its code (supabase/rooms.sql), so no two rooms ever share one.

// Secret switches typed as the username: an exact phrase (case and outer
// spaces ignored) runs its action instead of becoming the name, and the field
// clears. None at the moment — add entries as `'phrase': () => { … }` (a
// showToast from src/components/Toast is a good way to confirm it worked).
const SWITCHES: Record<string, () => void> = {};

export default function Create() {
  const { enterRoom } = useGame();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const onChangeName = (text: string) => {
    const action = SWITCHES[text.trim().toLowerCase()];
    if (!action) {
      setName(text);
      return;
    }
    setName('');
    action();
  };

  const create = async () => {
    if (busy) return;
    setBusy(true);
    const status = await enterRoom(null, name);
    setBusy(false);
    if (status !== 'ok') showToast(entryMessage(status), 3500);
  };

  return (
    <Stage
      focus={<Logo source={IMAGES.home} />}
      actions={
        <>
          <PigInput placeholder="Player Name" value={name} onChangeText={onChangeName} maxLength={NAME_MAX} />
          <PigButton name={busy ? 'Creating…' : 'Create'} onPress={create} />
        </>
      }
    />
  );
}
